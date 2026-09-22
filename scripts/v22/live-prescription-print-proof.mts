// Auditoría 2026-09-19 (L-05, U-20) — PRUEBA EN VIVO contra PostgreSQL real: identidad profesional del médico y receta legal.
//   · sin cédula registrada, PRESCRIBE y la FIRMA del encuentro responden 428 PRECONDITION_REQUIRED
//     (reason PHYSICIAN_CREDENTIALS_REQUIRED) y no escriben nada;
//   · la cédula se valida (7–8 dígitos) y queda como evento inmutable en el perfil del médico; el evento PRESCRIBED y el
//     SIGNED llevan la identidad legal (nombre y cédula) tal como estaba al firmar;
//   · la receta imprimible exige los datos legales: sin domicilio/teléfono del consultorio o sin duración del tratamiento
//     responde 400 (VALIDATION_ERROR) y DICE qué falta; completa, devuelve HTML con cédula, institución, paciente, genérico, dosis, vía,
//     frecuencia y duración; una anulación de barrera (U-19) consta en la receta;
//   · solo el médico que prescribió emite la receta (otro médico del mismo tenant: 403); un fármaco que no está prescrito
//     ni activo no se imprime (409).
import crypto from"node:crypto";
import"./_live-env.mts"; // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
process.env.SESSION_SIGNING_SECRET=process.env.SESSION_SIGNING_SECRET??"u20-secret";const SECRET=process.env.SESSION_SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{resolveVerified}=await import("../../apps/web/lib/http-command");
const{readAggregateEvents}=await import("../../apps/web/lib/clinical-runtime");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const al=await import("../../apps/web/app/api/v1/allergies/route");
const meds=await import("../../apps/web/app/api/v1/medications/route");
const rx=await import("../../apps/web/app/api/v1/medications/[medicationId]/prescription/route");
const credR=await import("../../apps/web/app/api/v1/physician-profile/credentials/route");
const profR=await import("../../apps/web/app/api/v1/physician-profile/route");
const office=await import("../../apps/web/app/api/v1/office-settings/route");
const printR=await import("../../apps/web/app/api/v1/patients/[patientId]/prescription-print/route");
const encR=await import("../../apps/web/app/api/v1/encounters/route");
const assess=await import("../../apps/web/app/api/v1/encounters/[encounterId]/assessment/route");
const sign=await import("../../apps/web/app/api/v1/encounters/[encounterId]/signature/route");
const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const SCOPES=["patient:write","patient:read","allergy:write","medication:propose","medication:write","settings:read","settings:write","encounter:write","encounter:read"];
function tok(roles=["PHYSICIAN"]){return signSession({sub:crypto.randomUUID(),tenantId:TA,roles,scopes:SCOPES,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);}
function H(t:string,x:Record<string,string>={}){return{"content-type":"application/json",authorization:"Bearer "+t,...x};}
const MP=(id:string)=>({params:Promise.resolve({medicationId:id})});const PP=(id:string)=>({params:Promise.resolve({patientId:id})});const EP=(id:string)=>({params:Promise.resolve({encounterId:id})});
const ISO="2026-09-10T10:00:00.000Z";const idem=()=>crypto.randomUUID();
const ACK={acknowledgeUnverified:true,unverifiedJustification:"Prueba en vivo: paciente sintético sin datos para verificar"};
const result:{status:string;checks:string[];error?:string}={status:"PASS",checks:[]};function ok(c:boolean,l:string){if(!c)throw new Error("FAIL:"+l);result.checks.push(l);}
type Err={error:{code:string;message:string;details?:{reason?:string;missing?:string[]}}};
const post=(mod:{POST:(r:Request,c?:never)=>Promise<Response>},t:string,body:Record<string,unknown>)=>mod.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify(body)}));
async function propose(t:string,pat:string,drugCode:string,extra:Record<string,unknown>={}){
 const med=crypto.randomUUID();
 const r=await meds.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem()}),body:JSON.stringify({medicationId:med,patientId:pat,drugCode,dose:"500mg",route:"VO",frequency:"c/8h",occurredAt:ISO,...extra})}));
 if(r.status!==201)throw new Error("PROPOSE_FAILED:"+r.status+":"+await r.text());return med;
}
const prescribe=(t:string,med:string,body:Record<string,unknown>={})=>rx.POST(new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,...ACK,...body})}),MP(med));
const print=(t:string,pat:string,ids:string[])=>printR.GET(new Request(`http://l/?medications=${ids.join(",")}`,{headers:H(t)}),PP(pat));
const sha=(s:string)=>crypto.createHash("sha256").update(s).digest("hex");
try{
 const phys=tok();const pat=crypto.randomUUID();
 const ctx=resolveVerified(new Request("http://l/",{headers:H(phys)})).ctx;
 ok((await post(patR,phys,{patientId:pat,name:"María Prueba López",birthDate:"1980-05-05",sexAtBirth:"FEMALE",occurredAt:ISO})).status===201,"PATIENT_REGISTERED");
 const med=await propose(phys,pat,"amoxicilina-500",{duration:"7 días",indication:"Faringoamigdalitis bacteriana"});
 // 1) sin cédula: PRESCRIBE 428 con reason estable; nada escrito
 let r=await prescribe(phys,med);let e=await r.json() as Err;
 ok(r.status===428&&e.error.code==="PRECONDITION_REQUIRED"&&e.error.details?.reason==="PHYSICIAN_CREDENTIALS_REQUIRED","PRESCRIBE_WITHOUT_CEDULA_428");
 ok((await readAggregateEvents(ctx,med)).length===1,"PRESCRIBE_WITHOUT_CEDULA_WROTE_NOTHING");
 // 1b) sin cédula: la FIRMA del encuentro también responde 428
 const enc=crypto.randomUUID();
 await post(encR,phys,{encounterId:enc,patientId:pat,occurredAt:ISO});
 r=await assess.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"1"}),body:JSON.stringify({occurredAt:ISO,assessment:"Dx",plan:"Plan"})}),EP(enc));ok(r.status===201,"ENCOUNTER_READY");
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO,contentHash:sha("Dx\nPlan")})}),EP(enc));e=await r.json() as Err;
 ok(r.status===428&&e.error.details?.reason==="PHYSICIAN_CREDENTIALS_REQUIRED","SIGN_WITHOUT_CEDULA_428");
 // 2) cédula inválida -> 400; válida -> 201; el perfil la devuelve
 r=await post(credR,phys,{fullName:"Dra. Ana Pérez Ruiz",cedulaProfesional:"12AB",institution:"UNAM"});ok(r.status===400,"INVALID_CEDULA_400");
 r=await post(credR,phys,{fullName:"Dra. Ana Pérez Ruiz",cedulaProfesional:"7654321",institution:"UNAM — Facultad de Medicina",specialty:"Medicina interna"});ok(r.status===201,"CREDENTIALS_SET_201");
 const prof=await (await profR.GET(new Request("http://l/",{headers:H(phys)}))).json() as{credentials:{cedulaProfesional:string;fullName:string}|null};
 ok(prof.credentials?.cedulaProfesional==="7654321"&&prof.credentials.fullName==="Dra. Ana Pérez Ruiz","PROFILE_RETURNS_CREDENTIALS");
 // 3) con cédula: prescribe 201 y el evento lleva la identidad legal; la firma del encuentro también
 r=await prescribe(phys,med);ok(r.status===201,"PRESCRIBED_WITH_CEDULA_201");
 const pres=(await readAggregateEvents(ctx,med)).find(x=>x.payload["kind"]==="PRESCRIBED")?.payload as{prescriber?:{fullName:string;cedulaProfesional:string}}|undefined;
 ok(pres?.prescriber?.cedulaProfesional==="7654321"&&pres.prescriber.fullName==="Dra. Ana Pérez Ruiz","PRESCRIBED_EVENT_CARRIES_PRESCRIBER_IDENTITY");
 r=await sign.POST(new Request("http://l/",{method:"POST",headers:H(phys,{"idempotency-key":idem(),"if-match":"2"}),body:JSON.stringify({occurredAt:ISO,contentHash:sha("Dx\nPlan")})}),EP(enc));ok(r.status===201,"SIGNED_WITH_CEDULA_201");
 const signed=(await readAggregateEvents(ctx,enc)).find(x=>x.payload["kind"]==="SIGNED")?.payload as{signer?:{cedulaProfesional:string}}|undefined;
 ok(signed?.signer?.cedulaProfesional==="7654321","SIGNED_EVENT_CARRIES_SIGNER_IDENTITY");
 // 4) receta: sin domicilio ni teléfono del consultorio -> 400 y dice qué falta
 r=await print(phys,pat,[med]);e=await r.json() as Err;
 ok(r.status===400&&e.error.code==="VALIDATION_ERROR"&&["establishment.address","establishment.phone"].every(m=>e.error.details?.missing?.includes(m))&&/domicilio del consultorio/.test(e.error.message),"PRINT_MISSING_ESTABLISHMENT_400");
 const cur=await (await office.GET(new Request("http://l/",{headers:H(phys)}))).json() as{version:number};
 r=await office.PUT(new Request("http://l/",{method:"PUT",headers:H(phys,{"idempotency-key":idem(),"if-match":String(cur.version)}),body:JSON.stringify({settings:{officeName:"Consultorio Prueba",address:"Av. Reforma 1, Col. Centro, CDMX, CP 06000",phone:"55 1234 5678"},occurredAt:new Date().toISOString()})}));
 ok(r.status===200||r.status===201,"OFFICE_SETTINGS_SET");
 // 4b) medicación sin duración -> 400 nombrando el medicamento
 const med2=await propose(phys,pat,"ibuprofeno-400");r=await prescribe(phys,med2);ok(r.status===201,"SECOND_PRESCRIBED");
 r=await print(phys,pat,[med,med2]);e=await r.json() as Err;
 ok(r.status===400&&e.error.details?.missing?.includes("items[1].duration")===true&&/medicamento 2: duración/.test(e.error.message),"PRINT_MISSING_DURATION_400");
 // 5) receta completa -> 200 con HTML legal
 r=await print(phys,pat,[med]);ok(r.status===200,"PRINT_200");
 const body=await r.json() as{folio:string;html:string;items:{genericName:string}[]};
 const h=body.html;
 ok(/^[0-9A-F]{10}$/.test(body.folio)&&body.items[0]!.genericName==="amoxicilina","PRINT_FOLIO_AND_GENERIC");
 ok(["Dra. Ana Pérez Ruiz","7654321","UNAM — Facultad de Medicina","Medicina interna","María Prueba López","46 años","Femenino","Consultorio Prueba","Av. Reforma 1","55 1234 5678","amoxicilina","500mg","VO","c/8h","7 días","Faringoamigdalitis bacteriana","Firma autógrafa","Antibiótico"].every(s=>h.includes(s)),"PRINT_HTML_HAS_ALL_LEGAL_FIELDS");
 ok(!h.includes("<script"),"PRINT_HTML_HAS_NO_SCRIPTS");
 // 5b) anulación de barrera (U-19) consta en la receta
 const patB=crypto.randomUUID();ok((await post(patR,phys,{patientId:patB,name:"Pedro Prueba <script>",birthDate:"1970-01-01",sexAtBirth:"MALE",occurredAt:ISO})).status===201,"PATIENT_B");
 await post(al,phys,{allergyId:crypto.randomUUID(),patientId:patB,substance:"penicilina",severity:"SEVERE",reaction:"anafilaxia",occurredAt:ISO});
 const medB=await propose(phys,patB,"amoxicilina-500",{duration:"10 días"});
 r=await prescribe(phys,medB,{overrideBarriers:["allergy"],overrideJustification:"Desensibilización programada con alergología en hospital"});ok(r.status===201,"PRESCRIBED_WITH_OVERRIDE");
 r=await print(phys,patB,[medB]);ok(r.status===200,"PRINT_WITH_OVERRIDE_200");
 const hb=(await r.json() as{html:string}).html;
 ok(hb.includes("anulación justificada de barrera(s): allergy")&&hb.includes("Pedro Prueba &lt;script&gt;")&&!hb.includes("<script>"),"PRINT_SHOWS_OVERRIDE_AND_ESCAPES_HTML");
 // 6) otro médico del mismo tenant (con cédula) no emite la receta de esta prescripción
 const other=tok();await post(credR,other,{fullName:"Dr. Otro Médico",cedulaProfesional:"11223344",institution:"IPN"});
 r=await print(other,pat,[med]);ok(r.status===403&&((await r.json()) as Err).error.code==="FORBIDDEN","OTHER_PHYSICIAN_CANNOT_PRINT_403");
 // 7) medicación solo PROPUESTA no se imprime
 const med3=await propose(phys,pat,"paracetamol-500",{duration:"3 días"});
 r=await print(phys,pat,[med3]);ok(r.status===409,"PROPOSED_ONLY_NOT_PRINTABLE_409");
 // 8) enfermería no registra cédula (Physician Control)
 r=await post(credR,tok(["NURSE"]),{fullName:"Enf. Prueba",cedulaProfesional:"1234567",institution:"UNAM"});ok(r.status===403,"NURSE_CANNOT_SET_CREDENTIALS_403");
}catch(e){result.status="FAIL";result.error=String(e);}
console.log(JSON.stringify(result,null,2));process.exit(result.status==="PASS"?0:1);
