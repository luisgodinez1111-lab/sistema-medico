import { defineConfig, configDefaults } from 'vitest/config';

/**
 * Vitest (unit) excluye `e2e/` — esas specs son de Playwright (§NIVEL 16) y se
 * corren con `pnpm test:e2e`, no con el runner unitario.
 */
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
});
