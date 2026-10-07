import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{computeCareGaps,computePanelWorklist,computePreventiveGaps,WORKLIST_AGGREGATE_TYPES}from"../../packages/care-gaps/src";
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
 // Cerrar el lazo: la re-verificación de la historia clínica basal a 6 meses como pendiente del worklist (server).
 it("historia clínica: sin capturar -> pendiente; vigente -> ninguno; sin verificar en 6 meses -> pendiente",()=>{
  const base={ageYears:40,asOf,activeProblemCodes:[],lastAt:{},overdueVaccines:0} as const;
  expect(computePreventiveGaps({...base,antecedentes:{recorded:false}}).map(x=>x.code)).toContain("HISTORY_NOT_RECORDED");
  expect(computePreventiveGaps({...base,antecedentes:{recorded:true,updatedAt:daysAgo(30)}}).some(x=>x.domain==="historia")).toBe(false);
  const due=computePreventiveGaps({...base,antecedentes:{recorded:true,updatedAt:daysAgo(200)}});
  expect(due.find(x=>x.domain==="historia")).toMatchObject({code:"HISTORY_REVERIFY_DUE",priority:"LOW"});
  // sin el dato de antecedentes no se inventa pendiente (retrocompatible)
  expect(computePreventiveGaps(base).some(x=>x.domain==="historia")).toBe(false);
 });

 // Auditoría 2026-09-19, anexo R04 (R04-008) — «paginar la LECTURA, no solo la respuesta».
 //
 // El worklist poblacional leía TODOS los agregados del consultorio con `patientId` —la historia clínica entera, sin
 // cota, con dos subconsultas correlacionadas POR FILA— y después descartaba en memoria los tipos que ninguna regla
 // mira. Y los tipos de MÁS volumen en un expediente real (medicación, problemas, alergias, encuentros, documentos,
 // órdenes) no tienen regla: se leían para tirarlos.
 it("la lista de tipos que acota la lectura se DERIVA de las reglas, no se escribe a mano",()=>{
  // Si fuera una lista paralela, la primera regla nueva no aparecería en el panel y nadie lo notaría: un pendiente
  // clínico invisible. Se comprueba que cada tipo de la lista tiene regla y que cada regla está en la lista.
  const conRegla=["DiagnosticResult","ClinicalObligation","Consent","Immunization","CarePlan","Referral","Appointment",
   "Claim","Specimen","Incident","Triage","Transfusion","Dialysis","VitalSign"];
  expect([...WORKLIST_AGGREGATE_TYPES].sort()).toEqual([...conRegla].sort());
  // Y la prueba de fuego: un tipo de la lista produce pendiente para ALGÚN estado (si no, no debería estar).
  for(const t of WORKLIST_AGGREGATE_TYPES){
   // `exactOptionalPropertyTypes`: `status` ausente y `status:undefined` no son lo mismo, así que se omite la clave.
   const critico=t==="DiagnosticResult"||t==="VitalSign";
   const algunEstado=["RECEIVED","CREATED","PRESENTED","DUE","HELD","REQUESTED","NO_SHOW","REJECTED","REPORTED","ARRIVED","REACTION","INTERRUPTED","RECORDED"]
    .some(k=>computeCareGaps([{aggregateType:t,aggregateId:"a",latestKind:k,...(critico?{status:"CRITICAL"}:{})}]).length>0);
   expect(algunEstado,`${t} está en la lista pero ninguna regla le genera pendiente`).toBe(true);
  }
  // Los tipos de MÁS volumen quedan FUERA a propósito: es lo que hace que la lectura deje de crecer con el expediente.
  for(const t of ["Medication","ClinicalProblem","Allergy","Encounter","Document","Order","Patient"])
   expect(WORKLIST_AGGREGATE_TYPES,`${t} no tiene regla: leerlo era traer la historia para tirarla`).not.toContain(t);
 });
 it("el lector del worklist acota en SQL con esa lista y declara su techo",()=>{
  const src=fs.readFileSync("apps/web/lib/runtime/records.ts","utf8");
  // Sin el filtro en SQL, el acotado se perdería y volvería la lectura sin cota.
  expect(src,"el filtro por tipo tiene que estar EN la consulta").toContain("r.aggregate_type = any(${WORKLIST_AGGREGATE_TYPES");
  expect(src,"el techo de lectura tiene que estar en la consulta").toMatch(/limit \$\{max\+1\}/);
  // Y el truncamiento se DICE: un panel que oculta pendientes sin avisar es peor que uno lento.
  expect(src).toContain("truncated");
  const ruta=fs.readFileSync("apps/web/app/api/v1/worklist/route.ts","utf8");
  expect(ruta,"la respuesta debe declarar si la lista está incompleta").toContain("truncated");
 });
 it("las obligaciones regulatorias dicen cuándo su tope muerde, porque publican un porcentaje",()=>{
  const src=fs.readFileSync("apps/web/lib/runtime/office.ts","utf8");
  expect(src,"se lee una fila de más para saber si el tope mordió").toMatch(/REGULATORY_OBLIGATIONS_MAX\)\)\+1/);
  const ruta=fs.readFileSync("apps/web/app/api/v1/regulatory-obligations/route.ts","utf8");
  // El % de cumplimiento sobre una lista parcial presentado como el del consultorio sería un número falso.
  expect(ruta).toContain("truncated");
  expect(ruta).toMatch(/lista PARCIAL/);
 });
 it("las pruebas en vivo están DENTRO del typecheck: su proyecto existe y CI lo corre",()=>{
  // El `include` del tsconfig raíz cubre packages, tests y apps pero NO `scripts/`, así que las 121 pruebas en vivo —la
  // evidencia principal de este repo— quedaban fuera de `tsc`. Un cambio de firma en un lector del runtime las rompía
  // EN SILENCIO hasta correr el humo completo, que tarda minutos. Pasó exactamente eso al acotar la lectura del
  // worklist: typecheck verde y dos proofs caídos. Sin este guardarraíl, la puerta se podría retirar sin que nadie lo note.
  const cfg=JSON.parse(fs.readFileSync("tsconfig.scripts.json","utf8").split("\n").filter(l=>!l.trim().startsWith("//")).join("\n")) as {include?:string[]};
  expect(cfg.include,"el proyecto debe cubrir los .mts de scripts/").toContain("scripts/**/*.mts");
  const pkg=JSON.parse(fs.readFileSync("package.json","utf8")) as {scripts:Record<string,string>};
  expect(pkg.scripts["typecheck:scripts"],"la puerta tiene que existir como script").toContain("tsconfig.scripts.json");
  const ci=fs.readFileSync(".github/workflows/ci.yml","utf8");
  expect(ci,"CI tiene que correr la puerta, o no es una puerta").toContain("pnpm typecheck:scripts");
 });
});
