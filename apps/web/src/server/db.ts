import 'server-only';
import { createNeonDatabase, type Database } from '@medical-os/db';

/**
 * Cliente de base de datos del lado servidor (§NIVEL 2). `server-only` garantiza
 * que este módulo JAMÁS se incluya en un bundle de cliente: la cadena de
 * conexión y el acceso a datos nunca llegan al navegador.
 *
 * En runtime usamos la conexión pooled (`DATABASE_URL`). La URL se lee de
 * entorno; nunca se hardcodea (§reglas de código).
 */
let cached: Database | undefined;

export function getDb(): Database {
  if (cached) return cached;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL no está definida en el entorno del servidor.');
  }
  cached = createNeonDatabase(url);
  return cached;
}
