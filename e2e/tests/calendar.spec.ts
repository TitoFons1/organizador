import { expect, test, type Page } from '@playwright/test';
import { goTo, horizontalOverflow, registerNewUser } from './support';

const day = (page: Page, date: string) => page.locator(`[data-date="${date}"]`);
// Los radios del pincel estan ocultos (sr-only): se pulsa su etiqueta, como haria una persona.
const chooseBrush = (page: Page, name: string) => page.locator('label', { hasText: name }).click();

// Criterio de "hecho" de M3 (docs/02, seccion 6): el calendario 2026-27 cargado y editable.
test('cargar el calendario 2026-27, pintar un festivo y editarlo', async ({ page }, testInfo) => {
  await registerNewUser(page, testInfo);
  await goTo(page, 'Calendario');

  await test.step('cargar el calendario del curso', async () => {
    await page.getByRole('button', { name: 'Cargar calendario 2026-27' }).click();
    await expect(page.getByText('Añadidas 18 marcas y 2 cuatrimestres.')).toBeVisible();
    await expect(day(page, '2026-10-12')).toHaveAccessibleName(/Festivo \(Pilar\)/);
    await expect(day(page, '2027-02-03')).toHaveAccessibleName(/Examenes 1er cuatrimestre/);
    await expect(page.getByText('Datos por completar')).toHaveCount(0);
  });

  await test.step('pintar un festivo local de un dia con el pincel', async () => {
    await chooseBrush(page, 'Festivo local');
    await expect(page.getByRole('radio', { name: 'Festivo local' })).toBeChecked();
    await day(page, '2026-11-20').click();
    await day(page, '2026-11-20').click();
    await expect(page.getByRole('status')).toHaveText(
      'Añadido: Festivo local, el 20 de noviembre de 2026.',
    );
    await chooseBrush(page, 'Sin pincel');
  });

  await test.step('editar la marca desde el dia', async () => {
    await day(page, '2026-11-20').click();
    const panel = page.getByRole('region', { name: /Marcas del viernes, 20 de noviembre/ });
    await panel.getByRole('button', { name: 'Editar Festivo local' }).click();
    await page.getByLabel('Descripción').fill('Fiesta del barrio');
    await page.getByRole('button', { name: 'Guardar' }).click();
    await expect(panel.getByText('Fiesta del barrio')).toBeVisible();
  });

  await test.step('los cambios estan guardados en el servidor', async () => {
    await page.reload();
    await expect(day(page, '2026-11-20')).toHaveAccessibleName(/Fiesta del barrio/);
  });

  await test.step('los 12 meses caben a lo ancho, sin desplazamiento horizontal', async () => {
    expect(await horizontalOverflow(page)).toBe(0);
  });
});
