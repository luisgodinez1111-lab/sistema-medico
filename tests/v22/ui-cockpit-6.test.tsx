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

 it("vista Alergias: registrar una alergia real desde el módulo (POST /allergies)",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Alergias"}));
  fireEvent.click(await screen.findByRole("button",{name:"+ Nueva alergia"}));
  expect(screen.getByText("Nueva alergia")).toBeTruthy();
  // esperar a que la lista de pacientes cargue (opción del selector) y elegir paciente + sustancia + reacción
  await screen.findByRole("option",{name:"Ana López García"});
  fireEvent.change(screen.getAllByRole("combobox")[0]!,{target:{value:"p1"}});
  fireEvent.change(screen.getByPlaceholderText(/Penicilina, Mariscos/),{target:{value:"Penicilina"}});
  fireEvent.click(screen.getByRole("button",{name:"Urticaria"}));
  fireEvent.click(screen.getByRole("button",{name:"Registrar alergia"}));
  expect(await screen.findByText(/Alergia registrada/)).toBeTruthy();
 });

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
  const h=await screen.findByRole("heading",{name:"Portal del paciente"},{timeout:2500});
  const sec=h.closest("section")!;
  expect(sec.textContent).toMatch(/Hola,/);
  expect(sec.textContent).toMatch(/Mensajes/);
  const soon=Array.from(sec.querySelectorAll("*")).filter(e=>e.textContent==="Próximamente");
  expect(soon.length,"Mensajes y Educación deben ir marcados Próximamente").toBeGreaterThanOrEqual(2);
  expect(sec.textContent).toMatch(/solo lectura/i); // espejo read-only (Physician Control)
 });

 it("vista Clinical Intelligence (S-CLINICALINTEL): apoyo determinista real; IA generativa (R6) marcada como no disponible",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Clinical Intelligence"}));
  expect(await screen.findByRole("heading",{name:"Clinical Intelligence"})).toBeTruthy();
  expect(screen.getByText("Apoyo clínico determinista")).toBeTruthy();          // panel determinista real
  expect(screen.getAllByText(/Alertas clínicas/).length).toBeGreaterThan(0);
  expect(screen.getByText(/Calculadoras clínicas/)).toBeTruthy();
  expect(screen.getAllByText(/en pausa intencional/).length).toBeGreaterThan(0); // nota de gobernanza honesta
  // auditoría: se eliminó la IA generativa simulada (chat, diferencial probabilístico) y controles muertos
  expect(screen.queryByText(/Asistente clínico con IA/)).toBeNull();
  expect(screen.queryByText("GPT Clínico")).toBeNull();
  expect(screen.queryByText(/Diagnóstico diferencial \(IA\)/)).toBeNull();
  expect(screen.queryByText(/Configuración de IA/)).toBeNull();
 });

 it("vista Plan de cuidado (S-PLANCUIDADO): secciones reales del snapshot (problemas, objetivos, métricas) sin maqueta",async()=>{
  render(<Workspace/>);
  fireEvent.click(screen.getByRole("button",{name:"Plan de cuidados"}));
  expect((await screen.findByRole("heading",{name:"Plan de cuidado"}))).toBeTruthy();
  // las 3 tarjetas reales derivadas del snapshot compuesto (GET /care-plans)
  expect(screen.getByText(/Diagnósticos \/ Problemas asociados/)).toBeTruthy();
  expect(screen.getByText("Objetivos del plan")).toBeTruthy();
  expect(screen.getByText("Metas y métricas")).toBeTruthy();
  expect(screen.getByRole("button",{name:/Nueva meta/})).toBeTruthy();                 // creador real (POST /care-plans)
  // auditoría: se eliminaron las secciones/controles hardcodeados sin fuente real
  expect(screen.queryByText("Intervenciones y recomendaciones")).toBeNull();
  expect(screen.queryByText("Cronograma de seguimiento")).toBeNull();
  expect(screen.queryByText("Educación para el paciente")).toBeNull();
  expect(screen.queryByText("Documentos relacionados")).toBeNull();
  expect(screen.queryByText("Imprimir plan")).toBeNull();
  // Lote E — registro POBLACIONAL clínica-wide cableado a GET /api/v1/care-plans
  expect((await screen.findAllByText("Plan de cuidado · Toda la clínica")).length).toBeGreaterThan(0);
  expect((await screen.findAllByText("Ana López García")).length).toBeGreaterThan(0); // plan de otro paciente
  expect(screen.getByText("HbA1c < 7% en 3 meses")).toBeTruthy();
  expect(screen.getAllByText("En pausa").length).toBeGreaterThan(0);                 // estado por última transición
 });

 it("accesibilidad: los paneles de presentación no tienen violaciones axe serias/críticas",async()=>{
  render(<Workspace/>);
  await toExpediente();
  const seg=(await screen.findByRole("heading",{name:"Seguimiento automático"},{timeout:2500})).closest("section")!;
  const por=(await screen.findByRole("heading",{name:"Portal del paciente"})).closest("section")!;
  const aud=(await screen.findByRole("heading",{name:"Seguridad y auditoría"})).closest("section")!;
  await noSeriousAxe(seg,"Seguimiento");
  await noSeriousAxe(por,"Portal");
  await noSeriousAxe(aud,"Auditoría");
 });
});
