import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

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

const isMobile = (testInfo: TestInfo) => testInfo.project.name === 'movil';

/**
 * Un dia de la semana del Panel. En movil se elige en la tira (solo se ve un dia); en
 * escritorio esta ya en la rejilla.
 */
export async function openDay(page: Page, testInfo: TestInfo, name: string): Promise<Locator> {
  if (isMobile(testInfo)) {
    await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
  }
  return page.getByRole('region', { name });
}

/**
 * La tarjeta de una clase con sus acciones. En movil esta en la agenda del dia; en escritorio
 * aparece debajo de la rejilla al pulsar su bloque.
 */
export async function openClass(
  page: Page,
  testInfo: TestInfo,
  day: string,
  subject: string,
): Promise<Locator> {
  const region = await openDay(page, testInfo, day);
  if (isMobile(testInfo)) return region;
  await region.getByRole('button', { name: new RegExp(`^${subject},`) }).click();
  return page.getByRole('region', { name: 'Clase seleccionada' });
}
