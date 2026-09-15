# Medical OS — Índice de Especificación y Autoridad (V2)

> Este índice registra los documentos maestros de Medical OS V2 y la **jerarquía de
> autoridad** entre ellos. Es gobierno, no funcionalidad. Almacenado el 15-sep-2026.

## Los tres documentos maestros (fuente de verdad)

| # | Documento | Rol / autoridad | Namespace | Ubicación |
| - | --- | --- | --- | --- |
| 1 | **V2.0.1 — Product & Clinical Specification** | **QUÉ** debe ser y hacer Medical OS para médico y paciente (congelado). | `PROD-000…PROD-177` (átomos `PROD-xxx-Ryyy`) | `docs/product/v2/Medical_OS_V2.0.1_FINAL.docx` (+ `.extracted.txt`) |
| 2 | **V2.1.1 — Engineering & Implementation Specification** | **CÓMO** se construye y se demuestra (bible de ingeniería, incl. enmienda hyperscale). | `ENG-000…ENG-297` (átomos `ENG-xxx-Ryyy`) | `docs/engineering/v2.1/Medical_OS_V2.1.1_FINAL.docx` (+ `.extracted.txt`) |
| 3 | **Agent Execution Companion** | **CÓMO DEBE COMPORTARSE un agente de código** al ejecutar V2.1 (operacional, machine-readable). | `EXEC-0001…` | `docs/agent-execution/Medical_OS_Companion_FINAL.md` |

Los `.docx` son la **fuente autoritativa**; los `.extracted.txt` son un render de texto
(hecho con `textutil`) para búsqueda/lectura por agentes — si difieren, manda el `.docx`.

> Nota: el usuario mencionó **4 documentos**; se recibieron **3 archivos**. Pendiente
> confirmar si falta un cuarto (p. ej. un registro de trazabilidad `PROD↔ENG↔EXEC`, o un
> plan de fases separado) o si el Companion cumple el doble rol de "cómo lo haremos".

## Jerarquía de fuentes (EXEC-0001) — regla de conflicto

```
V2.0.1 (producto/clínica)  →  V2.1.1 (ingeniería)  →  docs/adr/  →
docs/clinical-governance/  →  docs/compliance/  →  docs/threat-models/  →
GitHub issue  →  Companion (EXEC)
```

**Regla dura:** ante un conflicto entre capas, **NO se implementa la contradicción**: se
detiene, se marca `SPEC-CONFLICT` y se exige ADR/corrección de spec. Un artefacto de nivel
inferior **puede restringir** pero **nunca redefinir en silencio** una conducta ACTIVE de
nivel superior. `FUTURE` no se activa porque ENG/EXEC lo discuta, prototipe o pruebe.

## Invariantes que ningún documento inferior puede debilitar

- **Clinical Truthfulness** — verificado ≠ reportado por paciente ≠ importado ≠ derivado ≠
  sugerido por IA. No se presentan con la misma autoridad.
- **Explicit Uncertainty** — `UNKNOWN / NOT_ASSESSED / PENDING / CONFLICTING / UNVERIFIED /
  NOT_APPLICABLE` son estados legítimos; ausencia de dato ≠ normal/negativo.
- **Physician Control** — ninguna sugerencia se vuelve diagnóstico/orden/receta/nota firmada
  sin acción del médico. IA nunca escribe en registro firmado.
- **Zero Lost Follow-Up** — toda obligación clínica futura tiene owner, estado y cierre; nada
  desaparece sin estado terminal + evidencia.
- **Tenant isolation, provenance, audit, recoverability** como comportamiento de primera clase.
- **Safety-critical nunca depende exclusivamente de IA generativa** (núcleo determinista).

## Leyes de ingeniería no negociables (EXEC-0003, ENG-006/094/130)

No orphan clinical data · No orphan future obligation · No silent AI truth · No frontend
authorization · No destructive signed-record edits · No PHI in telemetry by default · No
critical workflow without owner+terminal state · No clinical rule sólo en JSX/prompt · No
whole-chart a IA por comodidad · No dependencia de un solo proveedor de IA · No claim de
certificación sin evidencia.

## Arquitectura objetivo (EXEC-0004 / ENG-004) vs. estado actual del repo

**Objetivo V2.1** — modular monolith con fronteras duras:

```
apps/{web, patient-portal}
packages/{clinical-domain, patient-state, clinical-intelligence, clinical-content,
          medication, documents, diagnostics, authz, audit, db, design-system,
          interoperability, security, observability, shared}
workers/  infra/  docs/{adr,product,engineering,clinical-safety,threat-models,compliance,runbooks}
tests/{unit,integration,e2e,security,clinical-regression,ai-evals,interop}
```

**Estado actual del repo (pre-V2):** `apps/web` + `packages/{db, shared, design-system}`,
construido bajo un plan previo de "18 niveles / R0–R7". Cubre parte del **golden vertical
slice** (ENG-070): identidad/tenancy, paciente, encuentro+firma+hash, medicación con
chequeo de seguridad, órdenes/resultados con escalamiento crítico, obligaciones (Task),
Consent, documentos en R2, ARCO, MFA/WebAuthn, CSP nonce, health check, E2E.

> **DIVERGENCIA CLAVE (para la revisión):** lo ya construido es un **subconjunto funcional
> valioso pero con estructura y granularidad distintas** a la arquitectura objetivo V2.1.
> Antes de "construcción masiva", V2/V2.1 exige: (a) L00 governance + **matriz de
> trazabilidad** `PROD↔ENG↔EXEC↔code/test/evidence`; (b) ADRs fundacionales (0001–0018);
> (c) contratos de dominio del golden slice estables; (d) capa determinista (algorithm
> platform, knowledge engine) separada de IA. La reconciliación "código actual → target V2.1"
> debe planearse explícitamente, no asumirse equivalente por similitud semántica.

## Próximos pasos de gobierno (antes de construir en masa)

1. Confirmar si existe un 4.º documento (registro de trazabilidad / plan de fases).
2. Emitir el **informe de revisión senior** de los tres documentos (consistencia cruzada,
   correctitud, huecos, mejoras) — sin cambiar aún código de producto.
3. Decidir estrategia de reconciliación repo-actual ↔ arquitectura V2.1 (evolución in-place
   por niveles L00–L29, o reencuadre de packages) vía ADR.
