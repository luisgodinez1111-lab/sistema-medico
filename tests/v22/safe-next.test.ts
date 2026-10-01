import{describe,it,expect}from"vitest";
import{safeNext,DEFAULT_NEXT}from"../../apps/web/lib/safe-next";

// Regresión del reporte "la pestaña ?v=exp&p=…&s=resumen no muestra nada": el deep-link del expediente se perdía al
// rebotar por el login. El fix mete la ruta COMPLETA en ?next= (middleware) y el login la respeta vía safeNext; estas
// pruebas fijan que el deep-link con query sobrevive y que una ruta externa NUNCA se usa (open-redirect).
describe("safeNext — destino post-login del deep-link",()=>{
 it("conserva un deep-link interno del expediente con su query completo",()=>{
  const dl="/workspace?v=exp&p=f96e9ad5-3ad2-4704-bc15-160f0f606b5b&s=resumen";
  expect(safeNext(dl)).toBe(dl);
 });
 it("decodifica un next codificado (como lo manda el middleware)",()=>{
  const dl="/workspace?v=exp&p=abc&s=tratamiento";
  expect(safeNext(encodeURIComponent(dl))).toBe(dl);
 });
 it("cae a /workspace cuando no hay next",()=>{
  expect(safeNext(null)).toBe(DEFAULT_NEXT);
  expect(safeNext(undefined)).toBe(DEFAULT_NEXT);
  expect(safeNext("")).toBe(DEFAULT_NEXT);
 });
 it("rechaza rutas externas y protocol-relative (open-redirect) y cae a /workspace",()=>{
  expect(safeNext("//evil.com/phish")).toBe(DEFAULT_NEXT);
  expect(safeNext("https://evil.com")).toBe(DEFAULT_NEXT);
  expect(safeNext("http://evil.com")).toBe(DEFAULT_NEXT);
  expect(safeNext("/\\evil.com")).toBe(DEFAULT_NEXT);
  expect(safeNext("javascript:alert(1)")).toBe(DEFAULT_NEXT);
  expect(safeNext("evil.com")).toBe(DEFAULT_NEXT);
 });
});
