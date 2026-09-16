# Epic R — Alergias + gate de seguridad de medicación (15-sep-2026)

Noveno vertical clínico. Lista de alergias del paciente **y** un gate de seguridad marquesina:
**no prescribir un fármaco al que el paciente tiene una alergia ACTIVA** (mismo patrón que el Zero
Lost Follow-Up). Autoridad de producto: PROD-011-R005 (alergias en el chart).

> Nota de gobierno: no existe una capacidad de alergias específica en `capabilities/catalog.json`;
> es una capacidad **nueva** (como OIDC/UI), propuesta como `CAP-ALLERGY-001` — pendiente de
> catalogación + adjudicación C5 humana.

## Endpoints
- `POST /api/v1/allergies` (RECORDED → ACTIVE)
- `POST /api/v1/allergies/:id/refutation` (→ REFUTED, terminal)
- `POST /api/v1/allergies/:id/inactivation` (ACTIVE → INACTIVE)
- `POST /api/v1/allergies/:id/reactivation` (INACTIVE → ACTIVE)

`packages/allergy-fold`, scope `allergy:write`. **Gate**: `handleMedicationPrescription` consulta
`activeAllergySubstances(patientId)` y bloquea (SAFETY_BLOCKED) si el `drugCode` contiene una
sustancia con alergia activa (medication-fold ahora expone `drugCode`). UI: panel de alergias +
"Alergias activas" (ámbar) en el header de resumen.

## Evidencia
- typecheck PASS · vitest **273/273** (+6) · build PASS (4 rutas `ƒ`).
- **Evidencia física EN VIVO contra Neon: PASS 9/9** (`scripts/v22/live-allergy-medication-gate-proof.mts`),
  incluye la estrella: **PRESCRIBE_BLOCKED_BY_ALLERGY_403 → inactivar → PRESCRIBE_UNBLOCKED_201**,
  más ciclo de vida (refutar/reactivar), SM ilegal 409, cross-tenant 404, missing-scope 403.
