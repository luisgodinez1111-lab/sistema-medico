import{NextResponse}from"next/server";
import{ClinicalError}from"../../../packages/runtime-errors/src";
import type{HttpTenantContext}from"../../../packages/http-principal/src";
import{buildCommand,requireMutationHeaders,resolveVerified}from"./http-command";
import{runClinicalCommand,lookupReplay,readAggregateStream}from"./clinical-runtime";
// Fábrica de ciclos de vida de agregado. NO es un handler de dominio: por eso NO se llama `*-lifecycle.ts`, nombre que en
// este repositorio significa «handler cableado a una ruta» y que el guardián de huérfanos (tests/v22/not-wired-integrity)
// exige que esté cableado o declarado NOT_WIRED.
//
// Auditoría 2026-09-19, anexo R02a (TPL-01) — la tríada `authz` → `loadForTransition` → `commit` estaba COPIADA en 25
// ciclos de vida, idéntica palabra por palabra en 18 de ellos. No era solo repetición: el anexo observó que «el mismo bug
// de plantilla se repitió en varios archivos», que es lo que pasa cuando una decisión de seguridad vive en 25 copias —
// arreglarla en una no la arregla en las demás, y nadie puede comprobar que las 25 dicen lo mismo.
//
// Esta fábrica es esa decisión, escrita una vez:
//   · el actor se verifica y se autoriza ANTES de leer nada (fail-closed);
//   · `If-Match` + `Idempotency-Key` son obligatorios en toda transición;
//   · un agregado que no existe es 404, no un estado inicial silencioso;
//   · el REPLAY se consulta antes de validar la transición: un reintento legítimo devuelve la respuesta original (200) en
//     vez de chocar con la máquina de estados (409);
//   · la transición se valida contra la máquina formal del dominio, nunca contra un `if` suelto.
//
// Lo que cada dominio aporta es únicamente su vocabulario: cómo se plieguen sus eventos, qué máquina valida, cómo se
// llama su identificador y qué scope exige. Siete ciclos con forma propia (documento y su firma, medicación con
// anotaciones, paciente, resultado, imagen, historia adaptativa y signos vitales) conservan su implementación: forzarlos
// a esta plantilla habría sido más frágil que la duplicación que corrige.
export type AggregateEvents=ReadonlyArray<{sequence:number;payload:Record<string,unknown>}>;
export type FoldedAggregate<S extends string>=Readonly<{exists:boolean;state:S;version:number}>;
export type LifecycleClaims=Readonly<{sub:string;tenantId:string;roles:readonly string[];scopes:readonly string[];purpose:string;sessionId:string}>;

export type AggregateSpec<F extends FoldedAggregate<S>,S extends string>=Readonly<{
 /** Tipo de agregado del event store (p. ej. "ClinicalProblem"). */
 aggregateType:string;
 /** Nombre del identificador en la respuesta JSON (p. ej. "problemId"): es parte del contrato de la API. */
 idKey:string;
 /** Mensaje del 404 cuando el agregado no existe en el tenant. */
 notFound:string;
 fold:(events:AggregateEvents)=>F;
 /** Máquina de estados formal del dominio: lanza si la transición es ilegal. */
 assertTransition:(from:S,to:S)=>void;
 /** Autorización del dominio (rol y scope). Se ejecuta antes de cualquier lectura. */
 authz:(claims:LifecycleClaims)=>void;
}>;

export function aggregateLifecycle<F extends FoldedAggregate<S>,S extends string>(spec:AggregateSpec<F,S>){
 /** Verifica sesión, autoriza, exige cabeceras de mutación y pliega el agregado. 404 si no existe. */
 const loadForTransition=async(req:Request,aggregateId:string):Promise<{ctx:HttpTenantContext;idempotencyKey:string;expectedVersion:number;folded:F;claims:LifecycleClaims}>=>{
  const{claims,ctx}=resolveVerified(req);
  spec.authz(claims as LifecycleClaims);
  const{idempotencyKey,expectedVersion}=requireMutationHeaders(req);
  const folded=spec.fold(await readAggregateStream(ctx,spec.aggregateType,aggregateId));
  if(!folded.exists)throw new ClinicalError("NOT_FOUND",spec.notFound);
  return{ctx,idempotencyKey,expectedVersion,folded,claims:claims as LifecycleClaims};
 };
 /**
  * Ejecuta la transición: replay → máquina de estados → comando atómico. `extra` añade campos a la respuesta (p. ej. una
  * huella de firma) y `precondition` corre DESPUÉS de descartar el replay y ANTES de escribir, para las comprobaciones
  * que solo aplican a una ejecución real.
  */
 const commit=async(ctx:HttpTenantContext,idempotencyKey:string,expectedVersion:number,aggregateId:string,folded:F,to:S,
  eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string,
  extra?:Record<string,unknown>,precondition?:()=>void|Promise<void>):Promise<Response>=>{
  const cmd=buildCommand({idempotencyKey,aggregateType:spec.aggregateType,aggregateId,expectedVersion,eventType,payload,occurredAt,topic});
  let result=await lookupReplay(ctx,cmd);
  if(!result){
   spec.assertTransition(folded.state,to);
   if(precondition)await precondition();
   result=await runClinicalCommand(ctx,cmd);
  }
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({[spec.idKey]:aggregateId,state:to,version:r.version,auditHash:r.auditHash,replayed:result.replayed,...(extra??{})},
   {status:result.replayed?200:201});
 };
 /**
  * Anotación sobre un agregado SIN cambiar su estado (p. ej. MODIFIED, RECONCILED): la máquina de estados no admite
  * auto-transiciones, así que una anotación no pasa por `assertTransition` pero sí conserva versión e idempotencia.
  */
 const commitAnnotation=async(ctx:HttpTenantContext,idempotencyKey:string,expectedVersion:number,aggregateId:string,folded:F,
  eventType:string,payload:Record<string,unknown>,occurredAt:string,topic:string,extra?:Record<string,unknown>):Promise<Response>=>{
  const cmd=buildCommand({idempotencyKey,aggregateType:spec.aggregateType,aggregateId,expectedVersion,eventType,payload,occurredAt,topic});
  let result=await lookupReplay(ctx,cmd);
  if(!result)result=await runClinicalCommand(ctx,cmd);
  const r=result.response as{version:number;auditHash?:string};
  return NextResponse.json({[spec.idKey]:aggregateId,state:folded.state,version:r.version,auditHash:r.auditHash,replayed:result.replayed,...(extra??{})},
   {status:result.replayed?200:201});
 };
 return{loadForTransition,commit,commitAnnotation};
}
