# ADR-0220 — Diseño del AI Copilot: IA de apoyo sobre un núcleo determinista
Status: PROPUESTO (R6 EN PAUSA — este ADR es diseño/gobernanza; no activa IA)


> **Encabezado de gobierno añadido el 2026-10-06 (auditoría R09-003).** El ADR original no declaraba fecha, autor ni
> alternativas. Lo que sigue se DERIVA de evidencia verificable o se declara ausente; **nada se reconstruye de memoria**:
> inventar una fecha de decisión o un decisor sería fabricar un registro de gobierno, que es justo el defecto que esta
> auditoría persigue en otros sitios (la tabla de firmas C5 vacía, `Mapping_Adjudication.csv` con cero filas).
>
> · **Fecha de incorporación al repositorio:** 2026-09-17 (del historial de git, `--diff-filter=A`). **No es la fecha de la
>   decisión**, que no consta en ninguna parte.
> · **Decidido por:** **no consta.** El repositorio registra quién hizo el commit, no quién tomó la decisión, y son cosas
>   distintas. Lo llena el dueño del producto; hasta entonces este ADR documenta una decisión sin decisor registrado.
> · **Alternativas consideradas:** Las alternativas **no constan** en el documento original.

## Contexto

El sistema tiene un núcleo clínico DETERMINISTA amplio: kernel event-sourced con RLS forzado y cadena de
auditoría, y ~30 módulos de CDS por reglas (7 barreras de prescripción; NEWS2, eGFR/ERC, control glucémico,
CHA₂DS₂-VASc, MELD, FIB-4, anion gap/ácido-base, CURB-65, gradiente A-a, y el resumen priorizado de Epic BS).
Esa inteligencia es reproducible, auditable y gratuita.

El eje D (AI copilot) es el de mayor peso del scorecard (18%) y el menos desarrollado (~5%). El dominio es
médicamente sensible: un error de la IA puede dañar a un paciente. R6 (activación de IA real) está EN PAUSA
por decisión del usuario. Este ADR fija el DISEÑO para que, cuando se active, sea seguro y de bajo costo.

Invariantes de la spec que gobiernan cualquier IA (SPEC_INDEX, EXEC-0003, ENG-036):
- Safety-critical nunca depende exclusivamente de IA generativa (núcleo determinista).
- Physician Control: ninguna sugerencia se vuelve diagnóstico/orden/receta/nota firmada sin acción del médico.
- No silent AI truth: verificado ≠ reportado por paciente ≠ importado ≠ derivado ≠ sugerido por IA.
- Explicit Uncertainty: UNKNOWN/NOT_ASSESSED son estados legítimos; la IA se abstiene antes que alucinar.
- No whole-chart a IA por comodidad (mínimo necesario / LFPDPPP).
- No dependencia de un solo proveedor de IA. No PHI en telemetría por defecto.

## Decisión

**La IA generativa es un traductor/asistente, no el cerebro clínico.** El determinismo decide; la IA solo hace
lo que el determinismo no hace bien: LENGUAJE y EXTRACCIÓN. Toda salida de IA es un BORRADOR que (a) cita su
fuente o se abstiene, (b) pasa por las MISMAS barreras de seguridad que la entrada humana, y (c) entra al
registro como `AI_SUGGESTED`, nunca auto-promovida.

### Arquitectura (choke point único)

```
Médico/UI → ai-gateway (ÚNICO punto de entrada)
              · nivel de riesgo (ENG-036)   · kill-switch + ai-authority-gate
              · tope de presupuesto          · Zero-Data-Retention + ruteo de modelo (Vercel AI Gateway)
              · minimización de PHI          · auditoría por llamada (sin PHI en telemetría)
            → LLM (modelo barato por defecto → grande solo si es complejo) → salida ESTRUCTURADA + citas
            → VALIDACIÓN DETERMINISTA (los módulos CDS + barreras) → si es inseguro, se bloquea
            → evento AI_SUGGESTED en el store → el médico revisa → promueve a VERIFIED
```

El `ai-gateway` (hoy `NOT_WIRED`) es el único lugar por el que puede pasar una llamada de IA; concentra riesgo
tier, kill-switch (`packages/ai-authority-gate`), presupuesto (`packages/operational-safety-budget`),
minimización de contexto, ruteo de proveedor y auditoría.

### Niveles de riesgo (ENG-036) — dónde SÍ y dónde NO

| Caso de uso | Riesgo | IA |
| --- | --- | --- |
| Borrador de nota (SOAP/HPI) desde datos ya estructurados | Bajo (borrador) | Sí; el médico edita y firma |
| Extracción de labs/documentos externos (PDF/foto → estructurado) | Bajo | Sí; luego lo valida el clasificador determinista |
| Resumen del expediente longitudinal (citado) | Bajo | Sí; solo lectura, con citas |
| Explicación en lenguaje simple para el paciente (de un plan ya aprobado) | Bajo | Sí |
| Diagnóstico, orden, receta, cálculo de dosis | ALTO | NO — determinista + médico (las barreras existentes) |

### Salvaguardas no negociables

1. **Provenance.** Toda salida de IA es un evento `AI_SUGGESTED`; nunca se auto-promueve. El médico la promueve
   a `VERIFIED`. Reutiliza el modelo existente (problem-list `source: AI_EXTRACTED` + estados epistémicos).
2. **Misma puerta que el humano.** Una sugerencia de IA (p. ej. una dosis) pasa por `validateMedicationOrder`
   + dose-ceiling + renal + alergias/DDI/duplicación/contraindicación. Sin puerta trasera para la IA.
3. **Grounding + abstención.** Cada afirmación cita su fuente (resultado/nota/guía). Si no puede citar, devuelve
   UNKNOWN/NOT_ASSESSED. Prohibido inventar.
4. **Kill-switch + authority-gate + presupuesto.** Interruptor por tenant/feature; tope de gasto/uso; la IA no
   puede cruzar a acciones de alto riesgo.
5. **Shadow mode antes de activar** (ENG-036): corre en paralelo, se compara con las decisiones del médico y se
   mide, antes de ser clinician-facing.
6. **Eval gates en CI.** Suite de casos clínicos con comportamiento seguro esperado (incluye "debe abstenerse" y
   "no debe alucinar un fármaco"); bloquea cualquier cambio de prompt/modelo, como el gate `live-regression`.

### Estrategia de costo (mínimo costo, máxima efectividad)

- El determinismo hace el grueso de la "inteligencia" gratis; el LLM solo se invoca cuando aporta lenguaje/
  extracción, acotado por `operational-safety-budget`.
- **Ruteo por tarea** vía Vercel AI Gateway: modelo barato/rápido para extracción/clasificación/resumen; modelo
  grande solo para síntesis compleja. Con fallbacks y sin lock-in de proveedor.
- **Contexto mínimo necesario**, nunca el expediente completo: RAG sobre el resumen determinista (Epic BS) +
  snippets relevantes. Más barato y más seguro.
- **Salidas estructuradas** (tool calls / JSON schema) → menos reintentos, salida pequeña, verificable.
- **Batch/async** para lo no interactivo (documentos). **Prompt caching** + **ZDR** (no se entrena con PHI).
- Efecto: costo por encuentro en el orden de centavos, porque el LLM casi no "razona".

## Plan de activación por fases (cada fase es un gate; ninguna levanta R6 por sí sola)

1. **Choke point del gateway SIN IA** (stub determinista): kill-switch + presupuesto + provenance + auditoría.
   Es infraestructura de seguridad; se puede construir sin levantar R6.
2. **Eval harness + shadow mode** (casos clínicos, gate en CI).
3. **Primer caso real de bajo riesgo:** extracción de documentos, validada por el clasificador determinista
   (async, barato, alto valor).
4. Borrador de nota y resumen citado.
5. Diagnóstico/receta/orden permanecen deterministas + médico; nunca los ejecuta la IA.

## Consecuencias

- Positivas: seguridad por diseño (la IA hereda todas las barreras); costo bajo y acotado; sin lock-in de
  proveedor; compliance (ZDR, PHI mínima, sin PHI en telemetría); trazabilidad total (provenance + auditoría).
- Costos/limitaciones: requiere el eval harness y el shadow mode antes de cualquier exposición clínica; MFA,
  IdP de producción y automatización de DR son dependencias externas separadas; la activación real exige
  levantar R6 con las fases 1–2 completas y verdes.

## Referencias
- SPEC_INDEX (jerarquía + invariantes), EXEC-0003, ENG-036 (AI risk tiers / shadow mode / eval gates).
- Piezas existentes: `packages/ai-gateway` (NOT_WIRED), `packages/ai-authority-gate`,
  `packages/operational-safety-budget`, `packages/clinical-intelligence` (motor determinista),
  `docs/adjudication/not-wired-registry.json` (estado NOT_WIRED de la IA).
- Núcleo determinista de esta sesión: CAP-CLINICAL-INTELLIGENCE-001 y las capacidades de CDS asociadas.
