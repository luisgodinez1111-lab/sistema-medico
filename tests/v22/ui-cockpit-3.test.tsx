// @vitest-environment jsdom
import{describe,it,expect,vi}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent,within}from"@testing-library/react";
const{posted}=vi.hoisted(()=>({posted:[] as {path:string;body:unknown}[]}));
vi.mock("../../apps/web/lib/session-client",async()=>{const h=await vi.importActual<typeof import("./_cockpit-harness")>("./_cockpit-harness");return h.makeSessionClientMock(posted);});
import Workspace from"../../apps/web/app/workspace/page";
import{installCockpitEnv,noSeriousAxe,abrirConsulta,elegirPaciente,toExpediente}from"./_cockpit-harness";
void render;void screen;void cleanup;void waitFor;void fireEvent;void within;void expect;void Workspace;void posted;void noSeriousAxe;void abrirConsulta;void elegirPaciente;void toExpediente;
installCockpitEnv();
describe("Cockpit del expediente + paneles de presentación (jsdom) — parte 3/6",()=>{

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
  // Unificación: la tarea abre el EXPEDIENTE del paciente en la pestaña "Consulta" (encuentro) — no una pantalla separada.
  expect(await screen.findByText("1. Motivo de consulta")).toBeTruthy();
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

 it("vista Documentos: crear un documento clínico real (POST /documents)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Documentos"}));await elegirPaciente();
  fireEvent.click(screen.getByRole("button",{name:"+ Nuevo documento"}));
  fireEvent.change(screen.getByPlaceholderText(/Nota de evolución 19/),{target:{value:"Nota de evolución"}});
  fireEvent.change(screen.getByPlaceholderText("Contenido del documento…"),{target:{value:"Paciente estable, continúa tratamiento."}});
  fireEvent.click(screen.getByRole("button",{name:"Crear documento"}));
  expect(await screen.findByText(/Documento creado/)).toBeTruthy();
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

 it("vista Facturación (S-FACTURACION): registro clínica-wide cableado a GET /api/v1/claims + wizard Nueva factura",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Facturación"}));
  expect((await screen.findByRole("heading",{name:"Facturación"}))).toBeTruthy();
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
  expect((await screen.findByRole("heading",{name:"Nuevo problema"}))).toBeTruthy();
  expect(screen.getByText("1. Información del problema")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Guardar problema/})).toBeTruthy();
  // Lote E — dead-UI del formulario eliminado (directiva: cero controles muertos)
  expect(screen.queryByText("Prioridad")).toBeNull();
  expect(screen.queryByText(/Etiquetas \/ Palabras clave/)).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"← Volver"}));
  // navegación a Plantillas
  fireEvent.click(screen.getByRole("button",{name:/Plantillas/}));
  expect((await screen.findByRole("heading",{name:"Plantillas de problemas"}))).toBeTruthy();
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
});
