// @vitest-environment jsdom
import{describe,it,expect,vi,afterEach}from"vitest";
import{render,screen,fireEvent,cleanup}from"@testing-library/react";
import{Alert,AllergyBanner,Badge,StateBadge,Button,Card,PatientHeader,TONE,toneOfState}from"../../packages/design-system/src";
// Auditoría 2026-09-19 (K-09): los seis componentes que el Storybook perdido documentaba existen como código fuente y
// cumplen su contrato: anatomía, roles ARIA y estado nunca comunicado solo por color.
afterEach(cleanup);
describe("design system — componentes (K-09)",()=>{
 it("Button: type=button por defecto, dispara onClick y en `busy` se bloquea y se anuncia (aria-busy)",()=>{
  const onClick=vi.fn();
  const{rerender}=render(<Button onClick={onClick}>Guardar</Button>);
  const b=screen.getByRole("button",{name:"Guardar"});
  expect(b.getAttribute("type")).toBe("button");
  fireEvent.click(b);expect(onClick).toHaveBeenCalledTimes(1);
  rerender(<Button onClick={onClick} busy>Guardar</Button>);
  expect((screen.getByRole("button",{name:"Guardar"}) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByRole("button",{name:"Guardar"}).getAttribute("aria-busy")).toBe("true");
  fireEvent.click(screen.getByRole("button",{name:"Guardar"}));expect(onClick).toHaveBeenCalledTimes(1);
 });
 it("Button: la variante de éxito usa el verde AA del token (no el #16A66A de 3.1:1 que usaba el diálogo de firma)",()=>{
  render(<Button variant="success">Firmar</Button>);
  expect(screen.getByRole("button",{name:"Firmar"}).style.background).toBe("rgb(19, 122, 80)");
 });
 it("Card: con título expone un encabezado enlazado por aria-labelledby",()=>{
  render(<Card title="Resumen"><p>cuerpo</p></Card>);
  const h=screen.getByRole("heading",{name:"Resumen"});
  expect(h.id).not.toBe("");
  expect(h.parentElement?.getAttribute("aria-labelledby")).toBe(h.id);
  expect(screen.getByText("cuerpo")).toBeTruthy();
 });
 it("Badge/StateBadge: el texto es el estado y el tono sale de la máquina de estados (lo desconocido nunca es verde)",()=>{
  render(<><StateBadge state="SIGNED"/><StateBadge state="ADVERSE_EVENT"/><StateBadge state="ESTADO_NUEVO"/><Badge tone="info">Info</Badge></>);
  expect(screen.getByText("SIGNED").style.color).toBe(hexToRgb(TONE.success.fg));
  expect(screen.getByText("ADVERSE_EVENT").style.color).toBe(hexToRgb(TONE.critical.fg));
  expect(toneOfState("ESTADO_NUEVO")).toBe("brand");
  expect(screen.getByText("Info").style.background).toBe(hexToRgb(TONE.info.bg));
 });
 it("Alert: crítico ⇒ role=alert; el resto ⇒ role=status; la acción se renderiza dentro",()=>{
  render(<><Alert tone="critical" action={<Button variant="ghost">Reintentar</Button>}>Falló la carga</Alert><Alert tone="info" title="Aviso">Todo en orden</Alert></>);
  const a=screen.getByRole("alert");
  expect(a.textContent).toContain("Falló la carga");
  expect(a.querySelector("button")?.textContent).toBe("Reintentar");
  const s=screen.getByRole("status");
  expect(s.textContent).toContain("Aviso");expect(s.textContent).toContain("Todo en orden");
 });
 it("AllergyBanner: sin expediente cargado NUNCA dice «sin alergias» (UNKNOWN+NORMAL); vacío ⇒ «sin alergias documentadas»",()=>{
  const{rerender}=render(<AllergyBanner allergies={null}/>);
  expect(screen.getByRole("status").textContent).toMatch(/no evaluadas/i);
  expect(screen.queryByText(/sin alergias/i)).toBeNull();
  expect(screen.getByRole("status").style.color).toBe(hexToRgb(TONE.attention.fg));
  rerender(<AllergyBanner allergies={[]}/>);
  expect(screen.getByText("✓ Sin alergias documentadas")).toBeTruthy();
  rerender(<AllergyBanner allergies={["Penicilina","AINE","Látex","Mariscos","Yodo","Sulfas","Polen"]} max={5}/>);
  const list=screen.getByRole("list",{name:"Alergias documentadas"});
  expect(list.querySelectorAll("li").length).toBe(6); // 5 mostradas + «y 2 más»
  expect(screen.getByText("y 2 más")).toBeTruthy();
  expect(screen.getByText("Penicilina").style.color).toBe(hexToRgb(TONE.critical.fg));
 });
 it("PatientHeader: identidad (iniciales, nombre, ID corto), estado y acciones; sin nombre ⇒ «Paciente anónimo»",()=>{
  const{rerender}=render(<PatientHeader name="María López" patientId="11111111-2222-4333-8444-555555555555" status={<span>2 alergias</span>} actions={<button>Cambiar</button>}/>);
  const region=screen.getByRole("region",{name:"Paciente activo"});
  expect(region.textContent).toContain("MA");
  expect(region.textContent).toContain("María López");
  expect(region.textContent).toContain("11111111");
  expect(region.textContent).not.toContain("2222-4333");
  expect(region.textContent).toContain("2 alergias");
  expect(screen.getByRole("button",{name:"Cambiar"})).toBeTruthy();
  rerender(<PatientHeader name="" patientId="00000000-0000-4000-8000-000000000000"/>);
  expect(screen.getByText("Paciente anónimo")).toBeTruthy();
  expect(screen.getByRole("region",{name:"Paciente activo"}).textContent).toContain("—");
 });
});
function hexToRgb(hex:string):string{const n=parseInt(hex.slice(1),16);return `rgb(${(n>>16)&255}, ${(n>>8)&255}, ${n&255})`;}
