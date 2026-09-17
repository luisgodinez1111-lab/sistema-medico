# Progress Scorecard — Medical OS V2 (% real de desarrollo)

Medición honesta y reproducible del avance contra los 4 documentos maestros + el scaffold.
**Regla:** tras cada hito terminado se recalcula y se reporta **solo el número total aproximado**.

## Denominadores reales (medidos 2026-09-15)
| Fuente | Tamaño |
| --- | --- |
| PROD (producto/clínico) | 178 ítems |
| ENG (ingeniería) | 349 ítems |
| EXEC (companion de agente) | 1652 ítems |
| Catálogo del scaffold | 208 capacidades (201 C5 / 7 C4) |
| Endpoints v1 cableados / stub | 17 reales / 6 stub → 5 verticales + identidad |
| Adjudicación humana (Mapping_Adjudication) | 0 filas (todo REVIEW_REQUIRED) |

## Definición de 100%
V2 completa: construido + cableado + probado + **adjudicado (C5 humano)** + endurecido para
**uso clínico real** (compliance NOM-024, seguridad, monitoreo).

## Metodología (peso × completado)
| Eje | Peso | Completado | Aporta |
| --- | --- | --- | --- |
| A. Kernel/fundación (RLS, concurrencia, auditoría, atomicidad, DR) | 12% | ~85% | 10.2 |
| B. Identidad/Auth/Sesión + login | 8% | ~75% | 6.0 |
| C. Verticales clínicos (~28 áreas PROD): amplitud + profundidad | 35% | ~34.7% | 12.1 |
| D. AI copilot / inteligencia clínica | 18% | ~5% | 0.9 |
| E. UI/UX de producto | 10% | ~21% | 2.1 |
| F. Adjudicación de trazabilidad (C5 humano) | 8% | ~20% | 1.6 |
| G. Endurecimiento producción + compliance | 9% | ~35% | 3.2 |

## Valor de cada hito futuro (para no estimar a la ligera)
- Vertical clínico nuevo completo con evidencia en vivo: **≈ +1.2%** c/u.
- AI copilot gobernado (1 caso real con kill-switch + evidencia): **≈ +4–6%**.
- Adjudicación C5 (golden slice + verticales): **≈ +6–7%**.
- Endurecimiento producción (httpOnly, monitoreo, DR automatizado, quitar dev verifier): **≈ +5%**.
- UX real de producto (timeline, problem list, búsqueda de paciente): **≈ +6–8%**.

## Áreas PROD hechas vs pendientes (amplitud)
- **Hechas (bucle central):** encuentro, resultados/closed-loop, medicación, documentos, identidad/sesión.
- **Pendientes (ejemplos):** prescription studio, document intelligence/imagen, AI copilot,
  portal del paciente, notificaciones.

## Historial
| Fecha | Hito | Total real aprox. |
| --- | --- | --- |
| 2026-09-15 | Base tras epics A–K + reconciliación + UI (encuentro/medicación/resultados) | **~25%** |
| 2026-09-15 | UI con los 4 verticales (+documentos) + endurecimiento prod (cookie httpOnly, dev verifier opt-in, Neon serverless) | **~28%** |
| 2026-09-15 | Epic M: vertical de órdenes (6.º) + UI (cierra cadena orden→resultado) | **~29%** |
| 2026-09-15 | Epic N: timeline del paciente (1.ª lectura/proyección) + UI longitudinal | **~30%** |
| 2026-09-15 | Epic O: vertical de obligaciones (7.º) — gestión Zero Lost Follow-Up + UI | **~31%** |
| 2026-09-15 | Epic P: resumen/estado computado del paciente (dashboard) — proyección pura | **~32%** |
| 2026-09-16 | Epic Q: vertical de lista de problemas (8.º) + UI + conteo en resumen | **~33%** |
| 2026-09-16 | Epic R: vertical de alergias (9.º) + gate de seguridad de medicación + UI | **~34%** |
| 2026-09-16 | Epic S: registro longitudinal de pacientes (10.º) + UI de alta/búsqueda/selector (eje del paciente) | **~35%** |
| 2026-09-16 | Epic T: interconsultas/referencias (11.º) + UI (coordinación del cuidado con especialista) | **~36%** |
| 2026-09-16 | Epic U: agenda/citas (12.º) + UI (scheduling con check-in/no-show) | **~37%** |
| 2026-09-16 | Epic V: vacunas/inmunizaciones (13.º) + UI (cartilla + farmacovigilancia) | **~38%** |
| 2026-09-16 | Epic W: signos vitales/observaciones (14.º) + UI (append-only con enmienda) | **~39%** |
| 2026-09-16 | Epic X: plan de cuidados/metas de crónicos (15.º) + UI (ciclo pausa/reanudación) | **~40%** |
| 2026-09-16 | Epic Y: facturación/reclamaciones (16.º) + UI (ciclo de ingresos con reenvío) | **~41%** |
| 2026-09-16 | Epic Z: consentimiento informado (17.º) + UI (registro clínico-legal NOM-004) | **~42%** |
| 2026-09-16 | Epic P+: integración longitudinal — resumen/dashboard del paciente cuenta los 7 verticales S–Z (no silos) + prueba de integración en vivo | **~43%** |
| 2026-09-16 | Epic AA: motor de care gaps / worklist clínico (inteligencia por reglas, cross-vertical, NO IA) + UI + endpoint | **~44%** |
| 2026-09-16 | Epic AB: export/manifiesto del expediente con hash reproducible (interoperabilidad NOM-024, compliance) + UI | **~45%** |
| 2026-09-16 | Epic AC: worklist poblacional / panel del clínico (population health, cross-patient, NO IA) + UI + endpoint | **~46%** |
| 2026-09-16 | Epic AD: validador de evidencia de adjudicación + dossier de aceptación C5 turnkey (eje F) + gate de integridad en CI | **~47%** |
| 2026-09-16 | Epic AE: internamiento/hospitalización (18.º vertical) + UI + integración al resumen | **~48%** |
| 2026-09-16 | Epic AF: muestras/cadena de custodia de laboratorio (19.º vertical) + regla de care gaps + UI | **~49%** |
| 2026-09-16 | Epic AG: incidentes de seguridad del paciente / farmacovigilancia (20.º vertical) + regla de care gaps + UI | **~50%** |
| 2026-09-16 | Epic AH: triage / clasificación de acuidad (21.º vertical) + regla de care gaps + UI | **~51%** |
| 2026-09-16 | Epic AI: cuidado de heridas / lesiones por presión (22.º vertical, append-only) + UI | **~52%** |
| 2026-09-16 | Epic AJ: transfusión sanguínea / hemovigilancia (23.º vertical) + regla de care gaps + UI | **~53%** |
| 2026-09-16 | Epic AK: caso quirúrgico / quirófano con barrera time-out OMS (24.º vertical) + UI | ~~54%~~ (ver corrección) |
| 2026-09-16 | Epic AL: sesión de diálisis (25.º vertical) + regla de care gaps + UI | (ver corrección) |
| 2026-09-16 | **CORRECCIÓN de método:** el titular se había despegado del modelo ponderado (peso×completado). Reconciliado a la suma real de "Aporta". Los verticales son anchos pero poco profundos; el eje C tiene techo de 35%. Total ponderado real: | **~33%** |

| 2026-09-16 | Epic AM: **profundidad** — terminología CIE-10 + validación/codificación de problemas (datos codificados, no texto libre) | **~33%** |
| 2026-09-16 | Epic AN: **profundidad** — interpretación de signos vitales por rangos de referencia (CDS básico, normal/anormal/crítico) | **~34%** |
| 2026-09-16 | Epic AO: **profundidad** — vitales críticos → care gaps + panel poblacional (cierra el lazo CDS↔inteligencia) | **~34%** |
| 2026-09-16 | Epic AP: **profundidad/seguridad** — gate de alergias por clase + reactividad cruzada (catálogo de fármacos) | **~34%** |

| 2026-09-17 | **AUDITORÍA**: se corrigieron 6 defectos de la reorganización L13–L18 (incl. 3 de seguridad: vitales críticos no detectados, firma de encuentro reventando con 500, deadlock de cierre de resultado crítico). Sin cambio de %: no se agregó capacidad, se restauró lo que constaba "hecho" pero estaba roto. | **~34%** |
| 2026-09-17 | Epic AR: **profundidad** — codificación CIE-10 validada en facturación (reclamaciones). Marginal; sin cambio de %. | **~34%** |
| 2026-09-17 | Epic AS: **profundidad/seguridad** — cierra el lazo Zero-Lost-Follow-Up de vitales críticos (elimina deadlock latente #7 de la firma). Correctitud; sin cambio de %. | **~34%** |
| 2026-09-17 | Epic AT: **auditoría** — el motor de inteligencia clínica L18 estaba NO-FUNCIONAL (devolvía vacío, defecto #8); recuperado + 5 tests. Sigue SIN cablear (no cuenta end-to-end). Sin cambio de %. | **~34%** |
| 2026-09-17 | Epic AU+AV: **profundidad** — laboratorio a 28 analitos (valores de pánico) + validación de dosis/vía/frecuencia en medicación (vocabulario controlado, 400 si inválida). | **~35%** |
| 2026-09-17 | Epic AW: **profundidad/seguridad** — gate de duplicación terapéutica (misma clase) en la prescripción. Segunda barrera junto al gate de alergias. | **~35%** |
| 2026-09-17 | Epic AX: **profundidad/seguridad** — gate de interacciones farmacológicas (DDI) en la prescripción. Tercera barrera (alergias + duplicación + DDI). | **~35%** |
| 2026-09-17 | Epic AY: **profundidad/seguridad** — gate de contraindicación fármaco–condición (drug–disease) en la prescripción. Cuarta barrera; cross-vertical problema(CIE-10)↔prescripción. | **~35%** |
| 2026-09-17 | Epic AZ: **profundidad/seguridad** — validación de dosis máxima diaria (dose ceiling) en el propose. Atrapa sobredosis (mg/día vs tope del fármaco); extiende la validación estructural AV a rango seguro. | **~35%** |
| 2026-09-17 | Epic BA: **profundidad/seguridad** — obligaciones de monitoreo automáticas al prescribir (cierra EXEC-0014). Cross-vertical medicación→obligación; warfarina→INR, metformina→creatinina, IECA→potasio. Zero-Lost-Follow-Up. | **~35%** |
| 2026-09-17 | Epic BB: **profundidad/CDS temporal** — delta check longitudinal de laboratorio: la variación crítica vs el valor previo del mismo analito eleva el resultado a crítico (creatinina duplicada, Hb −2, sodio ±10). Primer CDS temporal (no por umbral). | **~35%** |
| 2026-09-17 | Epic BC: **profundidad/CDS agregado** — NEWS2 (early warning score) desde los últimos signos vitales: score de acuidad multiparamétrico con banda de riesgo, red flag y escalamiento. Tercer tipo de CDS (umbral/temporal/agregado). | **~35%** |
| 2026-09-17 | Epic BD: **profundidad/seguridad pediátrica** — ceiling de dosis por peso (mg/kg/día): en peso pediátrico (≤40 kg) valida mg/kg/día contra el máximo del fármaco. Complemento peso-normalizado del ceiling absoluto (AZ); cross-vertical vitales(peso)→medicación. | **~35%** |
| 2026-09-17 | Epic BE: **endurecimiento (eje G)** — gate de regresión en vivo en CI: un 5.º workflow levanta postgres:17 desechable, aplica migraciones+roles y corre el smoke curado de pruebas .mts (kernel + 6 barreras + CDS). Cierra la brecha #1 de la auditoría (ENG-056). **Primer avance real del eje G** (19%→24%). | **~35%** |
| 2026-09-17 | Epic BF: **endurecimiento (eje G)** — registro NOT_WIRED + guard no-orphan de los 8 handlers huérfanos L13–L18 (~2.5k líneas de código muerto). Cierra el hallazgo #10; estado terminal documentado por módulo (ley no-orphan) sin activar IA (R6). Eje G 24%→26%. | **~35%** |
| 2026-09-17 | Epic BG: **endurecimiento (eje G)** — observabilidad SLI (ENG-054): catálogo de los 8 flujos + evento SLI con allowlist dura (garantía **No-PHI-in-telemetry**), tenant hasheado, cableado al chokepoint del kernel (correlación+latencia por commit). Eje G 26%→28%. | **~35%** |
| 2026-09-17 | Epic BH: **endurecimiento (eje G)** — Backup/DR + downtime mode (ENG-055): proof de recuperabilidad en CI (replay determinista + idempotencia anti-duplicado + auditoría + RLS), runbook RPO/RTO, guard "nunca guardado en falso" (503 en downtime). Eje G 28%→31%. | **~36%** |
| 2026-09-17 | Epic BI: **endurecimiento (eje G)** — compliance-as-code NOM (ENG-044): registro de aplicabilidad (NOM-004/024/LFPDPPP + evaluables) con evidencia enlazada + brechas, threat model STRIDE, guard "no certificación sin evidencia". Crea docs/compliance y docs/threat-models. Eje G 31%→33%. | **~36%** |
| 2026-09-17 | Epic BJ: **endurecimiento (eje G)** — IAM: dev identity verifier IMPOSIBLE en producción (negación explícita + incidente de seguridad si hay flags de dev en prod). OIDC desbloquea prod. Cierra el ítem #6 (dev verifier). Eje G 33%→35%. | **~36%** |
| 2026-09-17 | Epic BK: **profundidad clínica (eje C)** — pronóstico de vacunación por edad (cartilla México): DUE/OVERDUE/UPCOMING/COMPLETE desde nacimiento + vacunas aplicadas. Razonamiento temporal por edad, cross-vertical paciente↔inmunización. | **~36%** |
| 2026-09-17 | Epic BL: **profundidad clínica (eje C)** — eGFR (CKD-EPI 2021) + estadificación ERC (KDIGO G1–G5) desde creatinina + edad/sexo. Base para ajuste renal de dosis; cross-vertical resultado↔paciente; not-computable honesto en pediatría. | **~36%** |
| 2026-09-17 | Epic BM: **profundidad/seguridad (eje C)** — contraindicación renal por eGFR MEDIDO en la prescripción (7.ª barrera): metformina/AINE con TFG<30 → SAFETY_BLOCKED. Contraparte de función medida de AY (diagnóstico); cross-vertical medicación←creatinina+demografía. | **~36%** |
| 2026-09-17 | Epic BN: **profundidad clínica (eje C)** — derivaciones de laboratorio multi-analito: anion gap (Na−Cl−HCO3, acidosis de brecha aumentada) + calcio corregido por albúmina. Calcula nuevos valores desde varios resultados, no solo clasifica uno. | **~36%** |
| 2026-09-17 | Epic BO: **profundidad clínica (eje C)** — IMC + clasificación nutricional WHO (antropometría) desde peso+talla; pediatría reporta percentil IMC-para-edad. Cross-vertical paciente↔vitales; ligado a obesidad (E66.9). | **~36%** |
| 2026-09-17 | Epic BP: **profundidad clínica (eje C)** — control glucémico: HbA1c → glucosa promedio estimada (eAG) + clasificación con marco distinto según diabetes activa (metas de tratamiento vs tamizaje ADA). Cross-vertical resultado↔problema. | **~36%** |
| 2026-09-17 | Epic BQ: **profundidad clínica (eje C)** — CHA₂DS₂-VASc: riesgo de ictus en FA → indicación de anticoagulación. Score validado que guía una decisión terapéutica; cruza lista de problemas (CIE-10) + demografía. | **~36%** |
| 2026-09-17 | Epic BR: **profundidad clínica (eje C)** — FIB-4: índice no invasivo de fibrosis hepática (hígado graso/MASLD, hepatitis) desde edad + AST + ALT + plaquetas. Tamizaje sin biopsia; cross-vertical labs↔paciente. | **~36%** |
| 2026-09-17 | Epic BS: **profundidad INTEGRATIVA (eje C)** — resumen de inteligencia clínica determinista: consolida los CDS de la sesión (NEWS2, eGFR, glucémico, CHA₂DS₂-VASc, FIB-4, IMC, vacunas, críticos) en una vista priorizada por severidad. Núcleo determinista (no IA). | **~36%** |
| 2026-09-17 | Epic BT: **profundidad clínica (eje C)** — estadificación de presión arterial (ACC/AHA 2017): Normal/Elevada/Estadio 1/Estadio 2/Crisis + nota de acción. Refina el classifyVital para la hipertensión (crónica más frecuente). | **~36%** |
| 2026-09-17 | Epic BU: **profundidad clínica (eje C)** — monitoreo terapéutico del INR (TDM): interpreta el INR en contexto del anticoagulante activo (sub/terapéutico/supra/crítico). Cierra el lazo con BA; cross-vertical resultado↔medicación. | **~36%** |
| 2026-09-17 | Epic BV: **integrativo (eje C)** — cablea la estadificación de PA (ACC/AHA) y el estado de INR/anticoagulación al resumen de inteligencia clínica (BS). Mantiene la vista unificada completa; demuestra composabilidad del agregador. | **~36%** |
| 2026-09-17 | Epic BW: **profundidad clínica (eje C)** — MELD: pronóstico de hepatopatía avanzada (bilirrubina+INR+creatinina) con bandas de mortalidad a 90 días. Complementa FIB-4 (tamizaje→pronóstico); cross-vertical multi-analito. | **~36%** |
| 2026-09-17 | Epic BX: **profundidad clínica (eje C)** — interpretación ácido-base (pH+pCO₂+HCO₃): trastorno primario + compensación esperada por fórmula de Winters (detecta trastornos mixtos). Complementa el anion gap (BN). | **~36%** |
| 2026-09-17 | Epic BY: **profundidad clínica (eje C)** — sodio corregido por glucemia (pseudohiponatremia) + osmolalidad calculada (estados hiperosmolares); amplía el panel metabólico (BN). Cross-analito Na/glucosa/BUN. | **~36%** |
| 2026-09-17 | Epic BZ: **profundidad clínica (eje C)** — CURB-65: gravedad de neumonía → decisión de ingreso (ambulatorio/observación/ingreso). Cross-vertical BUN(lab)+FR/PA(vitales)+edad(demografía). | **~36%** |
| 2026-09-17 | Epic CA: **profundidad clínica (eje C)** — gradiente alveolo-arterial de O₂ (A-a): intercambio gaseoso vs hipoventilación. Complementa el análisis ácido-base (BX); parametrizable por altitud (México). | **~36%** |

## Nota de auditoría — segunda pasada (2026-09-17): handlers sin cablear
Hallazgo **#10**: **8 handlers de la línea L13–L18 NO los importa ninguna ruta** (features inalcanzables desde
la app): adaptive-history, ai-gateway, clinical-inbox, clinical-intelligence, document-ingestion, imaging,
lab-order, prescription. Es la razón por la que sus bugs no se detectaban (nunca se ejecutan). De ellos, 3
tenían el bug de aggregateId no-uuid (reventarían con 22P02/500 al llamarse): clinical-intelligence (#8),
prescription (#12), ai-gateway (#11) — **corregidos**. Los otros 5 usan aggregateId uuid válido.
**Recomendación:** decidir por feature si se cablea (ruta + prueba en vivo) o se retira; hoy son ~2.5k líneas
de código muerto que inflan la sensación de avance sin aportar valor end-to-end. La adjudicación de L13–L18
debería marcarlas `NOT_WIRED` hasta activarlas.
**ABORDADO (Epic BF, 2026-09-17):** registro machine-checkable `docs/adjudication/not-wired-registry.json`
+ guard `tests/v22/not-wired-integrity.test.ts` (corre en CI). Cada huérfano tiene estado terminal NOT_WIRED
+ clasificación (2 verticales sin construir, 2 duplicados de verticales cableados, 4 IA/R6-adyacentes). El
guard falla si aparece un huérfano no declarado o si un declarado se cablea sin removerlo. Commit `d828347`.

## Nota de auditoría (2026-09-17)
Barrido completo: **36/36 pruebas en vivo PASS** tras las correcciones. Hallazgo de proceso clave: **CI no
atrapó ninguno de los 6 defectos** — los tests unitarios daban falsa seguridad (uno cubría una copia
duplicada, no el código vivo) y las pruebas en vivo `.mts` **no corrían en los 4 workflows**. Recomendación:
integrar un subconjunto de pruebas en vivo (o un smoke E2E contra una branch Neon desechable) al pipeline
para cerrar esta brecha de cobertura. Defectos y fixes: commits `ac313e5`, `1c2cb0f`, `a796ee1`.
**CERRADO (Epic BE, 2026-09-17):** 5.º workflow `live-regression` levanta postgres:17 desechable, aplica
migraciones+roles y corre un smoke curado de 14 pruebas en vivo (kernel/RLS/firma + 6 barreras de medicación
+ CDS temporal/agregado + closed-loop). Commit `75783c1`; `scripts/ci/{bootstrap-db,live-smoke}.mts`.

## Nota de honestidad (reconciliación 2026-09-16)
Entre ~Epic S y ~Epic AK reporté el total incrementando ~+1% por vertical. Eso contradice los topes de peso
del modelo: 25 verticales event-sourced dan mucha **amplitud** (eje C ~30% de su 35%) pero poca **profundidad**
(sin SNOMED/CIE reales, sin CDS completo, UI de andamio, sin adjudicación C5 humana, IA en pausa). La suma
honesta de la columna "Aporta" es **~33%**, no ~54%. Reglas para no repetir el error:
- El total **siempre** = suma de "Aporta" (peso × completado). No se incrementa el titular por separado.
- Un vertical nuevo mueve **solo** el completado del eje C, acotado por su techo de 35%.
