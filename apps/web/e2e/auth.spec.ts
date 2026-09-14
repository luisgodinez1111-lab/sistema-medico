import { test, expect } from '@playwright/test';

const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? 'demo@medicalos.local';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'medicalos-demo-1234';

/**
 * E2E de autenticación (§NIVEL 16, NIVEL 2). Verifica el gate del proxy y el login
 * real con credenciales del usuario demo (email + contraseña, sin MFA).
 */
test.describe('Autenticación', () => {
  test('una ruta protegida redirige a /login sin sesión', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Inicia sesión para continuar')).toBeVisible();
  });

  test('credenciales inválidas muestran error y no autentican', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Contraseña').fill('contraseña-incorrecta');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText(/No se pudo iniciar sesión|Credenciales inválidas/)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('login con credenciales demo llega al Command Center', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(DEMO_EMAIL);
    await page.getByLabel('Contraseña').fill(DEMO_PASSWORD);
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Command Center' })).toBeVisible();
  });
});
