// @vitest-environment jsdom
import{describe,it,expect,vi,afterEach}from"vitest";
import{render,screen,cleanup,fireEvent}from"@testing-library/react";
// Auditoría 2026-09-19 (U-01, U-02, U-03): VERDAD CLÍNICA EN PANTALLA bajo FALLO del backend.
// El test de render existente usa un backend simulado que nunca falla; este cubre el camino contrario:
// si la API responde 500, la UI NO debe rellenar con datos de maqueta ni aparentar "sin pendientes".
vi.mock("../../apps/web/lib/session-client",()=>({
 getStoredSession:()=>({sessionId:"testsession0001",expiresAt:Math.floor(Date.now()/1000)+3600,tokenType:"Bearer"}),
 logout:async()=>{},apiUpload:async()=>({status:500,body:{}}),apiDelete:async()=>({status:500,body:{}}),apiDownload:async()=>null,
 apiRequest:async()=>({status:500,body:{error:{code:"INTERNAL",message:"Unexpected runtime error"}}}),
}));
import Workspace from"../../apps/web/app/workspace/page";
afterEach(cleanup);

// Identidades y valores que ANTES se pintaban como si fueran reales cuando no había datos.
const FICTICIOS=["María Fernández López","María Fernández","Pérez López, Juan","Juan Pérez López","Sofía Vega Ramírez","García Herrera, Laura","Potasio 6.2","234 pacientes"];

describe("verdad clínica con el backend caído",()=>{
 it("Inicio: no aparece ningún paciente, tarea ni cita de maqueta",async()=>{
  render(<Workspace/>);
  await screen.findAllByText(/Cargando|Sin tareas|Aún no hay pacientes|Sin citas/,{}, {timeout:3000});
  for(const f of FICTICIOS)expect(screen.queryByText(new RegExp(f.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")))).toBeNull();
 });
 it("un fallo del backend se anuncia como fallo (role=alert), no como 'sin hallazgos'",async()=>{
  render(<Workspace/>);
  // U-12: sin paciente no se carga nada. Con el backend caído no hay padrón: se entra a "Pacientes" (la lista, estado
  // sin-paciente del expediente) y se usa el fallback "Abrir por ID de paciente" para teclear el ID manualmente.
  fireEvent.click(screen.getByRole("button",{name:"Pacientes"}));
  fireEvent.change(await screen.findByLabelText(/ID de paciente/),{target:{value:"11111111-1111-4111-8111-111111111111"}});
  const alert=await screen.findByText(/No se pudo cargar el expediente/,{}, {timeout:4000});
  expect(alert.closest('[role="alert"]')).not.toBeNull();
  expect(screen.getByRole("button",{name:"Reintentar"})).toBeTruthy();
 });
 // La vista Consulta exige un paciente elegido (inalcanzable con el backend caído), así que su invariante se
 // fija como guarda de REGRESIÓN sobre el fuente: los valores de maqueta que la auditoría encontró no pueden volver.
 it("guarda de regresión: el workspace no contiene identidades ni valores clínicos de maqueta como valor por defecto",async()=>{
  const fs=await import("node:fs");const src=fs.readFileSync("apps/web/app/workspace/page.tsx","utf8");
  for(const bad of['||"María Fernández López"','age??28',':"FEMALE";','allergies.length:1','problems.length:2','??["J02.9","B34.9"]','de 154 plantillas','234 pacientes','Pérez López, Juan'])
   expect(src.includes(bad),`valor de maqueta reintroducido: ${bad}`).toBe(false);
 });
});
