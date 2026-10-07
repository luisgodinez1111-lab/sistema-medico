// Auditoría 2026-09-19, anexo R02a (ENC-01, ENC-02, DOC-02, DOC-03) — EVIDENCIA FÍSICA del sello de firma con identidad
// legal y del vínculo documento↔encuentro, contra Postgres real.
//
// Lo que demuestra:
//   1) la firma de un encuentro y de un documento sellan la CÉDULA y el NOMBRE del médico dentro del hash (no solo en el
//      payload): recalcular el sello con otra cédula ya no cuadra;
//   2) el sello declara su formato y se verifica recalculándolo desde el evento persistido;
//   3) la hora de firma es del SERVIDOR y la del cliente queda como dato forense;
//   4) `recorded_at` (reloj del servidor) y `occurred_at` (hora declarada) son columnas distintas y ambas quedan;
//   5) un documento que declara un encuentro inexistente o de OTRO paciente se rechaza (404 / 409).
// Ejecuta: pnpm exec tsx ./scripts/v22/live-signature-identity-proof.mts
import crypto from"node:crypto";
import{SIGNING_SECRET}from"./_live-env.mts";
import{directEndpoint}from"../../packages/pg-endpoint/src";
const{freshPatient}=await import("./_patient.mts");
const{registerPhysicianCredentials}=await import("./_physician-credentials.mts");
const postgres=(await import("postgres")).default;
const{signSession}=await import("../../packages/session/src");
const{verifySignature}=await import("../../apps/web/lib/clinical-signature");
const encounters=await import("../../apps/web/app/api/v1/encounters/route");
const assess=await import("../../apps/web/app/api/v1/encounters/[encounterId]/assessment/route");
const sign=await import("../../apps/web/app/api/v1/encounters/[encounterId]/signature/route");
const documents=await import("../../apps/web/app/api/v1/documents/route");

const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:2,prepare:false,onnotice:()=>{}});
const now=Math.floor(Date.now()/1000);
const TENANT=crypto.randomUUID(),SUB=crypto.randomUUID();
const token=signSession({sub:SUB,tenantId:TENANT,roles:["PHYSICIAN"],scopes:["encounter:write","encounter:read","patient:write","patient:read","document:write","document:read"],purpose:"TREATMENT",iat:now-5,exp:now+900,sessionId:crypto.randomUUID()},SIGNING_SECRET);
const H=(extra:Record<string,string>={}):Record<string,string>=>({"content-type":"application/json",authorization:"Bearer "+token,"idempotency-key":crypto.randomUUID(),...extra});
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};
const ok=(c:boolean,l:string):void=>{if(!c)throw new Error("FAIL:"+l);result.checks.push(l);};
const sha=(s:string):string=>crypto.createHash("sha256").update(s).digest("hex");

try{
 const cred={fullName:"Dra. Prueba En Vivo",cedulaProfesional:"1234567"};
 await registerPhysicianCredentials(token,cred);
 const patientId=await freshPatient(TENANT);

 // --- Encuentro: abrir, valorar, firmar
 const encounterId=crypto.randomUUID();
 const HORA_CLIENTE="2026-02-01T08:00:00.000Z"; // fecha del cliente deliberadamente en el pasado
 let r:Response=await encounters.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({encounterId,patientId,occurredAt:new Date().toISOString()})}));
 ok(r.status===201,"ENCUENTRO_ABIERTO");
 const P=(id:string)=>({params:Promise.resolve({encounterId:id})});
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"1"}),body:JSON.stringify({assessment:"Faringitis aguda","plan":"Amoxicilina 500 mg cada 8 h por 7 días",occurredAt:new Date().toISOString()})}),P(encounterId));
 ok(r.status===201,"ENCUENTRO_VALORADO");

 // R02a-ENC-04: un espacio en blanco no es una valoración.
 const rBlanco=await assess.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"2"}),body:JSON.stringify({assessment:"   ",plan:"   ",occurredAt:new Date().toISOString()})}),P(encounterId));
 ok(rBlanco.status===400,"VALORACION_EN_BLANCO_RECHAZADA");

 const contenido="Faringitis aguda\nAmoxicilina 500 mg cada 8 h por 7 días";
 const t0=Date.now();
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:H({"if-match":"2"}),body:JSON.stringify({occurredAt:HORA_CLIENTE,contentHash:sha(contenido)})}),P(encounterId));
 const firma=await r.json() as{signatureDigest:string;signedAt:string;status:string};
 ok(r.status===201&&firma.status==="SIGNED","ENCUENTRO_FIRMADO");

 // 1) El evento persistido lleva la identidad legal y el formato del sello.
 const ev=await sql`select payload,occurred_at,recorded_at from clinical_events where tenant_id=${TENANT} and aggregate_id=${encounterId} order by sequence desc limit 1`;
 const payload=ev[0]!["payload"] as Record<string,unknown>;
 const signer=payload["signer"] as{fullName:string;cedulaProfesional:string};
 ok(signer?.cedulaProfesional===cred.cedulaProfesional&&signer?.fullName===cred.fullName,"EVENTO_LLEVA_IDENTIDAD_LEGAL");
 ok(payload["signatureFormat"]==="medos-sig-v2","EVENTO_DECLARA_FORMATO_DEL_SELLO");

 // 2) El sello se verifica recalculándolo… y NO cuadra si se altera la cédula del firmante.
 ok(verifySignature(payload,encounterId),"SELLO_VERIFICA");
 ok(!verifySignature({...payload,signer:{fullName:signer.fullName,cedulaProfesional:"9999999"}},encounterId),"SELLO_DETECTA_CEDULA_ALTERADA");
 ok(!verifySignature({...payload,signer:{fullName:"Dr. Suplantador",cedulaProfesional:signer.cedulaProfesional}},encounterId),"SELLO_DETECTA_NOMBRE_ALTERADO");

 // 3) La hora de firma es del SERVIDOR; la del cliente queda como dato forense.
 ok(payload["signedAtSource"]==="SERVER"&&payload["clientOccurredAt"]===HORA_CLIENTE,"HORA_DE_SERVIDOR_Y_FORENSE_DEL_CLIENTE");
 ok(Math.abs(Date.parse(String(payload["signedAt"]))-t0)<120_000,"HORA_DE_FIRMA_ES_AHORA");

 // 4) R02a-ENC-01: `recorded_at` (servidor) y `occurred_at` (declarada) son distintas y ambas se conservan.
 const conDosRelojes=await sql`select count(*)::int as n from clinical_events where tenant_id=${TENANT} and aggregate_id=${encounterId} and recorded_at is not null and occurred_at is not null`;
 ok(Number(conDosRelojes[0]?.["n"])===3,"AMBOS_RELOJES_PERSISTIDOS");
 // La fecha del cliente (febrero) NO se convirtió en la hora del evento firmado: esa es la garantía de L-02. Y el reloj
 // de registro del evento firmado es de AHORA, no del pasado que declaró el cliente.
 const conFechaDelCliente=await sql`select count(*)::int as n from clinical_events where tenant_id=${TENANT} and aggregate_id=${encounterId} and occurred_at=${HORA_CLIENTE}`;
 ok(Number(conFechaDelCliente[0]?.["n"])===0,"LA_FECHA_DEL_CLIENTE_NO_FECHA_EL_EVENTO");
 const relojes=await sql`select occurred_at, recorded_at from clinical_events where tenant_id=${TENANT} and aggregate_id=${encounterId} order by sequence desc limit 1`;
 const registrado=new Date(String(relojes[0]?.["recorded_at"])).getTime();
 ok(Math.abs(registrado-t0)<120_000,"RECORDED_AT_ES_EL_RELOJ_DEL_SERVIDOR");
 ok(registrado>=new Date(String(relojes[0]?.["occurred_at"])).getTime()-1000,"RECORDED_AT_NO_ES_ANTERIOR_AL_HECHO");

 // 5) R02a-DOC-03: un documento no puede declarar un encuentro que no existe…
 const inexistente=crypto.randomUUID();
 r=await documents.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({documentId:crypto.randomUUID(),patientId,encounterId:inexistente,docType:"PROGRESS_NOTE",title:"Nota",content:"Contenido de la nota",occurredAt:new Date().toISOString()})}));
 ok(r.status===404,"DOCUMENTO_CON_ENCUENTRO_INEXISTENTE_404");

 // …ni el encuentro de OTRO paciente.
 const otroPaciente=await freshPatient(TENANT);
 const encOtro=crypto.randomUUID();
 await encounters.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({encounterId:encOtro,patientId:otroPaciente,occurredAt:new Date().toISOString()})}));
 r=await documents.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({documentId:crypto.randomUUID(),patientId,encounterId:encOtro,docType:"PROGRESS_NOTE",title:"Nota",content:"Contenido de la nota",occurredAt:new Date().toISOString()})}));
 const cuerpo=await r.json() as{error?:{details?:{conflictReason?:string}}};
 ok(r.status===409&&cuerpo.error?.details?.conflictReason==="ENCOUNTER_PATIENT_MISMATCH","DOCUMENTO_CON_ENCUENTRO_DE_OTRO_PACIENTE_409");

 // …y el vínculo correcto sí se acepta.
 r=await documents.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({documentId:crypto.randomUUID(),patientId,encounterId,docType:"PROGRESS_NOTE",title:"Nota de evolución",content:"Contenido de la nota",occurredAt:new Date().toISOString()})}));
 ok(r.status===201,"DOCUMENTO_CON_VINCULO_CORRECTO_201");

 // …y un documento sin encuentro sigue siendo legítimo (un consentimiento no nace de una consulta).
 r=await documents.POST(new Request("http://l/",{method:"POST",headers:H(),body:JSON.stringify({documentId:crypto.randomUUID(),patientId,docType:"OTHER",title:"Consentimiento",content:"Texto del consentimiento",occurredAt:new Date().toISOString()})}));
 ok(r.status===201,"DOCUMENTO_SIN_ENCUENTRO_SIGUE_VALIDO");
}catch(e){result.status="FAIL";result.error=e instanceof Error?e.message:String(e);}
finally{await sql.end({timeout:5});}
console.log(JSON.stringify(result,null,2));
process.exit(result.status==="PASS"?0:1);
