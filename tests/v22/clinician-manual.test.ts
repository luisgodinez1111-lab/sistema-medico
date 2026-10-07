import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{BARRIER_STATUSES,BARRIER_REASONS,SAFETY_VERDICTS,OVERRIDABLE_BARRIERS,HARD_BARRIERS,OVERRIDE_MIN_JUSTIFICATION}from"../../packages/prescription-safety/src";
import{PRIORITY_DUE_WINDOWS}from"../../packages/obligation-domain/src";
import{BARRIER_LABEL}from"../../apps/web/app/workspace/shared";
// Auditoría 2026-09-19, anexo R09 (R09-034) — SIN MANUAL PARA EL CLÍNICO FINAL.
//
// EL HALLAZGO: «no existe ningún documento de manual o instrucciones de uso para el clínico», y la recomendación nombraba
// cuatro cosas concretas: el significado de UNKNOWN, NOT_EVALUATED, CONFLICTING y del 428 SAFETY_ACK_REQUIRED, «y qué
// hacer ante cada uno». Un sistema que distingue «se evaluó y está bien» de «no se pudo evaluar» —y toda su seguridad
// descansa en esa distinción— no puede dejar que el médico la adivine.
//
// POR QUÉ ESTE TEST EXISTE, Y NO SOLO EL DOCUMENTO. Esta misma auditoría encontró «diez afirmaciones documentales que el
// código desmiente» (R09-F03) y veinticuatro ADR que son plantillas (R09-003). Un manual escrito a mano envejecería igual:
// el sistema añadiría un aviso, nadie lo explicaría, y el médico se encontraría una palabra que el manual no reconoce —que
// es peor que no tener manual, porque invita a confiar en él. Así que el manual se mide contra el CÓDIGO:
//
//   · cada estado que el sistema puede mostrarle a un médico tiene que estar EXPLICADO en el manual;
//   · el manual no puede documentar estados que ya no existen;
//   · y los números que cita (mínimo de justificación, plazos) tienen que ser los del código, no copias.
//
// Si alguien añade un aviso nuevo y no lo explica, esta prueba falla y el cambio no entra. Es la diferencia entre un
// documento y un entregable verificado.
const MANUAL="docs/manual-clinico.md";
const crudo=():string=>fs.readFileSync(MANUAL,"utf8");
/** El manual se ajusta a 120 columnas, así que una frase puede partirse entre dos líneas: se mide el contenido, no el
 *  lugar donde cae el salto. */
const texto=():string=>crudo().replace(/\s+/g," ");

describe("Manual del clínico verificado contra el código (R09-034)",()=>{

 it("el manual existe y cubre las cuatro cosas que el hallazgo nombraba",()=>{
  expect(fs.existsSync(MANUAL),"R09-034 pedía un manual para el clínico final").toBe(true);
  const m=texto();
  for(const termino of ["UNKNOWN","NOT_EVALUATED","NOT_COVERED","SAFETY_ACK_REQUIRED"])
   expect(m,`el hallazgo nombraba ${termino} explícitamente`).toContain(termino);
  // «qué hacer ante cada uno»: el manual tiene que decir qué hacer, no solo qué significa.
  expect(m).toMatch(/Qué hacer/);
 });

 it("cada ESTADO DE BARRERA que el sistema puede mostrar está explicado",()=>{
  const m=texto();
  // Son los seis estados del tipo `BarrierStatus`. Tres de ellos —NOT_APPLICABLE, NOT_COVERED, NOT_EVALUATED— NO
  // significan «bien», y es justo la confusión que este manual existe para evitar.
  for(const s of BARRIER_STATUSES)
   expect(m,`el estado de barrera ${s} no está explicado en el manual`).toContain(s);
 });

 it("cada MOTIVO por el que una barrera queda sin evaluar está explicado",()=>{
  const m=texto();
  // Sin el motivo, «no se pudo evaluar» no es accionable: el médico no sabe si le falta el peso, el eGFR o la duración.
  for(const r of BARRIER_REASONS)
   expect(m,`el motivo ${r} no está explicado: el médico no sabría qué resolver`).toContain(r);
 });

 it("los tres veredictos de prescripción están explicados, y el manual niega que CLEAR signifique «seguro»",()=>{
  const m=texto();
  for(const v of SAFETY_VERDICTS)expect(m,`el veredicto ${v} no está explicado`).toContain(v);
  // Es la afirmación más importante del documento: este sistema nunca dice «seguro».
  expect(m,"el manual tiene que negar explícitamente que CLEAR sea «seguro»").toMatch(/CLEAR.{0,400}o significa «seguro»/);
 });

 it("las NUEVE barreras están nombradas y la tabla dice cuál se puede anular y cuál no",()=>{
  const m=texto();
  for(const[id,label]of Object.entries(BARRIER_LABEL)){
   expect(m,`la barrera ${id} no está en el manual`).toContain(id);
   expect(m,`la barrera ${id} no aparece con el nombre que el médico ve («${label}»)`).toContain(label);
  }
  // La fila de la tabla: «… (`allergy`) | Sí |» frente a «… (`order`) | **No** |». Un bloqueo anulable y uno duro exigen
  // acciones OPUESTAS —anular con justificación, o corregir la orden—, y confundirlos es el error que la tabla evita.
  for(const id of OVERRIDABLE_BARRIERS)
   expect(m,`${id} es anulable y el manual debe decirlo`).toMatch(new RegExp("`"+id+"`\\) \\| Sí \\|"));
  for(const id of HARD_BARRIERS)
   expect(m,`${id} NO es anulable y el manual debe decirlo`).toMatch(new RegExp("`"+id+"`\\) \\| \\*\\*No\\*\\* \\|"));
 });

 it("los números que el manual cita son los del CÓDIGO, no copias que puedan divergir",()=>{
  const m=texto();
  // Si alguien cambia el mínimo de justificación y el manual sigue diciendo 20, el médico recibiría un rechazo que el
  // manual no explica. Se mide contra la constante.
  expect(m,`el mínimo de justificación del código es ${OVERRIDE_MIN_JUSTIFICATION}`).toContain(`${OVERRIDE_MIN_JUSTIFICATION} caracteres`);
  // Los plazos por prioridad: el manual los cita como referencia para el médico, así que tienen que coincidir.
  expect(m).toContain(`${PRIORITY_DUE_WINDOWS.URGENT.defaultHours} h`);
  expect(m).toContain(`${PRIORITY_DUE_WINDOWS.HIGH.defaultHours} h`);
  expect(m).toContain(`${PRIORITY_DUE_WINDOWS.ROUTINE.defaultHours/24} días`);
  // Y la ausencia de techo en RUTINA es una decisión declarada: el manual la dice porque cambia lo que el médico puede pedir.
  expect(PRIORITY_DUE_WINDOWS.ROUTINE.maxHours,"si ROUTINE gana techo, el manual miente").toBeNull();
  expect(m).toMatch(/sin techo/);
 });

 it("el manual NO documenta estados que ya no existen en el código",()=>{
  const m=texto();
  // La mitad que casi nadie comprueba: un manual que explica un aviso retirado manda al médico a buscar algo que la
  // pantalla no muestra. Se recorren los términos EN MAYÚSCULAS que el manual presenta como estados del sistema y se
  // exige que cada uno exista en el código.
  const vocabulario=new Set<string>([
   ...BARRIER_STATUSES,...BARRIER_REASONS,...SAFETY_VERDICTS,
   "UNKNOWN","NORMAL","ABNORMAL","CRITICAL", // VitalStatus
   "CONTRAINDICATED","MAJOR","MODERATE","MINOR", // InteractionSeverity
   "MILD","SEVERE", // AllergySeverity
   "URGENT","HIGH","ROUTINE", // prioridades
   "OVERDUE","INVALID_DUE_DATE", // motivos de bloqueo de firma
   "SAFETY_ACK_REQUIRED","OK","BLOCK","CAUTION", // 428 y acciones de ajuste renal
   "CTAS","ESI", // vocabulario de triage que la pantalla muestra
  ]);
  // Mayúsculas que NO son estados del sistema, declaradas una por una con su razón. Se declaran en vez de relajar la
  // regla porque una regla relajada dejaría pasar justamente el estado sin documentar que esta prueba busca.
  const NO_SON_ESTADOS=new Set<string>([
   "ESE",     // énfasis del castellano: «la interacción con ESE fármaco no se evaluó»
   "URGENTE", // la palabra castellana de la prioridad URGENT, como la lee el médico en pantalla
   "TFG",     // abreviatura clínica de tasa de filtrado glomerular (el sistema muestra «eGFR» y el médico dice «TFG»)
  ]);
  const candidatos=new Set((m.match(/\b[A-Z][A-Z_]{2,}\b/g)??[]));
  const desconocidos=[...candidatos].filter(t=>!vocabulario.has(t)&&!NO_SON_ESTADOS.has(t));
  expect(desconocidos,"el manual usa términos en mayúsculas que no son vocabulario del sistema: o se explican o se quitan").toEqual([]);
 });

 it("el manual declara lo que el sistema NO hace, y no promete validación clínica que no existe",()=>{
  const m=texto();
  // R09-020 y R09-025 siguen abiertos: la aceptación humana de las capacidades y la validación clínica de los umbrales
  // son del dueño. Un manual que diera por validados esos umbrales sería exactamente la afirmación falsa que esta
  // auditoría persigue, así que se exige que lo declare.
  expect(m,"el manual debe decir que el sistema no diagnostica ni decide").toMatch(/No diagnostica, no prescribe y no decide/);
  expect(m,"el manual debe declarar que no hay IA generativa en estas comprobaciones").toMatch(/[Nn]o hay inteligencia artificial generativa/);
  expect(m,"el manual debe declarar que la validación clínica de los umbrales está pendiente").toMatch(/R09-020|R09-025/);
  expect(m,"el manual debe declarar la limitación del catálogo de interacciones").toMatch(/R05b-12/);
 });

 it("el propio manual dice que está verificado, y nombra la prueba que lo verifica",()=>{
  // Sin esto, un lector no tiene forma de saber si el documento se mantiene o se escribió una vez. Y si alguien renombra
  // esta prueba sin actualizar el manual, la referencia quedaría muerta: por eso se comprueba el nombre del fichero.
  expect(texto()).toContain("tests/v22/clinician-manual.test.ts");
  expect(fs.existsSync("tests/v22/clinician-manual.test.ts")).toBe(true);
 });
});
