// @vitest-environment jsdom
import{describe,it,expect,vi}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent,within}from"@testing-library/react";
const{posted}=vi.hoisted(()=>({posted:[] as {path:string;body:unknown}[]}));
vi.mock("../../apps/web/lib/session-client",async()=>{const h=await vi.importActual<typeof import("./_cockpit-harness")>("./_cockpit-harness");return h.makeSessionClientMock(posted);});
import Workspace from"../../apps/web/app/workspace/page";
import{installCockpitEnv,noSeriousAxe,abrirConsulta,elegirPaciente,toExpediente}from"./_cockpit-harness";
void render;void screen;void cleanup;void waitFor;void fireEvent;void within;void expect;void Workspace;void posted;void noSeriousAxe;void abrirConsulta;void elegirPaciente;void toExpediente;
installCockpitEnv();
describe("Cockpit del expediente + paneles de presentación (jsdom) — parte 5/6",()=>{

 it("abrir una consulta abre el EXPEDIENTE en la pestaña «Consulta» (encuentro), no una pantalla gemela",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  // Unificación Consulta⟷Expediente: ya no hay pantalla de consulta separada con 8 pestañas; abrir una consulta abre
  // el expediente del paciente en la pestaña "Consulta" (el encuentro), con su formulario estructurado y su CDS.
  expect(screen.getByText("Motivo de consulta")).toBeTruthy();
  expect(screen.getByText("Resumen clínico")).toBeTruthy();
  expect(screen.getAllByText("Signos vitales").length).toBeGreaterThan(0);
  expect(screen.getByRole("button",{name:"Abrir encuentro"})).toBeTruthy(); // acción FSM del encuentro
  const lastTab=(name:RegExp)=>{const bs=screen.getAllByRole("button",{name});return bs[bs.length-1]!;};
  // Los antecedentes ya no son una pestaña de la consulta: viven en «Expediente», con el resto de los hechos clínicos.
  // Tras consolidar dieciséis pestañas en cinco (06-oct-2026), antecedentes y medicación están en la MISMA pestaña: ese
  // era el punto —un médico los lee juntos, no en dos ventanas.
  fireEvent.click(lastTab(/^Expediente$/));
  expect(await screen.findByRole("heading",{name:"Antecedentes"})).toBeTruthy();
  expect(await screen.findByRole("heading",{name:"Medicación"})).toBeTruthy();
 });

 it("Expediente › Administración › Paciente: edición real de datos del paciente (POST amendment)",async()=>{
  // Fusión Pacientes⟷Expediente: seleccionar un paciente abre su expediente directamente (sin ficha-preview). La edición
  // de datos del paciente vive ahora en el submenú Administración del expediente y sigue siendo real (POST amendment).
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Pacientes"}));
  fireEvent.click((await screen.findAllByText("Ana López García"))[0]!); // abre el EXPEDIENTE del paciente
  fireEvent.click(await screen.findByRole("button",{name:"Administración"}));
  fireEvent.click(await screen.findByRole("button",{name:"Editar datos"}));
  // formulario con datos reales → guardar (POST amendment)
  fireEvent.click(await screen.findByRole("button",{name:"Guardar cambios"}));
  expect(await screen.findByText(/Ficha del paciente actualizada/)).toBeTruthy();
 });

 // Auditoría U-16: un motivo clínico lo escribe el médico; nada se envía con un literal del código.
 it("vista Expediente: la dosis viaja con unidad, un bloqueo anulable exige nombrar la barrera y justificar (U-19), y suspender exige el motivo del médico tal cual (U-16)",async()=>{
  render(<Workspace/>);
  await toExpediente();
  // La Medicación y la Prescripción segura viven en el submenú "Medicación" del expediente.
  fireEvent.click(screen.getByRole("button",{name:"Expediente"}));
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

 it("vista Consulta: los antecedentes NO se re-preguntan — son la matriz del expediente, read-only en la consulta",async()=>{
  // Rediseño: la historia clínica basal (antecedentes/hábitos) se captura UNA vez en el expediente, no en cada consulta.
  // La consulta ya no tiene checkboxes de antecedentes ni los serializa en la nota: solo los muestra y enlaza al expediente.
  render(<Workspace/>);
  await abrirConsulta();
  expect(screen.queryByText("HTA"),"la consulta ya no re-pregunta antecedentes con checkboxes").toBeNull();
  expect(screen.queryByPlaceholderText(/Antecedentes por categoría/),"se eliminó el textarea de antecedentes de la consulta").toBeNull();
  // En su lugar, un acceso para capturar/editar la matriz en el expediente del paciente.
  expect(screen.getByRole("button",{name:/en el expediente/})).toBeTruthy();
  // Y la nota del encuentro ya NO serializa antecedentes (viven en el expediente, no en la nota de la visita).
  fireEvent.change(screen.getByPlaceholderText(/Motivo de la consulta/),{target:{value:"Cefalea tensional"}});
  fireEvent.click(screen.getByRole("button",{name:"Vista previa"}));
  expect(await screen.findByText(/MOTIVO DE CONSULTA: Cefalea tensional/)).toBeTruthy();
  expect(screen.queryByText(/ANTECEDENTES RELEVANTES/),"la nota de la consulta ya no lleva antecedentes").toBeNull();
 });

 it("vista Facturación: registrar un cargo real al paciente elegido (POST /claims)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Facturación"}));
  // elegir el paciente al que se registra el cargo (selector real cableado a la lista de pacientes)
  const opt=await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(opt.closest("select")!,{target:{value:"p1"}});
  fireEvent.click(screen.getByRole("button",{name:/Registrar cargo/}));
  expect(await screen.findByText(/Cargo registrado/)).toBeTruthy();
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

 it("Medicamentos › Interacciones (S8.3): arranca VACÍO, exige dos fármacos y verifica los que escribe el médico",async()=>{
  // Auditoría R05a (WS1-15c): esta prueba afirmaba «chips por defecto» — fijaba el defecto. El verificador arrancaba con
  // Sertralina/Ibuprofeno/Metformina precargados, sin decir que eran de ejemplo, en una pantalla que emite un veredicto de
  // interacciones. Ahora se comprueba lo contrario: nace vacío y el conjunto lo pone el médico.
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:/Medicamentos/})); // vista Medicamentos
  fireEvent.click((await screen.findByRole("button",{name:/^Interacciones$/},{timeout:5000}))); // pestaña
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

 // Último test: el deep-link carga el expediente completo (asíncrono y pesado); va al final para no contaminar
 // el orden de otros tests aunque la URL se resetee en afterEach.
 it("deep-link (Lote B): con ?p=<paciente> en la URL, al montar se restaura el foco del paciente",async()=>{
  window.history.replaceState(null,"","/?p=p1&v=exp");
  render(<Workspace/>);
  expect((await screen.findAllByText(/Ana López García/,{},{timeout:2500})).length).toBeGreaterThan(0);
 });
});
