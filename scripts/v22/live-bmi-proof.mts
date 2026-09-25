// EPIC BO — Evidencia física: IMC + clasificación WHO desde peso+talla del paciente. vs Neon.
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const vitals=await import("../../apps/web/app/api/v1/vitals/route");
const bmi=await import("../../apps/web/app/api/v1/patients/[patientId]/bmi/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["patient:write","patient:read","vital:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const PP=(id:string)=>({params:Promise.resolve({patientId:id})});
let ts=Date.parse("2026-09-14T09:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();const idem=()=>crypto.randomUUID();
const U:Record<string,string>={WEIGHT:"kg",HEIGHT:"cm"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
function birth(y:number){const d=new Date();d.setUTCFullYear(d.getUTCFullYear()-y);return d.toISOString().slice(0,10);}
async function reg(t:string,p:string,y:number){await patR.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({patientId:p,name:`Prueba ${p.slice(0,8)}`,birthDate:birth(y),sexAtBirth:"MALE",occurredAt:at()})}));}
async function vital(t:string,p:string,vt:string,v:string){await vitalU(t,p,vt,v,U[vt]??"u");}
async function vitalU(t:string,p:string,vt:string,v:string,unit:string){await vitals.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p,vitalType:vt,value:v,unit,occurredAt:at()})}));}
async function getBmi(t:string,p:string){const r=await bmi.GET(new Request("http://l/",{headers:H(t)}),PP(p));return{status:r.status,body:await r.json()};}
try{
 const phys=tok();
 // 1) adulto 100kg / 170cm -> IMC 34.6, OBESITY_I
 const p1=crypto.randomUUID();await reg(phys,p1,40);await vital(phys,p1,"WEIGHT","100");await vital(phys,p1,"HEIGHT","170");
 let g=await getBmi(phys,p1);ok(g.status===200&&g.body.computable===true,"COMPUTABLE_200");
 ok(Math.abs(g.body.bmi-34.6)<0.2&&g.body.category==="OBESITY_I","ADULT_BMI_OBESITY_I");
 // 2) usa el peso MÁS RECIENTE: baja a 70kg -> NORMAL
 await vital(phys,p1,"WEIGHT","70");g=await getBmi(phys,p1);ok(g.body.category==="NORMAL","USES_LATEST_WEIGHT");
 // 3) R03-09: pediátrico (5a) -> la CLASIFICACIÓN no es computable (percentil IMC-para-edad), el valor se informa
 const p2=crypto.randomUUID();await reg(phys,p2,5);await vital(phys,p2,"WEIGHT","18");await vital(phys,p2,"HEIGHT","110");
 g=await getBmi(phys,p2);ok(g.body.computable===false&&g.body.pediatric===true&&g.body.reasonCode==="PEDIATRIC_PERCENTILE_REQUIRED","PEDIATRIC_NOT_CLASSIFIED");
 ok(typeof g.body.bmi==="number"&&g.body.category===undefined,"PEDIATRIC_BMI_WITHOUT_CATEGORY");
 // 4) sin talla -> no computable
 const p3=crypto.randomUUID();await reg(phys,p3,40);await vital(phys,p3,"WEIGHT","70");
 g=await getBmi(phys,p3);ok(g.body.computable===false&&g.body.missing.includes("HEIGHT"),"NO_HEIGHT_NOT_COMPUTABLE");
 // 5) R03-09: el PESO EN LIBRAS se convierte (no se trata como kg). 154 lb = 69.9 kg; con 170 cm -> IMC 24.2 (NORMAL).
 //    Antes de esta corrección el mismo dato daba IMC 53.3 ("obesidad clase III") porque la unidad era decorativa.
 const p4=crypto.randomUUID();await reg(phys,p4,40);
 await vitalU(phys,p4,"WEIGHT","154","lb");await vital(phys,p4,"HEIGHT","170");
 g=await getBmi(phys,p4);ok(g.body.computable===true&&Math.abs(g.body.weightKg-69.9)<0.2,"POUNDS_CONVERTED_TO_KG");
 ok(Math.abs(g.body.bmi-24.2)<0.3&&g.body.category==="NORMAL","POUNDS_BMI_NORMAL_NOT_OBESITY_III");
 // 6) R03-09: la TALLA EN PULGADAS se convierte (67 in = 170.2 cm)
 const p5=crypto.randomUUID();await reg(phys,p5,40);await vital(phys,p5,"WEIGHT","70");await vitalU(phys,p5,"HEIGHT","67","in");
 g=await getBmi(phys,p5);ok(g.body.computable===true&&Math.abs(g.body.heightM-1.702)<0.01,"INCHES_CONVERTED_TO_CM");
 // 7) R03-09: una unidad NO RECONOCIDA se rechaza en la escritura (el expediente no guarda "150" sin escala)
 const p6=crypto.randomUUID();await reg(phys,p6,40);
 const bad=await vitals.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem()}),body:JSON.stringify({vitalId:crypto.randomUUID(),patientId:p6,vitalType:"WEIGHT",value:"150",unit:"u",occurredAt:at()})}));
 ok(bad.status===422||bad.status===400,"UNKNOWN_UNIT_REJECTED_ON_WRITE");
 // 8) la procedencia declara con qué tomas se calculó (unidad canónica + antigüedad)
 g=await getBmi(phys,p1);ok(Array.isArray(g.body.inputs)&&g.body.inputs.some((i:{vitalType:string;unit:string})=>i.vitalType==="WEIGHT"&&i.unit==="kg"),"PROVENANCE_CANONICAL_UNITS");
 // 9) sin scope patient:read -> 403
 const noScope=tok(["vital:write"]);g=await getBmi(noScope,p1);ok(g.status===403,"MISSING_SCOPE_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
