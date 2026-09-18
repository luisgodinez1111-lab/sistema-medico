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
const toExpediente=()=>fireEvent.click(screen.getByRole("button",{name:"Alergias"}));

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
