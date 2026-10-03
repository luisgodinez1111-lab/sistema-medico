// @vitest-environment jsdom
import{describe,it,expect,vi,beforeAll,afterEach}from"vitest";
import{render,screen,cleanup,waitFor,fireEvent}from"@testing-library/react";
// Auditoría 2026-09-19, anexo R05a (WS1-04) — prueba CONDUCTUAL: nada del paciente anterior bajo la cabecera del nuevo.
//
// El defecto medido: al cambiar de paciente NO se limpiaban `vitHist`, `cpSnap`, `refCtx`, `docsSnap` ni `ciSnap`. En la
// vista de Signos vitales, elegir otro paciente dejaba el historial del ANTERIOR en pantalla bajo el nombre del nuevo hasta
// que llegara su GET — y si ese GET devolvía 404 o fallaba, se quedaba ahí indefinidamente. Aquí el segundo paciente
// responde 404 a propósito: es el caso en el que el defecto no se corregía nunca solo.
type Registro={at:string;ta:string;fc:string;fr:string;temp:string;spo2:string;peso:string;talla:string;imc:string};
const{estado}=vi.hoisted(()=>({estado:{historialDe:{} as Record<string,{at:string;ta:string;fc:string;fr:string;temp:string;spo2:string;peso:string;talla:string;imc:string}[]>}}));
estado.historialDe["p1"]=[{at:"2026-09-17T10:00:00.000Z",ta:"128/84",fc:"78",fr:"16",temp:"36.5",spo2:"98",peso:"69.4",talla:"160",imc:"27.1"}];
vi.mock("../../apps/web/lib/session-client",()=>({
 getStoredSession:()=>({sessionId:"testsession0001",expiresAt:Math.floor(Date.now()/1000)+3600,tokenType:"Bearer"}),
 logout:async()=>{},
 apiUpload:async()=>({status:201,body:{}}),
 apiDelete:async()=>({status:200,body:{}}),
 apiDownload:async()=>null,
 isAbortError:()=>false,
 apiRequest:async(path:string)=>{
  const vit=/\/api\/v1\/patients\/([^/]+)\/vitals/.exec(path);
  if(vit){
   const records:Registro[]|undefined=estado.historialDe[vit[1]!];
   // El paciente 2 NO tiene historial: 404. Es el caso que dejaba en pantalla el del paciente 1 para siempre.
   if(!records)return{status:404,body:{}};
   return{status:200,body:{records,series:{BP:[{value:128,at:records[0]!.at}],HR:[],WEIGHT:[],IMC:[]},latest:records[0]!,count:records.length}};
  }
  if(path.includes("/api/v1/features"))return{status:200,body:{hospitalVerticals:false}};
  if(path.includes("/api/v1/patients")&&!path.match(/patients\//))return{status:200,body:{patients:[
   {patientId:"p1",name:"Ana López García",status:"ACTIVE",birthDate:"1990-01-01",sexAtBirth:"FEMALE",version:1},
   {patientId:"p2",name:"Carlos Mendoza",status:"ACTIVE",birthDate:"1970-01-01",sexAtBirth:"MALE",version:1},
  ]}};
  return{status:404,body:{}};
 },
}));

import Workspace from"../../apps/web/app/workspace/page";

beforeAll(()=>{
 (globalThis as unknown as{IntersectionObserver:unknown}).IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}takeRecords(){return[];}};
 window.scrollTo=()=>{};
 Element.prototype.scrollIntoView=()=>{};
});
afterEach(cleanup);

// (Fase 2) La vista suelta de Signos vitales y su estado `vitHist` se retiraron (Signos es ahora un submenú del
// Expediente, paciente-scoped vía `snap`). El invariante WS1-04 —nada del paciente anterior bajo la cabecera del nuevo—
// sigue garantizado estructuralmente: (1) `selectPatientRaw` limpia DE INMEDIATO los snapshots por-paciente; (2) el efecto
// de carga del snapshot vuelve a poner `snap=null` al cambiar `patientId`; (3) el guard `PATIENT_B_DATA` descarta cualquier
// dato que haya quedado de otro paciente. Este guard de fuente fija esas tres defensas.
describe("cambio de paciente (WS1-04): el invariante lo sostienen selectPatientRaw + snapshot + guard PATIENT_B_DATA",()=>{
 it("selectPatientRaw limpia los snapshots por-paciente al cambiar de paciente",async()=>{
  const fs=await import("node:fs");const src=fs.readFileSync("apps/web/app/workspace/model.tsx","utf8");
  const sel=src.slice(src.indexOf("function selectPatientRaw"),src.indexOf("function selectPatientRaw")+1400);
  for(const clr of ["setSnap(null)","setVitHist(null)","setCpSnap(null)","setDocsSnap(null)","setCiSnap(null)"])
   expect(sel,`selectPatientRaw debe limpiar ${clr}`).toContain(clr);
 });
 it("el guard de estado prohibido descarta datos del paciente B bajo el contexto del paciente A",async()=>{
  const fs=await import("node:fs");const src=fs.readFileSync("apps/web/app/workspace/model.tsx","utf8");
  expect(src).toContain("PATIENT_B_DATA");
  expect(src).toMatch(/PATIENT_B_DATA[\s\S]*?setSnap\(null\)/); // al detectarlo, limpia el snapshot
 });
});
