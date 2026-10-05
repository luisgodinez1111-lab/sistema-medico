// @vitest-environment jsdom
import{describe,it,expect,vi}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent,within}from"@testing-library/react";
const{posted}=vi.hoisted(()=>({posted:[] as {path:string;body:unknown}[]}));
vi.mock("../../apps/web/lib/session-client",async()=>{const h=await vi.importActual<typeof import("./_cockpit-harness")>("./_cockpit-harness");return h.makeSessionClientMock(posted);});
import Workspace from"../../apps/web/app/workspace/page";
import{installCockpitEnv,noSeriousAxe,abrirConsulta,elegirPaciente,toExpediente}from"./_cockpit-harness";
void render;void screen;void cleanup;void waitFor;void fireEvent;void within;void expect;void Workspace;void posted;void noSeriousAxe;void abrirConsulta;void elegirPaciente;void toExpediente;
installCockpitEnv();
describe("Cockpit del expediente + paneles de presentación (jsdom) — parte 1/6",()=>{
 it("shell: sidebar índigo con navegación primaria (transversal) + herramientas + buscador global + perfil del médico",async()=>{
  render(<Workspace/>);
  expect(screen.getByRole("button",{name:/Inicio/})).toBeTruthy();
  // Fusión Pacientes⟷Expediente: UNA sola puerta "Pacientes" (abre la lista y, al elegir, el expediente). Ya no hay ítem "Expediente".
  expect(screen.getByRole("button",{name:/Pacientes/})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Reportes"})).toBeTruthy();
  expect(screen.getByRole("button",{name:/Configuración/})).toBeTruthy();   // sección HERRAMIENTAS
  expect(screen.getByRole("button",{name:/Contraer menú/})).toBeTruthy();    // colapsar
  expect(screen.getAllByText(/Médico tratante/).length).toBeGreaterThan(0);  // perfil del médico (fallback)
  expect(screen.getByPlaceholderText(/Buscar paciente por nombre/)).toBeTruthy();
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

 it("vista Consulta: los signos vitales se guardan como eventos reales (POST /vitals)",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  // capturar la TA en la grilla de signos vitales y guardar
  // Auditoría R07 (05-oct-2026): la TA se busca por su ETIQUETA, no por el placeholder.
  // El placeholder de ese campo es `V["BP"] ?? "120/80"`: por diseño muestra la ÚLTIMA TA conocida como pista, así que deja
  // de ser «120/80» en cuanto existe una previa. Tres tests se enganchaban a él y fallaban al correr el proyecto de UI
  // completo —pasaban en aislamiento—, lo que convertía el verde de la suite en una función de qué más se hubiera ejecutado.
  fireEvent.change(screen.getByLabelText("TA (mmHg)"),{target:{value:"128/82"}});
  fireEvent.click(screen.getByRole("button",{name:"Guardar signos vitales"}));
  expect(await screen.findByText(/guardados en el expediente/i)).toBeTruthy();
 });
 it("vista Consulta: la PRIMERA captura abre el encuentro y liga el signo al ACTO (encounterId) — auditoría E2E lote 3",async()=>{
  const base=posted.length;
  render(<Workspace/>);
  await abrirConsulta(); // NO se abre el encuentro a mano: la captura debe abrirlo perezosamente
  fireEvent.change(screen.getByLabelText("TA (mmHg)"),{target:{value:"128/82"}});
  fireEvent.click(screen.getByRole("button",{name:"Guardar signos vitales"}));
  await screen.findByText(/guardados en el expediente/i);
  const mine=posted.slice(base);
  const encPost=mine.find(p=>p.path.endsWith("/api/v1/encounters"));
  expect(encPost,"la primera captura abrió el encuentro (no quedó huérfana)").toBeTruthy();
  const encId=(encPost!.body as{encounterId:string}).encounterId;
  const vitPost=mine.find(p=>p.path.includes("/api/v1/vitals")&&(p.body as{vitalId?:string}).vitalId);
  expect((vitPost!.body as{encounterId?:string}).encounterId,"el signo queda ligado al acto").toBe(encId);
 });

 // (Fase 2) El registro clínica-wide de Vacunas se retiró del menú; Vacunas es ahora un submenú del Expediente
 // (paciente-scoped, createImmunization). El alta por el endpoint /immunizations la cubren los live-proofs del backend y
 // la sección de Vacunas del expediente (barrida por a11y en ui-cockpit-3).

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

 it("panel 7 (Seguridad y auditoría): estado del sistema + actividad desde la cadena (estado en texto)",async()=>{
  render(<Workspace/>);
  await toExpediente();
  await screen.findByText(/Vista principal/,{},{timeout:2500}); // el hero prueba que la auto-carga (timeline incluido) completó
  fireEvent.click(screen.getByRole("button",{name:"Administración"})); // Seguridad y auditoría vive ahora en el submenú Administración
  const sec=(await screen.findByRole("heading",{name:"Seguridad y auditoría"})).closest("section")!;
  expect(sec.textContent).toMatch(/Estado del sistema/);
  expect(sec.textContent).toMatch(/Actividad reciente/);
  await waitFor(()=>expect(sec.textContent).toMatch(/SIGNED/),{timeout:2500}); // estado del evento en TEXTO (no solo color)
 });

 it("vista Obligaciones (S-OBLIGACIONES): regulatorias del consultorio cableadas a GET /regulatory-obligations",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/^Obligaciones/}));
  expect((await screen.findByRole("heading",{name:"Obligaciones"}))).toBeTruthy();
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

 // (Fase 2) La vista suelta de Signos vitales (panel del paciente + registro «Toda la clínica») se retiró: Signos es ahora
 // un submenú del Expediente (paciente-scoped). Su captura/tendencias se barren por a11y en ui-cockpit-3.

 it("accesibilidad (Lote L): las vistas principales del sidebar no tienen violaciones axe serias/críticas",async()=>{
  render(<Workspace/>);
  const nav=async(name:string)=>{
   const btn=screen.getAllByRole("button").find(b=>(b.textContent??"").trim().startsWith(name));
   if(!btn)throw new Error(`No se encontró el acceso «${name}» en el sidebar`);
   fireEvent.click(btn);
   await screen.findByRole("heading",{level:1},{timeout:2500}); // espera a que la vista (lazy) monte su h1
  };
  for(const v of ["Inicio","Pacientes","Agenda","Interconsultas","Seguimiento","Medicamentos","Resultados","Órdenes","Facturación","Obligaciones","Reportes","Configuración"]){
   await nav(v);
   await noSeriousAxe(document.body,v);
  }
 });
});
