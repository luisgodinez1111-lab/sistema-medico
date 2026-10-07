// Auditoría clínica multiespecialidad (06-oct-2026) — LOS DOS BOTONES QUE ESTABAN MUERTOS, CONTRA EL SERVIDOR REAL.
//
// EL HALLAZGO. Dos botones alcanzables hoy en la pantalla del expediente no hacían lo que decían:
//
//   · «Otorgar» del consentimiento informado enviaba `{signerName:"Paciente/Tutor"}` —un nombre LITERAL, inventado— y
//     nada más. El servidor (CON-01) exige además la huella sha256 del documento que se presentó al paciente y el método
//     con que se recabó, así que respondía 400 VALIDATION_ERROR SIEMPRE. El consentimiento informado es la pieza
//     médico-legal que autoriza un procedimiento (LGS art. 81, NOM-004 numeral 10.1): el único botón para otorgarlo
//     estaba muerto, y si hubiera funcionado habría escrito «Paciente/Tutor» como firmante.
//
//   · «Enmendar» de signos vitales reenviaba el MISMO valor ya registrado y solo preguntaba el motivo. El esquema del
//     servidor se cumplía —de ahí que el guardarraíl de cuerpos no pudiera verlo: lo que estaba mal era el CONTENIDO, no
//     la forma— pero el resultado era un evento `VITAL_AMENDED` en un registro de solo-añadir que decía «corregido» sin
//     corregir nada.
//
// POR QUÉ ESTA PRUEBA IMPORTA LOS CONSTRUCTORES DE LA PANTALLA. Una prueba que armara el cuerpo a mano demostraría que el
// servidor acepta un cuerpo bueno, cosa que ya se sabía: las pruebas en vivo de consentimiento y signos vitales mandan el
// cuerpo correcto desde el principio, y por eso el defecto sobrevivió meses. El defecto vivía ENTRE el esquema y el botón.
// Así que aquí se importan `csGrantBody` y `vitAmendBody` de `shared.tsx` —los MISMOS que ejecuta el navegador— y se manda
// al servidor lo que ellos producen. Si alguien endurece el servidor y olvida la pantalla, o cambia la pantalla y manda
// algo que el servidor rechaza, esta prueba falla. No hay costura en la que esconderse.
import crypto from"node:crypto";
import type{HttpTenantContext}from"../../packages/http-principal/src";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable) y redirige DATABASE_URL a ella
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const UI=await import("../../apps/web/app/workspace/shared");
const patR=await import("../../apps/web/app/api/v1/patients/route");
const csR=await import("../../apps/web/app/api/v1/consents/route");
const csPresR=await import("../../apps/web/app/api/v1/consents/[consentId]/presentation/route");
const csGrantR=await import("../../apps/web/app/api/v1/consents/[consentId]/grant/route");
const vitR=await import("../../apps/web/app/api/v1/vitals/route");
const vitAmdR=await import("../../apps/web/app/api/v1/vitals/[vitalId]/amendment/route");
const chartR=await import("../../apps/web/app/api/v1/patients/[patientId]/chart/route");

const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const tok=(scopes=["patient:write","patient:read","consent:write","vital:write"])=>signSession(
 {sub:crypto.randomUUID(),tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
const H=(t:string,x:Record<string,string>={})=>({"content-type":"application/json",authorization:"Bearer "+t,...x});
const idem=()=>crypto.randomUUID();
let ts=Date.parse("2026-10-01T15:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();
const sha256=(s:string)=>crypto.createHash("sha256").update(s,"utf8").digest("hex");
/**
 * Un módulo de ruta de Next: su `POST` recibe la petición y, cuando la ruta tiene parámetros, su contexto. Los firman con
 * tipos distintos (`{params:Promise<{medicationId}>}`, `{params:Promise<{consentId}>}`…), así que el adaptador acepta
 * cualquiera con `never[]` —contravarianza— y hace UNA sola conversión aquí dentro en lugar de una por llamada.
 */
type RutaPost={POST:(...a:never[])=>Promise<Response>};
const{result,ok,fin}=libro();
const POST=async(r:RutaPost,body:unknown,t:string,extra:Record<string,string>={},ctx?:unknown)=>{
 const res=await (r.POST as unknown as (q:Request,c?:unknown)=>Promise<Response>)(
  new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),...extra}),body:JSON.stringify(body)}),ctx);
 return{status:res.status,body:await res.json() as Record<string,unknown>};
};

// El texto que el paciente lee. La huella se calcula de él, exactamente como lo hace el navegador al presentar.
const DOCUMENTO=["CONSENTIMIENTO INFORMADO PARA COLECISTECTOMÍA LAPAROSCÓPICA",
 "Se me ha explicado el procedimiento, sus alternativas (incluida la de no operarme) y sus riesgos:",
 "sangrado, infección de la herida, lesión de la vía biliar y conversión a cirugía abierta.",
 "He podido preguntar y mis preguntas han sido respondidas."].join("\n");

try{
 const phys=tok();
 const p=crypto.randomUUID();
 await POST(patR,{patientId:p,name:"Prueba Botones Reparados",birthDate:"1970-04-04",sexAtBirth:"FEMALE",occurredAt:at()},phys);

 // ───────── CONSENTIMIENTO: presentar con huella, otorgar con el cuerpo QUE LA PANTALLA PRODUCE ─────────
 const csId=crypto.randomUUID();
 const draft=await POST(csR,{consentId:csId,patientId:p,scopeType:"PROCEDURE",documentRef:"CI-2026-0042",occurredAt:at()},phys);
 ok(draft.status===201,`CONSENTIMIENTO_REDACTADO_${draft.status}`);

 const hash=sha256(DOCUMENTO);
 const PC=(id:string)=>({params:Promise.resolve({consentId:id})});
 const pres=await POST(csPresR,{documentHash:hash,occurredAt:at()},phys,{"if-match":"1"},PC(csId));
 ok(pres.status===201,`PRESENTADO_CON_HUELLA_${pres.status}`);

 // La huella presentada llega a la PANTALLA por el expediente vivo: sin esto el formulario de otorgamiento no tendría
 // qué firmar, y es justo el dato que no existía (el botón mandaba `signerName` a secas).
 const chart=await (chartR.GET as unknown as (q:Request,c:unknown)=>Promise<Response>)(new Request("http://l/",{headers:H(phys)}),{params:Promise.resolve({patientId:p})});
 const cb=await chart.json() as{consents:Array<{id:string;documentRef?:string;documentHash?:string;state:string}>};
 const fila=cb.consents.find(x=>x.id===csId);
 ok(fila!==undefined,"EL_CONSENTIMIENTO_ESTA_EN_EL_EXPEDIENTE");
 ok(fila?.documentRef==="CI-2026-0042",`EL_EXPEDIENTE_DICE_QUE_DOCUMENTO_ES:${fila?.documentRef}`);
 ok(fila?.documentHash===hash,"EL_EXPEDIENTE_TRAE_LA_HUELLA_PRESENTADA");

 // EL CUERPO LO ARMA LA PANTALLA. Firma autógrafa: el constructor exige el archivo firmado.
 const sinArtefacto=UI.csGrantBody({signerName:"Ana López García",signerRole:"PATIENT",method:"WET_SIGNATURE",signatureArtifactRef:"",witnessName:""},fila!.documentHash!);
 ok(sinArtefacto===null,"LA_PANTALLA_RECHAZA_UNA_FIRMA_SIN_ARCHIVO");
 const verbalSinTestigo=UI.csGrantBody({signerName:"Ana López García",signerRole:"PATIENT",method:"VERBAL_WITNESSED",signatureArtifactRef:"",witnessName:""},fila!.documentHash!);
 ok(verbalSinTestigo===null,"LA_PANTALLA_RECHAZA_UN_VERBAL_SIN_TESTIGO");
 const sinHuella=UI.csGrantBody({signerName:"Ana López García",signerRole:"PATIENT",method:"WET_SIGNATURE",signatureArtifactRef:"doc:firma-001",witnessName:""},"");
 ok(sinHuella===null,"LA_PANTALLA_RECHAZA_OTORGAR_SIN_DOCUMENTO_PRESENTADO");

 const bueno=UI.csGrantBody({signerName:"Ana López García",signerRole:"PATIENT",method:"WET_SIGNATURE",signatureArtifactRef:"doc:firma-001",witnessName:""},fila!.documentHash!);
 ok(bueno!==null,"LA_PANTALLA_PRODUCE_UN_CUERPO_COMPLETO");
 const grant=await POST(csGrantR,bueno,phys,{"if-match":"2"},PC(csId));
 // ESTE es el check que antes era imposible: el cuerpo de la pantalla, aceptado por el servidor.
 ok(grant.status===201,`EL_SERVIDOR_ACEPTA_EL_CUERPO_DE_LA_PANTALLA_${grant.status}:${JSON.stringify(grant.body).slice(0,180)}`);
 ok(grant.body["state"]==="GRANTED",`OTORGADO:${String(grant.body["state"])}`);

 // Y el cuerpo VIEJO —el literal que la pantalla enviaba— sigue siendo rechazado: la prueba de que el defecto era real.
 const cs2=crypto.randomUUID();
 await POST(csR,{consentId:cs2,patientId:p,scopeType:"TREATMENT",documentRef:"CI-2026-0043",occurredAt:at()},phys);
 await POST(csPresR,{documentHash:sha256("otro documento distinto para este consentimiento"),occurredAt:at()},phys,{"if-match":"1"},PC(cs2));
 const viejo=await POST(csGrantR,{signerName:"Paciente/Tutor",occurredAt:at()},phys,{"if-match":"2"},PC(cs2));
 ok(viejo.status===400,`EL_CUERPO_VIEJO_SIGUE_SIENDO_400_${viejo.status}`);

 // La comparación de huellas funciona: firmar un documento distinto del presentado es 409, no un otorgamiento silencioso.
 const otroHash=sha256("un texto que NO es el que se le presentó al paciente");
 const cuerpoOtro=UI.csGrantBody({signerName:"Ana López García",signerRole:"PATIENT",method:"ELECTRONIC_SIGNATURE",signatureArtifactRef:"doc:firma-002",witnessName:""},otroHash);
 const mismatch=await POST(csGrantR,cuerpoOtro,phys,{"if-match":"2"},PC(cs2));
 ok(mismatch.status===409,`FIRMAR_OTRO_DOCUMENTO_ES_409_${mismatch.status}`);

 // ───────── SIGNOS VITALES: la enmienda corrige de verdad ─────────
 const vId=crypto.randomUUID();
 const rec=await POST(vitR,{vitalId:vId,patientId:p,vitalType:"HR",value:"142",unit:"lpm",occurredAt:at()},phys);
 ok(rec.status===201,`SIGNO_REGISTRADO_${rec.status}`);

 // La pantalla RECHAZA una enmienda que no cambia nada: era exactamente lo que el botón hacía antes.
 const noOp=UI.vitAmendBody({value:"142",unit:"lpm",reason:"error de transcripción"},{value:"142",unit:"lpm"});
 ok(noOp===null,"LA_PANTALLA_RECHAZA_UNA_ENMIENDA_QUE_NO_CAMBIA_NADA");
 const sinMotivo=UI.vitAmendBody({value:"88",unit:"lpm",reason:"x"},{value:"142",unit:"lpm"});
 ok(sinMotivo===null,"LA_PANTALLA_EXIGE_EL_MOTIVO_DE_LA_CORRECCION");

 const amd=UI.vitAmendBody({value:"88",unit:"lpm",reason:"error de transcripción: el monitor marcaba 88"},{value:"142",unit:"lpm"});
 ok(amd!==null,"LA_PANTALLA_PRODUCE_LA_ENMIENDA");
 const PV=(id:string)=>({params:Promise.resolve({vitalId:id})});
 const amended=await POST(vitAmdR,amd,phys,{"if-match":"1"},PV(vId));
 ok(amended.status===201,`EL_SERVIDOR_ACEPTA_LA_ENMIENDA_${amended.status}:${JSON.stringify(amended.body).slice(0,180)}`);

 // Y la corrección se ve en el expediente: el valor cambió y su clasificación se recalculó (142 lpm es taquicardia; 88 no).
 const chart2=await (chartR.GET as unknown as (q:Request,c:unknown)=>Promise<Response>)(new Request("http://l/",{headers:H(phys)}),{params:Promise.resolve({patientId:p})});
 const vb=await chart2.json() as{vitals:Array<{id:string;value:string;unit:string;state:string;vstatus:string}>};
 const fv=vb.vitals.find(x=>x.id===vId);
 ok(fv?.value==="88",`EL_EXPEDIENTE_MUESTRA_EL_VALOR_CORREGIDO:${fv?.value}`);
 ok(fv?.state==="AMENDED",`EL_SIGNO_QUEDA_COMO_ENMENDADO:${fv?.state}`);
 ok(fv?.vstatus==="NORMAL",`LA_CLASIFICACION_SE_RECALCULA_CON_EL_VALOR_NUEVO:${fv?.vstatus}`);

 // El valor ORIGINAL no se borra: sigue en el flujo de eventos, que es lo que hace de esto una enmienda y no un borrado.
 const{readAggregateEvents}=await import("../../apps/web/lib/clinical-runtime");
 const rctx:HttpTenantContext={tenantId:TA,actorId:crypto.randomUUID(),actorType:"HUMAN",
  purpose:"TREATMENT",requestId:crypto.randomUUID(),sessionId:crypto.randomUUID()};
 const evs=await readAggregateEvents(rctx,vId);
 ok(evs.some(e=>String(e.payload["kind"])==="RECORDED"&&String(e.payload["value"])==="142"),"EL_VALOR_ORIGINAL_SIGUE_EN_EL_EXPEDIENTE");
 ok(evs.some(e=>String(e.payload["kind"])==="AMENDED"&&String(e.payload["value"])==="88"&&String(e.payload["reason"]).includes("transcripción")),"LA_ENMIENDA_GUARDA_SU_MOTIVO");
}catch(e){fin(e);}
fin();
