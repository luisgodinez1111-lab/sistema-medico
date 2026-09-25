import{describe,it,expect}from"vitest";
import{budgetStatus,BUDGET_REASONS,type SafetyBudget}from"../../packages/operational-safety-budget/src";
import{assertIdentity,type VerifiedIdentity}from"../../packages/identity-boundary-v2/src";
import{FixedClinicalClock,systemClinicalClock}from"../../packages/clinical-clock/src";
// Auditoría 2026-09-19, anexo R07 (R07-06) — los paquetes pequeños que no tenían ninguna prueba.
//
// El hallazgo decía «111 de 301 paquetes (36.9 %) sin ningún test». Al medirlo el 25-sep-2026 eran **10 de 192**, y ninguno
// de los diez está en una ruta clínica que corra: siete son alcanzables solo desde ciclos de vida declarados como no
// cableados, y el resto es R6 (IA, en pausa por decisión del dueño). Aun así los tres más pequeños encierran reglas reales
// —expiración de sesión, identidad incompleta, presupuesto de seguridad— y probarlos cuesta menos que declararlos.
//
// AL PROBARLOS APARECIÓ UN DEFECTO: `budgetStatus` recibía cinco indicadores y solo evaluaba TRES. `deadLetters` y
// `reconciliationBacklog` viajaban en el argumento y no se comprobaban, así que un llamador con 50 cartas muertas recibía
// `safe:true`. El nombre del campo promete que se evalúa; eso es peor que no tenerlo.
const base:SafetyBudget={unownedCritical:0,overdueCritical:0,reconciliationBacklog:0,deadLetters:0,projectionGaps:0};

describe("presupuesto de seguridad operativa (R07-06)",()=>{
 it("con todo en cero, la operación es segura",()=>{
  const r=budgetStatus(base);
  expect(r.safe).toBe(true);
  expect(r.blockers).toEqual([]);
 });
 it("CADA uno de los cinco indicadores bloquea: ninguno viaja sin evaluarse",()=>{
  // Ésta es la invariante del defecto: dos de los cinco no se miraban.
  const casos:[keyof SafetyBudget,string][]=[
   ["unownedCritical","UNOWNED_CRITICAL"],["overdueCritical","OVERDUE_CRITICAL"],["projectionGaps","PROJECTION_GAP"],
   ["deadLetters","DEAD_LETTER"],["reconciliationBacklog","RECONCILIATION_BACKLOG"],
  ];
  for(const[campo,bloqueador]of casos){
   const r=budgetStatus({...base,[campo]:1});
   expect(r.safe,`${campo}=1 no puede ser seguro`).toBe(false);
   expect(r.blockers,`${campo} debe producir ${bloqueador}`).toContain(bloqueador);
  }
  // Y todos los campos del tipo están cubiertos: si se añade uno nuevo sin evaluarlo, este test lo caza.
  expect(casos.length,"hay un indicador en el tipo que nadie evalúa").toBe(Object.keys(base).length);
 });
 it("cada bloqueador tiene una razón escrita, no solo una sigla",()=>{
  for(const b of budgetStatus({unownedCritical:1,overdueCritical:1,reconciliationBacklog:1,deadLetters:1,projectionGaps:1}).blockers){
   expect(BUDGET_REASONS[b],`${b} sin razón declarada`).toBeTruthy();
   expect(BUDGET_REASONS[b]!.length).toBeGreaterThan(30);
  }
 });
 it("varios a la vez se reportan todos, no solo el primero",()=>{
  const r=budgetStatus({...base,deadLetters:3,overdueCritical:2});
  expect(r.blockers.length).toBe(2);
 });
});

describe("frontera de identidad verificada (R07-06)",()=>{
 const id:VerifiedIdentity={subject:"u1",issuer:"idp",audience:"medical-os",expiresAt:2000,sessionId:"s1",tenantId:"t1",roles:["PHYSICIAN"],scopes:["result:write"]};
 it("una identidad completa y vigente pasa",()=>{expect(assertIdentity(id,1000)).toBe(id);});
 it("una sesión EXPIRADA no pasa, y el límite es estricto",()=>{
  expect(()=>assertIdentity(id,2000)).toThrow(/SESSION_EXPIRED/); // el instante exacto de expiración ya no vale
  expect(()=>assertIdentity(id,2001)).toThrow(/SESSION_EXPIRED/);
  expect(assertIdentity(id,1999)).toBe(id);
 });
 it("sin sujeto, emisor o sesión la identidad está incompleta",()=>{
  for(const k of ["subject","issuer","sessionId"] as const)
   expect(()=>assertIdentity({...id,[k]:""},1000),k).toThrow(/IDENTITY_INCOMPLETE/);
 });
 it("sin tenant NO hay identidad utilizable: es el aislamiento del consultorio",()=>{
  expect(()=>assertIdentity({...id,tenantId:""},1000)).toThrow(/TENANT_REQUIRED/);
 });
});

describe("reloj clínico (R07-06)",()=>{
 it("el reloj fijo devuelve siempre el mismo instante, y una COPIA",()=>{
  const at=new Date("2026-03-03T09:00:00.000Z");
  const c=new FixedClinicalClock(at);
  expect(c.now().toISOString()).toBe(at.toISOString());
  // Que devuelva una copia importa: si devolviera la misma instancia, un llamador podría mutar el reloj de todos.
  const primero=c.now();primero.setUTCFullYear(1999);
  expect(c.now().toISOString(),"mutar el resultado no puede alterar el reloj").toBe(at.toISOString());
 });
 it("el reloj del sistema avanza",()=>{
  const a=systemClinicalClock.now().getTime();
  expect(systemClinicalClock.now().getTime()).toBeGreaterThanOrEqual(a);
 });
});
