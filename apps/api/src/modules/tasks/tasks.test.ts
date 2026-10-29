import {
  EMPTY_SUBJECT_LINKS,
  newTaskInput,
  subjectSchema,
  taskListResponseSchema,
  taskSchema,
  trashListResponseSchema,
  type TaskInput,
} from '@organizador/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { task } from '../../db/schema';
import {
  ANA,
  BEA,
  call,
  createTestContext,
  joinWorkspaceOf,
  signUp,
  whoAmI,
  type Credentials,
  type TestContext,
} from '../../test/helpers';
import { purgeExpiredTrash } from '../trash/trash';

const CARLA: Credentials = {
  name: 'Carla',
  email: 'carla@example.com',
  password: 'contrasena-de-carla',
};

let context: TestContext;
let ana: string;
let bea: string;
let carla: string;

beforeAll(async () => {
  context = await createTestContext();
  ana = (await signUp(context, ANA)).cookie;
  bea = (await signUp(context, BEA)).cookie;
  carla = (await signUp(context, CARLA)).cookie;
  // Ana y Bea comparten el espacio de Ana (lo que en M7 sera un grupo); Carla va por libre.
  await joinWorkspaceOf(context, ana, bea);
});
afterAll(() => context.close());

async function createSubject(cookie: string, name: string) {
  const response = await call(context, 'POST', '/api/v1/subjects', cookie, {
    name,
    shortName: null,
    color: 'blue',
    teacher: null,
    links: EMPTY_SUBJECT_LINKS,
  });
  return subjectSchema.parse(response.json());
}

async function createTask(cookie: string, input: TaskInput) {
  const response = await call(context, 'POST', '/api/v1/tasks', cookie, input);
  expect(response.statusCode, response.body).toBe(201);
  return taskSchema.parse(response.json());
}

async function tasksOf(cookie: string) {
  const response = await call(context, 'GET', '/api/v1/tasks', cookie);
  expect(response.statusCode).toBe(200);
  return taskListResponseSchema.parse(response.json()).tasks;
}

const progress = (cookie: string, id: string, status: string) =>
  call(context, 'PUT', `/api/v1/tasks/${id}/progress`, cookie, { status });

async function trashOf(cookie: string) {
  const response = await call(context, 'GET', '/api/v1/trash', cookie);
  return trashListResponseSchema.parse(response.json()).items;
}

describe('pendientes', () => {
  it('la captura rapida crea una tarea sin asignatura ni fecha, por hacer', async () => {
    const created = await createTask(carla, newTaskInput('Leer tema 3'));
    const me = await whoAmI(context, carla);
    expect(created).toMatchObject({
      title: 'Leer tema 3',
      subjectId: null,
      dueDate: null,
      status: 'todo',
      doneAt: null,
      createdBy: me.user.id,
    });
    expect(await tasksOf(carla)).toEqual([created]);
  });

  it('la asignatura tiene que existir en el espacio', async () => {
    const response = await call(
      context,
      'POST',
      '/api/v1/tasks',
      carla,
      newTaskInput('x', { subjectId: 'no-existe' }),
    );
    expect(response.statusCode).toBe(404);
  });

  it('las subtareas heredan asignatura y visibilidad, y no se anidan', async () => {
    const subject = await createSubject(carla, 'BBDD');
    const mother = await createTask(
      carla,
      newTaskInput('Práctica 2', { subjectId: subject.id, visibility: 'personal' }),
    );
    const child = await createTask(carla, newTaskInput('Diagrama E/R', { parentId: mother.id }));
    expect(child).toMatchObject({ subjectId: subject.id, visibility: 'personal' });

    const nested = await call(
      context,
      'POST',
      '/api/v1/tasks',
      carla,
      newTaskInput('Nieta', { parentId: child.id }),
    );
    expect(nested.statusCode).toBe(400);
    expect(nested.json()).toMatchObject({ code: 'NESTED_SUBTASK' });

    // Si la madre cambia de asignatura, sus subtareas la siguen.
    const other = await createSubject(carla, 'Programación');
    await call(context, 'PATCH', `/api/v1/tasks/${mother.id}`, carla, { subjectId: other.id });
    expect((await tasksOf(carla)).find((t) => t.id === child.id)?.subjectId).toBe(other.id);
  });

  it('el PATCH comprueba el resultado: una hora de entrega necesita fecha', async () => {
    const created = await createTask(
      carla,
      newTaskInput('Entrega', { dueDate: '2026-10-23', dueTime: '23:59' }),
    );
    const response = await call(context, 'PATCH', `/api/v1/tasks/${created.id}`, carla, {
      dueDate: null,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'TIME_WITHOUT_DATE' });

    const fixed = await call(context, 'PATCH', `/api/v1/tasks/${created.id}`, carla, {
      dueDate: null,
      dueTime: null,
      priority: 'alta',
    });
    expect(taskSchema.parse(fixed.json())).toMatchObject({ dueDate: null, priority: 'alta' });
  });

  it('marcar hecha guarda cuando; volver a por hacer la borra', async () => {
    const created = await createTask(carla, newTaskInput('Repasar'));
    const done = taskSchema.parse((await progress(carla, created.id, 'done')).json());
    expect(done.status).toBe('done');
    expect(done.doneAt).not.toBeNull();
    expect((await tasksOf(carla)).find((t) => t.id === created.id)?.status).toBe('done');

    const undone = taskSchema.parse((await progress(carla, created.id, 'todo')).json());
    expect(undone).toMatchObject({ status: 'todo', doneAt: null });
  });

  it('borrar manda la tarea (con sus subtareas) a la papelera; se restaura y se purga', async () => {
    const mother = await createTask(carla, newTaskInput('Proyecto'));
    const child = await createTask(carla, newTaskInput('Memoria', { parentId: mother.id }));

    expect((await call(context, 'DELETE', `/api/v1/tasks/${mother.id}`, carla)).statusCode).toBe(
      204,
    );
    const ids = (await tasksOf(carla)).map((t) => t.id);
    expect(ids).not.toContain(mother.id);
    expect(ids).not.toContain(child.id);
    expect((await trashOf(carla)).map((i) => [i.entity, i.name])).toContainEqual([
      'task',
      'Proyecto',
    ]);

    await call(context, 'POST', `/api/v1/trash/task/${mother.id}/restore`, carla);
    expect((await tasksOf(carla)).map((t) => t.id)).toEqual(
      expect.arrayContaining([mother.id, child.id]),
    );

    await call(context, 'DELETE', `/api/v1/tasks/${mother.id}`, carla);
    await purgeExpiredTrash(context.database, new Date(Date.now() + 31 * 24 * 60 * 60 * 1000));
    const rows = await context.database.db.select({ id: task.id }).from(task);
    // La purga borra la tarea y, en cascada, sus subtareas.
    expect(rows.map((r) => r.id)).not.toContain(mother.id);
    expect(rows.map((r) => r.id)).not.toContain(child.id);
  });

  it('las tareas de una asignatura en la papelera se ocultan y cuentan en el impacto', async () => {
    const subject = await createSubject(carla, 'Sistemas');
    const created = await createTask(
      carla,
      newTaskInput('Instalar Linux', { subjectId: subject.id }),
    );
    await createTask(carla, newTaskInput('Particiones', { parentId: created.id }));

    const impact = await call(context, 'GET', `/api/v1/subjects/${subject.id}/impact`, carla);
    expect(impact.json()).toMatchObject({ tasks: 1 }); // solo las principales

    await call(context, 'DELETE', `/api/v1/subjects/${subject.id}`, carla, {
      confirmName: 'Sistemas',
    });
    expect((await tasksOf(carla)).some((t) => t.id === created.id)).toBe(false);
    await call(context, 'POST', `/api/v1/trash/subject/${subject.id}/restore`, carla);
    expect((await tasksOf(carla)).some((t) => t.id === created.id)).toBe(true);
  });
});

describe('en un espacio compartido (grupo)', () => {
  it('las tareas del grupo las ven las dos; las personales, solo su autora', async () => {
    const shared = await createTask(ana, newTaskInput('Práctica en grupo'));
    const mine = await createTask(ana, newTaskInput('Nota personal', { visibility: 'personal' }));

    const seenByBea = (await tasksOf(bea)).map((t) => t.id);
    expect(seenByBea).toContain(shared.id);
    expect(seenByBea).not.toContain(mine.id);

    for (const [method, url, payload] of [
      ['PATCH', `/api/v1/tasks/${mine.id}`, { title: 'Hackeada' }],
      ['DELETE', `/api/v1/tasks/${mine.id}`, undefined],
      ['PUT', `/api/v1/tasks/${mine.id}/progress`, { status: 'done' }],
      ['POST', '/api/v1/tasks', newTaskInput('Hija', { parentId: mine.id })],
    ] as const) {
      const response = await call(context, method, url, bea, payload);
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }
    expect((await tasksOf(ana)).find((t) => t.id === mine.id)?.title).toBe('Nota personal');
  });

  it('cada una marca su propio estado en la misma tarea', async () => {
    const shared = await createTask(ana, newTaskInput('Estudiar para el examen'));
    await progress(ana, shared.id, 'done');
    await progress(bea, shared.id, 'doing');

    expect((await tasksOf(ana)).find((t) => t.id === shared.id)?.status).toBe('done');
    expect((await tasksOf(bea)).find((t) => t.id === shared.id)?.status).toBe('doing');
  });

  it('cualquiera edita una tarea del grupo, pero solo su autora decide quien la ve', async () => {
    const shared = await createTask(ana, newTaskInput('Repartir apartados'));
    const edited = await call(context, 'PATCH', `/api/v1/tasks/${shared.id}`, bea, {
      title: 'Repartir apartados (hecho el reparto)',
    });
    expect(edited.statusCode).toBe(200);

    const hidden = await call(context, 'PATCH', `/api/v1/tasks/${shared.id}`, bea, {
      visibility: 'personal',
    });
    expect(hidden.statusCode).toBe(403);
    expect(hidden.json()).toMatchObject({ code: 'NOT_TASK_OWNER' });
  });

  it('una tarea personal borrada no aparece en la papelera de la otra', async () => {
    const mine = await createTask(ana, newTaskInput('Diario', { visibility: 'personal' }));
    await call(context, 'DELETE', `/api/v1/tasks/${mine.id}`, ana);

    expect((await trashOf(ana)).some((i) => i.id === mine.id)).toBe(true);
    expect((await trashOf(bea)).some((i) => i.id === mine.id)).toBe(false);
    const attempt = await call(context, 'POST', `/api/v1/trash/task/${mine.id}/restore`, bea);
    expect(attempt.statusCode).toBe(404);
  });
});

describe('acceso cruzado entre espacios', () => {
  it('Carla no ve ni toca nada del espacio de Ana', async () => {
    const shared = await createTask(ana, newTaskInput('Del grupo de Ana'));
    expect((await tasksOf(carla)).some((t) => t.id === shared.id)).toBe(false);
    for (const [method, url, payload] of [
      ['PATCH', `/api/v1/tasks/${shared.id}`, { title: 'x' }],
      ['DELETE', `/api/v1/tasks/${shared.id}`, undefined],
      ['PUT', `/api/v1/tasks/${shared.id}/progress`, { status: 'done' }],
      ['POST', `/api/v1/trash/task/${shared.id}/restore`, undefined],
    ] as const) {
      const response = await call(context, method, url, carla, payload);
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }
  });

  it('todas las rutas exigen sesion', async () => {
    for (const [method, url, payload] of [
      ['GET', '/api/v1/tasks', undefined],
      ['POST', '/api/v1/tasks', newTaskInput('x')],
      ['PATCH', '/api/v1/tasks/x', { title: 'x' }],
      ['DELETE', '/api/v1/tasks/x', undefined],
      ['PUT', '/api/v1/tasks/x/progress', { status: 'done' }],
    ] as const) {
      const response = await call(context, method, url, undefined, payload);
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});
