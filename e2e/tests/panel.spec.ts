import { expect, test, type APIRequestContext } from '@playwright/test';
import { horizontalOverflow, registerNewUser } from './support';

/** Fecha civil de Madrid desplazada `days` dias desde hoy (AAAA-MM-DD). */
const madridDate = (days: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(
    new Date(Date.now() + days * 24 * 60 * 60 * 1000),
  );

/** Un curso de ejemplo creado por la API (mas rapido que por la interfaz, ya probada en M2-M5). */
async function seedCourse(api: APIRequestContext) {
  const links = { classroom: 'https://aula.example.com', notebooklm: null, repo: null };
  const subject = async (name: string, shortName: string, color: string) => {
    const response = await api.post('/api/v1/subjects', {
      data: { name, shortName, color, teacher: 'Marta', links },
    });
    expect(response.ok()).toBe(true);
    return ((await response.json()) as { id: string }).id;
  };
  const pro = await subject('Programación', 'PRO', 'violet');
  const bbdd = await subject('Bases de Datos', 'BBDD', 'green');
  const slot = (subjectId: string, weekday: number, startTime: string, endTime: string) =>
    api.post('/api/v1/slots', {
      data: {
        subjectId,
        kind: subjectId === pro ? 'tutoria' : 'clase',
        recurrence: 'weekly',
        weekday,
        intervalWeeks: 1,
        anchorDate: null,
        dates: null,
        startTime,
        endTime,
        location: null,
        meetingUrl: 'https://meet.example.com/x',
        validFrom: null,
        validTo: null,
      },
    });
  for (const weekday of [1, 2, 3, 4, 5]) {
    await slot(weekday % 2 ? bbdd : pro, weekday, '16:00', '17:30');
    await slot(weekday % 2 ? pro : bbdd, weekday, '18:00', '19:30');
  }
  await api.post('/api/v1/calendar/import-seed');
  const task = (title: string, dueDate: string | null, subjectId: string | null) =>
    api.post('/api/v1/tasks', {
      data: {
        subjectId,
        parentId: null,
        visibility: 'workspace',
        title,
        description: null,
        type: 'otro',
        dueDate,
        dueTime: null,
        priority: 'media',
        estimateMin: null,
      },
    });
  await task('Práctica atrasada de BBDD', madridDate(-2), bbdd);
  await task('Leer el tema 2', madridDate(0), pro);
  await task('Entrega del proyecto', madridDate(1), pro);
  await task('Repasar SQL', madridDate(10), bbdd);
  await task('Buscar empresa de FCT', null, null);
  return pro;
}

// Criterio de "hecho" de M6 (docs/02, seccion 6).
test('el panel cabe en el movil y en 1280 px se ven semana y pendientes sin scroll', async ({
  page,
}, testInfo) => {
  await registerNewUser(page, testInfo);
  const pro = await seedCourse(page.request);

  await test.step('el panel muestra la semana y los pendientes', async () => {
    await page.goto('/');
    const tasks = page.getByRole('region', { name: 'Pendientes' });
    await expect(tasks.getByText('Leer el tema 2')).toBeVisible();
    await expect(page.getByRole('region', { name: 'Semana', exact: true })).toBeVisible();
  });

  if (testInfo.project.name === 'escritorio') {
    await test.step('a 1280x720, semana y columnas de pendientes sin hacer scroll', async () => {
      expect(page.viewportSize()).toEqual({ width: 1280, height: 720 });
      await expect(page.getByRole('region', { name: 'Semana', exact: true })).toBeInViewport({
        ratio: 1,
      });
      for (const column of ['Atrasadas', 'Hoy', 'Esta semana', 'Más adelante']) {
        await expect(
          page.getByRole('region', { name: new RegExp(`^${column} \\(`) }),
        ).toBeInViewport();
      }
      await expect(
        page.getByRole('checkbox', { name: 'Práctica atrasada de BBDD' }),
      ).toBeInViewport();
    });
  }

  await test.step('ninguna pantalla se sale a lo ancho', async () => {
    const paths = [
      '/',
      '/calendario',
      '/asignaturas',
      `/asignaturas/${pro}`,
      `/asignaturas/${pro}/tareas`,
      `/asignaturas/${pro}/tutorias`,
      `/asignaturas/${pro}/horario`,
      `/asignaturas/${pro}/ajustes`,
      '/pendientes/nueva',
      '/papelera',
      '/mas',
    ];
    for (const path of paths) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.waitForLoadState('networkidle');
      expect(await horizontalOverflow(page), path).toBe(0);
    }
  });
});
