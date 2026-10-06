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

 // Auditoría clínica multiespecialidad (06-oct-2026) — LA FECHA EN TODAS LAS FILAS.
 //
 // Las filas del expediente imprimían `v{version}` en el sitio donde iba la fecha: «metformina 850 mg · v4». Ocho
 // especialistas coincidieron en que eso no es un dato clínico. Lo que esta prueba fija es que la fecha ESTÁ donde el
 // médico la busca, y que las dos fechas que el read-model trae se distinguen: un dato que nadie tocó muestra una sola
 // fecha; uno que cambió muestra el alta y la actualización, porque «desde cuándo toma metformina» y «cuándo se le
 // suspendió» son dos preguntas distintas que se hacen sobre la misma fila.
 it("las filas del expediente llevan su FECHA, no solo el número de versión",async()=>{
  render(<Workspace/>);
  await toExpediente();
  // Alergias: un dato que nadie ha tocado desde 2017 — una sola fecha, la del registro.
  fireEvent.click(await screen.findByRole("button",{name:/^Alergias/}));
  const alg=(await screen.findByRole("heading",{name:"Alergias"})).closest("section")!;
  const fAlg=await within(alg).findByText(/4 jul 2017/);
  expect(fAlg.textContent).toContain("v1");
  expect(fAlg.textContent).not.toContain("act."); // no cambió: no se inventa una actualización
  // Medicación: prescrita en marzo, suspendida en septiembre — las DOS fechas, porque las dos deciden.
  fireEvent.click(screen.getByRole("button",{name:/^Medicación/}));
  const med=(await screen.findByRole("heading",{name:"Medicación"})).closest("section")!;
  const fMed=await within(med).findByText(/2 mar 2026 · act\. 18 sep 2026/);
  expect(fMed.textContent).toContain("v4");
  // Problemas: la fecha del diagnóstico, que es lo que fecha la cronicidad.
  fireEvent.click(screen.getByRole("button",{name:/^Problemas/}));
  const prob=(await screen.findByRole("heading",{name:"Lista de problemas"})).closest("section")!;
  expect(await within(prob).findByText(/12 mar 2019/)).toBeTruthy();
 });

 // Defecto que destapó el mock del expediente vivo (06-oct-2026). La hidratación hacía `setMeds(c.medications)`: la
 // respuesta del servidor sustituía la lista entera. Si el médico documentaba algo en los segundos que tarda la respuesta,
 // su fila DESAPARECÍA de la pantalla hasta la siguiente recarga — y lo que desaparece en un expediente se vuelve a
 // teclear. Ahora se funde por id: el servidor manda sobre lo que conoce, lo de esta sesión sobrevive. Sin esta prueba el
 // defecto solo rompía un test de medicación con un mensaje que no decía por qué.
 it("una fila creada en esta sesión sobrevive a la hidratación del expediente, y no se duplica la del servidor",async()=>{
  render(<Workspace/>);
  await toExpediente();
  fireEvent.click(await screen.findByRole("button",{name:/^Alergias/}));
  const alg=(await screen.findByRole("heading",{name:"Alergias"})).closest("section")!;
  await within(alg).findByText(/4 jul 2017/); // la del servidor ya está hidratada
  fireEvent.change(within(alg).getByPlaceholderText(/sustancia/i),{target:{value:"sulfas"}});
  fireEvent.click(within(alg).getByRole("button",{name:/Registrar alergia/}));
  // Las DOS: la hidratada del servidor y la que se acaba de crear.
  expect(await within(alg).findByText(/sulfas/)).toBeTruthy();
  expect(within(alg).getByText(/penicilina — exantema/)).toBeTruthy();
  // Y la del servidor aparece UNA vez: fundir no es concatenar.
  expect(within(alg).getAllByText(/penicilina — exantema/).length).toBe(1);
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
