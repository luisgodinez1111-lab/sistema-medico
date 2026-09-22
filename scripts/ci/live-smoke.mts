// Gate de regresión en vivo (smoke) para CI — ENG-056 (integration/clinical-regression gate requerido) y
// EXEC operating model paso 7. Cierra la brecha de la auditoría 2026-09-17: las pruebas en vivo .mts eran
// la evidencia más fuerte pero NO corrían en ninguno de los 4 workflows. Este runner corre un subconjunto
// curado de alto valor (kernel + RLS + lazos de seguridad + CDS) contra la BD desechable (DATABASE_URL).
//
// Convención de exit de cada proof: 0 = PASS, 3 = SKIP (NOT_RUN, sin DATABASE_URL), otro = FAIL.
// El gate falla si CUALQUIER proof falla. Un SKIP con DATABASE_URL presente se considera FAIL (no debe saltarse).
import{spawnSync}from"node:child_process";
// Subconjunto curado: kernel/firma, identidad/longitudinal, resultados+CDS, y las barreras de medicación.
const SMOKE:readonly string[]=[
 "live-encounter-lifecycle-proof",          // kernel: state machine, RLS, concurrencia, gate de firma
 "live-patient-registry-proof",             // identidad / eje del paciente
 "live-patient-timeline-proof",             // lectura longitudinal
 "live-result-closed-loop-proof",           // closed-loop Zero-Lost-Follow-Up de resultados
 "live-lab-delta-check-proof",              // CDS temporal (delta)
 "live-news2-score-proof",                  // CDS agregado (NEWS2)
 "live-critical-vital-signing-loop-proof",  // lazo de vitales críticos ↔ firma
 "live-allergy-medication-gate-proof",      // barrera 1: alergia
 "live-duplicate-therapy-gate-proof",       // barrera 2: duplicación
 "live-drug-interaction-gate-proof",        // barrera 3: DDI
 "live-drug-condition-contraindication-gate-proof", // barrera 4: contraindicación
 "live-dose-ceiling-gate-proof",            // barrera 5: dosis máxima absoluta
 "live-pediatric-dose-gate-proof",          // barrera 6: dosis pediátrica por peso
 "live-monitoring-obligation-proof",        // generación automática de seguimiento
 "live-observability-sli-proof",            // ENG-054: SLI del commit, PHI-free
 "live-dr-recovery-proof",                  // ENG-055: recuperabilidad (replay determinista + idempotencia + auditoría)
 "live-audit-chain-verify-proof",         // auditoría S-07: la cadena de auditoría se verifica con la MISMA fórmula que la escribe
 "live-session-issuance-proof",             // IAM: emisión de sesión + dev verifier deshabilitado en prod
 "live-immunization-forecast-proof",        // profundidad: pronóstico de vacunación por edad
 "live-egfr-proof",                         // profundidad: función renal (CKD-EPI) + estadio ERC
 "live-renal-dosing-gate-proof",            // barrera 7: contraindicación renal por eGFR medido
 "live-medication-annotations-proof",       // auditoría L-04/K-05: suspender/reanudar/modificar reevalúan barreras; anotaciones no cambian el estado
 "live-metabolic-panel-proof",              // profundidad: derivaciones multi-analito (anion gap, calcio corregido)
 "live-bmi-proof",                          // profundidad: IMC + clasificación WHO
 "live-glycemic-status-proof",              // profundidad: control glucémico (HbA1c -> eAG, marco diabético)
 "live-cha2ds2vasc-proof",                  // profundidad: CHA2DS2-VASc (riesgo de ictus en FA)
 "live-fib4-proof",                         // profundidad: FIB-4 (fibrosis hepática)
 "live-clinical-intelligence-proof",        // integrativo: resumen determinista priorizado
 "live-bp-stage-proof",                     // profundidad: estadificación de presión arterial (ACC/AHA)
 "live-anticoagulation-status-proof",       // profundidad: INR terapéutico en contexto del anticoagulante
 "live-meld-proof",                         // profundidad: MELD (pronóstico de hepatopatía)
 "live-acid-base-proof",                    // profundidad: interpretación ácido-base (Winters)
 "live-curb65-proof",                       // profundidad: CURB-65 (gravedad de neumonía)
 "live-aa-gradient-proof",                  // profundidad: gradiente alveolo-arterial de O2
 "live-ai-copilot-gateway-proof",           // eje D: choke point de seguridad del copilot (sin IA)
 "live-charlson-proof",                     // profundidad: índice de comorbilidad de Charlson
 "live-consultation-snapshot-proof",        // eje E panel 1: snapshot de consulta determinista
 "live-trends-proof",                       // eje E panel 4: series longitudinales de analitos
 "live-prescription-check-proof",           // eje E panel 3: dry-run de barreras de prescripción
 "live-patient-demographics-proof",         // Paciente ampliado: CURP + contacto (registro->lista->snapshot)
 "live-patient-amend-proof",                // Paciente: corrección de datos (AMENDED) reflejada en lista + demografía
 "live-agenda-day-proof",                   // Agenda del día: citas+consultorio+tipo+estado, GET por fecha con conteos
 "live-interactions-proof",                 // Interacciones (conjunto): pares + factores, 4 niveles + mecanismo/recomendación
 "live-allergy-registry-proof",             // Registro de alergias clínica-wide: tipo derivado + estado + conteos gravedad/tipo
 "live-problem-registry-proof",             // Registro de problemas clínica-wide: categoría-UI + estado por transición + conteos
 "live-immunization-registry-proof",        // Registro de vacunas clínica-wide: estado + lote/fecha administración + cobertura
 "live-vitals-history-proof",               // Historial de signos vitales por paciente: agrupación por toma + IMC + series
 "live-care-plan-snapshot-proof",           // Plan de cuidado: snapshot compuesto (problemas + conteos + metas + métricas)
 "live-referral-context-proof",             // Interconsulta: contexto del paciente (alergias/meds/problemas/labs/vitales) + envío
 "live-follow-up-snapshot-proof",           // Seguimiento: tareas (obligaciones) + tendencia vitales + indicadores clave
 "live-claims-registry-proof",              // Facturación: registro de facturas clínica-wide + KPIs (ingresos/emitidas/pendientes)
 "live-documents-proof",                    // Documentos: lista por paciente + tipo-UI + estado + conteos por carpeta
 "live-regulatory-obligations-proof",       // Obligaciones regulatorias del consultorio: estado computado + KPIs + cumplimiento
 "live-reports-proof",                      // Reportes: tablero analítico (pacientes + ingresos pagados + diagnósticos top)
 "live-office-settings-proof",              // Configuración: ajustes del consultorio (singleton por tenant, If-Match, merge, aislamiento)
 "live-document-detail-proof",              // Documentos: repositorio (GET :id) con contenido real, adenda append-only y firma
 "live-results-registry-proof",             // Resultados: registro clínica-wide (estado-UI derivado + tipo + KPIs)
 "live-orders-registry-proof",              // Resultados › Solicitudes: registro de órdenes (tipo-UI + estado por transición)
 "live-consultation-tabs-proof",            // Consulta: pestañas por paciente (resultados/órdenes/meds/plan/docs/seguimiento)
];
const hasDb=!!process.env.DATABASE_URL;
const results:{name:string;status:"PASS"|"FAIL"|"SKIP";code:number}[]=[];
for(const name of SMOKE){
 const r=spawnSync("pnpm",["-s","exec","tsx",`scripts/v22/${name}.mts`],{encoding:"utf8",env:process.env});
 const code=r.status??1;
 // exit 3 = NOT_RUN. Solo aceptable si de verdad no hay DATABASE_URL; con DB presente, saltarse = FAIL.
 const status:"PASS"|"FAIL"|"SKIP"=code===0?"PASS":(code===3&&!hasDb?"SKIP":"FAIL");
 results.push({name,status,code});
 const tail=(r.stdout??"").trim().split("\n").slice(-1)[0]??"";
 console.log(`${status==="PASS"?"✓":status==="SKIP"?"—":"✗"} ${name} (exit ${code}) ${status==="FAIL"?tail:""}`);
 if(status==="FAIL"&&r.stderr)console.log(r.stderr.trim().split("\n").slice(-8).join("\n"));
}
const failed=results.filter(x=>x.status==="FAIL");
const passed=results.filter(x=>x.status==="PASS").length;
const skipped=results.filter(x=>x.status==="SKIP").length;
console.log(`\nSMOKE: ${passed} PASS · ${failed.length} FAIL · ${skipped} SKIP (de ${SMOKE.length})`);
if(!hasDb&&skipped===SMOKE.length){console.log("NOTA: sin DATABASE_URL, todo SKIP (no es un gate real).");process.exit(0);}
process.exit(failed.length?1:0);
