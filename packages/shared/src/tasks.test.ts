import { describe, expect, it } from 'vitest';
import { nowCivil } from './civil-date';
import { isJoinable, minutesOf } from './schedule-engine';
import {
  classifyTasks,
  newTaskInput,
  subtaskProgress,
  taskBucket,
  taskInputSchema,
  type Task,
} from './tasks';

let nextId = 1;
const task = (overrides: Partial<Task> = {}): Task => ({
  ...newTaskInput('Tarea'),
  id: `t${nextId++}`,
  createdBy: 'ana',
  status: 'todo',
  doneAt: null,
  ...overrides,
});

// Miercoles 14 oct 2026: la semana va del lunes 12 al domingo 18.
const TODAY = '2026-10-14';

describe('taskBucket', () => {
  it('Atrasadas, Hoy, Esta semana (hasta el domingo), Mas adelante y Sin fecha', () => {
    expect(taskBucket({ dueDate: '2026-10-13', status: 'todo' }, TODAY)).toBe('overdue');
    expect(taskBucket({ dueDate: '2025-01-01', status: 'doing' }, TODAY)).toBe('overdue');
    expect(taskBucket({ dueDate: TODAY, status: 'todo' }, TODAY)).toBe('today');
    expect(taskBucket({ dueDate: '2026-10-15', status: 'todo' }, TODAY)).toBe('week');
    expect(taskBucket({ dueDate: '2026-10-18', status: 'todo' }, TODAY)).toBe('week');
    expect(taskBucket({ dueDate: '2026-10-19', status: 'todo' }, TODAY)).toBe('later');
    expect(taskBucket({ dueDate: null, status: 'todo' }, TODAY)).toBe('noDate');
  });

  it('lo hecho sale de su grupo aunque este vencido', () => {
    expect(taskBucket({ dueDate: '2026-10-01', status: 'done' }, TODAY)).toBe('done');
    expect(taskBucket({ dueDate: null, status: 'done' }, TODAY)).toBe('done');
  });

  it('en domingo "Esta semana" queda vacia: el lunes ya es "Mas adelante"', () => {
    expect(taskBucket({ dueDate: '2026-10-19', status: 'todo' }, '2026-10-18')).toBe('later');
  });
});

describe('classifyTasks', () => {
  it('reparte, ordena por fecha, hora, prioridad y titulo, y deja fuera las subtareas', () => {
    const parent = task({ title: 'Practica 2', dueDate: '2026-10-16' });
    const tasks = [
      task({ title: 'B baja', dueDate: '2026-10-16', priority: 'baja' }),
      parent,
      task({ title: 'Subtarea', parentId: parent.id, dueDate: '2026-10-16' }),
      task({ title: 'A alta', dueDate: '2026-10-16', priority: 'alta' }),
      task({ title: 'Con hora', dueDate: '2026-10-16', dueTime: '09:00', priority: 'baja' }),
      task({ title: 'Ayer', dueDate: '2026-10-13' }),
      task({ title: 'Sin fecha' }),
      task({ title: 'Hecha antes', status: 'done', doneAt: '2026-10-10T10:00:00.000Z' }),
      task({ title: 'Hecha despues', status: 'done', doneAt: '2026-10-12T10:00:00.000Z' }),
      task({ title: 'Hecha sin fecha', status: 'done' }),
    ];
    const buckets = classifyTasks(tasks, TODAY);
    const titles = (bucket: keyof typeof buckets) => buckets[bucket].map((t) => t.title);

    expect(titles('overdue')).toEqual(['Ayer']);
    expect(titles('today')).toEqual([]);
    expect(titles('week')).toEqual(['Con hora', 'A alta', 'Practica 2', 'B baja']);
    expect(titles('noDate')).toEqual(['Sin fecha']);
    expect(titles('done')).toEqual(['Hecha despues', 'Hecha antes', 'Hecha sin fecha']);
  });

  it('cuenta las subtareas hechas de cada tarea', () => {
    const tasks = [
      task({ id: 'p', title: 'Madre' }),
      task({ parentId: 'p', status: 'done' }),
      task({ parentId: 'p' }),
      task({ parentId: 'otra', status: 'done' }),
    ];
    expect(subtaskProgress(tasks, 'p')).toEqual({ done: 1, total: 2 });
    expect(subtaskProgress(tasks, 'nadie')).toEqual({ done: 0, total: 0 });
  });
});

describe('taskInputSchema', () => {
  it('acepta lo que crea la captura rapida y rechaza una hora sin fecha', () => {
    expect(taskInputSchema.safeParse(newTaskInput('Leer tema 3')).success).toBe(true);
    expect(taskInputSchema.safeParse(newTaskInput('x', { dueTime: '10:00' })).success).toBe(false);
    expect(
      taskInputSchema.safeParse(newTaskInput('x', { dueDate: '2026-10-16', dueTime: '10:00' }))
        .success,
    ).toBe(true);
  });

  it('rechaza titulos vacios, fechas mal escritas y estimaciones absurdas', () => {
    for (const bad of [
      { title: '   ' },
      { dueDate: '2026-02-30' },
      { estimateMin: 0 },
      { estimateMin: 100_000 },
      { type: 'fiesta' as never },
    ]) {
      expect(taskInputSchema.safeParse(newTaskInput('x', bad)).success, JSON.stringify(bad)).toBe(
        false,
      );
    }
  });
});

describe('Unirme a una tutoria', () => {
  const tutoria = {
    date: '2026-10-20',
    start: '17:40',
    end: '19:25',
    status: 'scheduled',
  } as const;

  it('se ofrece desde 15 minutos antes hasta que termina, solo ese dia', () => {
    const at = (time: string, date = '2026-10-20') => isJoinable(tutoria, { date, time });
    expect(at('17:24')).toBe(false);
    expect(at('17:25')).toBe(true);
    expect(at('18:30')).toBe(true);
    expect(at('19:24')).toBe(true);
    expect(at('19:25')).toBe(false);
    expect(at('17:30', '2026-10-21')).toBe(false);
  });

  it('no en una clase cancelada o bloqueada', () => {
    const now = { date: '2026-10-20', time: '17:45' };
    expect(isJoinable({ ...tutoria, status: 'cancelled' }, now)).toBe(false);
    expect(isJoinable({ ...tutoria, status: 'blocked' }, now)).toBe(false);
  });

  it('nowCivil da la fecha y la hora de Madrid, tambien en los cambios de hora', () => {
    // 25 oct 2026, 00:30 UTC = 02:30 en Madrid (aun en verano, UTC+2).
    expect(nowCivil(new Date('2026-10-25T00:30:00Z'))).toEqual({
      date: '2026-10-25',
      time: '02:30',
    });
    // 25 oct 2026, 02:30 UTC = 03:30 en Madrid (ya en invierno, UTC+1).
    expect(nowCivil(new Date('2026-10-25T02:30:00Z'))).toEqual({
      date: '2026-10-25',
      time: '03:30',
    });
    // A las 23:30 en Madrid sigue siendo "hoy" aunque en UTC ya no.
    expect(nowCivil(new Date('2026-10-20T22:30:00Z'))).toEqual({
      date: '2026-10-21',
      time: '00:30',
    });
    expect(minutesOf('17:40')).toBe(1060);
  });
});
