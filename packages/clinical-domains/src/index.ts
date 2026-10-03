// MEDIC OS — Dominios clínicos (bounded contexts). FUENTE ÚNICA DE VERDAD de a qué RAMA pertenece cada
// agregado, vista y grupo de rutas del sistema. El dueño pidió centralizar TODO en 3 ramas de negocio;
// aquí ese mapa es ESTRUCTURA, no decoración: la navegación lo consume y `tests/v22/branch-architecture.test.ts`
// lo verifica en CI (nada huérfano, nada en dos ramas, nada fuera del mapa). Cambiar una asignación aquí es la
// única forma de mover algo de rama, y el guard obliga a que el resto del sistema concuerde.
//
// Las 3 ramas de negocio + una franja transversal (lo que cruza las tres: identidad, facturación, ajustes,
// reportes, referencia). No es una 4ª rama clínica: es "Sistema".
export type Branch="consultas"|"expedientes"|"laboratorios-diagnosticos"|"transversal";

export const BRANCHES:readonly Branch[]=["consultas","expedientes","laboratorios-diagnosticos","transversal"] as const;

// Etiqueta visible y orden de render de cada rama en la navegación. `transversal` se muestra como "Sistema".
export const BRANCH_META:Record<Branch,{label:string;order:number}>={
 consultas:{label:"Consultas",order:1},
 expedientes:{label:"Expedientes",order:2},
 "laboratorios-diagnosticos":{label:"Laboratorios y Diagnósticos",order:3},
 transversal:{label:"Sistema",order:4},
};
export const BRANCH_LABEL:Record<Branch,string>={
 consultas:BRANCH_META.consultas.label,
 expedientes:BRANCH_META.expedientes.label,
 "laboratorios-diagnosticos":BRANCH_META["laboratorios-diagnosticos"].label,
 transversal:BRANCH_META.transversal.label,
};

// ── Agregados → rama ─────────────────────────────────────────────────────────────────────────────────────
// Clave = el `aggregateType` que cada `apps/web/lib/*-lifecycle.ts` declara (constante `AGG`). El guard exige
// que los 33 agregados del repo estén aquí y que no sobre ninguna clave.
export const AGGREGATE_BRANCH:Record<string,Branch>={
 // Consultas — el ciclo de vida del encuentro/visita.
 Encounter:"consultas",Appointment:"consultas",Referral:"consultas",Admission:"consultas",Triage:"consultas",Consent:"consultas",
 // Expedientes — el registro longitudinal del paciente (incluye signos vitales, decisión del dueño).
 Patient:"expedientes",ClinicalProblem:"expedientes",Allergy:"expedientes",Medication:"expedientes",Immunization:"expedientes",
 Antecedentes:"expedientes",AdaptiveHistory:"expedientes",CarePlan:"expedientes",ClinicalDocument:"expedientes",
 DocumentIngestion:"expedientes",VitalSign:"expedientes",
 // Laboratorios y Diagnósticos — estudios, órdenes, procedimientos con resultado y soporte a la decisión.
 DiagnosticResult:"laboratorios-diagnosticos",ClinicalOrder:"laboratorios-diagnosticos",ImagingOrder:"laboratorios-diagnosticos",
 Specimen:"laboratorios-diagnosticos",ClinicalIntelligence:"laboratorios-diagnosticos",Transfusion:"laboratorios-diagnosticos",
 Dialysis:"laboratorios-diagnosticos",Surgery:"laboratorios-diagnosticos",Wound:"laboratorios-diagnosticos",
 // Transversal (Sistema) — cruza las tres ramas. ClinicalObligation es un mecanismo de seguimiento que
 // medicamentos y resultados generan de forma transversal, por eso vive aquí junto a su vista y su ruta.
 Claim:"transversal",RegulatoryObligation:"transversal",ClinicalObligation:"transversal",OfficeSettings:"transversal",
 PhysicianProfile:"transversal",AiGateway:"transversal",Incident:"transversal",
};

// ── Vistas del workspace → rama ──────────────────────────────────────────────────────────────────────────
// Clave = el id de `view` del union de `apps/web/app/workspace/model.tsx`. La navegación (SIDE_NAV/TOOLS_NAV)
// deriva de aquí la sección de cada ítem; el guard exige igualdad exacta con el union de vistas.
export const VIEW_BRANCH:Record<string,Branch>={
 // Consultas
 consulta:"consultas",agenda:"consultas",interconsulta:"consultas",seguimiento:"consultas",
 // Expedientes — el expediente es la base COMPLETA del paciente: los módulos per-paciente (problemas, alergias, vacunas,
 // signos, plan, documentos, clinical intelligence) viven como SUBMENÚS del expediente (vista `exp`), no como vistas
 // sueltas del menú. Medicamentos permanece como catálogo/herramienta de nivel-sistema.
 pacientes:"expedientes",exp:"expedientes",medicamentos:"expedientes",
 // Laboratorios y Diagnósticos — registros clínica-wide (todos los pacientes) que sí tienen sentido transversal.
 resultados:"laboratorios-diagnosticos",ordenes:"laboratorios-diagnosticos",
 // Transversal (Sistema)
 inicio:"transversal",facturacion:"transversal",obligaciones:"transversal",reportes:"transversal",
 biblioteca:"transversal",configuracion:"transversal",
};

// ── Grupos de rutas HTTP → rama ──────────────────────────────────────────────────────────────────────────
// Clave = el primer segmento bajo `apps/web/app/api/v1/*`. El guard exige que todo grupo del repo esté aquí.
export const ROUTE_BRANCH:Record<string,Branch>={
 // Consultas
 admissions:"consultas",appointments:"consultas",consents:"consultas",encounters:"consultas",referrals:"consultas",triage:"consultas",
 // Expedientes
 allergies:"expedientes","care-plans":"expedientes",documents:"expedientes",immunizations:"expedientes",medications:"expedientes",
 patients:"expedientes",problems:"expedientes",vitals:"expedientes",
 // Laboratorios y Diagnósticos
 "dialysis-sessions":"laboratorios-diagnosticos",interactions:"laboratorios-diagnosticos",orders:"laboratorios-diagnosticos",
 results:"laboratorios-diagnosticos",specimens:"laboratorios-diagnosticos",surgeries:"laboratorios-diagnosticos",
 transfusions:"laboratorios-diagnosticos",wounds:"laboratorios-diagnosticos",
 // Transversal (Sistema)
 ai:"transversal",claims:"transversal",features:"transversal",incidents:"transversal",obligations:"transversal",
 "office-settings":"transversal","physician-profile":"transversal","regulatory-obligations":"transversal",reports:"transversal",
 sessions:"transversal",terminology:"transversal",worklist:"transversal",
};

// Helpers. Devuelven `undefined` si la clave no está mapeada — fail-closed: el que consuma decide, y el guard
// garantiza que en producción no haya claves sin mapear.
export const branchOfView=(view:string):Branch|undefined=>VIEW_BRANCH[view];
export const branchOfAggregate=(aggregateType:string):Branch|undefined=>AGGREGATE_BRANCH[aggregateType];
export const branchOfRoute=(firstSegment:string):Branch|undefined=>ROUTE_BRANCH[firstSegment];
export const viewsOfBranch=(branch:Branch):string[]=>Object.keys(VIEW_BRANCH).filter(v=>VIEW_BRANCH[v]===branch);
