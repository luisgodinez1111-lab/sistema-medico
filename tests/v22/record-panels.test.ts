import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{SOLO_ESTA_PANTALLA}from"../../apps/web/app/workspace/shared";
// Auditoría 2026-09-19, anexo R05a (WS1-14) — el expediente crudo y su segundo juego de estado.
//
// EL HALLAZGO estaba marcado «BAJA, pendiente de confirmar». Se confirmó, y es peor de lo que decía: VEINTIDÓS ventanas del
// expediente crudo se pintan desde un estado que solo llenan las respuestas de los POST de la sesión y que se vacía al
// cambiar de paciente. Ninguna decía nada al estar vacía —no aparecía la lista debajo del formulario—, y una ventana en
// blanco se lee como «este paciente no tiene».
//
// EL RIESGO CONCRETO, y por eso no se trata igual a las veintidós: la ventana de MEDICACIÓN permite prescribir. Abrir el
// expediente de alguien con cinco fármacos activos y prescribir el sexto se hacía a ciegas —era el único dato clínico de
// seguridad que el expediente crudo no mostraba en NINGUNA parte; alergias y problemas sí están en la cabecera—.
const EXP="apps/web/app/workspace/views/exp.tsx";
const MODELO="apps/web/app/workspace/model.tsx";
/** Estados que solo se llenan con respuestas de POST de la sesión (el «segundo juego» del hallazgo). */
const LOCALES=["meds","results","docs","orders","allergies","problems","referrals","appts","imms","vitals","plans","claims","consents","adms","specs","incs","triages","wounds","transfs","surgs","dialz","obligations"];

describe("expediente crudo: qué lista cada ventana (WS1-14)",()=>{
 const exp=()=>fs.readFileSync(EXP,"utf8");
 it("ninguna de esas ventanas se queda en blanco sin decir qué lista",()=>{
  // La invariante: si la lista está vacía, la pantalla lo dice. Antes no aparecía nada y parecía una ausencia confirmada.
  const src=exp();
  const sinNota=LOCALES.filter(v=>!new RegExp(`\\{${v}\\.length===0&&`).test(src));
  expect(sinNota,"ventana que se queda en blanco sin declarar qué lista").toEqual([]);
  expect(SOLO_ESTA_PANTALLA,"la nota debe decir dónde está el historial completo").toMatch(/historial completo/i);
 });
 it("la medicación VIGENTE del paciente se muestra donde se prescribe",()=>{
  const src=exp();
  const i=src.indexOf('anchor("Medicación")');
  expect(i,"no se encontró la ventana de Medicación").toBeGreaterThan(-1);
  const ventana=src.slice(i,i+6000);
  expect(ventana,"la ventana donde se prescribe debe leer la medicación del paciente, no solo la de la sesión").toContain("consTabs");
  expect(ventana).toMatch(/Medicación vigente del paciente/);
 });
 it("y distingue «no cargó» de «no toma nada», que autorizan conductas opuestas",()=>{
  // R05a-F08 aplicado al caso más peligroso: afirmar que no toma nada sin saberlo autoriza a prescribir.
  const src=exp();
  const i=src.indexOf("Medicación vigente del paciente");
  const frag=src.slice(i,i+1200);
  expect(frag,"debe nombrar el fallo de carga").toMatch(/no cargó|no carg/i);
  expect(frag,"y pedir que se confirme con el paciente").toMatch(/[Cc]onf[íi]rmela|confirmar/);
  expect(frag,"y el vacío confirmado debe ser distinto").toMatch(/Sin medicamentos activos/);
  // El orden importa: primero se comprueba la carga y solo después se afirma la ausencia.
  expect(frag.indexOf("consTabs===null")).toBeLessThan(frag.indexOf("Sin medicamentos activos"));
 });
 it("el expediente crudo carga de verdad esas pestañas (si no, la ventana mentiría siempre)",()=>{
  const src=fs.readFileSync(MODELO,"utf8");
  const m=/if\(\(view!=="consulta"&&view!=="exp"\)\|\|!ready\|\|!session\|\|!patientId\)\{setConsTabs\(null\);return;\}/.exec(src);
  expect(m,"el efecto de consultation-tabs debe alcanzar también al expediente crudo").not.toBeNull();
 });
 it("esos estados siguen sin poblarse por GET: la nota no es cosmética, describe lo que pasa",()=>{
  // Si algún día se cablea un GET por paciente con etiqueta y versión por agregado, este test hay que revisarlo: será la
  // señal de que la nota ya no hace falta en esa ventana. Hoy es cierta, y por eso se declara.
  const src=fs.readFileSync(MODELO,"utf8");
  const poblados=LOCALES.filter(v=>{
   const set="set"+v[0]!.toUpperCase()+v.slice(1);
   // Un GET que rellene la lista completa se vería como `setX(<algo>.body...)`; lo que hay son `setX(xs=>[...xs,…])` y `setX([])`.
   return new RegExp(`${set}\\((?:r|g|sp|tr)\\.body`).test(src);
  });
  expect(poblados,"si un estado ya se puebla por GET, su ventana no necesita la nota").toEqual([]);
 });
});
