# Matriz de cumplimiento — México (NIVEL 18, §26)

- **Normas de referencia:** NOM-004-SSA3-2012 (del expediente clínico), NOM-024-SSA3-2012
  (sistemas de información de registro electrónico para la salud), **LFPDPPP** (nueva ley
  20-03-2025, reforma 14-11-2025), ISO 27799:2025, SAFER Guides (ONC).
- **Aviso:** la implementación jurídica exacta debe **validarse con asesoría legal
  especializada antes del go-live**. Esta matriz mapea obligación → capacidad de producto →
  estado, para diseñar desde el inicio (no como parche final).

Leyenda: ✅ implementado · 🟨 parcial · ⬜ pendiente

## Expediente clínico (NOM-004 / NOM-024)

| Obligación | Capacidad de producto | Estado |
| --- | --- | --- |
| Identificación del paciente | `patient` con nombre desglosado, sexo, nacimiento, MRN, CURP; header persistente | ✅ |
| Identificación del profesional | `practitioner` (cédula/licenseNumber, especialidad); nota firmada atribuida | ✅ |
| Fecha y hora de los actos | timestamps en encuentros/notas/órdenes/resultados; firma con `signedAt` | ✅ |
| Procedimientos realizados | `procedure` (FHIR Procedure): acto ejecutado con fecha, autor y desenlace; ligable a encuentro y orden | ✅ |
| Nota firmada e íntegra | firma = snapshot + hash SHA-256; edición destructiva bloqueada; addenda append-only | ✅ |
| Conservación e integridad | soft-delete (nunca destructivo), hash de documentos, audit append-only | ✅ |
| Historia clínica estructurada | Adaptive History Engine (adulto/pediátrico, secciones versionadas) | 🟨 |
| Interoperabilidad / estándares | export/import FHIR R4; catálogos abstraídos | 🟨 (falta terminología/HL7v2/DICOM) |
| Documentos/estudios asociados | `clinical_document` (metadata+hash, R2) con fecha del estudio | ✅ |

## Privacidad y datos personales (LFPDPPP)

| Obligación | Capacidad de producto | Estado |
| --- | --- | --- |
| Aviso de privacidad y consentimiento | entidad **`consent`** (aviso de privacidad, atención, transferencia, procedimiento); otorgar/revocar atribuido y fechado | ✅ |
| Finalidades / control de transferencias | tipo `data-sharing` en consentimientos; export FHIR auditado | 🟨 |
| Confidencialidad / minimum necessary | policy engine (RBAC), scoping por tenant, permiso `patient.write`; PHI fuera de logs | ✅ |
| Derechos ARCO (acceso/rectif./cancel./oposición) | lectura del expediente + audit; **falta workflow formal de solicitud ARCO** | ⬜ |
| Seguridad de los datos | TLS/HSTS, CSP, cifrado en reposo (Neon/R2), MFA, rate-limit, bucket privado | ✅ |
| Gestión de incidentes / notificación | `docs/security/incident-response.md` (severidades, contención, deber de notificación) | 🟨 |
| Trazabilidad | `audit_event` + `provenance` (append-only) con actor y decisión de autorización | ✅ |

## Seguridad de la información (ISO 27799 / OWASP ASVS)

| Control | Estado |
| --- | --- |
| Autenticación fuerte (MFA/passkeys) | 🟨 (TOTP ✅; falta WebAuthn/passkeys) |
| Autorización deny-by-default | ✅ (RBAC; falta ABAC/ReBAC + break-glass) |
| Aislamiento multi-tenant | ✅ (scoping + constraints + pruebas cross-tenant; RLS diferida ADR-0004) |
| Cabeceras/CSP/HSTS | ✅ (CSP con `'unsafe-inline'` por ahora → nonce pendiente) |
| Rate limiting | ✅ login/search/export/upload (distribuido con Upstash pendiente) |
| Cifrado en tránsito/reposo | ✅ (TLS + cifrado gestionado de Neon/R2) |
| SAST/DAST/deps scan | 🟨 (CodeQL + gitleaks; falta Semgrep/dependency-review/DAST) |
| Threat models | ✅ (`docs/threat-models/`) |
| Pentest previo a producción | ⬜ (externo) |
| Backups/PITR + drills (RTO/RPO) | 🟨 (Neon PITR disponible; faltan drills documentados — NIVEL 17) |

## Seguridad clínica (SAFER Guides)

| Riesgo | Mitigación | Estado |
| --- | --- | --- |
| Paciente equivocado | header persistente + anti-duplicados + merge auditado | ✅ |
| Resultado no revisado | Result Inbox + owner + escalamiento de críticos | ✅ |
| Error de medicamento | allergy/interacción + dosis pediátrica trazable + confirmación | ✅ |
| Nota incompleta | motor de completitud no intrusivo | 🟨 |
| Alert fatigue | severidades; **falta suppression/dedup formal** | ⬜ |

## Brechas priorizadas para go-live (NIVEL 18)

1. **Workflow ARCO** (derechos del titular) — capacidad de producto faltante.
2. **Pentest** independiente con datos sintéticos.
3. **Drills de restore** (RTO/RPO) documentados (NIVEL 17).
4. **Validación clínica + usabilidad** con médicos; **SAFER self-assessment**.
5. **Firma electrónica avanzada** (validez jurídica) — hoy la firma es hash interno.
6. **Revisión jurídica** de la implementación LFPDPPP/NOM con asesoría especializada.

> Go-live requiere firma conjunta de producto clínico, seguridad, ingeniería, QA y
> privacidad/compliance (§18). Esta matriz es el punto de partida, no un certificado.
