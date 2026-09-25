// @vitest-environment jsdom
import{describe,it,expect,vi,beforeAll,afterEach}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent}from"@testing-library/react";
// Auditoría 2026-09-19, anexo R05a (R05a-F06 / WS1-05) — prueba CONDUCTUAL de la cancelación, en el DOM.
//
// El test estructural (`request-cancellation.test.ts`) comprueba que el código pide la cancelación; éste comprueba que de
// verdad OCURRE al montar el espacio de trabajo real: que cada lectura viaja con su señal, que al cambiar de vista se
// aborta lo de la vista anterior y que al desmontar no queda NINGUNA petición sin abortar. Antes de esta corrección no
// existía ninguna señal: el número de peticiones abortadas era cero por construcción.
const{leidas}=vi.hoisted(()=>({leidas:[] as {path:string;signal:AbortSignal|undefined}[]}));
vi.mock("../../apps/web/lib/session-client",()=>({
 getStoredSession:()=>({sessionId:"testsession0001",expiresAt:Math.floor(Date.now()/1000)+3600,tokenType:"Bearer"}),
 logout:async()=>{},
 apiUpload:async()=>({status:201,body:{}}),
 apiDelete:async()=>({status:200,body:{}}),
 apiDownload:async()=>null,
 isAbortError:(e:unknown)=>e instanceof Error&&e.name==="AbortError",
 apiRequest:async(path:string,init?:{method?:string;signal?:AbortSignal})=>{
  if((init?.method??"GET")==="GET")leidas.push({path,signal:init?.signal});
  if(path.includes("/api/v1/features"))return{status:200,body:{hospitalVerticals:false}};
  if(path.includes("/api/v1/patients")&&!path.match(/patients\//))return{status:200,body:{patients:[{patientId:"p1",name:"Ana López García",status:"ACTIVE",version:1}]}};
  return{status:404,body:{}}; // 404 = sin datos; el cockpit lo pinta vacío, que es lo que aquí interesa
 },
}));

import Workspace from"../../apps/web/app/workspace/page";

beforeAll(()=>{
 (globalThis as unknown as{IntersectionObserver:unknown}).IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}takeRecords(){return[];}};
 window.scrollTo=()=>{};
 Element.prototype.scrollIntoView=()=>{};
});
afterEach(()=>{cleanup();leidas.length=0;});

describe("cancelación real de lecturas en el espacio de trabajo (R05a-F06)",()=>{
 it("cada lectura de auto-carga viaja con su señal de cancelación",async()=>{
  render(<Workspace/>);
  await waitFor(()=>expect(leidas.length).toBeGreaterThanOrEqual(3));
  const sinSenal=leidas.filter(x=>!(x.signal instanceof AbortSignal)).map(x=>x.path);
  expect(sinSenal,"lectura de auto-carga sin señal: no se puede cancelar").toEqual([]);
 });
 it("al cambiar de vista se aborta lo que estaba cargando la vista anterior",async()=>{
  render(<Workspace/>);
  await waitFor(()=>expect(leidas.length).toBeGreaterThanOrEqual(3));
  const antes=leidas.map(x=>x.signal!);
  expect(antes.every(s=>!s.aborted),"nada abortado mientras la vista sigue abierta").toBe(true);
  fireEvent.click(screen.getByRole("button",{name:"Facturación"}));
  // Los efectos con `view` en sus dependencias se rehacen: su limpieza aborta la carga anterior.
  await waitFor(()=>expect(antes.some(s=>s.aborted),"cambiar de vista no abortó ninguna carga").toBe(true));
 });
 it("al salir del espacio de trabajo no queda NINGUNA petición sin abortar",async()=>{
  render(<Workspace/>);
  await waitFor(()=>expect(leidas.length).toBeGreaterThanOrEqual(3));
  const todas=leidas.map(x=>x.signal!);
  cleanup(); // desmontar = lo que pasa al cerrar la pestaña o navegar fuera
  const vivas=todas.filter(s=>!s.aborted);
  expect(vivas.length,`${vivas.length} de ${todas.length} lecturas seguirían en vuelo tras desmontar`).toBe(0);
 });
});
