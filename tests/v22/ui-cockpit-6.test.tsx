// @vitest-environment jsdom
import{describe,it,expect,vi}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent,within}from"@testing-library/react";
const{posted}=vi.hoisted(()=>({posted:[] as {path:string;body:unknown}[]}));
vi.mock("../../apps/web/lib/session-client",async()=>{const h=await vi.importActual<typeof import("./_cockpit-harness")>("./_cockpit-harness");return h.makeSessionClientMock(posted);});
import Workspace from"../../apps/web/app/workspace/page";
import{installCockpitEnv,noSeriousAxe,abrirConsulta,elegirPaciente,toExpediente}from"./_cockpit-harness";
void render;void screen;void cleanup;void waitFor;void fireEvent;void within;void expect;void Workspace;void posted;void noSeriousAxe;void abrirConsulta;void elegirPaciente;void toExpediente;
installCockpitEnv();
describe("Cockpit del expediente + paneles de presentación (jsdom) — parte 6/6",()=>{

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
 it("vista Consulta: interrogatorio y exploración física son campos REALES que alimentan la nota clínica",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
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

 // (Fase 2) Alergias es ahora un submenú del Expediente (paciente-scoped, createAllergy). El alta por /allergies la cubren
 // los live-proofs del backend y la sección de Alergias del expediente.

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

 it("panel 6 (Portal del paciente): saludo + features no construidas marcadas 'Próximamente' (verdad clínica)",async()=>{
  render(<Workspace/>);
  await toExpediente();
  await screen.findByText(/Vista principal/,{},{timeout:2500});
  fireEvent.click(screen.getByRole("button",{name:"Administración"})); // Portal del paciente vive ahora en el submenú Administración
  const h=await screen.findByRole("heading",{name:"Portal del paciente"},{timeout:2500});
  const sec=h.closest("section")!;
  expect(sec.textContent).toMatch(/Hola,/);
  expect(sec.textContent).toMatch(/Mensajes/);
  const soon=Array.from(sec.querySelectorAll("*")).filter(e=>e.textContent==="Próximamente");
  expect(soon.length,"Mensajes y Educación deben ir marcados Próximamente").toBeGreaterThanOrEqual(2);
  expect(sec.textContent).toMatch(/solo lectura/i); // espejo read-only (Physician Control)
 });

 // (Fase 2) Clinical Intelligence y Plan de cuidados son ahora submenús del Expediente (paciente-scoped). El panel de CI del
 // expediente reusa snap.findings + la nota de gobernanza R6; ambos submenús se barren por a11y en ui-cockpit-3. Los
 // registros POBLACIONALES de planes se retiraron del menú (el worklist poblacional vive en Seguimiento).

 it("accesibilidad: los paneles de presentación no tienen violaciones axe serias/críticas",async()=>{
  render(<Workspace/>);
  await toExpediente();
  const seg=(await screen.findByRole("heading",{name:"Seguimiento automático"},{timeout:2500})).closest("section")!; // submenú Resumen
  await noSeriousAxe(seg,"Seguimiento");
  fireEvent.click(screen.getByRole("button",{name:"Administración"})); // Portal y Auditoría viven ahora en Administración
  const por=(await screen.findByRole("heading",{name:"Portal del paciente"})).closest("section")!;
  const aud=(await screen.findByRole("heading",{name:"Seguridad y auditoría"})).closest("section")!;
  await noSeriousAxe(por,"Portal");
  await noSeriousAxe(aud,"Auditoría");
 });
});
