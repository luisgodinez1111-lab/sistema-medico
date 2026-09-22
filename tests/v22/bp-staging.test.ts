import{describe,it,expect}from"vitest";
import{stageBloodPressure,parseBp}from"../../packages/bp-staging/src";
// EPIC BT — Estadificación ACC/AHA 2017.
describe("stageBloodPressure (ACC/AHA 2017)",()=>{
 it("118/76 -> NORMAL",()=>{expect(stageBloodPressure(118,76)!.stage).toBe("NORMAL");});
 it("124/78 -> ELEVATED (sist 120–129 y diast <80)",()=>{expect(stageBloodPressure(124,78)!.stage).toBe("ELEVATED");});
 it("124/82 -> STAGE_1 (la diastólica alta domina, no ELEVATED)",()=>{expect(stageBloodPressure(124,82)!.stage).toBe("STAGE_1");});
 it("135/85 -> STAGE_1",()=>{expect(stageBloodPressure(135,85)!.stage).toBe("STAGE_1");});
 it("145/92 -> STAGE_2",()=>{expect(stageBloodPressure(145,92)!.stage).toBe("STAGE_2");});
 it("190/95 -> CRISIS (sistólica >180)",()=>{expect(stageBloodPressure(190,95)!.stage).toBe("CRISIS");});
 it("150/125 -> CRISIS (diastólica >120 domina sobre estadio 2)",()=>{expect(stageBloodPressure(150,125)!.stage).toBe("CRISIS");});
 it("toma el estadio MÁS severo cuando S y D difieren",()=>{
  expect(stageBloodPressure(160,70)!.stage).toBe("STAGE_2"); // sistólica manda
 });
 it("valores inválidos -> undefined",()=>{expect(stageBloodPressure(0,80)).toBeUndefined();});
});
describe("parseBp",()=>{
 it("'120/80' -> {120,80}; espacios tolerados",()=>{
  expect(parseBp("120/80")).toEqual({systolic:120,diastolic:80});
  expect(parseBp(" 140 / 90 ")).toEqual({systolic:140,diastolic:90});
 });
 it("formato inválido -> undefined",()=>{expect(parseBp("alto")).toBeUndefined();expect(parseBp("120")).toBeUndefined();});
});
// Auditoría 2026-09-19 (C-07): la hipotensión NO es "presión normal".
describe("hipotensión (C-07)",()=>{
 it("65/40 -> HYPOTENSION_SEVERE con acción inmediata (antes: 'Presión normal — Reevaluar anualmente')",()=>{
  const r=stageBloodPressure(65,40)!;expect(r.stage).toBe("HYPOTENSION_SEVERE");expect(r.actionNote).toMatch(/inmediata/i);
 });
 it("85/55 -> HYPOTENSION; 95/58 -> HYPOTENSION por diastólica; 100/65 -> NORMAL",()=>{
  expect(stageBloodPressure(85,55)!.stage).toBe("HYPOTENSION");expect(stageBloodPressure(95,58)!.stage).toBe("HYPOTENSION");expect(stageBloodPressure(100,65)!.stage).toBe("NORMAL");
 });
 it("coherente con classifyVital: los mismos cortes (<90/<60 anormal, <70 crítico)",async()=>{
  const{classifyVital}=await import("../../packages/lab-reference/src");
  expect(classifyVital("BP","65/40").status).toBe("CRITICAL");expect(classifyVital("BP","85/55").status).toBe("ABNORMAL");expect(classifyVital("BP","100/65").status).toBe("NORMAL");
 });
});
