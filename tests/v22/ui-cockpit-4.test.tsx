// @vitest-environment jsdom
import{describe,it,expect,vi}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent,within}from"@testing-library/react";
const{posted}=vi.hoisted(()=>({posted:[] as {path:string;body:unknown}[]}));
vi.mock("../../apps/web/lib/session-client",async()=>{const h=await vi.importActual<typeof import("./_cockpit-harness")>("./_cockpit-harness");return h.makeSessionClientMock(posted);});
import Workspace from"../../apps/web/app/workspace/page";
import{installCockpitEnv,noSeriousAxe,abrirConsulta,elegirPaciente,toExpediente}from"./_cockpit-harness";
void render;void screen;void cleanup;void waitFor;void fireEvent;void within;void expect;void Workspace;void posted;void noSeriousAxe;void abrirConsulta;void elegirPaciente;void toExpediente;
installCockpitEnv();
describe("Cockpit del expediente + paneles de presentación (jsdom) — parte 4/6",()=>{

 it("el encuentro es el acto DENTRO del expediente (su pestaña «Consulta»), no un despachador suelto",async()=>{
  // El despachador «Consulta» se eliminó: ya no es una puerta del menú (lo garantiza branch-architecture). El encuentro
  // se abre eligiendo paciente → expediente → pestaña «Consulta», donde aparece el formulario (1. Motivo de consulta).
  render(<Workspace/>);
  await abrirConsulta();
  expect(await screen.findByText("Motivo de consulta")).toBeTruthy();
 });

 it("vista Pacientes: lista real, la búsqueda filtra, y seleccionar abre el EXPEDIENTE directo (una puerta)",async()=>{
  // Fusión Pacientes⟷Expediente: "Pacientes" es el estado sin-paciente del Expediente (la lista). Ya no hay ficha-preview:
  // seleccionar un paciente abre su expediente directamente (su pestaña Resumen es la ficha).
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Pacientes"}));
  expect((await screen.findByRole("heading",{name:"Pacientes"}))).toBeTruthy();
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0);
  expect(screen.getAllByText("Carlos Mendoza").length).toBeGreaterThan(0);
  // la búsqueda filtra en vivo
  fireEvent.change(screen.getByPlaceholderText(/Buscar por nombre o CURP/),{target:{value:"Carlos"}});
  expect(screen.queryByText("Ana López García")).toBeNull();
  fireEvent.click(screen.getByText("Limpiar filtros"));
  // seleccionar el paciente abre su EXPEDIENTE (encabezado del paciente + submenús del expediente)
  fireEvent.click((await screen.findAllByText("Ana López García"))[0]!);
  expect(await screen.findByRole("button",{name:/Iniciar consulta/})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Resumen"})).toBeTruthy();
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

 it("vista Obligaciones: agregar una obligación regulatoria real (POST /regulatory-obligations)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Obligaciones\b/}));
  fireEvent.click(await screen.findByRole("button",{name:"+ Agregar obligación"}));
  fireEvent.change(screen.getByPlaceholderText(/Declaración mensual de IVA/),{target:{value:"Aviso de funcionamiento COFEPRIS"}});
  fireEvent.click(screen.getByRole("button",{name:"Agregar obligación"}));
  expect(await screen.findByText(/Obligación agregada/)).toBeTruthy();
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

 // (Fase 2) El registro clínica-wide de Alergias se retiró del menú; Alergias es ahora un submenú del Expediente
 // (paciente-scoped). El alta por /allergies la cubren los live-proofs del backend y la sección del expediente (a11y en ui-cockpit-3).

 it("El expediente se navega por submenús de MÓDULO; la Medicación vive en su propio submenú, no en Resumen",async()=>{
  render(<Workspace/>);
  await toExpediente();
  // Al abrir el expediente, el submenú por defecto es "Resumen": está el hero, NO el formulario de Medicación.
  await screen.findByText(/Vista principal/,{},{timeout:2500});
  expect(screen.queryByRole("button",{name:"Proponer medicación"})).toBeNull(); // oculto en otro submenú
  // Al cambiar a «Expediente», aparece el formulario de medicación y se desmonta el panel de Resumen (Portal del paciente vive en Administración).
  fireEvent.click(screen.getByRole("button",{name:"Expediente"}));
  expect(await screen.findByRole("button",{name:"Proponer medicación"})).toBeTruthy();
  expect(screen.queryByRole("heading",{name:"Portal del paciente"})).toBeNull();
  // El submenú se refleja en la URL (?s=) para que el enlace sea compartible.
  expect(window.location.search).toContain("s=expediente"); // tras la consolidación, la medicación vive en «Expediente»
 });
});
