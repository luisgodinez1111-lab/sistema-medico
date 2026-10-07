// Auditoría 2026-09-19, anexo R03 (R03-09, R03-11) — Evidencia física de la GUARDA de signos vitales:
// unidad canónica obligatoria, conversión real, tomas anuladas fuera, enmiendas dentro y vigencia exigida. vs Neon.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{ensurePatientIn}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const vit=await import("../../apps/web/app/api/v1/vitals/route");
const vitAm=await import("../../apps/web/app/api/v1/vitals/[vitalId]/amendment/route");
const vitErr=await import("../../apps/web/app/api/v1/vitals/[vitalId]/error-mark/route");
const{readVitalInputs,MAX_VITAL_AGE_HOURS}=await import("../../apps/web/lib/vital-inputs");
const{latestVitalReadings,latestVitalsByType}=await import("../../apps/web/lib/clinical-runtime");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(scopes=["vital:write","patient:read","patient:write"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const idem=()=>crypto.randomUUID();
const{result,ok,fin}=libro();
type Post={status:number;body:Record<string,unknown>};
async function post(t:string,p:string,vt:string,v:string,unit:string,when=new Date().toISOString(),vitalId=crypto.randomUUID()):Promise<Post&{vitalId:string}>{
 const r=await vit.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({vitalId,patientId:p,vitalType:vt,value:v,unit,occurredAt:when})}));
 return{status:r.status,body:await r.json() as Record<string,unknown>,vitalId};
}
// El contexto de tenant que usan las lecturas (mismo shape que resolveVerified produce en las rutas).
const CTX={tenantId:TA,actorId:crypto.randomUUID(),actorType:"HUMAN" as const,purpose:"TREATMENT",requestId:crypto.randomUUID(),sessionId:crypto.randomUUID()};
try{
 const phys=tok();
 // 1) Unidad NO reconocida -> la escritura se RECHAZA (el expediente no guarda "150" sin saber la escala)
 const p1=await(async()=>{const id=crypto.randomUUID();await ensurePatientIn(TA,id);return id;})();
 let r=await post(phys,p1,"WEIGHT","150","u");
 ok(r.status===422||r.status===400,"UNKNOWN_UNIT_REJECTED");
 ok(JSON.stringify(r.body).includes("Unidad no reconocida"),"UNKNOWN_UNIT_MESSAGE");
 // 2) Libras -> kilogramos EN EL EVENTO (canonicalValue), no en el lector
 r=await post(phys,p1,"WEIGHT","154","lb");
 ok(r.status===201&&r.body["canonicalValue"]==="69.853"&&r.body["canonicalUnit"]==="kg","POUNDS_CONVERTED_ON_WRITE");
 // 3) El lector devuelve el valor CANÓNICO (y la unidad), no el crudo
 const rd=await latestVitalReadings(CTX,p1);
 ok(rd["WEIGHT"]?.value==="69.853"&&rd["WEIGHT"]?.canonicalUnit==="kg","READER_RETURNS_CANONICAL");
 ok(rd["WEIGHT"]?.unitAssumed===false,"UNIT_NOT_ASSUMED");
 ok((await latestVitalsByType(CTX,p1))["WEIGHT"]==="69.853","LEGACY_VIEW_ALSO_CANONICAL");
 // 4) Fahrenheit -> Celsius (98.6 °F = 37 °C). Antes se rechazaba como implausible por caer fuera de 25–45.
 r=await post(phys,p1,"TEMP","98.6","F");
 ok(r.status===201&&Number(r.body["canonicalValue"])===37,"FAHRENHEIT_CONVERTED");
 // 5) Un valor IMPLAUSIBLE en la unidad canónica sigue rechazándose (peso 700 kg)
 r=await post(phys,p1,"WEIGHT","700","kg");ok(r.status===422||r.status===400,"IMPLAUSIBLE_STILL_REJECTED");
 // 6) Presión INVERTIDA rechazada en la escritura (80/120)
 r=await post(phys,p1,"BP","80/120","mmHg");ok(r.status===422||r.status===400,"INVERTED_BP_REJECTED");
 // 7) Una toma ANULADA deja de ser "la última" (antes seguía puntuando)
 const p2=await(async()=>{const id=crypto.randomUUID();await ensurePatientIn(TA,id);return id;})();
 await post(phys,p2,"RESP","18","rpm");
 const mala=await post(phys,p2,"RESP","45","rpm");
 ok((await latestVitalReadings(CTX,p2))["RESP"]?.value==="45","VOID_BEFORE_IS_LATEST");
 const del=await vitErr.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({reason:"Toma de otro paciente",occurredAt:new Date().toISOString()})}),{params:Promise.resolve({vitalId:mala.vitalId})});
 ok(del.status===201,"VOID_ACCEPTED");
 ok((await latestVitalReadings(CTX,p2))["RESP"]?.value==="18","VOIDED_EXCLUDED");
 // 8) Una ENMIENDA sí manda (el valor corregido) y queda declarada como enmienda
 const p3=await(async()=>{const id=crypto.randomUUID();await ensurePatientIn(TA,id);return id;})();
 const orig=await post(phys,p3,"RESP","45","rpm");
 const am=await vitAm.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({value:"15",unit:"rpm",reason:"Error de transcripción",occurredAt:new Date().toISOString()})}),{params:Promise.resolve({vitalId:orig.vitalId})});
 ok(am.status===201,"AMEND_ACCEPTED");
 const rd3=await latestVitalReadings(CTX,p3);
 ok(rd3["RESP"]?.value==="15"&&rd3["RESP"]?.amended===true,"AMENDED_VALUE_WINS");
 const inp3=await readVitalInputs(CTX,p3,[{vitalType:"RESP",maxAgeHours:MAX_VITAL_AGE_HOURS.ACUTE_ADMISSION}]);
 ok(inp3.ok&&inp3.warnings.some(w=>/ENMIENDA/.test(w)),"AMENDMENT_DECLARED_IN_WARNINGS");
 // 9) VIGENCIA: una toma de hace 30 h no sirve para una decisión aguda (8 h) y sí para la antropometría (180 días)
 const p4=await(async()=>{const id=crypto.randomUUID();await ensurePatientIn(TA,id);return id;})();
 const vieja=new Date(Date.now()-30*3_600_000).toISOString();
 await post(phys,p4,"RESP","18","rpm",vieja);await post(phys,p4,"WEIGHT","70","kg",vieja);
 const agudo=await readVitalInputs(CTX,p4,[{vitalType:"RESP",maxAgeHours:MAX_VITAL_AGE_HOURS.ACUTE_ADMISSION}]);
 ok(!agudo.ok&&agudo.stale.length===1&&/frecuencia respiratoria/.test(agudo.stale[0]!),"STALE_FOR_ACUTE");
 const antro=await readVitalInputs(CTX,p4,[{vitalType:"WEIGHT",maxAgeHours:MAX_VITAL_AGE_HOURS.ANTHROPOMETRY}]);
 ok(antro.ok,"FRESH_ENOUGH_FOR_ANTHROPOMETRY");
 // 10) Un tipo ausente se declara faltante (nunca se calcula con un hueco)
 const falta=await readVitalInputs(CTX,p4,[{vitalType:"SPO2",maxAgeHours:MAX_VITAL_AGE_HOURS.ACUTE_ADMISSION}]);
 ok(!falta.ok&&falta.missing.includes("SPO2")&&/saturación/.test(falta.reason),"MISSING_DECLARED");
 // 11) Aislamiento por tenant: otro tenant no ve estas tomas
 const otro={...CTX,tenantId:crypto.randomUUID()};
 ok(Object.keys(await latestVitalReadings(otro,p1)).length===0,"TENANT_ISOLATED");
}catch(e){fin(e);}
fin();
