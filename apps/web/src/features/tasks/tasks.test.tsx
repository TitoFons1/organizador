import { newTaskInput, type Slot, type Task } from '@organizador/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeBackend, subjectFixture } from '../../test/fake-backend';
import { sentBodies, type MockRequest } from '../../test/mock-api';
import { renderApp } from '../../test/render';

// Miercoles 14 oct 2026, 10:00 en Madrid: la semana va del 12 al 18.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-14T08:00:00Z'));
});
afterEach(() => vi.useRealTimers());

const programacion = subjectFixture({ id: 's-pro', name: 'Programación', shortName: 'PRO' });

const task = (id: string, overrides: Partial<Task> = {}): Task => ({
  ...newTaskInput(id),
  id,
  createdBy: 'u1',
  status: 'todo',
  doneAt: null,
  ...overrides,
});

const bucket = (name: string) => screen.getByRole('region', { name: new RegExp(`^${name}`) });

describe('pendientes en el panel', () => {
  it('CRITERIO DE M5: lo vencido sale en Atrasadas y al marcarlo cambia de grupo al instante', async () => {
    const backend = createFakeBackend({
      tasks: [
        task('Práctica 1', { dueDate: '2026-10-13' }),
        task('Leer tema 2', { dueDate: '2026-10-14' }),
        task('Entrega BBDD', { dueDate: '2026-10-16', dueTime: '23:59', priority: 'alta' }),
        task('Proyecto', { dueDate: '2026-11-02' }),
        task('Repasar'),
      ],
    });
    // El servidor no contesta hasta que lo soltemos: lo que se ve antes es la UI optimista.
    const key = 'PUT /api/v1/tasks/:id/progress';
    const original = backend.handlers[key];
    if (typeof original !== 'function') throw new Error('falta el handler');
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    backend.handlers[key] = async (request: MockRequest) => {
      await gate;
      return original(request);
    };
    const api = backend.install();
    const user = userEvent.setup();
    renderApp('/');

    const overdue = await screen.findByRole('region', { name: /^Atrasadas/ });
    expect(within(overdue).getByText('Venció el 13 oct')).toBeVisible();
    expect(within(bucket('Hoy')).getByText('Leer tema 2')).toBeVisible();
    const week = bucket('Esta semana');
    expect(within(week).getByText('viernes, 16 oct a las 23:59')).toBeVisible();
    expect(within(week).getByText('Prioridad alta')).toBeVisible();
    expect(within(bucket('Más adelante')).getByText('Proyecto')).toBeVisible();
    expect(within(bucket('Sin fecha')).getByText('Repasar')).toBeVisible();

    await user.click(within(overdue).getByRole('checkbox', { name: 'Práctica 1' }));

    // Sin esperar al servidor: ya no hay Atrasadas y aparece en Hechas.
    expect(await screen.findByText('Hechas (1)')).toBeVisible();
    expect(screen.queryByRole('region', { name: /^Atrasadas/ })).toBeNull();
    release();
    expect(await screen.findByText('Hechas (1)')).toBeVisible();
    expect(sentBodies(api, 'PUT', '/api/v1/tasks/Práctica 1/progress')).toEqual([
      { status: 'done' },
    ]);
  });

  it('sin nada pendiente lo dice', async () => {
    createFakeBackend().install();
    renderApp('/');
    expect(
      await screen.findByText('No tienes nada pendiente. Apunta lo próximo con el botón +.'),
    ).toBeVisible();
  });
});

describe('captura rapida', () => {
  it('apunta en una linea y queda en Sin fecha, sin asignatura', async () => {
    const api = createFakeBackend().install();
    const user = userEvent.setup();
    renderApp('/');

    await user.click(await screen.findByRole('button', { name: 'Apuntar un pendiente' }));
    await user.type(screen.getByLabelText('¿Qué tienes pendiente?'), 'Leer tema 3{Enter}');

    expect(await screen.findByText('Apuntado: Leer tema 3')).toBeVisible();
    expect(await within(bucket('Sin fecha')).findByText('Leer tema 3')).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/tasks')).toEqual([newTaskInput('Leer tema 3')]);
    expect(screen.getByLabelText('¿Qué tienes pendiente?')).toHaveValue('');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('ficha de un pendiente', () => {
  it('crea uno con asignatura, fecha y hora; la hora necesita fecha', async () => {
    const api = createFakeBackend({ subjects: [programacion] }).install();
    const user = userEvent.setup();
    renderApp('/pendientes/nueva');

    await user.type(await screen.findByLabelText('Título'), 'Entrega práctica 2');
    await user.selectOptions(screen.getByLabelText('Asignatura'), 'Programación');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'Entrega');
    fireEvent.change(screen.getByLabelText('Hora (opcional)'), { target: { value: '23:59' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Para poner hora hace falta una fecha.')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Fecha de entrega (opcional)'), {
      target: { value: '2026-10-16' },
    });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    const week = await screen.findByRole('region', { name: /^Esta semana/ });
    expect(within(week).getByText('Entrega práctica 2')).toBeVisible();
    expect(within(week).getByText('PRO')).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/tasks')[0]).toMatchObject({
      title: 'Entrega práctica 2',
      subjectId: 's-pro',
      type: 'entrega',
      dueDate: '2026-10-16',
      dueTime: '23:59',
      parentId: null,
    });
  });

  it('subtareas, mi estado y enviar a la papelera', async () => {
    const api = createFakeBackend({ tasks: [task('p', { title: 'Proyecto' })] }).install();
    const user = userEvent.setup();
    renderApp('/pendientes/p');

    expect(await screen.findByLabelText('Título')).toHaveValue('Proyecto');
    expect(screen.getByText('Sin subtareas.')).toBeVisible();
    await user.type(screen.getByLabelText('Nueva subtarea'), 'Memoria');
    await user.click(screen.getByRole('button', { name: 'Añadir' }));
    const subtask = await screen.findByRole('checkbox', { name: 'Memoria' });
    await user.click(subtask);
    expect(await screen.findByRole('checkbox', { name: 'Memoria' })).toBeChecked();

    await user.selectOptions(screen.getByLabelText('Mi estado'), 'En curso');
    expect(sentBodies(api, 'PUT', '/api/v1/tasks/p/progress')).toEqual([{ status: 'doing' }]);

    await user.click(screen.getByRole('button', { name: 'Enviar a la papelera' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Panel' })).toBeVisible();
    expect(screen.queryByText('Proyecto')).toBeNull();

    await user.click(screen.getAllByRole('link', { name: 'Más' })[0]!);
    await user.click(await screen.findByRole('link', { name: 'Papelera' }));
    expect(await screen.findByText('Proyecto')).toBeVisible();
    expect(screen.getByText('Tarea')).toBeVisible();
  });
});

describe('tutorias', () => {
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
    meetingUrl: 'https://meet.example.com/pro',
    validFrom: null,
    validTo: null,
  };

  it('"Unirme" aparece 15 minutos antes; se preparan tema y preguntas', async () => {
    // Martes 20 oct, 17:30 en Madrid (aun horario de verano, UTC+2).
    vi.setSystemTime(new Date('2026-10-20T15:30:00Z'));
    const api = createFakeBackend({ subjects: [programacion], slots: [tutoria] }).install();
    const user = userEvent.setup();
    renderApp('/?semana=2026-10-20');

    const tuesday = await screen.findByRole('listitem', { name: 'martes, 20 oct' });
    expect(within(tuesday).getByRole('link', { name: /Unirme/ })).toHaveAttribute(
      'href',
      'https://meet.example.com/pro',
    );

    await user.click(
      within(tuesday).getByRole('button', { name: 'Cambiar la clase de Programación del 20 oct' }),
    );
    await user.type(within(tuesday).getByLabelText('Tema'), 'Herencia');
    await user.type(
      within(tuesday).getByLabelText('Preguntas para la tutoría'),
      '¿Clase abstracta o interfaz?',
    );
    await user.click(within(tuesday).getByRole('button', { name: 'Guardar notas' }));

    expect(await within(tuesday).findByText('Notas guardadas.')).toBeVisible();
    expect(await within(tuesday).findByText('Tema: Herencia')).toBeVisible();
    expect(sentBodies(api, 'PUT', '/api/v1/session-records/slot-pro/2026-10-20')).toEqual([
      {
        topic: 'Herencia',
        questions: '¿Clase abstracta o interfaz?',
        notes: null,
        recordingUrl: null,
      },
    ]);
  });

  it('antes de los 15 minutos solo hay el enlace normal', async () => {
    vi.setSystemTime(new Date('2026-10-20T15:00:00Z')); // 17:00 en Madrid
    createFakeBackend({ subjects: [programacion], slots: [tutoria] }).install();
    renderApp('/?semana=2026-10-20');

    const tuesday = await screen.findByRole('listitem', { name: 'martes, 20 oct' });
    expect(within(tuesday).getByRole('link', { name: /Videollamada/ })).toBeVisible();
    expect(within(tuesday).queryByRole('link', { name: /Unirme/ })).toBeNull();
  });
});
