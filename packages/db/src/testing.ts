import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { Database } from './client';
import { schema } from './client';

const here = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(here, '..', 'drizzle');

/**
 * Base de datos Postgres en memoria (PGlite) con el esquema migrado.
 * Se usa SOLO en tests: permite probar el aislamiento tenant real contra SQL
 * verdadero, sin depender de un Postgres externo (gate de NIVEL 2).
 */
export async function createTestDatabase(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder });
  return {
    db: db as unknown as Database,
    close: () => client.close(),
  };
}
