import { defineConfig } from 'drizzle-kit';

/**
 * Configuración de drizzle-kit. La URL se toma de entorno; nunca se hardcodea
 * (§reglas de código). Las migraciones SQL viven en ./drizzle y son la fuente
 * de verdad aplicada tanto en producción (Neon) como en tests (PGlite).
 */
export default defineConfig({
  schema: './src/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/medical_os',
  },
  strict: true,
  verbose: true,
});
