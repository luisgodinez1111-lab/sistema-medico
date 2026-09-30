# Porte sobre main de los defectos verificados del lote 11 (2026-09-30)

## Contexto

Los defectos D1–D12 se encontraron y corrigieron en la rama del refactor ADR-0300 (respaldo:
`claude/task-k6szac-respaldo-adr0300`). Mientras tanto `main` avanzó 194 commits con su propia partición del runtime
(R01-001), una plantilla única de ciclo de vida (R02a-TPL-01), validación de ids de ruta (R04-007), guarda de signos
vitales (R03) y validación de payloads (R06). Integrar las dos arquitecturas producía 72 ficheros en conflicto, así que el
dueño decidió **portar las correcciones sobre la estructura de main** y no traer las capas ADR-0300.

Método por grupo: análisis del estado real en main → prueba en vivo de la rama adaptada al contrato de main sin debilitar
sus checks → **control negativo** (la prueba falla en `origin/main` puro exactamente en los checks que cubre la corrección)
→ corrección en la raíz sobre los módulos de main, con una sola fuente de verdad → estáticos, suite, gates y pruebas en
vivo existentes → commit. Después, una revisión adversarial de los 8 commits (29 agentes: revisor por commit y un
verificador escéptico por hallazgo) confirmó 16 hallazgos, corregidos en 7 commits de seguimiento con su prueba.

## Estado por defecto

| Defecto | Estado en main antes | Commit del porte | Revisión | Prueba en vivo (fallan en main) |
|---|---|---|---|---|
| D4 lectura tipada, génesis estricta, guarda del kernel sin TOCTOU, `readEncounter` tipado | abierto | `bc4dee3` | `29036d8` | `live-aggregate-stream-isolation-proof` (8/9), `live-aggregate-kernel-race-proof` |
| D1 vital vigente (`VITAL_VOID_KIND`, `vitalVigente`/`vitalNoAnulada`) | parcial (solo cálculos) | `e816490` | — | `live-vital-correction-proof` (4/19) |
| D2 demografía vigente (`PATIENT_DEMOGRAPHIC_*`, `demografiaVigente`) y duplicados | abierto | `e816490` | — | `live-patient-demographics-projection-proof` (10/15) |
| D3 adjuntos como anotación del documento | abierto | `d424bdc` | — | `live-document-attachment-annotation-proof` (5/7) |
| D10, SQL-2, SQL-3 HbA1c vigente y canónica, ciclo de vida del resultado, exclusiones declaradas | abierto | `d424bdc` | `ea434b4` | `live-glycemic-quality-indicator-proof`, `live-result-registry-lifecycle-proof` (7/8) |
| D7 If-Match estricto antes de toda regla | abierto | `55ddeea` | `0b614fa` | `live-optimistic-version-proof` (5/7) |
| D8 id de ruta malformado → 400 en toda operación | parcial | `55ddeea` | `29036d8` | `live-route-id-validation-proof` (4/9) |
| D5 derivados reconciliados en el reintento; replay de la corrección validado | abierto | `d3db836` | `783ab2b` | `live-derived-command-reconciliation-proof`, `live-result-followup-replay-proof` |
| D6 efectos en Blob (replay antes de subir, nunca borrar un binario citado, retirada repetible) | abierto | `574fb06` | `14530a9` | `live-blob-idempotency-proof` (7/9), `live-review-blob-effects-proof` (5/11) |
| D9, F7 advertencia y brecha aniónica desde el dominio | parcial | `2122aa9` | `cbab395` | `live-metabolic-panel-caveat-proof` (3/7) |
| D12c `safeLog` emite a un sumidero | abierto | `2122aa9` | — | `live-security-log-sink-proof` (4/6) |
| D11 cockpit: captura de vitales, cambio de paciente único, ASK/ASK_CHOICE, `postAction` | abierto | `c44dd6c` | `ef44885` | `live-cockpit-asks-proof` (16/21) y pruebas de render |
| D12b ruta stub `/api/v1/timeline` | ya resuelto en main | — | — | — |

## Pendiente declarado (decisiones que no toma el porte)

- **Reconciliador de D5 del lado del servidor.** Un derivado que falla tras el commit principal solo se reconcilia con un
  reintento idéntico; cerrar Zero-Lost-Follow-Up sin el cliente requiere un reconciliador ligado al outbox (D-03).
- **Barrido de binarios huérfanos en Blob** (intento que muere entre la subida y el commit, o commit ambiguo).
- **Consentimiento desde el cockpit (CON-01).** Main exige `documentHash`, `method` y artefacto o testigo; la tabla de
  acciones no puede reunirlos con honestidad: sigue respondiendo 400 (antes también). Requiere decisión PROD/ENG.
- **Reglas de contenido evaluadas antes de If-Match** (firma del encuentro con críticos abiertos, renovación regulatoria):
  cambiar el orden cambia qué error devuelve el contrato; decisión de ENG.
- **Enmendar un vital desde el historial** de Signos/Consulta tras cerrar la toma: la API del historial no expone
  `vitalId`/versión; es una funcionalidad nueva.
- **Responsable y vencimiento de «Requiere acción»** siguen viniendo del cliente.
- **Precedencia 401/400** para un id malformado sin sesión (main valida el id antes de autenticar).
- **INV de las correcciones C4/C5**: las pruebas existen; registrar las invariantes requiere la autoridad ENG.
- **Validación PROD** de los textos clínicos nuevos (brecha aniónica, nota de HbA1c, estado «Corregido», etiquetas del
  cockpit, `REACTION_UNSPECIFIED`).
- **Datos existentes**: antes de desplegar, comprobar que no hay streams mezclados
  (`select tenant_id,aggregate_id from clinical_events group by 1,2 having count(distinct aggregate_type)>1`); tras D4 esos
  agregados fallan de forma explícita en lugar de plegarse mal.
- `release/evidence/live-smoke-ledger.json` debe regenerarse con el runner de main para registrar las pruebas nuevas.
