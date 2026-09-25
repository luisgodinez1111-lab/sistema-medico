// @vitest-environment jsdom
import{describe,it,expect,vi,beforeAll,afterEach}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent}from"@testing-library/react";
// Auditoría 2026-09-19, anexo R05a (WS1-12) — prueba CONDUCTUAL del fallo del verificador de interacciones.
//
// El guardián de avisos (`mutation-feedback.test.ts`) encontró este defecto al ampliarlo a las vistas: `run()` no tenía
// mensaje ni `catch`. Si el POST devolvía 400/403/500, o la red fallaba, el médico pulsaba «Verificar interacciones», el
// indicador se apagaba y NO PASABA NADA. En un verificador de interacciones, no pasar nada se lee como «no hay
// interacciones» — y encima el fallo de red quedaba como un rechazo de promesa sin atender.
//
// Aquí se fuerza el fallo del endpoint y se comprueba en el DOM que la pantalla lo dice, y que no se disfraza de «sin
// análisis todavía» (el estado vacío legítimo, el de antes de pulsar).
const{estado}=vi.hoisted(()=>({estado:{fallar:true as boolean}}));
vi.mock("../../apps/web/lib/session-client",()=>({
 getStoredSession:()=>({sessionId:"testsession0001",expiresAt:Math.floor(Date.now()/1000)+3600,tokenType:"Bearer"}),
 logout:async()=>{},
 apiUpload:async()=>({status:201,body:{}}),
 apiDelete:async()=>({status:200,body:{}}),
 apiDownload:async()=>null,
 isAbortError:()=>false,
 apiRequest:async(path:string,init?:{method?:string})=>{
  if(path.includes("/interactions")&&init?.method==="POST"){
   if(estado.fallar)return{status:503,body:{error:{code:"DEGRADED_DEPENDENCY",message:"El motor de interacciones no está disponible"}}};
   return{status:200,body:{maxSeverity:"MAJOR",findings:[{severity:"MAJOR",drugs:["Sertralina","Ibuprofeno"],mechanism:"Mecanismo. Riesgo de sangrado.",recommendation:"Recomendación. Vigilar."}]}};
  }
  if(path.includes("/api/v1/features"))return{status:200,body:{hospitalVerticals:false}};
  return{status:404,body:{}};
 },
}));

import Workspace from"../../apps/web/app/workspace/page";

beforeAll(()=>{
 (globalThis as unknown as{IntersectionObserver:unknown}).IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}takeRecords(){return[];}};
 window.scrollTo=()=>{};
 Element.prototype.scrollIntoView=()=>{};
});
afterEach(()=>{cleanup();estado.fallar=true;});

/** Abre Medicamentos › Interacciones y añade dos fármacos (el verificador nace vacío desde WS1-15c).
 *  Las vistas se cargan con `next/dynamic`, así que hay que esperar a que la pestaña exista. */
async function prepararVerificador(){
 render(<Workspace/>);
 fireEvent.click(screen.getByRole("button",{name:/Medicamentos/}));
 const pestana=await screen.findByRole("button",{name:/^Interacciones$/},{timeout:4000});
 fireEvent.click(pestana);
 const caja=await screen.findByPlaceholderText(/Ej\. Sertralina/);
 const agregar=screen.getByRole("button",{name:"Agregar"});
 fireEvent.change(caja,{target:{value:"Sertralina"}});fireEvent.click(agregar);
 fireEvent.change(caja,{target:{value:"Ibuprofeno"}});fireEvent.click(agregar);
}

describe("el verificador de interacciones no falla en silencio (WS1-12)",()=>{
 it("si el motor no responde, la pantalla lo DICE y no finge un veredicto",async()=>{
  await prepararVerificador();
  expect(screen.getByText("Sin análisis todavía"),"antes de pulsar, el vacío legítimo").toBeTruthy();
  fireEvent.click(screen.getByRole("button",{name:"Verificar interacciones"}));
  const aviso=await screen.findByRole("alert",{},{timeout:2500});
  expect(aviso.textContent??"").toMatch(/No se pudo verificar/);
  // Lo que importa clínicamente: no queda como «no hay interacciones» ni como «sin análisis todavía».
  expect(aviso.textContent??"").toMatch(/No hay veredicto de interacciones/);
  expect(screen.queryByText("Sin análisis todavía"),"el fallo no se disfraza del estado vacío").toBeNull();
  expect(screen.queryByText(/Sin interacciones/),"y no se afirma la ausencia de interacciones").toBeNull();
 });
 it("cuando el motor responde, el veredicto se pinta y el aviso de fallo desaparece",async()=>{
  estado.fallar=false;
  await prepararVerificador();
  fireEvent.click(screen.getByRole("button",{name:"Verificar interacciones"}));
  await waitFor(()=>expect(screen.getAllByText("Mayor").length).toBeGreaterThan(0),{timeout:2500});
  expect(screen.queryByRole("alert"),"sin fallo no hay aviso de fallo").toBeNull();
 });
});
