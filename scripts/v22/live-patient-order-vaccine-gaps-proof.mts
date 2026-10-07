// Auditoría 2026-09-19, anexo R02a (PAT-03, ORD-01, IMM-01) — EVIDENCIA FÍSICA contra Postgres real de tres protecciones
// que estaban declaradas pero inalcanzables, o directamente ausentes:
//
//   PAT-03  `DECEASED` era un estado fantasma: el fold lo declaraba y `requireRegisteredPatient` lo consumía (409 a todo
//           registro clínico nuevo), pero NINGUNA ruta podía producirlo. En la práctica, el expediente de una persona
//           fallecida seguía admitiendo notas, recetas y resultados.
//   ORD-01  una orden colocada sin resultado se quedaba en ORDERED para siempre (sin SLA, sin consulta, sin alerta) y el
//           `orderId` de un resultado se persistía sin comprobar que la orden fuera de ese paciente.
//   IMM-01  `vaccineCode` era texto libre y no había ningún cruce con las alergias registradas antes de administrar.
// Ejecuta: pnpm exec tsx ./scripts/v22/live-patient-order-vaccine-gaps-proof.mts
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env
import{directEndpoint}from"../../packages/pg-endpoint/src";
const{freshPatient}=await import("./_patient.mts");
const postgres=(await import("postgres")).default;
const{signSession}=await import("../../packages/session/src");
const{overdueOrders}=await import("../../apps/web/lib/clinical-runtime");
const deceased=await import("../../apps/web/app/api/v1/patients/[patientId]/deceased/route");
const encounters=await import("../../apps/web/app/api/v1/encounters/route");
const orders=await import("../../apps/web/app/api/v1/orders/route");
const placement=await import("../../apps/web/app/api/v1/orders/[orderId]/placement/route");
const results=await import("../../apps/web/app/api/v1/results/route");
const imm=await import("../../apps/web/app/api/v1/immunizations/route");
const immAdmin=await import("../../apps/web/app/api/v1/immunizations/[immunizationId]/administration/route");
const allergies=await import("../../apps/web/app/api/v1/allergies/route");

const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:2,prepare:false,onnotice:()=>{}});
const now=Math.floor(Date.now()/1000);
const TENANT=crypto.randomUUID(),SUB=crypto.randomUUID();
const token=signSession({sub:SUB,tenantId:TENANT,roles:["PHYSICIAN"],scopes:["patient:write","patient:read","encounter:write","order:write","order:read","result:write","result:read","immunization:write","immunization:read","allergy:write","allergy:read"],purpose:"TREATMENT",iat:now-5,exp:now+900,sessionId:crypto.randomUUID()},SIGNING_SECRET);
const H=(extra:Record<string,string>={}):Record<string,string>=>({"content-type":"application/json",authorization:"Bearer "+token,"idempotency-key":crypto.randomUUID(),...extra});
const ctx={tenantId:TENANT,actorId:SUB,actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:crypto.randomUUID()};
const at=():string=>new Date().toISOString();
const{result,ok,fin}=libro();

try{
 // ---------- PAT-03: registro de defunción ----------
 const paciente=await freshPatient(TENANT);
 let r:Response=await deceased.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"1"}),
  body:JSON.stringify({deceasedAt:new Date(Date.now()+7*86_400_000).toISOString(),occurredAt:at()})}),{params:Promise.resolve({patientId:paciente})});
 ok(r.status===400,"DEFUNCION_FUTURA_RECHAZADA");

 r=await deceased.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"1"}),
  body:JSON.stringify({deceasedAt:"1900-01-01T00:00:00.000Z",occurredAt:at()})}),{params:Promise.resolve({patientId:paciente})});
 const cuerpoPrevio=await r.json() as{error?:{details?:{conflictReason?:string}}};
 ok(r.status===400&&cuerpoPrevio.error?.details?.conflictReason==="DECEASED_BEFORE_BIRTH","DEFUNCION_ANTERIOR_AL_NACIMIENTO_RECHAZADA");

 const muerte=new Date(Date.now()-3*3_600_000).toISOString();
 r=await deceased.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"1"}),
  body:JSON.stringify({deceasedAt:muerte,cause:"Insuficiencia cardiaca congestiva descompensada",occurredAt:at()})}),{params:Promise.resolve({patientId:paciente})});
 ok(r.status===201&&(await r.json()).status==="DECEASED","DEFUNCION_REGISTRADA");
 const ev=await sql`select payload from clinical_events where tenant_id=${TENANT} and aggregate_id=${paciente} order by sequence desc limit 1`;
 const p=ev[0]!["payload"] as Record<string,unknown>;
 ok(p["kind"]==="DECEASED"&&p["deceasedAt"]===muerte&&String(p["cause"]).includes("Insuficiencia"),"EVENTO_CON_FECHA_Y_CAUSA");

 // La protección que existía pero era inalcanzable AHORA se puede alcanzar: no se abren encuentros a un fallecido.
 r=await encounters.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({encounterId:crypto.randomUUID(),patientId:paciente,occurredAt:at()})}));
 ok(r.status===409,"NINGUN_REGISTRO_CLINICO_NUEVO_TRAS_LA_DEFUNCION");

 // DECEASED es terminal: no se «revive» al paciente.
 const reactivation=await import("../../apps/web/app/api/v1/patients/[patientId]/reactivation/route");
 r=await reactivation.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"2"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({patientId:paciente})});
 ok(r.status===409,"DECEASED_ES_TERMINAL");

 // ---------- ORD-01: SLA y vínculo del resultado ----------
 const pac2=await freshPatient(TENANT);
 const orden=crypto.randomUUID();
 r=await orders.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({orderId:orden,patientId:pac2,orderType:"LAB",detail:"Biometría hemática",priority:"URGENT",occurredAt:at()})}));
 ok(r.status===201,"ORDEN_CREADA_CON_PRIORIDAD");
 // Se coloca con vencimiento en el pasado para poder observar el retraso sin esperar.
 const vencida=new Date(Date.now()-5*3_600_000).toISOString();
 r=await placement.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"1"}),body:JSON.stringify({occurredAt:at(),dueAt:vencida})}),{params:Promise.resolve({orderId:orden})});
 ok(r.status===201,"ORDEN_COLOCADA_CON_VENCIMIENTO");
 const atrasadas=await overdueOrders(ctx);
 const mia=atrasadas.find(o=>o.orderId===orden);
 ok(!!mia&&mia.priority==="URGENT"&&mia.hoursOverdue>=4,"ORDEN_APARECE_COMO_VENCIDA_CON_RETRASO");
 ok(mia!.patientId===pac2&&mia!.orderType==="LAB","LA_ORDEN_VENCIDA_TRAE_SU_CONTEXTO");

 // El resultado de OTRO paciente contra esta orden se rechaza…
 const pac3=await freshPatient(TENANT);
 r=await results.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:pac3,orderId:orden,analyte:"GLUCOSE",value:"95",unit:"mg/dL",occurredAt:at()})}));
 const conflicto=await r.json() as{error?:{details?:{conflictReason?:string}}};
 ok(r.status===409&&conflicto.error?.details?.conflictReason==="ORDER_PATIENT_MISMATCH","RESULTADO_CON_ORDEN_DE_OTRO_PACIENTE_409");

 // …y el del paciente correcto queda marcado como vinculado a una orden real.
 const resId=crypto.randomUUID();
 r=await results.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({resultId:resId,patientId:pac2,orderId:orden,analyte:"GLUCOSE",value:"95",unit:"mg/dL",occurredAt:at()})}));
 ok(r.status===201,"RESULTADO_CON_ORDEN_CORRECTA_201");
 const evRes=await sql`select payload from clinical_events where tenant_id=${TENANT} and aggregate_id=${resId} limit 1`;
 ok((evRes[0]!["payload"] as Record<string,unknown>)["orderLinked"]===true,"RESULTADO_MARCADO_COMO_VINCULADO");

 // Un resultado de laboratorio externo (orden que no existe en el sistema) se acepta pero queda marcado como NO vinculado.
 const resExterno=crypto.randomUUID();
 r=await results.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({resultId:resExterno,patientId:pac2,orderId:crypto.randomUUID(),analyte:"GLUCOSE",value:"99",unit:"mg/dL",occurredAt:at()})}));
 ok(r.status===201,"RESULTADO_EXTERNO_ACEPTADO");
 const evExt=await sql`select payload from clinical_events where tenant_id=${TENANT} and aggregate_id=${resExterno} limit 1`;
 ok((evExt[0]!["payload"] as Record<string,unknown>)["orderLinked"]===false,"RESULTADO_EXTERNO_MARCADO_COMO_NO_VINCULADO");

 // ---------- IMM-01: vocabulario y alergia a componente ----------
 const pac4=await freshPatient(TENANT);
 r=await imm.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({immunizationId:crypto.randomUUID(),patientId:pac4,vaccineCode:"Vacuna que no existe",dose:"1/1",occurredAt:at()})}));
 ok(r.status===400,"CODIGO_DE_VACUNA_LIBRE_RECHAZADO");

 // Alergia al huevo (componente de la triple viral, cultivada en embrión de pollo), gravedad moderada.
 await allergies.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:pac4,substance:"huevo",severity:"MODERATE",reaction:"urticaria",occurredAt:at()})}));
 const vac=crypto.randomUUID();
 await imm.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({immunizationId:vac,patientId:pac4,vaccineCode:"SRP",dose:"1/2",occurredAt:at()})}));
 const AP=(id:string)=>({params:Promise.resolve({immunizationId:id})});
 r=await immAdmin.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"1"}),body:JSON.stringify({lot:"L-123",site:"deltoides izquierdo",occurredAt:at()})}),AP(vac));
 const ack=await r.json() as{error?:{code?:string;message?:string}};
 ok(r.status===428&&ack.error?.code==="SAFETY_ACK_REQUIRED"&&(ack.error.message??"").includes("huevo"),"ALERGIA_A_COMPONENTE_EXIGE_CONFIRMACION");

 r=await immAdmin.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"1"}),body:JSON.stringify({lot:"L-123",site:"deltoides izquierdo",acknowledgeAllergy:true,occurredAt:at()})}),AP(vac));
 ok(r.status===400,"CONFIRMACION_SIN_JUSTIFICACION_RECHAZADA");

 r=await immAdmin.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"1"}),body:JSON.stringify({lot:"L-123",site:"deltoides izquierdo",acknowledgeAllergy:true,allergyJustification:"Reacción previa leve; se aplica con vigilancia de 30 minutos y antihistamínico disponible",occurredAt:at()})}),AP(vac));
 ok(r.status===201,"CON_CONFIRMACION_Y_JUSTIFICACION_SE_ADMINISTRA");
 const evVac=await sql`select payload from clinical_events where tenant_id=${TENANT} and aggregate_id=${vac} order by sequence desc limit 1`;
 const pv=evVac[0]!["payload"] as Record<string,unknown>;
 const constancia=pv["allergyAcknowledged"] as{substances?:string[];justification?:string}|undefined;
 ok(!!constancia&&(constancia.substances??[]).includes("huevo")&&(constancia.justification??"").length>=10,"LA_CONFIRMACION_QUEDA_EN_EL_EVENTO");

 // Alergia GRAVE al mismo componente: se bloquea y ninguna confirmación la levanta desde la ruta.
 const pac5=await freshPatient(TENANT);
 await allergies.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({allergyId:crypto.randomUUID(),patientId:pac5,substance:"huevo",severity:"SEVERE",reaction:"anafilaxia",occurredAt:at()})}));
 const vac2=crypto.randomUUID();
 await imm.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({immunizationId:vac2,patientId:pac5,vaccineCode:"SRP",dose:"1/2",occurredAt:at()})}));
 r=await immAdmin.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"1"}),body:JSON.stringify({lot:"L-123",site:"deltoides",acknowledgeAllergy:true,allergyJustification:"Intento de anular una alergia grave documentada",occurredAt:at()})}),AP(vac2));
 ok(r.status===403,"ALERGIA_GRAVE_BLOQUEA_Y_NO_SE_ANULA");
}catch(e){result.status="FAIL";result.error=e instanceof Error?e.message:String(e);}
finally{await sql.end({timeout:5});}
fin();
