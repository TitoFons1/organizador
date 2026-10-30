import { expect, test } from '@playwright/test';
import { horizontalOverflow, registerNewUser } from './support';

/** Fecha civil de Madrid desplazada `days` dias desde hoy (AAAA-MM-DD). */
const madridDate = (days: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(
    new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  );

// Criterio de "hecho" de M5 (docs/02, seccion 6).
test('una tarea vencida sale en Atrasadas y al marcarla hecha cambia de grupo', async ({
  page,
}, testInfo) => {
  await registerNewUser(page, testInfo);
  const bucket = (name: string) => page.getByRole('region', { name: new RegExp(`^${name}`) });

  await test.step('captura rapida: una linea y queda en Sin fecha', async () => {
    await page.getByRole('button', { name: 'Apuntar un pendiente' }).click();
    await page.getByLabel('¿Qué tienes pendiente?').fill('Leer tema 3');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Apuntado: Leer tema 3')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(bucket('Sin fecha').getByText('Leer tema 3')).toBeVisible();
  });

  await test.step('una tarea con fecha de ayer aparece en Atrasadas', async () => {
    await page.getByRole('link', { name: 'Añadir pendiente' }).click();
    await page.getByLabel('Título').fill('Práctica 1');
    await page.getByLabel('Fecha de entrega (opcional)').fill(madridDate(-1));
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(bucket('Atrasadas').getByText('Práctica 1')).toBeVisible();
  });

  await test.step('al marcarla hecha pasa a Hechas', async () => {
    // click y no check(): la casilla desaparece de Atrasadas en cuanto se marca (es el criterio).
    await bucket('Atrasadas').getByRole('checkbox', { name: 'Práctica 1' }).click();
    await expect(page.getByText('Hechas (1)')).toBeVisible();
    await expect(bucket('Atrasadas')).toHaveCount(0);
  });

  await test.step('queda guardado en el servidor', async () => {
    await page.reload();
    await expect(page.getByText('Hechas (1)')).toBeVisible();
    await expect(bucket('Sin fecha').getByText('Leer tema 3')).toBeVisible();
  });

  await test.step('el panel cabe a lo ancho, sin desplazamiento horizontal', async () => {
    expect(await horizontalOverflow(page)).toBe(0);
  });
});
