// @vitest-environment jsdom
import{describe,it,expect,vi}from"vitest";
import{render,screen,fireEvent,within}from"@testing-library/react";
const{posted}=vi.hoisted(()=>({posted:[] as {path:string;body:unknown}[]}));
vi.mock("../../apps/web/lib/session-client",async()=>{const h=await vi.importActual<typeof import("./_cockpit-harness")>("./_cockpit-harness");return h.makeSessionClientMock(posted);});
import Workspace from"../../apps/web/app/workspace/page";
import{installCockpitEnv,noSeriousAxe,toExpediente}from"./_cockpit-harness";
installCockpitEnv();

// Auditoría clínica multiespecialidad (06-oct-2026) — LOS DOS BOTONES QUE ESTABAN MUERTOS EN LA CARA DEL MÉDICO.
//
//   · «Otorgar» del consentimiento informado enviaba `{signerName:"Paciente/Tutor"}` —un nombre LITERAL, inventado— y el
//     servidor respondía 400 SIEMPRE, porque exige la huella sha256 del documento presentado y el método con que se
//     recabó. El consentimiento informado es la pieza que autoriza un procedimiento (LGS art. 81, NOM-004 numeral 10.1).
//   · «Enmendar» de signos vitales reenviaba el MISMO valor registrado y solo preguntaba el motivo: escribía en un
//     registro de solo-añadir una corrección que no corregía nada.
//
// El contrato con el servidor se prueba en vivo contra Postgres (`live-ui-repaired-buttons-proof.mts`, 23
// comprobaciones, importando los MISMOS constructores que ejecuta el navegador). Aquí se prueba lo que el médico ve: que
// el formulario existe, que pide lo que la ley exige y que la pantalla lo dice cuando falta algo, en vez de mandar un 400.
describe("Los botones reparados: el formulario pide lo que el servidor exige (auditoría clínica 06-oct-2026)",()=>{

 const irA=async(pestania:RegExp,titulo:string)=>{
  await toExpediente();
  fireEvent.click(await screen.findByRole("button",{name:pestania}));
  return(await screen.findByRole("heading",{name:titulo})).closest("section")!;
 };

 it("Consentimiento: «Otorgar» abre el formulario con firmante, calidad y método — ya no manda un nombre inventado",async()=>{
  render(<Workspace/>);
  const sec=await irA(/^Coordinación/,"Consentimiento informado");
  // La fila dice QUÉ documento es y que tiene huella: sin eso no hay nada que firmar.
  const fila=(await within(sec).findByText("PROCEDURE")).closest("div")!.parentElement!.parentElement!;
  expect(fila.textContent).toContain("CI-2026-0042");
  fireEvent.click(within(fila).getByRole("button",{name:"Otorgar"}));
  // Lo que la ley exige, preguntado: quién firma, en qué calidad y cómo se recabó.
  expect(await within(sec).findByLabelText("Nombre de quien firma")).toBeTruthy();
  expect(within(sec).getByLabelText("Calidad de quien firma")).toBeTruthy();
  expect(within(sec).getByLabelText("Método con que se recabó el consentimiento")).toBeTruthy();
  // Y se declara lo que NO se hace: la identidad no se verifica contra ningún registro oficial.
  expect(within(sec).getByText(/se verifica contra ningún registro oficial/)).toBeTruthy();
  // Una firma autógrafa exige el archivo firmado; sin él la pantalla lo DICE y no envía nada.
  fireEvent.change(within(sec).getByLabelText("Nombre de quien firma"),{target:{value:"Ana López García"}});
  fireEvent.click(within(sec).getByRole("button",{name:"Registrar el otorgamiento"}));
  expect(await within(sec).findByText(/exige la referencia del archivo firmado/)).toBeTruthy();
  expect(posted.filter(p=>p.path.includes("/grant")).length,"no se manda un cuerpo que el servidor rechazaría").toBe(0);
  // Con el archivo, se envía — y con la huella que se registró al presentar, no con una inventada.
  fireEvent.change(within(sec).getByLabelText("Referencia del archivo firmado"),{target:{value:"doc:firma-001"}});
  fireEvent.click(within(sec).getByRole("button",{name:"Registrar el otorgamiento"}));
  const enviado=await vi.waitFor(()=>{const p=posted.filter(x=>x.path.includes("/grant")).at(-1);expect(p).toBeTruthy();return p!;});
  const b=enviado.body as Record<string,unknown>;
  expect(b["signerName"],"el firmante es quien el médico escribió, no «Paciente/Tutor»").toBe("Ana López García");
  expect(b["documentHash"],"la huella es la que se registró al presentar").toBe("a".repeat(64));
  expect(b["method"]).toBe("WET_SIGNATURE");
  expect(b["signatureArtifactRef"]).toBe("doc:firma-001");
 });

 it("Consentimiento verbal: exige testigo en vez de archivo, porque un verbal sin testigo no es admisible",async()=>{
  render(<Workspace/>);
  const sec=await irA(/^Coordinación/,"Consentimiento informado");
  const fila=(await within(sec).findByText("PROCEDURE")).closest("div")!.parentElement!.parentElement!;
  fireEvent.click(within(fila).getByRole("button",{name:"Otorgar"}));
  fireEvent.change(await within(sec).findByLabelText("Nombre de quien firma"),{target:{value:"Ana López García"}});
  fireEvent.change(within(sec).getByLabelText("Método con que se recabó el consentimiento"),{target:{value:"VERBAL_WITNESSED"}});
  // El campo cambia con el método: ya no pide archivo, pide testigo.
  expect(await within(sec).findByLabelText("Nombre del testigo")).toBeTruthy();
  expect(within(sec).queryByLabelText("Referencia del archivo firmado")).toBeNull();
  expect(within(sec).getByText(/verbal sin testigo no es admisible/)).toBeTruthy();
 });

 it("Consentimiento presentado SIN huella: la pantalla lo avisa en vez de dejar firmar algo que no se puede acreditar",async()=>{
  render(<Workspace/>);
  const sec=await irA(/^Coordinación/,"Consentimiento informado");
  const fila=(await within(sec).findByText("ANESTHESIA")).closest("div")!.parentElement!.parentElement!;
  expect(fila.textContent,"la propia fila declara que falta la huella").toContain("presentado SIN huella del documento");
  fireEvent.click(within(fila).getByRole("button",{name:"Otorgar"}));
  expect(await within(sec).findByText(/no hay nada que firmar/)).toBeTruthy();
 });

 it("Presentar: se calcula la huella del texto que el paciente lee, no se guarda el texto",async()=>{
  render(<Workspace/>);
  const sec=await irA(/^Coordinación/,"Consentimiento informado");
  // El consentimiento en BORRADOR del expediente: es el estado en que se puede presentar.
  const fila=(await within(sec).findByText("DATA_SHARING")).closest("div")!.parentElement!.parentElement!;
  fireEvent.click(within(fila).getByRole("button",{name:"Presentar"}));
  const texto=await within(sec).findByLabelText("Texto del consentimiento presentado");
  expect(within(sec).getByText(/No se guarda el texto: se guarda su huella/)).toBeTruthy();
  // Un texto demasiado corto no es un consentimiento informado: la pantalla lo rechaza antes de enviar.
  fireEvent.change(texto,{target:{value:"ok"}});
  fireEvent.click(within(sec).getByRole("button",{name:"Registrar la presentación"}));
  expect(await within(sec).findByText(/Pega el texto EXACTO/)).toBeTruthy();
 });

 it("Signos vitales: «Enmendar» pide el valor CORREGIDO y rechaza una enmienda que no cambia nada",async()=>{
  render(<Workspace/>);
  const sec=await irA(/^Signos vitales/,"Signos vitales");
  const fila=(await within(sec).findByText(/128\/78/)).closest("div")!.parentElement!.parentElement!;
  fireEvent.click(within(fila).getByRole("button",{name:"Enmendar"}));
  // El valor viene PRECARGADO con el registrado: se corrige sobre lo que hay, no sobre un campo en blanco.
  const valor=await within(sec).findByLabelText("Valor corregido") as HTMLInputElement;
  expect(valor.value).toBe("128/78");
  expect(within(sec).getByLabelText("Unidad del valor corregido")).toBeTruthy();
  expect(within(sec).getByText(/El valor anterior/)).toBeTruthy(); // se dice que no se borra
  // Sin cambiar el valor: la pantalla lo rechaza y NO envía. Era exactamente lo que el botón hacía antes.
  fireEvent.change(within(sec).getByLabelText("Motivo de la corrección"),{target:{value:"error de transcripción"}});
  fireEvent.click(within(sec).getByRole("button",{name:"Guardar la enmienda"}));
  expect(await within(sec).findByText(/una enmienda que no cambia nada no es una corrección/)).toBeTruthy();
  expect(posted.filter(p=>p.path.includes("/amendment")).length).toBe(0);
  // Con el valor corregido sí se envía, y lo que va es el valor NUEVO.
  fireEvent.change(valor,{target:{value:"118/74"}});
  fireEvent.click(within(sec).getByRole("button",{name:"Guardar la enmienda"}));
  const enviado=await vi.waitFor(()=>{const p=posted.filter(x=>x.path.includes("/amendment")).at(-1);expect(p).toBeTruthy();return p!;});
  const b=enviado.body as Record<string,unknown>;
  expect(b["value"],"se manda el valor corregido, no el original").toBe("118/74");
  expect(b["unit"]).toBe("mmHg");
  expect(String(b["reason"])).toContain("transcripción");
 });

 it("accesibilidad: los dos formularios nuevos no tienen violaciones axe serias o críticas",async()=>{
  const{container}=render(<Workspace/>);
  const sec=await irA(/^Coordinación/,"Consentimiento informado");
  const fila=(await within(sec).findByText("PROCEDURE")).closest("div")!.parentElement!.parentElement!;
  fireEvent.click(within(fila).getByRole("button",{name:"Otorgar"}));
  await within(sec).findByLabelText("Nombre de quien firma");
  fireEvent.click(screen.getByRole("button",{name:/^Signos vitales/}));
  const vit=(await screen.findByRole("heading",{name:"Signos vitales"})).closest("section")!;
  const fv=(await within(vit).findByText(/128\/78/)).closest("div")!.parentElement!.parentElement!;
  fireEvent.click(within(fv).getByRole("button",{name:"Enmendar"}));
  await within(vit).findByLabelText("Valor corregido");
  await noSeriousAxe(container,"formularios de otorgamiento y enmienda");
 });
});
