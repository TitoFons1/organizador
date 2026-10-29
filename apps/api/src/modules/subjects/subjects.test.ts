import {
  EMPTY_SUBJECT_LINKS,
  subjectImpactSchema,
  subjectListResponseSchema,
  subjectSchema,
  trashListResponseSchema,
  type SubjectInput,
} from '@organizador/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { subject } from '../../db/schema';
import { ANA, BEA, call, createTestContext, signUp, type TestContext } from '../../test/helpers';
import { purgeExpiredTrash } from '../trash/trash';

const input = (overrides: Partial<SubjectInput> = {}): SubjectInput => ({
  name: 'Programación',
  shortName: null,
  color: 'blue',
  teacher: null,
  links: EMPTY_SUBJECT_LINKS,
  ...overrides,
});

let context: TestContext;
let ana: string;
let bea: string;

beforeAll(async () => {
  context = await createTestContext();
  ana = (await signUp(context, ANA)).cookie;
  bea = (await signUp(context, BEA)).cookie;
});
afterAll(() => context.close());

async function create(cookie: string, overrides: Partial<SubjectInput> = {}) {
  const response = await call(context, 'POST', '/api/v1/subjects', cookie, input(overrides));
  expect(response.statusCode, response.body).toBe(201);
  return subjectSchema.parse(response.json());
}

async function list(cookie: string) {
  const response = await call(context, 'GET', '/api/v1/subjects', cookie);
  return subjectListResponseSchema.parse(response.json()).subjects;
}

async function trash(cookie: string) {
  const response = await call(context, 'GET', '/api/v1/trash', cookie);
  return trashListResponseSchema.parse(response.json()).items;
}

async function remove(cookie: string, id: string, confirmName: string) {
  return call(context, 'DELETE', `/api/v1/subjects/${id}`, cookie, { confirmName });
}

describe('CRUD de asignaturas', () => {
  it('empieza vacio y exige sesion', async () => {
    expect(await list(ana)).toEqual([]);
    expect((await call(context, 'GET', '/api/v1/subjects')).statusCode).toBe(401);
  });

  it('crea una asignatura con abreviatura derivada y posicion consecutiva', async () => {
    const first = await create(ana, { name: 'Bases de Datos', color: 'green' });
    const second = await create(ana, {
      name: 'Entornos de Desarrollo',
      shortName: 'ENT',
      teacher: 'Luis',
      links: { ...EMPTY_SUBJECT_LINKS, classroom: 'https://aula.example.com/ent' },
    });

    expect(first).toMatchObject({
      name: 'Bases de Datos',
      shortName: 'Bases de Dat',
      color: 'green',
      teacher: null,
      archivedAt: null,
      position: 0,
    });
    expect(second).toMatchObject({ shortName: 'ENT', teacher: 'Luis', position: 1 });
    expect(second.links.classroom).toBe('https://aula.example.com/ent');
    expect((await list(ana)).map((s) => s.id)).toEqual([first.id, second.id]);
  });

  it('rechaza datos invalidos', async () => {
    const bad: Partial<SubjectInput>[] = [
      { name: '   ' },
      { color: 'negro' as never },
      { links: { ...EMPTY_SUBJECT_LINKS, repo: 'javascript:alert(1)' } },
      { shortName: 'x'.repeat(13) },
    ];
    for (const overrides of bad) {
      const response = await call(context, 'POST', '/api/v1/subjects', ana, input(overrides));
      expect(response.statusCode, JSON.stringify(overrides)).toBe(400);
    }
  });

  it('modifica campos sueltos con PATCH', async () => {
    const created = await create(ana, { name: 'Lenguajes de Marcas', color: 'red' });
    const response = await call(context, 'PATCH', `/api/v1/subjects/${created.id}`, ana, {
      name: 'Lenguajes de Marcas y SGI',
      color: 'violet',
      teacher: 'Carmen',
    });
    expect(response.statusCode).toBe(200);
    expect(subjectSchema.parse(response.json())).toMatchObject({
      name: 'Lenguajes de Marcas y SGI',
      color: 'violet',
      teacher: 'Carmen',
      shortName: created.shortName,
    });

    // Quitar el profesor y la abreviatura (null) los vacia / los vuelve a derivar.
    const cleared = await call(context, 'PATCH', `/api/v1/subjects/${created.id}`, ana, {
      teacher: null,
      shortName: null,
    });
    expect(subjectSchema.parse(cleared.json())).toMatchObject({
      teacher: null,
      shortName: 'Lenguajes de',
    });
  });

  it('GET de una asignatura inexistente da 404 con codigo estable', async () => {
    const response = await call(context, 'GET', '/api/v1/subjects/no-existe', ana);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'SUBJECT_NOT_FOUND' });
  });

  it('archivar y desarchivar conservan la asignatura', async () => {
    const created = await create(ana, { name: 'Inglés técnico' });
    const archived = await call(context, 'POST', `/api/v1/subjects/${created.id}/archive`, ana);
    expect(archived.statusCode).toBe(200);
    expect(subjectSchema.parse(archived.json()).archivedAt).not.toBeNull();
    expect((await list(ana)).find((s) => s.id === created.id)?.archivedAt).not.toBeNull();

    const back = await call(context, 'POST', `/api/v1/subjects/${created.id}/unarchive`, ana);
    expect(subjectSchema.parse(back.json()).archivedAt).toBeNull();
  });
});

describe('reordenar', () => {
  it('aplica el orden indicado', async () => {
    const before = await list(ana);
    const reversed = [...before].reverse().map((s) => s.id);
    const response = await call(context, 'PUT', '/api/v1/subjects/order', ana, { ids: reversed });
    expect(response.statusCode).toBe(200);
    const after = subjectListResponseSchema.parse(response.json()).subjects;
    expect(after.map((s) => s.id)).toEqual(reversed);
    expect(after.map((s) => s.position)).toEqual(reversed.map((_, index) => index));
    expect((await list(ana)).map((s) => s.id)).toEqual(reversed);
  });

  it('rechaza listas incompletas, con repetidos o con ids de otro espacio', async () => {
    const mine = (await list(ana)).map((s) => s.id);
    const theirs = await create(bea, { name: 'De Bea' });
    const attempts = [
      mine.slice(1),
      [...mine, mine[0]!],
      [...mine.slice(1), theirs.id],
      [...mine, theirs.id],
    ];
    for (const ids of attempts) {
      const response = await call(context, 'PUT', '/api/v1/subjects/order', ana, { ids });
      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ code: 'INVALID_ORDER' });
    }
    expect((await list(ana)).map((s) => s.id)).toEqual(mine);
  });
});

describe('borrado con doble confirmacion y papelera', () => {
  it('muestra el impacto antes de borrar', async () => {
    const created = await create(ana, { name: 'Sistemas Informáticos' });
    const response = await call(context, 'GET', `/api/v1/subjects/${created.id}/impact`, ana);
    expect(subjectImpactSchema.parse(response.json())).toEqual({
      subject: { id: created.id, name: 'Sistemas Informáticos' },
      tasks: 0,
      notes: 0,
      slots: 0,
    });
  });

  it('exige repetir el nombre: sin cuerpo o con otro nombre no borra nada', async () => {
    const created = await create(ana, { name: 'Formación y Orientación Laboral' });

    const noBody = await call(context, 'DELETE', `/api/v1/subjects/${created.id}`, ana);
    expect(noBody.statusCode).toBe(400);
    const wrong = await remove(ana, created.id, 'otra cosa');
    expect(wrong.statusCode).toBe(400);
    expect(wrong.json()).toMatchObject({ code: 'CONFIRM_NAME_MISMATCH' });
    expect((await list(ana)).some((s) => s.id === created.id)).toBe(true);
  });

  it('borra mandandola a la papelera y se puede restaurar (vuelve al final)', async () => {
    const created = await create(ana, { name: 'Empresa e Iniciativa Emprendedora' });

    // El nombre se compara sin importar mayusculas ni espacios en los extremos.
    const removed = await remove(ana, created.id, '  empresa e iniciativa EMPRENDEDORA ');
    expect(removed.statusCode).toBe(204);
    expect((await list(ana)).some((s) => s.id === created.id)).toBe(false);
    expect((await call(context, 'GET', `/api/v1/subjects/${created.id}`, ana)).statusCode).toBe(
      404,
    );

    const item = (await trash(ana)).find((i) => i.id === created.id);
    expect(item).toMatchObject({ entity: 'subject', name: 'Empresa e Iniciativa Emprendedora' });
    const days = (Date.parse(item!.purgeAt) - Date.parse(item!.deletedAt)) / 86_400_000;
    expect(days).toBe(30);

    const restore = `/api/v1/trash/subject/${created.id}/restore`;
    expect((await call(context, 'POST', restore, ana)).statusCode).toBe(204);
    expect((await list(ana)).at(-1)?.id).toBe(created.id);
    expect((await trash(ana)).some((i) => i.id === created.id)).toBe(false);

    expect((await call(context, 'POST', restore, ana)).statusCode).toBe(404);
  });

  it('lo que lleva mas de 30 dias deja de verse, no se restaura y se purga', async () => {
    const created = await create(ana, { name: 'Caducada' });
    await remove(ana, created.id, 'Caducada');
    const longAgo = new Date(Date.now() - 31 * 86_400_000);
    await context.database.db
      .update(subject)
      .set({ deletedAt: longAgo })
      .where(eq(subject.id, created.id));

    expect((await trash(ana)).some((i) => i.id === created.id)).toBe(false);
    const restore = await call(context, 'POST', `/api/v1/trash/subject/${created.id}/restore`, ana);
    expect(restore.statusCode).toBe(404);

    expect(await purgeExpiredTrash(context.database)).toBeGreaterThanOrEqual(1);
    const left = await context.database.db.select().from(subject).where(eq(subject.id, created.id));
    expect(left).toEqual([]);
  });

  it('criterio de M2: 6 asignaturas, archivar una, borrar otra y restaurarla', async () => {
    const carla = await signUp(context, {
      name: 'Carla',
      email: 'carla@example.com',
      password: 'contrasena-de-carla',
    });
    const names = ['Programación', 'Bases de Datos', 'Entornos', 'Lenguajes', 'Sistemas', 'FOL'];
    const colors = ['red', 'blue', 'green', 'amber', 'teal', 'pink'] as const;
    const created = [];
    for (const [index, name] of names.entries()) {
      created.push(await create(carla.cookie, { name, color: colors[index]! }));
    }
    expect(await list(carla.cookie)).toHaveLength(6);

    await call(context, 'POST', `/api/v1/subjects/${created[2]!.id}/archive`, carla.cookie);
    await remove(carla.cookie, created[4]!.id, 'Sistemas');
    expect(await list(carla.cookie)).toHaveLength(5);

    await call(context, 'POST', `/api/v1/trash/subject/${created[4]!.id}/restore`, carla.cookie);
    const final = await list(carla.cookie);
    expect(final).toHaveLength(6);
    expect(final.filter((s) => s.archivedAt !== null).map((s) => s.name)).toEqual(['Entornos']);
  });
});

describe('acceso cruzado: Bea no puede tocar lo de Ana', () => {
  let anaSubject: Awaited<ReturnType<typeof create>>;

  beforeAll(async () => {
    anaSubject = await create(ana, { name: 'Solo de Ana', teacher: 'Secreto' });
  });

  it('no aparece en su listado', async () => {
    expect(JSON.stringify(await list(bea))).not.toContain(anaSubject.id);
  });

  it.each([
    ['GET', ''],
    ['PATCH', ''],
    ['POST', '/archive'],
    ['POST', '/unarchive'],
    ['GET', '/impact'],
    ['DELETE', ''],
  ] as const)('%s /subjects/:id%s responde 404 y no cambia nada', async (method, suffix) => {
    const payload =
      method === 'PATCH'
        ? { name: 'Hackeada' }
        : method === 'DELETE'
          ? { confirmName: 'Solo de Ana' }
          : undefined;
    const response = await call(
      context,
      method,
      `/api/v1/subjects/${anaSubject.id}${suffix}`,
      bea,
      payload,
    );
    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('Secreto');
    expect(await list(ana)).toContainEqual(anaSubject);
  });

  it('no puede restaurar desde la papelera lo que Ana borro', async () => {
    const doomed = await create(ana, { name: 'Borrada por Ana' });
    await remove(ana, doomed.id, 'Borrada por Ana');

    expect((await trash(bea)).some((i) => i.id === doomed.id)).toBe(false);
    const attempt = await call(context, 'POST', `/api/v1/trash/subject/${doomed.id}/restore`, bea);
    expect(attempt.statusCode).toBe(404);
    expect((await trash(ana)).some((i) => i.id === doomed.id)).toBe(true);
  });

  it('todas las rutas exigen sesion', async () => {
    const id = anaSubject.id;
    const requests = [
      ['GET', '/api/v1/subjects', undefined],
      ['POST', '/api/v1/subjects', input()],
      ['PUT', '/api/v1/subjects/order', { ids: [] }],
      ['GET', `/api/v1/subjects/${id}`, undefined],
      ['PATCH', `/api/v1/subjects/${id}`, { name: 'x' }],
      ['DELETE', `/api/v1/subjects/${id}`, { confirmName: 'x' }],
      ['GET', '/api/v1/trash', undefined],
      ['POST', `/api/v1/trash/subject/${id}/restore`, undefined],
    ] as const;
    for (const [method, url, payload] of requests) {
      const response = await call(context, method, url, undefined, payload);
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});
