// EPIC R/UI — Evidencia física: registro de alergias de toda la clínica (vista Alergias). Registra alergias de
// varios pacientes y tipos, transiciona una a INACTIVE, y consulta GET /allergies -> tipo derivado + estado +
// conteos por gravedad/tipo + join del nombre del paciente. RLS-scoped. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const alR=await import("../../apps/web/app/api/v1/allergies/route");
const alInR=await import("../../apps/web/app/api/v1/allergies/[allergyId]/inactivation/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","allergy:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();let ts=Date.parse("2026-09-10T09:00:00.000Z");const at=()=>new Date(ts+=3600000).toISOString();
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,name:string,y:number,sex:string){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name,birthDate:birth(y),sexAtBirth:sex,occurredAt:at()})}));}
async function rec(t:string,p:string,substance:string,severity:string,reaction:string){const id=crypto.randomUUID();const r=await alR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({allergyId:id,patientId:p,substance,severity,reaction,occurredAt:at()})}));return{id,status:r.status};}
async function inactivate(t:string,id:string,v:number){return alInR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify({occurredAt:at()})}),{params:Promise.resolve({allergyId:id})});}
async function list(t:string){const r=await alR.GET(new Request("http://l/",{method:"GET",headers:H(t)}));return{status:r.status,body:await r.json()};}
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
try{
 const phys=tok();
 const p1=crypto.randomUUID(),p2=crypto.randomUUID(),p3=crypto.randomUUID();
 await reg(phys,p1,"Ana López García",34,"FEMALE");
 await reg(phys,p2,"Carlos Mendoza",56,"MALE");
 await reg(phys,p3,"María Torres",28,"FEMALE");
 // Medicamento (grave), Ambiental (leve), Alimento (grave), Contraste (moderada), Alimento(moderada->inactivar)
 const a1=await rec(phys,p1,"Penicilina","SEVERE","Urticaria generalizada");
 await rec(phys,p1,"Polen (gramíneas)","MILD","Rinitis");
 await rec(phys,p2,"Ibuprofeno (AINE)","SEVERE","Broncoespasmo");
 await rec(phys,p3,"Mariscos","MODERATE","Anafilaxia leve");
 const a5=await rec(phys,p2,"Medio de contraste yodado","MODERATE","Prurito");
 ok(a1.status===201&&a5.status===201,"RECORD_201");

 const L=await list(phys);
 ok(L.status===200,"LIST_200");
 const b=L.body as{total:number;items:{substance:string;type:string;severityLabel:string;statusLabel:string;patientName:string}[];bySeverity:Record<string,number>;byType:Record<string,number>;patientsWithAllergies:number;activeCount:number};
 ok(b.total===5,"TOTAL_5");
 ok(b.patientsWithAllergies===3,"PATIENTS_3");
 // clasificación de tipo derivada
 const byS=(s:string)=>b.items.find(i=>i.substance===s);
 ok(byS("Penicilina")?.type==="Medicamento","TYPE_MED");
 ok(byS("Polen (gramíneas)")?.type==="Ambiental","TYPE_ENV");
 ok(byS("Mariscos")?.type==="Alimento","TYPE_FOOD");
 ok(byS("Medio de contraste yodado")?.type==="Contraste","TYPE_CONTRAST");
 // join del nombre del paciente + etiquetas ES
 ok(byS("Penicilina")?.patientName==="Ana López García","PATIENT_JOIN");
 ok(byS("Penicilina")?.severityLabel==="Grave"&&byS("Penicilina")?.statusLabel==="Activa","LABELS_ES");
 // conteos por gravedad y por tipo
 ok(b.bySeverity.grave===2&&b.bySeverity.moderada===2&&b.bySeverity.leve===1,"SEVERITY_COUNTS");
 ok(b.byType.Medicamento===2&&b.byType.Alimento===1&&b.byType.Ambiental===1&&b.byType.Contraste===1,"TYPE_COUNTS");

 // transición: inactivar una alergia -> estado refleja INACTIVE y activeCount baja
 const inRes=await inactivate(phys,a5.id,1);ok(inRes.status===200||inRes.status===201,"INACTIVATE_OK");
 const L2=await list(phys);const b2=L2.body as{activeCount:number;items:{substance:string;status:string}[]};
 ok(b2.items.find(i=>i.substance==="Medio de contraste yodado")?.status==="INACTIVE","STATUS_INACTIVE");
 ok(b2.activeCount===4,"ACTIVE_COUNT_4");

 // sin scope -> 403
 const noScope=await list(tok(["patient:read"]));
 ok(noScope.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
