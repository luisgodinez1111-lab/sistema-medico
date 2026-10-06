// @vitest-environment jsdom
import{describe,it,expect,vi}from"vitest";
import{render,screen,fireEvent,within}from"@testing-library/react";
const{posted}=vi.hoisted(()=>({posted:[] as {path:string;body:unknown}[]}));
vi.mock("../../apps/web/lib/session-client",async()=>{const h=await vi.importActual<typeof import("./_cockpit-harness")>("./_cockpit-harness");return h.makeSessionClientMock(posted);});
import Workspace from"../../apps/web/app/workspace/page";
import{installCockpitEnv,noSeriousAxe,toExpediente,abrirConsulta}from"./_cockpit-harness";
installCockpitEnv();

// Auditoría clínica multiespecialidad (06-oct-2026) — EL LECTOR DE LA NOTA CLÍNICA.
//
// HALLAZGO QUE ORIGINA ESTE ARCHIVO. Cuatro especialistas, por separado, pusieron en primer lugar el mismo defecto: la
// valoración y el plan que el médico escribe y FIRMA no se podían volver a leer por NINGUNA ruta de la aplicación. El
// expediente mostraba que una consulta existía («Encounter · SIGNED · v3») y ni una palabra de lo que decía; el timeline
// lo admitía en su propia leyenda: «metadatos, sin contenido».
//
// Lo que estas pruebas fijan es que el contenido se lee EN PANTALLA, no solo que el endpoint responde: el backend ya se
// prueba en vivo contra Postgres (`scripts/v22/live-encounter-note-reader-proof.mts`, 26 comprobaciones). Aquí se prueba
// lo que el médico ve y a cuántos clics lo tiene.
describe("Lector de la nota clínica: las consultas pasadas se leen (auditoría clínica 06-oct-2026)",()=>{

 it("Historia clínica: lista las consultas del paciente CON SU FECHA, la más reciente primero",async()=>{
  render(<Workspace/>);
  await toExpediente();
  fireEvent.click(await screen.findByRole("button",{name:/^Historia clínica/}));
  const sec=(await screen.findByRole("heading",{name:"Consultas de este paciente"})).closest("section")!;
  // La FECHA ABSOLUTA, que es lo que el expediente no tenía en ninguna parte (imprimía «v3» en su lugar).
  expect(await within(sec).findByText("18 sep 2026, 09:20")).toBeTruthy();
  expect(within(sec).getByText("2 jun 2026, 03:05")).toBeTruthy();
  // Orden: la más reciente arriba, y marcada como tal (un expediente se lee de lo último hacia atrás).
  const filas=within(sec).getAllByRole("button",{expanded:false});
  expect(filas[0]!.textContent).toContain("18 sep 2026");
  expect(filas[0]!.textContent).toContain("más reciente");
  // Firmada vs abierta, y documentada vs vacía: se distinguen SIN abrir la nota.
  expect(filas[0]!.textContent).toContain("Firmada 18 sep 2026");
  expect(filas[1]!.textContent).toContain("Abierta, sin firmar");
  expect(filas[1]!.textContent).toContain("sin nota escrita");
 });

 it("un clic abre la nota: la valoración y el plan salen ÍNTEGROS, con su firmante y sus enmiendas",async()=>{
  render(<Workspace/>);
  await toExpediente();
  fireEvent.click(await screen.findByRole("button",{name:/^Historia clínica/}));
  const sec=(await screen.findByRole("heading",{name:"Consultas de este paciente"})).closest("section")!;
  await within(sec).findByText("18 sep 2026, 09:20"); // el índice llega tras el debounce del efecto del paciente
  // UN clic, desde la fila misma: el defecto que se corrige es «todo está en menús dentro de submenús».
  fireEvent.click(within(sec).getAllByRole("button",{expanded:false})[0]!);
  // El TEXTO que el médico escribió, literal — no un resumen ni un recuento.
  expect(await within(sec).findByText("DM2 descontrolada: HbA1c 8.2 %. ERC G3a estable, TFG 48.")).toBeTruthy();
  expect(within(sec).getByText("Subir metformina a 850 mg c/12 h. HbA1c y creatinina en 3 meses.")).toBeTruthy();
  expect(within(sec).getByRole("heading",{name:"Valoración"})).toBeTruthy();
  expect(within(sec).getByRole("heading",{name:"Plan"})).toBeTruthy();
  // Quién firmó, con qué cédula y cuándo: una nota sin firmante identificado no es una nota médica.
  expect(within(sec).getByText(/Dra\. Laura Hernández/)).toBeTruthy();
  expect(within(sec).getByText(/cédula 7654321/)).toBeTruthy();
  expect(within(sec).getByText(/Firmada el/)).toBeTruthy();
  // La ENMIENDA posterior a la firma, con su motivo: es el único modo legal de corregir una nota firmada.
  expect(within(sec).getByText("Se corrige la TFG: 46, no 48.")).toBeTruthy();
  expect(within(sec).getByText(/Error de transcripción del laboratorio/)).toBeTruthy();
  // Y se avisa de que la lectura queda registrada (es un acceso a PHI, no una consulta anónima).
  expect(within(sec).getByText(/queda registrada en la bitácora de accesos/)).toBeTruthy();
 });

 it("una consulta abierta y sin documentar lo DICE, no inventa contenido ni se presenta como nota",async()=>{
  render(<Workspace/>);
  await toExpediente();
  fireEvent.click(await screen.findByRole("button",{name:/^Historia clínica/}));
  const sec=(await screen.findByRole("heading",{name:"Consultas de este paciente"})).closest("section")!;
  await within(sec).findByText("2 jun 2026, 03:05");
  fireEvent.click(within(sec).getAllByRole("button",{expanded:false})[1]!);
  expect(await within(sec).findByText(/no se documentó: no hay valoración ni plan que leer/)).toBeTruthy();
  // Y se advierte que un borrador no tiene valor legal: la pantalla no deja creer que esté firmado.
  expect(within(sec).getByText(/es un borrador y no tiene valor legal/)).toBeTruthy();
 });

 it("Consulta: la ÚLTIMA VISITA está arriba del SOAP y su nota se abre con un clic, sin salir de la consulta",async()=>{
  render(<Workspace/>);
  await abrirConsulta();
  // La consulta se acota a la tarjeta: las secciones de las OTRAS pestañas siguen montadas con `hidden` (ésa es la deuda
  // que la auditoría marcó aparte), así que una búsqueda global encontraría la misma fecha dos veces.
  const tarjeta=(await screen.findByText("Última visita")).closest("div")!.parentElement!;
  // El dato que el médico necesita ANTES de teclear: cuándo fue la visita anterior.
  expect(within(tarjeta).getByText("18 sep 2026, 09:20")).toBeTruthy();
  // Un clic y el plan anterior está a la vista, en la misma pantalla donde se escribe el de hoy.
  fireEvent.click(within(tarjeta).getByRole("button",{name:"Leer la nota anterior"}));
  expect(await within(tarjeta).findByText("Subir metformina a 850 mg c/12 h. HbA1c y creatinina en 3 meses.")).toBeTruthy();
  expect(within(tarjeta).getByText(/Plan que se dejó/)).toBeTruthy();
  // La consulta ABIERTA de hoy no se ofrece como «última visita»: sería leerse a sí mismo.
  expect(within(tarjeta).queryByText("2 jun 2026, 03:05")).toBeNull();
 });

 it("accesibilidad: el lector de la nota no tiene violaciones axe serias o críticas",async()=>{
  const{container}=render(<Workspace/>);
  await toExpediente();
  fireEvent.click(await screen.findByRole("button",{name:/^Historia clínica/}));
  const sec=(await screen.findByRole("heading",{name:"Consultas de este paciente"})).closest("section")!;
  await within(sec).findByText("18 sep 2026, 09:20");
  fireEvent.click(within(sec).getAllByRole("button",{expanded:false})[0]!);
  await within(sec).findByText("DM2 descontrolada: HbA1c 8.2 %. ERC G3a estable, TFG 48.");
  await noSeriousAxe(container,"lector de la nota clínica");
 });
});
