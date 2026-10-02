import{describe,it,expect}from"vitest";
import fs from"node:fs";
// Porte D5 — los comandos DERIVADOS (obligaciones que un comando principal ya cobrado exige) no se vuelven a cobrar al límite
// de tasa, conservan la validación de esquema y el preflight de sesión revocada, y se ejecutan con UN solo ejecutor. La prueba
// física es scripts/v22/live-derived-command-reconciliation-proof.mts y live-result-followup-replay-proof.mts; esto fija la forma.
const cuerpo=(src:string,fn:string)=>{const i=src.indexOf(`function ${fn}(`);return i<0?"":src.slice(i,src.indexOf("\n}",i));};
describe("comando derivado (porte D5)",()=>{
 const cmd=fs.readFileSync("apps/web/lib/runtime/command.ts","utf8");
 it("runDerivedCommand: replay primero, esquema, y el mismo commit que el principal SIN límite de tasa",()=>{
  const d=cuerpo(cmd,"runDerivedCommand");
  expect(d).not.toBe("");
  expect(d).toContain("lookupReplay(ctx,command)");
  // Revisión del porte D5: si el hash no coincide (texto o plazo del servidor cambiado entre intentos), el derivado ya aplicado
  // se reconoce por su evento; sin esto el reintento idéntico del principal respondía 409 IDEMPOTENCY_CONFLICT.
  expect(d).toContain("derivedAlreadyApplied(ctx,command)");
  const id=cuerpo(cmd,"derivedAlreadyApplied");
  expect(id).toMatch(/id=\$\{command\.eventId\} and aggregate_id=\$\{command\.aggregateId\} and aggregate_type=\$\{command\.aggregateType\}/);
  expect(d).toContain("assertPayloadSchema(command)");
  expect(d).toContain("commitCommand(ctx,command)");
  expect(d,"el derivado no se cobra otra vez").not.toContain("sharedAllow");
 });
 it("el principal sigue cobrando el límite y ambos comparten el commit con el preflight de sesión revocada (R01-014)",()=>{
  const p=cuerpo(cmd,"runClinicalCommand");
  expect(p).toContain("sharedAllow(\"write\"");
  expect(p).toContain("commitCommand(ctx,command)");
  expect(cuerpo(cmd,"commitCommand")).toContain("assertSessionNotRevoked(tx,ctx.sessionId)");
 });
 it("toda obligación construida fuera de su propio ciclo de vida se ejecuta con runDerivedCommand",()=>{
  const conObligacion=fs.readdirSync("apps/web/lib").filter(f=>f.endsWith(".ts")&&f!=="obligation-lifecycle.ts")
   .map(f=>`apps/web/lib/${f}`).filter(f=>fs.readFileSync(f,"utf8").includes('aggregateType:"ClinicalObligation"'));
  expect(conObligacion.sort()).toEqual(["apps/web/lib/medication-lifecycle.ts","apps/web/lib/result-lifecycle.ts"]);
  for(const f of conObligacion){
   const src=fs.readFileSync(f,"utf8");
   expect(src,`${f} ejecuta sus derivados con runDerivedCommand`).toContain("await runDerivedCommand(ctx,cmd)");
   expect(src,`${f}: el par lookupReplay+runClinicalCommand del derivado volvía a cobrar el límite`).not.toMatch(/let r=await lookupReplay\(ctx,cmd\);\s*if\(!r\)r=await runClinicalCommand\(ctx,cmd\)/);
  }
 });
 it("los derivados corren también en el replay del principal",()=>{
  const res=fs.readFileSync("apps/web/lib/result-lifecycle.ts","utf8");
  expect(res).not.toMatch(/critical"\]===true&&!result\.replayed\)/);
  expect(res).toContain("criticalResultStillOpen(ctx,b.resultId)");
  expect(res).not.toContain("res.status===201");
  const med=fs.readFileSync("apps/web/lib/medication-lifecycle.ts","utf8");
  const presc=cuerpo(med,"handleMedicationPrescription");
  const dentroDelIf=presc.slice(presc.indexOf("if(!result){"),presc.indexOf("\n  }",presc.indexOf("if(!result){")));
  expect(presc).toContain("createMonitoringObligations(");
  expect(dentroDelIf,"la creación de obligaciones no puede depender de que no sea un replay").not.toContain("createMonitoringObligations(");
 });
});
