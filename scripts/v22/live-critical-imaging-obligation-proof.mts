// Auditoría 2026-09-19, anexo R02a (R02a-IMG-01) — «HALLAZGO CRÍTICO → OBLIGACIÓN» ERA UN COMENTARIO.
//
// EL HALLAZGO, literal del anexo: «ni siquiera el propio validador de modalidad DICOM se usa; el "hallazgo crítico ->
// obligación" que promete el comentario no existe en el código». Las dos mitades eran ciertas:
//
//   · `packages/imaging-order` exportaba `DICOM_MODALITIES` y `validateModality`, y NADIE los importaba:
//     `imaging-lifecycle.ts` traía solo el fold y la máquina de estados, y `modality` entraba como texto libre. «TAC»,
//     «tac», «Tomografía» y «CT» eran cuatro modalidades para el sistema y la misma para el paciente.
//   · La cabecera del fichero prometía «EXEC-0016: Imagen con hallazgo crítico -> obligación -> bloquea firma
//     encuentro» y no existía UNA línea que lo hiciera. Un resultado de laboratorio crítico creaba su obligación
//     urgente desde el primer día; un neumotórax a tensión o una hemorragia intracraneal se escribían en el informe y,
//     si nadie leía ese informe, no quedaba ningún pendiente que lo persiguiera. Un agujero de Zero-Lost-Follow-Up en
//     una vertical entera, y la clase de defecto más peligrosa de esta auditoría: una promesa que el código desmiente.
//
// LO QUE ESTA PRUEBA NO AFIRMA. La vertical de imagen sigue SIN CABLEAR a ninguna ruta HTTP: está declarada así en
// `docs/adjudication/not-wired-registry.json` y encenderla es la decisión del dueño L-10/L-11. Esta prueba ejerce los
// manejadores DIRECTAMENTE, que es la única forma honesta de medirlos hoy, y no pretende que exista un camino de usuario.
import crypto from"node:crypto";
import{libro,SIGNING_SECRET}from"./_proof.mts"; // R11-06: andamiaje compartido; aplica el prólogo de _live-env // P-07: exige TEST_DATABASE_URL (base desechable)
const SECRET=SIGNING_SECRET;
const{signSession}=await import("../../packages/session/src");
const{foldObligation}=await import("../../packages/obligation-fold/src");
const{OBLIGATION_DUE_WINDOWS}=await import("../../packages/obligation-domain/src");
const img=await import("../../apps/web/lib/imaging-lifecycle");
const{readAggregateEvents}=await import("../../apps/web/lib/clinical-runtime");
const patR=await import("../../apps/web/app/api/v1/patients/route");
import type{HttpTenantContext}from"../../packages/http-principal/src";

const TA=crypto.randomUUID();const now=Math.floor(Date.now()/1000);
const SUB=crypto.randomUUID();
const tok=(scopes=["patient:write","patient:read","imaging:write","obligation:read"],sub=SUB)=>signSession(
 {sub,tenantId:TA,roles:["PHYSICIAN"],scopes,purpose:"TREATMENT",iat:now-10,exp:now+3600,sessionId:crypto.randomUUID()},SECRET);
const H=(t:string,x:Record<string,string>={})=>({"content-type":"application/json",authorization:"Bearer "+t,...x});
const idem=()=>crypto.randomUUID();
let ts=Date.parse("2026-10-03T14:00:00.000Z");const at=()=>new Date(ts+=60000).toISOString();
const{result,ok,fin}=libro();
const req=(body:unknown,t:string,extra:Record<string,string>={})=>
 new Request("http://l/",{method:"POST",headers:H(t,{"idempotency-key":idem(),...extra}),body:JSON.stringify(body)});
const leer=async(r:Response)=>({status:r.status,body:await r.json() as Record<string,unknown>});

try{
 const phys=tok();
 const p=crypto.randomUUID();
 await patR.POST(req({patientId:p,name:"Prueba Imagen Crítica",birthDate:"1958-08-08",sexAtBirth:"MALE",occurredAt:at()},phys));

 // ───────── LA MODALIDAD YA NO ES TEXTO LIBRE ─────────
 const malaModalidad=await leer(await img.handleImagingOrderCreate(
  req({orderId:crypto.randomUUID(),patientId:p,modality:"Tomografía",bodyPart:"cráneo",occurredAt:at()},phys)));
 ok(malaModalidad.status===400,`MODALIDAD_LIBRE_ES_400_${malaModalidad.status}`);
 // El cuerpo del 400 NO enumera las modalidades válidas: `parseJson` devuelve solo el número de problemas, a propósito,
 // para no publicar la forma del esquema. Es una decisión del servidor y se mide como es, no como me gustaría: lo que
 // importa aquí es que el valor libre se RECHACE, que es lo que el anexo decía que no pasaba.
 ok(String((malaModalidad.body["error"] as Record<string,unknown>|undefined)?.["code"])==="VALIDATION_ERROR","EL_RECHAZO_ES_DE_VALIDACION");

 const ord=crypto.randomUUID();
 const alta=await leer(await img.handleImagingOrderCreate(
  req({orderId:ord,patientId:p,modality:"CT",bodyPart:"cráneo",indication:"cefalea súbita",priority:"STAT",occurredAt:at()},phys)));
 ok(alta.status===201,`ALTA_CON_MODALIDAD_DICOM_${alta.status}:${JSON.stringify(alta.body).slice(0,140)}`);

 // ───────── EL FLUJO HASTA EL INFORME ─────────
 const placed=await leer(await img.handleImagingOrderPlace(req({occurredAt:at()},phys,{"if-match":"1"}),ord));
 ok(placed.status===201,`ORDENADA_${placed.status}`);
 const acq=await leer(await img.handleImagingOrderAcquire(req({technologistId:crypto.randomUUID(),
  studyInstanceUID:"1.2.840.113619.2.55.3."+Date.now(),seriesCount:2,acquiredAt:at(),occurredAt:at()},phys,{"if-match":"2"}),ord));
 ok(acq.status===201,`ADQUIRIDA_${acq.status}`);

 // ───────── UN HALLAZGO CRÍTICO SIN DESCRIBIR SE RECHAZA ─────────
 // Marcar la casilla no es reportar: un pendiente urgente sin decir qué se vio no permite actuar.
 const sinTexto=await leer(await img.handleImagingOrderReport(req({reportText:"Estudio con hallazgos.",
  criticalFinding:true,radiologistId:crypto.randomUUID(),occurredAt:at()},phys,{"if-match":"3"}),ord));
 ok(sinTexto.status===400,`CRITICO_SIN_DESCRIBIR_ES_400_${sinTexto.status}`);

 // ───────── EL INFORME CRÍTICO CREA LA OBLIGACIÓN ─────────
 const informe=await leer(await img.handleImagingOrderReport(req({
  reportText:"TC de cráneo sin contraste: hemorragia subaracnoidea en cisternas basales.",
  findings:"Sangre en cisternas basales y valle silviano derecho.",impression:"HSA aguda, probable aneurisma de ACM derecha.",
  criticalFinding:true,criticalFindingText:"Hemorragia subaracnoidea aguda: requiere valoración neuroquirúrgica inmediata",
  radiologistId:crypto.randomUUID(),occurredAt:at()},phys,{"if-match":"3"}),ord));
 ok(informe.status===201,`INFORME_CRITICO_${informe.status}:${JSON.stringify(informe.body).slice(0,160)}`);

 const rctx:HttpTenantContext={tenantId:TA,actorId:crypto.randomUUID(),actorType:"HUMAN",
  purpose:"TREATMENT",requestId:crypto.randomUUID(),sessionId:crypto.randomUUID()};
 const oblId=img.criticalImagingObligationId(ord);
 const obl=foldObligation(await readAggregateEvents(rctx,oblId));
 ok(obl.exists,"LA_OBLIGACION_EXISTE");
 ok(obl.state==="OPEN",`LA_OBLIGACION_ESTA_ABIERTA:${obl.state}`);

 // El plazo sale del catálogo declarado, no de un número escrito en el handler.
 const w=OBLIGATION_DUE_WINDOWS["CRITICAL_IMAGING_REVIEW"];
 ok(w!==undefined&&w.priority==="URGENT"&&w.defaultHours===24,"LA_VENTANA_ESTA_DECLARADA_EN_EL_CATALOGO");

 // Y el evento dice de QUÉ estudio vino y QUÉ se vio: una obligación que no nombra su origen no se puede cerrar.
 const evs=await readAggregateEvents(rctx,oblId);
 const creado=evs.find(e=>String(e.payload["kind"])==="CREATED");
 ok(creado!==undefined,"EL_EVENTO_DE_ALTA_EXISTE");
 ok(String(creado?.payload["obligationKind"])==="CRITICAL_IMAGING_REVIEW",`EL_TIPO_ES_EL_DECLARADO:${String(creado?.payload["obligationKind"])}`);
 ok(String(creado?.payload["priority"])==="URGENT",`ES_URGENTE:${String(creado?.payload["priority"])}`);
 ok(String(creado?.payload["sourceImagingOrderId"])===ord,"NOMBRA_EL_ESTUDIO_DE_ORIGEN");
 ok(String(creado?.payload["study"])==="CT de cráneo",`NOMBRA_QUE_ESTUDIO_FUE:${String(creado?.payload["study"])}`);
 ok(String(creado?.payload["note"]).includes("subaracnoidea"),"NOMBRA_EL_HALLAZGO");
 ok(String(creado?.payload["patientId"])===p,"ES_DEL_PACIENTE_CORRECTO");
 // El plazo viene del HECHO, no del reloj: así un reintento produce la misma fecha.
 const due=Date.parse(String(creado?.payload["dueAt"]));
 ok(Number.isFinite(due)&&due>Date.parse("2026-10-03T14:00:00.000Z"),"EL_PLAZO_SE_DERIVA_DEL_HECHO");

 // ───────── IDEMPOTENCIA: un reintento del informe no crea dos pendientes ─────────
 const antes=evs.length;
 await img.handleImagingOrderReport(req({
  reportText:"TC de cráneo sin contraste: hemorragia subaracnoidea en cisternas basales.",
  criticalFinding:true,criticalFindingText:"Hemorragia subaracnoidea aguda: requiere valoración neuroquirúrgica inmediata",
  radiologistId:crypto.randomUUID(),occurredAt:at()},phys,{"if-match":"4"}),ord);
 const evs2=await readAggregateEvents(rctx,oblId);
 ok(evs2.length===antes,`UN_REINTENTO_NO_CREA_OTRO_PENDIENTE:${evs2.length}`);

 // ───────── UN INFORME NO CRÍTICO NO CREA NADA ─────────
 // Es la mitad que importa de un control: que NO se dispare cuando no debe. Un pendiente urgente por cada estudio
 // normal convertiría el panel en ruido y nadie volvería a mirarlo.
 const ord2=crypto.randomUUID();
 await img.handleImagingOrderCreate(req({orderId:ord2,patientId:p,modality:"DX",bodyPart:"tórax",occurredAt:at()},phys));
 await img.handleImagingOrderPlace(req({occurredAt:at()},phys,{"if-match":"1"}),ord2);
 await img.handleImagingOrderAcquire(req({technologistId:crypto.randomUUID(),studyInstanceUID:"1.2.3."+Date.now(),acquiredAt:at(),occurredAt:at()},phys,{"if-match":"2"}),ord2);
 const normal=await leer(await img.handleImagingOrderReport(req({reportText:"Radiografía de tórax sin alteraciones.",
  radiologistId:crypto.randomUUID(),occurredAt:at()},phys,{"if-match":"3"}),ord2));
 ok(normal.status===201,`INFORME_NORMAL_${normal.status}`);
 const sinObl=foldObligation(await readAggregateEvents(rctx,img.criticalImagingObligationId(ord2)));
 ok(!sinObl.exists,"UN_ESTUDIO_NORMAL_NO_CREA_PENDIENTE");
}catch(e){fin(e);}
fin();
