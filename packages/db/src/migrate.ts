import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

/**
 * Aplica las migraciones SQL contra Neon. Ejecutar con `pnpm db:migrate`.
 * La URL de conexión se lee de entorno (§reglas): nunca se hardcodea.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no está definida; no se puede migrar.');
  }

  const here = dirname(fileURLToPath(import.meta.url));
  const migrationsFolder = resolve(here, '..', 'drizzle');

  const sql = neon(url);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder });
  // eslint-disable-next-line no-console
  console.log('Migraciones aplicadas correctamente.');
}

main().catch((error: unknown) => {
  console.error('Fallo al migrar:', error);
  process.exit(1);
});
