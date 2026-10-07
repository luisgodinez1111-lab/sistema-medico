// EPIC AQ/UI — Evidencia física: registro de resultados diagnósticos de toda la clínica (vista Resultados).
// Recibe resultados con valores normales, críticos y de imagen, transiciona uno a ACTIONED, y consulta
// GET /results -> estado-UI derivado (Hallazgos/Normal/En seguimiento) + tipo + KPIs + join del paciente. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{canonicalUnitOf}=await import("../../packages/lab-reference/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const resR=await import("../../apps/web/app/api/v1/results/route");
const ordR=await import("../../apps/web/app/api/v1/orders/route");
const resVer=await import("../../apps/web/app/api/v1/results/[resultId]/verification/route");
const resAct=await import("../../apps/web/app/api/v1/results/[resultId]/action/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","result:write","order:write","order:read"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-01T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string,sexAtBirth="FEMALE",years=40,birthDate?:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birthDate??birth(years),sexAtBirth,occurredAt:at()})}));}
// Fecha de nacimiento relativa al RELOJ DE LA PRUEBA (que va por delante del real): la edad del paciente se calcula
// contra el `occurredAt` del resultado, así que un lactante debe nacer antes de ese instante, no antes de hoy.
const bornMonthsBeforeClock=(m:number)=>new Date(ts-m*30*86_400_000).toISOString().slice(0,10);
// Auditoría R04-F04: el tipo de estudio lo declara la ORDEN. Antes esta prueba sembraba un `orderId` aleatorio SIN orden
// detrás, así que nunca ejercitó el camino real y su comprobación del tipo validaba una regex sobre el nombre del analito.
async function orden(t:string,p:string,orderType:string,detail:string){
 const id=crypto.randomUUID();
 const r=await ordR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),
  body:JSON.stringify({orderId:id,patientId:p,orderType,detail,occurredAt:at()})}));
 if(r.status!==201&&r.status!==200)throw new Error("ORDEN_NO_CREADA:"+orderType+":"+r.status+":"+JSON.stringify(await r.json()));
 return id;
}
async function res(t:string,p:string,analyte:string,value:string,orderId?:string){const id=crypto.randomUUID();const r=await resR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({resultId:id,patientId:p,orderId:orderId??crypto.randomUUID(),analyte,value,unit:canonicalUnitOf(analyte)??"n/a",occurredAt:at()})}));const j=await r.json() as{critical?:boolean;status?:string;interpretation?:string};return{id,status:r.status,critical:!!j.critical,clinical:String(j.status??""),interpretation:String(j.interpretation??"")};}
async function verify(t:string,id:string){return resVer.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({resultId:id})});}
async function action(t:string,id:string){return resAct.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({ownerId:crypto.randomUUID(),dueAt:new Date(Date.now()+7*86400000).toISOString(),occurredAt:at()})}),{params:Promise.resolve({resultId:id})});}
async function list(t:string){const r=await resR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
const{result,ok,fin}=libro();
try{
 const phys=tok();const p1=crypto.randomUUID(),p2=crypto.randomUUID();
 await reg(phys,p1,"Ana López García");await reg(phys,p2,"Carlos Mendoza");
 // creatinina normal, glucosa muy alta (crítica/panic), radiografía (imagen)
 const rNorm=await res(phys,p1,"CREATININE","0.9");
 const rCrit=await res(phys,p2,"GLUCOSE","520");
 // El tipo viene de la ORDEN, no del nombre: imagen con orden IMAGING, y dos de laboratorio cuyo NOMBRE habría engañado
 // a la regex anterior («radio…» y «placa…»). Ése era el falso positivo de R04-F04.
 const oImg=await orden(phys,p1,"IMAGING","Radiografía de tórax PA");
 const rImg=await res(phys,p1,"Radiografía de tórax","Sin alteraciones",oImg);
 const oLab=await orden(phys,p1,"LAB","Perfil tiroideo");
 await res(phys,p1,"Radioinmunoensayo de TSH","2.1",oLab);
 const oPat=await orden(phys,p2,"PATHOLOGY","Cultivo de expectoración");
 await res(phys,p2,"Placas de Petri (cultivo)","Flora habitual",oPat);
 ok(rNorm.status===201&&rCrit.status===201,"RECEIVE_201");
 ok(rCrit.critical===true,"GLUCOSE_CRITICAL_DERIVED");
 // R03-14: el rango se elige con el ESTRATO del paciente. La MISMA hemoglobina (12.5 g/dL) es normal en una mujer y
 // anemia en un varón: antes, con el piso único de 12 g/dL, el varón salía NORMAL. La demografía ya está en el
 // expediente, así que la clasificación no necesita que nadie la declare.
 const pM=crypto.randomUUID(),pF=crypto.randomUUID();
 await reg(phys,pM,"Varón Prueba Hb","MALE",45);await reg(phys,pF,"Mujer Prueba Hb","FEMALE",45);
 const hbM=await res(phys,pM,"HEMOGLOBIN","12.5");
 const hbF=await res(phys,pF,"HEMOGLOBIN","12.5");
 ok(hbM.clinical==="ABNORMAL"&&/varón adulto/.test(hbM.interpretation),"HB_STRATIFIED_MALE_ABNORMAL");
 ok(hbF.clinical==="NORMAL"&&/mujer adulta/.test(hbF.interpretation),"HB_STRATIFIED_FEMALE_NORMAL");
 // R03-14: HbA1c 6.5 % (umbral diagnóstico ADA) ya NO se registra como normal
 const a1c=await res(phys,pF,"HBA1C","6.5");
 ok(a1c.clinical==="ABNORMAL"&&/criterio diagnóstico ADA/.test(a1c.interpretation),"HBA1C_6_5_NOT_NORMAL");
 // R03-14: un lactante tolera un potasio que en adulto es anormal (el estrato sale de la fecha de nacimiento)
 const pB=crypto.randomUUID();await reg(phys,pB,"Lactante Prueba K","MALE",0,bornMonthsBeforeClock(6));
 const kB=await res(phys,pB,"POTASSIUM","5.8");
 ok(kB.clinical==="NORMAL"&&/lactante/.test(kB.interpretation),"K_INFANT_STRATUM");
 const kA=await res(phys,pM,"POTASSIUM","5.8");
 ok(kA.clinical==="ABNORMAL","K_ADULT_ABNORMAL");

 // llevar el normal a ACTIONED (verify -> action) para el estado 'En seguimiento'
 const vr=await verify(phys,rNorm.id);ok(vr.status===200||vr.status===201,"VERIFY_OK");
 const ar=await action(phys,rNorm.id);ok(ar.status===200||ar.status===201,"ACTION_OK");

 const L=await list(phys);ok(L.status===200,"LIST_200");
 const b=L.body as{total:number;abnormal:number;enSeguimiento:number;pendientes:number;items:{analyte:string;estado:string;tipo:string;patientName:string;critical:boolean}[]};
 ok(b.total===10,"TOTAL_10_INCLUDING_STRATIFIED");
 const byA=(a:string)=>b.items.find(i=>i.analyte===a);
 // estado-UI derivado
 ok(byA("GLUCOSE")?.estado==="Hallazgos","GLUCOSE_HALLAZGOS");
 ok(byA("CREATININE")?.estado==="En seguimiento","CREATININE_EN_SEGUIMIENTO");
 ok(byA("Radiografía de tórax")?.tipo==="Imagenología","TIPO_DESDE_LA_ORDEN_IMAGING");
 // REGRESIÓN de R04-F04: los dos nombres que la regex clasificaba mal. Si alguien vuelve a adivinar por el nombre, fallan.
 ok(byA("Radioinmunoensayo de TSH")?.tipo==="Laboratorio","RADIOINMUNOENSAYO_ES_LABORATORIO");
 ok(byA("Placas de Petri (cultivo)")?.tipo==="Patología","PLACAS_DE_PETRI_ES_PATOLOGIA");
 // Un resultado sin orden resoluble NO se etiqueta como laboratorio por omisión: se dice que no se sabe.
 ok(byA("CREATININE")?.tipo==="Sin clasificar","SIN_ORDEN_NO_SE_ADIVINA");
 // join del paciente
 ok(byA("GLUCOSE")?.patientName==="Carlos Mendoza","PATIENT_JOIN");
 // KPIs: 4 con hallazgos (glucosa crítica + los tres anormales por ESTRATO: Hb del varón, HbA1c 6.5 y potasio del
 // adulto), 1 en seguimiento (creatinina ACTIONED) y 9 pendientes de revisión (todo lo RECEIVED menos la creatinina;
 // los dos añadidos por la regresión de R04-F04 son normales, así que suman a pendientes y no a hallazgos).
 // Los dos resultados normales por estrato (Hb de la mujer, potasio del lactante) NO engrosan los hallazgos: es
 // justamente lo que el estrato evita, alarmas sobre valores normales para ese paciente.
 ok(b.abnormal===4&&b.enSeguimiento===1&&b.pendientes===9,"KPIS");

 // sin scope -> 403
 const noScope=await list(tok(["patient:read"]));
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){fin(e);}
fin();
