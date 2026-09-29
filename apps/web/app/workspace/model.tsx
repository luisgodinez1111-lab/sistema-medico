"use client";
// GENERADO por scripts/refactor/split-workspace.mts (K-09). Modelo del workspace: TODOS los hooks y handlers que vivían en
// el componente Workspace, en el MISMO orden (los hooks se llaman una vez por render, como antes). El contenido de las
// funciones es el original. `deriveHeader` son los valores derivados que el layout y las vistas comparten.
import {useNonce} from "../../lib/nonce-context";
import {useEffect,useState,useRef} from "react";
import {canonicalUnitOf} from "../../../../packages/lab-reference/src";
import {getStoredSession,apiRequest,apiUpload,apiDelete,apiDownload,type MedicalSession} from "../../lib/session-client";
import {assertNoForbidden} from "../../../../packages/design-system/src";
import {summarizePatient} from "../../../../packages/patient-summary/src";
import{scrollTop,REACTION_UNSPECIFIED,liveVitalCapture,submitVitals,vitalSubmitMessage,type VitalCapture,ESI_FORM_EMPTY,esiBody,type EsiForm,conForma,FORMA,composeDose,isAsk,errMsg,userMessage,CFG_SCHEDULE,CFG_MODULES,LINE,UI,P,uuid,nowIso,DX_LABEL,derivedClientUuid,medNext,blockDetails,BARRIER_LABEL,resNext,docNext,orderNext,referralNext,ASK,proximaCitaIso,apptNext,sgNext,tfNext,spNext,obNext,ghost,btn,type Encounter,type Med,type Result,type Doc,type Order,type Al,type Prob,type Ob,type Ref,type Appt,type Imm,type Vit,type Cp,type Clm,type Cs,type Adm,type Sp,type Inc,type Tr,type Wn,type Tf,type Sg,type Dz,type TL,type Gap,type PanelGap,type Snap,type RxCheck,type Ask,type Trends,type TrendKey,type IxResult,type AllergyRegistry,type ProblemRegistry,type IcdEntry,type ImmRegistry,type VitalHistory,type VitalsRegistry,type CarePlansRegistry,type ReferralsRegistry,type CarePlanSnap,type RefContext,type FollowUpSnap,type ClaimsRegistry,type DocsSnap,type DocDetail,type DocAttachment,type Credentials,type RegObSnap,type CiSnap,type ReportsSnap,type OfficeSettings,type ConsTabs,type ResultsRegistry,type AgendaAppt,type RefSt,type ApptSt,type DzSt,type WnSt,type TrSt,type IncSt,type AdmSt,type CsSt,type ClmSt,type CpSt,type VitSt,type ImmSt,type AlSt,type ProbSt,type BadgeKey,type ExpTab,EXP_TAB_KEYS,agendaWindow}from"./shared";
export function useWorkspaceModel(){

 const cspNonce=useNonce(); // S-04: los <style> propios declaran el nonce de la petición
 const[session,setSession]=useState<MedicalSession|null>(null);
 const[ready,setReady]=useState(false);
 const[patientId,setPatientId]=useState("");
 const[enc,setEnc]=useState<Encounter|null>(null);
 const[assessment,setAssessment]=useState("");
 const[plan,setPlan]=useState("");
 const[meds,setMeds]=useState<Med[]>([]);
 const[drug,setDrug]=useState("");const[doseAmt,setDoseAmt]=useState("");const[doseUnit,setDoseUnit]=useState<string>("mg");const[route,setRoute]=useState("VO");const[freq,setFreq]=useState("");
 const dose=composeDose(doseAmt,doseUnit);
 const[results,setResults]=useState<Result[]>([]);
 // Auditoría U-07/U-15: este formulario enviaba {critical} marcado a mano y SIN analito ni valor (el servidor respondía 400 siempre).
 // Ahora captura analito + valor + unidad, igual que la vista Resultados; la criticidad la deriva el servidor del valor.
 const[resQuick,setResQuick]=useState<{analyte:string;value:string;unit:string}>({analyte:"GLUCOSE",value:"",unit:canonicalUnitOf("GLUCOSE")??""});
 const[docs,setDocs]=useState<Doc[]>([]);
 const[docTitle,setDocTitle]=useState("");const[docContent,setDocContent]=useState("");const[docType,setDocType]=useState("PROGRESS_NOTE");
 const[orders,setOrders]=useState<Order[]>([]);
 const[orderType,setOrderType]=useState("LAB");const[orderDetail,setOrderDetail]=useState("");
 const[allergies,setAllergies]=useState<Al[]>([]);const[alSub,setAlSub]=useState("");const[alSev,setAlSev]=useState("MODERATE");const[alReac,setAlReac]=useState("");
 const[problems,setProblems]=useState<Prob[]>([]);const[probCode,setProbCode]=useState("");const[probDesc,setProbDesc]=useState("");
 const[obligations,setObligations]=useState<Ob[]>([]);const[obKind,setObKind]=useState("");
 const[referrals,setReferrals]=useState<Ref[]>([]);const[refSpecialty,setRefSpecialty]=useState("");const[refReason,setRefReason]=useState("");
 const[appts,setAppts]=useState<Appt[]>([]);const[apptStart,setApptStart]=useState("");const[apptReason,setApptReason]=useState("");const[apptCons,setApptCons]=useState("Consultorio 1");const[apptType,setApptType]=useState("CONSULTA_GENERAL");
 const[imms,setImms]=useState<Imm[]>([]);const[immCode,setImmCode]=useState("");const[immDose,setImmDose]=useState("1");
 const[vitals,setVitals]=useState<Vit[]>([]);const[vitType,setVitType]=useState("BP");const[vitValue,setVitValue]=useState("");const[vitUnit,setVitUnit]=useState("mmHg");
 const[plans,setPlans]=useState<Cp[]>([]);const[planCat,setPlanCat]=useState("DIABETES");const[planGoal,setPlanGoal]=useState("");
 const[claims,setClaims]=useState<Clm[]>([]);const[clmAmount,setClmAmount]=useState("");const[clmCurrency,setClmCurrency]=useState("MXN");
 const[consents,setConsents]=useState<Cs[]>([]);const[csType,setCsType]=useState("PROCEDURE");const[csRef,setCsRef]=useState("");
 const[adms,setAdms]=useState<Adm[]>([]);const[admUnit,setAdmUnit]=useState("ER");const[admReason,setAdmReason]=useState("");
 const[specs,setSpecs]=useState<Sp[]>([]);const[specType,setSpecType]=useState("BLOOD");
 const[incs,setIncs]=useState<Inc[]>([]);const[incCat,setIncCat]=useState("MEDICATION_ERROR");const[incSev,setIncSev]=useState("MODERATE");const[incDesc,setIncDesc]=useState("");
 const[triages,setTriages]=useState<Tr[]>([]);const[trComplaint,setTrComplaint]=useState("");
 // R2B-019: los discriminadores del algoritmo ESI del triage seleccionado. El nivel no se teclea: lo deriva el servidor.
 const[trEsiFor,setTrEsiFor]=useState<string|null>(null);const[trEsi,setTrEsi]=useState<EsiForm>(ESI_FORM_EMPTY);
 const[trEsiMsg,setTrEsiMsg]=useState<string|null>(null);
 const[wounds,setWounds]=useState<Wn[]>([]);const[wnLoc,setWnLoc]=useState("SACRUM");const[wnStage,setWnStage]=useState("STAGE_2");
 const[transfs,setTransfs]=useState<Tf[]>([]);const[tfProduct,setTfProduct]=useState("PRBC");const[tfUnits,setTfUnits]=useState("2");
 const[surgs,setSurgs]=useState<Sg[]>([]);const[sgProc,setSgProc]=useState("");const[sgLat,setSgLat]=useState("NA");
 const[dialz,setDialz]=useState<Dz[]>([]);const[dzMod,setDzMod]=useState("HEMODIALYSIS");const[dzAcc,setDzAcc]=useState("FISTULA");
 const[tl,setTl]=useState<TL[]|null>(null);
 const[gaps,setGaps]=useState<Gap[]|null>(null);
 const[exportInfo,setExportInfo]=useState<{aggregateCount:number;eventCount:number;contentHash:string}|null>(null);
 const[panel,setPanel]=useState<{gaps:PanelGap[];patientCount:number}|null>(null);
 const[patientName,setPatientName]=useState("");
 const[activeH2,setActiveH2]=useState(""); // scrollspy: módulo visible resaltado en el nav-rail
 const[snap,setSnap]=useState<Snap|null>(null); // snapshot de consulta (hero panel 1)
 // Estado EXPLÍCITO de la carga del expediente: un fallo de red/HTTP nunca debe verse como "sin hallazgos"
 // (auditoría 2026-09-19, U-03). "error" => la UI lo dice y ofrece reintentar; los datos quedan en null (desconocido).
 const[chartState,setChartState]=useState<"idle"|"loading"|"ready"|"error">("idle");const[chartReload,setChartReload]=useState(0);
 const[rxDrug,setRxDrug]=useState("");const[rxDoseAmt,setRxDoseAmt]=useState("");const[rxDoseUnit,setRxDoseUnit]=useState<string>("mg");const[rxRoute,setRxRoute]=useState("Oral");const[rxFreq,setRxFreq]=useState("");
 const rxDose=composeDose(rxDoseAmt,rxDoseUnit);
 const[rxCheck,setRxCheck]=useState<RxCheck|null>(null);
 // Confirmación EXPLÍCITA del médico cuando el servidor no pudo evaluar alguna barrera (428 SAFETY_ACK_REQUIRED).
 // Auditoría L-03/U-06 — FIRMA CON CONFIRMACIÓN: el médico ve el texto PERSISTIDO que se va a firmar; su huella (sha256) viaja
 // al servidor, que rechaza la firma si no coincide con lo guardado. Nada se firma con un solo clic ni "a ciegas" desde una lista.
 const[signAsk,setSignAsk]=useState<{kind:"encounter";title:string;text:string;hash:string}|{kind:"document";doc:Doc;title:string;text:string;hash:string}|null>(null);
 const[signBusy,setSignBusy]=useState(false);const[signErr,setSignErr]=useState("");
 // Enmienda de un documento firmado: el texto lo escribe el médico (antes se enviaba el literal "Addendum clínico").
 const[amendAsk,setAmendAsk]=useState<Doc|null>(null);const[amendText,setAmendText]=useState("");
 // U-16: diálogo genérico de motivo/evidencia. `resolveAsks` recorre el cuerpo, pide cada marcador ASK y devuelve el cuerpo
 // con el texto del médico, o null si canceló (entonces NO se envía nada).
 const[reasonAsk,setReasonAsk]=useState<{spec:Ask;resolve:(v:string|null)=>void}|null>(null);const[reasonText,setReasonText]=useState("");
 const askReason=(spec:Ask)=>new Promise<string|null>(resolve=>{setReasonText("");setReasonAsk({spec,resolve});});
 const resolveAsks=async(body:Record<string,unknown>):Promise<Record<string,unknown>|null>=>{
  const out:Record<string,unknown>={...body};
  for(const[k,v]of Object.entries(body)){
   if(isAsk(v)){const text=await askReason(v);if(text===null)return null;out[k]=text;}
   // D11c: también los ASK dentro de un arreglo (p. ej. los `codes` de una factura), en orden; cancelar uno no envía nada.
   else if(Array.isArray(v)&&v.some(isAsk)){const arr:unknown[]=[];for(const x of v){if(isAsk(x)){const text=await askReason(x);if(text===null)return null;arr.push(text);}else arr.push(x);}out[k]=arr;}
  }
  return out;
 };
 // U-16 / D11c-F1: TODA acción genérica de las tablas de ciclo de vida resuelve sus ASK antes de enviar (motivos, lote, sitio,
 // firmante, códigos, estadio…); si el médico cancela no se envía nada. Antes las do*Action mandaban el marcador ASK tal cual y el
 // servidor respondía 400. Devuelve también el cuerpo RESUELTO, que es el que debe leerse para actualizar la pantalla.
 const postAction=async(act:Readonly<{path:string;body:Record<string,unknown>}>,version:number)=>{
  const body=await resolveAsks(act.body);if(!body)return null;
  return{r:await apiRequest(act.path,{method:"POST",body,ifMatch:version}),body};
 };
 // Auditoría L-10/L-11: las verticales hospitalarias solo se pintan si el SERVIDOR las declara encendidas
 // (GET /api/v1/features). Por defecto, y ante cualquier fallo, APAGADAS.
 const[hospitalOn,setHospitalOn]=useState(false);
 const[ackMed,setAckMed]=useState<{med:Med;message:string;override?:{barriers:string[];justification:string}}|null>(null);const[ackWhy,setAckWhy]=useState("");
 // U-19: anulación justificada de un bloqueo anulable (el servidor dice cuáles); los duros no tienen diálogo: se corrige la orden.
// Auditoría 2026-09-19, anexo R05a (R05a-F07) — CONFIRMACIÓN DE ACCIONES IRREVERSIBLES.
//
// Anular una factura y revocar un consentimiento se disparaban con UN clic, directo en el `onClick`. No son acciones
// reversibles ni corregibles «editando»: el registro es de solo-añadir, así que lo que quedaría sería un evento de
// anulación encima, con la factura ya anulada y el consentimiento ya revocado. Revocar un consentimiento por error, además,
// retira la base legal para tratar los datos de ese paciente hasta que él vuelva a otorgarlo.
//
// El patrón NO se inventa: es el mismo que ya usa la anulación de una barrera de prescripción (`overrideMed` -> panel con
// justificación -> `confirmOverrideMed`), porque ahí la auditoría ya exigió nombrar la barrera y justificar. Aquí se pide
// confirmación explícita; la justificación la exige el servidor donde corresponde (la anulación de factura ya la pide).
const TRANSICIONES_IRREVERSIBLES:ReadonlySet<string>=new Set(["VOIDED","REVOKED","DECLINED","REJECTED"]);
 const[overrideMed,setOverrideMed]=useState<{med:Med;message:string;barriers:string[]}|null>(null);
 // Acción irreversible pendiente de confirmación: qué se va a hacer, sobre qué, y la función que lo ejecuta.
 const[pendingIrreversible,setPendingIrreversible]=useState<{what:string;detail:string;run:()=>void}|null>(null);const[overrideWhy,setOverrideWhy]=useState("");const[rxMsg,setRxMsg]=useState("");
 const[trends,setTrends]=useState<Trends|null>(null);const[trendKey,setTrendKey]=useState<TrendKey>("HBA1C");
 const[followTab,setFollowTab]=useState<"pend"|"prog"|"done"|"all">("pend");
 const[topSearch,setTopSearch]=useState("");
 const[sideCollapsed,setSideCollapsed]=useState(false);
 const[docMenu,setDocMenu]=useState(false);
 const[view,setView]=useState<"inicio"|"pacientes"|"consulta"|"agenda"|"resultados"|"medicamentos"|"ordenes"|"alergias"|"problemas"|"vacunas"|"signos"|"planCuidado"|"interconsulta"|"seguimiento"|"facturacion"|"documentos"|"obligaciones"|"clinicalIntel"|"reportes"|"biblioteca"|"configuracion"|"exp">("inicio"); // vistas de nivel-sistema + exp(expediente crudo)
 // Patient 360 (Lote B): sub-vista activa dentro del expediente (?s= en la URL cuando view==="exp").
 const[expTab,setExpTab]=useState<ExpTab>("resumen");
 const[medTab,setMedTab]=useState<"catalogo"|"plantillas"|"rapidas"|"interacciones"|"alertas"|"reportes">("catalogo");
 const[medQuery,setMedQuery]=useState("");        // búsqueda en el catálogo de fármacos
 const[medCat,setMedCat]=useState("");            // filtro por categoría terapéutica ("":todas)
 const[medOnlyMon,setMedOnlyMon]=useState(false); // solo con monitoreo obligado
 const[medOnlyRenal,setMedOnlyRenal]=useState(false); // solo con alerta renal
 const[medSel,setMedSel]=useState<string|null>(null); // principio activo seleccionado (detalle)
 // Pestaña Interacciones (S8.3) — verificador de conjunto cableado a POST /api/v1/interactions
 // Auditoría R05a (WS1-15c): arrancaba con ["Sertralina","Ibuprofeno","Metformina"] — tres fármacos de EJEMPLO sin nada que
 // dijera que lo eran, dentro de un verificador de interacciones. Se lee como la medicación de alguien: o el médico cree que
 // son del paciente, o pulsa «Verificar» y recibe un veredicto real sobre un conjunto inventado. Arranca VACÍO.
 const[ixDrugs,setIxDrugs]=useState<string[]>([]);
 const[ixFactors,setIxFactors]=useState<string[]>([]);
 const[ixInput,setIxInput]=useState("");
 const[ixRes,setIxRes]=useState<IxResult|null>(null);
 const[ixBusy,setIxBusy]=useState(false);
 // Auditoría R05a (WS1-12): el verificador de interacciones fallaba EN SILENCIO —sin mensaje y sin `catch`, así que un fallo
 // de red era además un rechazo sin atender—. El médico pulsaba «Verificar», el indicador se apagaba y no pasaba nada: en un
 // verificador de interacciones, no pasar nada se lee como «no hay interacciones».
 const[ixMsg,setIxMsg]=useState<string|null>(null);
 // Vista Alergias (S-ALERGIAS) — registro clínica-wide cableado a GET /api/v1/allergies
 const[alergReg,setAlergReg]=useState<AllergyRegistry|null>(null);
 const[alergSel,setAlergSel]=useState(0);
 const[alergOnlyActive,setAlergOnlyActive]=useState(true);const[alergOnlySevere,setAlergOnlySevere]=useState(false);
 const[alergSearch,setAlergSearch]=useState("");const[alergType,setAlergType]=useState("Todos");
 const[algNew,setAlgNew]=useState(false);const[algBusy,setAlgBusy]=useState(false);const[algMsg,setAlgMsg]=useState<string|null>(null);
 const[algForm,setAlgForm]=useState<{patientId:string;substance:string;severity:string;reaction:string}>({patientId:"",substance:"",severity:"MODERATE",reaction:""});
 // Vista Problemas (S-PROBLEMAS) — lista clínica-wide cableada a GET /api/v1/problems + form + plantillas
 const[probScreen,setProbScreen]=useState<"lista"|"nuevo"|"plantillas">("lista");
 const[probReg,setProbReg]=useState<ProblemRegistry|null>(null);
 const[probSel,setProbSel]=useState(0);
 const[probSearch,setProbSearch]=useState("");const[probStatusF,setProbStatusF]=useState("Todos");
 const[probPlantCat,setProbPlantCat]=useState("Todas las plantillas");
 // Form "Nuevo problema"
 const[pfName,setPfName]=useState("");const[pfCode,setPfCode]=useState("");
 const[pfType,setPfType]=useState<"Agudo"|"Crónico"|"Recurrente">("Agudo");
 const[pfEstado,setPfEstado]=useState("Activo");const[pfDesc,setPfDesc]=useState("");
 const[pfSev,setPfSev]=useState("Leve");const[pfNotes,setPfNotes]=useState("");const[pfOnset,setPfOnset]=useState(()=>new Date().toISOString().slice(0,10));
 const[pfResults,setPfResults]=useState<IcdEntry[]>([]);const[pfBusy,setPfBusy]=useState(false);const[pfMsg,setPfMsg]=useState("");
 // R05b-17: el fallo del catálogo CIE-10 se dice; antes era indistinguible de «sin resultados».
 const[pfSearchErr,setPfSearchErr]=useState<string|null>(null);
 // Vista Vacunas (S-VACUNAS) — registro clínica-wide cableado a GET /api/v1/immunizations
 const[immReg,setImmReg]=useState<ImmRegistry|null>(null);const[immSel,setImmSel]=useState(0);
 const[vacNew,setVacNew]=useState(false);const[vacBusy,setVacBusy]=useState(false);const[vacMsg,setVacMsg]=useState<string|null>(null);
 const[vacForm,setVacForm]=useState<{patientId:string;vaccineCode:string;dose:string;lot:string;site:string}>({patientId:"",vaccineCode:"",dose:"1/1",lot:"",site:"Brazo izquierdo"});
 const[immSearch,setImmSearch]=useState("");const[immStatusF,setImmStatusF]=useState("Todos");
 // Vista Signos vitales (S-SIGNOS) — historial por paciente cableado a GET /patients/:id/vitals + form -> POST /vitals
 const[vitHist,setVitHist]=useState<VitalHistory|null>(null);
 // Lote E — registro POBLACIONAL de signos vitales (vista Signos vitales › «Toda la clínica»).
 const[vitReg,setVitReg]=useState<VitalsRegistry|null>(null);const[vitRegErr,setVitRegErr]=useState(false);
 const[svTemp,setSvTemp]=useState("");const[svFc,setSvFc]=useState("");const[svFr,setSvFr]=useState("");
 const[svBpS,setSvBpS]=useState("");const[svBpD,setSvBpD]=useState("");const[svSpo2,setSvSpo2]=useState("");
 const[svPeso,setSvPeso]=useState("");const[svTalla,setSvTalla]=useState("");const[svPab,setSvPab]=useState("");
 const[svPain,setSvPain]=useState("0");const[svEstado,setSvEstado]=useState("Bueno");const[svObs,setSvObs]=useState("");
 const[svBusy,setSvBusy]=useState(false);const[svMsg,setSvMsg]=useState("");
 // Vista Plan de cuidado (S-PLANCUIDADO) — snapshot compuesto cableado a GET /patients/:id/care-plan
 const[cpSnap,setCpSnap]=useState<CarePlanSnap|null>(null);
 // Lote E — registro POBLACIONAL de planes de cuidado (vista Plan de cuidado › «Toda la clínica»).
 const[cpReg,setCpReg]=useState<CarePlansRegistry|null>(null);const[cpRegErr,setCpRegErr]=useState(false);
 const[cpPlanTab,setCpPlanTab]=useState<"plan"|"historial"|"objetivos"|"educacion"|"notas">("plan");
 const[cpNew,setCpNew]=useState(false);const[cpBusy,setCpBusy]=useState(false);const[cpMsg,setCpMsg]=useState<string|null>(null);
 const[cpForm,setCpForm]=useState<{category:string;goal:string}>({category:"DIABETES",goal:""});
 // Vista Interconsultas (S-INTERCONSULTA) — form Nueva interconsulta; panel derecho cableado a referral-context, envío -> POST /referrals
 const[refCtx,setRefCtx]=useState<RefContext|null>(null);
 const[icPatientId,setIcPatientId]=useState(""); // paciente elegido para la interconsulta
 const[icTab,setIcTab]=useState<"datos"|"resumen"|"documentos"|"indicaciones">("datos");
 const[icSpecialty,setIcSpecialty]=useState("Endocrinología");const[icPriority,setIcPriority]=useState("Preferente (2–4 semanas)");const[icType,setIcType]=useState("Primera vez");
 const[icMotivo,setIcMotivo]=useState("");const[icResumen,setIcResumen]=useState("");
 // Lote G — destinatario (médico/institución del directorio) + registro POBLACIONAL de interconsultas.
 const[icRecipient,setIcRecipient]=useState("");
 const[icReg,setIcReg]=useState<ReferralsRegistry|null>(null);const[icRegErr,setIcRegErr]=useState(false);
 const[icBusy,setIcBusy]=useState(false);const[icMsg,setIcMsg]=useState("");
 // Vista Seguimiento (S-SEGUIMIENTO) — snapshot compuesto cableado a GET /patients/:id/follow-up
 const[fuSnap,setFuSnap]=useState<FollowUpSnap|null>(null);
 const[segTab,setSegTab]=useState<"seguimiento"|"evolucion"|"graficas"|"metas"|"recordatorios"|"alertas">("seguimiento");
 // Vista Facturación (S-FACTURACION) — registro clínica-wide cableado a GET /api/v1/claims; emisión -> POST /claims
 const[claimsReg,setClaimsReg]=useState<ClaimsRegistry|null>(null);
 const[facTab,setFacTab]=useState<"facturas"|"recibos"|"notas"|"cotizaciones">("facturas");
 const[nfConcepts,setNfConcepts]=useState<{desc:string;qty:number;price:number}[]>([{desc:"Consulta médica",qty:1,price:500},{desc:"Aplicación de vacuna",qty:1,price:350}]);
 const[nfPatientId,setNfPatientId]=useState(""); // paciente elegido para la factura (Facturación)
 const[nfBusy,setNfBusy]=useState(false);const[nfMsg,setNfMsg]=useState("");
 // Vista Documentos (S-DOCUMENTOS) — lista por paciente cableada a GET /patients/:id/documents
 const[docsSnap,setDocsSnap]=useState<DocsSnap|null>(null);
 const[docDetail,setDocDetail]=useState<DocDetail|null>(null);const[docDetBusy,setDocDetBusy]=useState(false);
 const loadDoc=async(id:string)=>{setDocDetBusy(true);setDocDetail(null);try{const r=await apiRequest(`/api/v1/documents/${id}`,{method:"GET"});if(r.status===200)setDocDetail(r.body as unknown as DocDetail);}catch{/* documento no disponible */}finally{setDocDetBusy(false);}};
 // Adjuntos binarios (PHI) en Vercel Blob privado: subir (multipart), ver (descarga por la Function) y quitar.
 const attInputRef=useRef<HTMLInputElement|null>(null);
 const[attBusy,setAttBusy]=useState(false);const[attMsg,setAttMsg]=useState<string|null>(null);
 const ATT_MAX=25*1024*1024;const ATT_MIME=["application/pdf","image/png","image/jpeg","image/webp","image/gif","image/tiff"];
 const onPickAttachment=async(file:File|undefined)=>{
  if(!file||!docDetail)return;
  if(!ATT_MIME.includes(file.type)){setAttMsg("Tipo no permitido. Se aceptan PDF e imágenes (PNG, JPG, WEBP, GIF, TIFF).");return;}
  if(file.size>ATT_MAX){setAttMsg("Archivo demasiado grande (máx. 25 MB).");return;}
  setAttBusy(true);setAttMsg(null);
  try{const fd=new FormData();fd.append("file",file);
   const r=await apiUpload(`/api/v1/documents/${docDetail.documentId}/attachments`,fd);
   if(r.status===200||r.status===201){setAttMsg("Archivo adjuntado ✓");await loadDoc(docDetail.documentId);}
   else setAttMsg((r.body as{error?:{message?:string}})?.error?.message??`No se pudo adjuntar (estado ${r.status}).`);
  }catch{setAttMsg("Error al adjuntar el archivo.");}finally{setAttBusy(false);}
 };
 const viewAttachment=async(a:DocAttachment)=>{
  if(!docDetail)return;setAttMsg(null);
  try{const blob=await apiDownload(`/api/v1/documents/${docDetail.documentId}/attachments/${a.attachmentId}`);
   if(!blob){setAttMsg("No se pudo abrir el archivo.");return;}
   const url=URL.createObjectURL(blob);window.open(url,"_blank","noopener");setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch{setAttMsg("Error al abrir el archivo.");}
 };
 const removeAttachment=async(a:DocAttachment)=>{
  if(!docDetail)return;setAttBusy(true);setAttMsg(null);
  try{const r=await apiDelete(`/api/v1/documents/${docDetail.documentId}/attachments/${a.attachmentId}`);
   if(r.status===200){setAttMsg("Adjunto eliminado ✓");await loadDoc(docDetail.documentId);}
   else setAttMsg(`No se pudo eliminar (estado ${r.status}).`);
  }catch{setAttMsg("Error al eliminar el adjunto.");}finally{setAttBusy(false);}
 };
 const fmtBytes=(n:number)=>n<1024?`${n} B`:n<1048576?`${(n/1024).toFixed(0)} KB`:`${(n/1048576).toFixed(1)} MB`;
 // Perfil del médico: firma y sello (imágenes) en Vercel Blob privado, ligadas al médico (no al consultorio).
 const sigInputRef=useRef<HTMLInputElement|null>(null);const stampInputRef=useRef<HTMLInputElement|null>(null);
 const[profHas,setProfHas]=useState<{signature:boolean;stamp:boolean}>({signature:false,stamp:false});
 const CRED_EMPTY:Credentials={fullName:"",cedulaProfesional:"",institution:"",specialty:"",cedulaEspecialidad:""};
 const[credSaved,setCredSaved]=useState<Credentials|null>(null);const[credForm,setCredForm]=useState<Credentials>(CRED_EMPTY);const[credMsg,setCredMsg]=useState<string|null>(null);const[credBusy,setCredBusy]=useState(false);
 const credValid=credForm.fullName.trim().length>=3&&/^\d{7,8}$/.test(credForm.cedulaProfesional.trim())&&credForm.institution.trim().length>=2&&(credForm.cedulaEspecialidad.trim()===""||/^\d{7,8}$/.test(credForm.cedulaEspecialidad.trim()));
 const saveCredentials=async()=>{
  if(!credValid)return;setCredBusy(true);setCredMsg(null);
  try{
   const body:Record<string,string>={fullName:credForm.fullName.trim(),cedulaProfesional:credForm.cedulaProfesional.trim(),institution:credForm.institution.trim()};
   if(credForm.specialty.trim())body["specialty"]=credForm.specialty.trim();if(credForm.cedulaEspecialidad.trim())body["cedulaEspecialidad"]=credForm.cedulaEspecialidad.trim();
   const r=await apiRequest("/api/v1/physician-profile/credentials",{method:"POST",body});
   if(r.status===200||r.status===201){setCredMsg("Identidad profesional guardada ✓");await loadProfile();}
   else setCredMsg(errMsg(r));
  }catch(e){setCredMsg(userMessage(e));}finally{setCredBusy(false);}
 };
 const[profUrls,setProfUrls]=useState<{signature:string|null;stamp:string|null}>({signature:null,stamp:null});
 const[profBusy,setProfBusy]=useState(false);const[profMsg,setProfMsg]=useState<string|null>(null);
 const PROF_MIME=["image/png","image/jpeg","image/webp"];
 const loadProfile=async()=>{
  try{const r=await apiRequest("/api/v1/physician-profile",{method:"GET"});
   if(r.status!==200)return;
   const b=r.body as{signature:unknown;stamp:unknown;credentials?:Partial<Credentials>|null};
   const has={signature:b.signature!==null&&b.signature!==undefined,stamp:b.stamp!==null&&b.stamp!==undefined};
   setProfHas(has);
   const c=b.credentials?{...CRED_EMPTY,...Object.fromEntries(Object.entries(b.credentials).filter(([,v])=>typeof v==="string"))} as Credentials:null;
   setCredSaved(c);setCredForm(c??CRED_EMPTY);
   for(const k of["signature","stamp"] as const){
    if(has[k]){const blob=await apiDownload(`/api/v1/physician-profile/assets/${k}`);if(blob){const url=URL.createObjectURL(blob);setProfUrls(u=>{if(u[k])URL.revokeObjectURL(u[k]!);return{...u,[k]:url};});}}
    else setProfUrls(u=>{if(u[k])URL.revokeObjectURL(u[k]!);return{...u,[k]:null};});
   }
  }catch{/* perfil no disponible */}
 };
 const uploadProfileAsset=async(kind:"signature"|"stamp",file:File|undefined)=>{
  if(!file)return;
  if(!PROF_MIME.includes(file.type)){setProfMsg("Usa una imagen PNG, JPG o WEBP.");return;}
  if(file.size>5*1024*1024){setProfMsg("Imagen demasiado grande (máx. 5 MB).");return;}
  setProfBusy(true);setProfMsg(null);
  try{const fd=new FormData();fd.append("file",file);
   const r=await apiUpload(`/api/v1/physician-profile/assets/${kind}`,fd);
   if(r.status===200||r.status===201){setProfMsg(kind==="signature"?"Firma guardada ✓":"Sello guardado ✓");await loadProfile();}
   else setProfMsg((r.body as{error?:{message?:string}})?.error?.message??`No se pudo subir (estado ${r.status}).`);
  }catch{setProfMsg("Error al subir la imagen.");}finally{setProfBusy(false);}
 };
 const removeProfileAsset=async(kind:"signature"|"stamp")=>{
  setProfBusy(true);setProfMsg(null);
  try{const r=await apiDelete(`/api/v1/physician-profile/assets/${kind}`);
   if(r.status===200){setProfMsg(kind==="signature"?"Firma eliminada ✓":"Sello eliminado ✓");await loadProfile();}
   else setProfMsg(`No se pudo eliminar (estado ${r.status}).`);
  }catch{setProfMsg("Error al eliminar.");}finally{setProfBusy(false);}
 };
 const[docsTab,setDocsTab]=useState<"todos"|"clinicos"|"administrativos"|"consentimientos"|"estudios"|"recetas"|"notas"|"otros">("todos");
 const[docSel,setDocSel]=useState(0);const[docFolder,setDocFolder]=useState("Todos los documentos");const[docMsg,setDocMsg]=useState("");
 const[docNew,setDocNew]=useState(false);const[docBusy,setDocBusy]=useState(false);
 const[docForm,setDocForm]=useState<{docType:string;title:string;content:string}>({docType:"PROGRESS_NOTE",title:"",content:""});
 // Vista Obligaciones (S-OBLIGACIONES) — obligaciones regulatorias del consultorio cableadas a GET /regulatory-obligations
 const[regObSnap,setRegObSnap]=useState<RegObSnap|null>(null);
 const[oblNew,setOblNew]=useState(false);const[oblBusy,setOblBusy]=useState(false);const[oblMsg,setOblMsg]=useState<string|null>(null);
 const[oblForm,setOblForm]=useState<{name:string;category:string;periodicity:string;dueDate:string}>({name:"",category:"Fiscal (SAT)",periodicity:"Mensual",dueDate:""});
 const[oblTab,setOblTab]=useState<"todas"|"fiscales"|"salud"|"laborales"|"proteccion"|"administrativas"|"otros">("todas");
 // Vista Clinical Intelligence (S-CLINICALINTEL) — alertas y calculadoras DETERMINISTAS (R6 IA generativa en pausa)
 const[ciSnap,setCiSnap]=useState<CiSnap|null>(null);
 const[ciTab,setCiTab]=useState<"asistente"|"diferencial"|"guias"|"interacciones"|"calculadoras"|"alertas"|"educacion">("asistente");
 // Vista Reportes (S-REPORTES) — tablero analítico; KPIs de pacientes/ingresos y diagnósticos cableados a GET /reports
 const[repSnap,setRepSnap]=useState<ReportsSnap|null>(null);
 const[repErr,setRepErr]=useState(false); // MEDIC-OS lote-a: el tablero de Reportes muestra error+reintento si falla, no "Cargando…" perpetuo.
 const reloadReports=async()=>{try{const r=await apiRequest("/api/v1/reports",{method:"GET"});if(r.status===200){setRepSnap(r.body as unknown as ReportsSnap);setRepErr(false);}else setRepErr(true);}catch{setRepErr(true);}};
 const[repTab,setRepTab]=useState("Resumen");
 // Vista Biblioteca Clínica (S-BIBLIOTECA) — repositorio de conocimiento curado (presentacional); herramientas reales enlazadas
 const[bibTab,setBibTab]=useState("Todo");const[bibEsp,setBibEsp]=useState("Medicina general");
 // Vista Configuración (S-CONFIG) — ajustes/preferencias del consultorio (presentacional)
 const[cfgTab,setCfgTab]=useState("General");
 // Ajustes del consultorio cableados a /api/v1/office-settings (persistidos, concurrencia optimista If-Match).
 const CFG_DEFAULTS:OfficeSettings={officeName:"",specialty:"",rfc:"",cedula:"",address:"",phone:"",email:"",timezone:"",language:"es",color:P.purpleOnPale,theme:"Claro",fontSize:"Normal",realtimeAlerts:true,followupReminders:true,showInteractions:true,darkMode:false,schedule:CFG_SCHEDULE,modules:Object.fromEntries(CFG_MODULES.map(k=>[k,true])),prefRecordView:"Resumen clínico",prefNoteTemplate:"Consulta general (SOAP)",prefUnits:"Métrico (kg, cm)",prefDoseCalc:"Pediátrica y adultos",regCountry:"México",regState:"",regCity:"",regPostalCode:"",regDateFormat:"dd/mm/aaaa",regTimeFormat:"24 horas",regCurrency:"MXN",regTaxRate:"16"};
 const[cfgSettings,setCfgSettings]=useState<OfficeSettings>(CFG_DEFAULTS);
 const[cfgVer,setCfgVer]=useState(0);const[cfgLoaded,setCfgLoaded]=useState(false);const[cfgBusy,setCfgBusy]=useState(false);const[cfgMsg,setCfgMsg]=useState<string|null>(null);
 const setCfg=<K extends keyof OfficeSettings>(k:K,v:OfficeSettings[K])=>{setCfgSettings(s=>({...s,[k]:v}));setCfgMsg(null);};
 const saveOfficeSettings=async()=>{
  setCfgBusy(true);setCfgMsg(null);
  try{const r=await apiRequest("/api/v1/office-settings",{method:"PUT",body:{settings:cfgSettings,occurredAt:new Date().toISOString()},ifMatch:cfgVer});
   if(r.status===200||r.status===201){const b=r.body as{settings:OfficeSettings;version:number};setCfgSettings(b.settings);setCfgVer(b.version);setCfgMsg("Cambios guardados ✓");}
   else if(r.status===409){setCfgMsg("La configuración cambió en otra sesión; se recargó. Revisa y vuelve a guardar.");const g=await apiRequest("/api/v1/office-settings",{method:"GET"});if(g.status===200){const b=g.body as{settings:OfficeSettings;version:number};setCfgSettings(b.settings);setCfgVer(b.version);}}
   else setCfgMsg("No se pudo guardar (estado "+r.status+").");
  }catch{setCfgMsg("Error al guardar la configuración.");}finally{setCfgBusy(false);}
 };
 const[ordTab,setOrdTab]=useState<"todas"|"laboratorio"|"imagenologia"|"interconsultas"|"procedimientos"|"otros">("todas");
 const[selRow,setSelRow]=useState(0); // fila seleccionada en la lista de pacientes (panel de detalle)
 const[cTab,setCTab]=useState<"actual"|"resultados"|"ordenes"|"medicamentos"|"plan"|"documentos"|"seguimiento">("actual");
 const[consultaPid,setConsultaPid]=useState<string|null>(null); // paciente de la consulta abierta (null = panel de consultas)
 const[consultaNewPid,setConsultaNewPid]=useState(""); // selector "iniciar nueva consulta" en el panel
 // Abre el workspace de la consulta de un paciente (desde el panel, agenda, pacientes, etc.).
 const openConsulta=(pid:string,name:string,tab:typeof cTab="actual")=>{selectPatientRaw(pid,name);setConsultaPid(pid);setCTab(tab);setView("consulta");scrollTop();};
 const[consTabs,setConsTabs]=useState<ConsTabs|null>(null); // pestañas por paciente de Consulta (cableado)
 const[resTab,setResTab]=useState<"resultados"|"solicitudes"|"seguimiento"|"referencia"|"alertas">("resultados");
 const[resReg,setResReg]=useState<ResultsRegistry|null>(null); // registro de resultados clínica-wide (cableado)
 const[resNew,setResNew]=useState(false);const[resBusy2,setResBusy2]=useState(false);const[resMsg2,setResMsg2]=useState<string|null>(null);
 // U-07: la UNIDAD es obligatoria al capturar un resultado (de ella dependen rangos, críticos y todas las calculadoras).
 const[resForm,setResForm]=useState<{patientId:string;analyte:string;value:string;unit:string}>({patientId:"",analyte:"GLUCOSE",value:"",unit:canonicalUnitOf("GLUCOSE")??""});
 const[resSel,setResSel]=useState<string|null>(null); // resultId seleccionado en el navegador de resultados
 const[resQ,setResQ]=useState("");const[resTypeF,setResTypeF]=useState("Todos");const[resEstadoF,setResEstadoF]=useState("Todos"); // filtros reales del navegador
 const[ordReg,setOrdReg]=useState<{items:{orderId:string;patientId:string;patientName:string;orderType:string;typeLabel:string;detail:string;status:string;createdAt:string;version:number}[];total:number;solicitadas:number;enviadas:number;completadas:number}|null>(null);
 const[ordSel,setOrdSel]=useState<string|null>(null); // orderId seleccionado (panel de detalle) de la vista Órdenes
 const[ordBusy,setOrdBusy]=useState(false); // transición de orden en curso
 const[ordMsg,setOrdMsg]=useState<string|null>(null); // aviso tras una acción (creada/enviada/completada/cancelada)
 const[ordNew,setOrdNew]=useState(false); // panel "Nueva orden" abierto
 const[ordForm,setOrdForm]=useState<{patientId:string;orderType:string;detail:string}>({patientId:"",orderType:"LAB",detail:""});
 const[ordQuery,setOrdQuery]=useState(""); // búsqueda por paciente/estudio en la vista Órdenes
 const[ordStatus,setOrdStatus]=useState(""); // filtro por estado ("":todos)
 const[cForm,setCForm]=useState({motivo:"",historia:"",antec:"",interrog:"",explor:"",plan:""}); // borrador de la consulta actual
 const[cPreview,setCPreview]=useState(false); // vista previa de la nota compuesta (Consulta)
 const[cMsg,setCMsg]=useState<string|null>(null); // aviso del flujo de encuentro (Consulta)
 const[cVit,setCVit]=useState({ta:"",fc:"",fr:"",temp:"",spo2:""}); // signos vitales de la Consulta
 // U-09 / D11a: captura de signos vitales en curso (id, hora y lo ya guardado, estables entre reintentos) de Consulta y de Signos.
 const cVitSubmission=useRef<VitalCapture|null>(null);const svCapture=useRef<VitalCapture|null>(null);
 // D11b (revisión F4): paciente seleccionado AHORA (lo fija solo selectPatientRaw). La respuesta de una MUTACIÓN que llega después
 // de cambiar de paciente se compara con él y se descarta (una mutación no se aborta: R05a-F06; las lecturas usan AbortController).
 const selectedPatient=useRef<string>("");const isSelectedPatient=(id:string)=>selectedPatient.current===id;
 const cOrdSubmission=useRef<string|null>(null); // R05a/WS1-11: id del lote de órdenes en curso (estable entre reintentos)
 const draftOwner=useRef<string>(""); // U-17: paciente al que pertenece el borrador de consulta
 const dataOwner=useRef<string>("");  // U-17: paciente al que pertenecen tl/gaps/snap/trends cargados
 const[cVitMsg,setCVitMsg]=useState<string|null>(null);const[cVitBusy,setCVitBusy]=useState(false);
 const[cOrdCat,setCOrdCat]=useState<"LAB"|"IMAGING"|"PROCEDURE"|"REFERRAL">("LAB"); // categoría de órdenes de la Consulta
 const[cOrdSel,setCOrdSel]=useState<string[]>([]);const[cOrdMsg,setCOrdMsg]=useState<string|null>(null);const[cOrdBusy,setCOrdBusy]=useState(false);
 const[cDxQuery,setCDxQuery]=useState("");const[cDxMsg,setCDxMsg]=useState<string|null>(null);const[cDxBusy,setCDxBusy]=useState(false); // buscador CIE-10 de la Consulta
 const[cAntec,setCAntec]=useState<string[]>([]);
 const[agenda,setAgenda]=useState<{appointments:AgendaAppt[];counts:{programadas:number;atendidas:number;enEspera:number;canceladas:number}}|null>(null);
 const[agendaErr,setAgendaErr]=useState(false); // MEDIC-OS lote-a: la agenda ya no queda en "Cargando…" si falla; muestra error+reintento.
 const[agendaDate,setAgendaDate]=useState<string>(new Date().toISOString().slice(0,10)); // fecha de la agenda (YYYY-MM-DD)
 const[agendaView,setAgendaView]=useState<"dia"|"semana"|"mes"|"lista">("dia"); // vista de la agenda (día / semana / mes / lista)
 const[apptSel,setApptSel]=useState<string|null>(null);          // cita seleccionada (panel de detalle)
 const[apptBusy,setApptBusy]=useState(false);                     // transición de cita en curso
 const[apptMsg,setApptMsg]=useState<string|null>(null);           // aviso tras una acción de la agenda
 const[apptNew,setApptNew]=useState(false);                       // panel "Nueva cita" abierto
 const[apptForm,setApptForm]=useState<{patientId:string;time:string;reason:string;consultorio:string;apptType:string}>({patientId:"",time:"09:00",reason:"",consultorio:"Consultorio 1",apptType:"CONSULTA_GENERAL"});
 const[clock,setClock]=useState<Date>(()=>new Date());
 const[topMenu,setTopMenu]=useState(false);
 const[patientList,setPatientList]=useState<{patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string;version?:number}[]|null>(null);
 // Auditoría S-08: el listado de pacientes viene PAGINADO del servidor (200 por página) y se busca en el servidor (?q=).
 const[patientQuery,setPatientQuery]=useState("");const[patientTotal,setPatientTotal]=useState<number|null>(null);const[patientMore,setPatientMore]=useState(false);
 // U-12: selector de paciente REUTILIZABLE en toda barra de paciente (antes solo existía en Signos vitales; en Plan, Documentos,
 // Seguimiento e Interconsulta no había forma de elegir paciente y el flujo dependía de un UUID aleatorio inicial).
 const patientSelector=<select aria-label="Paciente en contexto" value={(patientList??[]).some(p=>p.patientId===patientId)?patientId:""} onChange={e=>{const pp=(patientList??[]).find(x=>x.patientId===e.target.value);if(pp)selectPatientRaw(pp.patientId,pp.name);}} style={{border:`1px solid ${LINE}`,borderRadius:8,padding:"7px 10px",fontSize:15,fontWeight:700,fontFamily:UI,color:P.ink,background:P.white,maxWidth:320}}><option value="">Selecciona un paciente…</option>{(patientList??[]).map(p=><option key={p.patientId} value={p.patientId}>{p.name}</option>)}</select>;
 const[regName,setRegName]=useState("");const[regDob,setRegDob]=useState("");const[regSex,setRegSex]=useState("UNKNOWN");
 const[patStatus,setPatStatus]=useState("");const[patSex,setPatSex]=useState(""); // filtros de la vista Pacientes ("":todos)
 const[patNew,setPatNew]=useState(false);const[patMsg,setPatMsg]=useState<string|null>(null); // creador inline + aviso
 const[patSelId,setPatSelId]=useState<string|null>(null); // paciente seleccionado (la ficha sólo aparece al seleccionar)
 const[patTab,setPatTab]=useState<"resumen"|"historial"|"notas"|"documentos">("resumen"); // pestaña de la ficha (en sitio)
 const[patEdit,setPatEdit]=useState(false);const[editBusy,setEditBusy]=useState(false);
 const[editForm,setEditForm]=useState<{name:string;birthDate:string;sexAtBirth:string;curp:string;phone:string;email:string;address:string;occupation:string;maritalStatus:string}>({name:"",birthDate:"",sexAtBirth:"UNKNOWN",curp:"",phone:"",email:"",address:"",occupation:"",maritalStatus:""});
 const[regExtra,setRegExtra]=useState({curp:"",phone:"",email:"",address:"",occupation:"",maritalStatus:""});
 // Auditoría L-06: tutor o representante legal (obligatorio en la práctica para menores: sin él no hay consentimiento) y
 // confirmación explícita cuando el servidor detecta un homónimo con la misma fecha de nacimiento.
 const[regGuardian,setRegGuardian]=useState({name:"",relationship:"",phone:""});
 const[regDup,setRegDup]=useState<{message:string;inline:boolean;openConsulta?:boolean}|null>(null);
 const regIsMinor=(()=>{if(!regDob)return false;const b=new Date(`${regDob}T00:00:00Z`),a=new Date();let y=a.getUTCFullYear()-b.getUTCFullYear();if(a.getUTCMonth()<b.getUTCMonth()||(a.getUTCMonth()===b.getUTCMonth()&&a.getUTCDate()<b.getUTCDate()))y-=1;return y>=0&&y<18;})();
 const[busy,setBusy]=useState("");
 const[error,setError]=useState("");

 useEffect(()=>{
  const s=getStoredSession();
  if(!s){window.location.replace("/login");return;} // Atajo de UX (no es un control de seguridad): si no hay metadatos de sesión en el navegador se envía al login sin
 // esperar una respuesta 401. El control real es doble: el middleware exige la cookie para servir la página y la API
 // verifica la firma HMAC, el scope y la revocación en cada petición (R01-031/R01-032).
  setSession(s);setReady(true); // U-12: sin paciente hasta que el médico elija uno (antes: UUID aleatorio => 4 peticiones a un paciente inexistente)
 },[]);
 // Auditoría U-17 — el contrato de estados PROHIBIDOS del design system (packages/design-system) se aplica en el workspace
 // REAL, no solo en el prototipo gux-001. Se calcula el conjunto de estados activos a partir del estado de la UI y, si una
 // combinación prohibida llegara a darse, se corrige (borrando lo que sobra) y se registra en consola: nunca se pinta.
 const uiForbidden=useRef<string|null>(null);
 useEffect(()=>{
  const active:string[]=[];
  if(patientId){active.push("PATIENT_A_CONTEXT");if(dataOwner.current&&dataOwner.current!==patientId&&(tl||gaps||snap||trends||cpSnap||vitHist||refCtx||docsSnap||ciSnap||docDetail))active.push("PATIENT_B_DATA");}
  const draftDirty=Object.values(cForm).some(v=>v.trim())||cAntec.length>0;
  if(draftOwner.current&&draftOwner.current!==patientId){active.push("PATIENT_SWITCH");if(draftDirty)active.push("OLD_DRAFT_SUBMITTABLE");}
  const criticalOpen=(gaps??[]).some(g=>g.priority==="HIGH"&&(g.code==="CRITICAL_RESULT_OPEN"||g.code==="VITAL_CRITICAL"||g.code==="FOLLOWUP_OPEN"));
  if(criticalOpen)active.push("CRITICAL_OPEN");
  if(enc?.state==="READY_TO_SIGN"&&!criticalOpen)active.push("SIGN_READY"); // con críticos abiertos la firma se presenta BLOQUEADA, no "lista"
  // G-09: los pares que la UI puede conocer. Sesión caducada con PHI en pantalla; nota firmada que siguiera editable (los campos
  // se deshabilitan fuera de OPEN); dependencia degradada presentada como "sin pendientes"; sin sesión con mutaciones habilitadas.
  const sessionExpired=!!session&&session.expiresAt*1000<Date.now();
  if(sessionExpired||!session)active.push("TENANT_INVALID");if(patientId&&(snap||tl||gaps))active.push("PHI_INTERACTIVE");
  if(enc?.state==="SIGNED")active.push("SIGNED");if(!enc||enc.state==="OPEN")active.push("EDITABLE_AUTHORITATIVE");
  if(chartState==="error")active.push("DEGRADED_DEPENDENCY");if(chartState==="ready"&&gaps!==null&&gaps.length===0)active.push("EMPTY_SUCCESS");
  if(!session)active.push("UNAUTHORIZED");if(busy===""&&ready)active.push("MUTATION_ENABLED");
  try{assertNoForbidden(active);uiForbidden.current=null;}
  catch(e){
   const rule=e instanceof Error?e.message:String(e);uiForbidden.current=rule;console.error("[workspace] estado prohibido corregido:",rule);
   if(rule.includes("PATIENT_B_DATA")){setTl(null);setGaps(null);setSnap(null);setTrends(null);setCpSnap(null);setVitHist(null);setRefCtx(null);setDocsSnap(null);setCiSnap(null);setDocDetail(null);}
   if(rule.includes("OLD_DRAFT_SUBMITTABLE")){setCForm({motivo:"",historia:"",antec:"",interrog:"",explor:"",plan:""});setCAntec([]);draftOwner.current=patientId;}
   if(rule.includes("TENANT_INVALID")||rule.includes("UNAUTHORIZED")){window.location.replace("/login");} // sesión inválida: fuera del espacio clínico
   if(rule.includes("DEGRADED_DEPENDENCY")){setGaps(null);} // un fallo de carga nunca se presenta como "sin pendientes"
  }
 // R05a (WS1-04): los cinco snapshots por paciente entran en las dependencias, o el guardián no se volvería a evaluar
 // cuando el dato que sobrevive al cambio de paciente es uno de ellos —que era justamente el caso que no detectaba—.
 },[patientId,tl,gaps,snap,trends,cpSnap,vitHist,refCtx,docsSnap,ciSnap,docDetail,cForm,cAntec,enc,session,chartState,busy,ready]);
 // Capacidades del servidor (auditoría L-10/L-11). Si la consulta falla, las verticales hospitalarias quedan APAGADAS.
 useEffect(()=>{
  if(!ready||!session)return;let cancelled=false;const ac=new AbortController();
  (async()=>{try{const r=await apiRequest("/api/v1/features",{method:"GET",signal:ac.signal});if(!cancelled)setHospitalOn(r.status===200&&r.body["hospitalVerticals"]===true);}
   catch{if(!cancelled)setHospitalOn(false);}})(); // sin red: apagado; no es un error que el médico deba ver
  return()=>{cancelled=true;ac.abort();};
 },[ready,session]);

 // Auto-carga silenciosa del contexto de seguridad (timeline + care-gaps) al cambiar de paciente,
 // para que los contadores del patient header estén SIEMPRE presentes. Debounce para no disparar
 // en cada tecla del input de ID; 404 => sin datos (no es error). No usa `call` (no bloquea la UI).
 useEffect(()=>{
  if(!patientId||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  // Cambio de paciente: se borra DE INMEDIATO lo del paciente anterior (nunca datos de A bajo la identidad de B; U-05).
  setTl(null);setGaps(null);setSnap(null);setTrends(null);setChartState("loading");
  const t=setTimeout(async()=>{
   // 404 = paciente sin datos/sin registrar (legítimo). Cualquier otro >=400 o excepción = NO SE SABE => "error".
   let failed=false;const known=(s:number)=>{if(s>=400&&s!==404)failed=true;return s<400;};
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/timeline`,{method:"GET",signal:ac.signal});
    if(cancelled)return;
    setTl(known(r.status)?((r.body["items"] as TL[])??[]):r.status===404?[]:null);
    const g=await apiRequest(`/api/v1/patients/${patientId}/care-gaps`,{method:"GET",signal:ac.signal});
    if(cancelled)return;
    // Auditoría C-20: además de los pendientes de flujo, las brechas de cuidado PREVENTIVO (por condición y edad).
    const preventive=((g.body["preventive"] as{code:string;label:string;priority:Gap["priority"]}[]|undefined)??[]).map(x=>({aggregateType:"Preventive",aggregateId:x.code,code:x.code,label:x.label,priority:x.priority}));
    setGaps(known(g.status)?[...((g.body["gaps"] as Gap[])??[]),...preventive]:g.status===404?[]:null);
    const sp=await apiRequest(`/api/v1/patients/${patientId}/consultation-snapshot`,{method:"GET",signal:ac.signal});
    if(cancelled)return;
    setSnap(known(sp.status)&&sp.body["registered"]?conForma<Snap>(sp.body,FORMA.snap):null);
    const tr=await apiRequest(`/api/v1/patients/${patientId}/trends`,{method:"GET",signal:ac.signal});
    if(cancelled)return;
    setTrends(known(tr.status)?conForma<Trends>(tr.body,FORMA.trends):null);
    dataOwner.current=patientId;setChartState(failed?"error":"ready");
   }catch{if(!cancelled)setChartState("error");}
  },450);
  return()=>{cancelled=true;ac.abort();clearTimeout(t);};
 },[patientId,ready,session,chartReload]);

 // Reloj en vivo del dashboard (hora del consultorio).
 useEffect(()=>{const id=setInterval(()=>setClock(new Date()),1000*30);return()=>clearInterval(id);},[]);
 // Ficha de Pacientes: al seleccionar un paciente, carga sus documentos (para la pestaña Documentos/Notas de la ficha).
 useEffect(()=>{
  if(view!=="pacientes"||!patSelId||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{try{const r=await apiRequest(`/api/v1/patients/${patSelId}/documents`,{method:"GET",signal:ac.signal});if(!cancelled&&r.status===200)setDocsSnap(conForma<DocsSnap>(r.body,FORMA.docsSnap));}catch{/* documentos no disponibles */}})();
  return()=>{cancelled=true;ac.abort();};
 },[view,patSelId,ready,session]);
 // Agenda del día real (vistas Agenda e Inicio).
 useEffect(()=>{
  if((view!=="agenda"&&view!=="inicio"&&view!=="consulta")||!ready||!session)return;
  // Inicio y consulta miran solo el día de hoy; la Agenda respeta la vista (día/lista=1 día, semana/mes=rango).
  const qs=view==="agenda"?agendaWindow(agendaView,agendaDate):`date=${new Date().toISOString().slice(0,10)}`;
  let cancelled=false;const ac=new AbortController();
  (async()=>{try{const r=await apiRequest(`/api/v1/appointments?${qs}`,{method:"GET",signal:ac.signal});
   if(cancelled)return;
   if(r.status<400){setAgenda({appointments:(r.body["appointments"] as AgendaAppt[])??[],counts:(r.body["counts"] as{programadas:number;atendidas:number;enEspera:number;canceladas:number})??{programadas:0,atendidas:0,enEspera:0,canceladas:0}});setAgendaErr(false);}
   else setAgendaErr(true); // no dejar la agenda en "Cargando…" indefinido ante un error del servidor
  }catch{if(!cancelled)setAgendaErr(true);}})();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session,agendaDate,agendaView]);
 // Inicio, Pacientes, Órdenes y Agenda: cargan worklist (tareas del consultorio) + lista de pacientes reales.
 useEffect(()=>{
  // U-12: la lista de pacientes se necesita en TODA vista con barra de paciente (el selector reutilizable la usa).
  if(!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/worklist",{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status<400)setPanel({gaps:(r.body["gaps"] as PanelGap[])??[],patientCount:Number(r.body["patientCount"]??0)});
   }catch{/* worklist no disponible */}
   try{
    const r=await apiRequest("/api/v1/patients?limit=200",{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status<400){setPatientList((r.body["patients"] as{patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string;version?:number}[])??[]);setPatientTotal(typeof r.body["total"]==="number"?r.body["total"]:null);setPatientMore(!!r.body["nextCursor"]);}
   }catch{/* lista no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga del registro de alergias (vista Alergias) — GET clínica-wide con conteos por gravedad/tipo.
 useEffect(()=>{
  if(view!=="alergias"||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/allergies",{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setAlergReg(r.body as unknown as AllergyRegistry);
   }catch{/* registro no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga del registro de problemas (vista Problemas › lista) — GET clínica-wide con conteos.
 useEffect(()=>{
  if(view!=="problemas"||probScreen!=="lista"||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/problems",{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setProbReg(r.body as unknown as ProblemRegistry);
   }catch{/* registro no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,probScreen,ready,session]);

 // Auto-carga del registro de vacunas (vista Vacunas) — GET clínica-wide con conteos y cobertura.
 useEffect(()=>{
  if(view!=="vacunas"||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/immunizations",{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setImmReg(r.body as unknown as ImmRegistry);
   }catch{/* registro no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga del registro POBLACIONAL de signos vitales (vista Signos vitales › «Toda la clínica») — GET clínica-wide.
 useEffect(()=>{
  if(view!=="signos"||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/vitals",{method:"GET",signal:ac.signal});
    if(cancelled)return;
    if(r.status<400){setVitReg(r.body as unknown as VitalsRegistry);setVitRegErr(false);}else setVitRegErr(true);
   }catch{if(!cancelled)setVitRegErr(true);}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga del historial de signos vitales del paciente en contexto (vista Signos vitales).
 useEffect(()=>{
  if(view!=="signos"||!ready||!session||!patientId)return;
  let cancelled=false;const ac=new AbortController();
  setVitHist(null); // R05a/WS1-04: nunca datos del paciente anterior bajo la cabecera del nuevo
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/vitals`,{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setVitHist(conForma<VitalHistory>(r.body,FORMA.vitHist));
   }catch{/* historial no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session,patientId]);

 // Auto-carga del registro POBLACIONAL de planes de cuidado (vista Plan de cuidado › «Toda la clínica») — GET clínica-wide.
 useEffect(()=>{
  if(view!=="planCuidado"||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/care-plans",{method:"GET",signal:ac.signal});
    if(cancelled)return;
    if(r.status<400){setCpReg(r.body as unknown as CarePlansRegistry);setCpRegErr(false);}else setCpRegErr(true);
   }catch{if(!cancelled)setCpRegErr(true);}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga del snapshot del Plan de cuidado del paciente en contexto.
 useEffect(()=>{
  if(view!=="planCuidado"||!ready||!session||!patientId)return;
  let cancelled=false;const ac=new AbortController();
  setCpSnap(null); // R05a/WS1-04: nunca datos del paciente anterior bajo la cabecera del nuevo
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/care-plan`,{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setCpSnap(conForma<CarePlanSnap>(r.body,FORMA.cpSnap));
   }catch{/* snapshot no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session,patientId]);

 // Lote G — Auto-carga del registro POBLACIONAL de interconsultas + directorio de destinatarios (GET clínica-wide).
 useEffect(()=>{
  if(view!=="interconsulta"||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/referrals",{method:"GET",signal:ac.signal});
    if(cancelled)return;
    if(r.status<400){setIcReg(r.body as unknown as ReferralsRegistry);setIcRegErr(false);}else setIcRegErr(true);
   }catch{if(!cancelled)setIcRegErr(true);}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga del contexto para Nueva interconsulta (panel derecho: alergias/medicamentos/problemas/labs/vitales).
 useEffect(()=>{
  if(view!=="interconsulta"||!ready||!session||!patientId)return;
  let cancelled=false;const ac=new AbortController();
  setRefCtx(null); // R05a/WS1-04: nunca datos del paciente anterior bajo la cabecera del nuevo
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/referral-context`,{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setRefCtx(conForma<RefContext>(r.body,FORMA.refCtx));
   }catch{/* contexto no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session,patientId]);

 // Auto-carga del snapshot de Seguimiento (tareas + tendencia de vitales + indicadores clave).
 useEffect(()=>{
  if(view!=="seguimiento"||!ready||!session||!patientId)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/follow-up`,{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setFuSnap(conForma<FollowUpSnap>(r.body,FORMA.fuSnap));
   }catch{/* snapshot no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session,patientId]);

 // Auto-carga del registro de facturación (vista Facturación) — GET clínica-wide con KPIs.
 useEffect(()=>{
  if(view!=="facturacion"||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/claims",{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setClaimsReg(r.body as unknown as ClaimsRegistry);
   }catch{/* registro no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga de documentos del paciente en contexto (vista Documentos).
 useEffect(()=>{
  if(view!=="documentos"||!ready||!session||!patientId)return;
  let cancelled=false;const ac=new AbortController();
  setDocsSnap(null); // R05a/WS1-04: nunca datos del paciente anterior bajo la cabecera del nuevo
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/documents`,{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setDocsSnap(conForma<DocsSnap>(r.body,FORMA.docsSnap));
   }catch{/* lista no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session,patientId]);

 // Al cargar la lista de documentos, precarga el contenido REAL del primero (repositorio GET /documents/:id).
 useEffect(()=>{
  if(view!=="documentos")return;const first=docsSnap?.items?.[0];
  if(first&&docDetail?.documentId!==first.documentId)void loadDoc(first.documentId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[view,docsSnap]);

 // Auto-carga de las obligaciones regulatorias del consultorio (vista Obligaciones) — nivel tenant, sin paciente.
 useEffect(()=>{
  if(view!=="obligaciones"||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/regulatory-obligations",{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setRegObSnap(r.body as unknown as RegObSnap);
   }catch{/* lista no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga del snapshot para Clinical Intelligence (alertas deterministas + contexto). R6 IA generativa en pausa.
 useEffect(()=>{
  if(view!=="clinicalIntel"||!ready||!session||!patientId)return;
  let cancelled=false;const ac=new AbortController();
  setCiSnap(null); // R05a/WS1-04: nunca datos del paciente anterior bajo la cabecera del nuevo
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/consultation-snapshot`,{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setCiSnap(conForma<CiSnap>(r.body,FORMA.ciSnap));
   }catch{/* snapshot no disponible */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session,patientId]);

 // Auto-carga de los ajustes del consultorio (vista Configuración) — GET singleton por tenant + versión.
 useEffect(()=>{
  if(view!=="configuracion"||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/office-settings",{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200){const b=r.body as{settings:Partial<OfficeSettings>;version:number};
     // Fusiona con defaults para tolerar ajustes previos sin horario/módulos (retrocompatibilidad).
     const merged:OfficeSettings={...CFG_DEFAULTS,...b.settings,
      schedule:Array.isArray(b.settings.schedule)&&b.settings.schedule.length?b.settings.schedule:CFG_DEFAULTS.schedule,
      modules:{...CFG_DEFAULTS.modules,...(b.settings.modules??{})}};
     setCfgSettings(merged);setCfgVer(b.version);setCfgLoaded(true);}
   }catch{/* ajustes no disponibles */}
   if(!cancelled)void loadProfile(); // firma y sello del médico (Blob privado)
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga del tablero de Reportes (KPIs de pacientes/ingresos + diagnósticos principales, nivel tenant).
 useEffect(()=>{
  if(view!=="reportes"||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest("/api/v1/reports",{method:"GET",signal:ac.signal});
    if(cancelled)return;
    if(r.status===200){setRepSnap(r.body as unknown as ReportsSnap);setRepErr(false);}
    else setRepErr(true); // no dejar el tablero en "Cargando…" indefinido ante un error
   }catch{if(!cancelled)setRepErr(true);}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga del registro de resultados (vista Resultados) — GET clínica-wide con estado-UI derivado + KPIs.
 useEffect(()=>{
  if((view!=="resultados"&&view!=="ordenes")||!ready||!session)return;
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   if(view==="resultados"){try{
    const r=await apiRequest("/api/v1/results",{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setResReg(r.body as unknown as ResultsRegistry);
   }catch{/* registro no disponible */}}
   try{
    const r=await apiRequest("/api/v1/orders",{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setOrdReg(r.body as unknown as typeof ordReg);
   }catch{/* órdenes no disponibles */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session]);

 // Auto-carga de las pestañas por paciente de la vista Consulta (resultados/órdenes/medicamentos/plan/documentos/seguimiento).
 // Auditoría R05a (WS1-14): también en el EXPEDIENTE CRUDO. La ventana de Medicación del expediente permite prescribir y no
 // mostraba NADA de lo que el paciente ya toma —su lista de medicamentos solo se llenaba con lo prescrito en esa sesión—,
 // mientras que sus alergias y problemas sí se ven en la cabecera. Prescribir sin ver la medicación vigente es el riesgo.
 useEffect(()=>{
  if((view!=="consulta"&&view!=="exp")||!ready||!session||!patientId){setConsTabs(null);return;}
  let cancelled=false;const ac=new AbortController();
  (async()=>{
   try{
    const r=await apiRequest(`/api/v1/patients/${patientId}/consultation-tabs`,{method:"GET",signal:ac.signal});
    if(!cancelled&&r.status===200)setConsTabs(conForma<ConsTabs>(r.body,FORMA.consTabs));
   }catch{/* pestañas no disponibles */}
  })();
  return()=>{cancelled=true;ac.abort();};
 },[view,ready,session,patientId]);

 // Scrollspy: resalta en el nav-rail el módulo actual = la ÚLTIMA sección cuyo top ya cruzó bajo los
 // headers sticky (~140px). El IntersectionObserver solo dispara el recálculo en cada cruce de esa línea.
 useEffect(()=>{
  if(!ready)return;
  const sections=Array.from(document.querySelectorAll<HTMLElement>(".mos-grid > section"));
  if(!sections.length)return;
  const OFF=140;
  const compute=()=>{
   let cur:HTMLElement|undefined=sections[0];
   for(const s of sections){if(s.getBoundingClientRect().top-OFF<=1)cur=s;else break;}
   const h2=cur?.querySelector("h2")?.textContent?.trim();
   if(h2)setActiveH2(h2);
  };
  const io=new IntersectionObserver(compute,{rootMargin:`-${OFF}px 0px 0px 0px`,threshold:[0,1]});
  sections.forEach(s=>io.observe(s));
  compute();
  return()=>io.disconnect();
 },[ready]);

 // Auditoría 2026-09-19, anexo R05a (WS1-12) — DÓNDE APARECE EL AVISO DE UNA MUTACIÓN. La regla, escrita.
//
// El hallazgo señalaba dos paradigmas de busy/error conviviendo: `call()` con estado global y decenas de manejadores con su
// propio `xBusy`/`xMsg`. Al medirlo (24-sep-2026) resultaron 83 mutaciones: 64 por `call()`, 19 con mensaje propio y
// NINGUNA sin aviso, que era el riesgo de verdad. Así que no son dos paradigmas en conflicto: es una regla que nadie había
// escrito, y unificar 83 llamadas sería una reescritura sin beneficio para el médico.
//
// LA REGLA: el aviso aparece DONDE ESTÁ LA ACCIÓN.
//   · `call(tag, fn)` — transiciones del expediente (proponer medicación, avanzar un resultado, cerrar una obligación…).
//     La superficie es el expediente entero: bloquea por `tag` y el error va al aviso del expediente.
//   · `xBusy`/`xMsg` propios — acciones con FORMULARIO o DIÁLOGO propio: adjuntar un archivo, firmar el encuentro, guardar
//     los signos vitales de la consulta (que además informa cuáles se guardaron y cuáles no), el módulo de Órdenes, los
//     ajustes del consultorio. Poner esos mensajes en un aviso global los alejaría del campo que los provoca.
// Lo que NO se admite —y lo comprueba `tests/v22/mutation-feedback.test.ts`— es una mutación sin ninguno de los dos: un POST
// que falla y de cuyo fallo el médico no se entera.
 async function call(tag:string,fn:()=>Promise<void>){setBusy(tag);setError("");try{await fn();}catch(e){setError(userMessage(e));}finally{setBusy("");}}
 const openEncounter=()=>call("open",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/encounters",{method:"POST",body:{encounterId:id,patientId,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}setEnc({id,state:"OPEN",version:Number(r.body["version"]??1)});
 });
 const saveAssessment=()=>call("assess",async()=>{if(!enc)return;
  const r=await apiRequest(`/api/v1/encounters/${enc.id}/assessment`,{method:"POST",body:{assessment,plan,occurredAt:nowIso()},ifMatch:enc.version});
  if(r.status>=400){setError(errMsg(r));return;}setEnc({...enc,state:"READY_TO_SIGN",version:Number(r.body["version"]??enc.version+1)});
 });
 // Huella del contenido mostrado. Sin WebCrypto no hay firma: no existe un camino alterno "sin huella".
 async function sha256Hex(text:string):Promise<string>{
  if(!globalThis.crypto?.subtle)throw new Error("Este navegador no permite calcular la huella del contenido (WebCrypto no disponible); no se puede firmar.");
  const d=await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join("");
 }
 // Abre la confirmación con el texto de la valoración GUARDADA (assessment + plan), que es exactamente lo que firma el servidor.
 const askSignEncounter=async(a:string,pl:string)=>{setSignErr("");const text=`${a}\n${pl}`;setSignAsk({kind:"encounter",title:"Nota de la consulta",text,hash:await sha256Hex(text)});};
 const signEncounter=()=>call("sign",async()=>{if(!enc)return;await askSignEncounter(assessment,plan);});
 const askSignDocument=(d:Doc)=>call("doc-"+d.id,async()=>{
  // Se firma lo PERSISTIDO: se relee el documento del servidor y eso es lo que el médico revisa.
  const r=await apiRequest(`/api/v1/documents/${d.id}`,{method:"GET"});
  if(r.status!==200){setError(errMsg(r));return;}
  const text=String(r.body["content"]??"");const version=Number(r.body["version"]??d.version);
  setSignErr("");setSignAsk({kind:"document",doc:{...d,version},title:String(r.body["title"]??d.label),text,hash:await sha256Hex(text)});
 });
 const confirmSign=async()=>{
  if(!signAsk||signBusy)return;setSignBusy(true);setSignErr("");
  try{
   if(signAsk.kind==="encounter"){
    if(!enc){setSignErr("No hay un encuentro abierto.");return;}
    const r=await apiRequest(`/api/v1/encounters/${enc.id}/signature`,{method:"POST",body:{occurredAt:nowIso(),contentHash:signAsk.hash},ifMatch:enc.version});
    if(r.status>=400){setSignErr(errMsg(r));return;} // p. ej. pendientes críticos sin cerrar, o el contenido cambió
    setEnc({...enc,state:"SIGNED",version:Number(r.body["version"]??enc.version+1),signatureDigest:String(r.body["signatureDigest"]??"")});
    setCMsg("Consulta firmada (registro inmutable).");
   }else{
    const d=signAsk.doc;
    const r=await apiRequest(`/api/v1/documents/${d.id}/signature`,{method:"POST",body:{occurredAt:nowIso(),contentHash:signAsk.hash},ifMatch:d.version});
    if(r.status>=400){setSignErr(errMsg(r));return;}
    setDocs(ds=>ds.map(x=>x.id===d.id?{...x,state:"SIGNED",version:Number(r.body["version"]??d.version+1)}:x));
   }
   setSignAsk(null);
  }catch(e){setSignErr(userMessage(e));}finally{setSignBusy(false);}
 };
 // Compone la nota clínica del encuentro (valoración) a partir del formulario estructurado de la Consulta.
 function composeNote():string{
  const parts:string[]=[];
  if(cForm.motivo.trim())parts.push(`MOTIVO DE CONSULTA: ${cForm.motivo.trim()}`);
  if(cForm.historia.trim())parts.push(`HISTORIA DE LA ENFERMEDAD ACTUAL: ${cForm.historia.trim()}`);
  const antecTxt=[cAntec.join(", "),cForm.antec.trim()].filter(Boolean).join(" · ");
  if(antecTxt)parts.push(`ANTECEDENTES RELEVANTES: ${antecTxt}`);
  if(cForm.interrog.trim())parts.push(`INTERROGATORIO POR APARATOS Y SISTEMAS: ${cForm.interrog.trim()}`);
  if(cForm.explor.trim())parts.push(`EXPLORACIÓN FÍSICA: ${cForm.explor.trim()}`);
  const dx=(snap?.problems??[]).slice(0,4).map(c=>`${c} ${DX_LABEL(c)}`).join("; ");
  if(dx)parts.push(`IMPRESIÓN DIAGNÓSTICA: ${dx}`);
  return parts.join("\n")||"Consulta registrada.";
 }
 // Acción CONTEXTUAL del encuentro desde la Consulta: abre -> guarda valoración -> firma (FSM real, con gate de firma).
 const consultaAdvance=()=>call("cadv",async()=>{
  setCMsg(null);
  if(!patientId){setCMsg("Selecciona un paciente para iniciar la consulta.");return;}
  if(!enc){
   const id=uuid();const r=await apiRequest("/api/v1/encounters",{method:"POST",body:{encounterId:id,patientId,occurredAt:nowIso()}});
   if(r.status>=400){setCMsg(errMsg(r));return;}
   setEnc({id,state:"OPEN",version:Number(r.body["version"]??1)});setCMsg("Encuentro abierto. Documenta y guarda la valoración.");return;
  }
  if(enc.state==="OPEN"){
   const assessmentText=composeNote();const planText=cForm.plan.trim()||"Plan pendiente de detallar.";
   setAssessment(assessmentText);setPlan(planText);
   const r=await apiRequest(`/api/v1/encounters/${enc.id}/assessment`,{method:"POST",body:{assessment:assessmentText,plan:planText,occurredAt:nowIso()},ifMatch:enc.version});
   if(r.status>=400){setCMsg(errMsg(r));return;}
   setEnc({...enc,state:"READY_TO_SIGN",version:Number(r.body["version"]??enc.version+1)});setCMsg("Valoración guardada. Lista para firmar.");return;
  }
  if(enc.state==="READY_TO_SIGN"){
   // Auditoría L-03: el formulario sigue editable tras "Guardar valoración". Si cambió, se GUARDA DE NUEVO (nueva versión)
   // antes de firmar; así lo que se firma nunca es una versión anterior a la que el médico tiene delante.
   let a=assessment,pl=plan;const nowA=composeNote(),nowP=cForm.plan.trim()||"Plan pendiente de detallar.";
   if(nowA!==a||nowP!==pl){
    const r=await apiRequest(`/api/v1/encounters/${enc.id}/assessment`,{method:"POST",body:{assessment:nowA,plan:nowP,occurredAt:nowIso()},ifMatch:enc.version});
    if(r.status>=400){setCMsg(errMsg(r));return;}
    a=nowA;pl=nowP;setAssessment(a);setPlan(pl);setEnc({...enc,version:Number(r.body["version"]??enc.version+1)});
    setCMsg("Los cambios del formulario se guardaron en la valoración. Revise el texto y confirme la firma.");
   }
   await askSignEncounter(a,pl);return;
  }
 });
 // Guarda los signos vitales de la Consulta como eventos reales (POST /vitals); surfacea la interpretación crítica del kernel.
 const saveConsultaVitals=async()=>{
  if(!patientId){setCVitMsg("Selecciona un paciente para guardar los signos vitales.");return;}
  const toSave:[string,string,string][]=[];
  if(cVit.ta.trim())toSave.push(["BP",cVit.ta.trim(),"mmHg"]);
  if(cVit.fc.trim())toSave.push(["HR",cVit.fc.trim(),"lpm"]);
  if(cVit.fr.trim())toSave.push(["RESP",cVit.fr.trim(),"rpm"]);
  if(cVit.temp.trim())toSave.push(["TEMP",cVit.temp.trim(),"°C"]);
  if(cVit.spo2.trim())toSave.push(["SPO2",cVit.spo2.trim(),"%"]);
  if(!toSave.length){setCVitMsg("Captura al menos un signo vital.");return;}
  setCVitBusy(true);setCVitMsg(null);
  // Auditoría U-09 / D11a: la captura (id y hora) se conserva mientras dura: un reintento no duplica lo ya guardado y solo crea lo
  // que faltaba. `submitVitals` es la implementación única que comparte con Signos vitales (reglas de la captura en shared.tsx).
  const capture=liveVitalCapture(cVitSubmission.current);cVitSubmission.current=capture;
  try{
   const res=await submitVitals(capture,patientId,toSave);
   if(!isSelectedPatient(patientId))return; // F4: el médico cambió de paciente durante el guardado
   cVitSubmission.current=res.capture;
   setCVitMsg(vitalSubmitMessage(res));
   // F3: lo guardado sale del formulario; queda solo lo rechazado para corregirlo.
   const field:Record<string,keyof typeof cVit>={BP:"ta",HR:"fc",RESP:"fr",TEMP:"temp",SPO2:"spo2"};
   if(res.failed.length){setCVit(v=>{const n={...v};for(const vt of res.saved){const f=field[vt];if(f)n[f]="";}return n;});return;}
   cVitSubmission.current=null;
   setCVit({ta:"",fc:"",fr:"",temp:"",spo2:""});
  }catch(e){setCVitMsg(userMessage(e));}finally{setCVitBusy(false);}
 };
 // Crea órdenes clínicas reales desde la Consulta (POST /orders) por cada estudio seleccionado, con el tipo de la categoría.
 // Auditoría 2026-09-19, anexo R05a (WS1-11) — LAS ÓRDENES DEL LOTE NO SE DUPLICAN Y SE DICE CUÁLES QUEDARON.
 //
 // EL DEFECTO: el lote se enviaba con `orderId:uuid()` NUEVO en cada intento y se abortaba en la primera que fallara. Si
 // fallaba la tercera de cinco, las dos primeras YA estaban en el expediente, el mensaje solo decía el error de la tercera
 // —el médico no sabía cuáles se habían creado— y volver a pulsar «Crear órdenes» creaba OTRA VEZ las dos primeras, porque
 // tanto el `orderId` como la Idempotency-Key eran nuevos.
 //
 // LA CORRECCIÓN es la misma que ya usan los signos vitales (U-09): un id de CAPTURA estable mientras el lote no termine, y
 // de él se derivan el `orderId` y la Idempotency-Key de cada estudio. Reintentar es entonces idempotente de verdad: las ya
 // creadas devuelven su respuesta original y solo se envían las que faltan. Y no se aborta en la primera: se intentan todas
 // y se informa exactamente cuáles quedaron y cuáles no.
 const createConsultaOrders=async()=>{
  if(!patientId){setCOrdMsg("Selecciona un paciente para crear órdenes.");return;}
  if(!cOrdSel.length){setCOrdMsg("Selecciona al menos un estudio.");return;}
  setCOrdBusy(true);setCOrdMsg(null);
  const at=nowIso();
  const submission=cOrdSubmission.current??(cOrdSubmission.current=uuid());
  try{
   const creadas:string[]=[];const fallidas:string[]=[];
   for(const detail of cOrdSel){
    const key=`${submission}:${patientId}:${cOrdCat}:${detail}`; // el paciente entra en la llave: un lote no puede replicarse sobre otro paciente

    const r=await apiRequest("/api/v1/orders",{method:"POST",body:{orderId:derivedClientUuid(key),patientId,orderType:cOrdCat,detail,occurredAt:at},idempotencyKey:derivedClientUuid(key+":idem")});
    if(r.status>=400){fallidas.push(`${detail}: ${errMsg(r)}`);continue;}
    creadas.push(detail);
   }
   if(fallidas.length){
    setCOrdMsg(`Creadas: ${creadas.length?creadas.join(", "):"ninguna"}. NO creadas: ${fallidas.join(" · ")}. Corrija y vuelva a pulsar: las ya creadas no se duplicarán.`);
    return; // la captura NO se cierra: el reintento reutiliza los mismos ids
   }
   cOrdSubmission.current=null; // lote completo: el siguiente es una captura nueva
   const n=creadas.length;setCOrdSel([]);setCOrdMsg(`${n} orden(es) creada(s) y registrada(s) en el expediente ✓`);
  }catch(e){setCOrdMsg(userMessage(e));}finally{setCOrdBusy(false);}
 };
 // ===== Resultados: registrar un resultado real (POST /results; critical se DERIVA del valor por CDS) + recarga =====
 const reloadResults=async()=>{const r=await apiRequest("/api/v1/results",{method:"GET"});if(r.status===200)setResReg(r.body as unknown as ResultsRegistry);};
 const createResult=async()=>{
  if(!resForm.patientId||!resForm.analyte.trim()||!resForm.value.trim()){setResMsg2("Selecciona paciente, analito y valor.");return;}
  setResBusy2(true);setResMsg2(null);
  try{
   const r=await apiRequest("/api/v1/results",{method:"POST",body:{resultId:uuid(),patientId:resForm.patientId,orderId:uuid(),analyte:resForm.analyte.trim(),value:resForm.value.trim(),...(resForm.unit?{unit:resForm.unit}:{}),occurredAt:nowIso()}});
   if(r.status>=400){setResMsg2(errMsg(r));return;}
   const crit=r.body["critical"]===true;const delta=r.body["deltaFlagged"]===true;
   await reloadResults();setResNew(false);setResForm({patientId:resForm.patientId,analyte:resForm.analyte,value:"",unit:resForm.unit});
   // El mensaje refleja el estado REAL que devolvió el servidor; "dentro de rango" solo si el estado es NORMAL.
   const st=typeof r.body["status"]==="string"?r.body["status"]:"UNKNOWN";const interp=typeof r.body["interpretation"]==="string"?r.body["interpretation"]:"";
   const noUnit=r.body["unitAssumed"]===true?" · se registró SIN unidad (se asumió la canónica)":"";
   setResMsg2(crit?`Resultado registrado ⚠ CRÍTICO${delta?" · Δ crítico vs previo":""} — requiere acción y bloquea la firma hasta cerrarse.`
    :st==="NORMAL"?`Resultado registrado ✓ (dentro de rango)${noUnit}.`
    :st==="ABNORMAL"?`Resultado registrado — FUERA de rango (no crítico)${interp?`: ${interp}`:""}${noUnit}.`
    :`Resultado registrado — sin rango de referencia para interpretarlo${noUnit}.`);
  }catch(e){setResMsg2(userMessage(e));}finally{setResBusy2(false);}
 };
 // ===== Obligaciones regulatorias del consultorio: alta inline real (POST /regulatory-obligations) + recarga =====
 const reloadRegObligations=async()=>{const r=await apiRequest("/api/v1/regulatory-obligations",{method:"GET"});if(r.status===200)setRegObSnap(r.body as unknown as RegObSnap);};
 const createRegObligation=async()=>{
  if(!oblForm.name.trim()){setOblMsg("Indica el nombre de la obligación.");return;}
  setOblBusy(true);setOblMsg(null);
  try{
   const r=await apiRequest("/api/v1/regulatory-obligations",{method:"POST",body:{obligationId:uuid(),name:oblForm.name.trim(),category:oblForm.category,periodicity:oblForm.periodicity.trim()||"Única",...(oblForm.dueDate?{dueDate:`${oblForm.dueDate}T00:00:00.000Z`}:{}),occurredAt:nowIso()}});
   if(r.status>=400){setOblMsg(errMsg(r));return;}
   await reloadRegObligations();setOblNew(false);setOblForm({name:"",category:oblForm.category,periodicity:oblForm.periodicity,dueDate:""});setOblMsg("Obligación agregada; su estado se computa de la fecha límite ✓");
  }catch(e){setOblMsg(userMessage(e));}finally{setOblBusy(false);}
 };
 // ===== Documentos: crear un documento clínico real (POST /documents; contenido de texto) + recarga por paciente =====
 const createDocument=async()=>{
  if(!patientId){setDocMsg("Selecciona un paciente para crear el documento.");return;}
  if(!docForm.title.trim()||!docForm.content.trim()){setDocMsg("Indica título y contenido.");return;}
  setDocBusy(true);setDocMsg("");
  try{
   const r=await apiRequest("/api/v1/documents",{method:"POST",body:{documentId:uuid(),patientId,docType:docForm.docType,title:docForm.title.trim(),content:docForm.content.trim(),occurredAt:nowIso()}});
   if(r.status>=400){setDocMsg(errMsg(r));return;}
   const g=await apiRequest(`/api/v1/patients/${patientId}/documents`,{method:"GET"});if(g.status===200)setDocsSnap(conForma<DocsSnap>(g.body,FORMA.docsSnap));
   setDocNew(false);setDocForm({docType:docForm.docType,title:"",content:""});setDocMsg("Documento creado ✓");
  }catch(e){setDocMsg(userMessage(e));}finally{setDocBusy(false);}
 };
 // ===== Plan de cuidado: agregar meta real al plan del paciente en contexto (POST /care-plans) + recarga =====
 const reloadCarePlan=async()=>{if(!patientId)return;const r=await apiRequest(`/api/v1/patients/${patientId}/care-plan`,{method:"GET"});if(r.status===200)setCpSnap(conForma<CarePlanSnap>(r.body,FORMA.cpSnap));};
 const addCarePlanGoal=async()=>{
  if(!patientId){setCpMsg("Selecciona un paciente para agregar una meta al plan.");return;}
  if(!cpForm.goal.trim()){setCpMsg("Escribe el objetivo/meta.");return;}
  setCpBusy(true);setCpMsg(null);
  try{
   const r=await apiRequest("/api/v1/care-plans",{method:"POST",body:{carePlanId:uuid(),patientId,category:cpForm.category,goal:cpForm.goal.trim(),occurredAt:nowIso()}});
   if(r.status>=400){setCpMsg(errMsg(r));return;}
   await reloadCarePlan();setCpNew(false);setCpForm({category:cpForm.category,goal:""});setCpMsg("Meta agregada al plan de cuidado ✓");
  }catch(e){setCpMsg(userMessage(e));}finally{setCpBusy(false);}
 };
 // ===== Vacunas: registro inline real (POST /immunizations; si hay lote+sitio, administra) + recarga =====
 const reloadImmunizations=async()=>{const r=await apiRequest("/api/v1/immunizations",{method:"GET"});if(r.status===200)setImmReg(r.body as unknown as ImmRegistry);};
 const createImmunizationInline=async()=>{
  if(!vacForm.patientId||!vacForm.vaccineCode.trim()){setVacMsg("Selecciona un paciente e indica la vacuna.");return;}
  setVacBusy(true);setVacMsg(null);
  try{
   const id=uuid();
   const r=await apiRequest("/api/v1/immunizations",{method:"POST",body:{immunizationId:id,patientId:vacForm.patientId,vaccineCode:vacForm.vaccineCode.trim(),dose:vacForm.dose.trim()||"1/1",occurredAt:nowIso()}});
   if(r.status>=400){setVacMsg(errMsg(r));return;}
   let applied=false;
   if(vacForm.lot.trim()&&vacForm.site.trim()){
    const a=await apiRequest(`/api/v1/immunizations/${id}/administration`,{method:"POST",body:{lot:vacForm.lot.trim(),site:vacForm.site.trim(),occurredAt:nowIso()},ifMatch:Number(r.body["version"]??1)});
    if(a.status>=400){setVacMsg(`Vacuna registrada (pendiente); no se pudo administrar: ${errMsg(a)}`);await reloadImmunizations();setVacBusy(false);return;}
    applied=true;
   }
   await reloadImmunizations();setVacNew(false);setVacForm({patientId:"",vaccineCode:"",dose:"1/1",lot:"",site:"Brazo izquierdo"});
   setVacMsg(applied?"Vacuna registrada y aplicada ✓":"Vacuna registrada como pendiente ✓ (captura lote y sitio para marcarla aplicada).");
  }catch(e){setVacMsg(userMessage(e));}finally{setVacBusy(false);}
 };
 // ===== Alergias: creación inline real (POST /allergies) + recarga del registro clínica-wide =====
 const reloadAllergies=async()=>{const r=await apiRequest("/api/v1/allergies",{method:"GET"});if(r.status===200)setAlergReg(r.body as unknown as AllergyRegistry);};
 const createAllergyInline=async()=>{
  if(!algForm.patientId||!algForm.substance.trim()){setAlgMsg("Selecciona un paciente e indica la sustancia.");return;}
  setAlgBusy(true);setAlgMsg(null);
  try{
   const r=await apiRequest("/api/v1/allergies",{method:"POST",body:{allergyId:uuid(),patientId:algForm.patientId,substance:algForm.substance.trim(),severity:algForm.severity,reaction:algForm.reaction.trim()||REACTION_UNSPECIFIED,occurredAt:nowIso()}});
   if(r.status>=400){setAlgMsg(errMsg(r));return;}
   await reloadAllergies();setAlgNew(false);setAlgForm({patientId:"",substance:"",severity:"MODERATE",reaction:""});setAlgMsg("Alergia registrada. Ya bloquea la prescripción del fármaco relacionado.");
  }catch(e){setAlgMsg(userMessage(e));}finally{setAlgBusy(false);}
 };
 // Agrega un problema (CIE-10 del catálogo real) a la lista del paciente (POST /problems) y refresca el snapshot.
 // Lote D: la impresión diagnóstica lleva TIPO (epistémico) real — el POST /problems ya lo acepta.
 const addConsultaProblem=async(code:string,epistemic:string="PROBABLE")=>{
  if(!patientId){setCDxMsg("Selecciona un paciente.");return;}
  setCDxBusy(true);setCDxMsg(null);
  try{
   const r=await apiRequest("/api/v1/problems",{method:"POST",body:{problemId:uuid(),patientId,code,epistemic,occurredAt:nowIso()}});
   if(r.status>=400){setCDxMsg(errMsg(r));return;}
   const epLbl:Record<string,string>={PROBABLE:"presuntivo",CONFIRMED:"confirmado",POSSIBLE:"diferencial"};
   setCDxQuery("");setCDxMsg(`Diagnóstico ${code} agregado (${epLbl[epistemic]??"presuntivo"}) ✓`);
   try{const sp=await apiRequest(`/api/v1/patients/${patientId}/consultation-snapshot`,{method:"GET"});if(sp.status<400&&sp.body["registered"])setSnap(conForma<Snap>(sp.body,FORMA.snap));}catch{/* refresco best-effort del snapshot */}
  }catch(e){setCDxMsg(userMessage(e));}finally{setCDxBusy(false);}
 };
 const proposeMed=()=>call("med-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/medications",{method:"POST",body:{medicationId:id,patientId,drugCode:drug,dose,route,frequency:freq,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setMeds(ms=>[...ms,{id,label:`${drug} ${dose} ${route} ${freq}`,state:"PROPOSED",version:Number(r.body["version"]??1)}]);
  setDrug("");setDoseAmt("");setFreq("");
 });
 const advanceMed=(m:Med)=>call("med-"+m.id,async()=>{
  const n=medNext(m);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const r=await apiRequest(n.path,{method:"POST",body,ifMatch:m.version});
  const code=(r.body["error"] as{code?:string}|undefined)?.code;
  if(r.status===428&&code==="SAFETY_ACK_REQUIRED"){setAckWhy("");setAckMed({med:m,message:String((r.body["error"] as{message?:string}|undefined)?.message??"")});return;}
  if(r.status===403&&code==="SAFETY_BLOCKED"){
   const d=blockDetails(r);const message=String((r.body["error"] as{message?:string}|undefined)?.message??"");
   if((d.hard?.length??0)>0){setError(`Bloqueo NO anulable (${d.hard!.map(x=>BARRIER_LABEL[x]??x).join(", ")}): corrige la dosis o la orden. ${message}`);return;}
   if((d.overridable?.length??0)>0){setOverrideWhy("");setOverrideMed({med:m,message,barriers:d.overridable!});return;}
  }
  if(r.status>=400){setError(errMsg(r));return;}
  setMeds(ms=>ms.map(x=>x.id===m.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 // Auditoría U-20: receta imprimible con los datos legales. El servidor devuelve el HTML (o 400 diciendo qué falta); se abre
 // en una ventana nueva y se invoca la impresión del navegador (el PDF lo produce el navegador; no se instala nada).
 const printPrescription=(ids:string[])=>call("rx-print",async()=>{
  if(!patientId||ids.length===0)return;
  const r=await apiRequest(`/api/v1/patients/${patientId}/prescription-print?medications=${ids.join(",")}`,{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  const html=String(r.body["html"]??"");
  const w=window.open("","_blank","noopener,width=900,height=1000");
  if(!w){setError("El navegador bloqueó la ventana de impresión: permite ventanas emergentes para este sitio.");return;}
  w.document.open();w.document.write(html);w.document.close();
  w.addEventListener("load",()=>w.print());setTimeout(()=>{try{w.print();}catch{/* ya impreso o cerrado */}},600);
 });
 // U-19: reenvía la transición NOMBRANDO cada barrera anulada y con la justificación del médico (≥20 caracteres); ambas quedan
 // en el evento inmutable junto con quién anuló. Si además hay barreras sin evaluar, el servidor pide la confirmación (428) y
 // el diálogo de confirmación conserva la anulación.
 const confirmOverrideMed=()=>{const o=overrideMed;if(!o)return;return call("med-"+o.med.id,async()=>{
  const n=medNext(o.med);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const override={barriers:o.barriers,justification:overrideWhy.trim()};
  const r=await apiRequest(n.path,{method:"POST",body:{...body,overrideBarriers:override.barriers,overrideJustification:override.justification},ifMatch:o.med.version});
  const code=(r.body["error"] as{code?:string}|undefined)?.code;
  if(r.status===428&&code==="SAFETY_ACK_REQUIRED"){setOverrideMed(null);setAckWhy("");setAckMed({med:o.med,message:String((r.body["error"] as{message?:string}|undefined)?.message??""),override});return;}
  if(r.status>=400){setError(errMsg(r));return;}
  setMeds(ms=>ms.map(x=>x.id===o.med.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
  setOverrideMed(null);setOverrideWhy("");
 });};
 // Reenvía PRESCRIBE con la confirmación expresa y la justificación del médico; ambas quedan en el evento inmutable.
 const confirmAckMed=()=>{const a=ackMed;if(!a)return;return call("med-"+a.med.id,async()=>{
  const n=medNext(a.med);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const ov=a.override?{overrideBarriers:a.override.barriers,overrideJustification:a.override.justification}:{};
  const r=await apiRequest(n.path,{method:"POST",body:{...body,...ov,acknowledgeUnverified:true,unverifiedJustification:ackWhy.trim()},ifMatch:a.med.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setMeds(ms=>ms.map(x=>x.id===a.med.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
  setAckMed(null);setAckWhy("");
 });};
 // Panel 3 — verificación de seguridad SIN escribir (dry-run de las barreras) y envío de la Rx.
 const verifyRx=()=>call("rxcheck",async()=>{
  setRxMsg("");
  const r=await apiRequest(`/api/v1/patients/${patientId}/prescription-check`,{method:"POST",body:{drug:rxDrug,dose:rxDose,route:rxRoute,frequency:rxFreq}});
  if(r.status>=400){setError(errMsg(r));setRxCheck(null);return;}
  setRxCheck(r.body as unknown as RxCheck);
 });
 const sendRx=()=>call("rxsend",async()=>{
  const id=uuid();
  const r=await apiRequest("/api/v1/medications",{method:"POST",body:{medicationId:id,patientId,drugCode:rxDrug,dose:rxDose,route:rxRoute,frequency:rxFreq,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setMeds(ms=>[{id,label:`${rxDrug} ${rxDose}`.trim(),state:"PROPOSED",version:Number(r.body["version"]??0)},...ms]);
  setRxCheck(null);setRxMsg("✓ Prescripción registrada como PROPOSED. Gestiona su ciclo (prescribir → activar) en el módulo Medicación.");
 });
 const receiveResult=()=>call("res-new",async()=>{
  if(!resQuick.value.trim()){setError("Capture el valor del resultado.");return;}
  const id=uuid();const r=await apiRequest("/api/v1/results",{method:"POST",body:{resultId:id,patientId,orderId:uuid(),analyte:resQuick.analyte,value:resQuick.value.trim(),...(resQuick.unit?{unit:resQuick.unit}:{}),occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setResults(rs=>[...rs,{id,label:`${resQuick.analyte} ${resQuick.value.trim()} ${resQuick.unit}`.trim(),critical:r.body["critical"]===true,state:"RECEIVED",version:Number(r.body["version"]??1)}]);
  setResQuick(q=>({...q,value:""}));
 });
 const advanceResult=(res:Result)=>call("res-"+res.id,async()=>{
  const n=resNext(res);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const r=await apiRequest(n.path,{method:"POST",body,ifMatch:res.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setResults(rs=>rs.map(x=>x.id===res.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createDoc=()=>call("doc-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/documents",{method:"POST",body:{documentId:id,patientId,docType,title:docTitle||"Documento",content:docContent,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setDocs(ds=>[...ds,{id,label:`${docTitle||"Documento"} (${docType})`,state:"DRAFT",version:Number(r.body["version"]??1)}]);
  setDocTitle("");setDocContent("");
 });
 const advanceDoc=(d:Doc)=>{
  if(d.state==="FINALIZED"){void askSignDocument(d);return;}          // firmar: siempre con revisión del contenido persistido
  if(d.state==="SIGNED"||d.state==="AMENDED"){setAmendText("");setAmendAsk(d);return;} // enmendar: el texto lo escribe el médico
  return advanceDocNow(d);
 };
 const confirmAmend=()=>{const d=amendAsk;if(!d||amendText.trim().length<10)return;return call("doc-"+d.id,async()=>{
  const r=await apiRequest(`/api/v1/documents/${d.id}/amendment`,{method:"POST",body:{addendum:amendText.trim(),occurredAt:nowIso()},ifMatch:d.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setDocs(ds=>ds.map(x=>x.id===d.id?{...x,state:"AMENDED",version:Number(r.body["version"]??d.version+1)}:x));setAmendAsk(null);setAmendText("");
 });};
 const advanceDocNow=(d:Doc)=>call("doc-"+d.id,async()=>{
  const n=docNext(d);if(!n)return;
  const r=await apiRequest(n.path,{method:"POST",body:n.body,ifMatch:d.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setDocs(ds=>ds.map(x=>x.id===d.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createOrder=()=>call("ord-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/orders",{method:"POST",body:{orderId:id,patientId,orderType,detail:orderDetail,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setOrders(os=>[...os,{id,label:`${orderType}: ${orderDetail}`,state:"DRAFT",version:Number(r.body["version"]??1)}]);setOrderDetail("");
 });
 const advanceOrder=(o:Order)=>call("ord-"+o.id,async()=>{
  const n=orderNext(o);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const r=await apiRequest(n.path,{method:"POST",body,ifMatch:o.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setOrders(os=>os.map(x=>x.id===o.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createReferral=()=>call("ref-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/referrals",{method:"POST",body:{referralId:id,patientId,specialty:refSpecialty,reason:refReason,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setReferrals(rs=>[...rs,{id,label:`${refSpecialty}: ${refReason}`,state:"REQUESTED",version:Number(r.body["version"]??1)}]);setRefSpecialty("");setRefReason("");
 });
 const advanceReferral=(rr:Ref)=>call("ref-"+rr.id,async()=>{
  const n=referralNext(rr);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const r=await apiRequest(n.path,{method:"POST",body,ifMatch:rr.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setReferrals(rs=>rs.map(x=>x.id===rr.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const cancelReferral=(rr:Ref)=>call("ref-"+rr.id,async()=>{
  const path=rr.state==="REQUESTED"?`/api/v1/referrals/${rr.id}/decline`:`/api/v1/referrals/${rr.id}/cancellation`;
  const to:RefSt=rr.state==="REQUESTED"?"DECLINED":"CANCELLED";
  const body=await resolveAsks({reason:ASK("Motivo del cierre de la interconsulta",5),occurredAt:nowIso()});if(!body)return;
  const r=await apiRequest(path,{method:"POST",body,ifMatch:rr.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setReferrals(rs=>rs.map(x=>x.id===rr.id?{...x,state:to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createAppointment=()=>call("apt-new",async()=>{
  const id=uuid();const startIso=apptStart?new Date(apptStart).toISOString():proximaCitaIso();
  const r=await apiRequest("/api/v1/appointments",{method:"POST",body:{appointmentId:id,patientId,startAt:startIso,reason:apptReason,consultorio:apptCons,apptType,endAt:new Date(new Date(startIso).getTime()+30*60000).toISOString(),occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setAppts(as=>[...as,{id,label:`${new Date(startIso).toLocaleString()} · ${apptReason}`,state:"SCHEDULED",version:Number(r.body["version"]??1)}]);setApptStart("");setApptReason("");
 });
 const advanceAppt=(a:Appt)=>call("apt-"+a.id,async()=>{
  const n=apptNext(a);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const r=await apiRequest(n.path,{method:"POST",body,ifMatch:a.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setAppts(as=>as.map(x=>x.id===a.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const closeAppt=(a:Appt,mode:"cancel"|"noshow")=>call("apt-"+a.id,async()=>{
  const path=mode==="noshow"?`/api/v1/appointments/${a.id}/no-show`:`/api/v1/appointments/${a.id}/cancellation`;
  const to:ApptSt=mode==="noshow"?"NO_SHOW":"CANCELLED";
  const body=mode==="noshow"?{occurredAt:nowIso()}:await resolveAsks({reason:ASK("Motivo de la cancelación de la cita",5),occurredAt:nowIso()});if(!body)return;
  const r=await apiRequest(path,{method:"POST",body,ifMatch:a.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setAppts(as=>as.map(x=>x.id===a.id?{...x,state:to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createDialysis=()=>call("dz-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/dialysis-sessions",{method:"POST",body:{dialysisId:id,patientId,modality:dzMod,accessType:dzAcc,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setDialz(ds=>[...ds,{id,modality:dzMod,state:"SCHEDULED",version:Number(r.body["version"]??1)}]);
 });
 const doDialysisAction=(d:Dz,act:{path:string;body:Record<string,unknown>;to:DzSt})=>call("dz-"+d.id,async()=>{
  const sent=await postAction(act,d.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  setDialz(ds=>ds.map(x=>x.id===d.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createSurgery=()=>call("sg-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/surgeries",{method:"POST",body:{surgeryId:id,patientId,procedure:sgProc,laterality:sgLat,surgeon:"Cirujano de guardia",occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setSurgs(ss=>[...ss,{id,procedure:sgProc,state:"SCHEDULED",version:Number(r.body["version"]??1)}]);setSgProc("");
 });
 const advanceSurgery=(s:Sg)=>call("sg-"+s.id,async()=>{
  const n=sgNext(s);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const r=await apiRequest(n.path,{method:"POST",body,ifMatch:s.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setSurgs(ss=>ss.map(x=>x.id===s.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const cancelSurgery=(s:Sg)=>call("sg-"+s.id,async()=>{
  const body=await resolveAsks({reason:ASK("Motivo de la cancelación de la cirugía",5),occurredAt:nowIso()});if(!body)return;
  const r=await apiRequest(`/api/v1/surgeries/${s.id}/cancellation`,{method:"POST",body,ifMatch:s.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setSurgs(ss=>ss.map(x=>x.id===s.id?{...x,state:"CANCELLED",version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createTransfusion=()=>call("tf-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/transfusions",{method:"POST",body:{transfusionId:id,patientId,bloodProduct:tfProduct,units:tfUnits,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setTransfs(ts=>[...ts,{id,product:tfProduct,units:tfUnits,state:"ORDERED",version:Number(r.body["version"]??1)}]);
 });
 const advanceTransfusion=(t:Tf)=>call("tf-"+t.id,async()=>{
  const n=tfNext(t);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const r=await apiRequest(n.path,{method:"POST",body,ifMatch:t.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setTransfs(ts=>ts.map(x=>x.id===t.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const transfusionReaction=(t:Tf)=>call("tf-"+t.id,async()=>{
  const body=await resolveAsks({reaction:ASK("Descripción de la reacción transfusional",10),occurredAt:nowIso()});if(!body)return;
  const r=await apiRequest(`/api/v1/transfusions/${t.id}/reaction`,{method:"POST",body,ifMatch:t.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setTransfs(ts=>ts.map(x=>x.id===t.id?{...x,state:"REACTION",version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createWound=()=>call("wn-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/wounds",{method:"POST",body:{woundId:id,patientId,location:wnLoc,stage:wnStage,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setWounds(ws=>[...ws,{id,location:wnLoc,stage:wnStage,state:"OPEN",version:Number(r.body["version"]??1)}]);
 });
 const doWoundAction=(w:Wn,act:{path:string;body:Record<string,unknown>;to:WnSt})=>call("wn-"+w.id,async()=>{
  const sent=await postAction(act,w.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  const ns=body["stage"];setWounds(ws=>ws.map(x=>x.id===w.id?{...x,state:act.to,stage:typeof ns==="string"?ns:x.stage,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createTriage=()=>call("tr-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/triage",{method:"POST",body:{triageId:id,patientId,chiefComplaint:trComplaint,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setTriages(ts=>[...ts,{id,chiefComplaint:trComplaint,acuity:0,state:"WAITING",version:Number(r.body["version"]??1),decisionPoint:"",reassessDueAt:null,upgradeConsidered:false}]);setTrComplaint("");
 });
 const doTriageAction=(t:Tr,act:{path:string;body:Record<string,unknown>;to:TrSt})=>call("tr-"+t.id,async()=>{
  const sent=await postAction(act,t.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  const na=body["acuity"];setTriages(ts=>ts.map(x=>x.id===t.id?{...x,state:act.to,acuity:typeof na==="number"?na:x.acuity,version:Number(r.body["version"]??x.version+1)}:x));
 });
 // R2B-019: clasificar deja de ser un botón con un número dentro. Se envían los discriminadores y el servidor devuelve el
 // nivel, el punto de decisión que lo produjo y el plazo de reevaluación; la pantalla muestra lo que el servidor calculó, no
 // lo que la pantalla creía. Si el servidor rechaza el cuerpo, se dice: un triage que falla en silencio es un paciente sin
 // clasificar que parece clasificado.
 const classifyTriage=(t:Tr)=>call("tr-"+t.id,async()=>{
  setTrEsiMsg(null);
  const r=await apiRequest(`/api/v1/triage/${t.id}/assessment`,{method:"POST",body:esiBody(trEsi),ifMatch:t.version});
  if(r.status>=400){setTrEsiMsg(errMsg(r));return;}
  const nivel=Number(r.body["acuity"]??0);
  setTriages(ts=>ts.map(x=>x.id===t.id?{...x,state:"TRIAGED",acuity:Number.isFinite(nivel)&&nivel>0?nivel:x.acuity,
   decisionPoint:String(r.body["decisionPoint"]??""),reassessDueAt:typeof r.body["reassessDueAt"]==="string"?String(r.body["reassessDueAt"]):null,
   upgradeConsidered:r.body["upgradeConsidered"]===true,version:Number(r.body["version"]??x.version+1)}:x));
  setTrEsiFor(null);setTrEsi(ESI_FORM_EMPTY);
 });
 const createIncident=()=>call("inc-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/incidents",{method:"POST",body:{incidentId:id,patientId,category:incCat,severity:incSev,description:incDesc,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setIncs(is=>[...is,{id,label:`${incCat} · ${incSev} · ${incDesc}`,state:"REPORTED",version:Number(r.body["version"]??1)}]);setIncDesc("");
 });
 const doIncAction=(i:Inc,act:{path:string;body:Record<string,unknown>;to:IncSt})=>call("inc-"+i.id,async()=>{
  const sent=await postAction(act,i.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  setIncs(is=>is.map(x=>x.id===i.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createSpecimen=()=>call("sp-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/specimens",{method:"POST",body:{specimenId:id,patientId,specimenType:specType,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setSpecs(ss=>[...ss,{id,specimenType:specType,state:"COLLECTED",version:Number(r.body["version"]??1)}]);
 });
 const advanceSpecimen=(s:Sp)=>call("sp-"+s.id,async()=>{
  const n=spNext(s);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const r=await apiRequest(n.path,{method:"POST",body,ifMatch:s.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setSpecs(ss=>ss.map(x=>x.id===s.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const rejectSpecimen=(s:Sp)=>call("sp-"+s.id,async()=>{
  const body=await resolveAsks({reason:ASK("Motivo del rechazo de la muestra",5),occurredAt:nowIso()});if(!body)return;
  const r=await apiRequest(`/api/v1/specimens/${s.id}/rejection`,{method:"POST",body,ifMatch:s.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setSpecs(ss=>ss.map(x=>x.id===s.id?{...x,state:"REJECTED",version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createAdmission=()=>call("adm-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/admissions",{method:"POST",body:{admissionId:id,patientId,unit:admUnit,reason:admReason,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setAdms(as=>[...as,{id,unit:admUnit,state:"ADMITTED",version:Number(r.body["version"]??1)}]);setAdmReason("");
 });
 const doAdmAction=(a:Adm,act:{path:string;body:Record<string,unknown>;to:AdmSt})=>call("adm-"+a.id,async()=>{
  const sent=await postAction(act,a.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  const nu=body["unit"];setAdms(as=>as.map(x=>x.id===a.id?{...x,state:act.to,unit:typeof nu==="string"?nu:x.unit,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createConsent=()=>call("cs-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/consents",{method:"POST",body:{consentId:id,patientId,scopeType:csType,documentRef:csRef,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setConsents(cs=>[...cs,{id,label:`${csType} · ${csRef}`,state:"DRAFTED",version:Number(r.body["version"]??1)}]);setCsRef("");
 });
 const doConsentActionNow=(c:Cs,act:{path:string;body:Record<string,unknown>;to:CsSt})=>call("cs-"+c.id,async()=>{
  const sent=await postAction(act,c.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  setConsents(cs=>cs.map(x=>x.id===c.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 // R05a-F07: si el destino es irreversible, NO se ejecuta: se pide confirmación explícita primero.
 const doConsentAction=(c:Cs,act:{path:string;body:Record<string,unknown>;to:CsSt})=>{
  if(!TRANSICIONES_IRREVERSIBLES.has(act.to))return doConsentActionNow(c,act);
  setPendingIrreversible({what:act.to==="REVOKED"?"Revocar el consentimiento":"Rechazar el consentimiento",
   detail:act.to==="REVOKED"?"Revocar retira la base legal para tratar los datos de este paciente hasta que vuelva a otorgarlo. El registro es de solo-añadir: no se puede deshacer, solo anotar encima.":"El rechazo queda registrado de forma permanente.",
   run:()=>{setPendingIrreversible(null);void doConsentActionNow(c,act);}});
  return;
 };
 const doClaimAction=(c:Clm,act:{path:string;body:Record<string,unknown>;to:ClmSt})=>{
  if(!TRANSICIONES_IRREVERSIBLES.has(act.to))return doClaimActionNow(c,act);
  setPendingIrreversible({what:act.to==="VOIDED"?"Anular la factura":"Rechazar la factura",
   detail:"La anulación queda registrada de forma permanente y afecta los ingresos del periodo. El registro es de solo-añadir: no se puede deshacer.",
   run:()=>{setPendingIrreversible(null);void doClaimActionNow(c,act);}});
  return;
 };
 const confirmIrreversible=()=>{pendingIrreversible?.run();};
 const cancelIrreversible=()=>setPendingIrreversible(null);
 const createClaim=()=>call("clm-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/claims",{method:"POST",body:{claimId:id,patientId,amount:clmAmount,currency:clmCurrency,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setClaims(cs=>[...cs,{id,label:`${clmAmount} ${clmCurrency}`,state:"DRAFT",version:Number(r.body["version"]??1)}]);setClmAmount("");
 });
 const doClaimActionNow=(c:Clm,act:{path:string;body:Record<string,unknown>;to:ClmSt})=>call("clm-"+c.id,async()=>{
  const sent=await postAction(act,c.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  setClaims(cs=>cs.map(x=>x.id===c.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createPlan=()=>call("cp-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/care-plans",{method:"POST",body:{carePlanId:id,patientId,category:planCat,goal:planGoal,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setPlans(ps=>[...ps,{id,label:`${planCat} · ${planGoal}`,state:"PROPOSED",version:Number(r.body["version"]??1)}]);setPlanGoal("");
 });
 const doPlanAction=(c:Cp,act:{path:string;body:Record<string,unknown>;to:CpSt})=>call("cp-"+c.id,async()=>{
  const sent=await postAction(act,c.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  setPlans(ps=>ps.map(x=>x.id===c.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createVital=()=>call("vit-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/vitals",{method:"POST",body:{vitalId:id,patientId,vitalType:vitType,value:vitValue,unit:vitUnit,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setVitals(vs=>[...vs,{id,vitalType:vitType,value:vitValue,unit:vitUnit,state:"RECORDED",version:Number(r.body["version"]??1),vstatus:String(r.body["status"]??""),interp:String(r.body["interpretation"]??"")}]);setVitValue("");
 });
 const doVitAction=(v:Vit,act:{path:string;body:Record<string,unknown>;to:VitSt})=>call("vit-"+v.id,async()=>{
  const sent=await postAction(act,v.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  const nv=body["value"];setVitals(vs=>vs.map(x=>x.id===v.id?{...x,state:act.to,value:typeof nv==="string"?nv:x.value,version:Number(r.body["version"]??x.version+1),vstatus:r.body["status"]!==undefined?String(r.body["status"]):(x.vstatus??""),interp:r.body["interpretation"]!==undefined?String(r.body["interpretation"]):(x.interp??"")}:x));
 });
 const createImmunization=()=>call("imm-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/immunizations",{method:"POST",body:{immunizationId:id,patientId,vaccineCode:immCode,dose:immDose,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setImms(is=>[...is,{id,label:`${immCode} · dosis ${immDose}`,state:"DUE",version:Number(r.body["version"]??1)}]);setImmCode("");
 });
 const doImmAction=(i:Imm,act:{path:string;body:Record<string,unknown>;to:ImmSt})=>call("imm-"+i.id,async()=>{
  const sent=await postAction(act,i.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  setImms(is=>is.map(x=>x.id===i.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createAllergy=()=>call("al-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/allergies",{method:"POST",body:{allergyId:id,patientId,substance:alSub,severity:alSev,reaction:alReac.trim()||REACTION_UNSPECIFIED,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  setAllergies(as=>[...as,{id,label:`${alSub} (${alSev})`,state:"ACTIVE",version:Number(r.body["version"]??1)}]);setAlSub("");setAlReac("");
 });
 const doAllergyAction=(a:Al,act:{path:string;body:Record<string,unknown>;to:AlSt})=>call("al-"+a.id,async()=>{
  const sent=await postAction(act,a.version);if(!sent)return;const{r,body}=sent;
  if(r.status>=400){setError(errMsg(r));return;}
  setAllergies(as=>as.map(x=>x.id===a.id?{...x,state:act.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createProblem=()=>call("pb-new",async()=>{
  const id=uuid();const r=await apiRequest("/api/v1/problems",{method:"POST",body:{problemId:id,patientId,code:probCode,occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  const desc=String(r.body["description"]??probCode);const code=String(r.body["code"]??probCode);
  setProblems(ps=>[...ps,{id,label:`${desc} (${code})`,state:"ACTIVE",version:Number(r.body["version"]??1)}]);setProbCode("");setProbDesc("");
 });
 const doProblemAction=(p:Prob,a:{path:string;body:Record<string,unknown>;to:ProbSt})=>call("pb-"+p.id,async()=>{
  const r=await apiRequest(a.path,{method:"POST",body:a.body,ifMatch:p.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setProblems(ps=>ps.map(x=>x.id===p.id?{...x,state:a.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 const createObligation=()=>call("ob-new",async()=>{
  // R05a-F04: NO se envía `dueAt`. El plazo lo deriva el servidor del tipo y la prioridad; mandarlo desde aquí fijaba 7 días
  // para toda obligación nueva, fuera cual fuera su severidad. La respuesta trae el plazo efectivo y se muestra.
  const id=uuid();const r=await apiRequest("/api/v1/obligations",{method:"POST",body:{obligationId:id,patientId,ownerId:uuid(),kind:obKind||"FOLLOWUP",occurredAt:nowIso()}});
  if(r.status>=400){setError(errMsg(r));return;}
  const vence=typeof r.body["dueAt"]==="string"?` · vence ${new Date(String(r.body["dueAt"])).toLocaleDateString()}`:"";
  setObligations(os=>[...os,{id,label:`${obKind||"Seguimiento"}${vence}`,state:"OPEN",version:Number(r.body["version"]??1)}]);setObKind("");
 });
 const advanceObligation=(o:Ob)=>call("ob-"+o.id,async()=>{
  const n=obNext(o);if(!n)return;
  const body=await resolveAsks(n.body);if(!body)return;
  const r=await apiRequest(n.path,{method:"POST",body,ifMatch:o.version});
  if(r.status>=400){setError(errMsg(r));return;}
  setObligations(os=>os.map(x=>x.id===o.id?{...x,state:n.to,version:Number(r.body["version"]??x.version+1)}:x));
 });
 // Auditoría U-05/U-17: cambiar de paciente borra TODO lo del anterior —también el borrador de la consulta, los vitales sin
 // guardar y las pestañas cargadas— y anota a quién pertenece el borrador nuevo (draftOwner) para que el guardia de estados
 // prohibidos pueda comprobarlo. Las respuestas tardías del paciente anterior se descartan por el flag `cancelled` de cada efecto.
 // D11b (revisión F4): también la captura, el formulario y el mensaje de Signos vitales; antes quedaban los del paciente anterior
 // y «Guardar» los enviaba al nuevo. `selectedPatient` es el paciente contra el que se validan las respuestas de las mutaciones.
 function selectPatientRaw(id:string,name:string){cVitSubmission.current=null;svCapture.current=null;cOrdSubmission.current=null;draftOwner.current=id;selectedPatient.current=id;setSvTemp("");setSvFc("");setSvFr("");setSvBpS("");setSvBpD("");setSvSpo2("");setSvPeso("");setSvTalla("");setSvPab("");setSvPain("0");setSvObs("");setSvMsg("");setCForm({motivo:"",historia:"",antec:"",interrog:"",explor:"",plan:""});setCAntec([]);setCVit({ta:"",fc:"",fr:"",temp:"",spo2:""});setCPreview(false);setCMsg(null);setCVitMsg(null);setSnap(null);setTrends(null);setConsTabs(null);setFuSnap(null);setRxCheck(null);setCpSnap(null);setVitHist(null);setRefCtx(null);setDocsSnap(null);setCiSnap(null);setDocDetail(null);setPatientId(id);setPatientName(name);setEnc(null);setAssessment("");setPlan("");setMeds([]);setResults([]);setDocs([]);setOrders([]);setObligations([]);setProblems([]);setAllergies([]);setReferrals([]);setAppts([]);setImms([]);setVitals([]);setPlans([]);setClaims([]);setConsents([]);setAdms([]);setSpecs([]);setIncs([]);setTriages([]);setWounds([]);setTransfs([]);setSurgs([]);setDialz([]);setTl(null);setGaps(null);setExportInfo(null);setError("");}
 const loadPatients=(q=patientQuery)=>call("pt-list",async()=>{
  const r=await apiRequest(`/api/v1/patients?limit=200${q.trim()?`&q=${encodeURIComponent(q.trim())}`:""}`,{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  setPatientList((r.body["patients"] as {patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string;version?:number}[])??[]);
  setPatientTotal(typeof r.body["total"]==="number"?r.body["total"]:null);setPatientMore(!!r.body["nextCursor"]);
 });
 // ===== Acciones REALES de la vista Órdenes (crear + transiciones del ciclo de vida) =====
 const reloadOrders=async()=>{const r=await apiRequest("/api/v1/orders",{method:"GET"});if(r.status===200)setOrdReg(r.body as unknown as typeof ordReg);};
 const submitOrder=async()=>{
  if(!ordForm.patientId||!ordForm.detail.trim()){setOrdMsg("Selecciona un paciente e indica el estudio.");return;}
  setOrdBusy(true);setOrdMsg(null);
  try{
   const id=uuid();
   const r=await apiRequest("/api/v1/orders",{method:"POST",body:{orderId:id,patientId:ordForm.patientId,orderType:ordForm.orderType,detail:ordForm.detail.trim(),occurredAt:nowIso()}});
   if(r.status>=400){setOrdMsg(errMsg(r));return;}
   await reloadOrders();setOrdSel(id);setOrdNew(false);setOrdForm({patientId:"",orderType:"LAB",detail:""});setOrdMsg("Orden creada y registrada.");
  }catch(e){setOrdMsg(userMessage(e));}finally{setOrdBusy(false);}
 };
 const orderTransition=async(orderId:string,version:number,path:"placement"|"fulfillment"|"cancellation",okMsg:string)=>{
  setOrdBusy(true);setOrdMsg(null);
  try{
   const body=path==="cancellation"?await resolveAsks({reason:ASK("Motivo de la cancelación",5),occurredAt:nowIso()}):{occurredAt:nowIso()};if(!body)return;
   const r=await apiRequest(`/api/v1/orders/${orderId}/${path}`,{method:"POST",body,ifMatch:version});
   if(r.status>=400){setOrdMsg(errMsg(r));return;}
   await reloadOrders();setOrdMsg(okMsg);
  }catch(e){setOrdMsg(userMessage(e));}finally{setOrdBusy(false);}
 };
 // ===== Acciones REALES de la vista Agenda (crear cita + ciclo de vida) =====
 const reloadAgenda=async()=>{try{const r=await apiRequest(`/api/v1/appointments?${agendaWindow(agendaView,agendaDate)}`,{method:"GET"});if(r.status<400){setAgenda({appointments:(r.body["appointments"] as AgendaAppt[])??[],counts:(r.body["counts"] as{programadas:number;atendidas:number;enEspera:number;canceladas:number})??{programadas:0,atendidas:0,enEspera:0,canceladas:0}});setAgendaErr(false);}else setAgendaErr(true);}catch{setAgendaErr(true);}};
 const apptTransition=async(id:string,version:number,path:"check-in"|"completion"|"cancellation"|"no-show",okMsg:string)=>{
  setApptBusy(true);setApptMsg(null);
  try{
   // Auditoría R05b-15: cancelar ya exigía motivo; marcar INASISTENCIA se disparaba al primer clic y es igual de terminal
   // —queda en el expediente del paciente y alimenta el indicador de inasistencia de los reportes—, así que también lo pide.
   const body=path==="cancellation"?await resolveAsks({reason:ASK("Motivo de la cancelación de la cita",5),occurredAt:nowIso()})
    :path==="no-show"?await resolveAsks({reason:ASK("Constancia de la inasistencia (a qué hora se esperó, si se intentó contactar)",5,"p. ej. se esperó 20 min y se llamó al teléfono registrado sin respuesta"),occurredAt:nowIso()})
    :{occurredAt:nowIso()};if(!body)return;
   const r=await apiRequest(`/api/v1/appointments/${id}/${path}`,{method:"POST",body,ifMatch:version});
   if(r.status>=400){setApptMsg(errMsg(r));return;}
   await reloadAgenda();setApptMsg(okMsg);
  }catch(e){setApptMsg(userMessage(e));}finally{setApptBusy(false);}
 };
 const createAppt=async()=>{
  if(!apptForm.patientId||!apptForm.reason.trim()){setApptMsg("Selecciona un paciente e indica el motivo.");return;}
  setApptBusy(true);setApptMsg(null);
  try{
   // Auditoría L-12: la hora capturada es hora LOCAL del consultorio; antes se etiquetaba como UTC ("Z") y una cita de las
   // 10:00 quedaba registrada a las 04:00. Se convierte con el reloj del navegador y se envía como instante UTC.
   const id=uuid();const startAt=new Date(`${agendaDate}T${apptForm.time}:00`).toISOString();const endAt=new Date(new Date(startAt).getTime()+30*60000).toISOString();
   const r=await apiRequest("/api/v1/appointments",{method:"POST",body:{appointmentId:id,patientId:apptForm.patientId,startAt,endAt,reason:apptForm.reason.trim(),consultorio:apptForm.consultorio,apptType:apptForm.apptType,occurredAt:nowIso()}});
   if(r.status>=400){setApptMsg(errMsg(r));return;}
   await reloadAgenda();setApptSel(id);setApptNew(false);setApptForm({patientId:"",time:"09:00",reason:"",consultorio:"Consultorio 1",apptType:"CONSULTA_GENERAL"});setApptMsg("Cita agendada.");
  }catch(e){setApptMsg(userMessage(e));}finally{setApptBusy(false);}
 };
 const loadPanel=()=>call("panel",async()=>{
  const r=await apiRequest("/api/v1/worklist",{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  setPanel({gaps:(r.body["gaps"] as PanelGap[])??[],patientCount:Number(r.body["patientCount"]??0)});
 });
 const registerPatient=(inline=false,confirmNotDuplicate=false,openInConsulta=false)=>call("pt-reg",async()=>{
  const say=(m:string)=>{if(inline)setPatMsg(m);else setError(m);};
  if(!regName.trim()){say("Indica el nombre del paciente.");return;}
  // Auditoría L-06 / U-01: antes, sin fecha de nacimiento se registraba "1990-01-01" (una edad inventada que alimenta dosis
  // pediátricas, tamizajes y consentimiento). La fecha es obligatoria.
  if(!regDob){say("Indica la fecha de nacimiento: sin ella no se calcula la edad y no se registra un dato inventado.");return;}
  const id=uuid();const e=regExtra;setRegDup(null);
  const guardian=regGuardian.name.trim()&&regGuardian.relationship.trim()?{name:regGuardian.name.trim(),relationship:regGuardian.relationship.trim(),...(regGuardian.phone.trim()?{phone:regGuardian.phone.trim()}:{})}:undefined;
  const r=await apiRequest("/api/v1/patients",{method:"POST",body:{patientId:id,name:regName.trim(),birthDate:regDob,sexAtBirth:regSex,occurredAt:nowIso(),...(e.curp?{curp:e.curp}:{}),...(e.phone?{phone:e.phone}:{}),...(e.email?{email:e.email}:{}),...(e.address?{address:e.address}:{}),...(e.occupation?{occupation:e.occupation}:{}),...(e.maritalStatus?{maritalStatus:e.maritalStatus}:{}),...(guardian?{guardian}:{}),...(confirmNotDuplicate?{confirmNotDuplicate:true}:{})}});
  if(r.status===409){const d=(r.body["error"] as{message?:string;details?:{duplicateBy?:string}}|undefined);
   if(d?.details?.duplicateBy==="NAME_BIRTHDATE"){setRegDup({message:String(d.message??""),inline,openConsulta:openInConsulta});return;}
   say(String(d?.message??errMsg(r)));return;}
  if(r.status>=400){say(errMsg(r));return;}
  const warn=(r.body["warnings"] as string[]|undefined)?.includes("MINOR_WITHOUT_GUARDIAN");
  selectPatientRaw(id,regName);setPatientList(l=>[{patientId:id,name:regName,status:"ACTIVE",birthDate:regDob,sexAtBirth:regSex,...(e.curp?{curp:e.curp}:{})},...(l??[])]);setRegName("");setRegDob("");setRegExtra({curp:"",phone:"",email:"",address:"",occupation:"",maritalStatus:""});setRegGuardian({name:"",relationship:"",phone:""});
  if(inline){setPatNew(false);setPatMsg(warn?"Paciente registrado. Es menor de edad y no tiene tutor registrado: añádelo desde Editar antes de recabar consentimientos.":"Paciente registrado.");}
  else if(warn)setError("Menor de edad sin tutor registrado: añade al tutor o representante legal antes de recabar consentimientos.");
  // Lote C: alta desde Nueva consulta → abre de inmediato el expediente de consulta del paciente recién creado.
  if(openInConsulta){setConsultaPid(id);setCTab("actual");setView("consulta");}
 });
 const guardianFields=(style:React.CSSProperties)=>regIsMinor?<div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr",gap:10,marginTop:10}}>
  <input style={style} value={regGuardian.name} onChange={e=>setRegGuardian(g=>({...g,name:e.target.value}))} placeholder="Tutor o representante legal (menor de edad)" aria-label="Nombre del tutor" />
  <input style={style} value={regGuardian.relationship} onChange={e=>setRegGuardian(g=>({...g,relationship:e.target.value}))} placeholder="Parentesco" aria-label="Parentesco del tutor" />
  <input style={style} value={regGuardian.phone} onChange={e=>setRegGuardian(g=>({...g,phone:e.target.value}))} placeholder="Teléfono del tutor" aria-label="Teléfono del tutor" />
 </div>:null;
 const dupPanel=(inline:boolean)=>regDup&&regDup.inline===inline?<div role="alertdialog" aria-labelledby="dup-title" style={{marginTop:10,padding:"10px 14px",borderRadius:12,background:"#FFF7EC",border:"1px solid #F0DBB8",color:"#5A3A0A",fontSize:13}}>
  <b id="dup-title">Posible duplicado</b><div style={{marginTop:4}}>{regDup.message}</div>
  <div style={{display:"flex",gap:8,marginTop:8,justifyContent:"flex-end"}}>
   <button style={{...ghost,padding:"7px 12px"}} onClick={()=>setRegDup(null)}>Cancelar</button>
   <button style={{...btn,padding:"7px 12px"}} disabled={busy!==""} onClick={()=>registerPatient(inline,true,regDup.openConsulta??false)}>Es una persona distinta: registrar{regDup.openConsulta?" e iniciar consulta":""}</button>
  </div>
 </div>:null;
 // ===== Pacientes: editar (AMENDED) la ficha del paciente con datos reales (POST /patients/:id/amendment) =====
 const openEdit=(pid:string)=>{
  const p=(patientList??[]).find(x=>x.patientId===pid);const sd=(patientId===pid?snap?.demographics:undefined);
  setEditForm({name:p?.name||sd?.name||"",birthDate:(sd?.birthDate||p?.birthDate||"").slice(0,10),sexAtBirth:sd?.sex||p?.sexAtBirth||"UNKNOWN",curp:sd?.curp||p?.curp||"",phone:sd?.phone||"",email:sd?.email||"",address:sd?.address||"",occupation:sd?.occupation||"",maritalStatus:sd?.maritalStatus||""});
  setPatEdit(true);setPatMsg(null);
 };
 const amendPatient=async(pid:string)=>{
  if(!editForm.name.trim()){setPatMsg("El nombre no puede quedar vacío.");return;}
  const p=(patientList??[]).find(x=>x.patientId===pid);const ver=p?.version??1;const e=editForm;
  setEditBusy(true);setPatMsg(null);
  try{
   const body={name:e.name.trim(),...(e.birthDate?{birthDate:e.birthDate}:{}),sexAtBirth:e.sexAtBirth,occurredAt:nowIso(),...(e.curp.trim()?{curp:e.curp.trim()}:{}),...(e.phone.trim()?{phone:e.phone.trim()}:{}),...(e.email.trim()?{email:e.email.trim()}:{}),...(e.address.trim()?{address:e.address.trim()}:{}),...(e.occupation.trim()?{occupation:e.occupation.trim()}:{}),...(e.maritalStatus.trim()?{maritalStatus:e.maritalStatus.trim()}:{})};
   const r=await apiRequest(`/api/v1/patients/${pid}/amendment`,{method:"POST",body,ifMatch:ver});
   if(r.status>=400){setPatMsg(errMsg(r));return;}
   // refresca la lista (nombre/CURP/versión) y el snapshot (contacto) del paciente
   const lr=await apiRequest("/api/v1/patients",{method:"GET"});if(lr.status<400)setPatientList((lr.body["patients"] as {patientId:string;name:string;status:string;birthDate?:string;sexAtBirth?:string;curp?:string;version?:number}[])??[]);
   if(patientId===pid){try{const sp=await apiRequest(`/api/v1/patients/${pid}/consultation-snapshot`,{method:"GET"});if(sp.status<400&&sp.body["registered"])setSnap(conForma<Snap>(sp.body,FORMA.snap));}catch{/* refresco best-effort */}}
   setPatientName(e.name.trim());setPatEdit(false);setPatMsg("Ficha del paciente actualizada ✓");
  }catch(err){setPatMsg(userMessage(err));}finally{setEditBusy(false);} // R05a/WS1-08: mensaje para el médico, no la excepción cruda
 };
 const exportRecord=()=>call("exp",async()=>{
  const r=await apiRequest(`/api/v1/patients/${patientId}/export`,{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  const m=r.body["manifest"] as{aggregateCount:number;eventCount:number};
  const contentHash=String(r.body["contentHash"]??"");
  // Lote H — entrega un ARCHIVO real y descargable (antes solo se mostraba el conteo+hash, sin fichero). El artefacto es
  // el manifiesto reproducible del expediente (índice de agregados/eventos + hash), no el volcado de contenido con PHI.
  const bundle={patient:{patientId,name:patientName||null},exportedAt:String(r.body["generatedAt"]??new Date().toISOString()),contentHash,manifest:r.body["manifest"]};
  try{
   if(typeof window!=="undefined"&&typeof URL!=="undefined"&&typeof URL.createObjectURL==="function"){
    const blob=new Blob([JSON.stringify(bundle,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");
    const shortId=patientId.slice(0,8),day=new Date().toISOString().slice(0,10);
    a.href=url;a.download=`expediente-${shortId}-${day}.json`;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>{try{URL.revokeObjectURL(url);}catch{/* noop */}},0);
   }
  }catch{/* la descarga es un extra del navegador; el resumen+hash de abajo sigue siendo la evidencia */}
  setExportInfo({aggregateCount:m.aggregateCount,eventCount:m.eventCount,contentHash});
 });
 const loadTimeline=()=>call("tl",async()=>{
  const r=await apiRequest(`/api/v1/patients/${patientId}/timeline`,{method:"GET"});
  if(r.status>=400){setError(errMsg(r));return;}
  setTl((r.body["items"] as TL[])??[]);
  const g=await apiRequest(`/api/v1/patients/${patientId}/care-gaps`,{method:"GET"});
  if(g.status<400)setGaps((g.body["gaps"] as Gap[])??[]);
 });
 function reset(){selectPatientRaw("","");} // D11b: la misma limpieza completa que cualquier cambio de paciente
 // Lote B: deep-link del paciente. Reflejamos ?p=<paciente>&v=<vista> en la URL (enlace compartible) y, al
 // recargar, restauramos el foco del paciente en cuanto el padrón está disponible (antes: recargar lo perdía).
 const urlInit=useRef(typeof window!=="undefined"?window.location.search:"");
 const urlRestored=useRef(false);
 useEffect(()=>{
  if(urlRestored.current||!ready||!session)return;
  const params=new URLSearchParams(urlInit.current);const pid=params.get("p");const v=params.get("v");const s=params.get("s");
  if(!pid){urlRestored.current=true;return;}
  if(!patientList)return; // espera al padrón para tomar el nombre del paciente
  urlRestored.current=true;
  const found=patientList.find(x=>x.patientId===pid);
  if(found){selectPatientRaw(pid,found.name);const KV=new Set(["inicio","pacientes","consulta","agenda","resultados","medicamentos","ordenes","alergias","problemas","vacunas","signos","planCuidado","interconsulta","seguimiento","facturacion","documentos","obligaciones","clinicalIntel","reportes","biblioteca","configuracion","exp"]);if(v&&KV.has(v))setView(v as typeof view);if(s&&(EXP_TAB_KEYS as string[]).includes(s))setExpTab(s as ExpTab);}
 },[patientList,ready,session]);
 useEffect(()=>{
  if(typeof window==="undefined"||!ready||!session)return;
  const sp=new URLSearchParams(window.location.search);
  if(patientId)sp.set("p",patientId);else sp.delete("p");
  sp.set("v",view);
  if(view==="exp")sp.set("s",expTab);else sp.delete("s"); // ?s= solo tiene sentido dentro del expediente
  const qs=sp.toString();
  window.history.replaceState(null,"",window.location.pathname+(qs?"?"+qs:""));
 },[patientId,view,expTab,ready,session]);
 return{svCapture,isSelectedPatient,pfSearchErr,setPfSearchErr,ixMsg,setIxMsg,cspNonce,session,setSession,ready,setReady,patientId,setPatientId,enc,setEnc,assessment,setAssessment,plan,setPlan,meds,setMeds,drug,setDrug,doseAmt,setDoseAmt,doseUnit,setDoseUnit,route,setRoute,freq,setFreq,dose,results,setResults,resQuick,setResQuick,docs,setDocs,docTitle,setDocTitle,docContent,setDocContent,docType,setDocType,orders,setOrders,orderType,setOrderType,orderDetail,setOrderDetail,allergies,setAllergies,alSub,setAlSub,alSev,setAlSev,alReac,setAlReac,problems,setProblems,probCode,setProbCode,probDesc,setProbDesc,obligations,setObligations,obKind,setObKind,referrals,setReferrals,refSpecialty,setRefSpecialty,refReason,setRefReason,appts,setAppts,apptStart,setApptStart,apptReason,setApptReason,apptCons,setApptCons,apptType,setApptType,imms,setImms,immCode,setImmCode,immDose,setImmDose,vitals,setVitals,vitType,setVitType,vitValue,setVitValue,vitUnit,setVitUnit,plans,setPlans,planCat,setPlanCat,planGoal,setPlanGoal,claims,setClaims,clmAmount,setClmAmount,clmCurrency,setClmCurrency,consents,setConsents,csType,setCsType,csRef,setCsRef,adms,setAdms,admUnit,setAdmUnit,admReason,setAdmReason,specs,setSpecs,specType,setSpecType,incs,setIncs,incCat,setIncCat,incSev,setIncSev,incDesc,setIncDesc,triages,setTriages,trComplaint,setTrComplaint,trEsiFor,setTrEsiFor,trEsi,setTrEsi,trEsiMsg,setTrEsiMsg,classifyTriage,wounds,setWounds,wnLoc,setWnLoc,wnStage,setWnStage,transfs,setTransfs,tfProduct,setTfProduct,tfUnits,setTfUnits,surgs,setSurgs,sgProc,setSgProc,sgLat,setSgLat,dialz,setDialz,dzMod,setDzMod,dzAcc,setDzAcc,tl,setTl,gaps,setGaps,exportInfo,setExportInfo,panel,setPanel,patientName,setPatientName,activeH2,setActiveH2,snap,setSnap,chartState,setChartState,chartReload,setChartReload,rxDrug,setRxDrug,rxDoseAmt,setRxDoseAmt,rxDoseUnit,setRxDoseUnit,rxRoute,setRxRoute,rxFreq,setRxFreq,rxDose,rxCheck,setRxCheck,signAsk,setSignAsk,signBusy,setSignBusy,signErr,setSignErr,amendAsk,setAmendAsk,amendText,setAmendText,reasonAsk,setReasonAsk,reasonText,setReasonText,askReason,resolveAsks,hospitalOn,setHospitalOn,ackMed,setAckMed,ackWhy,setAckWhy,overrideMed,setOverrideMed,overrideWhy,setOverrideWhy,rxMsg,setRxMsg,trends,setTrends,trendKey,setTrendKey,followTab,setFollowTab,topSearch,setTopSearch,sideCollapsed,setSideCollapsed,docMenu,setDocMenu,view,setView,expTab,setExpTab,medTab,setMedTab,medQuery,setMedQuery,medCat,setMedCat,medOnlyMon,setMedOnlyMon,medOnlyRenal,setMedOnlyRenal,medSel,setMedSel,ixDrugs,setIxDrugs,ixFactors,setIxFactors,ixInput,setIxInput,ixRes,setIxRes,ixBusy,setIxBusy,alergReg,setAlergReg,alergSel,setAlergSel,alergOnlyActive,setAlergOnlyActive,alergOnlySevere,setAlergOnlySevere,alergSearch,setAlergSearch,alergType,setAlergType,algNew,setAlgNew,algBusy,setAlgBusy,algMsg,setAlgMsg,algForm,setAlgForm,probScreen,setProbScreen,probReg,setProbReg,probSel,setProbSel,probSearch,setProbSearch,probStatusF,setProbStatusF,probPlantCat,setProbPlantCat,pfName,setPfName,pfCode,setPfCode,pfType,setPfType,pfEstado,setPfEstado,pfDesc,setPfDesc,pfSev,setPfSev,pfNotes,setPfNotes,pfOnset,setPfOnset,pfResults,setPfResults,pfBusy,setPfBusy,pfMsg,setPfMsg,immReg,setImmReg,immSel,setImmSel,vacNew,setVacNew,vacBusy,setVacBusy,vacMsg,setVacMsg,vacForm,setVacForm,immSearch,setImmSearch,immStatusF,setImmStatusF,vitHist,setVitHist,vitReg,setVitReg,vitRegErr,svTemp,setSvTemp,svFc,setSvFc,svFr,setSvFr,svBpS,setSvBpS,svBpD,setSvBpD,svSpo2,setSvSpo2,svPeso,setSvPeso,svTalla,setSvTalla,svPab,setSvPab,svPain,setSvPain,svEstado,setSvEstado,svObs,setSvObs,svBusy,setSvBusy,svMsg,setSvMsg,cpSnap,setCpSnap,cpReg,setCpReg,cpRegErr,cpPlanTab,setCpPlanTab,cpNew,setCpNew,cpBusy,setCpBusy,cpMsg,setCpMsg,cpForm,setCpForm,refCtx,setRefCtx,icPatientId,setIcPatientId,icTab,setIcTab,icSpecialty,setIcSpecialty,icPriority,setIcPriority,icType,setIcType,icMotivo,setIcMotivo,icResumen,setIcResumen,icRecipient,setIcRecipient,icReg,setIcReg,icRegErr,icBusy,setIcBusy,icMsg,setIcMsg,fuSnap,setFuSnap,segTab,setSegTab,claimsReg,setClaimsReg,facTab,setFacTab,nfConcepts,setNfConcepts,nfPatientId,setNfPatientId,nfBusy,setNfBusy,nfMsg,setNfMsg,docsSnap,setDocsSnap,docDetail,setDocDetail,docDetBusy,setDocDetBusy,loadDoc,attInputRef,attBusy,setAttBusy,attMsg,setAttMsg,ATT_MAX,ATT_MIME,onPickAttachment,viewAttachment,removeAttachment,fmtBytes,sigInputRef,stampInputRef,profHas,setProfHas,CRED_EMPTY,credSaved,setCredSaved,credForm,setCredForm,credMsg,setCredMsg,credBusy,setCredBusy,credValid,saveCredentials,profUrls,setProfUrls,profBusy,setProfBusy,profMsg,setProfMsg,PROF_MIME,loadProfile,uploadProfileAsset,removeProfileAsset,docsTab,setDocsTab,docSel,setDocSel,docFolder,setDocFolder,docMsg,setDocMsg,docNew,setDocNew,docBusy,setDocBusy,docForm,setDocForm,regObSnap,setRegObSnap,oblNew,setOblNew,oblBusy,setOblBusy,oblMsg,setOblMsg,oblForm,setOblForm,oblTab,setOblTab,ciSnap,setCiSnap,ciTab,setCiTab,repSnap,setRepSnap,repErr,reloadReports,repTab,setRepTab,bibTab,setBibTab,bibEsp,setBibEsp,cfgTab,setCfgTab,CFG_DEFAULTS,cfgSettings,setCfgSettings,cfgVer,setCfgVer,cfgLoaded,setCfgLoaded,cfgBusy,setCfgBusy,cfgMsg,setCfgMsg,setCfg,saveOfficeSettings,ordTab,setOrdTab,selRow,setSelRow,cTab,setCTab,consultaPid,setConsultaPid,consultaNewPid,setConsultaNewPid,openConsulta,consTabs,setConsTabs,resTab,setResTab,resReg,setResReg,resNew,setResNew,resBusy2,setResBusy2,resMsg2,setResMsg2,resForm,setResForm,resSel,setResSel,resQ,setResQ,resTypeF,setResTypeF,resEstadoF,setResEstadoF,ordReg,setOrdReg,ordSel,setOrdSel,ordBusy,setOrdBusy,ordMsg,setOrdMsg,ordNew,setOrdNew,ordForm,setOrdForm,ordQuery,setOrdQuery,ordStatus,setOrdStatus,cForm,setCForm,cPreview,setCPreview,cMsg,setCMsg,cVit,setCVit,cVitSubmission,draftOwner,dataOwner,cVitMsg,setCVitMsg,cVitBusy,setCVitBusy,cOrdCat,setCOrdCat,cOrdSel,setCOrdSel,cOrdMsg,setCOrdMsg,cOrdBusy,setCOrdBusy,cDxQuery,setCDxQuery,cDxMsg,setCDxMsg,cDxBusy,setCDxBusy,cAntec,setCAntec,agenda,setAgenda,agendaErr,setAgendaErr,agendaDate,setAgendaDate,agendaView,setAgendaView,apptSel,setApptSel,apptBusy,setApptBusy,apptMsg,setApptMsg,apptNew,setApptNew,apptForm,setApptForm,clock,setClock,topMenu,setTopMenu,patientList,setPatientList,patientQuery,setPatientQuery,patientTotal,setPatientTotal,patientMore,setPatientMore,patientSelector,regName,setRegName,regDob,setRegDob,regSex,setRegSex,patStatus,setPatStatus,patSex,setPatSex,patNew,setPatNew,patMsg,setPatMsg,patSelId,setPatSelId,patTab,setPatTab,patEdit,setPatEdit,editBusy,setEditBusy,editForm,setEditForm,regExtra,setRegExtra,regGuardian,setRegGuardian,regDup,setRegDup,regIsMinor,busy,setBusy,error,setError,uiForbidden,call,openEncounter,saveAssessment,sha256Hex,askSignEncounter,signEncounter,askSignDocument,confirmSign,composeNote,consultaAdvance,saveConsultaVitals,createConsultaOrders,reloadResults,createResult,reloadRegObligations,createRegObligation,createDocument,reloadCarePlan,addCarePlanGoal,reloadImmunizations,createImmunizationInline,reloadAllergies,createAllergyInline,addConsultaProblem,proposeMed,advanceMed,printPrescription,confirmOverrideMed,confirmAckMed,pendingIrreversible,confirmIrreversible,cancelIrreversible,verifyRx,sendRx,receiveResult,advanceResult,createDoc,advanceDoc,confirmAmend,advanceDocNow,createOrder,advanceOrder,createReferral,advanceReferral,cancelReferral,createAppointment,advanceAppt,closeAppt,createDialysis,doDialysisAction,createSurgery,advanceSurgery,cancelSurgery,createTransfusion,advanceTransfusion,transfusionReaction,createWound,doWoundAction,createTriage,doTriageAction,createIncident,doIncAction,createSpecimen,advanceSpecimen,rejectSpecimen,createAdmission,doAdmAction,createConsent,doConsentAction,createClaim,doClaimAction,createPlan,doPlanAction,createVital,doVitAction,createImmunization,doImmAction,createAllergy,doAllergyAction,createProblem,doProblemAction,createObligation,advanceObligation,selectPatientRaw,loadPatients,reloadOrders,submitOrder,orderTransition,reloadAgenda,apptTransition,createAppt,loadPanel,registerPatient,guardianFields,dupPanel,openEdit,amendPatient,exportRecord,loadTimeline,reset};
}
export type WorkspaceModel=ReturnType<typeof useWorkspaceModel>;
// Valores derivados tras los retornos tempranos (sesión garantizada).
export function deriveHeader(m:Omit<WorkspaceModel,"session">&{session:MedicalSession}){
 const{tl,gaps,session,panel,view}=m;


 // Contexto de seguridad del paciente (P0/P1) para el patient header — SIEMPRE visible.
 const summary=tl?summarizePatient(tl):null;
 const highGaps=gaps?gaps.filter(g=>g.priority==="HIGH").length:0;
 const safetyChip=(n:number,label:string,tone:"crit"|"warn",icon?:React.ReactNode)=>{
  const c=tone==="crit"?{bg:"#FDEAEA",fg:P.redOnPale,bd:"#F3C9C9"}:{bg:"#FFF4E5",fg:P.amberOnPale,bd:"#F0DBB8"};
  return <span style={{display:"inline-flex",alignItems:"center",gap:6,background:c.bg,color:c.fg,border:`1px solid ${c.bd}`,borderRadius:999,padding:"4px 11px",fontSize:12.5,fontWeight:600,whiteSpace:"nowrap"}}>{icon}<b style={{fontSize:13,fontVariantNumeric:"tabular-nums"}}>{n}</b>{label}</span>;
 };
 const anyAlert=!!summary&&(highGaps>0||summary.activeAllergies>0||summary.openResults>0||summary.openObligations>0);
 // Badges del sidebar en tiempo real (conteos del paciente activo, desde datos ya cargados).
 // Auditoría 2026-09-19, anexo R05a (WS1-02) — UN CONTADOR SIN DATO NO ES UN CERO.
 // Los cuatro contadores del menú colapsaban a 0 cuando su fuente era desconocida (`tl`/`gaps` en null por carga o por
 // fallo): la insignia desaparecía y el menú afirmaba «nada pendiente» sin saberlo. `null` significa NO SE SABE y la
 // insignia lo muestra como «—»: quien lo ve entiende que tiene que abrir el módulo, no que esté al día.
 const navCounts:Record<BadgeKey,number|null>={
  agenda:tl===null?null:tl.filter(t=>t.aggregateType==="Appointment"&&(t.latestKind==="SCHEDULED"||t.latestKind==="CHECKED_IN")).length,
  resultados:summary?summary.openResults:null,
  seguimiento:gaps===null?null:gaps.length,
  obligaciones:summary?summary.openObligations:null,
 };
 // Identidad del médico (desde la sesión autenticada; fallback si el IdP no expone nombre/rol).
 const docName=(session.physicianName&&session.physicianName.trim())||"Médico tratante";
 const docRole=(session.physicianRole&&session.physicianRole.trim())||"Personal clínico";
 const docInitials=docName.replace(/^Dr\.?\s*/i,"").trim().split(/\s+/).map(w=>w[0]).slice(0,2).join("").toUpperCase()||"MD";
 const docDisplay=/^dr/i.test(docName)?docName:`Dr. ${docName}`;
 // Notificaciones (campana): pendientes críticos reales del consultorio (worklist HIGH) o del paciente.
 // WS1-02: la campana sin dato tampoco es un cero. Si la worklist no cargó y no hay contexto de paciente, es desconocido.
 const notifCount:number|null=(panel===null&&!(view==="exp"&&summary))?null
  :(panel?panel.gaps.filter(g=>g.priority==="HIGH").length:0)+(view==="exp"?highGaps+((summary?.openResults)??0):0);
 const alertGlyph=<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 3.5l9 15.5H3l9-15.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M12 10v4M12 16.5v.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round"/></svg>;
 return{summary,highGaps,safetyChip,anyAlert,navCounts,docName,docRole,docInitials,docDisplay,notifCount,alertGlyph};
}
export type WorkspaceBag=WorkspaceModel&ReturnType<typeof deriveHeader>;
