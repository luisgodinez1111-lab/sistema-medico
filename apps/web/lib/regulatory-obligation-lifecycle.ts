import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{runClinicalCommand,lookupReplay,readAggregateStream}from"./clinical-runtime";
import{assertReadVersion,requireMutationHeaders}from"./http-command";
import{PERIODICITIES,nextDueDate,obligationTemplate,OBLIGATION_CATALOG,assertObligationTransition,
 type ObligationState}from"../../../packages/regulatory-obligations/src";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,resolveVerified,parseJson}from"./http-command";
// EPIC AC — Obligaciones REGULATORIAS del consultorio (fiscales SAT, salud COFEPRIS, laborales, protección civil,
// administrativas). Dominio administrativo a nivel TENANT (no PHI, sin paciente), sobre el mismo kernel event-sourced.
// El estado (Al día / Próxima / Vencida / Vigente) NO se almacena: se COMPUTA de la fecha límite (determinista).
const AGG="RegulatoryObligation";
const CATEGORIES=["Fiscal (SAT)","Salud (COFEPRIS)","Laboral","Protección civil","Administrativa","Otros"] as const;
// Auditoría 2026-09-19, anexo R02b (R2B-024, lote 20) — PERIODICIDAD ESTRUCTURADA Y OBLIGACIONES CON NOMBRE.
//
// `periodicity` era `z.string().min(1)`: «anual», «cada año», «1 vez al año» y «asdf» eran igual de válidos, así que no se
// podía calcular el siguiente vencimiento ni agrupar. Y las «obligaciones» eran seis categorías de un desplegable, sin las
// normas nombradas que el propio repositorio declara aplicables. Ahora la periodicidad es un enum que sí permite calcular, y
// `code` permite anclar la obligación al catálogo (NOM-004, NOM-024, aviso de privacidad, aviso de funcionamiento…) sin
// perder la posibilidad de declarar una propia.
const FECHA=/^\d{4}-\d{2}-\d{2}$/;
export const CreateBody=z.object({obligationId:z.string().uuid(),name:z.string().min(1),category:z.enum(CATEGORIES),
 periodicity:z.enum(PERIODICITIES),
 code:z.string().trim().max(60).optional(),
 dueDate:z.string().regex(FECHA,"La fecha límite es YYYY-MM-DD").optional(),
 occurredAt:z.string().datetime()});
export async function handleRegulatoryObligationCreate(req:Request):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);
  authorize(principalFrom(claims),{scope:"obligation:write",purpose:"TREATMENT"});
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,CreateBody);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:b.obligationId,expectedVersion:0,eventType:"REGULATORY_OBLIGATION_CREATED",payload:{kind:"CREATED",name:b.name,category:b.category,periodicity:b.periodicity,...(b.code?{code:b.code}:{}),...(b.dueDate?{dueDate:b.dueDate}:{})},occurredAt:b.occurredAt,topic:"regulatory_obligation.created"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({obligationId:b.obligationId,state:"CREATED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

/**
 * R2B-024: EL CICLO QUE NO EXISTÍA. El archivo tenía UN handler —crear— así que una obligación, una vez registrada, no se
 * podía marcar cumplida, ni adjuntar evidencia, ni renovar. Un registro en el que nada se cumple solo crece.
 *
 * `loadState` pliega el stream para saber en qué estado está, porque sin estado no hay transición que validar: era el mismo
 * defecto que R2B-026 documenta en la historia adaptativa, y aquí se evita desde el principio.
 */
type Plegada=Readonly<{exists:boolean;state:ObligationState;version:number;periodicity:string;dueDate:string|null;name:string}>;
async function loadState(ctx:Parameters<typeof runClinicalCommand>[0],obligationId:string):Promise<Plegada>{
 const eventos=await readAggregateStream(ctx,AGG,obligationId);
 if(eventos.length===0)return{exists:false,state:"OPEN",version:0,periodicity:"OTRA",dueDate:null,name:""};
 const ordenados=[...eventos].sort((a,b)=>a.sequence-b.sequence);
 let state:ObligationState="OPEN",periodicity="OTRA",dueDate:string|null=null,name="";
 for(const e of ordenados){
  const k=String(e.payload["kind"]??"");
  if(k==="CREATED"){periodicity=String(e.payload["periodicity"]??"OTRA");name=String(e.payload["name"]??"");
   dueDate=typeof e.payload["dueDate"]==="string"?String(e.payload["dueDate"]):null;state="OPEN";}
  else if(k==="COMPLIED")state="COMPLIED";
  else if(k==="RENEWED"){state="OPEN";dueDate=typeof e.payload["dueDate"]==="string"?String(e.payload["dueDate"]):dueDate;}
  else if(k==="WAIVED")state="WAIVED";
 }
 return{exists:true,state,version:ordenados[ordenados.length-1]!.sequence,periodicity,dueDate,name};
}
function authzObligation(claims:Parameters<typeof principalFrom>[0]){
 authorize(principalFrom(claims),{scope:"obligation:write",purpose:["TREATMENT","OPERATIONS"]});
}
/** Prepara una transición: verifica, autoriza, exige cabeceras y pliega el stream. 404 si la obligación no existe. */
async function prepararTransicion(req:Request,obligationId:string){
 const{claims,ctx}=resolveVerified(req);
 authzObligation(claims);
 const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
 const plegada=await loadState(ctx,obligationId);
 if(!plegada.exists)throw new ClinicalError("NOT_FOUND","Regulatory obligation not found");
 return{ctx,claims,idempotencyKey,expectedVersion,plegada};
}
/** Escribe la transición validando la máquina de estados contra el estado REAL del stream, leído en la versión `version`. */
async function escribir(ctx:Parameters<typeof runClinicalCommand>[0],idempotencyKey:string,expectedVersion:number,
 obligationId:string,version:number,from:ObligationState,to:ObligationState,eventType:string,payload:Record<string,unknown>,
 occurredAt:string,topic:string,extra:Record<string,unknown>={}):Promise<Response>{
 const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId:obligationId,expectedVersion,eventType,payload,occurredAt,topic});
 let result=await lookupReplay(ctx,cmd);
 if(!result){
  // Cumplir dos veces, o renovar algo que no se ha cumplido, son errores de SECUENCIA: se responden como conflicto y no se
  // escriben. Sin estado real no habría con qué compararlos, que es el defecto que R2B-026 documenta en otro módulo.
  // D7: el estado `from` es el de la versión leída; si If-Match es otra, la regla se evaluaría sobre lo que el cliente no vio.
  assertReadVersion("Regulatory obligation changed since last read",expectedVersion,version);
  try{assertObligationTransition(from,to);}
  catch(e){throw new ClinicalError("CONFLICT",String((e as Error).message),{from,to});}
  result=await runClinicalCommand(ctx,cmd);
 }
 const r=result.response as{version:number;auditHash?:string};
 return NextResponse.json({obligationId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed,...extra},
  {status:result.replayed?200:201});
}

export const ComplyBody=z.object({
 /** Referencia de la evidencia de cumplimiento (folio, acuse, nombre del documento). Sin evidencia, «cumplida» es una opinión. */
 evidenceRef:z.string().trim().min(3,"La evidencia de cumplimiento es obligatoria: un folio, un acuse o el documento"),
 notes:z.string().max(500).optional(),
 occurredAt:z.string().datetime()});
export async function handleRegulatoryObligationComply(req:Request,obligationId:string):Promise<Response>{
 try{
  const{ctx,claims,idempotencyKey,expectedVersion,plegada}=await prepararTransicion(req,obligationId);
  const b=await parseJson(req,ComplyBody);
  return await escribir(ctx,idempotencyKey,expectedVersion,obligationId,plegada.version,plegada.state,"COMPLIED",
   "REGULATORY_OBLIGATION_COMPLIED",
   {kind:"COMPLIED",evidenceRef:b.evidenceRef,...(b.notes?{notes:b.notes}:{}),compliedBy:claims.sub},
   b.occurredAt,"regulatory_obligation.complied",{evidenceRef:b.evidenceRef});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

export const RenewBody=z.object({
 /** Nueva fecha límite. Si se omite, se DERIVA de la periodicidad declarada; si esta no define intervalo, es obligatoria. */
 dueDate:z.string().regex(FECHA).optional(),
 occurredAt:z.string().datetime()});
export async function handleRegulatoryObligationRenew(req:Request,obligationId:string):Promise<Response>{
 try{
  const{ctx,idempotencyKey,expectedVersion,plegada}=await prepararTransicion(req,obligationId);
  const b=await parseJson(req,RenewBody);
  // Derivar el próximo vencimiento de la periodicidad es la razón de que `periodicity` haya dejado de ser texto libre: con
  // «cada año» escrito a mano no había nada que calcular.
  const derivada=plegada.dueDate?nextDueDate(plegada.dueDate,plegada.periodicity as never):null;
  const nueva=b.dueDate??derivada;
  if(!nueva)throw new ClinicalError("VALIDATION_ERROR",
   "Esta obligación no tiene periodicidad ni fecha previa que permitan derivar el próximo vencimiento: hay que declararla.");
  return await escribir(ctx,idempotencyKey,expectedVersion,obligationId,plegada.version,plegada.state,"OPEN",
   "REGULATORY_OBLIGATION_RENEWED",
   {kind:"RENEWED",dueDate:nueva,derivedFromPeriodicity:b.dueDate===undefined},
   b.occurredAt,"regulatory_obligation.renewed",{dueDate:nueva,derivedFromPeriodicity:b.dueDate===undefined});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
/** Catálogo expuesto para que la pantalla ofrezca obligaciones con nombre en vez de solo categorías. */
export const REGULATORY_CATALOG=OBLIGATION_CATALOG;
export const obligationTemplateByCode=obligationTemplate;
