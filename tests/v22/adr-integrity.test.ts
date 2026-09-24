import{describe,it,expect}from"vitest";
import fs from"node:fs";import path from"node:path";
// Auditoría 2026-09-19, anexo R09 — integridad del corpus de ADR (R09-001, R09-003, R09-005).
//
// Los tres hallazgos son la misma enfermedad vista de tres formas: documentos de gobierno que nadie puede evaluar.
//  · R09-001: ADR-0040 (ACEPTADO) exigía una «relational persistence baseline» y el código vive en jsonb por ADR-0240
//    (también ACEPTADO). Dos ADR aceptados en contradicción, sin sucesión registrada: quien leyera el primero creería que
//    el sistema persiste en tablas relacionales versionadas.
//  · R09-005: tres ADR de iteraciones distintas declaraban «producción bloqueada hasta X» con listas solapadas y sin decir
//    dónde se comprueba X ni quién lo levanta. Un bloqueo que nadie puede evaluar no protege: se ignora.
//  · R09-003: 22 de 32 ADR son plantillas de 3 a 6 líneas. No se inventan fechas ni autores retroactivos —eso sería
//    fabricar procedencia—, así que la exigencia completa se aplica a los ADR escritos con la convención (0230 en
//    adelante) y a los que se toquen a partir de ahora; los históricos conservan su texto y solo deben declarar su estado.
const DIR="docs/adr";
const ficheros=fs.readdirSync(DIR).filter(f=>/^ADR-\d{4}-.*\.md$/.test(f)).sort();
const leer=(f:string)=>fs.readFileSync(path.join(DIR,f),"utf8");
const numero=(f:string)=>Number(/^ADR-(\d{4})/.exec(f)![1]);
/** Un ADR «con convención» es el que se escribió ya con Contexto/Decisión/Consecuencias: 0230 en adelante. */
const CONVENCION_DESDE=230;
const ADMISION="ADR-0300-condiciones-de-admision-a-produccion.md";

describe("integridad del corpus de ADR (R09-001/003/005)",()=>{
 it("hay corpus y todo ADR declara su Status",()=>{
  expect(ficheros.length).toBeGreaterThanOrEqual(30);
  for(const f of ficheros)expect(leer(f),`${f} sin línea Status`).toMatch(/^Status:/m);
 });
 it("todo ADR escrito con la convención lleva Contexto, Decisión y Consecuencias",()=>{
  for(const f of ficheros){
   if(numero(f)<CONVENCION_DESDE)continue;
   const b=leer(f);
   for(const sec of["## Contexto","## Decisión","## Consecuencias"])
    expect(b.includes(sec),`${f}: falta la sección ${sec}`).toBe(true);
   // La fecha va en el Status y es la de la decisión, no la de hoy: un ADR fechado por su última edición miente.
   expect(b,`${f}: el Status debe llevar la fecha de la decisión`).toMatch(/^Status:[^\n]*\d{4}-\d{2}-\d{2}/m);
  }
 });
 it("ningún ADR declara un bloqueo de producción sin remitir a la lista única (R09-005)",()=>{
  // El bloqueo puede seguir vigente; lo que no puede es ser inevaluable. Quien lo declara remite a ADR-0300, donde cada
  // condición dice cómo se comprueba y quién la levanta.
  const huerfanos:string[]=[];
  for(const f of ficheros){
   if(f===ADMISION)continue;
   const b=leer(f);
   const declara=/production (is |remains )?blocked|blocked until|no production claim|producci[oó]n bloqueada|admisi[oó]n a producci[oó]n bloqueada/i.test(b);
   if(declara&&!b.includes("ADR-0300"))huerfanos.push(f);
  }
  expect(huerfanos,"ADR que bloquea producción sin remitir a ADR-0300").toEqual([]);
 });
 it("la lista única existe, separa ingeniería de decisión y no cita verificaciones inexistentes",()=>{
  const b=leer(ADMISION);
  expect(b).toMatch(/Condiciones de ingenier[ií]a/);
  expect(b).toMatch(/Condiciones de decisi[oó]n/);
  // Toda ruta de verificación citada en la lista tiene que existir: una condición «verificada» por un fichero que no está
  // es exactamente la evidencia autodeclarada que la auditoría persigue.
  const rutas=[...b.matchAll(/`((?:scripts|tests|release|docs|db)\/[A-Za-z0-9_./-]+)`/g)].map(m=>m[1]!);
  expect(rutas.length,"la lista debe citar verificaciones concretas").toBeGreaterThan(4);
  const ausentes=[...new Set(rutas)].filter(r=>!fs.existsSync(r));
  expect(ausentes,"la lista de admisión cita verificaciones que no existen").toEqual([]);
 });
 it("ADR-0040 declara que su cláusula de persistencia fue enmendada por ADR-0240 (R09-001)",()=>{
  const b=leer("ADR-0040-domain-core.md");
  expect(b,"la contradicción con ADR-0240 tiene que estar declarada en el propio ADR").toMatch(/ADR-0240/);
  expect(b).toMatch(/ENMENDADA|enmienda/i);
  // Y la enmienda no puede ser una rebaja silenciosa: dice dónde se cumple hoy lo que el ADR pedía.
  for(const donde of["aggregate_versions","audit_chain_v3","fail-closed"])
   expect(b,`la enmienda debe decir dónde se cumple «${donde}»`).toContain(donde);
 });
});

// Auditoría 2026-09-19, anexo R09 (R09-033): «un solo runbook (backup-dr.md) en todo el repo; sin runbook de incidente, sin
// rotación de secretos». Un sistema clínico sin procedimiento de incidente no es un sistema operable: es uno al que nadie
// le ha preguntado qué hacer cuando falla. Y un runbook que promete lo que no existe es peor que ninguno, así que la
// invariante incluye que cada uno DECLARE lo que no cubre.
describe("runbooks operativos (R09-033)",()=>{
 const DIR="docs/runbooks";
 const esperados=["backup-dr.md","db-migrate.md","incidente-clinico-y-de-seguridad.md","rotacion-de-secretos.md"];
 it("existen los runbooks de respaldo, migración, incidente y rotación de secretos",()=>{
  for(const f of esperados)expect(fs.existsSync(path.join(DIR,f)),`falta docs/runbooks/${f}`).toBe(true);
 });
 it("cada runbook dice explícitamente lo que NO cubre",()=>{
  // Sin esto, el lector asume cobertura donde solo hay silencio: es la «falla abierta presentada como seguridad».
  for(const f of esperados){
   const b=fs.readFileSync(path.join(DIR,f),"utf8");
   expect(b.length,`${f} es un esbozo`).toBeGreaterThan(1200);
   expect(/NO cubre|no existe|PENDIENTE DE DECISI[OÓ]N|decisi[oó]n del due[nñ]o/i.test(b),
    `${f}: un runbook tiene que declarar sus límites`).toBe(true);
  }
 });
 it("el de rotación de secretos no contiene un secreto, solo nombres de variables",()=>{
  // El runbook habla de `SESSION_SIGNING_SECRET` y `DATABASE_URL` por NOMBRE. Si alguien pega un valor, esto lo caza.
  const b=fs.readFileSync(path.join(DIR,"rotacion-de-secretos.md"),"utf8");
  expect(/postgres(ql)?:\/\/[^\s`]*:[^\s`]*@/.test(b),"hay una cadena de conexión con credenciales").toBe(false);
  expect(/(SESSION_SIGNING_SECRET|DATABASE_URL)\s*=\s*\S+/.test(b),"hay una variable con valor asignado").toBe(false);
 });
});
