// Auditoría 2026-09-19, anexo R06 (R06-20) — el filtro por paciente de los read-models, ejercitado contra una base real.
//
// EL HALLAZGO. Cuatro rutas DE UN PACIENTE —plan de cuidado, contexto de referencia, seguimiento y pestañas de consulta—
// llamaban al registro de TODA la clínica y filtraban por paciente en JavaScript. Para construir el plan de cuidado de un
// paciente se leían los problemas de todos, cada fila con dos subconsultas correlacionadas. Medido sobre un tenant de 900
// pacientes y 9 000 problemas: 72 389 buffers para quedarse con diez filas. Con el filtro en SQL: 106.
//
// POR QUÉ ESTA PRUEBA EXISTE. Mover un filtro de JavaScript al SQL es exactamente el cambio que puede dejar de filtrar sin
// que nadie lo note: si la condición se escribe mal, el registro devuelve pacientes ajenos y las rutas ya no filtran
// después. Eso no es una regresión de rendimiento, es una FUGA de datos entre expedientes del mismo tenant. Así que la
// invariante se ejercita con dos pacientes distintos en el mismo tenant y datos en ambos.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
import{deterministicUuid}from"../../packages/canonical-json/src";
const{allergyRegistry,problemRegistry,resultsRegistry,ordersRegistry,immunizationRegistry,claimsRegistry}=await import("../../apps/web/lib/clinical-runtime");
const{runClinicalCommand}=await import("../../apps/web/lib/runtime/command");
const{buildCommand}=await import("../../apps/web/lib/http-command");
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
const det=(s:string):string=>deterministicUuid(s); // R01-015: única derivación de UUID del repo
const RUN=crypto.randomUUID();
const TENANT=det("scope-tenant-"+RUN);
const ctx={tenantId:TENANT,actorId:det("scope-actor-"+RUN),actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:det("scope-req-"+RUN)};
const A=det("scope-pac-a-"+RUN),B=det("scope-pac-b-"+RUN);
const T0=new Date(Date.now()-3_600_000).toISOString();
let n=0;
/** Siembra un agregado con su evento base; `runClinicalCommand` aplica las mismas barreras que la ruta. */
async function sembrar(aggregateType:string,eventType:string,payload:Record<string,unknown>){
 const id=det(`scope-${aggregateType}-${++n}-${RUN}`);
 await runClinicalCommand(ctx,buildCommand({idempotencyKey:`scope-${n}-${RUN}`,aggregateType,aggregateId:id,expectedVersion:0,eventType,
  payload:{...payload},occurredAt:T0,topic:`${aggregateType.toLowerCase()}.seeded`}));
 return id;
}
try{
 // Dos pacientes registrados en el MISMO tenant, cada uno con datos en los seis registros.
 for(const[pid,nombre]of[[A,"Paciente Alfa"],[B,"Paciente Beta"]] as const){
  await sembrar("Patient","PATIENT_REGISTERED",{kind:"REGISTERED",patientId:pid,name:nombre,birthDate:"1980-01-01",sexAtBirth:"FEMALE"});
  await sembrar("Allergy","ALLERGY_RECORDED",{kind:"RECORDED",patientId:pid,substance:`Sustancia ${nombre}`,reaction:"Urticaria",severity:"MILD"});
  await sembrar("ClinicalProblem","PROBLEM_ADDED",{kind:"ADDED",patientId:pid,code:"E11.9",codeSystem:"ICD-10",description:`Dx de ${nombre}`,category:"Endocrino"});
  await sembrar("DiagnosticResult","RESULT_RECEIVED",{kind:"RECEIVED",patientId:pid,orderId:det(`scope-ord-res-${pid}`),analyte:"GLUCOSE",value:"95",unit:"mg/dL",critical:false,status:"NORMAL"});
  await sembrar("ClinicalOrder","ORDER_CREATED",{kind:"CREATED",patientId:pid,orderType:"LAB",detail:`Orden de ${nombre}`});
  await sembrar("Immunization","IMMUNIZATION_DUE",{kind:"DUE",patientId:pid,vaccineCode:"INFLUENZA",dose:"1"});
  await sembrar("Claim","CLAIM_DRAFTED",{kind:"DRAFTED",patientId:pid,amount:"100.00",currency:"MXN"});
 }
 ok(true,"sembrados dos pacientes del mismo tenant con datos en los seis registros");

 // 1) Sin filtro: el registro es de toda la clínica y ve a los dos.
 const todosProblemas=await problemRegistry(ctx);
 ok(todosProblemas.length>=2,`sin filtro, el registro es de toda la clínica (${todosProblemas.length} problemas)`);
 ok(new Set(todosProblemas.map(p=>p.patientId)).size>=2,"y contiene a los dos pacientes");

 // 2) Con filtro: SOLO el paciente pedido. Es la invariante que protege el expediente, no una optimización.
 // Cada entrada sabe leer su registro con filtro y SIN filtro, para poder comparar las dos formas entre sí.
 const registros=[
  ["allergyRegistry",async(pid?:string)=>(await allergyRegistry(ctx,pid?{patientId:pid}:undefined)).map(r=>r.patientId)],
  ["problemRegistry",async(pid?:string)=>(await problemRegistry(ctx,pid?{patientId:pid}:undefined)).map(r=>r.patientId)],
  ["resultsRegistry",async(pid?:string)=>(await resultsRegistry(ctx,pid?{patientId:pid}:undefined)).map(r=>r.patientId)],
  ["ordersRegistry",async(pid?:string)=>(await ordersRegistry(ctx,pid?{patientId:pid}:undefined)).map(r=>r.patientId)],
  ["immunizationRegistry",async(pid?:string)=>(await immunizationRegistry(ctx,pid?{patientId:pid}:undefined)).map(r=>r.patientId)],
  ["claimsRegistry",async(pid?:string)=>(await claimsRegistry(ctx,pid?{patientId:pid}:undefined)).map(r=>r.patientId)],
 ] as const;
 for(const[nombre,leer]of registros){
  const deA=await leer(A),deB=await leer(B),todos=await leer();
  ok(deA.length>0,`${nombre}: el filtro devuelve las filas del paciente pedido (${deA.length})`);
  ok(deA.every(p=>p===A),`${nombre}: NINGUNA fila de otro paciente del mismo tenant (fuga: ${deA.filter(p=>p!==A).join(",")})`);
  ok(deB.every(p=>p===B),`${nombre}: lo mismo con el segundo paciente`);
  // El filtro no pierde ni inventa filas: lo que devuelve para A y para B es EXACTAMENTE lo que el registro completo tiene
  // de A y de B. Ésta es la comprobación que cierra el cambio de filtrar-en-JS a filtrar-en-SQL.
  const enTodos=todos.filter(p=>p===A||p===B).length;
  ok(deA.length+deB.length===enTodos,
   `${nombre}: el filtro coincide con el registro completo para esos pacientes (${deA.length}+${deB.length} vs ${enTodos})`);
 }

 // 3) Un paciente inexistente no devuelve nada (el filtro no se ignora en silencio cuando no hay coincidencias).
 const fantasma=await problemRegistry(ctx,{patientId:det("scope-pac-inexistente-"+RUN)});
 ok(fantasma.length===0,`un paciente sin datos devuelve vacío, no el registro completo (devolvió ${fantasma.length})`);

 console.log(JSON.stringify(result,null,2));
}catch(e){
 result.status="FAIL";result.error=e instanceof Error?e.message:String(e);
 console.log(JSON.stringify(result,null,2));
}
process.exit(result.status==="PASS"?0:1);
