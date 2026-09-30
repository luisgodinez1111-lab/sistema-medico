// @vitest-environment jsdom
import{describe,it,expect,vi,beforeAll,afterEach}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent,within}from"@testing-library/react";
import axe from"axe-core";
// EPIC CI/CJ/CK — pruebas de RENDER (jsdom) del cockpit del expediente y de los paneles de presentación
// (Seguimiento automático, Portal del paciente, Seguridad y auditoría). Cierran la deuda de "sin render test":
// confirman en el DOM que el shell y los paneles se materializan desde datos deterministas, con semántica
// no-solo-color (estados y "Próximamente" en TEXTO) y sin violaciones de accesibilidad serias detectables.

// Datos canónicos que alimentan la auto-carga del workspace (timeline + care-gaps + snapshot + trends).
// Cuerpos de los POST que emite la UI (para afirmar QUÉ se envía, no solo que "algo" se envió).
// `gate` (revisión del porte c44dd6c, F4): retiene la respuesta de POST /vitals o de GET /patients/:id/vitals hasta que la prueba
// la suelte, para cambiar de paciente con el guardado EN VUELO.
const{posted,flags,gate}=vi.hoisted(()=>({posted:[] as {path:string;body:unknown;idem?:string;ifMatch?:number}[],flags:{hospital:false},gate:{vitalsPost:null as Promise<void>|null,vitalsHist:null as Promise<void>|null}}));
vi.mock("../../apps/web/lib/session-client",()=>({
 getStoredSession:()=>({sessionId:"testsession0001",expiresAt:Math.floor(Date.now()/1000)+3600,tokenType:"Bearer"}),
 logout:async()=>{},
 apiUpload:async()=>({status:201,body:{version:1}}),
 apiDelete:async()=>({status:200,body:{removed:true,version:1}}),
 apiDownload:async()=>null,
 apiRequest:async(path:string,init?:{method?:string;body?:unknown;idempotencyKey?:string;ifMatch?:number})=>{
  if(init?.method==="POST")posted.push({path,body:init.body,...(init.idempotencyKey?{idem:init.idempotencyKey}:{}),...(init.ifMatch!==undefined?{ifMatch:init.ifMatch}:{})});
  if(path==="/api/v1/vitals"&&init?.method==="POST"&&gate.vitalsPost)await gate.vitalsPost;
  if(/\/api\/v1\/patients\/[^/]+\/vitals$/.test(path)&&gate.vitalsHist)await gate.vitalsHist;
  if(path.includes("/api/v1/features"))return{status:200,body:{hospitalVerticals:flags.hospital}}; // verticales hospitalarias solo donde la prueba las pide
  if(path.includes("/api/v1/wounds"))return{status:201,body:{version:1}};
  if(path.includes("/api/v1/vitals")){
   // D11a: el servidor rechaza un valor (400) para probar que la UI no anuncia éxito y que el reintento no duplica.
   // Revisión (F6): «180» se guarda como CRÍTICO para probar que un crítico nunca se calla por otro rechazo.
   if(init?.method==="POST"){const v=(init.body as{value?:string}|undefined)?.value;
    if(v==="999")return{status:400,body:{error:{code:"VALIDATION_ERROR",message:"Valor fuera de rango plausible"}}};
    return{status:201,body:{version:1,status:v==="180"?"CRITICAL":"NORMAL",interpretation:v==="180"?"Taquicardia extrema":""}};}
   // Lote E — GET clínica-wide: registro POBLACIONAL de signos vitales
   return{status:200,body:{items:[
    {vitalId:"v1",patientId:"p1",patientName:"Ana López García",vitalType:"BP",vitalTypeLabel:"Presión arterial",value:"180/110",unit:"mmHg",status:"CRITICAL",critical:true,interpretation:"Crisis hipertensiva",recordedAt:"2026-09-17T10:00:00.000Z"},
    {vitalId:"v2",patientId:"p2",patientName:"Carlos Mendoza",vitalType:"HR",vitalTypeLabel:"Frecuencia cardíaca",value:"72",unit:"lpm",status:"NORMAL",critical:false,interpretation:"",recordedAt:"2026-09-16T09:00:00.000Z"},
   ],nextCursor:null,total:2,criticalCount:1,abnormalCount:0,patientsCount:2}};
  }
  if(path.includes("/api/v1/care-plans")){
   if(init?.method==="POST")return{status:201,body:{version:1}};
   // Lote E — GET clínica-wide: registro POBLACIONAL de planes de cuidado
   return{status:200,body:{items:[
    {carePlanId:"cp1",patientId:"p1",patientName:"Ana López García",category:"DIABETES",categoryLabel:"Diabetes",goal:"HbA1c < 7% en 3 meses",status:"ACTIVE",statusLabel:"Activo",proposedAt:"2026-09-10T10:00:00.000Z"},
    {carePlanId:"cp2",patientId:"p2",patientName:"Carlos Mendoza",category:"HYPERTENSION",categoryLabel:"Hipertensión",goal:"TA < 130/80",status:"ON_HOLD",statusLabel:"En pausa",proposedAt:"2026-09-05T09:00:00.000Z"},
   ],nextCursor:null,total:2,activeCount:1,onHoldCount:1,achievedCount:0,patientsCount:2}};
  }
  // U-19: PRESCRIBE con bloqueo ANULABLE (alergia) -> 403 con qué se puede anular; con la anulación nombrada -> 201.
  if(path.endsWith("/prescription")&&init?.method==="POST"){
   const b=init.body as{overrideBarriers?:string[];overrideJustification?:string};
   if(!b.overrideBarriers)return{status:403,body:{error:{code:"SAFETY_BLOCKED",message:"Cannot prescribe: Alergia activa a penicilina (clase) — anulable solo bajo responsabilidad del médico",details:{barriers:["allergy"],hard:[],overridable:["allergy"],missing:["allergy"]}}}};
   return{status:201,body:{version:2}};
  }
  if(path.includes("/api/v1/medications"))return{status:201,body:{version:1}}; // proponer/activar/suspender (U-16)
  if(path.match(/\/api\/v1\/documents\/[^/]+$/))return{status:200,body:{documentId:"dc1",patientId:"p1",title:"Nota de evolución",docType:"PROGRESS_NOTE",typeLabel:"Nota médica",content:"Paciente estable. Continúa tratamiento.",state:"SIGNED",statusLabel:"Firmado",version:3,createdAt:"2026-09-17T00:00:00Z",addenda:[],signature:{authorId:"u1",contentHash:"a".repeat(64),signatureDigest:"b".repeat(64),signedAt:"2026-09-17T01:00:00Z"},attachments:[{attachmentId:"at1",filename:"laboratorio.pdf",mime:"application/pdf",size:23456,pathname:"tenants/t/documents/dc1/at1.pdf",contentHash:"c".repeat(64),authorId:"u1",attachedAt:"2026-09-17T02:00:00Z"}]}};
  if(path.includes("/api/v1/documents"))return{status:201,body:{version:1}};
  if(path.includes("/api/v1/referrals")){
   if(init?.method==="POST")return{status:201,body:{version:1}};
   // Lote G — GET clínica-wide: registro POBLACIONAL de interconsultas + directorio de destinatarios
   return{status:200,body:{items:[
    {referralId:"rf1",patientId:"p1",patientName:"Ana López García",specialty:"Cardiología",reason:"Soplo",recipientName:"Dra. Ruiz",recipientInstitution:"Hospital Ángeles",priority:"Urgente (48–72 h)",referralType:"Primera vez",status:"REQUESTED",statusLabel:"Solicitada",requestedAt:"2026-09-15T10:00:00.000Z"},
    {referralId:"rf2",patientId:"p2",patientName:"Carlos Mendoza",specialty:"Nefrología",reason:"ERC",recipientName:"",recipientInstitution:"",priority:"Rutina (4–8 semanas)",referralType:"Subsecuente",status:"COMPLETED",statusLabel:"Completada",requestedAt:"2026-09-10T09:00:00.000Z"},
   ],nextCursor:null,total:2,openCount:1,completedCount:1,patientsCount:2,recipientsCount:1,directory:[{name:"Dra. Ruiz",specialty:"Cardiología",institution:"Hospital Ángeles",count:1}]}};
  }
  if(path.includes("/assessment"))return{status:201,body:{version:2}};
  if(path.includes("/signature"))return{status:201,body:{version:3,signatureDigest:"a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"}};
  if(path.includes("/api/v1/encounters"))return{status:201,body:{version:1}};
  if(path.includes("/api/v1/orders"))return{status:200,body:{
   items:[
    {orderId:"od1",patientId:"p1",patientName:"Ana López García",orderType:"LAB",typeLabel:"Laboratorio",detail:"Biometría hemática completa",status:"Completada",createdAt:"2026-09-17T00:00:00Z",version:3},
    {orderId:"od2",patientId:"p2",patientName:"Carlos Mendoza",orderType:"IMAGING",typeLabel:"Imagenología",detail:"Radiografía de tórax",status:"Solicitada",createdAt:"2026-09-16T00:00:00Z",version:1},
   ],total:2,solicitadas:1,enviadas:0,completadas:1}};
  if(path.includes("/amendment"))return{status:201,body:{version:2}};
  if(path.includes("/api/v1/appointments")){const d=new Date().toISOString().slice(0,10);return{status:200,body:{date:d,appointments:[
   {appointmentId:"ap1",patientId:"p1",patientName:"Ana López García",startAt:`${d}T09:00:00.000Z`,endAt:`${d}T09:30:00.000Z`,reason:"Control DM2",consultorio:"Consultorio 1",apptType:"CONTROL",status:"SCHEDULED",version:1},
   {appointmentId:"ap2",patientId:"p2",patientName:"Carlos Mendoza",startAt:`${d}T10:00:00.000Z`,endAt:`${d}T10:30:00.000Z`,reason:"Radiografía de control",consultorio:"Consultorio 2",apptType:"PROCEDIMIENTO",status:"CHECKED_IN",version:2},
  ],counts:{programadas:2,atendidas:0,enEspera:1,canceladas:0}}};}
  if(path.includes("/api/v1/patients")&&!path.match(/patients\//))return{status:200,body:{patients:[
   {patientId:"p1",name:"Ana López García",status:"ACTIVE",birthDate:"1990-01-01",sexAtBirth:"FEMALE",curp:"LOGA900101MDFPRN08",version:1},
   {patientId:"p2",name:"Carlos Mendoza",status:"ACTIVE",birthDate:"1970-01-01",sexAtBirth:"MALE",version:1},
  ]}};
  if(path.includes("/api/v1/worklist"))return{status:200,body:{gaps:[{patientId:"p1",aggregateType:"DiagnosticResult",aggregateId:"r1",code:"K",label:"Resultado crítico sin cerrar",priority:"HIGH"}],patientCount:2}};
  if(path.includes("/api/v1/results"))return{status:200,body:{
   items:[
    {resultId:"r1",patientId:"p1",patientName:"Ana López García",analyte:"GLUCOSE",value:"520",critical:true,status:"CRITICAL",interpretation:"Hiperglucemia de pánico",tipo:"Laboratorio",estado:"Hallazgos",lifecycle:"RECEIVED",superseded:false,receivedAt:"2026-09-17T00:00:00Z"},
    {resultId:"r2",patientId:"p2",patientName:"Carlos Mendoza",analyte:"CREATININE",value:"0.9",critical:false,status:"NORMAL",interpretation:"Normal",tipo:"Laboratorio",estado:"En seguimiento",lifecycle:"ACTIONED",superseded:false,receivedAt:"2026-09-16T00:00:00Z"},
   ],total:2,abnormal:1,enSeguimiento:1,pendientes:1}};
  if(path.includes("/api/v1/reports"))return{status:200,body:{patientsAttended:248,income:124680,diagnosesTotal:159,topDiagnoses:[{code:"E11.9",description:"Diabetes mellitus tipo 2",count:42,pct:13},{code:"I10",description:"Hipertensión esencial",count:38,pct:12}],ordersTotal:24,ordersByType:[{type:"LAB",label:"Laboratorio",count:14,pct:58},{type:"IMAGING",label:"Imagenología",count:6,pct:25},{type:"PROCEDURE",label:"Procedimiento",count:4,pct:17}],topProcedures:[{detail:"Electrocardiograma",count:3,pct:75},{detail:"Curación simple",count:1,pct:25}],resultsTotal:37,immunizationsApplied:12,encountersTotal:221,encountersSigned:198,encountersByDay:[{date:"2026-09-01",count:12,pct:80},{date:"2026-09-02",count:15,pct:100}],prescriptionsTotal:64,topMedications:[{drugCode:"paracetamol",count:22,pct:34},{drugCode:"metformina",count:14,pct:22}],appointmentsTotal:120,appointmentsByType:[{type:"CONTROL",label:"Control",count:54,pct:45},{type:"PRIMERA_VEZ",label:"Primera vez",count:30,pct:25},{type:"VACUNACION",label:"Vacunación",count:20,pct:17}],qualityIndicators:[{key:"closed_records",label:"Expedientes cerrados (notas firmadas)",numerator:198,denominator:221,excluded:0,pct:90,target:90,direction:"higher",met:true,computable:true,note:""},{key:"attendance",label:"Asistencia efectiva",numerator:96,denominator:120,excluded:0,pct:80,target:80,direction:"higher",met:true,computable:true,note:""},{key:"no_show",label:"Inasistencia (no-show)",numerator:18,denominator:120,excluded:0,pct:15,target:10,direction:"lower",met:false,computable:true,note:""},{key:"glycemic_control",label:"HbA1c en control (<7%)",numerator:0,denominator:0,excluded:0,pct:0,target:70,direction:"higher",met:false,computable:false,note:""}]}};
  if(path.includes("/api/v1/physician-profile/credentials"))return{status:201,body:{version:1}};
  if(path.includes("/api/v1/physician-profile"))return{status:200,body:{signature:null,stamp:null,credentials:null,version:0}};
  if(path.includes("/api/v1/office-settings"))return{status:200,body:{settings:{officeName:"",specialty:"",rfc:"",cedula:"",address:"",phone:"",email:"",timezone:"",language:"es",color:"#6C5CF6",theme:"Claro",fontSize:"Normal",realtimeAlerts:true,followupReminders:true,showInteractions:true,darkMode:false,schedule:[{day:"Lunes",open:true,from:"08:00",to:"15:00"},{day:"Martes",open:true,from:"08:00",to:"15:00"},{day:"Miércoles",open:true,from:"08:00",to:"15:00"},{day:"Jueves",open:true,from:"08:00",to:"15:00"},{day:"Viernes",open:true,from:"08:00",to:"15:00"},{day:"Sábado",open:true,from:"08:00",to:"13:00"},{day:"Domingo",open:false,from:"",to:""}],modules:{Pacientes:true,Agenda:true,Consulta:true,Resultados:true,"Órdenes":true,Interconsultas:true,Seguimiento:true,"Facturación":true,Documentos:true,Obligaciones:true,"Clinical Intelligence":true,Reportes:true,"Biblioteca clínica":true},prefRecordView:"Resumen clínico",prefNoteTemplate:"Consulta general (SOAP)",prefUnits:"Métrico (kg, cm)",prefDoseCalc:"Pediátrica y adultos",regCountry:"México",regState:"",regCity:"",regPostalCode:"",regDateFormat:"dd/mm/aaaa",regTimeFormat:"24 horas",regCurrency:"MXN",regTaxRate:"16"},version:0}};
  if(path.includes("/api/v1/regulatory-obligations"))return{status:200,body:{
   items:[
    {obligationId:"o1",name:"Declaración mensual de IVA",category:"Fiscal (SAT)",periodicity:"Mensual",dueDate:"2026-09-20T00:00:00Z",estado:"Próxima",daysUntil:5},
    {obligationId:"o2",name:"Pago de IMSS",category:"Laboral",periodicity:"Mensual",dueDate:"2026-08-01T00:00:00Z",estado:"Vencida",daysUntil:-40},
   ],total:2,alDia:0,proximas:1,vencidas:1,compliance:{["Fiscal (SAT)"]:100,Laboral:0}}};
  if(path.includes("/api/v1/claims"))return{status:200,body:{
   items:[
    {claimId:"cl1",folio:"F-000002",patientId:"p1",patientName:"Ana López García",amount:500,currency:"MXN",status:"PAID",statusLabel:"Pagada",recordedAt:"2026-09-17T00:00:00Z"},
    {claimId:"cl2",folio:"F-000001",patientId:"p2",patientName:"Mateo Ramírez",amount:1200,currency:"MXN",status:"PENDING",statusLabel:"Pendiente",recordedAt:"2026-09-16T00:00:00Z"},
   ],total:2,incomeThisMonth:500,issuedCount:2,pendingCount:1,pendingAmount:1200,cancellations:0}};
  if(path.includes("/api/v1/immunizations"))return{status:200,body:{
   items:[
    {immunizationId:"i1",patientId:"p1",patientName:"Ana López García",vaccine:"Influenza",dose:"1/1",lot:"A3F2K",site:"Brazo izquierdo",status:"COMPLETE",statusLabel:"Completa",appliedAt:"2026-09-17T00:00:00Z",registeredBy:"actor1"},
    {immunizationId:"i2",patientId:"p2",patientName:"Mateo Ramírez",vaccine:"SRP",dose:"1/2",lot:"",site:"",status:"PENDING",statusLabel:"Pendiente",appliedAt:"2026-09-16T00:00:00Z",registeredBy:"actor1"},
    {immunizationId:"i3",patientId:"p3",patientName:"Carlos Mendoza",vaccine:"Neumococo 13V",dose:"1/1",lot:"P7H8L",site:"Brazo derecho",status:"COMPLETE",statusLabel:"Completa",appliedAt:"2026-09-14T00:00:00Z",registeredBy:"actor1"},
   ],total:3,appliedCount:2,pendingCount:1,vaccinatedPatients:2,incompleteSchemes:1,byVaccine:{Influenza:1,["Neumococo 13V"]:1}}};
  if(path.includes("/api/v1/problems"))return{status:200,body:{
   items:[
    {problemId:"q1",patientId:"p1",patientName:"Ana López García",code:"E11.9",description:"Diabetes mellitus tipo 2",category:"Endocrinológicos",chronic:false,status:"ACTIVE",statusLabel:"Activo",recordedAt:"2026-09-15T00:00:00Z",registeredBy:"actor1"},
    {problemId:"q2",patientId:"p2",patientName:"Carlos Mendoza",code:"J45.9",description:"Asma",category:"Respiratorios",chronic:true,status:"CHRONIC",statusLabel:"En seguimiento",recordedAt:"2026-09-05T00:00:00Z",registeredBy:"actor1"},
    {problemId:"q3",patientId:"p3",patientName:"María Torres",code:"K29.7",description:"Gastritis",category:"Digestivos",chronic:false,status:"RESOLVED",statusLabel:"Resuelto",recordedAt:"2026-08-20T00:00:00Z",registeredBy:"actor1"},
   ],total:3,byStatus:{activos:1,enSeguimiento:1,resueltos:1,inactivos:0},byCategory:{Endocrinológicos:1,Respiratorios:1,Digestivos:1},topPatients:[{name:"Ana López García",count:1},{name:"Carlos Mendoza",count:1}]}};
  if(path.includes("/api/v1/allergies"))return{status:200,body:{
   items:[
    {allergyId:"a1",patientId:"p1abc123",patientName:"Ana López García",substance:"Penicilina",type:"Medicamento",reaction:"Urticaria generalizada",severity:"SEVERE",severityLabel:"Grave",status:"ACTIVE",statusLabel:"Activa",recordedAt:"2024-03-12T10:15:00Z",registeredBy:"actor1"},
    {allergyId:"a2",patientId:"p2abc123",patientName:"Carlos Mendoza",substance:"Ibuprofeno (AINE)",type:"Medicamento",reaction:"Broncoespasmo",severity:"SEVERE",severityLabel:"Grave",status:"ACTIVE",statusLabel:"Activa",recordedAt:"2024-04-18T12:40:00Z",registeredBy:"actor1"},
    {allergyId:"a3",patientId:"p3abc123",patientName:"María Torres",substance:"Mariscos",type:"Alimento",reaction:"Anafilaxia",severity:"MODERATE",severityLabel:"Moderada",status:"ACTIVE",statusLabel:"Activa",recordedAt:"2024-04-22T16:05:00Z",registeredBy:"actor1"},
   ],total:3,patientsWithAllergies:3,bySeverity:{grave:2,moderada:1,leve:0,incierta:0},byType:{Medicamento:2,Alimento:1,Ambiental:0,Contraste:0,Otros:0},activeCount:3}};
  if(path.includes("/interactions"))return{status:200,body:{
   findings:[
    {kind:"pair",severity:"MAJOR",severityLabel:"Mayor",a:"sertralina",b:"ibuprofeno",mechanism:"Inhibición serotoninérgica de la agregación plaquetaria + gastroerosión.",recommendation:"Preferir paracetamol; gastroprotección si el AINE es necesario."},
    {kind:"factor",severity:"MODERATE",severityLabel:"Moderada",a:"metformina",b:"Insuficiencia renal",mechanism:"Disminución de la eliminación renal: acumulación.",recommendation:"Ajustar dosis según TFGe."},
   ],
   counts:{CONTRAINDICATED:0,MAJOR:1,MODERATE:1,MINOR:0},highestSeverity:"MAJOR",highestSeverityLabel:"Mayor",
   resolvedDrugs:[],resolvedFactors:[],unresolvedDrugs:[],unresolvedFactors:[]}};
  if(path.includes("/consultation-snapshot"))return{status:200,body:{registered:true,
   demographics:{age:54,sex:"FEMALE",birthDate:"1971-01-01"},problems:["E11.9","I10","N18.3"],allergies:["penicilina"],
   vitals:{BP:"128/78",HR:"72"},labs:{hba1c:7.1,creatinine:1.3,glucose:112,ldl:98,egfr:48,egfrStage:"G3a"},
   findings:[{domain:"renal",severity:"WARNING",summary:"ERC G3a (TFG 48): vigilar dosis renales"},{domain:"glucémico",severity:"INFO",summary:"HbA1c por encima del objetivo <7%"}]}};
  if(path.includes("/trends"))return{status:200,body:{series:{HBA1C:[{value:8.2,at:"2024-01-15T00:00:00Z"},{value:7.1,at:"2024-06-15T00:00:00Z"}],GLUCOSE:[],LDL:[],CREATININE:[]},latest:{LDL:98,CREATININE:1.3,UACR:45,EGFR:48}}};
  if(path.includes("/care-gaps"))return{status:200,body:{gaps:[{aggregateType:"Immunization",aggregateId:"g1",code:"FLU",label:"Vacuna influenza pendiente",priority:"HIGH"}]}};
  if(path.includes("/timeline"))return{status:200,body:{items:[
   {aggregateType:"Encounter",aggregateId:"e1",latestKind:"SIGNED",version:3,lastAt:new Date(Date.now()-720000).toISOString()},
   {aggregateType:"Medication",aggregateId:"m1",latestKind:"ACTIVATED",version:2,lastAt:new Date(Date.now()-2400000).toISOString()},
   {aggregateType:"ClinicalObligation",aggregateId:"o1",latestKind:"OPEN",version:1,lastAt:new Date(Date.now()-3600000).toISOString()},
   {aggregateType:"Appointment",aggregateId:"a1",latestKind:"SCHEDULED",version:1,lastAt:new Date().toISOString()},
   {aggregateType:"DiagnosticResult",aggregateId:"r1",latestKind:"VERIFIED",version:2,lastAt:new Date(Date.now()-100000).toISOString()},
  ]}};
  // Lote H — export del expediente: manifiesto reproducible + hash (el cliente lo descarga como archivo)
  if(path.includes("/export"))return{status:200,body:{manifest:{patientId:"p1",aggregateCount:3,eventCount:7,aggregates:[]},contentHash:"a1b2c3hashdeprueba",generatedAt:"2026-09-20T00:00:00.000Z"}};
  return{status:404,body:{}};
 },
}));

import Workspace from"../../apps/web/app/workspace/page";

beforeAll(()=>{
 // jsdom no implementa estas APIs que el cockpit usa (scrollspy / navegación por scroll).
 (globalThis as unknown as{IntersectionObserver:unknown}).IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}takeRecords(){return[];}};
 window.scrollTo=()=>{};
 Element.prototype.scrollIntoView=()=>{};
});
afterEach(cleanup);
afterEach(()=>{gate.vitalsPost=null;gate.vitalsHist=null;});
// jsdom comparte window.location entre tests del mismo archivo; el deep-link (?p=&v=) de un test contaminaría
// al siguiente. Reseteamos la URL tras cada test (en producción cada carga tiene su propia URL).
afterEach(()=>{try{window.history.replaceState(null,"","/");}catch{/* noop */}});

const noSeriousAxe=async(node:Element,label:string)=>{
 const r=await axe.run(node,{resultTypes:["violations"]});
 const serious=r.violations.filter(v=>v.impact==="critical"||v.impact==="serious").map(v=>v.id);
 expect(serious,`${label} — violaciones serias: ${JSON.stringify(serious)}`).toEqual([]);
};

// Consulta ahora abre un PANEL de consultas; el workspace clínico se abre eligiendo un paciente e "Abrir consulta".
const abrirConsulta=async()=>{fireEvent.click(screen.getByRole("button",{name:"Consulta"}));const input=await screen.findByLabelText("Buscar paciente");fireEvent.change(input,{target:{value:"Ana"}});const open=await screen.findByRole("button",{name:/Ana López García/},{timeout:2000});fireEvent.click(open);};

// Al montar, el workspace abre la vista Inicio (dashboard del consultorio). Para probar los paneles del
// EXPEDIENTE, cambiamos a esa vista pulsando un acceso del sidebar (p.ej. "Pacientes").
// Todos los accesos del sidebar son ahora vistas de nivel-sistema; al expediente crudo (cockpit) se llega
// con el botón "Ver expediente →" de la barra del paciente de un módulo (aquí: Signos vitales).
// U-12: ya no hay paciente por defecto (antes un UUID aleatorio disparaba cargas a un paciente inexistente): se elige uno.
const elegirPaciente=async()=>{const opt=await screen.findByRole("option",{name:"Ana López García"});fireEvent.change(opt.closest("select")!,{target:{value:"p1"}});};
const toExpediente=async()=>{fireEvent.click(screen.getByRole("button",{name:"Signos vitales"}));await elegirPaciente();fireEvent.click(screen.getByRole("button",{name:/Ver expediente/}));};

describe("Cockpit del expediente + paneles de presentación (jsdom)",()=>{
 it("shell: sidebar índigo con navegación primaria (19 accesos + herramientas) + buscador global + perfil del médico",async()=>{
  render(<Workspace/>);
  expect(screen.getByRole("button",{name:/Inicio/})).toBeTruthy();
  expect(screen.getByRole("button",{name:/Pacientes/})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Clinical Intelligence"})).toBeTruthy();
  expect(screen.getByRole("button",{name:/Configuración/})).toBeTruthy();   // sección HERRAMIENTAS
  expect(screen.getByRole("button",{name:/Contraer menú/})).toBeTruthy();    // colapsar
  expect(screen.getAllByText(/Médico tratante/).length).toBeGreaterThan(0);  // perfil del médico (fallback)
  expect(screen.getByPlaceholderText(/Buscar paciente por nombre/)).toBeTruthy();
 });

 it("vista Inicio (dashboard del consultorio) se materializa al montar",async()=>{
  render(<Workspace/>);
  expect(screen.getByRole("heading",{name:"Inicio"})).toBeTruthy();
  expect(screen.getByText(/resumen de hoy/)).toBeTruthy();
  expect(screen.getByText(/Tareas clínicas prioritarias/)).toBeTruthy();
  expect(screen.getByText("Agenda de hoy")).toBeTruthy();
  expect(screen.getByText("Pacientes recientes")).toBeTruthy();
 });

 it("vista Inicio: KPIs derivados de la agenda real + tarea que abre la Consulta del paciente",async()=>{
  render(<Workspace/>);
  // KPIs derivados de la agenda real (no hardcodeados)
  expect(await screen.findByText("Citas de hoy")).toBeTruthy();
  expect(screen.getByText("Consultas atendidas")).toBeTruthy();
  // la tarea real del worklist lleva patientId -> al hacer clic abre la Consulta de ese paciente (interconexión)
  // WS1-01: ese mismo pendiente aparece ahora también en «Avisos del consultorio» (antes eran tres mensajes inventados),
  // así que la consulta se acota al widget de tareas en vez de buscar el texto en toda la pantalla.
  const tareas=(await screen.findByRole("heading",{name:/Tareas clínicas prioritarias/})).closest("div")!.parentElement!;
  const task=within(tareas).getByText("Resultado crítico sin cerrar");
  fireEvent.click(task);
  expect(screen.getByRole("heading",{name:"Consulta"})).toBeTruthy();
 });

 it("vista Consulta: es un PANEL (citas de hoy + iniciar nueva consulta), no abre el último px directo",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Consulta"}));
  // panel del día, NO el workspace de un paciente
  expect(screen.getByRole("heading",{name:"Consultas"})).toBeTruthy();
  expect(await screen.findByText("Iniciar nueva consulta")).toBeTruthy();
  expect(screen.getAllByText(/Citas de hoy/).length).toBeGreaterThan(0);
  expect(screen.queryByText("1. Motivo de consulta")).toBeNull(); // aún no hay consulta abierta
  // abrir la consulta de una cita del día -> entra al workspace del paciente
  fireEvent.click(screen.getAllByRole("button",{name:"Abrir"})[0]!);
  expect(await screen.findByText("1. Motivo de consulta")).toBeTruthy();
 });

 it("vista Consulta (workspace clínico) con las 7 pestañas + formulario",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  expect(screen.getByRole("heading",{name:"Consulta"})).toBeTruthy();
  expect(screen.getByText("1. Motivo de consulta")).toBeTruthy();
  expect(screen.getAllByText("Signos vitales").length).toBeGreaterThan(0); // panel + acceso del sidebar
  expect(screen.getByText("Resumen clínico")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Consulta actual/})).toBeTruthy(); // pestaña
  expect(screen.getAllByRole("button",{name:/Plan de cuidados/}).length).toBeGreaterThan(1); // sidebar + pestaña
  // pestañas por paciente cableadas (sin paciente en contexto: encabezado + estado vacío honesto).
  // "Resultados/Medicamentos/Seguimiento" existen en sidebar y como pestaña -> la pestaña es la última coincidencia.
  const lastTab=(name:RegExp)=>{const bs=screen.getAllByRole("button",{name});return bs[bs.length-1]!;};
  fireEvent.click(lastTab(/^Resultados$/));
  expect(await screen.findByText(/Resultados del paciente/)).toBeTruthy(); // espera a que el snapshot cargue (skeleton→contenido)
  fireEvent.click(lastTab(/^Medicamentos$/));
  expect(await screen.findByText(/Medicamentos activos/)).toBeTruthy();
  fireEvent.click(lastTab(/^Seguimiento$/));
  expect(await screen.findByText(/Tareas de seguimiento/)).toBeTruthy();
 });

 it("vista Órdenes: cableada a /api/v1/orders — KPIs reales, lista, detalle vivo y creador funcional",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Órdenes"}));
  expect(await screen.findByRole("heading",{name:"Órdenes"})).toBeTruthy();
  // KPIs derivados del registro real (2 totales, 1 solicitada, 1 completada)
  expect(await screen.findByText("Órdenes totales")).toBeTruthy();
  expect(screen.getByText("Solicitadas")).toBeTruthy();
  expect(screen.getByText("Completadas")).toBeTruthy();
  // filas del registro (paciente + estudio + estado en TEXTO); aparece en la fila y en el detalle -> AllByText
  expect((await screen.findAllByText("Biometría hemática completa")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Radiografía de tórax").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Completada").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Solicitada").length).toBeGreaterThan(0);
  // seleccionar una orden Solicitada muestra el detalle con su acción real de transición
  fireEvent.click(screen.getAllByText("Radiografía de tórax")[0]!);
  expect(screen.getByText(/Enviar al laboratorio/)).toBeTruthy(); // acción placement disponible en estado Solicitada
  expect(screen.getAllByText("Seguimiento").length).toBeGreaterThan(0); // "Seguimiento" (detalle) + acceso del sidebar
  // el botón "+ Nueva orden" abre el creador con la secuencia de opciones (paciente + tipo + sugerencias)
  fireEvent.click(screen.getByRole("button",{name:"+ Nueva orden"}));
  expect(screen.getByText("Nueva orden clínica")).toBeTruthy();
  expect(screen.getByText("Tipo de estudio")).toBeTruthy();
  expect(screen.getByText("Perfil lipídico")).toBeTruthy(); // sugerencia de laboratorio (cada opción rellena el estudio)
  // la distribución "Órdenes por tipo" es REAL (deriva del registro), no una dona de ejemplo
  expect(screen.getByText("Órdenes por tipo")).toBeTruthy();
  expect(screen.queryByText(/Sin órdenes registradas/)).toBeNull(); // hay órdenes reales en el mock
 });

 it("vista Medicamentos: catálogo determinista real (drug-catalog) con detalle y pestaña Alertas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Medicamentos"}));
  expect(await screen.findByRole("heading",{name:"Medicamentos"})).toBeTruthy();
  expect(screen.getByText("Principios activos")).toBeTruthy();       // KPI real (nº del catálogo)
  expect(screen.getByText("Con monitoreo obligado")).toBeTruthy();   // KPI real
  expect(screen.getByText("Reglas de interacción")).toBeTruthy();    // KPI real
  // filas reales del catálogo (principio activo)
  expect(screen.getByText("metformina")).toBeTruthy();
  expect(screen.getByText("losartan")).toBeTruthy();
  // clic en una fila abre su detalle con reglas reales (monitoreo/renal)
  fireEvent.click(screen.getByText("metformina"));
  expect(screen.getAllByText(/Monitoreo obligado/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Función renal/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Prescribir/).length).toBeGreaterThan(0); // acción de interconexión al expediente
  // pestaña Alertas: matriz de interacciones por clase (motor determinista real)
  fireEvent.click(screen.getByRole("button",{name:/Alertas/}));
  expect(screen.getByText(/Interacciones por clase/)).toBeTruthy();
  expect(screen.getByText(/Vigilancia obligada/)).toBeTruthy();
  expect(screen.getAllByText("ANTICOAGULANT").length).toBeGreaterThan(0); // clase real de la matriz
 });

 it("vista Agenda: citas reales cableadas, navegación de fecha, detalle con ciclo de vida y nueva cita",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Agenda\b/}));
  expect(await screen.findByRole("heading",{name:"Agenda"})).toBeTruthy();
  // citas reales del registro (aparecen en la rejilla y en "Próximas citas")
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
  // Lote F — Sala de espera: Carlos está CHECKED_IN, aparece en espera con acción real de atención
  expect(screen.getByText("Sala de espera")).toBeTruthy();
  expect(screen.getByText("1 en espera")).toBeTruthy();
  expect(screen.getAllByText("Atender →").length).toBeGreaterThan(0);
  // la rejilla ya NO muestra citas de ejemplo inventadas (auditoría: cero datos ficticios)
  expect(screen.queryByText("Juan Pérez García")).toBeNull();
  expect(screen.queryByText("Sofía Vega Ramírez")).toBeNull();
  // seleccionar la cita programada muestra su detalle con la acción real de ciclo de vida
  fireEvent.click(screen.getAllByText("Ana López García")[0]!);
  expect(screen.getByText("Detalle de la cita")).toBeTruthy();
  expect(screen.getByText("Registrar llegada")).toBeTruthy(); // transición check-in (estado SCHEDULED)
  // "+ Nueva cita" abre el creador real (paciente + hora + tipo + motivo)
  fireEvent.click(screen.getByRole("button",{name:"+ Nueva cita"}));
  expect(screen.getByText(/Nueva cita ·/)).toBeTruthy();
  expect(screen.getByText("Tipo de cita")).toBeTruthy();
  // vista Lista de citas: tabla real del día
  fireEvent.click(screen.getByText("Lista de citas"));
  expect(screen.getAllByText("Control DM2").length).toBeGreaterThan(0);
 });

 it("vista Agenda (Lote F): Semana y Mes son vistas reales cableadas a datos, ya no 'Próximamente'",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Agenda\b/}));
  await screen.findByRole("heading",{name:"Agenda"});
  // Semana: la pastilla ya no está deshabilitada; muestra la rejilla semanal con la cita real y su resumen.
  fireEvent.click(screen.getByText("Vista semanal"));
  expect(await screen.findByText("Resumen de la semana")).toBeTruthy();
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0);
  // Mes: la pastilla ya no está deshabilitada; muestra la rejilla mensual con su resumen.
  fireEvent.click(screen.getByText("Vista mensual"));
  expect(await screen.findByText("Resumen del mes")).toBeTruthy();
 });

 it("vista Pacientes: lista real, búsqueda filtra, y la ficha es contextual (sólo al seleccionar)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Pacientes"}));
  expect(screen.getByRole("heading",{name:"Pacientes"})).toBeTruthy();
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
  // la ficha NO existe hasta seleccionar (sin botón Editar todavía)
  expect(screen.queryByRole("button",{name:"Editar"})).toBeNull();
  // la búsqueda filtra en vivo
  fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre o CURP/),{target:{value:"Carlos"}});
  expect(screen.queryByText("Ana López García")).toBeNull();
  fireEvent.click(screen.getByText("Limpiar filtros"));
  // seleccionar el paciente abre su FICHA contextual (nombre + Editar + pestañas)
  fireEvent.click((await screen.findAllByText("Ana López García"))[0]!);
  expect(await screen.findByRole("button",{name:"Editar"})).toBeTruthy();
  expect(screen.getByText("Información general")).toBeTruthy();
 });

 it("vista Pacientes: ficha con pestañas en sitio (Historial), Agendar cita y edición real (POST amendment)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Pacientes"}));
  fireEvent.click((await screen.findAllByText("Ana López García"))[0]!); // abre la ficha
  await screen.findByRole("button",{name:"Editar"});
  // pestaña Historial se despliega EN LA MISMA ficha (no navega)
  fireEvent.click(screen.getByText("Historial"));
  expect(screen.getByText(/Historial del expediente/)).toBeTruthy();
  expect(screen.getByRole("heading",{name:"Pacientes"})).toBeTruthy(); // sigue en Pacientes (no abrió otra vista)
  fireEvent.click(screen.getByText("Resumen")); // volver a Resumen
  // Editar → formulario con datos reales → guardar (POST amendment)
  fireEvent.click(screen.getByRole("button",{name:"Editar"}));
  expect(screen.getByText("Editar ficha del paciente")).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Guardar cambios"}));
  expect(await screen.findByText(/Ficha del paciente actualizada/)).toBeTruthy();
  // Agendar cita desde la ficha interconecta con Agenda
  fireEvent.click(screen.getByRole("button",{name:"Agendar cita"}));
  expect(await screen.findByRole("heading",{name:"Agenda"})).toBeTruthy();
  expect(screen.getByText(/Nueva cita ·/)).toBeTruthy();
 });

 it("vista Consulta: la documentación impulsa el encuentro REAL (abrir → valorar → firmar)",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  // con paciente en contexto y sin encuentro, la acción primaria abre el encuentro
  expect(screen.getByRole("button",{name:"Abrir encuentro"})).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText("Motivo de la consulta…"),{target:{value:"Cefalea de 3 días"}});
  fireEvent.click(screen.getByRole("button",{name:"Abrir encuentro"}));
  // OPEN: badge + siguiente paso (guardar valoración)
  expect(await screen.findByRole("button",{name:"Guardar valoración"})).toBeTruthy();
  expect(screen.getByText(/Encuentro · Abierta/)).toBeTruthy();
  // guardar valoración → READY_TO_SIGN → firmar
  fireEvent.click(screen.getByRole("button",{name:"Guardar valoración"}));
  expect(await screen.findByRole("button",{name:"Firmar consulta"})).toBeTruthy();
  expect(screen.getAllByText(/Lista para firmar/).length).toBeGreaterThan(0);
  // Auditoría L-03/U-06: "Firmar consulta" NO firma; abre la confirmación con el texto GUARDADO y su huella.
  fireEvent.click(screen.getByRole("button",{name:"Firmar consulta"}));
  const dlg=await screen.findByRole("alertdialog");
  expect(dlg.textContent).toMatch(/MOTIVO DE CONSULTA: Cefalea de 3 días/);   // el médico ve lo que firma
  expect(dlg.textContent).toMatch(/inmutable/);expect(dlg.textContent).toMatch(/SHA-256\): [0-9a-f]{64}/);
  expect(screen.queryByText(/Encuentro · Firmada/)).toBeNull();                 // aún NO está firmado
  // firma real (registro inmutable) → estado SIGNED; la huella del contenido mostrado viaja al servidor
  fireEvent.click(screen.getByRole("button",{name:"Firmar definitivamente"}));
  expect(await screen.findByText(/Encuentro · Firmada/)).toBeTruthy();
  expect(screen.getAllByText(/Consulta firmada/).length).toBeGreaterThan(0);
  expect(screen.queryByRole("alertdialog")).toBeNull();
  const signed=posted.filter(p=>p.path.endsWith("/signature")).at(-1)?.body as {contentHash?:string}|undefined;
  expect(signed?.contentHash).toMatch(/^[0-9a-f]{64}$/);
 });
 it("vista Consulta: si el formulario cambia tras guardar, se GUARDA DE NUEVO antes de firmar (nunca se firma una versión anterior)",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  fireEvent.change(screen.getByPlaceholderText("Motivo de la consulta…"),{target:{value:"Cefalea de 3 días"}});
  fireEvent.click(screen.getByRole("button",{name:"Abrir encuentro"}));
  fireEvent.click(await screen.findByRole("button",{name:"Guardar valoración"}));
  await screen.findByRole("button",{name:"Firmar consulta"});
  const before=posted.filter(p=>p.path.endsWith("/assessment")).length;
  fireEvent.change(screen.getByPlaceholderText("Motivo de la consulta…"),{target:{value:"Cefalea de 3 días con fotofobia"}});
  fireEvent.click(screen.getByRole("button",{name:"Firmar consulta"}));
  const dlg=await screen.findByRole("alertdialog");
  expect(dlg.textContent).toMatch(/con fotofobia/);                              // lo que se firmará YA incluye el cambio
  expect(posted.filter(p=>p.path.endsWith("/assessment")).length).toBe(before+1); // se re-guardó la valoración
  fireEvent.click(screen.getByRole("button",{name:"Cancelar"}));
  expect(screen.queryByRole("alertdialog")).toBeNull();expect(screen.queryByText(/Encuentro · Firmada/)).toBeNull();
 });

 // Auditoría U-05/U-17: al cambiar de paciente, el borrador del anterior NO sobrevive (PATIENT_SWITCH+OLD_DRAFT_SUBMITTABLE).
 it("vista Consulta: cambiar de paciente descarta el borrador del anterior y no muestra sus datos",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  fireEvent.change(screen.getByPlaceholderText("Motivo de la consulta…"),{target:{value:"Cefalea del paciente A"}});
  expect((screen.getByPlaceholderText("Motivo de la consulta…") as HTMLTextAreaElement|HTMLInputElement).value).toBe("Cefalea del paciente A");
  // cambio a Carlos Mendoza (p2): volver al panel de consultas y abrir la suya
  fireEvent.click(screen.getByTitle("Volver al panel de consultas"));
  const input2=await screen.findByLabelText("Buscar paciente");
  fireEvent.change(input2,{target:{value:"Carlos"}});
  const openC=await screen.findByRole("button",{name:/Carlos Mendoza/},{timeout:2000});fireEvent.click(openC);
  expect((screen.getByPlaceholderText("Motivo de la consulta…") as HTMLTextAreaElement|HTMLInputElement).value).toBe("");
  expect(screen.queryByText(/Cefalea del paciente A/)).toBeNull();
 });
 it("Nueva consulta (Lote C): buscador incremental + alta de paciente inline que abre la consulta",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Consulta"}));
  // buscador incremental (no dropdown): teclear muestra resultados clicables
  const input=await screen.findByLabelText("Buscar paciente");
  fireEvent.change(input,{target:{value:"Ana"}});
  expect(await screen.findByRole("button",{name:/Ana López García/},{timeout:2000})).toBeTruthy();
  // alta inline: abrir el formulario, capturar nombre + fecha de nacimiento, registrar y abrir la consulta
  fireEvent.click(screen.getByRole("button",{name:/Registrar paciente nuevo/}));
  fireEvent.change(screen.getByLabelText("Nombre del paciente nuevo"),{target:{value:"Nuevo Paciente Prueba"}});
  fireEvent.change(screen.getByLabelText("Fecha de nacimiento"),{target:{value:"1985-05-05"}});
  fireEvent.click(screen.getByRole("button",{name:/Registrar y abrir consulta/}));
  // se abre el workspace de consulta del paciente recién creado
  expect(await screen.findByPlaceholderText("Motivo de la consulta…",{},{timeout:2000})).toBeTruthy();
  // deep-link (Lote B): al seleccionar/abrir un paciente, la URL refleja ?p=&v=
  await waitFor(()=>expect(window.location.search).toMatch(/[?&]p=/),{timeout:2000});
 });

 it("Pacientes: «Registrar e iniciar consulta» crea el paciente y abre su consulta",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/Pacientes/}));
  await screen.findByRole("heading",{name:"Pacientes"});
  fireEvent.click(screen.getByRole("button",{name:"Nuevo paciente"}));
  fireEvent.change(await screen.findByLabelText("Nombre completo"),{target:{value:"Consulta Directa Prueba"}});
  fireEvent.change(screen.getByLabelText("Fecha de nacimiento"),{target:{value:"1990-03-03"}});
  fireEvent.click(screen.getByRole("button",{name:"Registrar e iniciar consulta"}));
  // el alta con openInConsulta abre el workspace de consulta del paciente recién creado
  expect(await screen.findByPlaceholderText("Motivo de la consulta…",{},{timeout:2000})).toBeTruthy();
 });

 // Auditoría U-16: un motivo clínico lo escribe el médico; nada se envía con un literal del código.
 it("vista Expediente: la dosis viaja con unidad, un bloqueo anulable exige nombrar la barrera y justificar (U-19), y suspender exige el motivo del médico tal cual (U-16)",async()=>{
  render(<Workspace/>);
  await toExpediente();
  // Patient 360 (Lote B): la Medicación y la Prescripción segura viven en la sub-vista "Tratamiento".
  fireEvent.click(screen.getByRole("button",{name:"Tratamiento"}));
  // proponer -> prescribir -> activar (mocks 201) para llegar a un medicamento ACTIVO
  const form=within((await screen.findByRole("button",{name:"Proponer medicación"})).closest("section")!);
  fireEvent.change(form.getByPlaceholderText(/Fármaco \(ej\./),{target:{value:"ibuprofeno-400"}});
  fireEvent.change(form.getByPlaceholderText(/Dosis \(500mg\)/),{target:{value:"400"}}); // U-19: cantidad + unidad (mg por defecto)
  fireEvent.change(form.getByPlaceholderText("Vía"),{target:{value:"VO"}});
  fireEvent.change(form.getByPlaceholderText(/Frecuencia \(c\/8h\)/),{target:{value:"c/8h"}});
  fireEvent.click(form.getByRole("button",{name:"Proponer medicación"}));
  const proposed=posted.filter(p=>p.path==="/api/v1/medications").at(-1)?.body as {dose?:string}|undefined;
  expect(proposed?.dose).toBe("400 mg"); // la dosis viaja con unidad explícita
  // U-19: el bloqueo anulable abre el diálogo de anulación; sin 20 caracteres no se puede; la anulación nombra la barrera
  fireEvent.click(await screen.findByRole("button",{name:"Prescribir"}));
  const ov=within(await screen.findByRole("alertdialog",{name:/Bloqueo de seguridad/}));
  expect(ov.getByText(/Vas a anular:/).textContent).toContain("Alergia documentada");
  const anular=ov.getByRole("button",{name:/Anular el bloqueo/}) as HTMLButtonElement;
  expect(anular.disabled).toBe(true);
  fireEvent.change(ov.getByLabelText(/Justificación clínica de la anulación/),{target:{value:"corta"}});
  expect((ov.getByRole("button",{name:/Anular el bloqueo/}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(ov.getByLabelText(/Justificación clínica de la anulación/),{target:{value:"Desensibilización programada con alergología"}});
  fireEvent.click(ov.getByRole("button",{name:/Anular el bloqueo/}));
  await waitFor(()=>expect(screen.queryByRole("alertdialog",{name:/Bloqueo de seguridad/})).toBeNull());
  const rxSent=posted.filter(p=>p.path.endsWith("/prescription")).at(-1)?.body as {overrideBarriers?:string[];overrideJustification?:string}|undefined;
  expect(rxSent?.overrideBarriers).toEqual(["allergy"]);expect(rxSent?.overrideJustification).toBe("Desensibilización programada con alergología");
  fireEvent.click(await screen.findByRole("button",{name:"Activar"}));
  fireEvent.click(await screen.findByRole("button",{name:"Suspender"}));
  const dlg=within(await screen.findByRole("dialog",{name:/Motivo de la suspensión/}));
  const registrar=dlg.getByRole("button",{name:"Registrar"}) as HTMLButtonElement;
  expect(registrar.disabled).toBe(true); // sin texto no se puede enviar
  fireEvent.change(dlg.getByLabelText(/Motivo de la suspensión/),{target:{value:"Gastritis erosiva por AINE"}});
  fireEvent.click(dlg.getByRole("button",{name:"Registrar"}));
  await waitFor(()=>expect(screen.queryByRole("dialog",{name:/Motivo de la suspensión/})).toBeNull());
  const sent=posted.filter(p=>p.path.endsWith("/discontinuation")).at(-1)?.body as {reason?:string}|undefined;
  expect(sent?.reason).toBe("Gastritis erosiva por AINE");
 });
 it("vista Consulta: interrogatorio y exploración física son campos REALES que alimentan la nota clínica",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  // antecedentes estructurables por categoría (Lote D §4.1)
  fireEvent.click(screen.getByRole("button",{name:"+ Heredofamiliares"}));
  expect((screen.getByPlaceholderText(/Antecedentes por categoría/) as HTMLTextAreaElement).value).toMatch(/HEREDOFAMILIARES:/);
  // secciones 4 y 5 ya no son colapsables decorativos: son textareas reales, con andamiaje estructurado (Lote D)
  fireEvent.click(screen.getByRole("button",{name:"Negativo por aparatos"}));
  expect((screen.getByPlaceholderText(/Interrogatorio por aparatos/) as HTMLTextAreaElement).value).toMatch(/Negado por aparatos/);
  fireEvent.change(screen.getByPlaceholderText(/Interrogatorio por aparatos/),{target:{value:"Cardiopulmonar sin alteraciones"}});
  fireEvent.change(screen.getByPlaceholderText(/Exploración física por regiones/),{target:{value:"Abdomen blando, no doloroso"}});
  // la vista previa de la nota compone lo escrito (cableado a composeNote)
  fireEvent.click(screen.getByRole("button",{name:"Vista previa"}));
  expect(await screen.findByText(/INTERROGATORIO POR APARATOS Y SISTEMAS: Cardiopulmonar sin alteraciones/)).toBeTruthy();
  expect(screen.getByText(/EXPLORACIÓN FÍSICA: Abdomen blando, no doloroso/)).toBeTruthy();
  // elementos cosméticos eliminados: la impresión diagnóstica ya no ofrece un "+ Añadir" muerto
  expect(screen.queryByText("+ Añadir")).toBeNull();
 });

 it("vista Consulta: los signos vitales se guardan como eventos reales (POST /vitals)",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  // capturar la TA en la grilla de signos vitales y guardar
  fireEvent.change(screen.getByPlaceholderText("120/80"),{target:{value:"128/82"}});
  fireEvent.click(screen.getByRole("button",{name:"Guardar signos vitales"}));
  expect(await screen.findByText(/Signos vitales guardados ✓/)).toBeTruthy(); // D11a: única redacción (vitalSubmitMessage)
 });

 it("vista Consulta: crear órdenes reales desde el formulario (POST /orders)",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  // seleccionar un estudio de laboratorio marca el checkbox y actualiza el botón
  fireEvent.click(screen.getByText("Biometría hemática completa"));
  const create=screen.getByRole("button",{name:/Crear 1 orden/});
  fireEvent.click(create);
  expect(await screen.findByText(/registrada\(s\) en el expediente/i)).toBeTruthy();
 });

 it("vista Consulta: agregar un diagnóstico CIE-10 real a la lista de problemas (POST /problems)",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  // buscar en el catálogo CIE-10 real (packages/terminology)
  fireEvent.change(screen.getByPlaceholderText(/Buscar CIE-10 o descripción/),{target:{value:"diabetes"}});
  // Lote D: la impresión diagnóstica lleva TIPO (presuntivo/confirmado/diferencial)
  fireEvent.click(screen.getByRole("button",{name:"Confirmado"}));
  const opt=await screen.findByText(/Diabetes mellitus tipo 2 sin complicaciones/);
  fireEvent.click(opt); // agrega el diagnóstico -> POST /problems con epistemic=CONFIRMED
  expect(await screen.findByText(/agregado \(confirmado\)/i)).toBeTruthy();
 });

 it("vista Consulta (Lote D): el Plan de manejo se estructura por secciones etiquetadas",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  const plan=screen.getByPlaceholderText(/Plan de manejo/) as HTMLTextAreaElement;
  expect(plan.value).toBe("");
  fireEvent.click(screen.getByRole("button",{name:"+ Farmacológico"}));
  fireEvent.click(screen.getByRole("button",{name:"+ Seguimiento"}));
  expect(plan.value).toMatch(/FARMACOLÓGICO:/);
  expect(plan.value).toMatch(/SEGUIMIENTO:/);
  // no duplica una sección ya presente
  fireEvent.click(screen.getByRole("button",{name:"+ Farmacológico"}));
  expect(plan.value.match(/FARMACOLÓGICO:/g)!.length).toBe(1);
 });

 it("vista Consulta: los antecedentes marcados se componen en la nota del encuentro",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  fireEvent.click(screen.getByText("HTA")); // marca el antecedente (checkbox real)
  fireEvent.click(screen.getByRole("button",{name:"Vista previa"})); // la nota compuesta muestra lo que se guardará
  expect(await screen.findByText(/ANTECEDENTES RELEVANTES: HTA/)).toBeTruthy();
 });

 it("vista Alergias: registrar una alergia real desde el módulo (POST /allergies)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Alergias"}));
  fireEvent.click(await screen.findByRole("button",{name:"+ Nueva alergia"}));
  expect(screen.getByText("Nueva alergia")).toBeTruthy();
  // esperar a que la lista de pacientes cargue (opción del selector) y elegir paciente + sustancia + reacción
  await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(screen.getAllByRole("combobox")[0]!,{target:{value:"p1"}});
  fireEvent.change(screen.getByPlaceholderText(/Penicilina, Mariscos/),{target:{value:"Penicilina"}});
  fireEvent.click(screen.getByRole("button",{name:"Urticaria"}));
  fireEvent.click(screen.getByRole("button",{name:"Registrar alergia"}));
  expect(await screen.findByText(/Alergia registrada/)).toBeTruthy();
 });

 it("vista Vacunas: registrar una vacuna real desde el módulo (POST /immunizations)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Vacunas"}));
  fireEvent.click(await screen.findByRole("button",{name:"+ Registrar vacuna"}));
  expect(screen.getByText(/Sin lote se registra/)).toBeTruthy(); // panel abierto
  await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(screen.getAllByRole("combobox")[0]!,{target:{value:"p1"}}); // paciente
  fireEvent.click(screen.getByRole("button",{name:"Influenza"}));              // vacuna (chip)
  fireEvent.click(screen.getByRole("button",{name:"Registrar vacuna"}));       // sin lote -> pendiente
  expect(await screen.findByText(/Vacuna registrada/)).toBeTruthy();
 });

 it("vista Plan de cuidado: agregar una meta real al plan del paciente (POST /care-plans)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Plan de cuidados"}));await elegirPaciente();
  fireEvent.click(screen.getByRole("button",{name:"+ Nueva meta"}));
  fireEvent.change(screen.getByPlaceholderText(/HbA1c < 7%/),{target:{value:"Bajar 5% de peso en 3 meses"}});
  fireEvent.click(screen.getByRole("button",{name:"Agregar meta"}));
  expect(await screen.findByText(/Meta agregada al plan/)).toBeTruthy();
 });

 it("vista Documentos: crear un documento clínico real (POST /documents)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Documentos"}));await elegirPaciente();
  fireEvent.click(screen.getByRole("button",{name:"+ Nuevo documento"}));
  fireEvent.change(screen.getByPlaceholderText(/Nota de evolución 19/),{target:{value:"Nota de evolución"}});
  fireEvent.change(screen.getByPlaceholderText("Contenido del documento…"),{target:{value:"Paciente estable, continúa tratamiento."}});
  fireEvent.click(screen.getByRole("button",{name:"Crear documento"}));
  expect(await screen.findByText(/Documento creado/)).toBeTruthy();
 });

 it("vista Obligaciones: agregar una obligación regulatoria real (POST /regulatory-obligations)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Obligaciones\b/}));
  fireEvent.click(await screen.findByRole("button",{name:"+ Agregar obligación"}));
  fireEvent.change(screen.getByPlaceholderText(/Declaración mensual de IVA/),{target:{value:"Aviso de funcionamiento COFEPRIS"}});
  fireEvent.click(screen.getByRole("button",{name:"Agregar obligación"}));
  expect(await screen.findByText(/Obligación agregada/)).toBeTruthy();
 });

 it("vista Facturación: emitir una factura real al paciente elegido (POST /claims)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Facturación"}));
  // elegir el paciente al que se factura (selector real cableado a la lista de pacientes)
  const opt=await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(opt.closest("select")!,{target:{value:"p1"}});
  fireEvent.click(screen.getByRole("button",{name:/Registrar cargo/}));
  expect(await screen.findByText(/Factura emitida/)).toBeTruthy();
 });

 it("vista Interconsultas (Lote G): destinatario/prioridad/tipo viajan al POST + directorio y registro poblacional",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Interconsultas"}));
  const opt=await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(opt.closest("select")!,{target:{value:"p1"}});           // selector de paciente real
  // registro POBLACIONAL + directorio cableados a GET /api/v1/referrals
  expect((await screen.findAllByText("Interconsultas · Toda la clínica")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("Dra. Ruiz")).length).toBeGreaterThan(0); // destinatario del directorio + fila real
  // destinatario REAL (antes el input era decorativo) + motivo
  fireEvent.change(screen.getByPlaceholderText(/Nombre del especialista/),{target:{value:"Dr. Nuevo"}});
  fireEvent.change(screen.getByPlaceholderText(/Describe el motivo/),{target:{value:"Valoración por endocrinología"}});
  fireEvent.click(screen.getByRole("button",{name:/Enviar interconsulta/}));
  expect(await screen.findByText(/Interconsulta enviada/)).toBeTruthy();
  // auditoría: el destinatario, la prioridad y el tipo YA NO se descartan en la UI
  const sent=posted.filter(p=>p.path==="/api/v1/referrals").at(-1)?.body as {recipientName?:string;priority?:string;referralType?:string}|undefined;
  expect(sent?.recipientName).toBe("Dr. Nuevo");
  expect(sent?.priority).toBeTruthy();
  expect(sent?.referralType).toBeTruthy();
 });

 it("vista Resultados: registrar un resultado real (POST /results, interpretación derivada)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Resultados\b/}));
  fireEvent.click(await screen.findByRole("button",{name:"+ Registrar resultado"}));
  const opt=await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(opt.closest("select")!,{target:{value:"p1"}});          // paciente
  // Auditoría U-07: la unidad es parte del dato. El selector arranca en la canónica del analito y ofrece las alternativas.
  const unitSel=screen.getByLabelText("Unidad del resultado") as HTMLSelectElement;
  expect(unitSel.value).toBe("mg/dL");expect(Array.from(unitSel.options).map(o=>o.value)).toEqual(["mg/dL","mmol/L"]);
  fireEvent.change(unitSel,{target:{value:"mmol/L"}});
  fireEvent.change(screen.getByLabelText("Valor del resultado"),{target:{value:"7"}});
  fireEvent.click(screen.getByRole("button",{name:"Registrar resultado"})); // submit
  expect(await screen.findByText(/Resultado registrado/)).toBeTruthy();
  const sent=posted.filter(p=>p.path==="/api/v1/results").at(-1)?.body as {analyte?:string;value?:string;unit?:string}|undefined;
  expect(sent).toMatchObject({analyte:"GLUCOSE",value:"7",unit:"mmol/L"});
 });

 it("vista Signos vitales: registrar signos vitales reales al paciente elegido (POST /vitals)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Signos vitales"}));
  const opt=await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(opt.closest("select")!,{target:{value:"p1"}}); // selector de paciente (selectPatientRaw)
  fireEvent.change(screen.getByPlaceholderText("72"),{target:{value:"78"}}); // frecuencia cardíaca
  fireEvent.click(screen.getByRole("button",{name:/Guardar signos vitales/}));
  expect(await screen.findByText(/Signos vitales guardados/)).toBeTruthy();
 });

 it("vista Expediente (Lote H): «Exportar expediente» descarga un archivo real y muestra un resumen honesto",async()=>{
  const createObjSpy=vi.fn(()=>"blob:mock");
  const prevCreate=(URL as unknown as{createObjectURL?:unknown}).createObjectURL;
  const prevRevoke=(URL as unknown as{revokeObjectURL?:unknown}).revokeObjectURL;
  (URL as unknown as{createObjectURL:unknown}).createObjectURL=createObjSpy;
  (URL as unknown as{revokeObjectURL:unknown}).revokeObjectURL=vi.fn();
  const clickSpy=vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
  try{
   render(<Workspace/>);
   await toExpediente();
   fireEvent.click(screen.getByRole("button",{name:"Historia"})); // el botón de export vive en el Timeline (sub-vista Historia)
   fireEvent.click(await screen.findByRole("button",{name:/Exportar expediente/}));
   expect(await screen.findByText(/archivo \.json descargado/)).toBeTruthy();
   expect(createObjSpy).toHaveBeenCalled();  // se generó el Blob del archivo
   expect(clickSpy).toHaveBeenCalled();      // se disparó la descarga
   expect(screen.getByText(/incluye el contenido con datos personales/)).toBeTruthy(); // honesto sobre qué contiene
  }finally{
   (URL as unknown as{createObjectURL:unknown}).createObjectURL=prevCreate;
   (URL as unknown as{revokeObjectURL:unknown}).revokeObjectURL=prevRevoke;
   clickSpy.mockRestore();
  }
 });

 it("hero (panel 1) se materializa desde el snapshot: identidad, chips dx y vitales",async()=>{
  render(<Workspace/>);
  await toExpediente();
  expect(await screen.findByText(/Vista principal/,{},{timeout:2500})).toBeTruthy();
  expect(screen.getAllByText("HTA").length).toBeGreaterThan(0);     // chip dx desde CIE-10 (I10)
  // CORRECCIÓN CLÍNICA (auditoría, al cablear R05a-F03): esta prueba fijaba «ERC G3a» para N18.3, y el mapa de estadios
  // estaba DESPLAZADO UN ESTADIO —N18.5 (eGFR < 15) se mostraba como G4—. Además «G3a» afirmaba una subdivisión que exige
  // N18.31/N18.32: con N18.3 a secas no se sabe. La etiqueta correcta de N18.3 es «ERC G3», y ésta es la regresión.
  expect(screen.getAllByText("ERC G3").length).toBeGreaterThan(0); // N18.3 -> estadio 3, sin afirmar a/b
  expect(screen.getAllByText("7.1").length).toBeGreaterThan(0);     // HbA1c en tarjeta de vitales
 });

 it("panel 5 (Seguimiento automático): tabs + estado en TEXTO, no solo color",async()=>{
  render(<Workspace/>);
  await toExpediente();
  const h=await screen.findByRole("heading",{name:"Seguimiento automático"},{timeout:2500});
  expect(h).toBeTruthy();
  const sec=h.closest("section")!;
  expect(sec.textContent).toMatch(/Pendientes/);        // tab
  expect(sec.textContent).toMatch(/Seguimiento activo/); // footer Zero-Lost-Follow-Up
 });

 it("panel 6 (Portal del paciente): saludo + features no construidas marcadas 'Próximamente' (verdad clínica)",async()=>{
  render(<Workspace/>);
  await toExpediente();
  const h=await screen.findByRole("heading",{name:"Portal del paciente"},{timeout:2500});
  const sec=h.closest("section")!;
  expect(sec.textContent).toMatch(/Hola,/);
  expect(sec.textContent).toMatch(/Mensajes/);
  const soon=Array.from(sec.querySelectorAll("*")).filter(e=>e.textContent==="Próximamente");
  expect(soon.length,"Mensajes y Educación deben ir marcados Próximamente").toBeGreaterThanOrEqual(2);
  expect(sec.textContent).toMatch(/solo lectura/i); // espejo read-only (Physician Control)
 });

 it("panel 7 (Seguridad y auditoría): estado del sistema + actividad desde la cadena (estado en texto)",async()=>{
  render(<Workspace/>);
  await toExpediente();
  await screen.findByText(/Vista principal/,{},{timeout:2500}); // el hero prueba que la auto-carga (timeline incluido) completó
  const sec=screen.getByRole("heading",{name:"Seguridad y auditoría"}).closest("section")!;
  expect(sec.textContent).toMatch(/Estado del sistema/);
  expect(sec.textContent).toMatch(/Actividad reciente/);
  await waitFor(()=>expect(sec.textContent).toMatch(/SIGNED/),{timeout:2500}); // estado del evento en TEXTO (no solo color)
 });

 it("vista Resultados (S7): registro clínica-wide cableado a GET /api/v1/results — KPIs + lista con estado-UI",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Resultados\b/}));
  expect(screen.getByRole("heading",{name:"Resultados"})).toBeTruthy();
  expect(screen.getByText("Resultados totales")).toBeTruthy();                    // KPI
  expect((await screen.findAllByText("GLUCOSE")).length).toBeGreaterThan(0);      // analito real (mock)
  expect(screen.getAllByText(/Hallazgos/).length).toBeGreaterThan(0);            // estado-UI derivado en TEXTO
  expect(screen.getByText("Con hallazgos anormales")).toBeTruthy();
  // el panel de detalle es REAL (deriva del resultado seleccionado), no una maqueta hardcodeada
  expect(screen.getByText("Clasificación CDS")).toBeTruthy();
  expect(screen.getByText("Ciclo de vida")).toBeTruthy();
  expect(screen.queryByText("Descargar PDF")).toBeNull();                        // botón muerto eliminado
  expect(screen.queryByText("Laboratorio Chopo · Folio: LC260917-0042")).toBeNull(); // datos falsos eliminados
  // el filtro de búsqueda es un input REAL que filtra la lista
  fireEvent.change(screen.getByPlaceholderText(/Buscar por estudio o paciente/),{target:{value:"zzz-no-existe"}});
  expect(screen.getByText(/Ningún resultado coincide/)).toBeTruthy();
  fireEvent.change(screen.getByPlaceholderText(/Buscar por estudio o paciente/),{target:{value:""}});
  // pestañas restantes cableadas:
  fireEvent.click(screen.getByRole("button",{name:/^Solicitudes/}));
  expect(await screen.findByText(/Solicitudes de estudio/)).toBeTruthy();
  expect(screen.getAllByText("Biometría hemática completa").length).toBeGreaterThan(0); // orden real (mock)
  fireEvent.click(screen.getByRole("button",{name:/Valores de referencia/}));
  expect(screen.getAllByText(/Valores de referencia/).length).toBeGreaterThan(0);
  expect(screen.getByText("GLUCOSE")).toBeTruthy();                              // rango real del motor CDS
  // R03-14: la tabla muestra el mismo criterio con el que se clasifica, con unidad y FUENTE citada por fila.
  expect(screen.getByText("glucosa")).toBeTruthy();
  expect(screen.getAllByText(/ADA Standards of Care 2024/).length).toBeGreaterThan(0);
  expect(screen.getAllByText("mg/dL").length).toBeGreaterThan(0);
  fireEvent.click(screen.getByRole("button",{name:/^Alertas/}));
  expect(screen.getByText(/Alertas de resultados/)).toBeTruthy();
 });

 it("vista Configuración (S-CONFIG): ajustes del consultorio cableados a /office-settings — cargar, editar y guardar",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Configuración/}));           // acceso en HERRAMIENTAS
  expect(await screen.findByRole("heading",{name:"Configuración"})).toBeTruthy();
  // Lote I — pestañas REALES: «General» por defecto muestra info/preferencias/regionales; NO horarios ni módulos.
  expect(screen.getAllByText("Información del consultorio").length).toBeGreaterThan(0);
  expect(screen.getByText("Preferencias de consulta")).toBeTruthy();
  expect(screen.getByText("Configuraciones regionales")).toBeTruthy();
  expect(screen.getByText(/NOM-024/)).toBeTruthy();                                // nota de seguridad (Datos y seguridad)
  expect(screen.queryByText("Horarios de atención")).toBeNull();                   // vive en la pestaña «Consultorio»
  const estado=await screen.findByPlaceholderText("Ej. Chihuahua") as HTMLInputElement;
  fireEvent.change(estado,{target:{value:"Sonora"}});
  expect(estado.value).toBe("Sonora");
  // Pestaña «Consultorio»: horarios (persistidos) + módulos con toggle funcional
  fireEvent.click(screen.getByRole("button",{name:"Consultorio"}));
  expect(await screen.findByText("Horarios de atención")).toBeTruthy();
  expect(screen.getByText("Módulos activos")).toBeTruthy();
  const hIn=await screen.findByLabelText("Apertura Lunes") as HTMLInputElement;
  expect(hIn.value).toBe("08:00");
  fireEvent.change(hIn,{target:{value:"09:30"}});
  expect(hIn.value).toBe("09:30");
  const modSwitch=screen.getByRole("switch",{name:"Módulo Facturación"});         // toggle FUNCIONAL (role switch)
  expect(modSwitch.getAttribute("aria-checked")).toBe("true");
  fireEvent.click(modSwitch);
  expect(modSwitch.getAttribute("aria-checked")).toBe("false");
  // Pestaña «Identidad profesional»: cédula (L-05) con validación real + aviso honesto si falta
  fireEvent.click(screen.getByRole("button",{name:"Identidad profesional"}));
  expect((await screen.findAllByText("Identidad profesional")).length).toBeGreaterThan(0); // pestaña + sección
  expect(screen.getByText(/Sin cédula registrada: no podrás prescribir ni firmar/)).toBeTruthy();
  const credSave=screen.getByRole("button",{name:"Guardar identidad profesional"}) as HTMLButtonElement;
  expect(credSave.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Nombre completo del médico"),{target:{value:"Dra. Ana Pérez Ruiz"}});
  fireEvent.change(screen.getByLabelText("Cédula profesional"),{target:{value:"12AB"}});
  fireEvent.change(screen.getByLabelText("Institución que expidió el título"),{target:{value:"UNAM"}});
  expect((screen.getByRole("button",{name:"Guardar identidad profesional"}) as HTMLButtonElement).disabled).toBe(true); // cédula inválida
  fireEvent.change(screen.getByLabelText("Cédula profesional"),{target:{value:"7654321"}});
  expect((screen.getByRole("button",{name:"Guardar identidad profesional"}) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(screen.getByRole("button",{name:"Guardar identidad profesional"}));
  await waitFor(()=>expect(posted.some(p=>p.path==="/api/v1/physician-profile/credentials")).toBe(true));
  const credSent=posted.filter(p=>p.path==="/api/v1/physician-profile/credentials").at(-1)?.body as {cedulaProfesional?:string;institution?:string}|undefined;
  expect(credSent?.cedulaProfesional).toBe("7654321");expect(credSent?.institution).toBe("UNAM");
  expect(screen.queryByPlaceholderText("Ej. 12345678")).toBeNull(); // la cédula ya no es un dato "del consultorio"
  // firma y sello reales (Vercel Blob privado): sección presente con estado honesto (sin firma inventada)
  expect(screen.getByText("Firma y sello")).toBeTruthy();
  expect(screen.getByText("Sin firma cargada")).toBeTruthy();                    // estado real (no la firma falsa "Dr. Luis Godinez")
  expect(screen.getByText("Sin sello cargada")).toBeTruthy();
  // los ajustes se cargan de /office-settings (input controlado real); editar y guardar (pestaña «General»)
  fireEvent.click(screen.getByRole("button",{name:"General"}));
  const name=await screen.findByPlaceholderText(/Clínica San Rafael/,{},{timeout:2000});
  fireEvent.change(name,{target:{value:"Clínica Norte"}});
  const save=await screen.findByRole("button",{name:/Guardar cambios/});
  await waitFor(()=>expect((save as HTMLButtonElement).disabled).toBe(false),{timeout:2000});
  fireEvent.click(save);
  expect(await screen.findByText(/Cambios guardados/,{},{timeout:2000})).toBeTruthy();
  // auditoría: banner honesto (ahora se persisten); sin control destructivo falso ni toggle de IA (R6 en pausa)
  expect(screen.getByText(/guardan de verdad/)).toBeTruthy();
  expect(screen.queryByText(/Eliminar mi cuenta/)).toBeNull();
  expect(screen.queryByText(/Sugerencias de diagnóstico con IA/)).toBeNull();
 });

 it("vista Biblioteca Clínica (S-BIBLIOTECA): repositorio de conocimiento + herramientas reales enlazadas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/Biblioteca clínica/}));       // acceso en HERRAMIENTAS
  expect(await screen.findByRole("heading",{name:"Biblioteca Clínica"})).toBeTruthy();
  expect(screen.getByText("Guías y protocolos")).toBeTruthy();                    // KPI
  expect(screen.getByText("Especialidades")).toBeTruthy();
  expect(screen.getByText("Contenido destacado")).toBeTruthy();
  expect(screen.getAllByText("Diabetes mellitus tipo 2").length).toBeGreaterThan(0); // tarjeta destacada
  expect(screen.getByText("Herramientas rápidas")).toBeTruthy();
  expect(screen.getByText("Fuentes confiables")).toBeTruthy();
  expect(screen.getByText(/Conocimiento que mejora vidas/)).toBeTruthy();
  // auditoría: banner honesto (catálogo presentacional) + herramienta real enlazada; controles muertos eliminados
  expect(screen.getByText(/Catálogo de referencia \(presentacional\)/)).toBeTruthy();
  expect(screen.getAllByRole("button",{name:/Verificador de interacciones/}).length).toBeGreaterThan(0); // botón + tarjeta de acceso rápido (ahora operable con teclado)
  expect(screen.queryByText(/Subir documento/)).toBeNull();
  expect(screen.queryByText(/Actualizar contenido/)).toBeNull();
  expect(screen.queryByPlaceholderText(/Buscar en la biblioteca/)).toBeNull();
  expect(screen.queryByText("Explorar biblioteca →")).toBeNull();
 });

 it("vista Reportes (S-REPORTES): tablero analítico — KPIs y diagnósticos cableados a GET /reports + gráficas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Reportes"}));
  expect(await screen.findByRole("heading",{name:"Reportes"})).toBeTruthy();
  expect(screen.getByText("Pacientes atendidos")).toBeTruthy();                  // KPI real
  expect(screen.getByText("Ingresos totales")).toBeTruthy();                     // KPI real
  expect(await screen.findByText("Órdenes y estudios")).toBeTruthy();           // KPI real (ordersTotal)
  expect(screen.getByText("Vacunas aplicadas")).toBeTruthy();                    // KPI real (immunizationsApplied)
  expect(screen.getByText(/Diagnósticos principales/)).toBeTruthy();            // real (topDiagnoses)
  expect(screen.getByText("Órdenes por tipo")).toBeTruthy();                     // dona real (ordersByType)
  expect(screen.getByText("Procedimientos más realizados")).toBeTruthy();        // real (topProcedures)
  expect(screen.getByText("Consultas por día")).toBeTruthy();                    // tendencia real (encountersByDay)
  expect(screen.getByText("Medicamentos más prescritos")).toBeTruthy();          // real (topMedications)
  expect(screen.getByText("paracetamol")).toBeTruthy();                          // fármaco real del agregado de recetas
  expect(screen.getByText("Tipos de consulta")).toBeTruthy();                    // real (appointmentsByType desde agenda)
  expect(screen.getByText("Control")).toBeTruthy();                              // etiqueta real de apptType
  expect(screen.getByText("Indicadores de calidad")).toBeTruthy();               // real (qualityIndicators deterministas)
  expect(screen.getByText("Asistencia efectiva")).toBeTruthy();                  // indicador real computado
  expect(screen.getByText("sin datos")).toBeTruthy();                            // honestidad: indicador sin denominador NO se inventa
  // auditoría: se eliminaron las gráficas/secciones y trends hardcodeados
  expect(screen.queryByText(/Reportes rápidos/)).toBeNull();
  expect(screen.queryByText(/vs. mes anterior/)).toBeNull();
  expect(screen.queryByText(/Exportar PDF/)).toBeNull();
 });

 it("vista Clinical Intelligence (S-CLINICALINTEL): apoyo determinista real; IA generativa (R6) marcada como no disponible",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Clinical Intelligence"}));
  expect(await screen.findByRole("heading",{name:"Clinical Intelligence"})).toBeTruthy();
  expect(screen.getByText("Apoyo clínico determinista")).toBeTruthy();          // panel determinista real
  expect(screen.getAllByText(/Alertas clínicas/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Calculadoras clínicas/)).toBeTruthy();
  expect(screen.getAllByText(/en pausa intencional/).length).toBeGreaterThan(0); // nota de gobernanza honesta
  // auditoría: se eliminó la IA generativa simulada (chat, diferencial probabilístico) y controles muertos
  expect(screen.queryByText(/Asistente clínico con IA/)).toBeNull();
  expect(screen.queryByText("GPT Clínico")).toBeNull();
  expect(screen.queryByText(/Diagnóstico diferencial \(IA\)/)).toBeNull();
  expect(screen.queryByText(/Configuración de IA/)).toBeNull();
 });

 it("vista Obligaciones (S-OBLIGACIONES): regulatorias del consultorio cableadas a GET /regulatory-obligations",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Obligaciones/}));
  expect(screen.getByRole("heading",{name:"Obligaciones"})).toBeTruthy();
  expect(screen.getByText("Total de obligaciones")).toBeTruthy();               // KPI real
  expect((await screen.findAllByText(/Obligaciones \(/)).length).toBeGreaterThan(0); // tabla real (conteo)
  expect(screen.getByText(/Cumplimiento por categoría/)).toBeTruthy();          // gráfica real (compliance)
  // auditoría: se eliminaron las secciones/controles hardcodeados o muertos
  expect(screen.queryByText(/Calendario de próximas obligaciones/)).toBeNull();
  expect(screen.queryByText(/Recordatorios automáticos/)).toBeNull();
  expect(screen.queryByText(/Tareas pendientes/)).toBeNull();
  expect(screen.queryByText("Documentos relacionados")).toBeNull();
  expect(screen.queryByText(/Exportar reporte/)).toBeNull();
 });

 it("vista Documentos (S-DOCUMENTOS): carpetas + tabla de documentos + vista previa + acciones",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Documentos"}));
  expect(screen.getByRole("heading",{name:"Documentos"})).toBeTruthy();
  expect(screen.getByText("Carpetas")).toBeTruthy();
  expect(screen.getByText("Todos los documentos")).toBeTruthy();               // carpeta real (filtra la tabla)
  expect(screen.getByText("Documentos clínicos")).toBeTruthy();                 // chip real
  expect(screen.getByText("Detalle del documento")).toBeTruthy();              // panel de detalle real
  expect(screen.getByText(/Acciones rápidas/)).toBeTruthy();
  expect(screen.getByText("Generar desde plantilla")).toBeTruthy();            // cableado a genDoc (POST /documents)
  // adjuntos reales (Vercel Blob privado): tipos y límite reflejan el backend, no valores inventados
  expect(screen.getByText(/25 MB/)).toBeTruthy();                              // límite real del backend
  expect(screen.getByText(/Vercel Blob/)).toBeTruthy();                        // almacenamiento real declarado
  // auditoría: se eliminó la vista previa de PDF inventada, los controles muertos y tipos no soportados
  expect(screen.queryByText("LABORATORIOS DEL NORTE")).toBeNull();
  expect(screen.queryByText(/Carga masiva/)).toBeNull();
  expect(screen.queryByText("Subido por")).toBeNull();
  expect(screen.queryByText("DICOM")).toBeNull();                              // tipo no soportado por el backend: eliminado
 });

 it("vista Facturación (S-FACTURACION): registro clínica-wide cableado a GET /api/v1/claims + wizard Nueva factura",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Facturación"}));
  expect(screen.getByRole("heading",{name:"Facturación"})).toBeTruthy();
  expect(screen.getByText("Facturas emitidas")).toBeTruthy();                    // KPI
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0); // fila (real) + wizard
  expect(screen.getByText("Nueva factura")).toBeTruthy();                        // creador real
  expect(screen.getByText("Conceptos")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Registrar cargo/})).toBeTruthy();
  // auditoría: se eliminaron gráficas/controles hardcodeados o muertos
  expect(screen.queryByText("Métodos de pago")).toBeNull();
  expect(screen.queryByText("Top servicios facturados")).toBeNull();
  expect(screen.queryByText("Ingresos mensuales")).toBeNull();
  expect(screen.queryByText("Configuración fiscal")).toBeNull();
  expect(screen.queryByText("Datos fiscales")).toBeNull();
 });

 it("vista Seguimiento (S-SEGUIMIENTO): tendencia de vitales + indicadores + tareas reales, sin maqueta",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Seguimiento/}));
  expect(await screen.findByRole("heading",{name:"Seguimiento"})).toBeTruthy();
  // secciones reales derivadas del snapshot (GET /follow-up)
  expect(screen.getByText("Tendencia de signos vitales")).toBeTruthy();
  expect(screen.getByText(/Indicadores clave/)).toBeTruthy();
  expect(screen.getByText(/Tareas de seguimiento/)).toBeTruthy();
  // auditoría: se eliminaron la historia hardcodeada, la próxima cita ficticia, notas y controles muertos
  expect(screen.queryByText("Historia de seguimiento")).toBeNull();
  expect(screen.queryByText("Control de DM2")).toBeNull();
  expect(screen.queryByText(/Próxima cita de seguimiento/)).toBeNull();
  expect(screen.queryByText("Notas del seguimiento")).toBeNull();
  expect(screen.queryByText("Registro rápido")).toBeNull();
  // Lote F — seguimiento POBLACIONAL cableado a GET /api/v1/worklist (pendientes de todos los pacientes)
  expect((await screen.findAllByText("Seguimiento · Toda la clínica")).length).toBeGreaterThan(0);
  expect(screen.getByText("Resultado crítico sin cerrar")).toBeTruthy();       // gap real del worklist
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0); // nombre resuelto del padrón
  expect(screen.getAllByText("HIGH").length).toBeGreaterThan(0);               // prioridad del gap
 });

 it("vista Interconsultas (S-INTERCONSULTA): form Nueva interconsulta + panel de contexto + envío",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Interconsultas"}));
  expect(await screen.findByRole("heading",{name:"Nueva interconsulta"})).toBeTruthy();
  expect(screen.getByText("Datos de la interconsulta")).toBeTruthy();
  expect(screen.getAllByText(/Especialidad/).length).toBeGreaterThan(0); // label del form + columna del registro poblacional
  expect(screen.getByText(/Motivo de interconsulta/)).toBeTruthy();
  expect(screen.getAllByText(/Resumen clínico/).length).toBeGreaterThan(0);
  expect(screen.getByText("Información relevante del paciente")).toBeTruthy();  // panel derecho (rep/real)
  expect(screen.getByText("Plantillas rápidas")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Enviar interconsulta/})).toBeTruthy();
  // auditoría: se eliminaron secciones/controles hardcodeados o muertos
  expect(screen.queryByText("Antecedentes relevantes")).toBeNull();
  expect(screen.queryByText("Estudios anexos")).toBeNull();
  expect(screen.queryByText("Vista previa")).toBeNull();
 });

 it("vista Plan de cuidado (S-PLANCUIDADO): secciones reales del snapshot (problemas, objetivos, métricas) sin maqueta",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Plan de cuidados"}));
  expect(screen.getByRole("heading",{name:"Plan de cuidado"})).toBeTruthy();
  // las 3 tarjetas reales derivadas del snapshot compuesto (GET /care-plans)
  expect(screen.getByText(/Diagnósticos \/ Problemas asociados/)).toBeTruthy();
  expect(screen.getByText("Objetivos del plan")).toBeTruthy();
  expect(screen.getByText("Metas y métricas")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Nueva meta/})).toBeTruthy();                 // creador real (POST /care-plans)
  // auditoría: se eliminaron las secciones/controles hardcodeados sin fuente real
  expect(screen.queryByText("Intervenciones y recomendaciones")).toBeNull();
  expect(screen.queryByText("Cronograma de seguimiento")).toBeNull();
  expect(screen.queryByText("Educación para el paciente")).toBeNull();
  expect(screen.queryByText("Documentos relacionados")).toBeNull();
  expect(screen.queryByText("Imprimir plan")).toBeNull();
  // Lote E — registro POBLACIONAL clínica-wide cableado a GET /api/v1/care-plans
  expect((await screen.findAllByText("Plan de cuidado · Toda la clínica")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0); // plan de otro paciente
  expect(screen.getByText("HbA1c < 7% en 3 meses")).toBeTruthy();
  expect(screen.getAllByText("En pausa").length).toBeGreaterThan(0);                 // estado por última transición
 });

 it("vista Signos vitales (S-SIGNOS): form + últimos registros + tendencias + referencia + alertas deterministas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Signos vitales"}));
  expect(await screen.findByRole("heading",{name:"Signos vitales"})).toBeTruthy();
  expect(screen.getByText("Registrar signos vitales")).toBeTruthy();          // título del form
  expect(screen.getByPlaceholderText("36.5")).toBeTruthy();                    // campo temperatura
  expect(screen.getByText(/Últimos registros/)).toBeTruthy();
  // el historial ya NO muestra datos de ejemplo (fila representativa eliminada)
  expect(screen.queryByText("120/80")).toBeNull();                            // sin fila ficticia
  expect(screen.getByText("Tendencias")).toBeTruthy();
  expect(screen.getByText(/Referencia de valores normales/)).toBeTruthy();
  expect(screen.getByText("Alertas clínicas")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Guardar signos vitales/})).toBeTruthy();
  // auditoría: se registra con hora actual y se eliminaron controles/campos muertos
  expect(screen.getByText(/Se registra con la fecha y hora actuales/)).toBeTruthy();
  expect(screen.queryByText("Acciones rápidas")).toBeNull();
  expect(screen.queryByText("Plantilla rápida")).toBeNull();
  expect(screen.queryByText("Estado general")).toBeNull();                    // campo no persistido, eliminado
  // Lote E — registro POBLACIONAL clínica-wide cableado a GET /api/v1/vitals (lectura vigente por paciente)
  expect((await screen.findAllByText("Signos vitales · Toda la clínica")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0); // lectura de otro paciente
  expect(screen.getByText("180/110")).toBeTruthy();
  expect(screen.getAllByText("Crítico").length).toBeGreaterThan(0);           // estado derivado del valor
 });

 it("vista Vacunas (S-VACUNAS): registro clínica-wide cableado a GET /api/v1/immunizations — KPIs, tabla, detalle y cobertura",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Vacunas"}));
  expect(screen.getByRole("heading",{name:"Vacunas"})).toBeTruthy();
  expect((await screen.findAllByText("Ana López García",{},{timeout:2500})).length).toBeGreaterThan(0); // fila + detalle
  expect(screen.getByText("Detalle de la vacuna")).toBeTruthy();
  expect(screen.getAllByText("Completa").length).toBeGreaterThan(0);           // estado en TEXTO
  expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
  expect(screen.getByText(/Dosis por vacuna/)).toBeTruthy();                  // donut real (byVaccine)
  expect(screen.getByText("Estado de vacunación")).toBeTruthy();             // barras reales
  expect(screen.getAllByText(/Dosis pendientes/).length).toBeGreaterThan(0);  // lista real de pendientes
  // auditoría: acción real de navegación + eliminación de secciones/controles ficticios
  expect(screen.getByText(/Ver en el expediente/)).toBeTruthy();
  expect(screen.queryByText("Acciones rápidas")).toBeNull();
  expect(screen.queryByText("Exportar listado")).toBeNull();
  expect(screen.queryByText(/Esquemas por edad \(cobertura\)/)).toBeNull();
 });

 it("vista Problemas (S-PROBLEMAS): registro clínica-wide cableado a GET /api/v1/problems + navegación a form y plantillas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Problemas"}));
  expect(await screen.findByRole("heading",{name:"Problemas"})).toBeTruthy();
  expect((await screen.findAllByText("Ana López García",{},{timeout:2500})).length).toBeGreaterThan(0); // fila + detalle
  expect(screen.getByText("Detalle del problema")).toBeTruthy();
  expect(screen.getAllByText("En seguimiento").length).toBeGreaterThan(0); // estado en TEXTO
  expect(screen.getByText(/Problemas por categoría/)).toBeTruthy();
  expect(screen.getByText("Estado de problemas")).toBeTruthy();
  expect(screen.getByText("Pacientes con más problemas")).toBeTruthy();
  // auditoría: el detalle abre el expediente (acción real) y se eliminaron los controles muertos
  expect(screen.getByText(/Ver en el expediente/)).toBeTruthy();
  expect(screen.queryByText("Exportar listado")).toBeNull();
  expect(screen.queryByText("Accesos rápidos")).toBeNull();
  // navegación a "Nuevo problema" (form cableado a CIE-10)
  fireEvent.click(screen.getByRole("button",{name:/Nuevo problema/}));
  expect(screen.getByRole("heading",{name:"Nuevo problema"})).toBeTruthy();
  expect(screen.getByText("1. Información del problema")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Guardar problema/})).toBeTruthy();
  // Lote E — dead-UI del formulario eliminado (directiva: cero controles muertos)
  expect(screen.queryByText("Prioridad")).toBeNull();
  expect(screen.queryByText(/Etiquetas \/ Palabras clave/)).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"← Volver"}));
  // navegación a Plantillas
  fireEvent.click(screen.getByRole("button",{name:/Plantillas/}));
  expect(screen.getByRole("heading",{name:"Plantillas de problemas"})).toBeTruthy();
  expect(screen.getAllByText("Diabetes mellitus tipo 2").length).toBeGreaterThan(0);
  // Lote E — botones muertos eliminados + búsqueda de plantillas REAL (filtra el catálogo)
  expect(screen.queryByText("+ Nueva plantilla")).toBeNull();
  expect(screen.queryByText(/Importar\/Exportar/)).toBeNull();
  expect(screen.queryByText(/Editar plantilla/)).toBeNull();
  const tplSearch=screen.getByPlaceholderText(/Buscar plantilla por nombre/);
  fireEvent.change(tplSearch,{target:{value:"asma"}});
  expect(screen.getAllByText("Asma").length).toBeGreaterThan(0);
  expect(screen.queryByText("Diabetes mellitus tipo 2")).toBeNull();
 });

 it("vista Alergias (S-ALERGIAS): registro clínica-wide cableado a GET /api/v1/allergies — KPIs, tabla, detalle y gráficas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Alergias"}));
  expect(screen.getByRole("heading",{name:"Alergias"})).toBeTruthy();
  // tabla + detalle materializados desde el endpoint (mock): el nombre aparece en fila y en el panel de detalle
  expect((await screen.findAllByText("Ana López García",{},{timeout:2500})).length).toBeGreaterThan(0);
  expect(screen.getByText("Detalle de la alergia")).toBeTruthy();
  expect(screen.getAllByText("Grave").length).toBeGreaterThan(0);           // gravedad en TEXTO (no solo color)
  expect(screen.getByText(/Alergias por tipo de alérgeno/)).toBeTruthy();   // gráfica de tipo
  expect(screen.getByText(/Alergias por gravedad/)).toBeTruthy();           // gráfica de gravedad
  expect(screen.getByText("Recomendaciones")).toBeTruthy();
  // auditoría: el detalle abre el expediente (acción real) y se eliminaron los controles muertos
  expect(screen.getByText(/Ver en el expediente/)).toBeTruthy();
  expect(screen.queryByText("Exportar listado")).toBeNull();
  expect(screen.queryByText("Accesos rápidos")).toBeNull();
  expect(screen.queryByText("Registro rápido")).toBeNull();
 });

 it("Medicamentos › Interacciones (S8.3): arranca VACÍO, exige dos fármacos y verifica los que escribe el médico",async()=>{
  // Auditoría R05a (WS1-15c): esta prueba afirmaba «chips por defecto» — fijaba el defecto. El verificador arrancaba con
  // Sertralina/Ibuprofeno/Metformina precargados, sin decir que eran de ejemplo, en una pantalla que emite un veredicto de
  // interacciones. Ahora se comprueba lo contrario: nace vacío y el conjunto lo pone el médico.
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/Medicamentos/})); // vista Medicamentos
  fireEvent.click(screen.getByRole("button",{name:/^Interacciones$/})); // pestaña
  expect(screen.getByText("Medicamentos a evaluar")).toBeTruthy();
  expect(screen.getByText("Agrega dos o más medicamentos.")).toBeTruthy(); // nace vacío
  expect(screen.queryByText("Sertralina"),"ningún fármaco precargado").toBeNull();
  expect((screen.getByRole("button",{name:"Verificar interacciones"}) as HTMLButtonElement).disabled,"sin fármacos no se verifica").toBe(true);
  // El médico escribe el conjunto real que quiere evaluar.
  const caja=screen.getByPlaceholderText(/Ej\. Sertralina/);
  const agregar=screen.getByRole("button",{name:"Agregar"});
  fireEvent.change(caja,{target:{value:"Sertralina"}});fireEvent.click(agregar);
  expect((screen.getByRole("button",{name:"Verificar interacciones"}) as HTMLButtonElement).disabled,"con UN fármaco tampoco: no hay par que interactúe").toBe(true);
  fireEvent.change(caja,{target:{value:"Ibuprofeno"}});fireEvent.click(agregar);
  expect(screen.getAllByText("Sertralina").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Ibuprofeno").length).toBeGreaterThan(0);
  expect(screen.getByText("Factores del paciente")).toBeTruthy();
  const verify=screen.getByRole("button",{name:"Verificar interacciones"});
  expect((verify as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(verify);
  // resultado desde el endpoint (mock): hallazgo Mayor con etiqueta en TEXTO (no solo color) + mecanismo
  const badge=await screen.findByText("Mayor",{},{timeout:2500});
  expect(badge).toBeTruthy();
  const panel=badge.closest("div")!;
  expect(panel).toBeTruthy();
  await waitFor(()=>expect(screen.getAllByText(/Mecanismo\./).length).toBeGreaterThan(0),{timeout:2500});
  expect(screen.getAllByText(/Recomendación\./).length).toBeGreaterThan(0);
  expect(screen.getByText(/severidad máxima/)).toBeTruthy();
 });

 it("accesibilidad: los paneles de presentación no tienen violaciones axe serias/críticas",async()=>{
  render(<Workspace/>);
  await toExpediente();
  const seg=(await screen.findByRole("heading",{name:"Seguimiento automático"},{timeout:2500})).closest("section")!;
  const por=screen.getByRole("heading",{name:"Portal del paciente"}).closest("section")!;
  const aud=screen.getByRole("heading",{name:"Seguridad y auditoría"}).closest("section")!;
  await noSeriousAxe(seg,"Seguimiento");
  await noSeriousAxe(por,"Portal");
  await noSeriousAxe(aud,"Auditoría");
 });

 it("accesibilidad (Lote L): las vistas principales del sidebar no tienen violaciones axe serias/críticas",async()=>{
  render(<Workspace/>);
  const nav=async(name:string)=>{
   const btn=screen.getAllByRole("button").find(b=>(b.textContent??"").trim().startsWith(name));
   if(!btn)throw new Error(`No se encontró el acceso «${name}» en el sidebar`);
   fireEvent.click(btn);
   await screen.findByRole("heading",{level:1},{timeout:2500}); // espera a que la vista (lazy) monte su h1
  };
  for(const v of ["Inicio","Pacientes","Agenda","Alergias","Problemas","Vacunas","Signos vitales","Plan de cuidados","Interconsultas","Seguimiento","Configuración"]){
   await nav(v);
   await noSeriousAxe(document.body,v);
  }
 });

 // Ampliación del sweep (refactor UI/UX pro-max): el barrido «Lote L» cubría 11 vistas; aquí se barren las de MÓDULO
 // restantes cableadas al sidebar, que antes no pasaban por axe. Un defecto serio aquí es un defecto que el médico usa a diario.
 it("accesibilidad (ampliación): las vistas de módulo restantes no tienen violaciones axe serias/críticas",async()=>{
  render(<Workspace/>);
  const nav=async(name:string)=>{
   const btn=screen.getAllByRole("button").find(b=>(b.textContent??"").trim().startsWith(name));
   if(!btn)throw new Error(`No se encontró el acceso «${name}» en el sidebar`);
   fireEvent.click(btn);
   await screen.findByRole("heading",{level:1},{timeout:2500});
  };
  for(const v of ["Resultados","Medicamentos","Órdenes","Facturación","Documentos","Obligaciones","Clinical Intelligence","Reportes","Biblioteca clínica"]){
   await nav(v);
   await noSeriousAxe(document.body,v);
  }
 });

 // Ampliación del sweep: las SUB-VISTAS del expediente (Patient 360). El «Lote L» no entraba al cockpit; aquí se barre cada
 // pestaña del expediente (Historia/Diagnóstico/Tratamiento/Coordinación/Administración) además del Resumen.
 it("accesibilidad (ampliación): cada sub-vista del expediente (Patient 360) sin violaciones serias/críticas",async()=>{
  render(<Workspace/>);
  await toExpediente();
  await screen.findByText(/Vista principal/,{},{timeout:2500}); // Resumen montado
  const secciones=screen.getByRole("navigation",{name:"Secciones del expediente"});
  for(const t of ["Historia","Diagnóstico","Tratamiento","Coordinación","Administración"]){
   const tab=within(secciones).getByRole("button",{name:t});
   fireEvent.click(tab);
   await noSeriousAxe(document.body,`Expediente · ${t}`);
  }
 });

 it("Patient 360 (Lote B): el expediente se navega por sub-vistas; la Medicación vive en Tratamiento, no en Resumen",async()=>{
  render(<Workspace/>);
  await toExpediente();
  // Al abrir el expediente, la sub-vista por defecto es "Resumen": está el hero, NO el formulario de Medicación.
  await screen.findByText(/Vista principal/,{},{timeout:2500});
  expect(screen.queryByRole("button",{name:"Proponer medicación"})).toBeNull(); // oculto en otra sub-vista
  // Al cambiar a "Tratamiento", aparece la Medicación y se oculta el panel de Resumen (Portal del paciente).
  fireEvent.click(screen.getByRole("button",{name:"Tratamiento"}));
  expect(await screen.findByRole("button",{name:"Proponer medicación"})).toBeTruthy();
  expect(screen.queryByRole("heading",{name:"Portal del paciente"})).toBeNull();
  // La sub-vista se refleja en la URL (?s=) para que el enlace sea compartible.
  expect(window.location.search).toContain("s=tratamiento");
 });

 // Lote 11, hallazgo D11a: un valor rechazado por el servidor NO se anuncia como guardado, y el reintento reutiliza la misma
 // captura (mismo vitalId y hora): sin duplicados. Revisión (F3): lo ya guardado sale del formulario y no se reenvía.
 it("D11a — Signos vitales: rechazo del servidor visible y reintento sin duplicados",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Signos vitales"}));await elegirPaciente();
  const before=posted.length;
  fireEvent.change(screen.getByPlaceholderText("72"),{target:{value:"78"}});
  fireEvent.change(screen.getByPlaceholderText("36.5"),{target:{value:"999"}});
  fireEvent.click(screen.getByRole("button",{name:/Guardar signos vitales/}));
  expect(await screen.findByText(/NO guardados: TEMP/)).toBeTruthy();
  expect(screen.queryByText(/Signos vitales guardados ✓/)).toBeNull();
  expect((screen.getByPlaceholderText("72") as HTMLInputElement).value).toBe(""); // FC guardada: ya no está en el formulario
  fireEvent.change(screen.getByPlaceholderText("36.5"),{target:{value:"36.8"}});
  fireEvent.click(screen.getByRole("button",{name:/Guardar signos vitales/}));
  expect(await screen.findByText(/Signos vitales guardados ✓/)).toBeTruthy();
  const vit=posted.slice(before).filter(p=>p.path==="/api/v1/vitals").map(p=>({...(p.body as{vitalId:string;vitalType:string;occurredAt:string}),idem:p.idem}));
  const hr=vit.filter(v=>v.vitalType==="HR"),temp=vit.filter(v=>v.vitalType==="TEMP");
  expect(hr.length).toBe(1);
  expect(temp.length).toBe(2);expect(temp[0]!.vitalId).toBe(temp[1]!.vitalId);expect(temp[0]!.occurredAt).toBe(temp[1]!.occurredAt);
  // Revisión (F6): también la Idempotency-Key del reintento es la misma, y distinta entre tipos.
  expect(temp[0]!.idem).toBeTruthy();expect(temp[0]!.idem).toBe(temp[1]!.idem);expect(hr[0]!.idem).not.toBe(temp[0]!.idem);
 });
 // Revisión del lote 11 (F3/F6): un crítico guardado se informa aunque otro vital se rechace; una lectura distinta de un tipo ya
 // guardado en la toma NO se crea como segunda observación; «Limpiar» termina la toma (la siguiente es otra).
 // Revisión del porte (c44dd6c): esa lectura distinta es una CORRECCIÓN y se hace ahí mismo: se pide el motivo y se enmienda el
 // vital ya guardado (mismo vitalId, If-Match de su versión). Antes se remitía a un «Enmendar» del historial que no existe.
 it("D11a — Signos vitales: críticos siempre visibles, la corrección enmienda el vital guardado y «Limpiar» inicia otra toma",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Signos vitales"}));await elegirPaciente();
  const before=posted.length;
  const vitals=()=>posted.slice(before).filter(p=>p.path==="/api/v1/vitals").map(p=>p.body as{vitalId:string;vitalType:string;value:string});
  const amends=()=>posted.slice(before).filter(p=>p.path.endsWith("/amendment"));
  fireEvent.change(screen.getByPlaceholderText("72"),{target:{value:"180"}});
  fireEvent.change(screen.getByPlaceholderText("36.5"),{target:{value:"999"}});
  fireEvent.click(screen.getByRole("button",{name:/Guardar signos vitales/}));
  expect(await screen.findByText(/NO guardados: TEMP.*1 crítico\(s\): HR 180: Taquicardia extrema/)).toBeTruthy();
  const firstHr=vitals().find(v=>v.vitalType==="HR")!.vitalId;
  fireEvent.change(screen.getByPlaceholderText("72"),{target:{value:"90"}});
  fireEvent.change(screen.getByPlaceholderText("36.5"),{target:{value:"36.8"}});
  fireEvent.click(screen.getByRole("button",{name:/Guardar signos vitales/}));
  // Sin motivo no se enmienda, y el mensaje lo dice (no remite a ningún otro lugar).
  let dlg=within(await screen.findByRole("dialog",{name:/Motivo de la corrección de HR: 180 lpm → 90 lpm/}));
  fireEvent.click(dlg.getByRole("button",{name:"Cancelar"}));
  expect(await screen.findByText(/HR: en esta toma ya se guardó 180 lpm; la corrección a 90 lpm no se envió porque enmendar exige el motivo/)).toBeTruthy();
  expect(amends()).toEqual([]);
  expect(vitals().filter(v=>v.vitalType==="HR").map(v=>v.value)).toEqual(["180"]); // nunca una segunda observación
  // Con motivo: enmienda del MISMO vital, con el valor corregido y su versión; el crítico deja de anunciarse.
  fireEvent.click(screen.getByRole("button",{name:/Guardar signos vitales/}));
  dlg=within(await screen.findByRole("dialog",{name:/Motivo de la corrección de HR/}));
  fireEvent.change(dlg.getByLabelText(/Motivo de la corrección de HR/),{target:{value:"Error de captura: se tecleó 180"}});
  fireEvent.click(dlg.getByRole("button",{name:"Registrar"}));
  expect(await screen.findByText(/Signos vitales guardados ✓/)).toBeTruthy();
  expect(screen.queryByText(/crítico\(s\)/)).toBeNull();
  expect(amends().map(a=>({path:a.path,ifMatch:a.ifMatch,value:(a.body as{value:string}).value,unit:(a.body as{unit:string}).unit,reason:(a.body as{reason:string}).reason})))
   .toEqual([{path:`/api/v1/vitals/${firstHr}/amendment`,ifMatch:1,value:"90",unit:"lpm",reason:"Error de captura: se tecleó 180"}]);
  expect(vitals().filter(v=>v.vitalType==="HR").map(v=>v.value)).toEqual(["180"]);
  fireEvent.click(screen.getByRole("button",{name:"Limpiar"}));
  fireEvent.change(screen.getByPlaceholderText("72"),{target:{value:"90"}});
  fireEvent.click(screen.getByRole("button",{name:/Guardar signos vitales/}));
  await waitFor(()=>expect(vitals().filter(v=>v.vitalType==="HR").length).toBe(2));
  const hrs=vitals().filter(v=>v.vitalType==="HR");
  expect(hrs.map(v=>v.value)).toEqual(["180","90"]);expect(hrs[1]!.vitalId).not.toBe(firstHr);
 });
 // Revisión del porte (c44dd6c), F4: la respuesta TARDÍA de un guardado de signos del paciente anterior se descarta entera —ni su
 // mensaje (ni su crítico), ni el borrado del formulario— en cada espera: el POST, la lectura del historial posterior y la Consulta.
 const cambiarAPaciente2=async()=>{const opt=await screen.findByRole("option",{name:"Carlos Mendoza"});fireEvent.change(opt.closest("select")!,{target:{value:"p2"}});};
 for(const ventana of["POST /vitals","GET del historial","error de red del POST"] as const){
  it(`D11b — Signos vitales: la respuesta tardía (${ventana}) del paciente anterior no llega al nuevo`,async()=>{
   let soltar!:()=>void;const g=new Promise<void>((ok,ko)=>{soltar=ventana==="error de red del POST"?()=>ko(new Error("Failed to fetch")):ok;});
   if(ventana==="GET del historial")gate.vitalsHist=g;else gate.vitalsPost=g;
   render(<Workspace/>);
   fireEvent.click(screen.getByRole("button",{name:"Signos vitales"}));await elegirPaciente();
   const before=posted.length;
   fireEvent.change(screen.getByPlaceholderText("72"),{target:{value:"180"}});
   fireEvent.click(screen.getByRole("button",{name:/Guardar signos vitales/}));
   await waitFor(()=>expect(posted.slice(before).some(p=>p.path==="/api/v1/vitals")).toBe(true));
   await cambiarAPaciente2();
   await waitFor(()=>expect((screen.getByPlaceholderText("72") as HTMLInputElement).value).toBe(""));
   fireEvent.change(screen.getByPlaceholderText("36.5"),{target:{value:"37.2"}}); // lo que el médico ya tecleó para el paciente nuevo
   soltar();await new Promise(r=>setTimeout(r,30));gate.vitalsPost=null;gate.vitalsHist=null;
   await waitFor(()=>expect((screen.getByRole("button",{name:/Guardar signos vitales/}) as HTMLButtonElement).disabled).toBe(false));
   expect(screen.queryByText(/Signos vitales guardados ✓/)).toBeNull();
   expect(screen.queryByText(/Sin conexión con el servidor/)).toBeNull();
   expect(screen.queryByText(/crítico\(s\)/)).toBeNull();
   expect((screen.getByPlaceholderText("36.5") as HTMLInputElement).value).toBe("37.2");
   // La toma del paciente anterior tampoco se hereda: la FC del nuevo es una observación NUEVA suya, no una corrección de la otra.
   const hrA=posted.slice(before).find(p=>p.path==="/api/v1/vitals"&&(p.body as{vitalType:string}).vitalType==="HR")!.body as{vitalId:string};
   fireEvent.change(screen.getByPlaceholderText("72"),{target:{value:"88"}});
   fireEvent.click(screen.getByRole("button",{name:/Guardar signos vitales/}));
   expect(await screen.findByText(/Signos vitales guardados ✓/)).toBeTruthy();
   const hrB=posted.slice(before).filter(p=>p.path==="/api/v1/vitals"&&(p.body as{vitalType:string}).vitalType==="HR").map(p=>p.body as{vitalId:string;patientId:string;value:string});
   expect(hrB.map(v=>[v.patientId,v.value])).toEqual([["p1","180"],["p2","88"]]);expect(hrB[1]!.vitalId).not.toBe(hrA.vitalId);
   expect(posted.slice(before).filter(p=>p.path.endsWith("/amendment"))).toEqual([]);
  });
 }
 for(const ventana of["respuesta","error de red"] as const)
 it(`D11b — Consulta: ${ventana==="respuesta"?"la respuesta tardía":"el error de red tardío"} del guardado de signos del paciente anterior no llega al nuevo`,async()=>{
  let soltar!:()=>void;gate.vitalsPost=new Promise<void>((ok,ko)=>{soltar=ventana==="error de red"?()=>ko(new Error("Failed to fetch")):ok;});
  render(<Workspace/>);
  await abrirConsulta();
  const before=posted.length;
  fireEvent.change(screen.getByLabelText("FC (lpm)"),{target:{value:"180"}});
  fireEvent.click(screen.getByRole("button",{name:"Guardar signos vitales"}));
  await waitFor(()=>expect(posted.slice(before).some(p=>p.path==="/api/v1/vitals")).toBe(true));
  fireEvent.click(screen.getByTitle("Volver al panel de consultas"));
  fireEvent.change(await screen.findByLabelText("Buscar paciente"),{target:{value:"Carlos"}});
  fireEvent.click(await screen.findByRole("button",{name:/Carlos Mendoza/},{timeout:2000}));
  fireEvent.change(await screen.findByLabelText("FC (lpm)"),{target:{value:"88"}});
  soltar();await new Promise(r=>setTimeout(r,30));
  await waitFor(()=>expect((screen.getByRole("button",{name:"Guardar signos vitales"}) as HTMLButtonElement).disabled).toBe(false));
  expect(screen.queryByText(/Signos vitales guardados ✓/)).toBeNull();
  expect(screen.queryByText(/Sin conexión con el servidor/)).toBeNull();
  expect(screen.queryByText(/crítico\(s\)/)).toBeNull();
  expect((screen.getByLabelText("FC (lpm)") as HTMLInputElement).value).toBe("88");
 });
 // Revisión del lote 11 (F4): cambiar de paciente vacía también el formulario y el mensaje de Signos vitales.
 it("D11b — Signos vitales: cambiar de paciente vacía el formulario y el mensaje del anterior",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Signos vitales"}));await elegirPaciente();
  fireEvent.change(screen.getByPlaceholderText("72"),{target:{value:"78"}});
  fireEvent.change(screen.getByPlaceholderText("36.5"),{target:{value:"999"}});
  fireEvent.click(screen.getByRole("button",{name:/Guardar signos vitales/}));
  expect(await screen.findByText(/NO guardados: TEMP/)).toBeTruthy();
  const opt=await screen.findByRole("option",{name:"Carlos Mendoza"});fireEvent.change(opt.closest("select")!,{target:{value:"p2"}});
  await waitFor(()=>expect(screen.queryByText(/NO guardados: TEMP/)).toBeNull());
  expect((screen.getByPlaceholderText("36.5") as HTMLInputElement).value).toBe("");
 });
 // D11b (F4), aislado de D11a: lo tecleado y NO guardado para el paciente anterior tampoco pasa al nuevo (antes «Guardar» lo
 // habría enviado al paciente recién seleccionado).
 it("D11b — Signos vitales: lo tecleado sin guardar no sobrevive al cambio de paciente",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Signos vitales"}));await elegirPaciente();
  fireEvent.change(screen.getByPlaceholderText("72"),{target:{value:"78"}});
  fireEvent.change(screen.getByPlaceholderText("36.5"),{target:{value:"37.9"}});
  const opt=await screen.findByRole("option",{name:"Carlos Mendoza"});fireEvent.change(opt.closest("select")!,{target:{value:"p2"}});
  await waitFor(()=>expect((screen.getByPlaceholderText("72") as HTMLInputElement).value).toBe(""));
  expect((screen.getByPlaceholderText("36.5") as HTMLInputElement).value).toBe("");
 });
 // Lote 11, hallazgo D11b: teclear otro id de paciente es un cambio de paciente completo (nada del anterior queda en pantalla).
 // Patient 360: las secciones se ocultan por pestaña, así que la aserción negativa se hace DE VUELTA en «Tratamiento» (si no,
 // pasaría en falso por estar oculta la medicación).
 it("D11b — Expediente: teclear otro id de paciente vacía los datos del paciente anterior",async()=>{
  render(<Workspace/>);
  await toExpediente();
  const secciones=()=>within(screen.getByRole("navigation",{name:"Secciones del expediente"}));
  fireEvent.click(secciones().getByRole("button",{name:"Tratamiento"}));
  const form=within((await screen.findByRole("button",{name:"Proponer medicación"})).closest("section")!);
  fireEvent.change(form.getByPlaceholderText(/Fármaco \(ej\./),{target:{value:"ibuprofeno-400"}});
  fireEvent.change(form.getByPlaceholderText(/Dosis \(500mg\)/),{target:{value:"400"}});
  fireEvent.change(form.getByPlaceholderText("Vía"),{target:{value:"VO"}});
  fireEvent.change(form.getByPlaceholderText(/Frecuencia \(c\/8h\)/),{target:{value:"c/8h"}});
  fireEvent.click(form.getByRole("button",{name:"Proponer medicación"}));
  expect(await screen.findByRole("button",{name:"Prescribir"})).toBeTruthy(); // medicación del paciente A en pantalla
  fireEvent.click(secciones().getByRole("button",{name:"Historia"}));
  fireEvent.change(await screen.findByLabelText(/ID de paciente|Identificador del paciente/),{target:{value:"22222222-2222-4222-8222-222222222222"}});
  fireEvent.click(secciones().getByRole("button",{name:"Tratamiento"}));
  expect(await screen.findByRole("button",{name:"Proponer medicación"})).toBeTruthy(); // de vuelta en la pestaña de la medicación
  await waitFor(()=>expect(screen.queryByRole("button",{name:"Prescribir"})).toBeNull());
 });
 // Lote 11, hallazgo D11c: ningún dato de un evento permanente se inventa en el cliente; los pide el diálogo U-16.
 it("D11c — acciones: lote/sitio, firmante, códigos, referencia de pago y destino al alta se piden, no se inventan",async()=>{
  const{immActions,csActions,clmActions,admActions,isAsk}=await import("../../apps/web/app/workspace/shared");
  const asks=(b:Record<string,unknown>,k:string)=>{const v=b[k];return Array.isArray(v)?v.every(isAsk):isAsk(v);};
  const imm=immActions({id:"i1",state:"DUE"})[0]!.body;expect(asks(imm,"lot")&&asks(imm,"site")).toBe(true);
  const cs=csActions({id:"c1",state:"PRESENTED"})[0]!.body;expect(asks(cs,"signerName")).toBe(true);
  // F2: el rol del firmante es explícito en cada acción (paciente o tutor), nunca el valor por defecto del servidor.
  expect(csActions({id:"c1",state:"PRESENTED"}).filter(a=>a.path.endsWith("/grant")).map(a=>a.body["signerRole"])).toEqual(["PATIENT","GUARDIAN"]);
  // F5: el estadio re-valorado de una herida y la resolución de un incidente también se piden.
  const{wnActions,incActions}=await import("../../apps/web/app/workspace/shared");
  const re=wnActions({id:"w1",state:"OPEN"}).find(a=>a.path.endsWith("/reassessment"))!.body;expect(asks(re,"stage")).toBe(true);
  const res=incActions({id:"n1",state:"REPORTED"}).find(a=>a.path.endsWith("/resolution"))!.body;expect(asks(res,"resolution")).toBe(true);
  const code=clmActions({id:"x",state:"DRAFT"})[0]!.body;expect(asks(code,"codes")).toBe(true);
  const pay=clmActions({id:"x",state:"SUBMITTED"})[0]!.body;expect(asks(pay,"reference")).toBe(true);
  const dis=admActions({id:"a1",state:"ADMITTED"}).find(a=>a.label==="Dar de alta")!.body;expect(asks(dis,"disposition")).toBe(true);
  expect(JSON.stringify([imm,cs,code,pay,dis,re,res])).not.toMatch(/L-2026-A|Paciente\/Tutor|99213|EOB-|Alta a domicilio|CAPA implementada/);
 });
 // Revisión del lote 11 (F1): las acciones genéricas de las tablas resuelven sus ASK con el diálogo U-16 antes de enviar; antes
 // mandaban el marcador tal cual y el servidor respondía 400 (y D11c lo habría extendido a «Aplicar»).
 it("D11c — «Aplicar» vacuna pide lote y sitio en el diálogo y envía exactamente lo escrito",async()=>{
  render(<Workspace/>);
  await toExpediente();
  fireEvent.click(within(screen.getByRole("navigation",{name:"Secciones del expediente"})).getByRole("button",{name:"Tratamiento"}));
  fireEvent.change(await screen.findByPlaceholderText(/Vacuna \(ej\. SRP/),{target:{value:"SRP"}});
  fireEvent.click(screen.getByRole("button",{name:"Indicar vacuna"}));
  fireEvent.click(await screen.findByRole("button",{name:"Aplicar"}));
  const lote=within(await screen.findByRole("dialog",{name:/Lote de la vacuna aplicada/}));
  fireEvent.change(lote.getByLabelText(/Lote de la vacuna aplicada/),{target:{value:"AB1234"}});
  fireEvent.click(lote.getByRole("button",{name:"Registrar"}));
  const sitio=within(await screen.findByRole("dialog",{name:/Sitio de aplicación/}));
  fireEvent.change(sitio.getByLabelText(/Sitio de aplicación/),{target:{value:"deltoides izquierdo"}});
  fireEvent.click(sitio.getByRole("button",{name:"Registrar"}));
  await waitFor(()=>expect(posted.some(p=>p.path.endsWith("/administration"))).toBe(true));
  const sent=posted.filter(p=>p.path.endsWith("/administration")).at(-1)?.body as{lot?:unknown;site?:unknown};
  expect(sent).toMatchObject({lot:"AB1234",site:"deltoides izquierdo"});
 });
 // Revisión del porte (c44dd6c): «Enmendar» un signo vital pide el valor CORREGIDO y lo envía (antes reenviaba el valor ya
 // registrado y solo pedía el motivo: la «enmienda» no corregía nada).
 it("Expediente — «Enmendar» un signo vital pide y envía el valor corregido, no el registrado",async()=>{
  render(<Workspace/>);
  await toExpediente();
  fireEvent.click(within(screen.getByRole("navigation",{name:"Secciones del expediente"})).getByRole("button",{name:"Diagnóstico"}));
  fireEvent.change(await screen.findByLabelText("Tipo de signo vital"),{target:{value:"HR"}});
  fireEvent.change(screen.getByLabelText("Valor de HR"),{target:{value:"180"}});
  fireEvent.click(screen.getByRole("button",{name:"Registrar signo vital"}));
  fireEvent.click(await screen.findByRole("button",{name:"Enmendar"}));
  const valor=within(await screen.findByRole("dialog",{name:/Valor corregido \(lpm\); registrado: 180/}));
  fireEvent.change(valor.getByLabelText(/Valor corregido/),{target:{value:"80"}});
  fireEvent.click(valor.getByRole("button",{name:"Registrar"}));
  const motivo=within(await screen.findByRole("dialog",{name:/Motivo de la corrección/}));
  fireEvent.change(motivo.getByLabelText(/Motivo de la corrección/),{target:{value:"Error de captura"}});
  fireEvent.click(motivo.getByRole("button",{name:"Registrar"}));
  await waitFor(()=>expect(posted.some(p=>p.path.endsWith("/amendment")&&p.path.startsWith("/api/v1/vitals/"))).toBe(true));
  const sent=posted.filter(p=>p.path.startsWith("/api/v1/vitals/")&&p.path.endsWith("/amendment")).at(-1)?.body;
  expect(sent).toMatchObject({value:"80",unit:"lpm",reason:"Error de captura"});
 });
 // Exclusivo de main (D11c-F1): acciones que YA llevaban ASK en main y aun así lo enviaban sin resolver (400 del servidor), p. ej.
 // «Rechazar» una vacuna: ahora el diálogo pide el motivo y se envía exactamente lo escrito; cancelar no envía nada.
 it("D11c-F1 — «Rechazar» vacuna (acción genérica con ASK) pide el motivo y no envía el marcador ASK",async()=>{
  render(<Workspace/>);
  await toExpediente();
  fireEvent.click(within(screen.getByRole("navigation",{name:"Secciones del expediente"})).getByRole("button",{name:"Tratamiento"}));
  fireEvent.change(await screen.findByPlaceholderText(/Vacuna \(ej\. SRP/),{target:{value:"Influenza"}});
  fireEvent.click(screen.getByRole("button",{name:"Indicar vacuna"}));
  const refusals=()=>posted.filter(p=>p.path.endsWith("/refusal"));const n0=refusals().length;
  fireEvent.click(await screen.findByRole("button",{name:"Rechazar"}));
  const cancel=within(await screen.findByRole("dialog",{name:/Motivo del rechazo/}));
  fireEvent.click(cancel.getByRole("button",{name:"Cancelar"}));
  await waitFor(()=>expect(screen.queryByRole("dialog",{name:/Motivo del rechazo/})).toBeNull());
  expect(refusals().length).toBe(n0); // cancelado: no se envía nada
  fireEvent.click(await screen.findByRole("button",{name:"Rechazar"}));
  const dlg=within(await screen.findByRole("dialog",{name:/Motivo del rechazo/}));
  fireEvent.change(dlg.getByLabelText(/Motivo del rechazo/),{target:{value:"La madre prefiere aplazarla a la próxima consulta"}});
  fireEvent.click(dlg.getByRole("button",{name:"Registrar"}));
  await waitFor(()=>expect(refusals().length).toBe(n0+1));
  const body=refusals().at(-1)!.body as{reason?:unknown};
  expect(body.reason).toBe("La madre prefiere aplazarla a la próxima consulta");
 });
 // Revisión del lote 11 (F5): un dato de vocabulario cerrado se ELIGE en el diálogo (ASK_CHOICE), no se inventa.
 it("F5 — «Re-valorar» herida pide el estadio entre las opciones del fold y envía el elegido",async()=>{
  flags.hospital=true;
  try{
  render(<Workspace/>);
  await toExpediente();
  fireEvent.click(await within(screen.getByRole("navigation",{name:"Secciones del expediente"})).findByRole("button",{name:"Hospital"},{timeout:2500}));
  fireEvent.click(await screen.findByRole("button",{name:"Documentar herida"},{timeout:2500}));
  fireEvent.click(await screen.findByRole("button",{name:"Re-valorar"}));
  const dlg=within(await screen.findByRole("dialog",{name:/Estadio de la herida/}));
  const sel=dlg.getByLabelText(/Estadio de la herida/) as HTMLSelectElement;
  expect([...sel.options].map(o=>o.value)).toEqual(["","STAGE_1","STAGE_2","STAGE_3","STAGE_4","UNSTAGEABLE","DTI"]);
  expect((dlg.getByRole("button",{name:"Registrar"}) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.change(sel,{target:{value:"STAGE_2"}});
  fireEvent.click(dlg.getByRole("button",{name:"Registrar"}));
  await waitFor(()=>expect(posted.some(p=>p.path.endsWith("/reassessment"))).toBe(true));
  expect(posted.filter(p=>p.path.endsWith("/reassessment")).at(-1)?.body).toMatchObject({stage:"STAGE_2"});
  }finally{flags.hospital=false;}
 });

 // Último test: el deep-link carga el expediente completo (asíncrono y pesado); va al final para no contaminar
 // el orden de otros tests aunque la URL se resetee en afterEach.
 it("deep-link (Lote B): con ?p=<paciente> en la URL, al montar se restaura el foco del paciente",async()=>{
  window.history.replaceState(null,"","/?p=p1&v=exp");
  render(<Workspace/>);
  expect((await screen.findAllByText(/Ana López García/,{},{timeout:2500})).length).toBeGreaterThan(0);
 });
});
