/**
 * API pública del paquete @medical-os/db.
 *
 * Nota de seguridad: el acceso a datos tenant-scoped pasa SIEMPRE por un
 * repositorio construido con un TenantContext. No se exporta forma alguna de
 * consultar tablas tenant-scoped sin ese contexto (ADR-0002, §NIVEL 2).
 */
export * from './client';
export * from './tenant-context';
export * from './context-resolver';
export * from './auth-credentials';
export * from './totp';
export * from './webauthn';
export * from './webauthn-credentials';
export * from './provisioning';
export * from './clinical-history';
export * from './prescription-safety';
export * from './completeness';
export * from './pathways';
export * from './specialty-packs';
export * from './physical-exam';
export * from './encounter-note';
export * from './result-classify';
export * from './fhir';
export * from './fhir-import';
export * from './storage';
export * from './ai-copilot';
export * from './repositories';
export * as schemaTables from './schema';
