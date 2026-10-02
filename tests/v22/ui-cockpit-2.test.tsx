// @vitest-environment jsdom
import{describe,it,expect,vi}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent,within}from"@testing-library/react";
const{posted}=vi.hoisted(()=>({posted:[] as {path:string;body:unknown}[]}));
vi.mock("../../apps/web/lib/session-client",async()=>{const h=await vi.importActual<typeof import("./_cockpit-harness")>("./_cockpit-harness");return h.makeSessionClientMock(posted);});
import Workspace from"../../apps/web/app/workspace/page";
import{installCockpitEnv,noSeriousAxe,abrirConsulta,elegirPaciente,toExpediente}from"./_cockpit-harness";
void render;void screen;void cleanup;void waitFor;void fireEvent;void within;void expect;void Workspace;void posted;void noSeriousAxe;void abrirConsulta;void elegirPaciente;void toExpediente;
installCockpitEnv();
describe("Cockpit del expediente + paneles de presentación (jsdom) — parte 2/6",()=>{

 it("vista Inicio (dashboard del consultorio) se materializa al montar",async()=>{
  render(<Workspace/>);
  expect((await screen.findByRole("heading",{name:"Inicio"}))).toBeTruthy();
  expect(screen.getByText(/resumen de hoy/)).toBeTruthy();
  expect(screen.getByText(/Tareas clínicas prioritarias/)).toBeTruthy();
  expect(screen.getByText("Agenda de hoy")).toBeTruthy();
  expect(screen.getByText("Pacientes recientes")).toBeTruthy();
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

 // Auditoría U-05/U-17: al cambiar de paciente, el borrador del anterior NO sobrevive (PATIENT_SWITCH+OLD_DRAFT_SUBMITTABLE).
 it("vista Consulta: cambiar de paciente descarta el borrador del anterior y no muestra sus datos",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  fireEvent.change(screen.getByPlaceholderText("Motivo de la consulta…"),{target:{value:"Cefalea del paciente A"}});
  expect((screen.getByPlaceholderText("Motivo de la consulta…") as HTMLTextAreaElement|HTMLInputElement).value).toBe("Cefalea del paciente A");
  // cambio a Carlos Mendoza (p2): unificación — se vuelve al despachador por la puerta "Consulta" del menú lateral
  // ([0] = la del sidebar; la pestaña "Consulta" del expediente comparte nombre) y se abre la suya.
  fireEvent.click(screen.getAllByRole("button",{name:"Consulta"})[0]!);
  const input2=await screen.findByLabelText("Buscar paciente");
  fireEvent.change(input2,{target:{value:"Carlos"}});
  const openC=await screen.findByRole("button",{name:/Carlos Mendoza/},{timeout:2000});fireEvent.click(openC);
  expect((screen.getByPlaceholderText("Motivo de la consulta…") as HTMLTextAreaElement|HTMLInputElement).value).toBe("");
  expect(screen.queryByText(/Cefalea del paciente A/)).toBeNull();
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

 it("vista Plan de cuidado: agregar una meta real al plan del paciente (POST /care-plans)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Plan de cuidados"}));await elegirPaciente();
  fireEvent.click(screen.getByRole("button",{name:"+ Nueva meta"}));
  fireEvent.change(screen.getByPlaceholderText(/HbA1c < 7%/),{target:{value:"Bajar 5% de peso en 3 meses"}});
  fireEvent.click(screen.getByRole("button",{name:"Agregar meta"}));
  expect(await screen.findByText(/Meta agregada al plan/)).toBeTruthy();
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

 it("vista Resultados (S7): registro clínica-wide cableado a GET /api/v1/results — KPIs + lista con estado-UI",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Resultados\b/}));
  expect((await screen.findByRole("heading",{name:"Resultados"}))).toBeTruthy();
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

 it("vista Documentos (S-DOCUMENTOS): carpetas + tabla de documentos + vista previa + acciones",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Documentos"}));
  expect((await screen.findByRole("heading",{name:"Documentos"}))).toBeTruthy();
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

 it("vista Vacunas (S-VACUNAS): registro clínica-wide cableado a GET /api/v1/immunizations — KPIs, tabla, detalle y cobertura",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Vacunas"}));
  expect((await screen.findByRole("heading",{name:"Vacunas"}))).toBeTruthy();
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
});
