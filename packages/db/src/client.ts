import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as schema from './schema';

/**
 * Tipo de base de datos común a todos los drivers (Neon en producción, PGlite en
 * tests). Los repositories dependen de este tipo, nunca de un driver concreto
 * (ADR-0002: "los repositories abstraen el storage").
 */
export type Database = PgDatabase<PgQueryResultHKT, typeof schema>;

export { schema };

/**
 * Crea el cliente de producción contra Neon (Postgres serverless).
 * La URL NUNCA se hardcodea: se lee de entorno en el borde de la app (§reglas).
 */
export function createNeonDatabase(connectionString: string): Database {
  if (!connectionString) {
    throw new Error('createNeonDatabase: connectionString vacío');
  }
  return drizzleNeon(connectionString, { schema }) as unknown as Database;
}
