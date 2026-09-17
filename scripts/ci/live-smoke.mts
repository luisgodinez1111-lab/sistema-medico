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
 "live-session-issuance-proof",             // IAM: emisión de sesión + dev verifier deshabilitado en prod
 "live-immunization-forecast-proof",        // profundidad: pronóstico de vacunación por edad
 "live-egfr-proof",                         // profundidad: función renal (CKD-EPI) + estadio ERC
 "live-renal-dosing-gate-proof",            // barrera 7: contraindicación renal por eGFR medido
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
