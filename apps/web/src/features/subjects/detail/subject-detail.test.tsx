import { newTaskInput, normalizeSeed, type Mark, type Slot, type Task } from '@organizador/shared';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import seed from '../../../../../../data/calendario-2026-2027.seed.json';
import { createFakeBackend, subjectFixture } from '../../../test/fake-backend';
import { sentBodies } from '../../../test/mock-api';
import { renderApp } from '../../../test/render';

// Miercoles 21 oct 2026, 10:00 en Madrid.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-21T08:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const COURSE: Mark[] = normalizeSeed(seed).marks.map((mark, index) => ({
  ...mark,
  id: `m${index}`,
}));
const programacion = subjectFixture({
  id: 's-pro',
  name: 'Programación',
  shortName: 'PRO',
  teacher: 'Marta',
  links: {
    classroom: 'https://aula.example.com/pro',
    notebooklm: null,
    repo: 'https://git.example.com/pro',
  },
});
const bases = subjectFixture({ id: 's-bbdd', name: 'Bases de Datos', shortName: 'BBDD' });
const tutoria: Slot = {
  id: 'slot-pro',
  subjectId: 's-pro',
  kind: 'tutoria',
  recurrence: 'weekly',
  weekday: 2,
  intervalWeeks: 1,
  anchorDate: null,
  dates: null,
  startTime: '17:40',
  endTime: '19:25',
  location: null,
  meetingUrl: null,
  validFrom: null,
  validTo: null,
};
const task = (id: string, overrides: Partial<Task>): Task => ({
  ...newTaskInput(id),
  id,
  createdBy: 'u1',
  status: 'todo',
  doneAt: null,
  ...overrides,
});

const backend = (extra: Parameters<typeof createFakeBackend>[0] = {}) =>
  createFakeBackend({ subjects: [programacion, bases], slots: [tutoria], marks: COURSE, ...extra });

describe('detalle de asignatura', () => {
  it('cabecera con profesor/a y accesos rapidos, y una pestana por seccion', async () => {
    backend().install();
    renderApp('/asignaturas/s-pro');

    expect(await screen.findByRole('heading', { level: 1, name: 'Programación' })).toBeVisible();
    expect(screen.getByText('Profesor/a: Marta')).toBeVisible();
    expect(screen.getByRole('link', { name: /Aula virtual/ })).toHaveAttribute(
      'href',
      'https://aula.example.com/pro',
    );
    expect(screen.getByRole('link', { name: /Repositorio/ })).toHaveAttribute('target', '_blank');
    const tabs = within(screen.getByRole('navigation', { name: 'Secciones de la asignatura' }));
    expect(tabs.getAllByRole('link').map((link) => link.textContent)).toEqual([
      'Resumen',
      'Tareas',
      'Tutorías',
      'Notas',
      'Horario',
      'Ajustes',
    ]);
    expect(tabs.getByRole('link', { name: 'Resumen' })).toHaveAttribute('aria-current', 'page');
  });

  it('Resumen: proximas clases (sin las bloqueadas) y solo las tareas urgentes de la asignatura', async () => {
    backend({
      tasks: [
        task('Practica atrasada', { subjectId: 's-pro', dueDate: '2026-10-19' }),
        task('Para el mes que viene', { subjectId: 's-pro', dueDate: '2026-11-20' }),
        task('De otra asignatura', { subjectId: 's-bbdd', dueDate: '2026-10-19' }),
      ],
    }).install();
    renderApp('/asignaturas/s-pro');

    const upcoming = await screen.findByRole('region', { name: 'Próximas clases' });
    const rows = await within(upcoming).findAllByRole('link');
    // Martes 27 oct, 3 nov, 10 nov... (el 20 ya paso). Ninguno bloqueado en esas semanas.
    expect(rows[0]).toHaveTextContent('martes, 27 oct');
    expect(rows[0]).toHaveAttribute('href', '/?semana=2026-10-27&dia=2026-10-27');
    expect(rows).toHaveLength(6);

    const urgent = screen.getByRole('region', { name: 'Tareas urgentes' });
    expect(await within(urgent).findByText('Practica atrasada')).toBeVisible();
    expect(within(urgent).queryByText('Para el mes que viene')).toBeNull();
    expect(within(urgent).queryByText('De otra asignatura')).toBeNull();
  });

  it('Tareas: anadir desde la asignatura la deja elegida y vuelve a la pestana', async () => {
    const api = backend().install();
    const user = userEvent.setup();
    renderApp('/asignaturas/s-pro/tareas');

    await user.click(await screen.findByRole('link', { name: 'Añadir tarea' }));
    expect(await screen.findByLabelText('Asignatura')).toHaveValue('s-pro');
    await user.type(screen.getByLabelText('Título'), 'Ejercicios de herencia');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Programación' })).toBeVisible();
    expect(await screen.findByText('Ejercicios de herencia')).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/tasks')[0]).toMatchObject({ subjectId: 's-pro' });
  });

  it('Tutorias: proximas y pasadas, con sus notas, y se preparan desde aqui', async () => {
    backend({
      sessionRecords: [
        {
          slotId: 'slot-pro',
          date: '2026-10-20',
          topic: 'Herencia',
          questions: null,
          notes: 'Usar interfaces para los contratos.',
          recordingUrl: 'https://videos.example.com/t1',
        },
      ],
    }).install();
    const user = userEvent.setup();
    renderApp('/asignaturas/s-pro/tutorias');

    const past = await screen.findByRole('region', { name: 'Tutorías pasadas' });
    const lastOne = within(past).getAllByRole('listitem')[0]!;
    expect(lastOne).toHaveTextContent('martes, 20 oct');
    expect(within(lastOne).getByText('Tema: Herencia')).toBeVisible();
    expect(within(lastOne).getByText('Usar interfaces para los contratos.')).toBeVisible();
    expect(within(lastOne).getByRole('link', { name: /Grabación/ })).toBeVisible();

    const next = screen.getByRole('region', { name: 'Próximas tutorías' });
    const coming = within(next).getAllByRole('listitem')[0]!;
    expect(coming).toHaveTextContent('martes, 27 oct');
    await user.click(within(coming).getByRole('button', { name: 'Preparar y apuntar' }));
    expect(within(coming).getByLabelText('Tema')).toBeVisible();
  });

  it('Notas avisa de que llegan en M7; Ajustes archiva y recupera', async () => {
    const api = backend().install();
    const user = userEvent.setup();
    renderApp('/asignaturas/s-pro/notas');
    expect(await screen.findByText(/llegan en M7/)).toBeVisible();

    await user.click(screen.getByRole('link', { name: 'Ajustes' }));
    await user.click(await screen.findByRole('button', { name: 'Archivar asignatura' }));
    expect(await screen.findByText('Está archivada: no sale en el día a día.')).toBeVisible();
    expect(api.mock.calls.some(([url]) => String(url).endsWith('/s-pro/archive'))).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Recuperar del archivo' }));
    expect(await screen.findByRole('button', { name: 'Archivar asignatura' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Eliminar asignatura' })).toHaveAttribute(
      'href',
      '/asignaturas/s-pro/eliminar',
    );
  });

  it('una asignatura que no existe lo dice', async () => {
    backend().install();
    renderApp('/asignaturas/otra');
    expect(await screen.findByRole('alert')).toHaveTextContent('No se encuentra esta asignatura.');
  });
});
