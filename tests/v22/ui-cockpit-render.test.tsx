// @vitest-environment jsdom
import{describe,it,expect,vi,beforeAll,afterEach}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent}from"@testing-library/react";
import axe from"axe-core";
// EPIC CI/CJ/CK — pruebas de RENDER (jsdom) del cockpit del expediente y de los paneles de presentación
// (Seguimiento automático, Portal del paciente, Seguridad y auditoría). Cierran la deuda de "sin render test":
// confirman en el DOM que el shell y los paneles se materializan desde datos deterministas, con semántica
// no-solo-color (estados y "Próximamente" en TEXTO) y sin violaciones de accesibilidad serias detectables.

// Datos canónicos que alimentan la auto-carga del workspace (timeline + care-gaps + snapshot + trends).
vi.mock("../../apps/web/lib/session-client",()=>({
 getStoredSession:()=>({sessionId:"testsession0001",expiresAt:Math.floor(Date.now()/1000)+3600,tokenType:"Bearer"}),
 logout:async()=>{},
 apiRequest:async(path:string)=>{
  if(path.includes("/api/v1/vitals"))return{status:201,body:{version:1,status:"NORMAL",interpretation:""}};
  if(path.includes("/api/v1/care-plans"))return{status:201,body:{version:1}};
  if(path.includes("/api/v1/documents"))return{status:201,body:{version:1}};
  if(path.includes("/api/v1/referrals"))return{status:201,body:{version:1}};
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
    {resultId:"r1",patientId:"p1",patientName:"Ana López García",analyte:"GLUCOSE",value:"520",critical:true,status:"CRITICAL",interpretation:"Hiperglucemia de pánico",tipo:"Laboratorio",estado:"Hallazgos",lifecycle:"RECEIVED",receivedAt:"2026-09-17T00:00:00Z"},
    {resultId:"r2",patientId:"p2",patientName:"Carlos Mendoza",analyte:"CREATININE",value:"0.9",critical:false,status:"NORMAL",interpretation:"Normal",tipo:"Laboratorio",estado:"En seguimiento",lifecycle:"ACTIONED",receivedAt:"2026-09-16T00:00:00Z"},
   ],total:2,abnormal:1,enSeguimiento:1,pendientes:1}};
  if(path.includes("/api/v1/reports"))return{status:200,body:{patientsAttended:248,income:124680,diagnosesTotal:159,topDiagnoses:[{code:"E11.9",description:"Diabetes mellitus tipo 2",count:42,pct:13},{code:"I10",description:"Hipertensión esencial",count:38,pct:12}]}};
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
    {problemId:"q2",patientId:"p2",patientName:"Carlos Mendoza",code:"J45.909",description:"Asma",category:"Respiratorios",chronic:true,status:"CHRONIC",statusLabel:"En seguimiento",recordedAt:"2026-09-05T00:00:00Z",registeredBy:"actor1"},
    {problemId:"q3",patientId:"p3",patientName:"María Torres",code:"K29.70",description:"Gastritis",category:"Digestivos",chronic:false,status:"RESOLVED",statusLabel:"Resuelto",recordedAt:"2026-08-20T00:00:00Z",registeredBy:"actor1"},
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

const noSeriousAxe=async(node:Element,label:string)=>{
 const r=await axe.run(node,{resultTypes:["violations"]});
 const serious=r.violations.filter(v=>v.impact==="critical"||v.impact==="serious").map(v=>v.id);
 expect(serious,`${label} — violaciones serias: ${JSON.stringify(serious)}`).toEqual([]);
};

// Consulta ahora abre un PANEL de consultas; el workspace clínico se abre eligiendo un paciente e "Abrir consulta".
const abrirConsulta=async()=>{fireEvent.click(screen.getByRole("button",{name:"Consulta"}));const opt=await screen.findByRole("option",{name:"Ana López García"});fireEvent.change(opt.closest("select")!,{target:{value:"p1"}});fireEvent.click(screen.getByRole("button",{name:"Abrir consulta"}));};

// Al montar, el workspace abre la vista Inicio (dashboard del consultorio). Para probar los paneles del
// EXPEDIENTE, cambiamos a esa vista pulsando un acceso del sidebar (p.ej. "Pacientes").
// Todos los accesos del sidebar son ahora vistas de nivel-sistema; al expediente crudo (cockpit) se llega
// con el botón "Ver expediente →" de la barra del paciente de un módulo (aquí: Signos vitales).
const toExpediente=()=>{fireEvent.click(screen.getByRole("button",{name:"Signos vitales"}));fireEvent.click(screen.getByRole("button",{name:/Ver expediente/}));};

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
  const task=await screen.findByText("Resultado crítico sin cerrar");
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
  expect(screen.getByText(/Resultados del paciente/)).toBeTruthy();
  fireEvent.click(lastTab(/^Medicamentos$/));
  expect(screen.getByText(/Medicamentos activos/)).toBeTruthy();
  fireEvent.click(lastTab(/^Seguimiento$/));
  expect(screen.getByText(/Tareas de seguimiento/)).toBeTruthy();
 });

 it("vista Órdenes: cableada a /api/v1/orders — KPIs reales, lista, detalle vivo y creador funcional",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Órdenes"}));
  expect(screen.getByRole("heading",{name:"Órdenes"})).toBeTruthy();
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
  expect(screen.getByRole("heading",{name:"Medicamentos"})).toBeTruthy();
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
  fireEvent.click(screen.getByRole("button",{name:"Agenda"}));
  expect(screen.getByRole("heading",{name:"Agenda"})).toBeTruthy();
  // citas reales del registro (aparecen en la rejilla y en "Próximas citas")
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
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
  expect(screen.getByRole("heading",{name:"Agenda"})).toBeTruthy();
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
  // firma real (registro inmutable) → estado SIGNED
  fireEvent.click(screen.getByRole("button",{name:"Firmar consulta"}));
  expect(await screen.findByText(/Encuentro · Firmada/)).toBeTruthy();
  expect(screen.getAllByText(/Consulta firmada/).length).toBeGreaterThan(0);
 });

 it("vista Consulta: interrogatorio y exploración física son campos REALES que alimentan la nota clínica",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  // secciones 4 y 5 ya no son colapsables decorativos: son textareas reales
  fireEvent.change(screen.getByPlaceholderText(/Cardiovascular, respiratorio/),{target:{value:"Cardiopulmonar sin alteraciones"}});
  fireEvent.change(screen.getByPlaceholderText(/Hallazgos de la exploración/),{target:{value:"Abdomen blando, no doloroso"}});
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
  expect(await screen.findByText(/guardados en el expediente/i)).toBeTruthy();
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
  const opt=await screen.findByText(/Diabetes mellitus tipo 2 sin complicaciones/);
  fireEvent.click(opt); // agrega el problema -> POST /problems
  expect(await screen.findByText(/agregado a la lista/i)).toBeTruthy();
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
  fireEvent.click(screen.getByRole("button",{name:"+ Nueva alergia"}));
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
  fireEvent.click(screen.getByRole("button",{name:"+ Registrar vacuna"}));
  expect(screen.getByText(/Sin lote se registra/)).toBeTruthy(); // panel abierto
  await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(screen.getAllByRole("combobox")[0]!,{target:{value:"p1"}}); // paciente
  fireEvent.click(screen.getByRole("button",{name:"Influenza"}));              // vacuna (chip)
  fireEvent.click(screen.getByRole("button",{name:"Registrar vacuna"}));       // sin lote -> pendiente
  expect(await screen.findByText(/Vacuna registrada/)).toBeTruthy();
 });

 it("vista Plan de cuidado: agregar una meta real al plan del paciente (POST /care-plans)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Plan de cuidados"}));
  fireEvent.click(screen.getByRole("button",{name:"+ Nueva meta"}));
  fireEvent.change(screen.getByPlaceholderText(/HbA1c < 7%/),{target:{value:"Bajar 5% de peso en 3 meses"}});
  fireEvent.click(screen.getByRole("button",{name:"Agregar meta"}));
  expect(await screen.findByText(/Meta agregada al plan/)).toBeTruthy();
 });

 it("vista Documentos: crear un documento clínico real (POST /documents)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Documentos"}));
  fireEvent.click(screen.getByRole("button",{name:"+ Nuevo documento"}));
  fireEvent.change(screen.getByPlaceholderText(/Nota de evolución 19/),{target:{value:"Nota de evolución"}});
  fireEvent.change(screen.getByPlaceholderText("Contenido del documento…"),{target:{value:"Paciente estable, continúa tratamiento."}});
  fireEvent.click(screen.getByRole("button",{name:"Crear documento"}));
  expect(await screen.findByText(/Documento creado/)).toBeTruthy();
 });

 it("vista Obligaciones: agregar una obligación regulatoria real (POST /regulatory-obligations)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Obligaciones"}));
  fireEvent.click(screen.getByRole("button",{name:"+ Agregar obligación"}));
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
  fireEvent.click(screen.getByRole("button",{name:/Emitir factura/}));
  expect(await screen.findByText(/Factura emitida/)).toBeTruthy();
 });

 it("vista Interconsultas: enviar una interconsulta real al paciente elegido (POST /referrals)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Interconsultas"}));
  const opt=await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(opt.closest("select")!,{target:{value:"p1"}});           // selector de paciente real
  fireEvent.change(screen.getByPlaceholderText(/Describe el motivo/),{target:{value:"Valoración por endocrinología"}});
  fireEvent.click(screen.getByRole("button",{name:/Enviar interconsulta/}));
  expect(await screen.findByText(/Interconsulta enviada/)).toBeTruthy();
 });

 it("vista Resultados: registrar un resultado real (POST /results, interpretación derivada)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Resultados"}));
  fireEvent.click(screen.getByRole("button",{name:"+ Registrar resultado"}));
  const opt=await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(opt.closest("select")!,{target:{value:"p1"}});          // paciente
  fireEvent.change(screen.getByPlaceholderText("Ej. 520"),{target:{value:"520"}});
  fireEvent.click(screen.getByRole("button",{name:"Registrar resultado"})); // submit
  expect(await screen.findByText(/Resultado registrado/)).toBeTruthy();
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

 it("hero (panel 1) se materializa desde el snapshot: identidad, chips dx y vitales",async()=>{
  render(<Workspace/>);
  toExpediente();
  expect(await screen.findByText(/Vista principal/,{},{timeout:2500})).toBeTruthy();
  expect(screen.getAllByText("HTA").length).toBeGreaterThan(0);     // chip dx desde CIE-10 (I10)
  expect(screen.getAllByText("ERC G3a").length).toBeGreaterThan(0); // N18.3 -> etiqueta
  expect(screen.getAllByText("7.1").length).toBeGreaterThan(0);     // HbA1c en tarjeta de vitales
 });

 it("panel 5 (Seguimiento automático): tabs + estado en TEXTO, no solo color",async()=>{
  render(<Workspace/>);
  toExpediente();
  const h=await screen.findByRole("heading",{name:"Seguimiento automático"},{timeout:2500});
  expect(h).toBeTruthy();
  const sec=h.closest("section")!;
  expect(sec.textContent).toMatch(/Pendientes/);        // tab
  expect(sec.textContent).toMatch(/Seguimiento activo/); // footer Zero-Lost-Follow-Up
 });

 it("panel 6 (Portal del paciente): saludo + features no construidas marcadas 'Próximamente' (verdad clínica)",async()=>{
  render(<Workspace/>);
  toExpediente();
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
  toExpediente();
  await screen.findByText(/Vista principal/,{},{timeout:2500}); // el hero prueba que la auto-carga (timeline incluido) completó
  const sec=screen.getByRole("heading",{name:"Seguridad y auditoría"}).closest("section")!;
  expect(sec.textContent).toMatch(/Estado del sistema/);
  expect(sec.textContent).toMatch(/Actividad reciente/);
  await waitFor(()=>expect(sec.textContent).toMatch(/SIGNED/),{timeout:2500}); // estado del evento en TEXTO (no solo color)
 });

 it("vista Resultados (S7): registro clínica-wide cableado a GET /api/v1/results — KPIs + lista con estado-UI",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Resultados"}));
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
  fireEvent.click(screen.getByRole("button",{name:/^Alertas/}));
  expect(screen.getByText(/Alertas de resultados/)).toBeTruthy();
 });

 it("vista Configuración (S-CONFIG): ajustes del consultorio — secciones, módulos y guardar",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Configuración/}));           // acceso en HERRAMIENTAS
  expect(screen.getByRole("heading",{name:"Configuración"})).toBeTruthy();
  expect(screen.getByText("Información del consultorio")).toBeTruthy();
  expect(screen.getByText("Preferencias de consulta")).toBeTruthy();
  expect(screen.getByText("Horarios de atención")).toBeTruthy();
  expect(screen.getByText("Módulos activos")).toBeTruthy();
  expect(screen.getByText(/NOM-024/)).toBeTruthy();                                // nota de seguridad
  const save=screen.getByRole("button",{name:/Guardar cambios/});
  fireEvent.click(save);
  expect(await screen.findByText(/Cambios guardados/,{},{timeout:2000})).toBeTruthy();
 });

 it("vista Biblioteca Clínica (S-BIBLIOTECA): repositorio de conocimiento + herramientas reales enlazadas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/Biblioteca clínica/}));       // acceso en HERRAMIENTAS
  expect(screen.getByRole("heading",{name:"Biblioteca Clínica"})).toBeTruthy();
  expect(screen.getByText("Guías y protocolos")).toBeTruthy();                    // KPI
  expect(screen.getByText("Especialidades")).toBeTruthy();
  expect(screen.getByText("Contenido destacado")).toBeTruthy();
  expect(screen.getAllByText("Diabetes mellitus tipo 2").length).toBeGreaterThan(0); // tarjeta destacada
  expect(screen.getByText("Herramientas rápidas")).toBeTruthy();
  expect(screen.getByText("Fuentes confiables")).toBeTruthy();
  expect(screen.getByText(/Conocimiento que mejora vidas/)).toBeTruthy();
 });

 it("vista Reportes (S-REPORTES): tablero analítico — KPIs y diagnósticos cableados a GET /reports + gráficas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Reportes"}));
  expect(screen.getByRole("heading",{name:"Reportes"})).toBeTruthy();
  expect(screen.getByText("Pacientes atendidos")).toBeTruthy();                  // KPI (real/rep)
  expect((await screen.findAllByText("Diabetes mellitus tipo 2")).length).toBeGreaterThan(0); // diagnóstico real (mock)
  expect(screen.getByText(/Consultas por día/)).toBeTruthy();
  expect(screen.getByText(/Diagnósticos principales/)).toBeTruthy();
  expect(screen.getByText("Medicamentos más prescritos")).toBeTruthy();
  expect(screen.getByText("Indicadores de calidad")).toBeTruthy();
  expect(screen.getByText(/Reportes rápidos/)).toBeTruthy();
 });

 it("vista Clinical Intelligence (S-CLINICALINTEL): asistente representativo + alertas deterministas + calculadoras (R6 en pausa)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Clinical Intelligence"}));
  expect(screen.getByRole("heading",{name:"Clinical Intelligence"})).toBeTruthy();
  expect(screen.getByText(/Asistente clínico con IA/)).toBeTruthy();
  expect(screen.getAllByText(/Alertas clínicas/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/HbA1c 8.1%/).length).toBeGreaterThan(0);           // alerta (rep/real)
  expect(screen.getByText(/Diagnóstico diferencial \(IA\)/)).toBeTruthy();
  expect(screen.getByText(/Calculadoras clínicas/)).toBeTruthy();
  expect(screen.getByText(/IA generativa \(R6\) está en pausa/)).toBeTruthy();   // nota de gobernanza honesta
 });

 it("vista Obligaciones (S-OBLIGACIONES): regulatorias del consultorio cableadas a GET /regulatory-obligations",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Obligaciones/}));
  expect(screen.getByRole("heading",{name:"Obligaciones"})).toBeTruthy();
  expect(screen.getByText("Total de obligaciones")).toBeTruthy();               // KPI
  expect((await screen.findAllByText("Declaración mensual de IVA")).length).toBeGreaterThan(0); // fila (real) + calendario
  expect(screen.getByText(/Calendario de próximas obligaciones/)).toBeTruthy();
  expect(screen.getByText(/Cumplimiento por categoría/)).toBeTruthy();
  expect(screen.getByText(/Recordatorios automáticos/)).toBeTruthy();
  expect(screen.getByText(/Tareas pendientes/)).toBeTruthy();
 });

 it("vista Documentos (S-DOCUMENTOS): carpetas + tabla de documentos + vista previa + acciones",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Documentos"}));
  expect(screen.getByRole("heading",{name:"Documentos"})).toBeTruthy();
  expect(screen.getByText("Carpetas")).toBeTruthy();
  expect(screen.getByText("Todos los documentos")).toBeTruthy();
  expect(screen.getAllByText(/Resultados_Laboratorio_17092026\.pdf/).length).toBeGreaterThan(0); // fila + preview (rep)
  expect(screen.getByText("Documentos clínicos")).toBeTruthy();                 // chip
  expect(screen.getByText(/Tipos de archivo permitidos/)).toBeTruthy();
  expect(screen.getByText(/Acciones rápidas/)).toBeTruthy();
  expect(screen.getByText("Generar desde plantilla")).toBeTruthy();
 });

 it("vista Facturación (S-FACTURACION): registro clínica-wide cableado a GET /api/v1/claims + wizard Nueva factura",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Facturación"}));
  expect(screen.getByRole("heading",{name:"Facturación"})).toBeTruthy();
  expect(screen.getByText("Facturas emitidas")).toBeTruthy();                    // KPI
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0); // fila (real) + wizard
  expect(screen.getByText("Nueva factura")).toBeTruthy();                        // wizard
  expect(screen.getByText("Conceptos")).toBeTruthy();
  expect(screen.getByText("Métodos de pago")).toBeTruthy();
  expect(screen.getByText("Top servicios facturados")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Emitir factura/})).toBeTruthy();
 });

 it("vista Seguimiento (S-SEGUIMIENTO): historia + tendencia de vitales + indicadores + tareas + próxima cita",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Seguimiento/}));
  expect(screen.getByRole("heading",{name:"Seguimiento"})).toBeTruthy();
  expect(screen.getByText("Historia de seguimiento")).toBeTruthy();
  expect(screen.getByText("Control de DM2")).toBeTruthy();                       // entrada de la historia (rep)
  expect(screen.getByText("Tendencia de signos vitales")).toBeTruthy();          // sparklines (real/rep)
  expect(screen.getByText("Indicadores clave")).toBeTruthy();                    // HbA1c/LDL/Peso/IMC
  expect(screen.getByText(/Próxima cita de seguimiento/)).toBeTruthy();
  expect(screen.getByText(/Tareas de seguimiento/)).toBeTruthy();
  expect(screen.getByText("Solicitar HbA1c en 3 meses")).toBeTruthy();           // tarea (real/rep)
  expect(screen.getByText("HbA1c")).toBeTruthy();
 });

 it("vista Interconsultas (S-INTERCONSULTA): form Nueva interconsulta + panel de contexto + envío",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Interconsultas"}));
  expect(screen.getByRole("heading",{name:"Nueva interconsulta"})).toBeTruthy();
  expect(screen.getByText("Datos de la interconsulta")).toBeTruthy();
  expect(screen.getByText(/Especialidad/)).toBeTruthy();
  expect(screen.getByText(/Motivo de interconsulta/)).toBeTruthy();
  expect(screen.getAllByText(/Resumen clínico/).length).toBeGreaterThan(0);
  expect(screen.getByText("Información relevante del paciente")).toBeTruthy();  // panel derecho (rep/real)
  expect(screen.getByText("Plantillas rápidas")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Enviar interconsulta/})).toBeTruthy();
 });

 it("vista Plan de cuidado (S-PLANCUIDADO): snapshot compuesto — problemas, objetivos, intervenciones, cronograma, métricas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Plan de cuidados"}));
  expect(screen.getByRole("heading",{name:"Plan de cuidado"})).toBeTruthy();
  expect(screen.getByText(/Diagnósticos \/ Problemas asociados/)).toBeTruthy();
  expect(screen.getAllByText("Diabetes mellitus tipo 2").length).toBeGreaterThan(0);   // problema asociado (rep/real)
  expect(screen.getByText("Objetivos del plan")).toBeTruthy();
  expect(screen.getByText("Intervenciones y recomendaciones")).toBeTruthy();
  expect(screen.getByText("Cronograma de seguimiento")).toBeTruthy();
  expect(screen.getByText("Metas y métricas")).toBeTruthy();                            // métricas reales/rep
  expect(screen.getByText("Educación para el paciente")).toBeTruthy();
  expect(screen.getByText("HbA1c")).toBeTruthy();
 });

 it("vista Signos vitales (S-SIGNOS): form + últimos registros + tendencias + referencia + alertas deterministas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Signos vitales"}));
  expect(screen.getByRole("heading",{name:"Signos vitales"})).toBeTruthy();
  expect(screen.getByText("Registrar signos vitales")).toBeTruthy();          // título del form
  expect(screen.getByPlaceholderText("36.5")).toBeTruthy();                    // campo temperatura
  expect(screen.getByText("Últimos registros")).toBeTruthy();
  expect(screen.getAllByText("120/80").length).toBeGreaterThan(0);            // fila representativa
  expect(screen.getByText("Tendencias")).toBeTruthy();
  expect(screen.getByText(/Referencia de valores normales/)).toBeTruthy();
  expect(screen.getByText("Alertas clínicas")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Guardar signos vitales/})).toBeTruthy();
 });

 it("vista Vacunas (S-VACUNAS): registro clínica-wide cableado a GET /api/v1/immunizations — KPIs, tabla, detalle y cobertura",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Vacunas"}));
  expect(screen.getByRole("heading",{name:"Vacunas"})).toBeTruthy();
  expect((await screen.findAllByText("Ana López García",{},{timeout:2500})).length).toBeGreaterThan(0); // fila + detalle
  expect(screen.getByText("Detalle de la vacuna")).toBeTruthy();
  expect(screen.getAllByText("Completa").length).toBeGreaterThan(0);           // estado en TEXTO
  expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
  expect(screen.getByText(/Cobertura de vacunas/)).toBeTruthy();              // donut cobertura
  expect(screen.getAllByText(/Próximas dosis/).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Esquemas por edad/).length).toBeGreaterThan(0);
 });

 it("vista Problemas (S-PROBLEMAS): registro clínica-wide cableado a GET /api/v1/problems + navegación a form y plantillas",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Problemas"}));
  expect(screen.getByRole("heading",{name:"Problemas"})).toBeTruthy();
  expect((await screen.findAllByText("Ana López García",{},{timeout:2500})).length).toBeGreaterThan(0); // fila + detalle
  expect(screen.getByText("Detalle del problema")).toBeTruthy();
  expect(screen.getAllByText("En seguimiento").length).toBeGreaterThan(0); // estado en TEXTO
  expect(screen.getByText(/Problemas por categoría/)).toBeTruthy();
  expect(screen.getByText("Estado de problemas")).toBeTruthy();
  expect(screen.getByText("Pacientes con más problemas")).toBeTruthy();
  // navegación a "Nuevo problema" (form cableado a CIE-10)
  fireEvent.click(screen.getByRole("button",{name:/Nuevo problema/}));
  expect(screen.getByRole("heading",{name:"Nuevo problema"})).toBeTruthy();
  expect(screen.getByText("1. Información del problema")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Guardar problema/})).toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"← Volver"}));
  // navegación a Plantillas
  fireEvent.click(screen.getByRole("button",{name:/Plantillas/}));
  expect(screen.getByRole("heading",{name:"Plantillas de problemas"})).toBeTruthy();
  expect(screen.getAllByText("Diabetes mellitus tipo 2").length).toBeGreaterThan(0);
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
  expect(screen.getByText("Accesos rápidos")).toBeTruthy();
 });

 it("Medicamentos › Interacciones (S8.3): verificador de conjunto cableado — chips por defecto, factores y hallazgos con severidad",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/Medicamentos/})); // vista Medicamentos
  fireEvent.click(screen.getByRole("button",{name:/^Interacciones$/})); // pestaña
  // entrada: medicamentos por defecto del ejemplo insignia + acción de verificación
  expect(screen.getByText("Medicamentos a evaluar")).toBeTruthy();
  expect(screen.getAllByText("Sertralina").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Ibuprofeno").length).toBeGreaterThan(0);
  expect(screen.getByText("Factores del paciente")).toBeTruthy();
  const verify=screen.getByRole("button",{name:"Verificar interacciones"});
  expect(verify).toBeTruthy();
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
  toExpediente();
  const seg=(await screen.findByRole("heading",{name:"Seguimiento automático"},{timeout:2500})).closest("section")!;
  const por=screen.getByRole("heading",{name:"Portal del paciente"}).closest("section")!;
  const aud=screen.getByRole("heading",{name:"Seguridad y auditoría"}).closest("section")!;
  await noSeriousAxe(seg,"Seguimiento");
  await noSeriousAxe(por,"Portal");
  await noSeriousAxe(aud,"Auditoría");
 });
});
