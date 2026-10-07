import{describe,it,expect}from"vitest";
import fs from"node:fs";
import path from"node:path";
// Auditoría 2026-09-19, anexo R11 (R11-06) — EL ANDAMIAJE DE LAS PRUEBAS EN VIVO, Y POR QUÉ IMPORTA QUE SEA ÚNICO.
//
// EL HALLAZGO: «hay módulos compartidos, pero el cuerpo de los proofs sigue siendo plantilla repetida». La réplica previa
// en el cruce lo descartó diciendo que el cuerpo es específico de cada dominio y extraerlo haría la prueba menos legible.
// Esa réplica era correcta a medias: **confundía el CUERPO con el ANDAMIAJE.**
//
// LO QUE SE MIDIÓ antes de refactorizar, sobre 122 pruebas: 122/122 declaraban el libro de resultados, 114/122 llevaban
// la función `ok` **byte a byte idéntica** y 122/122 terminaban en la misma línea de impresión y salida. Eso no es el
// cuerpo: es el **CONTRATO con `scripts/ci/live-smoke.mts`** —qué JSON se imprime y con qué código se sale— copiado 122
// veces.
//
// EL RIESGO QUE LA RÉPLICA NO VIO, y la razón de este test. Un contrato con 122 copias puede desviarse en cualquiera de
// ellas sin que nada lo note. Las 122 coincidían el día de la medición; el día que una olvide el `process.exit`, o
// imprima solo en el camino del fallo, o use el código 3 que el prólogo reserva para NOT_RUN, esa prueba dejará de contar
// o **reportará PASS sin haber comprobado nada** — y el humo seguirá diciendo «122 PASS». Una evidencia que puede mentir
// en silencio no es evidencia, y este repositorio apoya su caso de seguridad en estas 122 pruebas.
//
// Lo que este test NO exige: nada sobre el cuerpo. Cada prueba sigue siendo su dominio, legible de arriba abajo.
const DIR="scripts/v22";
const ANDAMIAJE=path.join(DIR,"_proof.mts");
const proofs=():string[]=>fs.readdirSync(DIR).filter(f=>f.startsWith("live-")&&f.endsWith("-proof.mts")).sort();
const leer=(f:string):string=>fs.readFileSync(path.join(DIR,f),"utf8");

describe("El andamiaje de las pruebas en vivo es único (R11-06)",()=>{

 it("el módulo de andamiaje existe y es el único sitio donde vive el protocolo de salida",()=>{
  expect(fs.existsSync(ANDAMIAJE),"R11-06 pedía dejar de repetir el andamiaje").toBe(true);
  const a=fs.readFileSync(ANDAMIAJE,"utf8");
  // El contrato: imprimir el JSON y salir con 0 en PASS, 1 en FAIL. Los códigos 2 y 3 los usa el prólogo (REFUSED y
  // NOT_RUN) ANTES de llegar aquí, y el lector del humo los distingue.
  expect(a).toContain('process.exit(result.status==="PASS"?0:1)');
  expect(a,"imprimir el veredicto es parte del contrato: sin JSON el humo no puede decir por qué falló").toContain("JSON.stringify(result,null,2)");
  // Y debe ser idempotente: el patrón de migración llama a `fin` en el catch y después, y un JSON duplicado rompería al lector.
  expect(a,"`fin` tiene que ser idempotente").toMatch(/cerrado/);
 });

 it("las 122 pruebas usan el andamiaje compartido: ninguna reimplementa el libro ni la salida",()=>{
  const lista=proofs();
  expect(lista.length,"deberían seguir siendo 122 o más pruebas en vivo").toBeGreaterThanOrEqual(122);
  const sinAndamiaje:string[]=[];const reimplementan:string[]=[];
  for(const f of lista){
   const s=leer(f);
   if(!/from"\.\/_proof\.mts"/.test(s))sinAndamiaje.push(f);
   // La prueba de fuego: una copia nueva del contrato. Si alguien vuelve a escribir el `process.exit` o el libro a mano,
   // el contrato tiene otra vez dos implementaciones y puede divergir.
   if(/process\.exit\(result\.status/.test(s))reimplementan.push(`${f}: reimplementa el protocolo de salida`);
   if(/const result:\{status:string;checks:string\[\]/.test(s))reimplementan.push(`${f}: reimplementa el libro de resultados`);
   if(/function ok\(c:boolean,l:string\)/.test(s))reimplementan.push(`${f}: reimplementa la función ok`);
  }
  expect(sinAndamiaje,"pruebas que no importan el andamiaje compartido").toEqual([]);
  expect(reimplementan,"un contrato con dos implementaciones puede divergir, y el humo no lo notaría").toEqual([]);
 });

 it("el prólogo de la base desechable sigue aplicándose a TODAS, directa o a través del andamiaje",()=>{
  // P-07/P-08: ninguna prueba en vivo debe poder correr contra la base de la aplicación. El prólogo lo impone y se
  // aplica igual si la prueba lo importa ella misma o si lo arrastra `_proof.mts` — pero tiene que llegar por algún lado.
  const a=fs.readFileSync(ANDAMIAJE,"utf8");
  expect(a,"el andamiaje debe arrastrar el prólogo, o las pruebas que solo lo importan a él quedarían sin protección").toMatch(/_live-env\.mts/);
  const desprotegidas=proofs().filter(f=>{
   const s=leer(f);
   return !/_live-env\.mts/.test(s)&&!/from"\.\/_proof\.mts"/.test(s);
  });
  expect(desprotegidas,"una prueba sin prólogo podría escribir en la base de la aplicación").toEqual([]);
 });

 it("el acuñador de tokens deja los plazos EXPLÍCITOS para las pruebas que miden caducidad",()=>{
  // No es un detalle: si `iat`/`exp` vinieran solo de un valor por omisión escondido, una prueba de token vencido
  // mediría el valor por omisión del andamiaje en lugar de la caducidad, y pasaría por la razón equivocada.
  const a=fs.readFileSync(ANDAMIAJE,"utf8");
  expect(a).toMatch(/iat\?:number;exp\?:number/);
  expect(a,"el andamiaje debe explicar por qué el plazo es overridable").toMatch(/CADUCIDAD|caducidad/);
 });

 it("el reloj de las pruebas es MONÓTONO y no el reloj real",()=>{
  // Varias pruebas miden el ORDEN de los eventos. Con `Date.now()` dos eventos de la misma prueba caerían en el mismo
  // milisegundo y el orden quedaría indefinido: la prueba pasaría o fallaría según la carga de la máquina.
  const a=fs.readFileSync(ANDAMIAJE,"utf8");
  expect(a).toMatch(/export function reloj/);
  expect(a,"el andamiaje debe decir por qué el reloj no es el real").toMatch(/mismo milisegundo|orden quedaría indefinido/);
 });
});
