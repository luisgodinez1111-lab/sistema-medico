import{describe,it,expect}from"vitest";
import{foldAntecedentes,assertAntecedentesTransition}from"../../packages/antecedentes-fold/src";
import{ClinicalError}from"../../packages/runtime-errors/src";
// MATRIZ FUNDACIONAL — el fold de los antecedentes: capturar una vez (RECORDED) y enmendar (AMENDED), con el contenido
// vigente = el del último evento que lo aporta. El histórico nunca se sobrescribe (cada enmienda es un evento nuevo).
const rec={sequence:1,payload:{kind:"RECORDED",patientId:"p1",occurredAt:"2026-01-01T10:00:00.000Z",content:{noPatologicos:{tabaquismo:true,alcoholismo:false,toxicomanias:false}}}};
describe("antecedentes fold (matriz fundacional)",()=>{
 it("vacío -> no existe",()=>{expect(foldAntecedentes([]).exists).toBe(false);});
 it("recorded -> RECORDED v1 con contenido y paciente",()=>{
  const f=foldAntecedentes([rec]);
  expect(f.exists).toBe(true);expect(f.state).toBe("RECORDED");expect(f.version).toBe(1);expect(f.patientId).toBe("p1");
  expect((f.content.noPatologicos as{tabaquismo:boolean}).tabaquismo).toBe(true);
  expect(f.updatedAt).toBe("2026-01-01T10:00:00.000Z");
 });
 it("la enmienda reemplaza la matriz vigente y avanza versión/fecha, sin perder el stream",()=>{
  const amend={sequence:2,payload:{kind:"AMENDED",reason:"el paciente dejó de fumar",occurredAt:"2026-06-01T09:00:00.000Z",content:{noPatologicos:{tabaquismo:false,alcoholismo:false,toxicomanias:false}}}};
  const f=foldAntecedentes([rec,amend]);
  expect(f.state).toBe("AMENDED");expect(f.version).toBe(2);
  expect((f.content.noPatologicos as{tabaquismo:boolean}).tabaquismo).toBe(false); // vigente = última enmienda
  expect(f.updatedAt).toBe("2026-06-01T09:00:00.000Z");
  expect(f.patientId).toBe("p1"); // el paciente sigue tomándose del evento base
 });
 it("el orden del stream no importa (se pliega por sequence)",()=>{
  const amend={sequence:2,payload:{kind:"AMENDED",reason:"x",content:{noPatologicos:{tabaquismo:false,alcoholismo:true,toxicomanias:false}}}};
  const f=foldAntecedentes([amend,rec]);
  expect(f.version).toBe(2);expect((f.content.noPatologicos as{alcoholismo:boolean}).alcoholismo).toBe(true);
 });
});
describe("antecedentes transition guard",()=>{
 it("permite RECORDED->AMENDED y AMENDED->AMENDED (siempre actualizable)",()=>{
  expect(()=>assertAntecedentesTransition("RECORDED","AMENDED")).not.toThrow();
  expect(()=>assertAntecedentesTransition("AMENDED","AMENDED")).not.toThrow();
 });
 it("bloquea volver a RECORDED (no se re-captura un singleton ya existente)",()=>{
  const err=(()=>{try{assertAntecedentesTransition("AMENDED","RECORDED");}catch(e){return e;}})();
  expect(err).toBeInstanceOf(ClinicalError);expect((err as ClinicalError).code).toBe("CONFLICT");
  expect(()=>assertAntecedentesTransition("RECORDED","RECORDED")).toThrow();
 });
});
