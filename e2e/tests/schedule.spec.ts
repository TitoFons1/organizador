import { expect, test, type Page } from '@playwright/test';
import { goTo, horizontalOverflow, openClass, openDay, registerNewUser } from './support';

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
    const monday = await openDay(page, testInfo, 'lunes, 12 oct');
    await expect(monday.getByText('Festivo (Pilar)').first()).toBeVisible();
    const tuesday = await openDay(page, testInfo, 'martes, 13 oct');
    await expect(tuesday.getByText('Festivo Zaragoza').first()).toBeVisible();
    const wednesday = await openDay(page, testInfo, 'miércoles, 14 oct');
    await expect(wednesday.getByText('Festivo Zaragoza')).toBeVisible();
    const thursday = await openDay(page, testInfo, 'jueves, 15 oct');
    await expect(thursday).toContainText('Programación');
    await expect(thursday).toContainText('16:00');
  });

  await test.step('cancelar la tutoria del 20 oct', async () => {
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    const card = await openClass(page, testInfo, 'martes, 20 oct', 'Programación');
    await expect(card.getByRole('link', { name: /Videollamada/ })).toBeVisible();
    await card.getByRole('button', { name: 'Cambiar la clase de Programación del 20 oct' }).click();
    await card.getByLabel('Motivo (opcional)').fill('Huelga');
    await card.getByRole('button', { name: 'Cancelar esta clase' }).click();
    await expect(page.getByText('Cancelada · Huelga')).toBeVisible();
  });

  await test.step('el cambio esta guardado en el servidor', async () => {
    await page.reload();
    const tuesday = await openDay(page, testInfo, 'martes, 20 oct');
    // En movil se ve el motivo; en escritorio, el bloque dice que esta cancelada.
    await expect(
      tuesday
        .getByText('Cancelada · Huelga')
        .or(tuesday.getByRole('button', { name: 'Programación, 17:40–19:25, cancelada' })),
    ).toBeVisible();
  });

  await test.step('la semana cabe a lo ancho, sin desplazamiento horizontal', async () => {
    expect(await horizontalOverflow(page)).toBe(0);
  });
});
