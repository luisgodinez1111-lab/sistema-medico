import{NextResponse}from"next/server";
import{z}from"zod";
import{authorize}from"../../../packages/runtime-auth/src";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import{deterministicUuid}from"../../../packages/canonical-json/src";
import{foldAntecedentes,assertAntecedentesTransition,type FoldedAntecedentes,type AntecedentesState}from"../../../packages/antecedentes-fold/src";
import{runClinicalCommand,requireRegisteredPatient}from"./clinical-runtime";
import{toHttpError}from"./http-errors";
import{buildCommand,principalFrom,resolveVerified,parseJson}from"./http-command";
import{aggregateLifecycle}from"./lifecycle-factory";
// MATRIZ FUNDACIONAL — Ciclo de vida de los ANTECEDENTES (historia clínica basal) de un paciente. Singleton por paciente:
// el id del agregado se deriva del patientId, así que un paciente tiene UN expediente de antecedentes. Se CAPTURA una vez
// (RECORDED, expectedVersion 0) y se ENMIENDA con motivo (AMENDED), como una observación append-only. La consulta YA NO
// vuelve a preguntar hábitos/antecedentes: los lee de aquí. Scope antecedentes:write.
const AGG="Antecedentes";
// El id del agregado se deriva del paciente (singleton): un segundo RECORDED choca en version 0, forzando "capturar una vez".
export function antecedentesIdFor(patientId:string):string{return deterministicUuid(`antecedentes:${patientId}`);}
function authz(claims:{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}){
 authorize(principalFrom(claims),{scope:"antecedentes:write",purpose:"TREATMENT"});
}

// Matriz estructurada de la historia clínica. Se validan los campos EXIGIDOS/ESTRUCTURADOS (los hábitos alimentan el CDS);
// las notas son texto libre acotado. `.strip()` por sección descarta campos no declarados: la matriz tiene forma conocida.
const Seccion=z.object({flags:z.array(z.string().min(1).max(80)).max(40).optional(),notas:z.string().max(2000).optional()});
const Habitos=z.object({
 tabaquismo:z.boolean(),alcoholismo:z.boolean(),toxicomanias:z.boolean(),
 actividadFisica:z.string().max(500).optional(),alimentacion:z.string().max(500).optional(),notas:z.string().max(2000).optional(),
});
const Patologicos=z.object({
 cronicos:z.array(z.string().min(1).max(80)).max(40).optional(),
 cirugias:z.boolean().optional(),hospitalizaciones:z.boolean().optional(),transfusiones:z.boolean().optional(),
 notas:z.string().max(2000).optional(),
});
const GinecoObstetricos=z.object({aplica:z.boolean().optional(),notas:z.string().max(2000).optional()});
export const AntecedentesContentSchema=z.object({
 heredofamiliares:Seccion.optional(),
 patologicos:Patologicos.optional(),
 noPatologicos:Habitos.optional(), // hábitos/toxicomanías (no patológicos) — tabaquismo/alcoholismo/toxicomanías estructurados
 quirurgicos:Seccion.optional(),
 ginecoObstetricos:GinecoObstetricos.optional(),
 // Formato PEDIÁTRICO (II del formato de historia clínica): se auto-selecciona por la edad del paciente. Las secciones
 // compartidas (heredofamiliares/patológicos/no patológicos) sirven a ambos; éstas son propias de la historia pediátrica.
 prenatales:Seccion.optional(),       // control prenatal, infecciones/medicamentos/complicaciones del embarazo
 perinatales:Seccion.optional(),      // SDG, vía de nacimiento, APGAR, tamiz metabólico/auditivo, UCIN/ictericia
 alimentacion:Seccion.optional(),     // lactancia (exclusiva/mixta/fórmula), ablactación, intolerancias
 desarrollo:Seccion.optional(),       // crecimiento y desarrollo: hitos (sostén/sedestación/marcha/lenguaje/esfínteres)
 inmunizaciones:Seccion.optional(),   // esquema para la edad (completo/incompleto/no comprobable), cartilla revisada
 // `kind` registra el formato usado (derivado de la edad al capturar). No cambia la validación; documenta la selección.
 kind:z.enum(["ADULT","PEDIATRIC"]).optional(),
}).strict();

export const RecordBody=z.object({content:AntecedentesContentSchema,occurredAt:z.string().datetime()});
export async function handleAntecedentesRecord(req:Request,patientId:string):Promise<Response>{
 try{
  const{claims,ctx}=resolveVerified(req);authz(claims);
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const b=await parseJson(req,RecordBody);
  await requireRegisteredPatient(ctx,patientId); // L-07: el paciente debe existir en el tenant
  const aggregateId=antecedentesIdFor(patientId);
  const cmd=buildCommand({idempotencyKey,aggregateType:AGG,aggregateId,expectedVersion:0,eventType:"ANTECEDENTES_RECORDED",payload:{kind:"RECORDED",patientId,content:b.content,occurredAt:b.occurredAt},occurredAt:b.occurredAt,topic:"antecedentes.recorded"});
  const result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({antecedentesId:aggregateId,patientId,state:"RECORDED",version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}

// R02a-TPL-01: la tríada authz→load→commit vive UNA vez en lifecycle-factory.ts; aquí solo el vocabulario del dominio.
const LIFECYCLE=aggregateLifecycle<FoldedAntecedentes,AntecedentesState>({aggregateType:AGG,idKey:"antecedentesId",notFound:"Antecedentes not found",fold:foldAntecedentes,assertTransition:assertAntecedentesTransition,authz});

export const AmendBody=z.object({content:AntecedentesContentSchema,reason:z.string().trim().min(1),occurredAt:z.string().datetime()});
export async function handleAntecedentesAmend(req:Request,patientId:string):Promise<Response>{
 try{
  const aggregateId=antecedentesIdFor(patientId);
  const{ctx,idempotencyKey,expectedVersion,folded}=await LIFECYCLE.loadForTransition(req,aggregateId);
  const b=await parseJson(req,AmendBody);
  return await LIFECYCLE.commit(ctx,idempotencyKey,expectedVersion,aggregateId,folded,"AMENDED","ANTECEDENTES_AMENDED",{kind:"AMENDED",content:b.content,reason:b.reason,occurredAt:b.occurredAt},b.occurredAt,"antecedentes.amended");
 }catch(e){const h=toHttpError(e);return NextResponse.json(h.body,{status:h.status});}
}
