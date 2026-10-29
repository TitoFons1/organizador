import { expect, type Page, type TestInfo } from '@playwright/test';

/** Registra una cuenta nueva (un email distinto por test y proyecto) y espera al panel. */
export async function registerNewUser(page: Page, testInfo: TestInfo) {
  await page.goto('/registro');
  await page.getByLabel('Nombre').fill('Ana E2E');
  await page.getByLabel('Email').fill(`e2e-${testInfo.project.name}-${Date.now()}@example.com`);
  await page.getByLabel('Contraseña').fill('contrasena-e2e-segura');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Panel' })).toBeVisible();
}

/**
 * Pulsa una seccion de la navegacion principal. Hay dos barras (inferior en movil, lateral en
 * escritorio) y Playwright solo encuentra la visible, asi que el mismo test sirve para ambas.
 */
export async function goTo(page: Page, section: string) {
  await page
    .getByRole('navigation', { name: 'Principal' })
    .getByRole('link', { name: section, exact: true })
    .click();
}

/** Pixeles que sobran a lo ancho (0 = sin desplazamiento horizontal). */
export function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}
