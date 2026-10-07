// EPIC AD/UI — Evidencia física: tablero analítico del consultorio (vista Reportes). Siembra pacientes,
// problemas (CIE-10), facturas (algunas pagadas), órdenes, encuentros (consultas por día) y recetas reales
// (PROPOSED->PRESCRIBED), y verifica GET /reports -> pacientes + ingresos + diagnósticos + órdenes por tipo
// + procedimientos + consultas por día (encuentros) + medicamentos más prescritos + tipos de consulta (agenda)
// + indicadores de calidad (asistencia, inasistencia, HbA1c en control, expedientes cerrados). RLS-scoped. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts"); // L-05: cédula del médico sintético
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const prR=await import("../../apps/web/app/api/v1/problems/route");
const clR=await import("../../apps/web/app/api/v1/claims/route");
const clCode=await import("../../apps/web/app/api/v1/claims/[claimId]/coding/route");
const clSub=await import("../../apps/web/app/api/v1/claims/[claimId]/submission/route");
const clPay=await import("../../apps/web/app/api/v1/claims/[claimId]/payment/route");
const repR=await import("../../apps/web/app/api/v1/reports/route");
const ordR=await import("../../apps/web/app/api/v1/orders/route");
const encR=await import("../../apps/web/app/api/v1/encounters/route");
const medR=await import("../../apps/web/app/api/v1/medications/route");
const medRx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const apptR=await import("../../apps/web/app/api/v1/appointments/route");
const apptCi=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/check-in/route");
const apptCo=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/completion/route");
const apptNs=await import("../../apps/web/app/api/v1/appointments/[appointmentId]/no-show/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","problem:write","billing:write","record:export","order:write","encounter:write","medication:propose","medication:write","appointment:write","result:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
async function order(t:string,p:string,orderType:string,detail:string){await ordR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({orderId:crypto.randomUUID(),patientId:p,orderType,detail,occurredAt:at()})}));}
async function openEnc(t:string,p:string,occurredAt:string){await encR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({encounterId:crypto.randomUUID(),patientId:p,occurredAt})}));}
async function rx(t:string,p:string,drugCode:string){const id=crypto.randomUUID();await medR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:id,patientId:p,drugCode,dose:"1 tab",route:"oral",frequency:"c/8h",occurredAt:at()})}));await medRx.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at(),...ACK})}),{params:Promise.resolve({medicationId:id})});}
async function appt(t:string,p:string,apptType:string):Promise<string>{const id=crypto.randomUUID();await apptR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({appointmentId:id,patientId:p,startAt:at(),reason:"Cita",apptType,occurredAt:at()})}));return id;}
async function complete(t:string,id:string){await apptCi.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({appointmentId:id})});await apptCo.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({appointmentId:id})});}
async function noShow(t:string,id:string){await apptNs.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({appointmentId:id})});}
async function a1c(t:string,p:string,v:string){await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:crypto.randomUUID(),patientId:p,orderId:crypto.randomUUID(),analyte:"HBA1C",value:v,unit:"%",occurredAt:at()})}));}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(40),sexAtBirth:"FEMALE",occurredAt:at()})}));}
async function prob(t:string,p:string,code:string){await prR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({problemId:crypto.randomUUID(),patientId:p,code,occurredAt:at()})}));}
async function paidClaim(t:string,p:string,amount:string){const id=crypto.randomUUID();await clR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({claimId:id,patientId:p,amount,currency:"MXN",occurredAt:at()})}));await clCode.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({codes:["E11.9"],occurredAt:at()})}),{params:Promise.resolve({claimId:id})});await clSub.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({claimId:id})});await clPay.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"3"}),body:JSON.stringify({reference:"PAY",occurredAt:at()})}),{params:Promise.resolve({claimId:id})});}
async function reports(t:string,qs=""){const r=await repR.GET(new Request("http://l/"+qs,{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
// Contrato de la remediación (auditoría C-03/C-05, lote 1): con barreras NO verificables (paciente sintético sin edad, peso o
// eGFR) PRESCRIBE responde 428 hasta que el médico confirma y justifica. Las barreras BLOQUEADAS siguen devolviendo 403.
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const{result,ok,fin}=libro();
try{
 const phys=tok();await registerPhysicianCredentials(phys);
 const p1=crypto.randomUUID(),p2=crypto.randomUUID(),p3=crypto.randomUUID();
 await reg(phys,p1,"Ana");await reg(phys,p2,"Mateo");await reg(phys,p3,"María");
 // diagnósticos: E11.9 x3, I10 x2, E66.9 x1
 await prob(phys,p1,"E11.9");await prob(phys,p2,"E11.9");await prob(phys,p3,"E11.9");
 await prob(phys,p1,"I10");await prob(phys,p2,"I10");
 await prob(phys,p3,"E66.9");
 // facturas pagadas: 500 + 1200 = 1700
 await paidClaim(phys,p1,"500");await paidClaim(phys,p2,"1200");
 // órdenes: LAB x2, IMAGING x1, PROCEDURE x2 (Electrocardiograma x2) = 5 total
 await order(phys,p1,"LAB","Biometría hemática");await order(phys,p2,"LAB","Química sanguínea");
 await order(phys,p3,"IMAGING","Radiografía de tórax");
 await order(phys,p1,"PROCEDURE","Electrocardiograma");await order(phys,p2,"PROCEDURE","Electrocardiograma");
 // consultas (encuentros): 2 el 2026-10-01 + 1 el 2026-10-02 = 3 total, 2 días
 await openEnc(phys,p1,"2026-10-01T10:00:00.000Z");await openEnc(phys,p2,"2026-10-01T11:00:00.000Z");
 await openEnc(phys,p3,"2026-10-02T10:00:00.000Z");
 // recetas reales (PROPOSED->PRESCRIBED): paracetamol x2 (p1,p2) + metformina x1 (p3) = 3 recetas
 await rx(phys,p1,"paracetamol");await rx(phys,p2,"paracetamol");await rx(phys,p3,"metformina");
 // tipos de consulta (agenda): CONTROL x3, PRIMERA_VEZ x1, VACUNACION x1 = 5 citas
 const a1=await appt(phys,p1,"CONTROL");const a2=await appt(phys,p2,"CONTROL");const a3=await appt(phys,p3,"CONTROL");
 const a4=await appt(phys,p1,"PRIMERA_VEZ");await appt(phys,p2,"VACUNACION");
 // desenlaces de calidad: 3 completadas (asistencia 60%), 1 no-show (inasistencia 20%), 1 sigue agendada
 await complete(phys,a1);await complete(phys,a2);await complete(phys,a3);await noShow(phys,a4);
 // HbA1c: 3 en control (<7) + 1 fuera (8.0) -> control glucémico 75% (meta >=70 -> cumple)
 await a1c(phys,p1,"6.5");await a1c(phys,p2,"6.0");await a1c(phys,p3,"5.8");await a1c(phys,p1,"8.0");

 const R=await reports(phys);ok(R.status===200,"REPORTS_200");
 // Auditoría R04-010: RANGO DE FECHAS. El tablero devolvía siempre la historia completa, así que no se podía responder
 // «¿cuántas consultas hubo en marzo?». La ventana va sobre occurred_at (la fecha del HECHO), no sobre recorded_at.
 const sinRango=R.body as{reportWindow:{from:string|null;to:string|null};diagnosesTotal:number;resultsTotal:number};
 ok(sinRango.reportWindow.from===null&&sinRango.reportWindow.to===null,"SIN_RANGO_ES_TODA_LA_HISTORIA");
 // Una ventana anterior a cualquier dato sembrado por esta prueba tiene que dejar los totales en cero: si algo devolviera
 // el total completo, la ventana no se estaría aplicando a esa consulta.
 const vacio=await reports(phys,"?from=1990-01-01&to=1990-01-31");
 ok(vacio.status===200,"RANGO_200");
 const v=vacio.body as{reportWindow:{from:string;to:string};diagnosesTotal:number;resultsTotal:number;ordersTotal:number};
 ok(v.reportWindow.from==="1990-01-01"&&v.reportWindow.to==="1990-01-31","RANGO_DECLARADO_EN_LA_RESPUESTA");
 ok(v.diagnosesTotal===0&&v.resultsTotal===0&&v.ordersTotal===0,`RANGO_ACOTA_DE_VERDAD:${JSON.stringify(v).slice(0,120)}`);
 // Un rango mal formado o invertido NO se ignora en silencio: se rechaza con 400, porque un tablero que devuelve otra cosa
 // de lo que se le pidió es peor que uno que falla.
 ok((await reports(phys,"?from=marzo")).status===400,"RANGO_MAL_FORMADO_400");
 ok((await reports(phys,"?from=2026-03-31&to=2026-03-01")).status===400,"RANGO_INVERTIDO_400");
 const b=R.body as{patientsAttended:number;income:number;diagnosesTotal:number;topDiagnoses:{code:string;count:number;pct:number}[];ordersTotal:number;ordersByType:{type:string;count:number;pct:number}[];topProcedures:{detail:string;count:number}[];resultsTotal:number;immunizationsApplied:number;encountersTotal:number;encountersSigned:number;encountersByDay:{date:string;count:number;pct:number}[];prescriptionsTotal:number;topMedications:{drugCode:string;count:number;pct:number}[];appointmentsTotal:number;appointmentsByType:{type:string;label:string;count:number;pct:number}[];qualityIndicators:{key:string;label:string;numerator:number;denominator:number;pct:number;target:number;direction:string;met:boolean;computable:boolean}[]};
 ok(b.patientsAttended===3,"PATIENTS_3");
 ok(b.income===1700,"INCOME_1700");
 ok(b.diagnosesTotal===6,"DX_TOTAL_6");
 // top diagnóstico: E11.9 con 3
 ok(b.topDiagnoses[0]!.code==="E11.9"&&b.topDiagnoses[0]!.count===3,"TOP_DX_E119");
 ok(b.topDiagnoses.find(x=>x.code==="I10")?.count===2,"DX_I10_2");
 ok(b.topDiagnoses[0]!.pct===50,"TOP_DX_PCT_50"); // 3/6
 // órdenes: total 5, por tipo real
 ok(b.ordersTotal===5,"ORDERS_TOTAL_5");
 ok(b.ordersByType.find(x=>x.type==="LAB")?.count===2,"ORDERS_LAB_2");
 ok(b.ordersByType.find(x=>x.type==="IMAGING")?.count===1,"ORDERS_IMAGING_1");
 ok(b.ordersByType.find(x=>x.type==="PROCEDURE")?.count===2,"ORDERS_PROCEDURE_2");
 // procedimientos más realizados: Electrocardiograma con 2
 ok(b.topProcedures[0]!.detail==="Electrocardiograma"&&b.topProcedures[0]!.count===2,"TOP_PROC_EKG_2");
 // resultados y vacunas aplicadas: agregados presentes (números; sin sembrar quedan en 0)
 ok(typeof b.resultsTotal==="number"&&typeof b.immunizationsApplied==="number","RESULTS_VAC_WIRED");
 // consultas por día (encuentros): total 3, 2 días, día 2026-10-01 con 2
 ok(b.encountersTotal===3,"ENC_TOTAL_3");
 ok(b.encountersByDay.length===2,"ENC_DAYS_2");
 ok(b.encountersByDay.find(d=>d.date==="2026-10-01")?.count===2,"ENC_DAY_2026_10_01_2");
 ok(b.encountersByDay.find(d=>d.date==="2026-10-02")?.count===1,"ENC_DAY_2026_10_02_1");
 // medicamentos más prescritos: paracetamol con 2, total 3 recetas
 ok(b.prescriptionsTotal===3,"RX_TOTAL_3");
 ok(b.topMedications[0]!.drugCode==="paracetamol"&&b.topMedications[0]!.count===2,"TOP_MED_PARACETAMOL_2");
 ok(b.topMedications.find(m=>m.drugCode==="metformina")?.count===1,"MED_METFORMINA_1");
 // tipos de consulta (agenda): total 5, CONTROL con 3 (top), etiqueta legible
 ok(b.appointmentsTotal===5,"APPT_TOTAL_5");
 ok(b.appointmentsByType[0]!.type==="CONTROL"&&b.appointmentsByType[0]!.count===3,"APPT_TOP_CONTROL_3");
 ok(b.appointmentsByType[0]!.label==="Control","APPT_LABEL_CONTROL");
 ok(b.appointmentsByType.find(a=>a.type==="PRIMERA_VEZ")?.count===1,"APPT_PRIMERA_VEZ_1");
 ok(b.appointmentsByType.find(a=>a.type==="VACUNACION")?.count===1,"APPT_VACUNACION_1");
 // indicadores de calidad deterministas
 const qi=(k:string)=>b.qualityIndicators.find(x=>x.key===k);
 ok(qi("attendance")?.numerator===3&&qi("attendance")?.denominator===5&&qi("attendance")?.pct===60,"QI_ATTENDANCE_60");
 ok(qi("attendance")?.met===false,"QI_ATTENDANCE_NOT_MET"); // 60 < meta 80
 ok(qi("no_show")?.numerator===1&&qi("no_show")?.pct===20&&qi("no_show")?.met===false,"QI_NOSHOW_20_NOT_MET"); // 20 > meta 10 (menor es mejor)
 ok(qi("glycemic_control")?.numerator===3&&qi("glycemic_control")?.denominator===4&&qi("glycemic_control")?.pct===75,"QI_GLYCEMIC_75");
 ok(qi("glycemic_control")?.met===true,"QI_GLYCEMIC_MET"); // 75 >= meta 70
 ok(qi("closed_records")?.denominator===3&&qi("closed_records")?.computable===true,"QI_CLOSED_COMPUTABLE"); // 3 consultas abiertas, 0 firmadas

 // Auditoría Lote 1 (R2B-021 aplicada a HbA1c): un valor HISTÓRICO malformado NO debe tumbar el tablero. Antes el cast
 // `::numeric` del indicador «HbA1c en control» LANZABA y /reports devolvía 500 para TODO el tenant por una sola fila mala.
 // El resultado se acepta como no-numérico (cualitativo) en la captura, igual que una fila histórica previa a la validación.
 await a1c(phys,p2,"7.0.1");
 const Rmal=await reports(phys);
 ok(Rmal.status===200,"HBA1C_MALFORMADO_NO_TUMBA_REPORTES");
 const qimal=(Rmal.body as typeof b).qualityIndicators.find(x=>x.key==="glycemic_control");
 ok(qimal?.numerator===3,"HBA1C_MALFORMADO_NO_CUENTA_EN_CONTROL"); // los 3 en control siguen siendo 3; el malformado no suma

 // sin scope -> 403
 const noScope=await reports(tok(["patient:read"]));
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
