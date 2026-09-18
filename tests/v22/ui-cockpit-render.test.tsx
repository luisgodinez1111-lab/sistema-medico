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

// Al montar, el workspace abre la vista Inicio (dashboard del consultorio). Para probar los paneles del
// EXPEDIENTE, cambiamos a esa vista pulsando un acceso del sidebar (p.ej. "Pacientes").
const toExpediente=()=>fireEvent.click(screen.getByRole("button",{name:"Clinical Intelligence"}));

describe("Cockpit del expediente + paneles de presentación (jsdom)",()=>{
 it("shell: sidebar índigo con navegación primaria (19 accesos + herramientas) + buscador global + perfil del médico",async()=>{
  render(<Workspace/>);
  expect(screen.getByRole("button",{name:/Inicio/})).toBeTruthy();
  expect(screen.getByRole("button",{name:/Pacientes/})).toBeTruthy();
  expect(screen.getByRole("button",{name:/Clinical Intelligence/})).toBeTruthy();
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

 it("vista Consulta (workspace clínico) con las 7 pestañas + formulario",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Consulta"}));
  expect(screen.getByRole("heading",{name:"Consulta"})).toBeTruthy();
  expect(screen.getByText("1. Motivo de consulta")).toBeTruthy();
  expect(screen.getAllByText("Signos vitales").length).toBeGreaterThan(0); // panel + acceso del sidebar
  expect(screen.getByText("Resumen clínico")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Consulta actual/})).toBeTruthy(); // pestaña
  expect(screen.getAllByRole("button",{name:/Plan de cuidados/}).length).toBeGreaterThan(1); // sidebar + pestaña
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
