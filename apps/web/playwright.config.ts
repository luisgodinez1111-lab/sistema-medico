import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// El config es ESM ("type":"module"): `__dirname` no existe. Se resuelve desde el
// cwd (apps/web al correr `test:e2e`) y se prueban rutas candidatas hacia la raíz.
const ENV_CANDIDATES = [
  resolve(process.cwd(), '../../.env.local'),
  resolve(process.cwd(), '.env.local'),
];

/**
 * E2E del slice clínico (§NIVEL 16). Levanta la app en modo producción contra la
 * BD real (Neon) y ejecuta el flujo del usuario demo. Requiere DATABASE_URL y
 * AUTH_SECRET: en local se cargan de `.env.local` (raíz del repo); en CI, de los
 * secrets del workflow. Si faltan, el server no arranca y las pruebas fallan claro.
 */

// Carga perezosa de la raíz `.env.local` a process.env (sólo claves ausentes), para
// que el webServer herede las credenciales sin acoplarnos a dotenv en runtime.
function loadRootEnv(): void {
  let file: string | null = null;
  for (const candidate of ENV_CANDIDATES) {
    try {
      file = readFileSync(candidate, 'utf8');
      break;
    } catch {
      // Prueba la siguiente ruta candidata.
    }
  }
  if (file) {
    for (const line of file.split('\n')) {
      const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1]!;
      let val = m[2]!.trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = val;
    }
  }
  // Sin archivo (CI): se usan las variables ya presentes en process.env.
}
loadRootEnv();

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

// Pasa TODO el entorno cargado al server (no dependemos del merge de Playwright):
// garantiza paridad con `next start` manual (AUTH_SECRET, DATABASE_URL, etc.).
const passthroughEnv: Record<string, string> = {};
for (const [k, v] of Object.entries(process.env)) {
  if (typeof v === 'string') passthroughEnv[k] = v;
}

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start --port ${PORT}`,
    url: baseURL,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: {
      ...passthroughEnv,
      NODE_ENV: 'production',
      DIRECT_DATABASE_URL: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? '',
      // Auth.js v5 en modo producción exige host de confianza; en Vercel es
      // automático, pero para el server local de E2E hay que declararlo.
      AUTH_TRUST_HOST: 'true',
      AUTH_URL: baseURL,
    },
  },
});
