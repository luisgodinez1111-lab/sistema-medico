// @vitest-environment jsdom
import{describe,it,expect,afterEach}from"vitest";
import{render,screen,fireEvent,cleanup}from"@testing-library/react";
import axe from"axe-core";
import Gux001 from"../../apps/web/app/workspace/gux-001/page";
// GUX-001 — pruebas de RENDER (jsdom): confirman en el DOM la semántica no-solo-color, la no-fuga de
// estados prohibidos y la accesibilidad detectable sin navegador. Cierra parte del gate del contrato.
afterEach(cleanup);
describe("GUX-001 render (jsdom)",()=>{
 it("patient context (P0/P1/P2) visible + gate BLOCKED con label de TEXTO (no solo color)",()=>{
  render(<Gux001/>);
  expect(screen.getByTestId("patient-header")).toBeTruthy();
  expect(screen.getByText(/Hernández-Ramírez/)).toBeTruthy();
  expect(screen.getByText("Críticos abiertos")).toBeTruthy();
  expect(screen.getByTestId("gate-status").textContent).toBe("Firma bloqueada");           // estado en texto
  expect(screen.getByTestId("result-state").textContent).toMatch(/Crítico/); // no solo color
 });
 it("valor y unidad asociados: 7.0 mEq/L",()=>{
  render(<Gux001/>);
  expect(screen.getByTestId("result-value").textContent).toContain("7.0");
  expect(screen.getByText("mEq/L")).toBeTruthy();
 });
 it("no existe botón de firma con un crítico abierto (CRITICAL_OPEN+SIGN_READY no alcanzable en el DOM)",()=>{
  render(<Gux001/>);
  expect(screen.queryByTestId("btn-sign")).toBeNull();
 });
 it("resolver SIN evidencia muestra error y sigue bloqueado",()=>{
  render(<Gux001/>);
  fireEvent.click(screen.getByTestId("btn-resolve"));
  expect(screen.getByText(/evidencia clínica concreta/i)).toBeTruthy();
  expect(screen.getByTestId("gate-status").textContent).toBe("Firma bloqueada");
 });
 it("reconocer NO resuelve (ACKNOWLEDGED != RESOLVED)",()=>{
  render(<Gux001/>);
  fireEvent.click(screen.getByText("Solo reconocer"));
  expect(screen.getByText(/ACKNOWLEDGED ≠ RESOLVED/)).toBeTruthy();
  expect(screen.getByTestId("gate-status").textContent).toBe("Firma bloqueada");
 });
 it("banner degradado persistente (DEGRADED_DEPENDENCY+EMPTY_SUCCESS no reclama éxito vacío)",()=>{
  render(<Gux001/>);
  expect(screen.getByText(/Modo degradado/)).toBeTruthy();
 });
 it("sin violaciones de accesibilidad críticas/serias detectables por axe (jsdom)",async()=>{
  const{container}=render(<Gux001/>);
  const results=await axe.run(container as unknown as Element,{resultTypes:["violations"]});
  const seriousIds=results.violations.filter(v=>v.impact==="critical"||v.impact==="serious").map(v=>v.id);
  expect(seriousIds,`violaciones serias: ${JSON.stringify(seriousIds)}`).toEqual([]);
 });
});
