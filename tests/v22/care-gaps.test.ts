import{describe,it,expect}from"vitest";
import{computeCareGaps,computePanelWorklist,computePreventiveGaps}from"../../packages/care-gaps/src";
const A=(aggregateType:string,latestKind:string,aggregateId="x")=>({aggregateType,aggregateId,latestKind});
const PR=(patientId:string,aggregateType:string,latestKind:string,aggregateId=patientId+aggregateType)=>({patientId,aggregateType,aggregateId,latestKind});
describe("care gaps engine (EPIC AA)",()=>{
 it("vacío -> sin pendientes",()=>{expect(computeCareGaps([])).toEqual([]);});
 it("no genera pendiente para estados resueltos/terminales benignos",()=>{
  const g=computeCareGaps([A("DiagnosticResult","CLOSED"),A("ClinicalObligation","COMPLETED"),A("Consent","GRANTED"),A("Immunization","ADMINISTERED"),A("CarePlan","ACHIEVED"),A("Referral","COMPLETED"),A("Appointment","COMPLETED"),A("Claim","PAID")]);
  expect(g).toEqual([]);
 });
 it("computa un pendiente por cada regla accionable",()=>{
  const g=computeCareGaps([A("DiagnosticResult","ACTIONED"),A("ClinicalObligation","OPEN"),A("Consent","PRESENTED"),A("Immunization","DUE"),A("CarePlan","HELD"),A("Referral","REQUESTED"),A("Appointment","NO_SHOW"),A("Claim","REJECTED")]);
  expect(g).toHaveLength(8);
  expect(g.map(x=>x.code)).toContain("CRITICAL_RESULT_OPEN");
  expect(g.map(x=>x.code)).toContain("IMMUNIZATION_DUE");
 });
 it("prioriza HIGH antes que MEDIUM y LOW (orden determinista)",()=>{
  const g=computeCareGaps([A("Claim","REJECTED"),A("DiagnosticResult","ACTIONED"),A("Immunization","DUE")]);
  expect(g.map(x=>x.priority)).toEqual(["HIGH","MEDIUM","LOW"]);
  expect(g[0]!.code).toBe("CRITICAL_RESULT_OPEN");
 });
 it("una muestra rechazada es un pendiente HIGH; una resultada no genera pendiente",()=>{
  expect(computeCareGaps([A("Specimen","RESULTED")])).toEqual([]);
  const g=computeCareGaps([A("Specimen","REJECTED")]);
  expect(g).toHaveLength(1);expect(g[0]!.code).toBe("SPECIMEN_REJECTED");expect(g[0]!.priority).toBe("HIGH");
 });
 it("un incidente de seguridad abierto es HIGH; uno resuelto no genera pendiente",()=>{
  expect(computeCareGaps([A("Incident","RESOLVED")])).toEqual([]);
  for(const k of["REPORTED","REVIEW_STARTED","ESCALATED"]){
   const g=computeCareGaps([A("Incident",k)]);
   expect(g).toHaveLength(1);expect(g[0]!.code).toBe("SAFETY_INCIDENT_OPEN");expect(g[0]!.priority).toBe("HIGH");
  }
 });
 it("un triage pendiente (arribado/en curso) es HIGH; triaged o cerrado no genera pendiente",()=>{
  expect(computeCareGaps([A("Triage","TRIAGED")])).toEqual([]);
  expect(computeCareGaps([A("Triage","CLOSED")])).toEqual([]);
  for(const k of["ARRIVED","TRIAGE_STARTED"]){
   const g=computeCareGaps([A("Triage",k)]);
   expect(g).toHaveLength(1);expect(g[0]!.code).toBe("TRIAGE_PENDING");expect(g[0]!.priority).toBe("HIGH");
  }
 });
 it("una reacción transfusional es HIGH; una transfusión completada no genera pendiente",()=>{
  expect(computeCareGaps([A("Transfusion","COMPLETED")])).toEqual([]);
  const g=computeCareGaps([A("Transfusion","REACTION")]);
  expect(g).toHaveLength(1);expect(g[0]!.code).toBe("TRANSFUSION_REACTION");expect(g[0]!.priority).toBe("HIGH");
 });
 it("una diálisis interrumpida es HIGH; una completada no genera pendiente",()=>{
  expect(computeCareGaps([A("Dialysis","COMPLETED")])).toEqual([]);
  const g=computeCareGaps([A("Dialysis","INTERRUPTED")]);
  expect(g).toHaveLength(1);expect(g[0]!.code).toBe("DIALYSIS_INTERRUPTED");expect(g[0]!.priority).toBe("HIGH");
 });
 it("un signo vital CRÍTICO vigente es HIGH; normal/anormal/corregido no genera pendiente",()=>{
  const V=(latestKind:string,status:string)=>({aggregateType:"VitalSign",aggregateId:"v",latestKind,status});
  expect(computeCareGaps([V("RECORDED","NORMAL")])).toEqual([]);
  expect(computeCareGaps([V("RECORDED","ABNORMAL")])).toEqual([]);
  expect(computeCareGaps([V("ENTERED_IN_ERROR","CRITICAL")])).toEqual([]); // corregido/anulado no cuenta
  for(const k of["RECORDED","AMENDED"]){
   const g=computeCareGaps([V(k,"CRITICAL")]);
   expect(g).toHaveLength(1);expect(g[0]!.code).toBe("VITAL_CRITICAL");expect(g[0]!.priority).toBe("HIGH");
  }
 });
});
describe("panel/population worklist (EPIC AC)",()=>{
 it("vacío -> sin pendientes",()=>{expect(computePanelWorklist([])).toEqual([]);});
 it("agrega pendientes de varios pacientes y adjunta patientId",()=>{
  const w=computePanelWorklist([PR("pat-1","Immunization","DUE"),PR("pat-2","DiagnosticResult","ACTIONED"),PR("pat-1","Claim","PAID")]);
  expect(w).toHaveLength(2);
  expect(w[0]!.patientId).toBe("pat-2"); // HIGH primero
  expect(w[0]!.code).toBe("CRITICAL_RESULT_OPEN");
  expect(w[1]!.patientId).toBe("pat-1");
 });
 it("orden determinista: prioridad, luego patientId",()=>{
  const w=computePanelWorklist([PR("pat-B","Referral","REQUESTED"),PR("pat-A","Referral","REQUESTED")]);
  expect(w.map(x=>x.patientId)).toEqual(["pat-A","pat-B"]);
 });
});
// Auditoría 2026-09-19 (C-20): pendiente por resultado crítico en cualquier estado + brechas de cuidado preventivo reales.
describe("resultado crítico sin cerrar (C-20)",()=>{
 it("un crítico recién RECIBIDO (nadie lo ha visto) es pendiente HIGH; uno normal no",()=>{
  const g=computeCareGaps([{aggregateType:"DiagnosticResult",aggregateId:"r1",latestKind:"RECEIVED",status:"CRITICAL"},{aggregateType:"DiagnosticResult",aggregateId:"r2",latestKind:"RECEIVED",status:"NORMAL"}]);
  expect(g).toHaveLength(1);expect(g[0]).toMatchObject({aggregateId:"r1",code:"CRITICAL_RESULT_OPEN",priority:"HIGH"});expect(g[0]!.label).toMatch(/no revisado/);
 });
 it("verificado sin acción y accionado sin cierre siguen siendo pendientes; cerrado no",()=>{
  expect(computeCareGaps([{aggregateType:"DiagnosticResult",aggregateId:"a",latestKind:"VERIFIED",status:"CRITICAL"}])).toHaveLength(1);
  expect(computeCareGaps([{aggregateType:"DiagnosticResult",aggregateId:"b",latestKind:"ACTIONED"}])).toHaveLength(1);
  expect(computeCareGaps([{aggregateType:"DiagnosticResult",aggregateId:"c",latestKind:"CLOSED",status:"CRITICAL"}])).toHaveLength(0);
 });
});
describe("brechas de cuidado preventivo (C-20)",()=>{
 const asOf="2026-09-22T00:00:00.000Z";const daysAgo=(d:number)=>new Date(Date.parse(asOf)-d*86_400_000).toISOString();
 it("diabético sin HbA1c en 6 meses ni creatinina en un año -> brechas de diabetes",()=>{
  const g=computePreventiveGaps({ageYears:55,asOf,activeProblemCodes:["E11.9"],lastAt:{HBA1C:daysAgo(200),CREATININE:daysAgo(400),LDL:daysAgo(30),UACR:daysAgo(30)},overdueVaccines:0});
  expect(g.map(x=>x.code)).toEqual(["DM_HBA1C_DUE","DM_RENAL_DUE"]);
 });
 it("diabético al día no tiene brechas de diabetes",()=>{
  const g=computePreventiveGaps({ageYears:55,asOf,activeProblemCodes:["E11.9"],lastAt:{HBA1C:daysAgo(90),CREATININE:daysAgo(100),LDL:daysAgo(100),UACR:daysAgo(100)},overdueVaccines:0});
  expect(g).toEqual([]);
 });
 it("hipertenso sin PA en 6 meses; sano de 50 años sin PA en 2 años ni glucosa en 3 -> tamizajes",()=>{
  expect(computePreventiveGaps({ageYears:60,asOf,activeProblemCodes:["I10"],lastAt:{BP:daysAgo(200),CREATININE:daysAgo(30),GLUCOSE:daysAgo(100)},overdueVaccines:0}).map(x=>x.code)).toEqual(["HTN_BP_DUE"]);
  expect(computePreventiveGaps({ageYears:50,asOf,activeProblemCodes:[],lastAt:{},overdueVaccines:0}).map(x=>x.code).sort()).toEqual(["BP_SCREENING_DUE","DM_SCREENING_DUE"]);
 });
 it("joven sano con todo al día -> ninguna brecha; vacunas vencidas -> brecha de inmunización",()=>{
  expect(computePreventiveGaps({ageYears:25,asOf,activeProblemCodes:[],lastAt:{},overdueVaccines:0})).toEqual([]);
  expect(computePreventiveGaps({ageYears:25,asOf,activeProblemCodes:[],lastAt:{},overdueVaccines:2})[0]).toMatchObject({code:"IMMUNIZATION_OVERDUE",priority:"MEDIUM"});
 });
});
