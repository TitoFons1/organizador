import { expect, test } from '@playwright/test';
import { goTo, horizontalOverflow, registerNewUser } from './support';

const SUBJECTS = [
  'Programación',
  'Bases de Datos',
  'Sistemas Informáticos',
  'Entornos de Desarrollo',
  'Lenguajes de Marcas',
  'Sostenibilidad',
];

const subjectHeading = (name?: string) =>
  name === undefined ? { level: 2 } : { level: 2, name, exact: true };

// Criterio de "hecho" de M2 (docs/02, seccion 6), en movil y en escritorio.
test('crear 6 asignaturas, archivar una, borrar otra y restaurarla desde la papelera', async ({
  page,
}, testInfo) => {
  await registerNewUser(page, testInfo);
  await goTo(page, 'Asignaturas');

  await test.step('crear 6 asignaturas', async () => {
    for (const [index, name] of SUBJECTS.entries()) {
      const add = index === 0 ? 'Añadir la primera' : 'Añadir asignatura';
      await page.getByRole('link', { name: add }).click();
      await page.getByLabel('Nombre').fill(name);
      await page.getByRole('button', { name: 'Guardar' }).click();
      await expect(page.getByRole('heading', subjectHeading(name))).toBeVisible();
    }
    await expect(page.getByRole('heading', subjectHeading())).toHaveCount(6);
  });

  await test.step('archivar una', async () => {
    await page.getByRole('button', { name: 'Archivar Lenguajes de Marcas' }).click();
    await expect(page.getByText('Archivadas (1)')).toBeVisible();
    await expect(page.getByRole('heading', subjectHeading())).toHaveCount(5);
  });

  await test.step('borrar otra con doble confirmacion', async () => {
    // Es la ultima tarjeta: en movil el clic falla si la barra inferior tapa sus botones.
    await page.getByRole('link', { name: 'Eliminar Sostenibilidad' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Para confirmar, escribe «Sostenibilidad»').fill('Sostenibilidad');
    await page.getByRole('button', { name: 'Enviar a la papelera' }).click();

    await expect(page).toHaveURL('/asignaturas');
    await expect(page.getByRole('heading', subjectHeading('Sostenibilidad'))).toHaveCount(0);
  });

  await test.step('restaurarla desde la papelera', async () => {
    await goTo(page, 'Más');
    await page.getByRole('link', { name: 'Papelera' }).click();
    await page.getByRole('button', { name: 'Restaurar Sostenibilidad' }).click();
    await expect(page.getByText('La papelera está vacía.')).toBeVisible();

    await goTo(page, 'Asignaturas');
    await expect(page.getByRole('heading', subjectHeading('Sostenibilidad'))).toBeVisible();
  });

  await test.step('los cambios estan guardados en el servidor', async () => {
    await page.reload();
    await expect(page.getByRole('heading', subjectHeading())).toHaveCount(5);
    await expect(page.getByText('Archivadas (1)')).toBeVisible();
  });

  await test.step('la lista cabe a lo ancho, sin desplazamiento horizontal', async () => {
    expect(await horizontalOverflow(page)).toBe(0);
  });
});
