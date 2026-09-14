import { test, expect, type Page } from '@playwright/test';

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? 'demo@medicalos.local';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'medicalos-demo-1234';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(DEMO_EMAIL);
  await page.getByLabel('Contraseña').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
}

/**
 * E2E del slice clínico (§NIVEL 16, §28). Recorre lo esencial autenticado: lista de
 * pacientes reales desde Neon, apertura del expediente y navegación a ARCO. Depende
 * del seed demo (`pnpm db:seed`): pacientes María Fernanda Ruiz y Santiago Herrera.
 */
test.describe('Slice clínico', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('la lista de pacientes carga los pacientes demo', async ({ page }) => {
    await page.goto('/patients');
    await expect(page.getByRole('heading', { name: 'Pacientes', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Ruiz/ })).toBeVisible();
  });

  test('abre el expediente de un paciente y muestra secciones clínicas', async ({ page }) => {
    await page.goto('/patients');
    await page.getByRole('link', { name: /Ruiz/ }).first().click();
    await expect(page).toHaveURL(/\/patients\/[A-Za-z0-9]+$/);
    // Secciones estables del workspace (§NIVEL 4) — títulos de ClinicalCard = <h2>.
    await expect(page.getByRole('heading', { name: 'Pendientes clínicos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Consentimientos' })).toBeVisible();
  });

  test('la bandeja ARCO es accesible para el admin demo', async ({ page }) => {
    await page.goto('/arco');
    await expect(page.getByRole('heading', { name: 'Solicitudes ARCO' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Registrar solicitud' })).toBeVisible();
  });

  test('la página de seguridad muestra 2FA y passkeys', async ({ page }) => {
    await page.goto('/security');
    await expect(page.getByRole('heading', { name: 'Seguridad de la cuenta' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Llaves de acceso (passkeys)' })).toBeVisible();
  });
});
