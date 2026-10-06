// Harness compartido de las pruebas de render del cockpit (jsdom). Extraído de ui-cockpit-render.test.tsx para PARTIR el
// monolito en varios archivos y paralelizarlos en los cores. No es un *.test.tsx: solo mock, entorno y helpers. Cada archivo
// de test hace su propio vi.mock delegando en makeSessionClientMock (ver split-cockpit).
import{expect,beforeAll,afterEach}from"vitest";
import{cleanup,fireEvent,screen}from"@testing-library/react";
import axe from"axe-core";
void expect;void fireEvent;
// Mock del cliente de sesión/HTTP parametrizado por el sink `posted` (cada archivo tiene el suyo para afirmar sus POST).
export function makeSessionClientMock(posted:{path:string;body:unknown}[]){
 return ({
  getStoredSession:()=>({sessionId:"testsession0001",expiresAt:Math.floor(Date.now()/1000)+3600,tokenType:"Bearer"}),
  logout:async()=>{},
  apiUpload:async()=>({status:201,body:{version:1}}),
  apiDelete:async()=>({status:200,body:{removed:true,version:1}}),
  apiDownload:async()=>null,
  apiRequest:async(path:string,init?:{method?:string;body?:unknown})=>{
   if(init?.method==="POST")posted.push({path,body:init.body});
   if(path.includes("/api/v1/vitals")){
    if(init?.method==="POST")return{status:201,body:{version:1,status:"NORMAL",interpretation:""}};
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
   // Repositorio persistente del paciente (submenú Documentos del expediente): lista para el read-model docsSnap.
   if(path.match(/\/api\/v1\/patients\/[^/]+\/documents$/))return{status:200,body:{items:[{documentId:"dc1",title:"Nota de evolución",docType:"PROGRESS_NOTE",typeLabel:"Nota médica",status:"SIGNED",statusLabel:"Firmado",createdAt:"2026-09-17T00:00:00Z",actorId:"u1"}],total:1,byType:{["Nota médica"]:1},chips:{clinical:1,consents:0,studies:0}}};
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
   // Auditoría clínica multiespecialidad (06-oct-2026) — EL LECTOR DE LA NOTA.
   // El índice de consultas del paciente (metadatos con fecha) y la nota de una consulta (la valoración y el plan que se
   // firmaron). Van ANTES de la regla genérica de `/api/v1/encounters`, que si no se los comería devolviendo 201.
   if(/\/api\/v1\/patients\/[^/]+\/encounters$/.test(path))return{status:200,body:{patientId:"p1",total:2,items:[
    {encounterId:"e1",status:"SIGNED",version:3,openedAt:"2026-09-18T15:20:00.000Z",lastAt:"2026-09-18T15:52:00.000Z",signedAt:"2026-09-18T15:52:00.000Z",hasNote:true},
    {encounterId:"e0",status:"OPENED",version:1,openedAt:"2026-06-02T09:05:00.000Z",lastAt:"2026-06-02T09:05:00.000Z",signedAt:null,hasNote:false},
   ]}};
   if(/\/api\/v1\/encounters\/e1\/note$/.test(path))return{status:200,body:{encounterId:"e1",patientId:"p1",status:"SIGNED",version:3,
    openedAt:"2026-09-18T15:20:00.000Z",
    assessment:"DM2 descontrolada: HbA1c 8.2 %. ERC G3a estable, TFG 48.",
    plan:"Subir metformina a 850 mg c/12 h. HbA1c y creatinina en 3 meses.",
    signedAt:"2026-09-18T15:52:00.000Z",signatureDigest:"d1g3st0deprueba0000",contentHash:"c0ntenthash0deprueba",
    signer:{fullName:"Dra. Laura Hernández",cedulaProfesional:"7654321",specialty:"Medicina Interna"},
    amendments:[{at:"2026-09-19T11:00:00.000Z",text:"Se corrige la TFG: 46, no 48.",reason:"Error de transcripción del laboratorio"}]}};
   if(/\/api\/v1\/encounters\/e0\/note$/.test(path))return{status:200,body:{encounterId:"e0",patientId:"p1",status:"OPENED",version:1,
    openedAt:"2026-06-02T09:05:00.000Z",assessment:null,plan:null,signedAt:null,signatureDigest:null,contentHash:null,signer:null,amendments:[]}};
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
     {resultId:"r1",patientId:"p1",patientName:"Ana López García",analyte:"GLUCOSE",value:"520",critical:true,status:"CRITICAL",interpretation:"Hiperglucemia de pánico",tipo:"Laboratorio",estado:"Hallazgos",lifecycle:"RECEIVED",receivedAt:"2026-09-17T00:00:00Z"},
     {resultId:"r2",patientId:"p2",patientName:"Carlos Mendoza",analyte:"CREATININE",value:"0.9",critical:false,status:"NORMAL",interpretation:"Normal",tipo:"Laboratorio",estado:"En seguimiento",lifecycle:"ACTIONED",receivedAt:"2026-09-16T00:00:00Z"},
    ],total:2,abnormal:1,enSeguimiento:1,pendientes:1}};
   if(path.includes("/api/v1/reports"))return{status:200,body:{patientsAttended:248,income:124680,diagnosesTotal:159,topDiagnoses:[{code:"E11.9",description:"Diabetes mellitus tipo 2",count:42,pct:13},{code:"I10",description:"Hipertensión esencial",count:38,pct:12}],ordersTotal:24,ordersByType:[{type:"LAB",label:"Laboratorio",count:14,pct:58},{type:"IMAGING",label:"Imagenología",count:6,pct:25},{type:"PROCEDURE",label:"Procedimiento",count:4,pct:17}],topProcedures:[{detail:"Electrocardiograma",count:3,pct:75},{detail:"Curación simple",count:1,pct:25}],resultsTotal:37,immunizationsApplied:12,encountersTotal:221,encountersSigned:198,encountersByDay:[{date:"2026-09-01",count:12,pct:80},{date:"2026-09-02",count:15,pct:100}],prescriptionsTotal:64,topMedications:[{drugCode:"paracetamol",count:22,pct:34},{drugCode:"metformina",count:14,pct:22}],appointmentsTotal:120,appointmentsByType:[{type:"CONTROL",label:"Control",count:54,pct:45},{type:"PRIMERA_VEZ",label:"Primera vez",count:30,pct:25},{type:"VACUNACION",label:"Vacunación",count:20,pct:17}],qualityIndicators:[{key:"closed_records",label:"Expedientes cerrados (notas firmadas)",numerator:198,denominator:221,pct:90,target:90,direction:"higher",met:true,computable:true,note:""},{key:"attendance",label:"Asistencia efectiva",numerator:96,denominator:120,pct:80,target:80,direction:"higher",met:true,computable:true,note:""},{key:"no_show",label:"Inasistencia (no-show)",numerator:18,denominator:120,pct:15,target:10,direction:"lower",met:false,computable:true,note:""},{key:"glycemic_control",label:"HbA1c en control (<7%)",numerator:0,denominator:0,pct:0,target:70,direction:"higher",met:false,computable:false,note:""}]}};
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
   // Auditoría clínica multiespecialidad (06-oct-2026) — EL EXPEDIENTE VIVO, CON FECHAS.
   // Hasta hoy el harness no mockeaba `/chart`, así que las pruebas de UI solo veían filas creadas en la propia sesión y
   // ninguna fila HIDRATADA del servidor. Es justo donde vivía el defecto: las filas imprimían `v{version}` en el lugar
   // donde va la fecha. Un dato clínico sin fecha no se puede valorar, y sin este mock no había forma de probarlo.
   // `createdAt` ≠ `at` en la medicación suspendida (se prescribió en marzo, se suspendió en septiembre) y coinciden en la
   // alergia, que nadie tocó: son los dos casos que la pantalla distingue.
   if(/\/consents\/[^/]+\/presentation$/.test(path))return{status:201,body:{state:"PRESENTED",version:2}};
   if(/\/consents\/[^/]+\/grant$/.test(path))return{status:201,body:{state:"GRANTED",version:3}};
   if(/\/vitals\/[^/]+\/amendment$/.test(path))return{status:201,body:{state:"AMENDED",version:2,status:"NORMAL",interpretation:"Frecuencia cardíaca normal"}};
   if(path.includes("/chart"))return{status:200,body:{
    problems:[{id:"pb1",label:"Diabetes mellitus tipo 2 (E11.9)",state:"CHRONIC",version:2,createdAt:"2019-03-12T16:00:00.000Z",at:"2019-03-12T16:00:00.000Z"}],
    allergies:[{id:"al1",label:"penicilina — exantema",state:"ACTIVE",version:1,createdAt:"2017-07-04T15:30:00.000Z",at:"2017-07-04T15:30:00.000Z"}],
    medications:[{id:"md1",label:"metformina 850 mg",state:"STOPPED",version:4,createdAt:"2026-03-02T16:10:00.000Z",at:"2026-09-18T15:40:00.000Z"}],
    vitals:[{id:"vt1",vitalType:"BP",value:"128/78",unit:"mmHg",state:"RECORDED",version:1,vstatus:"NORMAL",interp:"",createdAt:"2026-09-18T15:25:00.000Z",at:"2026-09-18T15:25:00.000Z"}],
    immunizations:[{id:"im1",label:"Influenza · dosis 1",state:"DUE",version:1,createdAt:"2026-09-01T14:00:00.000Z",at:"2026-09-01T14:00:00.000Z"}],
    orders:[{id:"or1",label:"LAB: HbA1c",state:"FULFILLED",version:3,createdAt:"2026-09-18T15:30:00.000Z",at:"2026-09-25T14:00:00.000Z"}],
    results:[{id:"rs1",label:"HBA1C: 8.2",critical:false,state:"VERIFIED",version:2,createdAt:"2026-09-25T14:05:00.000Z",at:"2026-09-25T14:20:00.000Z"}],
    obligations:[{id:"ob1",label:"Control de HbA1c",state:"OPEN",version:1,createdAt:"2026-09-25T14:20:00.000Z",at:"2026-09-25T14:20:00.000Z"}],
    referrals:[{id:"rf9",label:"Nefrología: ERC G3a",state:"REQUESTED",version:1,createdAt:"2026-09-18T15:45:00.000Z",at:"2026-09-18T15:45:00.000Z"}],
    appointments:[{id:"ap9",label:"Control · 2026-12-18",state:"SCHEDULED",version:1,createdAt:"2026-09-18T15:50:00.000Z",at:"2026-09-18T15:50:00.000Z"}],
    consents:[{id:"cs9",label:"PROCEDURE",state:"PRESENTED",version:2,createdAt:"2026-09-18T15:35:00.000Z",at:"2026-09-18T15:36:00.000Z",documentRef:"CI-2026-0042",documentHash:"a".repeat(64)},{id:"cs8",label:"ANESTHESIA",state:"PRESENTED",version:2,createdAt:"2026-09-18T15:37:00.000Z",at:"2026-09-18T15:38:00.000Z",documentRef:"CI-2026-0043"},{id:"cs7",label:"DATA_SHARING",state:"DRAFTED",version:1,createdAt:"2026-09-18T15:39:00.000Z",at:"2026-09-18T15:39:00.000Z",documentRef:"CI-2026-0044"}],
    carePlans:[{id:"cp9",label:"DIABETES: HbA1c <7 %",state:"ACTIVE",version:2,createdAt:"2026-03-02T16:15:00.000Z",at:"2026-09-18T15:48:00.000Z"}],
   }};
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
 });
}
// jsdom no implementa estas APIs + limpieza entre tests. Se llama al tope de cada archivo de test.
export function installCockpitEnv(){
 
 
 beforeAll(()=>{
  // jsdom no implementa estas APIs que el cockpit usa (scrollspy / navegación por scroll).
  (globalThis as unknown as{IntersectionObserver:unknown}).IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}takeRecords(){return[];}};
  window.scrollTo=()=>{};
  Element.prototype.scrollIntoView=()=>{};
 });
 afterEach(cleanup);
 // jsdom comparte window.location entre tests del mismo archivo; el deep-link (?p=&v=) de un test contaminaría
 // al siguiente. Reseteamos la URL tras cada test (en producción cada carga tiene su propia URL).
 afterEach(()=>{try{window.history.replaceState(null,"","/");}catch{/* noop */}});
 
}
export const noSeriousAxe=async(node:Element,label:string)=>{
 const r=await axe.run(node,{resultTypes:["violations"]});
 const serious=r.violations.filter(v=>v.impact==="critical"||v.impact==="serious").map(v=>v.id);
 expect(serious,`${label} — violaciones serias: ${JSON.stringify(serious)}`).toEqual([]);
};

// "Consulta" ya no es una puerta del menú: el encuentro es el acto DENTRO del expediente (su pestaña "Consulta", key
// "encuentro"). Para abrir el encuentro se elige paciente, se entra al expediente y se activa esa pestaña.
export const abrirConsulta=async()=>{await toExpediente();fireEvent.click(await screen.findByRole("button",{name:"Consulta"}));};

// Al montar, el workspace abre la vista Inicio. Al EXPEDIENTE (la base completa del paciente) se llega eligiendo un
// paciente y pulsando "Ver expediente →". Los módulos per-paciente ya no son vistas sueltas: viven como submenús del
// expediente. Para elegir paciente usamos el selector global que renderiza la vista "Seguimiento".
// U-12: ya no hay paciente por defecto (antes un UUID aleatorio disparaba cargas a un paciente inexistente): se elige uno.
export const elegirPaciente=async()=>{const opt=await screen.findByRole("option",{name:"Ana López García"});fireEvent.change(opt.closest("select")!,{target:{value:"p1"}});};
// Seguimiento es la vista superviviente que renderiza el selector GLOBAL de paciente (patientSelector) y "Ver expediente →".
// Su botón del sidebar lleva badge, así que se localiza por regex.
export const toExpediente=async()=>{fireEvent.click(screen.getAllByRole("button",{name:/^Seguimiento/})[0]!);await elegirPaciente();fireEvent.click(screen.getByRole("button",{name:/Ver expediente/}));};

