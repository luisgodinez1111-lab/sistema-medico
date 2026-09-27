import{NextResponse}from"next/server";
import{ClinicalError}from"../../../../packages/runtime-errors/src";
import{type HttpTenantContext}from"../../../../packages/http-principal/src";
import{buildCommand,derivedUuid,requireMutationHeaders}from"../http-command";
import{readAggregateStream,readEventById}from"../runtime/event-store";
import{isAggregateId}from"../runtime/ids";
import{lookupReplay,runClinicalCommand,type ClinicalCommandResult}from"../runtime/command";
import{endpoint,type Guard,type Verified}from"../http/endpoint";
// Lote 11 (ADR-0300) — PIPELINE DE COMANDOS de los agregados clínicos. Es el protocolo que cada *-lifecycle.ts copiaba a mano
// (26 `loadForTransition`, 24 `commit`), escrito una vez y con el orden EXACTO de hoy:
//   crear:        sesión (401) → autorización (403) → Idempotency-Key (428) → caso de uso (cuerpo 400, paciente 404/409,
//                 reglas de dominio) → kernel → {<id>, <estado>, ...extra, version, auditHash, replayed} 201 / 200
//   transicionar: sesión → autorización → Idempotency-Key + If-Match (428/400) → agregado (404) → caso de uso (cuerpo 400) →
//                 replay idempotente → versión estricta (409) → máquina de estados (409) → [guardas] → kernel; [derivados]
//                 SIEMPRE, también en el replay (idempotentes por su llave: un reintento reconcilia, hallazgo D5)
// El caso de uso conserva su `parseJson(req,XBody)` literal (el registro de OpenAPI lo lee en el texto de cada handler) y hace
// él mismo el chequeo del paciente registrado justo después, como hoy. El pipeline no toca el `payload`: el hash de
// idempotencia del kernel lo serializa tal cual (claves `undefined` incluidas).
export type CommitReceipt=Readonly<{version:number;auditHash?:string}>;
type Events=Awaited<ReturnType<typeof readAggregateStream>>;
export type AggregateSpec<F>=Readonly<{
 aggregateType:string;
 idField:string;               // clave del id en la respuesta (allergyId, orderId…)
 stateField?:"state"|"status"; // clave del estado en el fold y en la respuesta (paciente y encuentro usan `status`)
 fold:(events:Events)=>F;
 notFound:string;              // mensaje del 404 del agregado
 changed?:string;              // mensaje del 409 de versión estricta ("<X> changed since last read")
}>;
export type TransitionSpec<F,S extends string>=AggregateSpec<F>&Readonly<{assertTransition:(from:S,to:S)=>void}>;
const stateKey=(spec:Readonly<{stateField?:"state"|"status"}>)=>spec.stateField??"state";
// Hallazgo D7 del lote 11 — concurrencia optimista ESTRICTA: las reglas de dominio y la máquina de estados se evalúan sobre la
// misma versión que el kernel exigirá (If-Match). Si el cliente trae otra: 409 CONCURRENCY_CONFLICT {expected,actual} antes de
// cualquier regla. Antes 23 transiciones evaluaban la máquina sobre la versión leída por el servidor: un If-Match desfasado
// respondía un CONFLICT engañoso y, bajo concurrencia, se persistían transiciones ilegales. Solo en el camino SIN replay.
export function assertReadVersion(changed:string,expected:number,actual:number):void{
 if(expected!==actual)throw new ClinicalError("CONCURRENCY_CONFLICT",changed,{expected,actual});
}
// Carga el agregado o 404: el preludio que comparten los handlers que no pasan por transitionCommand. Lee el stream TIPADO
// (hallazgo D4): un id de otro tipo de agregado es un 404, nunca un stream ajeno que plegar y en el que escribir; un id que no
// es UUID (hallazgo D8), también, y sin tocar la base.
export async function loadAggregate<F extends{exists:boolean}>(ctx:HttpTenantContext,spec:AggregateSpec<F>,id:string):Promise<F>{
 if(!isAggregateId(id))throw new ClinicalError("NOT_FOUND",spec.notFound);
 const folded=spec.fold(await readAggregateStream(ctx,spec.aggregateType,id));
 if(!folded.exists)throw new ClinicalError("NOT_FOUND",spec.notFound);
 return folded;
}
export type Creation=Readonly<{aggregateId:string;state:string;eventType:string;payload:Record<string,unknown>;occurredAt:string;topic:string;extra?:Record<string,unknown>}>;
// Creación de un agregado (versión esperada 0). No consulta el replay antes del kernel: el kernel deduplica por la llave y el
// límite de tasa compartido se cobra igual que antes del refactor.
export async function createCommand(req:Request,guard:Guard,spec:Pick<AggregateSpec<unknown>,"aggregateType"|"idField"|"stateField">,decide:(v:Verified&{idempotencyKey:string})=>Promise<Creation>):Promise<Response>{
 return endpoint(req,guard,async v=>{
  const idempotencyKey=req.headers.get("idempotency-key");
  if(!idempotencyKey)throw new ClinicalError("PRECONDITION_REQUIRED","Idempotency-Key header required");
  const c=await decide({...v,idempotencyKey});
  const cmd=buildCommand({idempotencyKey,aggregateType:spec.aggregateType,aggregateId:c.aggregateId,expectedVersion:0,eventType:c.eventType,payload:c.payload,occurredAt:c.occurredAt,topic:c.topic});
  const result=await runClinicalCommand(v.ctx,cmd);const r=result.response as CommitReceipt;
  return NextResponse.json({[spec.idField]:c.aggregateId,[stateKey(spec)]:c.state,...c.extra,version:r.version,auditHash:r.auditHash,replayed:result.replayed},{status:result.replayed?200:201});
 });
}
export type Transition<S extends string>=Readonly<{
 to:S;eventType:string;payload:Record<string,unknown>;occurredAt:string;topic:string;
 extra?:Record<string,unknown>;         // claves entre el estado y `version` en la respuesta
 tail?:Record<string,unknown>;          // claves tras `replayed` en la respuesta
 check?:false|(()=>void);               // sustituye a la máquina de estados (anotaciones) o la omite (false)
 guard?:()=>void|Promise<void>;         // barreras previas al kernel (cédula, seguridad), solo si no es replay
 afterRun?:(r:ClinicalCommandResult)=>Promise<void>; // comandos derivados (runDerivedCommand), también en el replay (D5)
}>;
export type TransitionInput<F>=Verified&Readonly<{folded:F;idempotencyKey:string;expectedVersion:number}>;
export async function transitionCommand<F extends{exists:boolean;version:number},S extends string>(req:Request,guard:Guard,spec:TransitionSpec<F,S>,id:string,decide:(l:TransitionInput<F>)=>Promise<Transition<S>>):Promise<Response>{
 return endpoint(req,guard,async v=>{
  const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
  const folded=await loadAggregate(v.ctx,spec,id);
  const t=await decide({...v,folded,idempotencyKey,expectedVersion});
  const cmd=buildCommand({idempotencyKey,aggregateType:spec.aggregateType,aggregateId:id,expectedVersion,eventType:t.eventType,payload:t.payload,occurredAt:t.occurredAt,topic:t.topic});
  let result=await lookupReplay(v.ctx,cmd);
  if(!result){
   assertReadVersion(spec.changed??`${spec.aggregateType} changed since last read`,expectedVersion,folded.version);
   if(t.check!==false){if(t.check)t.check();else spec.assertTransition((folded as unknown as Record<string,S>)[stateKey(spec)]!,t.to);}
   if(t.guard)await t.guard();
   result=await runClinicalCommand(v.ctx,cmd);
  }
  if(t.afterRun)await t.afterRun(result);
  const r=result.response as CommitReceipt;
  return NextResponse.json({[spec.idField]:id,[stateKey(spec)]:t.to,...t.extra,version:r.version,auditHash:r.auditHash,replayed:result.replayed,...t.tail},{status:result.replayed?200:201});
 });
}
// Hallazgo D6 del lote 11 — REINTENTO de un comando con efectos externos (Blob), reconocido ANTES de tocarlos. Si esta llave ya
// produjo su evento, se reconstruye el comando exacto que se ejecutó (versión = secuencia − 1, mismo payload y misma hora, que
// el payload guarda en `at`) y se devuelve la respuesta que el kernel guardó; si la llave se usó para otro comando,
// IDEMPOTENCY_CONFLICT. Antes el reintento volvía a subir el archivo a la misma ruta, el kernel lo rechazaba y la limpieza
// borraba el blob que el evento ya confirmado seguía citando.
export type PriorCommand=Readonly<{payload:Record<string,unknown>;version:number;auditHash?:string}>;
export async function priorCommand(ctx:HttpTenantContext,a:Readonly<{idempotencyKey:string;aggregateType:string;aggregateId:string;eventType:string;topic:string;at:string}>):Promise<PriorCommand|undefined>{
 const prior=await readEventById(ctx,derivedUuid(a.idempotencyKey,"event"),a.aggregateId);
 if(!prior)return undefined;
 const cmd=buildCommand({idempotencyKey:a.idempotencyKey,aggregateType:a.aggregateType,aggregateId:a.aggregateId,expectedVersion:prior.sequence-1,eventType:a.eventType,payload:prior.payload,occurredAt:String(prior.payload[a.at]??""),topic:a.topic});
 const replay=await lookupReplay(ctx,cmd);
 if(!replay)throw new ClinicalError("IDEMPOTENCY_CONFLICT","Idempotency-Key reused with a different request");
 const r=replay.response as CommitReceipt;
 return{payload:prior.payload,version:r.version,...(r.auditHash!==undefined?{auditHash:r.auditHash}:{})};
}
// ¿Algún evento confirmado cita este blob? Solo el evento de ESTA llave podría (las rutas son únicas por intento). Si no se
// puede comprobar, se responde que sí: un blob huérfano es preferible a un evento que cite un binario borrado.
export async function blobReferenced(ctx:HttpTenantContext,idempotencyKey:string,aggregateId:string,pathname:string):Promise<boolean>{
 return readEventById(ctx,derivedUuid(idempotencyKey,"event"),aggregateId).then(e=>e?.payload["pathname"]===pathname,()=>true);
}
