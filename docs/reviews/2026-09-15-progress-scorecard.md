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
| C. Verticales clínicos (~28 áreas PROD): amplitud + profundidad | 35% | ~34.5% | 12.1 |
| D. AI copilot / inteligencia clínica | 18% | ~5% | 0.9 |
| E. UI/UX de producto | 10% | ~21% | 2.1 |
| F. Adjudicación de trazabilidad (C5 humano) | 8% | ~20% | 1.6 |
| G. Endurecimiento producción + compliance | 9% | ~19% | 1.7 |

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

## Nota de auditoría — segunda pasada (2026-09-17): handlers sin cablear
Hallazgo **#10**: **8 handlers de la línea L13–L18 NO los importa ninguna ruta** (features inalcanzables desde
la app): adaptive-history, ai-gateway, clinical-inbox, clinical-intelligence, document-ingestion, imaging,
lab-order, prescription. Es la razón por la que sus bugs no se detectaban (nunca se ejecutan). De ellos, 3
tenían el bug de aggregateId no-uuid (reventarían con 22P02/500 al llamarse): clinical-intelligence (#8),
prescription (#12), ai-gateway (#11) — **corregidos**. Los otros 5 usan aggregateId uuid válido.
**Recomendación:** decidir por feature si se cablea (ruta + prueba en vivo) o se retira; hoy son ~2.5k líneas
de código muerto que inflan la sensación de avance sin aportar valor end-to-end. La adjudicación de L13–L18
debería marcarlas `NOT_WIRED` hasta activarlas.

## Nota de auditoría (2026-09-17)
Barrido completo: **36/36 pruebas en vivo PASS** tras las correcciones. Hallazgo de proceso clave: **CI no
atrapó ninguno de los 6 defectos** — los tests unitarios daban falsa seguridad (uno cubría una copia
duplicada, no el código vivo) y las pruebas en vivo `.mts` **no corren en los 4 workflows**. Recomendación:
integrar un subconjunto de pruebas en vivo (o un smoke E2E contra una branch Neon desechable) al pipeline
para cerrar esta brecha de cobertura. Defectos y fixes: commits `ac313e5`, `1c2cb0f`, `a796ee1`.

## Nota de honestidad (reconciliación 2026-09-16)
Entre ~Epic S y ~Epic AK reporté el total incrementando ~+1% por vertical. Eso contradice los topes de peso
del modelo: 25 verticales event-sourced dan mucha **amplitud** (eje C ~30% de su 35%) pero poca **profundidad**
(sin SNOMED/CIE reales, sin CDS completo, UI de andamio, sin adjudicación C5 humana, IA en pausa). La suma
honesta de la columna "Aporta" es **~33%**, no ~54%. Reglas para no repetir el error:
- El total **siempre** = suma de "Aporta" (peso × completado). No se incrementa el titular por separado.
- Un vertical nuevo mueve **solo** el completado del eje C, acotado por su techo de 35%.
