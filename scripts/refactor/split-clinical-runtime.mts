// Codemod de UN SOLO USO (lote 11, ADR-0300): parte apps/web/lib/clinical-runtime.ts (957 líneas, 8 responsabilidades, 84
// importadores) en módulos de persistencia cohesivos bajo apps/web/lib/runtime/ y deja clinical-runtime.ts como FACHADA con
// re-exportaciones explícitas de cada símbolo que exportaba (los importadores, las pruebas en vivo y las citas del registro
// de reconciliación siguen resolviendo). Como el de K-09 (split-workspace.mts): trabaja sobre el AST con un Program real,
// resuelve cada identificador a su declaración con el checker y copia el texto ORIGINAL de cada sentencia (con sus
// comentarios); no reformatea ni reescribe lógica. El oráculo es tests/architecture/runtime-sql-contract.test.ts.
// Se ejecuta una vez; después el fichero queda como registro del método (se niega a correr sobre la fachada).
import fs from"node:fs";import path from"node:path";
import ts from"typescript";
const ROOT=process.cwd();const LIB=path.join(ROOT,"apps/web/lib");const FILE=path.join(LIB,"clinical-runtime.ts");
const src=fs.readFileSync(FILE,"utf8");
if(src.includes("FACHADA de compatibilidad"))throw new Error("clinical-runtime.ts ya es la fachada: el codemod ya se aplicó");
// Módulo destino de cada declaración de nivel superior. Una sentencia sin destino detiene el codemod.
const PLAN:Record<string,{desc:string;names:string[]}>={
 "runtime/db.ts":{desc:"pool de PostgreSQL perezoso contra el endpoint DIRECTO y bajo el rol NOBYPASSRLS (ADR-0250)",names:["RUNTIME_ROLE","directEndpoint","_sql","getSql"]},
 "runtime/secrets.ts":{desc:"secreto HMAC de la sesión clínica (sin él la API falla cerrada)",names:["sessionSecret"]},
 "runtime/command.ts":{desc:"ejecución de comandos clínicos en el kernel atómico (límite de tasa compartido, SLI) y replay idempotente",names:["ClinicalCommandResult","runClinicalCommand","lookupReplay"]},
 "runtime/sql.ts":{desc:"fragmentos SQL compartidos por los read models",names:["lifecycleEventOnly"]},
 "runtime/pagination.ts":{desc:"paginación por cursor (keyset) y límites de página",names:["Page","encodeCursor","decodeCursor","PAGE_LIMIT_DEFAULT","PAGE_LIMIT_MAX","clampLimit"]},
 "runtime/event-store.ts":{desc:"lectura directa del event store (streams de agregado, payload por id de evento, encuentro)",names:["readEncounterEvents","readEventPayloadById","readAggregateEvents","EncounterView","readEncounter"]},
 "runtime/read-models/patient.ts":{desc:"read models de identidad del paciente (registro, demografía, existencia, duplicados)",names:["PatientRow","PatientListQuery","listPatients","PatientGuardian","PatientDemographics","patientDemographics","requireRegisteredPatient","PatientDuplicate","findPatientDuplicate","patientBirthDate"]},
 "runtime/read-models/safety-inputs.ts":{desc:"entradas de las barreras de prescripción (alergias, medicación y problemas activos)",names:["ActiveAllergy","activeAllergies","activeAllergySubstances","activeMedicationDrugCodes","activeProblemCodes"]},
 "runtime/read-models/renal.ts":{desc:"TFG del paciente a partir de su creatinina y demografía",names:["EGFR_MAX_CREATININE_AGE_DAYS","patientEgfr"]},
 "runtime/read-models/immunizations.ts":{desc:"read models de vacunación",names:["AdministeredVaccine","administeredVaccines","administeredVaccineCodes","ImmunizationRow","IMM_STATUS","immunizationRegistry"]},
 "runtime/read-models/vitals.ts":{desc:"read models de signos vitales",names:["latestVitalsByType","VitalPoint","patientVitals"]},
 "runtime/read-models/results.ts":{desc:"read models de resultados de laboratorio (última lectura, series, registro)",names:["latestResultValueForAnalyte","AnalyteReading","latestAnalyteReading","analyteSeries","ResultRow","RES_LIFECYCLE","resultsRegistry"]},
 "runtime/read-models/scheduling.ts":{desc:"agenda del consultorio",names:["AgendaAppt","agendaForDate"]},
 "runtime/read-models/registries.ts":{desc:"registros clínicos del tenant (alergias, problemas, facturación, órdenes, obligaciones regulatorias)",names:["AllergyRow","ALLERGY_STATUS","allergyRegistry","ProblemRow","PROBLEM_STATUS","problemRegistry","ClaimRow","CLAIM_STATUS","claimsRegistry","OrderRow","ORDER_STATUS","ordersRegistry","RegulatoryObligationRow","regulatoryObligations"]},
 "runtime/read-models/documents.ts":{desc:"read models de documentos clínicos",names:["DocRow","DOC_STATUS","patientDocuments","DocAddendum","DocSignature","DocAttachment","DocumentDetail","documentDetail"]},
 "runtime/read-models/settings.ts":{desc:"configuración del consultorio",names:["OfficeSettingsRead","officeSettings"]},
 "runtime/read-models/follow-up.ts":{desc:"seguimiento: plan de cuidados, obligaciones y los contadores del gate de firma (Zero-Lost-Follow-Up)",names:["CarePlanGoal","CAREPLAN_STATUS","carePlanGoals","FollowUpTask","OBLIGATION_STATUS","patientObligations","BlockingObligation","blockingObligations","countUnresolvedCriticalObligations","countOpenCriticalResults","countOpenCriticalVitals"]},
 "runtime/read-models/reports.ts":{desc:"analítica del consultorio para reportes",names:["EncounterAnalytics","encounterAnalytics","PrescribedDrugRow","medicationsPrescribed","AppointmentTypeRow","appointmentsByType","AppointmentOutcomes","appointmentOutcomes"]},
 "runtime/read-models/record.ts":{desc:"expediente: timeline del paciente, worklist del tenant y renglones del expediente",names:["TimelineItem","readPatientTimeline","PanelRowData","readTenantOpenAggregates","RecordRow","readPatientRecordRows"]},
};
const moduleOf=new Map<string,string>();for(const[m,p]of Object.entries(PLAN))for(const n of p.names)moduleOf.set(n,m);
const cfgPath=path.join(ROOT,"apps/web/tsconfig.json");const cfg=ts.parseJsonConfigFileContent(ts.readConfigFile(cfgPath,ts.sys.readFile).config,ts.sys,path.dirname(cfgPath));
const program=ts.createProgram({rootNames:[FILE],options:cfg.options});const checker=program.getTypeChecker();
const sf=program.getSourceFile(FILE)!;
const namesOf=(s:ts.Statement):string[]=>ts.isVariableStatement(s)?s.declarationList.declarations.map(d=>d.name.getText(sf)):(ts.isFunctionDeclaration(s)||ts.isTypeAliasDeclaration(s)||ts.isInterfaceDeclaration(s))&&s.name?[s.name.text]:[];
const isExported=(s:ts.Statement)=>(ts.getCombinedModifierFlags(s as unknown as ts.Declaration)&ts.ModifierFlags.Export)!==0;
const isType=(s:ts.Statement)=>ts.isTypeAliasDeclaration(s)||ts.isInterfaceDeclaration(s);
type Unit={stmt:ts.Statement;module:string;names:string[];lead:string;body:string};
const units:Unit[]=[];const imports:ts.ImportDeclaration[]=[];
for(const s of sf.statements){
 if(ts.isImportDeclaration(s)){imports.push(s);continue;}
 const names=namesOf(s);const mods=[...new Set(names.map(n=>moduleOf.get(n)))];
 if(names.length===0||mods.length!==1||!mods[0])throw new Error(`sentencia sin destino único: ${names.join(",")||s.getText(sf).slice(0,60)}`);
 units.push({stmt:s,module:mods[0],names,lead:src.slice(s.getFullStart(),s.getStart(sf)),body:src.slice(s.getStart(sf),s.getEnd())});
}
for(const n of moduleOf.keys())if(!units.some(u=>u.names.includes(n)))throw new Error(`el plan cita ${n}, que no existe`);
// El comentario del replay idempotente quedó, en el original, delante de lifecycleEventOnly: vuelve a lookupReplay.
{const leo=units.find(u=>u.names.includes("lifecycleEventOnly"))!,lr=units.find(u=>u.names.includes("lookupReplay"))!;
 const cut=leo.lead.indexOf("// Auditoría L-04/K-05");if(cut<0)throw new Error("comentario de lifecycleEventOnly inesperado");
 lr.lead=leo.lead.slice(0,cut).replace(/^\n+/,"\n")+lr.lead.replace(/^\n+/,"");leo.lead="\n"+leo.lead.slice(cut);}
// Dependencias de cada unidad: declaraciones de nivel superior de OTRO módulo, e importaciones originales.
const topOf=(d:ts.Node):ts.Statement|undefined=>{let n:ts.Node|undefined=d;while(n&&n.parent!==sf)n=n.parent;return n as ts.Statement|undefined;};
type ImportUse={spec:string;kind:"default"|"named";name:string;local:string;typeOnly:boolean};
const needs=new Map<string,{cross:Map<string,{module:string;type:boolean}>;ext:Map<string,ImportUse>}>();
for(const u of units){
 const cur=needs.get(u.module)??{cross:new Map(),ext:new Map()};needs.set(u.module,cur);
 const visit=(n:ts.Node)=>{
  if(ts.isIdentifier(n)){
   const sym=ts.isShorthandPropertyAssignment(n.parent)&&n.parent.name===n?checker.getShorthandAssignmentValueSymbol(n.parent):checker.getSymbolAtLocation(n);
   const d=sym?.declarations?.[0];
   if(d&&d.getSourceFile()===sf){
    if(ts.isImportSpecifier(d)||ts.isImportClause(d)||ts.isNamespaceImport(d)){
     const decl=ts.isImportSpecifier(d)?d.parent.parent.parent:ts.isImportClause(d)?d.parent:d.parent.parent;
     const spec=(decl.moduleSpecifier as ts.StringLiteral).text;
     const use:ImportUse=ts.isImportSpecifier(d)?{spec,kind:"named",name:(d.propertyName??d.name).text,local:d.name.text,typeOnly:d.isTypeOnly||d.parent.parent.isTypeOnly}:{spec,kind:"default",name:"default",local:(d as ts.ImportClause).name!.text,typeOnly:false};
     cur.ext.set(`${spec}#${use.local}`,use);
    }else{const top=topOf(d);
     // Solo cuenta si el identificador resuelve a la PROPIA declaración de nivel superior (no a una propiedad de un tipo).
     const isTopDecl=!!top&&((d as ts.Node)===top||(ts.isVariableDeclaration(d)&&d.parent.parent===top));
     if(top&&isTopDecl&&top!==u.stmt){const other=units.find(x=>x.stmt===top)!;if(other.module!==u.module)cur.cross.set(sym!.name,{module:other.module,type:isType(top)});}}
   }
  }
  ts.forEachChild(n,visit);};
 visit(u.stmt);
}
// Declaraciones que otro módulo necesita y no estaban exportadas: se exportan en su módulo (la fachada NO las re-exporta).
const mustExport=new Set<string>();for(const nd of needs.values())for(const n of nd.cross.keys())mustExport.add(n);
const relSpec=(fromModule:string,absTarget:string)=>{let r=path.relative(path.dirname(path.join(LIB,fromModule)),absTarget).split(path.sep).join("/");if(!r.startsWith("."))r="./"+r;return r;};
const absOfOriginal=(spec:string)=>spec.startsWith(".")?path.resolve(LIB,spec):spec;
const written:string[]=[];
for(const[module,plan]of Object.entries(PLAN)){
 const nd=needs.get(module)!;const lines:string[]=[`// Lote 11 (ADR-0300) — ${plan.desc}. Extraído de apps/web/lib/clinical-runtime.ts sin cambios de código.`];
 // importaciones externas, en el orden original de clinical-runtime.ts
 for(const im of imports){const spec=(im.moduleSpecifier as ts.StringLiteral).text;const uses=[...nd.ext.values()].filter(x=>x.spec===spec);if(!uses.length)continue;
  const target=spec.startsWith(".")?relSpec(module,absOfOriginal(spec).replace(/\.ts$/,"")):spec;
  // estilo del repo: `import x from"m"`, `import{a,type B}from"m"`, `import x,{type B}from"m"`; nombres en su orden original
  const order=(im.importClause?.namedBindings&&ts.isNamedImports(im.importClause.namedBindings))?im.importClause.namedBindings.elements.map(e=>e.name.text):[];
  const def=uses.find(x=>x.kind==="default");const named=uses.filter(x=>x.kind==="named").sort((a,b)=>order.indexOf(a.local)-order.indexOf(b.local)).map(x=>`${x.typeOnly?"type ":""}${x.name===x.local?x.name:`${x.name} as ${x.local}`}`);
  lines.push(`import${def?" "+def.local:""}${def&&named.length?",":""}${named.length?`{${named.join(",")}}`:" "}from"${target}";`);}
 // importaciones entre los nuevos módulos
 const byMod=new Map<string,{name:string;type:boolean}[]>();for(const[name,v]of nd.cross){if(!byMod.has(v.module))byMod.set(v.module,[]);byMod.get(v.module)!.push({name,type:v.type});}
 for(const[m,list]of[...byMod].sort(([a],[b])=>a.localeCompare(b)))lines.push(`import{${list.sort((a,b)=>a.name.localeCompare(b.name)).map(x=>`${x.type?"type ":""}${x.name}`).join(",")}}from"${relSpec(module,path.join(LIB,m.replace(/\.ts$/,"")))}";`);
 let body="";
 for(const u of units.filter(x=>x.module===module)){let t=u.body;if(!isExported(u.stmt)&&u.names.some(n=>mustExport.has(n)))t="export "+t;body+=u.lead.replace(/^\n+/,"\n")+t;}
 const out=lines.join("\n")+body+"\n";fs.mkdirSync(path.dirname(path.join(LIB,module)),{recursive:true});fs.writeFileSync(path.join(LIB,module),out);written.push(module);
}
// Fachada: re-exporta EXACTAMENTE lo que clinical-runtime.ts exportaba, módulo a módulo (valores y tipos por separado).
const facade=[
 "// FACHADA de compatibilidad (lote 11, ADR-0300). La persistencia de apps/web vive en apps/web/lib/runtime/: pool y rol RLS",
 "// (db), secreto de sesión (secrets), ejecución de comandos (command), event store, paginación, fragmentos SQL y read models",
 "// por dominio (runtime/read-models/*). Este módulo re-exporta los mismos símbolos que exportaba antes de la partición para",
 "// que sus importadores, las pruebas en vivo y las citas del registro de reconciliación sigan resolviendo. Código nuevo:",
 "// importar del módulo concreto.",
];
for(const[module]of Object.entries(PLAN)){
 const us=units.filter(u=>u.module===module&&isExported(u.stmt));const vals=us.filter(u=>!isType(u.stmt)).flatMap(u=>u.names),types=us.filter(u=>isType(u.stmt)).flatMap(u=>u.names);
 const spec="./"+module.replace(/\.ts$/,"");
 if(vals.length)facade.push(`export{${vals.join(",")}}from"${spec}";`);
 if(types.length)facade.push(`export type{${types.join(",")}}from"${spec}";`);
}
fs.writeFileSync(FILE,facade.join("\n")+"\n");
console.log(`clinical-runtime.ts -> fachada; ${written.length} módulos: ${written.join(", ")}; exportados de más por uso cruzado: ${[...mustExport].filter(n=>!units.find(u=>u.names.includes(n)&&isExported(u.stmt))).join(", ")||"ninguno"}`);
