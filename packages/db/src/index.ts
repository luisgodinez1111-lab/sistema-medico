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
export * from './clinical-history';
export * from './prescription-safety';
export * from './completeness';
export * from './pathways';
export * from './repositories';
export * as schemaTables from './schema';
