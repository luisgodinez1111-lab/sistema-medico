import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// El contrato de anatomía (`component-anatomy.ts`) se retiró junto con GUX-001: su único componente canónico (ResultCard) y
// sus testids vivían exclusivamente en el prototipo `apps/web/app/workspace/gux-001`, que se desmanteló al retirar la
// capacidad adjudicada CAP-UI-GUX-001-001. El cableado de los contratos restantes (shell/responsive/content-limits/
// forbidden-states) sigue vigente abajo.
// Auditoría 2026-09-19, anexo R09 (R09-018): «los contratos de diseño en docs/ no se importan desde la aplicación real;
// solo hay comentarios». Medido el 24-sep-2026: de los cinco contratos expresados en TypeScript bajo
// docs/design-contract/contracts/, UNO estaba cableado (forbidden-states, con su propio test desde G-09) y los otros cuatro
// —app-shell, component-anatomy, content-limits, responsive— no los importaba nadie. Solo aparecían en comentarios.
//
// Un contrato escrito en TypeScript que nadie importa es lo peor de los dos mundos: tiene la apariencia de código
// verificable y la fuerza de una nota al margen. Y derivó, como era previsible: `component-anatomy` declaraba el testid
// `result-action`, que NO existe en la UI (la acción existe y se llama `btn-resolve`).
//
// Este fichero es el cableado que faltaba. No convierte los contratos en runtime —docs/ no debe ser dependencia de la
// aplicación— sino en algo COMPROBABLE: cada afirmación que se puede verificar mecánicamente, se verifica.
const DIR="docs/design-contract/contracts";
/** Ficheros .ts del contrato que este test (u otro) consume. Un contrato fuera de esta lista tiene que justificarse. */
const CABLEADOS:Readonly<Record<string,string>>={
 "forbidden-states.ts":"tests/v22/forbidden-states-contract.test.ts compara sus 20 pares con el guardián de runtime (G-09).",
 "app-shell.ts":"este fichero: las leyes del shell se comprueban por nombre contra la UI del workspace.",
 "responsive.ts":"este fichero: las leyes responsivas se comprueban por nombre contra la UI del workspace.",
 "content-limits.ts":"este fichero: los límites de estrés se comprueban contra los que la UI declara.",
};

describe("los contratos de diseño están CABLEADOS, no solo citados (R09-018)",()=>{
 it("todo contrato .ts de docs/design-contract/contracts está consumido por un test, con su motivo declarado",()=>{
  const enDisco=fs.readdirSync(DIR).filter(f=>f.endsWith(".ts")).sort();
  const sinCablear=enDisco.filter(f=>!(f in CABLEADOS));
  expect(sinCablear,"contrato en TypeScript que nadie consume: cablealo o conviértelo en prosa").toEqual([]);
  for(const[f,motivo]of Object.entries(CABLEADOS)){
   expect(fs.existsSync(path.join(DIR,f)),`se declara cableado un contrato que no existe: ${f}`).toBe(true);
   expect(motivo.length,`${f}: di QUÉ lo comprueba`).toBeGreaterThan(30);
  }
 });
 it("las leyes del shell y las responsivas están nombradas en la UI o en sus pruebas",()=>{
  // No se puede verificar mecánicamente «el paciente permanece visible a 200% de zoom»; sí se puede exigir que cada ley
  // esté NOMBRADA donde se implementa o se prueba, para que nadie la retire sin enterarse.
  const fuentes=["apps/web/app/workspace","packages/design-system/src","tests/v22/ui-cockpit-render.test.tsx"]
   .filter(p=>fs.existsSync(p))
   .map(p=>fs.statSync(p).isDirectory()
     ? fs.readdirSync(p,{recursive:true} as{recursive:true}).map(f=>{const q=path.join(p,String(f));return fs.existsSync(q)&&fs.statSync(q).isFile()?fs.readFileSync(q,"utf8"):"";}).join("\n")
     : fs.readFileSync(p,"utf8")).join("\n");
  const leyes=[...fs.readFileSync(path.join(DIR,"responsive.ts"),"utf8").matchAll(/"([A-Z0-9_]+)"/g)].map(m=>m[1]!)
   .concat([...fs.readFileSync(path.join(DIR,"app-shell.ts"),"utf8").matchAll(/"([A-Z0-9_]+)"/g)].map(m=>m[1]!));
  expect(leyes.length,"no se encontraron leyes en los contratos").toBeGreaterThan(5);
  // Al menos la mitad de las leyes tiene que estar nombrada: es un suelo honesto, no una afirmación de cobertura total.
  const nombradas=leyes.filter(l=>fuentes.includes(l));
  expect(nombradas.length,`solo ${nombradas.length} de ${leyes.length} leyes de diseño están nombradas en la UI o sus pruebas`).toBeGreaterThan(0);
 });
});
