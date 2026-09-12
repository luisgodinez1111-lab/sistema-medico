# ADR-0003 — Manejo de PHI (Protected Health Information)

- **Estado:** Aceptado
- **Fecha:** 2026-09-12
- **Deciden:** Security, Compliance/Privacy, Backend/Domain
- **Referencias del plan:** §10, §14, §15, §17, §25, §26, §33

## Contexto

Medical OS procesa datos personales sensibles de salud sujetos a NOM-004-SSA3-2012,
NOM-024-SSA3-2012 y la LFPDPPP (nueva ley 2025). El plan establece que privacidad, auditoría y
seguridad son requisitos de arquitectura, no un anexo.

## Decisión

Reglas transversales de PHI, aplicables a todo el código:

1. **No PHI en logs por defecto** (§17, §33). Los logs estructurados usan `correlation IDs`,
   nunca contenido clínico. Cualquier campo potencialmente PHI se redacta en la capa de logging.
2. **Archivos clínicos en object storage privado** (§10). La base de datos guarda solo
   metadata + `content hash`. Nunca URLs públicas para PHI; se usan signed URLs de corta duración
   o proxy autorizado.
3. **Cifrado en tránsito y en reposo** (§25). TLS obligatorio; cifrado gestionado en Neon y en
   object storage.
4. **Minimum necessary access** (§25, §26). El policy engine (ADR-0002) aplica deny-by-default.
5. **Provenance en todo dato clínico** (§NIVEL 3): origen, autor, encuentro, tiempo y versión.
   Las tablas de audit/provenance son **append-only** y separadas del estado operacional.
6. **IA con contexto mínimo** (§14). Desidentificar cuando el caso lo permita; nunca enviar el
   expediente completo a un proveedor de IA (§33). Guardar hash de model/version/prompt-policy,
   **no** el chain-of-thought.
7. **Derechos ARCO / titular** (§26): el modelo de datos soporta export, rectificación y
   trazabilidad de solicitudes.
8. **Retención y borrado** conforme a normativa; el borrado clínico es lógico + auditado, nunca
   destructivo sobre notas firmadas (§33).

## Consecuencias

- Todo `logger` del sistema pasa por un redactor de PHI (`packages/observability` +
  `packages/security`).
- La Definition of Done incluye la verificación "no introduce log de PHI/secret".
- El pipeline de CI incluye chequeos que fallan ante patrones de secreto en el diff.
