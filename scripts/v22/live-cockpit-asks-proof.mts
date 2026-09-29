// Porte sobre main del hallazgo D11c (lote 11) y su revisión (F1/F2/F5) — evidencia física, contra la base, de que las acciones
// del cockpit NO escriben datos inventados en eventos permanentes. Para cada acción de las tablas del workspace
// (apps/web/app/workspace/shared.tsx) se comprueba: (1) que cada dato clínico del cuerpo es un marcador ASK/ASK_CHOICE (lo escribe
// quien actúa), (2) que el cuerpo resuelto con lo que el médico teclea lo acepta el servidor y queda en el evento EXACTAMENTE lo
// tecleado (antes quedaban «L-2026-A», «deltoides izq», «99213», «EOB-<hora>», «Alta a domicilio», «CAPA implementada» o el
// estadio 3 fijo), y (3) que un marcador ASK sin resolver es 400 (por eso toda acción genérica pasa por `postAction`).
// El vocabulario de estadios de la herida es UNO (wound-fold): lo ofrece el diálogo y lo valida el servidor.
// GAP declarado (no se tapa): bajo CON-01 el otorgamiento exige la huella del documento presentado y el artefacto firmado (o el
// testigo), que la tabla del cockpit no puede pedir con honestidad; con solo firmante y rol, el servidor lo rechaza (400).
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const{freshPatient}=await import("./_patient.mts"); // L-07: el paciente debe existir
const SECRET=process.env.SESSION_SIGNING_SECRET;
const{default:postgres}=await import("postgres");
const{directEndpoint}=await import("../../packages/pg-endpoint/src"); // R01-004: única fuente del endpoint directo
const{signSession}=await import("../../packages/session/src");
const woundFold=await import("../../packages/wound-fold/src") as Record<string,unknown>;
const ws=await import("../../apps/web/app/workspace/shared");
const imR=await import("../../apps/web/app/api/v1/immunizations/route");
const imAdm=await import("../../apps/web/app/api/v1/immunizations/[immunizationId]/administration/route");
const imAdv=await import("../../apps/web/app/api/v1/immunizations/[immunizationId]/adverse-event/route");
const imRef=await import("../../apps/web/app/api/v1/immunizations/[immunizationId]/refusal/route");
const clR=await import("../../apps/web/app/api/v1/claims/route");
const clCod=await import("../../apps/web/app/api/v1/claims/[claimId]/coding/route");
const clSub=await import("../../apps/web/app/api/v1/claims/[claimId]/submission/route");
const clPay=await import("../../apps/web/app/api/v1/claims/[claimId]/payment/route");
const adR=await import("../../apps/web/app/api/v1/admissions/route");
const adDis=await import("../../apps/web/app/api/v1/admissions/[admissionId]/discharge/route");
const icR=await import("../../apps/web/app/api/v1/incidents/route");
const icRes=await import("../../apps/web/app/api/v1/incidents/[incidentId]/resolution/route");
const wnR=await import("../../apps/web/app/api/v1/wounds/route");
const wnRe=await import("../../apps/web/app/api/v1/wounds/[woundId]/reassessment/route");
const coR=await import("../../apps/web/app/api/v1/consents/route");
const coPre=await import("../../apps/web/app/api/v1/consents/[consentId]/presentation/route");
const coGr=await import("../../apps/web/app/api/v1/consents/[consentId]/grant/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
function tok(roles:string[],scopes:string[]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles,scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
const nurse=tok(["NURSE"],["immunization:write","admission:write","incident:write","wound:write","consent:write"]);
const billing=tok(["CLINICAL_ADMIN"],["billing:write"]);
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const ISO="2026-09-11T11:00:00.000Z";const idem=()=>crypto.randomUUID();
const P=(k:string,id:string)=>({params:Promise.resolve({[k]:id})});
type Route={POST:(q:Request,p:{params:Promise<Record<string,string>>})=>Promise<Response>};
const post=(route:Route,t:string,k:string,id:string,v:number,body:Record<string,unknown>)=>
 route.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":String(v)}),body:JSON.stringify(body)}),P(k,id));
const create=async(route:{POST:(q:Request)=>Promise<Response>},t:string,body:Record<string,unknown>)=>
 route.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({occurredAt:ISO,...body})}));
const sql=postgres(directEndpoint(process.env.DATABASE_URL??""),{max:2,prepare:false,onnotice:()=>{}});
const lastPayload=async(id:string)=>(await sql`select payload from clinical_events where tenant_id=${TA} and aggregate_id=${id} order by sequence desc limit 1`)[0]?.payload as Record<string,unknown>|undefined;
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
type Act={label:string;path:string;body:Record<string,unknown>};
const isAsk=(v:unknown)=>ws.isAsk(v);
/** Los campos (del cuerpo de la acción) que el médico escribe: cada uno debe ser ASK (o un arreglo de ASK). */
const asked=(b:Record<string,unknown>,keys:string[])=>keys.every(k=>{const v=b[k];return Array.isArray(v)?v.length>0&&v.every(isAsk):isAsk(v);});
/** Lo que haría el diálogo U-16 con lo que el médico teclea (por etiqueta), también dentro de arreglos. Sin respuesta -> null. */
function resolve(b:Record<string,unknown>,answers:Record<string,string>):Record<string,unknown>|null{
 const out:Record<string,unknown>={...b,occurredAt:ISO};
 for(const[k,v]of Object.entries(b)){
  if(isAsk(v)){const a=answers[(v as{__ask:string}).__ask];if(a===undefined)return null;out[k]=a;}
  else if(Array.isArray(v)&&v.some(isAsk)){const arr:unknown[]=[];for(const x of v){if(isAsk(x)){const a=answers[(x as{__ask:string}).__ask];if(a===undefined)return null;arr.push(a);}else arr.push(x);}out[k]=arr;}
 }
 return out;
}
/** Envía el cuerpo resuelto; si la tabla trae un literal en lugar de ASK, se envía el literal (lo que hacía el cockpit). */
const sendResolved=(route:Route,t:string,k:string,id:string,v:number,act:Act,answers:Record<string,string>)=>post(route,t,k,id,v,resolve(act.body,answers)??{...act.body,occurredAt:ISO});
const find=(acts:Act[],pred:(a:Act)=>boolean)=>acts.find(pred)??acts[0]!;
try{
 // (0) Un marcador ASK sin resolver no es un dato: el servidor lo rechaza. Por eso toda acción genérica resuelve antes (postAction).
 const im0=crypto.randomUUID();let r=await create(imR,nurse,{immunizationId:im0,patientId:await freshPatient(TA),vaccineCode:"Influenza",dose:"1"});
 const refuse=find(ws.immActions({id:im0,state:"DUE"}),a=>a.path.endsWith("/refusal"));
 r=await post(imRef,nurse,"immunizationId",im0,1,{...refuse.body,occurredAt:ISO});
 ok(r.status===400&&isAsk(refuse.body["reason"]),"UNRESOLVED_ASK_MARKER_IS_400");
 // (1) Vacuna «Aplicar»: lote y sitio se piden y queda lo tecleado.
 const im1=crypto.randomUUID();r=await create(imR,nurse,{immunizationId:im1,patientId:await freshPatient(TA),vaccineCode:"SRP",dose:"1"});
 const apply=find(ws.immActions({id:im1,state:"DUE"}),a=>a.path.endsWith("/administration"));
 ok(asked(apply.body,["lot","site"]),"IMM_ADMINISTER_LOT_AND_SITE_ASKED");
 r=await sendResolved(imAdm,nurse,"immunizationId",im1,1,apply,{"Lote de la vacuna aplicada (tal como figura en el frasco)":"AB1234","Sitio de aplicación":"deltoides izquierdo"});
 let pl=await lastPayload(im1);
 ok(r.status===201&&pl?.["lot"]==="AB1234"&&pl["site"]==="deltoides izquierdo","IMM_ADMINISTER_PERSISTS_TYPED_LOT_AND_SITE");
 // Evento adverso tras la vacuna: la pregunta habla de la vacuna, no de una «reacción transfusional».
 const adverse=find(ws.immActions({id:im1,state:"ADMINISTERED"}),a=>a.path.endsWith("/adverse-event"));
 const advAsk=adverse.body["reaction"] as{__ask?:string}|undefined;
 ok(asked(adverse.body,["reaction"])&&!/transfusi/i.test(advAsk?.__ask??"")&&/vacun/i.test(advAsk?.__ask??""),"IMM_ADVERSE_EVENT_ASKS_ABOUT_THE_VACCINE");
 r=await sendResolved(imAdv,nurse,"immunizationId",im1,2,adverse,{[advAsk?.__ask??""]:"Fiebre de 38.5 °C a las 12 h de la aplicación"});
 ok(r.status===201&&(await lastPayload(im1))?.["reaction"]==="Fiebre de 38.5 °C a las 12 h de la aplicación","IMM_ADVERSE_EVENT_PERSISTS_TYPED_TEXT");
 // (2) Factura: los códigos (CIE-10, no un CPT fijo) y la referencia del pago se piden.
 const cl=crypto.randomUUID();r=await create(clR,billing,{claimId:cl,patientId:await freshPatient(TA),amount:"1500.00",currency:"MXN"});
 const code=find(ws.clmActions({id:cl,state:"DRAFT"}),a=>a.path.endsWith("/coding"));
 ok(asked(code.body,["codes"]),"CLAIM_CODES_ASKED");
 r=await sendResolved(clCod,billing,"claimId",cl,1,code,{"Código CIE-10 del diagnóstico facturado":"E11.9"});
 pl=await lastPayload(cl);
 ok(r.status===201&&JSON.stringify(pl?.["codes"])===JSON.stringify(["E11.9"]),"CLAIM_CODING_PERSISTS_TYPED_ICD10");
 r=await post(clSub,billing,"claimId",cl,2,{occurredAt:ISO});ok(r.status===201,"CLAIM_SUBMITTED");
 const pay=find(ws.clmActions({id:cl,state:"SUBMITTED"}),a=>a.path.endsWith("/payment"));
 ok(asked(pay.body,["reference"]),"CLAIM_PAYMENT_REFERENCE_ASKED");
 r=await sendResolved(clPay,billing,"claimId",cl,3,pay,{"Referencia del pago (folio o EOB del pagador)":"EOB-PAGADOR-778812"});
 ok(r.status===201&&(await lastPayload(cl))?.["reference"]==="EOB-PAGADOR-778812","CLAIM_PAYMENT_PERSISTS_TYPED_REFERENCE");
 // (3) Alta: el destino se pide.
 const ad=crypto.randomUUID();r=await create(adR,nurse,{admissionId:ad,patientId:await freshPatient(TA),unit:"ER",reason:"Dolor torácico"});
 const dis=find(ws.admActions({id:ad,state:"ADMITTED"}),a=>a.path.endsWith("/discharge"));
 ok(asked(dis.body,["disposition"]),"DISCHARGE_DISPOSITION_ASKED");
 r=await sendResolved(adDis,nurse,"admissionId",ad,1,dis,{"Destino al alta":"Traslado a hospital de segundo nivel"});
 ok(r.status===201&&(await lastPayload(ad))?.["disposition"]==="Traslado a hospital de segundo nivel","DISCHARGE_PERSISTS_TYPED_DISPOSITION");
 // (4) Incidente: la resolución (acción correctiva/preventiva) se pide.
 const ic=crypto.randomUUID();r=await create(icR,nurse,{incidentId:ic,patientId:await freshPatient(TA),category:"MEDICATION_ERROR",severity:"MODERATE",description:"Dosis duplicada"});
 const res=find(ws.incActions({id:ic,state:"REPORTED"}),a=>a.path.endsWith("/resolution"));
 ok(asked(res.body,["resolution"]),"INCIDENT_RESOLUTION_ASKED");
 r=await sendResolved(icRes,nurse,"incidentId",ic,1,res,{"Resolución del incidente (acción correctiva o preventiva aplicada)":"Doble verificación de dosis en la hoja de enfermería"});
 ok(r.status===201&&(await lastPayload(ic))?.["resolution"]==="Doble verificación de dosis en la hoja de enfermería","INCIDENT_PERSISTS_TYPED_RESOLUTION");
 // (5) Herida: el estadio re-valorado se ELIGE entre las opciones del vocabulario único del fold; el servidor valida el mismo.
 const STAGES=(woundFold["WOUND_STAGES"]??[]) as readonly string[];
 const wn=crypto.randomUUID();r=await create(wnR,nurse,{woundId:wn,patientId:await freshPatient(TA),location:"SACRUM",stage:"STAGE_2"});
 const re=find(ws.wnActions({id:wn,state:"OPEN"}),a=>a.path.endsWith("/reassessment"));
 const choices=((re.body["stage"] as{choices?:{value:string}[]}|undefined)?.choices??[]).map(c=>c.value);
 ok(asked(re.body,["stage"])&&STAGES.length===6&&JSON.stringify(choices)===JSON.stringify(STAGES),"WOUND_STAGE_ASKED_FROM_FOLD_VOCABULARY");
 let v=1,accepted=0;
 for(const st of choices){r=await post(wnRe,nurse,"woundId",wn,v,{stage:st,occurredAt:ISO});if(r.status===201&&(await lastPayload(wn))?.["stage"]===st){accepted++;v++;}}
 ok(choices.length>0&&accepted===choices.length,"EVERY_OFFERED_STAGE_ACCEPTED_BY_SERVER");
 r=await post(wnRe,nurse,"woundId",wn,v,{stage:"STAGE_5",occurredAt:ISO});ok(r.status===400,"STAGE_OUTSIDE_VOCABULARY_400");
 // (6) Consentimiento: el rol del firmante es explícito (paciente / tutor) y el nombre se pide.
 const grants=ws.csActions({id:"c",state:"PRESENTED"}).filter(a=>a.path.endsWith("/grant"));
 ok(JSON.stringify(grants.map(g=>g.body["signerRole"]))===JSON.stringify(["PATIENT","GUARDIAN"])&&grants.every(g=>asked(g.body,["signerName"])),"CONSENT_GRANT_ROLE_EXPLICIT_AND_SIGNER_ASKED");
 const TEXTO="Consentimiento informado para el procedimiento X. Riesgos, alternativas y derecho a revocar.";
 const HASH=crypto.createHash("sha256").update(TEXTO).digest("hex");
 const co=crypto.randomUUID();r=await create(coR,nurse,{consentId:co,patientId:await freshPatient(TA),scopeType:"PROCEDURE",documentRef:"CI-2026-001"});
 r=await post(coPre,nurse,"consentId",co,1,{documentHash:HASH,occurredAt:ISO});ok(r.status===201,"CONSENT_PRESENTED");
 const tutor=grants.find(g=>g.body["signerRole"]==="GUARDIAN");
 const tutorBody=tutor?resolve(tutor.body,{"Nombre completo del tutor o representante legal que firma":"María Pérez Gómez"}):null;
 r=await post(coGr,nurse,"consentId",co,2,tutorBody??{occurredAt:ISO});
 ok(r.status===400,"GAP_CON01_COCKPIT_GRANT_WITHOUT_DOCUMENT_EVIDENCE_IS_400");
 r=await post(coGr,nurse,"consentId",co,2,{...(tutorBody??{}),documentHash:HASH,method:"ELECTRONIC_SIGNATURE",signatureArtifactRef:"blob://consents/firma-tutor.png",occurredAt:ISO});
 pl=await lastPayload(co);
 ok(r.status===201&&pl?.["signerRole"]==="GUARDIAN"&&pl["signerName"]==="María Pérez Gómez","CONSENT_TUTOR_GRANT_RECORDED_AS_GUARDIAN");
}catch(e){result.status="FAIL";result.error=String(e);}
await sql.end();
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
