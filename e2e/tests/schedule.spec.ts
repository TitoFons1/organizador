import { expect, test, type Page } from '@playwright/test';
import { goTo, horizontalOverflow, registerNewUser } from './support';

async function createSubject(page: Page, name: string, first: boolean) {
  await goTo(page, 'Asignaturas');
  await page.getByRole('link', { name: first ? 'Añadir la primera' : 'Añadir asignatura' }).click();
  await page.getByLabel('Nombre').fill(name);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
}

interface SlotData {
  kind?: 'Clase' | 'Tutoría';
  day: string;
  start: string;
  end: string;
  meetingUrl?: string;
}

async function addSlot(page: Page, subject: string, slot: SlotData) {
  await goTo(page, 'Asignaturas');
  await page.getByRole('link', { name: `Horario de ${subject}` }).click();
  await page.getByRole('button', { name: 'Añadir franja' }).click();
  if (slot.kind) await page.getByLabel('Tipo').selectOption({ label: slot.kind });
  await page.getByLabel('Día').selectOption({ label: slot.day });
  await page.getByLabel('Empieza').fill(slot.start);
  await page.getByLabel('Termina').fill(slot.end);
  if (slot.meetingUrl)
    await page.getByLabel('Enlace de videollamada (opcional)').fill(slot.meetingUrl);
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText(`${slot.day} · ${slot.start}–${slot.end}`)).toBeVisible();
}

const day = (page: Page, name: string) => page.getByRole('listitem', { name });

// Criterio de "hecho" de M4 (docs/02, seccion 6).
test('la semana del 12 oct muestra los festivos; una clase se cancela y se recuerda', async ({
  page,
}, testInfo) => {
  await registerNewUser(page, testInfo);

  await test.step('asignaturas, franjas y calendario desde la interfaz', async () => {
    await createSubject(page, 'Bases de Datos', true);
    await createSubject(page, 'Programación', false);
    await addSlot(page, 'Bases de Datos', { day: 'lunes', start: '16:00', end: '18:00' });
    await addSlot(page, 'Programación', {
      kind: 'Tutoría',
      day: 'martes',
      start: '17:40',
      end: '19:25',
      meetingUrl: 'https://meet.example.com/pro',
    });
    await addSlot(page, 'Programación', { day: 'jueves', start: '16:00', end: '17:00' });

    await goTo(page, 'Calendario');
    await page.getByRole('button', { name: 'Cargar calendario 2026-27' }).click();
    await expect(page.getByText('Añadidas 18 marcas y 2 cuatrimestres.')).toBeVisible();
  });

  await test.step('semana del 12 oct: 12-14 festivos y el jueves con clase', async () => {
    await page.goto('/?semana=2026-10-12');
    await expect(day(page, 'lunes, 12 oct').getByText('Festivo (Pilar)').first()).toBeVisible();
    await expect(day(page, 'martes, 13 oct').getByText('Festivo Zaragoza').first()).toBeVisible();
    await expect(day(page, 'miércoles, 14 oct').getByText('Festivo Zaragoza')).toBeVisible();
    const thursday = day(page, 'jueves, 15 oct');
    await expect(thursday).toContainText('Programación');
    await expect(thursday.getByText('16:00–17:00')).toBeVisible();
  });

  await test.step('cancelar la tutoria del 20 oct', async () => {
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    const tuesday = day(page, 'martes, 20 oct');
    await expect(tuesday.getByRole('link', { name: /Videollamada/ })).toBeVisible();
    await tuesday
      .getByRole('button', { name: 'Cambiar la clase de Programación del 20 oct' })
      .click();
    await tuesday.getByLabel('Motivo (opcional)').fill('Huelga');
    await tuesday.getByRole('button', { name: 'Cancelar esta clase' }).click();
    await expect(tuesday.getByText('Cancelada · Huelga')).toBeVisible();
  });

  await test.step('el cambio esta guardado en el servidor', async () => {
    await page.reload();
    await expect(day(page, 'martes, 20 oct').getByText('Cancelada · Huelga')).toBeVisible();
  });

  await test.step('la semana cabe a lo ancho, sin desplazamiento horizontal', async () => {
    expect(await horizontalOverflow(page)).toBe(0);
  });
});
