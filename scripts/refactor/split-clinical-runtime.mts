// Codemod de UN SOLO USO (auditoría R01-001): parte apps/web/lib/clinical-runtime.ts (954 líneas, 93 exports que mezclan
// conexión, ejecución de comandos y 60+ read-models de todos los dominios) en módulos por dominio bajo apps/web/lib/runtime/,
// dejando `clinical-runtime.ts` como FACHADA que reexporta (así los ~100 importadores no cambian).
// Trabaja sobre el AST y conserva el texto original de cada declaración con sus comentarios: no reformatea ni reescribe lógica.
import ts from "typescript";
import fs from "node:fs";
import path from "node:path";

const ROOT = "/Users/luisgodinez/Documents/GitHub/sistema medico";
const SRC = path.join(ROOT, "apps/web/lib/clinical-runtime.ts");
const OUT_DIR = path.join(ROOT, "apps/web/lib/runtime");

// Dominio de cada declaración. Lo que no esté aquí va a `shared` (tipos y constantes auxiliares).
const MODULE_OF: Record<string, string> = {
  // conexión + transacciones + sesión/auditoría de acceso
  RUNTIME_ROLE: "connection", _sql: "connection", getSql: "connection", sessionSecret: "connection",
  POOL_EXHAUSTED: "connection", isPoolExhausted: "connection", wait: "connection", withConnectionRetry: "connection",
  withTenantTx: "connection", withTenantTxRaw: "connection", revokeCurrentSession: "connection",
  recordPhiAccess: "connection", readPatientAccessLog: "connection",
  // ejecución de comandos clínicos
  ClinicalCommandResult: "command", runClinicalCommand: "command", lookupReplay: "command",
  // paginación por cursor
  Page: "pagination", encodeCursor: "pagination", decodeCursor: "pagination",
  "PAGE_LIMIT_DEFAULT,PAGE_LIMIT_MAX": "pagination", clampLimit: "pagination",
  // identidad del paciente
  PatientRow: "patients", PatientListQuery: "patients", listPatients: "patients",
  PatientGuardian: "patients", PatientDemographics: "patients", patientDemographics: "patients",
  requireRegisteredPatient: "patients", PatientDuplicate: "patients", findPatientDuplicate: "patients",
  patientBirthDate: "patients",
  // hechos clínicos de UN paciente (los que alimentan barreras y calculadoras)
  ActiveAllergy: "patient-facts", asSeverity: "patient-facts", activeAllergies: "patient-facts",
  activeAllergySubstances: "patient-facts", activeMedicationDrugCodes: "patient-facts",
  EGFR_MAX_CREATININE_AGE_DAYS: "patient-facts", patientEgfr: "patient-facts",
  AdministeredVaccine: "patient-facts", administeredVaccines: "patient-facts", administeredVaccineCodes: "patient-facts",
  latestVitalsByType: "patient-facts", latestResultValueForAnalyte: "patient-facts",
  AnalyteReading: "patient-facts", latestAnalyteReading: "patient-facts", analyteSeries: "patient-facts",
  VitalPoint: "patient-facts", patientVitals: "patient-facts", activeProblemCodes: "patient-facts",
  CarePlanGoal: "patient-facts", CAREPLAN_STATUS: "patient-facts", carePlanGoals: "patient-facts",
  FollowUpTask: "patient-facts", OBLIGATION_STATUS: "patient-facts", patientObligations: "patient-facts",
  DocRow: "patient-facts", DOC_STATUS: "patient-facts", patientDocuments: "patient-facts",
  // registros de TODA la clínica (tableros)
  AgendaAppt: "registries", agendaForDate: "registries",
  AllergyRow: "registries", ALLERGY_STATUS: "registries", allergyRegistry: "registries",
  ProblemRow: "registries", PROBLEM_STATUS: "registries", problemRegistry: "registries",
  ImmunizationRow: "registries", IMM_STATUS: "registries", immunizationRegistry: "registries",
  ClaimRow: "registries", CLAIM_STATUS: "registries", claimsRegistry: "registries",
  ResultRow: "registries", RES_LIFECYCLE: "registries", resultsRegistry: "registries",
  OrderRow: "registries", ORDER_STATUS: "registries", ordersRegistry: "registries",
  RegulatoryObligationRow: "registries", regulatoryObligations: "registries",
  OfficeSettingsRead: "registries", officeSettings: "registries",
  // analítica agregada
  EncounterAnalytics: "analytics", encounterAnalytics: "analytics",
  PrescribedDrugRow: "analytics", medicationsPrescribed: "analytics",
  AppointmentTypeRow: "analytics", appointmentsByType: "analytics",
  AppointmentOutcomes: "analytics", appointmentOutcomes: "analytics",
  // expediente: eventos, timeline, documentos, encuentro, obligaciones bloqueantes
  lifecycleEventOnly: "records",
  TimelineItem: "records", readPatientTimeline: "records",
  PanelRowData: "records", readTenantOpenAggregates: "records",
  RecordRow: "records", readPatientRecordRows: "records",
  readEncounterEvents: "records", readEventPayloadById: "records", readAggregateEvents: "records",
  DocAddendum: "records", DocSignature: "records", DocAttachment: "records", DocumentDetail: "records",
  documentDetail: "records",
  BlockingObligation: "records", blockingObligations: "records",
  countUnresolvedCriticalObligations: "records", countOpenCriticalResults: "records", countOpenCriticalVitals: "records",
  EncounterView: "records", readEncounter: "records",
};

const CABECERA: Record<string, string> = {
  connection: `// Conexión a Postgres y transacciones con contexto de RLS. Auditoría R01-001: extraído del god-module
// \`clinical-runtime.ts\`, que mezclaba esto con 60+ read-models de todos los dominios.
//
// El rol NOBYPASSRLS se fija en el STARTUP de cada conexión (\`-c role=medical_os_runtime\`): así toda transacción —incluida
// la que abre el kernel atómico— corre bajo RLS forzada. \`withTenantTx\` es la ÚNICA forma de abrir una transacción de
// lectura: fija tenant/actor/propósito/correlación y comprueba que la sesión no esté revocada (R01-002, R01-014).`,
  command: `// Ejecución de comandos clínicos y detección de reintentos. Auditoría R01-001: extraído de \`clinical-runtime.ts\`.`,
  pagination: `// Paginación por cursor (keyset). Auditoría S-08: el cursor es opaco; un cursor ilegible se ignora y se empieza
// desde el principio (nunca 500). Auditoría R01-001: extraído de \`clinical-runtime.ts\`.`,
  patients: `// Read-models de IDENTIDAD del paciente (listado, ficha, duplicados, alta verificada).
// Auditoría R01-001: extraído del god-module \`clinical-runtime.ts\`.`,
  "patient-facts": `// Read-models de HECHOS CLÍNICOS de un paciente concreto: los que alimentan las barreras de seguridad, las
// calculadoras y el seguimiento. Auditoría R01-001: extraído del god-module \`clinical-runtime.ts\`.`,
  registries: `// Read-models de TODA la clínica (tableros por estado). No identifican un episodio concreto: son recuentos y
// listados por tenant. Auditoría R01-001: extraído del god-module \`clinical-runtime.ts\`.`,
  analytics: `// Analítica agregada del tenant (reportes). Auditoría R01-001: extraído del god-module \`clinical-runtime.ts\`.`,
  records: `// Read-models del EXPEDIENTE: eventos por agregado, línea de tiempo, documento con su contenido, encuentro y
// obligaciones que bloquean la firma. Aquí viven las lecturas que dejan constancia de acceso a PHI (R01-026).
// Auditoría R01-001: extraído del god-module \`clinical-runtime.ts\`.`,
  shared: `// Tipos y constantes auxiliares compartidos por los read-models. Auditoría R01-001.`,
};

const ORDEN = ["shared", "connection", "command", "pagination", "patients", "patient-facts", "registries", "analytics", "records"];

const src = fs.readFileSync(SRC, "utf8");
const sf = ts.createSourceFile(SRC, src, ts.ScriptTarget.ES2022, true);

type Decl = { name: string; text: string; exported: boolean; module: string; esTipo: boolean };
const imports: string[] = [];
const decls: Decl[] = [];
let cabeceraOriginal = "";

for (const st of sf.statements) {
  const full = src.slice(st.getFullStart(), st.getEnd()).replace(/^\n+/, "");
  if (ts.isImportDeclaration(st)) { imports.push(st.getText(sf)); if (!cabeceraOriginal) cabeceraOriginal = full.slice(0, full.indexOf(st.getText(sf))); continue; }
  let name = "";
  if (ts.isFunctionDeclaration(st)) name = st.name?.text ?? "";
  else if (ts.isVariableStatement(st)) name = st.declarationList.declarations.map(d => d.name.getText(sf)).join(",");
  else if (ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st)) name = st.name.text;
  const module = MODULE_OF[name] ?? "shared";
  if (!MODULE_OF[name]) console.log(`  (a shared por defecto) ${name}`);
  const esTipo = ts.isTypeAliasDeclaration(st) || ts.isInterfaceDeclaration(st);
  decls.push({ name, text: full, exported: st.getText(sf).startsWith("export"), module, esTipo });
}

// Nombres declarados en cada módulo, para saber qué debe importar cada uno de los demás.
const declaradoEn = new Map<string, string>();
for (const d of decls) for (const n of d.name.split(",")) if (n) declaradoEn.set(n, d.module);

// Un helper privado que otro módulo necesita deja de ser privado: se exporta en su origen (y así queda a la vista que es
// compartido). Auditoría R01-001: mejor un export explícito que duplicar el helper en dos dominios.
const usadoFuera = (nombre: string, moduloPropio: string): boolean =>
  ORDEN.some(m => m !== moduloPropio && decls.filter(d => d.module === m).some(d => new RegExp(`\\b${nombre}\\b`).test(d.text)));
const textoDe = (m: string): string => decls.filter(d => d.module === m).map(d => {
  if (d.exported) return d.text;
  const nombres = d.name.split(",").filter(Boolean);
  if (nombres.some(n => usadoFuera(n, m))) return d.text.replace(/^(\s*)(const|function|let|type|interface)\b/m, "$1export $2");
  return d.text;
}).join("\n");

fs.mkdirSync(OUT_DIR, { recursive: true });
const escritos: string[] = [];
for (const m of ORDEN) {
  const cuerpo = textoDe(m);
  if (cuerpo.trim() === "") continue;
  // imports externos que este módulo usa de verdad
  const importsUsados = imports.filter(imp => {
    const nombres = /import\s*(?:type\s*)?\{([^}]*)\}/.exec(imp)?.[1]?.split(",").map(x => x.split(" as ").pop()!.trim().replace(/^type\s+/, "")) ?? [];
    const defecto = /import\s+(\w+)\s*(?:,|from)/.exec(imp)?.[1];
    const todos = [...nombres, ...(defecto ? [defecto] : [])].filter(Boolean);
    return todos.some(n => new RegExp(`\\b${n.replace(/[$]/g, "\\$")}\\b`).test(cuerpo));
  }).map(imp => imp
    // Los módulos nuevos están un nivel más abajo (apps/web/lib/runtime/): "../../../packages" → "../../../../packages"
    .replace(/"((?:\.\.\/)+)packages\//g, (_m, subidas: string) => `"${subidas}../packages/`)
    // ...y los hermanos de apps/web/lib pasan a estar un nivel arriba: "./rate-limit-shared" → "../rate-limit-shared"
    .replace(/"\.\/([a-z0-9-]+)"/g, '"../$1"'));
  // imports cruzados entre módulos nuevos
  const necesita = new Map<string, string[]>();
  for (const [nombre, mod] of declaradoEn) {
    if (mod === m) continue;
    if (new RegExp(`\\b${nombre}\\b`).test(cuerpo)) {
      necesita.set(mod, [...(necesita.get(mod) ?? []), nombre]);
    }
  }
  const cruzados = [...necesita.entries()].map(([mod, nombres]) => `import{${[...new Set(nombres)].sort().join(",")}}from"./${mod}";`);
  const out = `${CABECERA[m]}\n${importsUsados.join("\n")}\n${cruzados.join("\n")}\n\n${cuerpo}\n`;
  fs.writeFileSync(path.join(OUT_DIR, `${m}.ts`), out, "utf8");
  escritos.push(m);
  console.log(`${m}.ts → ${out.split("\n").length} líneas`);
}

// Fachada: reexporta todo lo que era público, para no tocar los ~100 importadores.
const publicos = new Map<string, string[]>();
const publicosTipo = new Map<string, string[]>();
for (const d of decls) if (d.exported) for (const n of d.name.split(",")) if (n) {
  const destino = d.esTipo ? publicosTipo : publicos;
  destino.set(d.module, [...(destino.get(d.module) ?? []), n]);
}
const fachada = `// EPIC B — Runtime clínico de la capa app: FACHADA.
//
// Auditoría 2026-09-19, anexo R01 (R01-001): este fichero era un god-module de 954 líneas y 93 exports que mezclaba la
// conexión a Postgres, la ejecución de comandos y más de sesenta read-models de todos los dominios clínicos. Ahora cada
// dominio vive en \`apps/web/lib/runtime/\` y aquí solo queda la superficie pública, para que los ~100 importadores no
// tengan que cambiar y para que añadir un read-model obligue a elegir su dominio.
//
//   runtime/connection.ts     conexión, rol RLS, withTenantTx, revocación de sesión y constancia de acceso
//   runtime/command.ts        ejecución de comandos clínicos y detección de reintentos
//   runtime/pagination.ts     cursores opacos (keyset)
//   runtime/patients.ts       identidad del paciente
//   runtime/patient-facts.ts  hechos clínicos de un paciente (barreras, calculadoras, seguimiento)
//   runtime/registries.ts     tableros por estado de toda la clínica
//   runtime/analytics.ts      analítica agregada
//   runtime/records.ts        expediente: eventos, timeline, documento, encuentro, obligaciones bloqueantes
${ORDEN.filter(m => publicos.has(m)).map(m => `export{${[...new Set(publicos.get(m)!)].sort().join(",")}}from"./runtime/${m}";`).join("\n")}
${ORDEN.filter(m => publicosTipo.has(m)).map(m => `export type{${[...new Set(publicosTipo.get(m)!)].sort().join(",")}}from"./runtime/${m}";`).join("\n")}
`;
fs.writeFileSync(SRC, fachada, "utf8");
console.log(`fachada: ${fachada.split("\n").length} líneas`);
