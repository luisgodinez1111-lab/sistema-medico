# Estado de construcción — Medical OS

Avance por niveles del Plan Maestro (§36) y releases (§29).
Leyenda: ⬜ pendiente · 🟨 en curso · ✅ completo (puerta de salida cruzada)

## Release R0 — Foundation

| Nivel | Descripción                              | Estado |
| ----- | ---------------------------------------- | ------ |
| 0     | Gobierno, repositorio y CI               | ✅     |
| 1     | Design System y arquitectura de info     | 🟨     |
| 2     | Identidad, tenancy y autorización        | ⬜     |
| —     | Audit/provenance skeleton                | ⬜     |

**NIVEL 0 — puerta cruzada (2026-09-12):** monorepo pnpm+Turborepo con TS estricto,
ESLint 9, Prettier, husky+lint-staged; ADR-0001/0002/0003; plantillas de issues;
CODEOWNERS; DoD y CHANGELOG; pipeline CI (gitleaks → deps → lint → typecheck → test →
build → CodeQL). `pnpm typecheck/lint/test/build` en verde.

**NIVEL 1 — en curso:** design system (`@medical-os/design-system`) con tokens
theme-aware, primitivas (Button/Badge/Alert/ClinicalCard) y patrones de seguridad
(PatientHeader persistente, AllergyBanner). App Next.js con shell de 3 columnas (§2.1),
Command Center y Patient Workspace navegables con datos sintéticos.
Pendiente del gate: Storybook, Command Palette, verificación teclado/touch en 3 tamaños.

## Release R1 — Clinical Core

| Nivel | Descripción                              | Estado |
| ----- | ---------------------------------------- | ------ |
| 3     | Clinical Data Foundation                 | ⬜     |
| 4     | Patient Workspace                        | ⬜     |
| 5     | Adaptive Clinical History Engine         | ⬜     |
| 6     | Encounter Workspace + firma              | ⬜     |

## Release R2 — Safety Loop

| Nivel | Descripción                              | Estado |
| ----- | ---------------------------------------- | ------ |
| 8     | Medication & Prescription Safety         | ⬜     |
| 9     | Orders, Results y Closed-Loop Safety     | ⬜     |

## Releases posteriores

| Release | Contenido                                | Estado |
| ------- | ---------------------------------------- | ------ |
| R3      | Agenda, check-in, billing básico         | ⬜     |
| R4      | Pathways, completeness, med safety       | ⬜     |
| R5      | Documents, FHIR, external adapters       | ⬜     |
| R6      | AI Copilot (human-in-the-loop)           | ⬜     |
| R7      | Specialty packs                          | ⬜     |

## Vertical slice objetivo (§28)

El primer corte end-to-end que valida la columna vertebral:

1. ⬜ Crear tenant, organización, consultorio y médico
2. ⬜ Crear/buscar paciente con detección de duplicados
3. ⬜ Abrir Patient Workspace
4. ⬜ Crear encuentro de medicina general
5. ⬜ Capturar historia adaptativa adulto/pediátrico mínima
6. ⬜ Registrar signos vitales y exploración
7. ⬜ Crear problema/diagnóstico y plan
8. ⬜ Emitir receta estructurada
9. ⬜ Solicitar un laboratorio
10. ⬜ Firmar encuentro (snapshot + provenance)
11. ⬜ Ingresar resultado del laboratorio
12. ⬜ Mostrarlo en Result Inbox
13. ⬜ Marcar revisado + acción + paciente informado
14. ⬜ Cerrar obligación clínica
15. ⬜ Visualizar todo en timeline y audit trail
