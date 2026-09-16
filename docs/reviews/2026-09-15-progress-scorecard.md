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
| C. Amplitud de verticales clínicos (~28 áreas PROD) | 35% | ~22% | 7.7 |
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
