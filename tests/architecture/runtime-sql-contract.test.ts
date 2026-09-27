import{describe,it,expect,vi,beforeAll,afterAll}from"vitest";
// Lote 11 (ADR-0300) — CONTRATO SQL de la persistencia de apps/web. Sustituye `postgres` por un falso que REGISTRA cada
// consulta (texto exacto con sus fragmentos anidados, parámetros y opciones del pool) y la compara con la instantánea
// versionada. Es el oráculo del refactor estructural de apps/web/lib/clinical-runtime.ts: mover o partir los read models
// no puede cambiar ni un carácter del SQL que llega a la base, ni el rol RLS del pool (ADR-0250), ni el mapeo fila -> DTO.
// Dos escenarios por función: la base no devuelve filas, y devuelve una fila sintética con valores deterministas.
// Cada consulta registra si corrió DENTRO de la transacción (`tx`) o directamente en el pool, y `begin` registra BEGIN /
// COMMIT / ROLLBACK: así el oráculo ve también los límites de transacción de los que depende RLS (set_config es
// transaction-local), no solo el texto del SQL.
const h=vi.hoisted(()=>{
 type Frag={readonly __frag:true;strings:readonly string[];values:readonly unknown[]};
 type Entry={text:string;params:unknown[];via:"tx"|"pool"}|{tx:"BEGIN"|"COMMIT"|"ROLLBACK";mode?:string};
 const state={queries:[] as Entry[],pool:[] as unknown[],rows:(()=>[]) as ()=>unknown[]};
 const isFrag=(v:unknown):v is Frag=>typeof v==="object"&&v!==null&&(v as Frag).__frag===true;
 const render=(f:Frag,params:unknown[]):string=>{let t="";f.strings.forEach((s,i)=>{t+=s;if(i<f.values.length){const v=f.values[i];if(isFrag(v))t+=render(v,params);else{params.push(v);t+=`$${params.length}`;}}});return t;};
 const tagFor=(via:"tx"|"pool")=>(strings:TemplateStringsArray,...values:unknown[])=>{
  const f:Frag={__frag:true,strings:[...strings],values};
  const run=()=>{const params:unknown[]=[];state.queries.push({text:render(f,params),params,via});return Promise.resolve(state.rows());};
  return Object.assign(f,{then:(a?:(v:unknown)=>unknown,b?:(e:unknown)=>unknown)=>run().then(a,b),catch:(b:(e:unknown)=>unknown)=>run().catch(b)});
 };
 const json=(v:unknown)=>({json:v});
 const tx=Object.assign(tagFor("tx"),{json});
 const begin=async(a:unknown,b?:unknown)=>{
  const fn=(typeof a==="function"?a:b) as(t:unknown)=>unknown;
  state.queries.push(typeof a==="string"?{tx:"BEGIN",mode:a}:{tx:"BEGIN"});
  try{const r=await fn(tx);state.queries.push({tx:"COMMIT"});return r;}catch(e){state.queries.push({tx:"ROLLBACK"});throw e;}
 };
 const sql=Object.assign(tagFor("pool"),{json,begin});
 return{state,sql};
});
vi.mock("postgres",()=>({default:(url:string,opts:unknown)=>{h.state.pool.push({url,opts});return h.sql;}}));

const T="00000000-0000-4000-8000-000000000001",A="00000000-0000-4000-8000-000000000002",P="00000000-0000-4000-8000-0000000000aa";
const ctx={tenantId:T,actorId:A,purpose:"TREATMENT",requestId:"req-contract",actorType:"HUMAN"} as never;
const cmd={commandId:"c-1",idempotencyKey:"k-1",aggregateId:P,aggregateType:"Allergy",expectedVersion:0,eventId:"e-1",eventType:"ALLERGY_RECORDED",payload:{kind:"RECORDED",patientId:P},outboxId:"o-1",topic:"allergy.recorded",auditId:"au-1",correlationId:"co-1",occurredAt:"2026-09-01T10:00:00.000Z"};
// Fila sintética: fechas ISO para columnas *_at / *date, "1" para contadores y versiones, un payload con kind, texto en el resto.
// `allowed`/`tokens` dejan pasar el límite de tasa compartido para que el camino completo del kernel quede en la instantánea.
const cell=(k:string):unknown=>k==="payload"?{kind:"RECORDED",patientId:P,value:"7",unit:"kg"}:k==="allowed"?true:k==="tokens"?"5":/(_at|At|date|Date|day)$/.test(k)?"2026-09-01T10:00:00.000Z":/^(n|count|total|version|sequence|signed|completed|cancelled|scheduled|checked_in|no_show|critical)$/.test(k)?"1":`v_${k}`;
const row=()=>new Proxy({},{get:(_t,k)=>typeof k==="string"?cell(k):undefined,has:()=>true,ownKeys:()=>[],getOwnPropertyDescriptor:()=>undefined});
type Runtime=typeof import("../../apps/web/lib/clinical-runtime");
const CALLS:ReadonlyArray<readonly[string,(m:Runtime)=>Promise<unknown>]>=[
 ["lookupReplay",m=>m.lookupReplay(ctx,cmd)],
 ["runClinicalCommand",m=>m.runClinicalCommand(ctx,cmd)],
 ["runClinicalCommand(transición)",m=>m.runClinicalCommand(ctx,{...cmd,expectedVersion:1})], // D4: el kernel exige el tipo del stream
 ["listPatients()",m=>m.listPatients(ctx)],
 ["listPatients(q,cursor)",m=>m.listPatients(ctx,{limit:10,q:"Ána",cursor:m.encodeCursor(["Ana","x"])})],
 ["activeAllergies",m=>m.activeAllergies(ctx,P)],
 ["activeAllergySubstances",m=>m.activeAllergySubstances(ctx,P)],
 ["activeMedicationDrugCodes",m=>m.activeMedicationDrugCodes(ctx,P)],
 ["activeMedicationDrugCodes(exclude)",m=>m.activeMedicationDrugCodes(ctx,P,"m-1")],
 ["patientDemographics",m=>m.patientDemographics(ctx,P)],
 ["requireRegisteredPatient",m=>m.requireRegisteredPatient(ctx,P)],
 ["findPatientDuplicate(curp)",m=>m.findPatientDuplicate(ctx,{curp:"HEGG560427MVZRRL04"})],
 ["findPatientDuplicate(name)",m=>m.findPatientDuplicate(ctx,{normalizedName:"ana perez",birthDate:"1990-01-01"})],
 ["findPatientDuplicate(both)",m=>m.findPatientDuplicate(ctx,{curp:"HEGG560427MVZRRL04",normalizedName:"ana perez",birthDate:"1990-01-01"})],
 ["patientBirthDate",m=>m.patientBirthDate(ctx,P)],
 ["patientEgfr",m=>m.patientEgfr(ctx,P)],
 ["administeredVaccines",m=>m.administeredVaccines(ctx,P)],
 ["administeredVaccineCodes",m=>m.administeredVaccineCodes(ctx,P)],
 ["latestVitalsByType",m=>m.latestVitalsByType(ctx,P)],
 ["latestResultValueForAnalyte",m=>m.latestResultValueForAnalyte(ctx,P,"CREATININE")],
 ["latestResultValueForAnalyte(exclude)",m=>m.latestResultValueForAnalyte(ctx,P,"CREATININE","r-1")],
 ["latestAnalyteReading",m=>m.latestAnalyteReading(ctx,P,"CREATININE")],
 ["analyteSeries",m=>m.analyteSeries(ctx,P,"HBA1C")],
 ["agendaForDate",m=>m.agendaForDate(ctx,"2026-09-01T06:00:00.000Z","2026-09-02T06:00:00.000Z")],
 ["allergyRegistry",m=>m.allergyRegistry(ctx)],
 ["problemRegistry",m=>m.problemRegistry(ctx)],
 ["immunizationRegistry",m=>m.immunizationRegistry(ctx)],
 ["patientVitals",m=>m.patientVitals(ctx,P)],
 ["patientVitals(limit)",m=>m.patientVitals(ctx,P,50)],
 ["carePlanGoals",m=>m.carePlanGoals(ctx,P)],
 ["patientObligations",m=>m.patientObligations(ctx,P)],
 ["claimsRegistry",m=>m.claimsRegistry(ctx)],
 ["patientDocuments",m=>m.patientDocuments(ctx,P)],
 ["resultsRegistry",m=>m.resultsRegistry(ctx)],
 ["ordersRegistry",m=>m.ordersRegistry(ctx)],
 ["regulatoryObligations",m=>m.regulatoryObligations(ctx)],
 ["officeSettings",m=>m.officeSettings(ctx)],
 ["encounterAnalytics",m=>m.encounterAnalytics(ctx)],
 ["medicationsPrescribed",m=>m.medicationsPrescribed(ctx)],
 ["appointmentsByType",m=>m.appointmentsByType(ctx)],
 ["appointmentOutcomes",m=>m.appointmentOutcomes(ctx)],
 ["activeProblemCodes",m=>m.activeProblemCodes(ctx,P)],
 ["readPatientTimeline()",m=>m.readPatientTimeline(ctx,P)],
 ["readPatientTimeline(cursor)",m=>m.readPatientTimeline(ctx,P,{limit:5,cursor:m.encodeCursor(["2026-09-01T10:00:00.000Z","x"])})],
 ["readTenantOpenAggregates",m=>m.readTenantOpenAggregates(ctx)],
 ["readPatientRecordRows",m=>m.readPatientRecordRows(ctx,P)],
 ["readEncounterEvents",m=>m.readEncounterEvents(ctx,P)],
 ["readEventPayloadById",m=>m.readEventPayloadById(ctx,"e-1",P)],
 ["readAggregateEvents",m=>m.readAggregateEvents(ctx,P)],
 ["readAggregateStream",m=>m.readAggregateStream(ctx,"Allergy",P)],
 ["documentDetail",m=>m.documentDetail(ctx,P)],
 ["blockingObligations",m=>m.blockingObligations(ctx,P,"2026-09-01T10:00:00.000Z")],
 ["countUnresolvedCriticalObligations",m=>m.countUnresolvedCriticalObligations(ctx,P)],
 ["countOpenCriticalResults",m=>m.countOpenCriticalResults(ctx,P)],
 ["countOpenCriticalVitals",m=>m.countOpenCriticalVitals(ctx,P)],
 ["readEncounter",m=>m.readEncounter(ctx,P)],
];
const plain=(v:unknown):unknown=>JSON.parse(JSON.stringify(v,(_k,x)=>x===undefined?"<undefined>":x));
let m:Runtime;
beforeAll(async()=>{
 vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-09-15T12:00:00.000Z"));
 vi.spyOn(console,"error").mockImplementation(()=>{});
 vi.stubEnv("DATABASE_URL","postgres://owner:secret@ep-contract-pooler.neon.tech/medical_os?sslmode=require&channel_binding=require");
 m=await import("../../apps/web/lib/clinical-runtime");
});
afterAll(()=>{vi.useRealTimers();vi.restoreAllMocks();vi.unstubAllEnvs();});
describe("contrato SQL de la persistencia de apps/web (ADR-0300, oráculo del lote 11)",()=>{
 for(const scenario of["sin filas","fila sintética"] as const){
  it(`SQL, parámetros y resultado de cada función — ${scenario}`,async()=>{
   h.state.rows=scenario==="sin filas"?()=>[]:()=>[row()];
   const out:Record<string,unknown>={};
   for(const[label,call]of CALLS){
    h.state.queries=[];
    let outcome:unknown;
    try{outcome={ok:plain(await call(m))};}catch(e){outcome={error:e instanceof Error?`${e.name}: ${e.message}`:String(e)};}
    out[label]={queries:h.state.queries.map(q=>"tx" in q?q:{via:q.via,text:q.text,params:plain(q.params)}),outcome};
   }
   expect(out).toMatchSnapshot();
  });
 }
 it("el pool se crea una sola vez, contra el endpoint DIRECTO y con el rol NOBYPASSRLS (ADR-0250)",()=>{
  expect(h.state.pool).toMatchSnapshot();
  expect(h.state.pool.length).toBe(1);
 });
});
