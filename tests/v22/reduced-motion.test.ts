import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Refactor UI/UX pro-max — a11y (WCAG 2.3.3 «Animación desde interacciones»): si el usuario pide movimiento reducido en su
// sistema, el workspace debe anular sus transiciones/animaciones y dejar de hacer scroll suave. Este test fija que exista el
// reset global CSS bajo @media(prefers-reduced-motion) y que el scroll programático consulte la preferencia en JS (el media
// query CSS no afecta al `behavior:"smooth"` de JS).
const SRC=fs.readFileSync(path.join("apps/web/app/workspace/shared.tsx"),"utf8");
describe("movimiento reducido (WCAG 2.3.3)",()=>{
 it("RAIL_CSS anula transiciones y animaciones globalmente bajo prefers-reduced-motion",()=>{
  const m=/@media\(prefers-reduced-motion:reduce\)\{([\s\S]*?)\n\}/.exec(SRC);
  expect(m,"falta el bloque @media(prefers-reduced-motion:reduce)").not.toBeNull();
  const body=m![1]!;
  expect(body,"debe anular las animaciones a nivel global").toMatch(/\.mos-app \*[^{]*\{[^}]*animation-duration:\.001ms!important/);
  expect(body,"debe anular las transiciones a nivel global").toMatch(/transition-duration:\.001ms!important/);
 });
 it("el scroll programático respeta la preferencia (no fuerza «smooth» a ciegas)",()=>{
  expect(SRC,"debe existir el helper prefersReducedMotion").toMatch(/export const prefersReducedMotion[^\n]*matchMedia\("\(prefers-reduced-motion: reduce\)"\)/);
  // scrollToSection deriva su behavior de la preferencia, no lo fija en "smooth".
  const fn=/export function scrollToSection[\s\S]*?\n\}/.exec(SRC)![0];
  expect(fn,"scrollToSection debe consultar prefersReducedMotion").toMatch(/prefersReducedMotion\(\)/);
  expect(fn,"scrollToSection ya no debe fijar behavior:\"smooth\" literal").not.toMatch(/behavior:"smooth"/);
 });
 it("el scroll al inicio pasa por el helper scrollTop (movimiento reducido incluido)",()=>{
  expect(SRC).toMatch(/export const scrollTop[^\n]*prefersReducedMotion\(\)\?"auto":"smooth"/);
 });
});
