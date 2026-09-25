import{describe,it,expect}from"vitest";
import fs from"node:fs";
import{compileCondition,ClinicalIntelligenceEngine,type DeclarativeCondition,type PatientStateSummary}from"../../packages/clinical-intelligence/src";
import{validateOutputSchema}from"../../apps/web/lib/ai-gateway-lifecycle";
import{authorize}from"../../packages/runtime-auth/src";
// Auditoría 2026-09-19, anexo R02b (R2B-002/003/006/007/014/025) — PUERTAS QUE NO PODÍAN FALLAR.
//
// El anexo encontró en este grupo el mismo patrón cuatro veces: una comprobación cuya entrada la fabricaba quien iba a ser
// comprobado, o que devolvía `true` sin mirar nada, o que se omitía por completo porque el llamador no la pedía. Todas
// «pasaban» siempre, y todas figuraban como control de seguridad en la documentación.
const CTX_BASE:PatientStateSummary={patientId:"p1",age:70,sex:"M",activeProblems:[{code:"I10",status:"ACTIVE",onset:"2020-01-01"}],
 activeMedications:[],allergies:[],recentVitals:[{type:"SBP",value:185,unit:"mmHg",timestamp:"2026-09-20T10:00:00.000Z"}],
 recentResults:[{code:"GLU",value:320,unit:"mg/dL",status:"FINAL",timestamp:"2026-09-20T10:00:00.000Z"}],openObligations:[]};
const evaluar=(c:DeclarativeCondition,state:PatientStateSummary=CTX_BASE,motivo="dolor torácico"):boolean=>{
 // Se compila y se evalúa con el mismo contexto que arma el motor, a través de un paquete de una sola regla.
 const engine=new ClinicalIntelligenceEngine([{id:"t",version:"1",specialty:"x",effectiveDate:"2026-01-01",
  reviewers:[{id:"r",role:"MD"}],sources:[],applicability:[],questions:[],
  redFlags:[{id:"rf",condition:compileCondition(c),action:"disparó",severity:"CRITICAL",evidence:[],version:"1"}],
  focusedExam:[],differentialHints:[],orderConsiderations:[],followUpRules:[],safetyNet:[]}]);
 return engine.evaluate(state,motivo).redFlags.length>0;
};

describe("R2B-007: las condiciones de un paquete de conocimiento no son texto ejecutable",()=>{
 it("EL VECTOR ADVERSARIO: una condición con código no se ejecuta, ni siquiera se puede expresar",()=>{
  // El anexo pedía exactamente esta prueba. El cuerpo de la API ya no admite cadenas, así que el intento no llega ni al
  // compilador; y si alguien forzara el tipo, `compileCondition` rechaza un campo que no está en la tabla.
  const malicioso={field:"(()=>{throw new Error('RCE-'+process.version)})()",op:"eq",value:1} as unknown as DeclarativeCondition;
  expect(()=>compileCondition(malicioso)).toThrow(/no interpretable/);
  const src=fs.readFileSync("packages/clinical-intelligence/src/index.ts","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
  expect(src,"ni `new Function` ni `eval` en el motor").not.toMatch(/new Function|\beval\(/);
  const lc=fs.readFileSync("apps/web/lib/clinical-intelligence-lifecycle.ts","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
  expect(lc,"el cuerpo de registro ya no declara condiciones como cadenas").not.toMatch(/condition:z\.string\(\)|trigger:z\.string\(\)/);
 });
 it("una condición declarativa SÍ dispara: el arreglo no consistió en romper la funcionalidad",()=>{
  expect(evaluar({field:"age",op:"gte",value:65})).toBe(true);
  expect(evaluar({field:"age",op:"gte",value:80})).toBe(false);
  expect(evaluar({field:"hasProblem",op:"eq",value:"I10"})).toBe(true);
  expect(evaluar({field:"chiefComplaint",op:"contains",value:"torácico"})).toBe(true);
 });
 it("los combinadores anidan y niegan",()=>{
  expect(evaluar({all:[{field:"age",op:"gte",value:65},{field:"hasProblem",op:"eq",value:"I10"}]})).toBe(true);
  expect(evaluar({all:[{field:"age",op:"gte",value:65},{field:"hasProblem",op:"eq",value:"E11"}]})).toBe(false);
  expect(evaluar({any:[{field:"hasProblem",op:"eq",value:"E11"},{field:"age",op:"lt",value:80}]})).toBe(true);
  expect(evaluar({not:{field:"age",op:"lt",value:65}})).toBe(true);
 });
 it("un signo vital o un resultado se comparan contra el MÁS RECIENTE, no contra cualquiera",()=>{
  // «La última sistólica > 180» no es «alguna vez tuvo > 180»: la diferencia decide si una alerta es de hoy o histórica.
  const conHistoria:PatientStateSummary={...CTX_BASE,recentVitals:[
   {type:"SBP",value:200,unit:"mmHg",timestamp:"2026-09-01T10:00:00.000Z"},
   {type:"SBP",value:120,unit:"mmHg",timestamp:"2026-09-20T10:00:00.000Z"}]};
  expect(evaluar({field:"vital",op:"gt",value:180,key:"SBP"},conHistoria),"la última es 120").toBe(false);
  expect(evaluar({field:"vital",op:"gt",value:180,key:"SBP"}),"la última del caso base es 185").toBe(true);
  expect(evaluar({field:"result",op:"gte",value:300,key:"GLU"})).toBe(true);
 });
 it("SIN MEDICIÓN NO DISPARA: la ausencia de un dato no es cumplimiento de la condición",()=>{
  const sinVitales:PatientStateSummary={...CTX_BASE,recentVitals:[],recentResults:[]};
  expect(evaluar({field:"vital",op:"gt",value:180,key:"SBP"},sinVitales)).toBe(false);
  expect(evaluar({field:"vital",op:"lt",value:90,key:"SBP"},sinVitales),"tampoco por el lado contrario").toBe(false);
  expect(evaluar({field:"result",op:"present",key:"GLU"},sinVitales)).toBe(false);
 });
 it("una condición incompleta se rechaza al compilar, no al evaluar",()=>{
  // Rechazarla al evaluar significaría registrar el paquete con la regla muerta, que es el defecto que esto corrige.
  expect(()=>compileCondition({field:"age",op:"gte"})).toThrow(/numérico/);
  expect(()=>compileCondition({field:"vital",op:"gt",value:180})).toThrow(/key/);
  expect(()=>compileCondition({field:"result",op:"gt",key:"GLU"})).toThrow(/numérico/);
 });
});

describe("R2B-003: `validateOutputSchema` validaba devolviendo `true`",()=>{
 it("un esquema DESCONOCIDO no pasa: fail-closed",()=>{
  // Es lo que impide que el arreglo reintroduzca el defecto por la puerta de atrás: un `return true` para lo que no se
  // sabe validar es el mismo no-op con más líneas.
  const v=validateOutputSchema({output:{summary:"x"}},"esquema-que-no-existe");
  expect(v.ok).toBe(false);
  expect(v.reason).toMatch(/ESQUEMA_DESCONOCIDO/);
 });
 it("valida de verdad la forma declarada",()=>{
  expect(validateOutputSchema({output:{summary:"Resumen clínico",confidence:0.9}},"clinical-summary-v1").ok).toBe(true);
  expect(validateOutputSchema({output:{summary:"   "}},"clinical-summary-v1").ok,"un resumen vacío no es un resumen").toBe(false);
  expect(validateOutputSchema({output:{summary:"x",confidence:1.4}},"clinical-summary-v1").ok,"la confianza está fuera de [0,1]").toBe(false);
  expect(validateOutputSchema({output:{fields:[{name:"glucosa",value:"120"}]}},"structured-extraction-v1").ok).toBe(true);
  expect(validateOutputSchema({output:{fields:[{valor:"120"}]}},"structured-extraction-v1").ok).toBe(false);
 });
 it("una salida que no es objeto, o sin `output`, se rechaza con su motivo",()=>{
  expect(validateOutputSchema("texto","clinical-summary-v1").reason).toMatch(/NO_ES_OBJETO/);
  expect(validateOutputSchema({},"clinical-summary-v1").reason).toMatch(/SIN_CAMPO_OUTPUT/);
 });
});

describe("R2B-002: el proveedor de IA ya no fabrica la evidencia que el gate valida",()=>{
 const src=fs.readFileSync("apps/web/lib/ai-gateway-lifecycle.ts","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
 it("no queda una llamada simulada que devuelva un recibo constante",()=>{
  expect(src,"`simulateAiCall` devolvía evidenceIds y reviewerId inventados").not.toMatch(/simulateAiCall/);
  expect(src,"ni el modelo hardcodeado que los delataba").not.toMatch(/gpt-4o/);
  expect(src,"ni los identificadores de evidencia fabricados").not.toMatch(/evidence-1|reviewer-1/);
 });
 it("sin proveedor, el gateway se NIEGA en vez de inventar una salida",()=>{
  expect(src).toMatch(/AI_PROVIDER_NOT_ACTIVATED/);
  expect(src).toMatch(/DEPENDENCY_UNAVAILABLE/);
 });
 it("R2B-008: ya no se instancia un motor determinista que nunca se usa",()=>{
  expect(src,"había DOS instancias y ninguna llamaba a `.evaluate`").not.toMatch(/new ClinicalIntelligenceEngine/);
 });
});

describe("R2B-025: el propósito de uso SE COMPRUEBA",()=>{
 const P=(purpose:string)=>({tenantId:"t1",actorId:"a1",roles:["PHYSICIAN"],scopes:["settings:write"],purpose,sessionId:"s1"});
 it("`authorize` admite un CONJUNTO de propósitos legítimos",()=>{
  // Con un solo valor admitido, la única forma de no romper el uso real era no pasar propósito —es decir, no comprobar—,
  // que es exactamente lo que hacía el hallazgo.
  expect(authorize(P("TREATMENT"),{scope:"settings:write",purpose:["TREATMENT","OPERATIONS"]})).toBe(true);
  expect(authorize(P("OPERATIONS"),{scope:"settings:write",purpose:["TREATMENT","OPERATIONS"]})).toBe(true);
 });
 it("y RECHAZA los que no están en el conjunto",()=>{
  expect(()=>authorize(P("RESEARCH"),{scope:"settings:write",purpose:["TREATMENT","OPERATIONS"]})).toThrow(/Purpose mismatch/);
  expect(()=>authorize(P("BILLING"),{scope:"settings:write",purpose:["TREATMENT","OPERATIONS"]})).toThrow(/Purpose mismatch/);
 });
 it("una lista VACÍA es un llamador mal escrito, no «todo permitido»",()=>{
  expect(()=>authorize(P("TREATMENT"),{scope:"settings:write",purpose:[]})).toThrow(/propósitos vacía/);
 });
 it("los ajustes del consultorio y el perfil profesional lo declaran",()=>{
  // Sin declararlo, `authorize` omite la comprobación entera: es el mecanismo exacto del hallazgo.
  for(const f of["apps/web/lib/office-settings-lifecycle.ts","apps/web/lib/physician-profile-lifecycle.ts"]){
   const s=fs.readFileSync(f,"utf8");
   expect(s,`${f} debe declarar los propósitos admitidos`).toMatch(/ADMIN_PURPOSES=\["TREATMENT","OPERATIONS"\]/);
   const llamadas=[...s.matchAll(/authorize\(principalFrom\([^)]*\),\{[^}]*\}/g)].map(m=>m[0]);
   expect(llamadas.length,`${f} sin llamadas a authorize`).toBeGreaterThan(0);
   for(const l of llamadas)expect(l,`${f}: una autorización sin propósito no comprueba nada`).toMatch(/purpose:/);
  }
 });
 it("NINGUNA ruta cableada autoriza sin declarar propósito",()=>{
  // El guardarraíl que impide que el hallazgo vuelva por otro archivo: se midió y aparecieron cinco llamadas más en
  // physician-profile que el anexo no citaba.
  const sinPurpose:string[]=[];
  const walk=(d:string):void=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
   const p=`${d}/${e.name}`;
   if(e.isDirectory()){if(e.name!=="node_modules")walk(p);continue;}
   if(!/\.tsx?$/.test(e.name))continue;
   const src=fs.readFileSync(p,"utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
   for(const m of src.matchAll(/authorize\(principalFrom\([^;]*?\);/gs)){
    const call=m[0];
    // La forma `authorize(principalFrom(claims),opts)` delega en un objeto `opts` declarado arriba: se comprueba ahí.
    if(/,\s*opts\s*\)/.test(call)){
     if(!/const opts[^=]*=\{[^}]*purpose:/.test(src))sinPurpose.push(p);
     continue;
    }
    if(!/purpose:/.test(call))sinPurpose.push(`${p} :: ${call.slice(0,80)}`);
   }
  }};
  walk("apps/web/lib");walk("apps/web/app/api");
  expect([...new Set(sinPurpose)],"autorización sin propósito declarado").toEqual([]);
 });
});

describe("R2B-010 y R2B-014: la ingesta documental deja de inventarse su estado",()=>{
 const src=fs.readFileSync("apps/web/lib/document-ingestion-lifecycle.ts","utf8").split("\n").filter(l=>!l.trimStart().startsWith("//")).join("\n");
 it("las versiones esperadas ya no están escritas a mano (salvo la creación, que es 0 por definición)",()=>{
  const fijas=[...src.matchAll(/expectedVersion:(\d+)/g)].map(m=>m[1]);
  expect(fijas,"solo la creación del agregado puede fijar la versión").toEqual(["0"]);
  expect(src,"el resto la toma de `If-Match`").toMatch(/requireMutationHeaders\(req\)/);
 });
 it("la metadata se LEE del agregado en vez de construirse vacía",()=>{
  expect(src,"`{tenantId:\"\",patientId:\"\"...}` era metadata vacía por código").not.toMatch(/tenantId:"",patientId:""/);
  expect(src).toMatch(/leerMetadata\(ctx,/);
  expect(src,"`readAggregateEvents` estaba importado y nunca se llamaba").toMatch(/readAggregateEvents\(ctx,documentId\)/);
 });
 it("se compara el nombre del documento contra el del paciente del expediente",()=>{
  expect(src).toMatch(/patientDemographics\(ctx,metadata\.patientId\)/);
  expect(src).toMatch(/PATIENT_NAME/);
 });
 it("R2B-015: no vuelve el bloque comentado que duplicaba la función viva",()=>{
  const crudo=fs.readFileSync("apps/web/lib/document-ingestion-lifecycle.ts","utf8");
  expect((crudo.match(/export async function handleDocumentUploadInit/g)??[]).length).toBe(1);
  expect(crudo,"no puede volver una copia comentada del handler").not.toMatch(/\/\*\s*\nexport async function handleDocument/);
 });
});
