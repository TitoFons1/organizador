import {
  blockedDays,
  calendarResponseSchema,
  calendarWarnings,
  courseBounds,
  eachDay,
  importResultSchema,
  markSchema,
  termSchema,
  weekday,
  type MarkInput,
} from '@organizador/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import programacion from '../../../../../data/fixtures/programacion-videotutorias-2026-27.json';
import { ANA, BEA, call, createTestContext, signUp, type TestContext } from '../../test/helpers';

let context: TestContext;
let ana: string;
let bea: string;

beforeAll(async () => {
  context = await createTestContext();
  ana = (await signUp(context, ANA)).cookie;
  bea = (await signUp(context, BEA)).cookie;
});
afterAll(() => context.close());

const markInput = (overrides: Partial<MarkInput> = {}): MarkInput => ({
  kind: 'festivo',
  startDate: '2026-11-02',
  endDate: '2026-11-02',
  label: 'Todos los Santos',
  blocksClasses: true,
  groups: null,
  ...overrides,
});

async function calendarOf(cookie: string) {
  const response = await call(context, 'GET', '/api/v1/calendar', cookie);
  expect(response.statusCode).toBe(200);
  return calendarResponseSchema.parse(response.json());
}

describe('importar el calendario 2026-27', () => {
  it('empieza vacio y exige sesion', async () => {
    expect(await calendarOf(ana)).toEqual({ terms: [], marks: [] });
    expect((await call(context, 'GET', '/api/v1/calendar')).statusCode).toBe(401);
    expect((await call(context, 'POST', '/api/v1/calendar/import-seed')).statusCode).toBe(401);
  });

  it('carga 2 cuatrimestres y 18 marcas y no deja avisos', async () => {
    const response = await call(context, 'POST', '/api/v1/calendar/import-seed', ana);
    expect(response.statusCode).toBe(200);
    expect(importResultSchema.parse(response.json())).toEqual({
      createdTerms: 2,
      skippedTerms: 0,
      createdMarks: 18,
      skippedMarks: 0,
    });

    const { terms, marks } = await calendarOf(ana);
    expect(terms.map((t) => t.name)).toEqual(['1er cuatrimestre', '2o cuatrimestre']);
    expect(marks).toHaveLength(18);
    expect(calendarWarnings(terms, marks)).toEqual([]);
    expect(courseBounds(marks)).toEqual({ start: '2026-10-01', end: '2027-06-18' });
    // Ordenadas por fecha de inicio.
    expect(marks.map((m) => m.startDate)).toEqual([...marks.map((m) => m.startDate)].sort());
  });

  it('es idempotente: cargarlo dos veces no duplica nada', async () => {
    const response = await call(context, 'POST', '/api/v1/calendar/import-seed', ana);
    expect(importResultSchema.parse(response.json())).toEqual({
      createdTerms: 0,
      skippedTerms: 2,
      createdMarks: 0,
      skippedMarks: 18,
    });
    expect((await calendarOf(ana)).marks).toHaveLength(18);
  });

  it('PRUEBA DE FUEGO con los datos guardados: salen los 27 martes del PDF', async () => {
    const { marks } = await calendarOf(ana);
    const { start, end } = courseBounds(marks);
    const blocked = blockedDays(marks);

    const tuesdays = eachDay(start!, end!).filter((d) => weekday(d) === 2 && !blocked.has(d));
    expect(tuesdays).toEqual(programacion.dates);
  });

  it('conserva los grupos de las marcas de examenes', async () => {
    const { marks } = await calendarOf(ana);
    const exams = marks.find((m) => m.label === 'Examenes 1er cuatrimestre');
    expect(exams?.groups).toEqual(['DAM', 'DAW', 'IABD', 'DALP']);
    expect(marks.find((m) => m.label === 'Junio - J1 (todos)')?.groups).toBeNull();
  });
});

describe('marcas', () => {
  it('crea, modifica y borra una marca', async () => {
    const created = await call(context, 'POST', '/api/v1/marks', ana, markInput());
    expect(created.statusCode).toBe(201);
    const mark = markSchema.parse(created.json());

    const patched = await call(context, 'PATCH', `/api/v1/marks/${mark.id}`, ana, {
      label: 'Puente de noviembre',
      endDate: '2026-11-03',
      blocksClasses: false,
    });
    expect(patched.statusCode).toBe(200);
    expect(markSchema.parse(patched.json())).toMatchObject({
      label: 'Puente de noviembre',
      startDate: '2026-11-02',
      endDate: '2026-11-03',
      blocksClasses: false,
      kind: 'festivo',
    });

    expect((await call(context, 'DELETE', `/api/v1/marks/${mark.id}`, ana)).statusCode).toBe(204);
    expect((await calendarOf(ana)).marks.some((m) => m.id === mark.id)).toBe(false);
    expect((await call(context, 'DELETE', `/api/v1/marks/${mark.id}`, ana)).statusCode).toBe(404);
  });

  it('rechaza marcas invalidas', async () => {
    const bad: Partial<MarkInput>[] = [
      { endDate: '2026-11-01' }, // acaba antes de empezar
      { startDate: '2026-02-30', endDate: '2026-03-01' }, // fecha inexistente
      { startDate: 'abc' }, // mal escrita: 400, no 500
      { kind: 'fiesta' as never },
      { label: '   ' },
      { label: 'x'.repeat(121) },
    ];
    for (const overrides of bad) {
      const response = await call(context, 'POST', '/api/v1/marks', ana, markInput(overrides));
      expect(response.statusCode, JSON.stringify(overrides)).toBe(400);
    }
  });

  it('un PATCH que deja el rango al reves se rechaza con codigo estable', async () => {
    const created = await call(context, 'POST', '/api/v1/marks', ana, markInput());
    const { id } = markSchema.parse(created.json());

    const response = await call(context, 'PATCH', `/api/v1/marks/${id}`, ana, {
      endDate: '2026-10-01',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'INVALID_RANGE' });
    expect((await calendarOf(ana)).marks.find((m) => m.id === id)?.endDate).toBe('2026-11-02');
  });

  it('una marca no puede durar mas de un ano, tampoco tras un PATCH', async () => {
    const tooLong = await call(
      context,
      'POST',
      '/api/v1/marks',
      ana,
      markInput({ endDate: '2206-11-02' }),
    );
    expect(tooLong.statusCode).toBe(400);

    const created = await call(context, 'POST', '/api/v1/marks', ana, markInput());
    const { id } = markSchema.parse(created.json());
    const response = await call(context, 'PATCH', `/api/v1/marks/${id}`, ana, {
      endDate: '2206-11-02',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: 'RANGE_TOO_LONG' });
  });
});

describe('cuatrimestres', () => {
  it('permite un cuatrimestre sin fecha de fin y genera aviso hasta completarlo', async () => {
    const created = await call(context, 'POST', '/api/v1/terms', ana, {
      name: 'Verano',
      startDate: '2027-07-01',
      endDate: null,
    });
    expect(created.statusCode).toBe(201);
    const term = termSchema.parse(created.json());
    expect(term.endDate).toBeNull();

    let { terms, marks } = await calendarOf(ana);
    expect(calendarWarnings(terms, marks)).toContainEqual({
      code: 'TERM_WITHOUT_END',
      term: 'Verano',
    });

    const patched = await call(context, 'PATCH', `/api/v1/terms/${term.id}`, ana, {
      endDate: '2027-08-31',
    });
    expect(termSchema.parse(patched.json()).endDate).toBe('2027-08-31');
    ({ terms, marks } = await calendarOf(ana));
    expect(calendarWarnings(terms, marks)).toEqual([]);

    expect((await call(context, 'DELETE', `/api/v1/terms/${term.id}`, ana)).statusCode).toBe(204);
    expect((await call(context, 'DELETE', `/api/v1/terms/${term.id}`, ana)).statusCode).toBe(404);
  });

  it('rechaza un cuatrimestre que acaba antes de empezar (tambien via PATCH)', async () => {
    const bad = await call(context, 'POST', '/api/v1/terms', ana, {
      name: 'Raro',
      startDate: '2027-07-01',
      endDate: '2027-06-01',
    });
    expect(bad.statusCode).toBe(400);

    const { id } = termSchema.parse(
      (
        await call(context, 'POST', '/api/v1/terms', ana, {
          name: 'Temporal',
          startDate: '2027-09-01',
          endDate: '2027-12-01',
        })
      ).json(),
    );
    const patched = await call(context, 'PATCH', `/api/v1/terms/${id}`, ana, {
      startDate: '2028-01-01',
    });
    expect(patched.statusCode).toBe(400);
    expect(patched.json()).toMatchObject({ code: 'INVALID_RANGE' });
  });
});

describe('acceso cruzado: Bea no ve ni toca el calendario de Ana', () => {
  it('su calendario esta vacio aunque el de Ana este lleno', async () => {
    expect(await calendarOf(bea)).toEqual({ terms: [], marks: [] });
  });

  it('no puede modificar ni borrar marcas o cuatrimestres ajenos', async () => {
    const { marks, terms } = await calendarOf(ana);
    const mark = marks[0]!;
    const term = terms[0]!;

    const attempts = [
      call(context, 'PATCH', `/api/v1/marks/${mark.id}`, bea, { label: 'Hackeada' }),
      call(context, 'DELETE', `/api/v1/marks/${mark.id}`, bea),
      call(context, 'PATCH', `/api/v1/terms/${term.id}`, bea, { name: 'Hackeado' }),
      call(context, 'DELETE', `/api/v1/terms/${term.id}`, bea),
    ];
    for (const response of await Promise.all(attempts)) {
      expect(response.statusCode).toBe(404);
    }

    const after = await calendarOf(ana);
    expect(after.marks.find((m) => m.id === mark.id)).toEqual(mark);
    expect(after.terms.find((t) => t.id === term.id)).toEqual(term);
  });

  it('importar el seed en su espacio no toca el de Ana', async () => {
    const before = await calendarOf(ana);
    const imported = await call(context, 'POST', '/api/v1/calendar/import-seed', bea);
    expect(importResultSchema.parse(imported.json()).createdMarks).toBe(18);

    expect(await calendarOf(ana)).toEqual(before);
    const theirs = await calendarOf(bea);
    const ids = new Set(before.marks.map((m) => m.id));
    expect(theirs.marks.every((m) => !ids.has(m.id))).toBe(true);
  });

  it('todas las rutas exigen sesion', async () => {
    const requests = [
      ['POST', '/api/v1/marks', markInput()],
      ['PATCH', '/api/v1/marks/x', { label: 'x' }],
      ['DELETE', '/api/v1/marks/x', undefined],
      ['POST', '/api/v1/terms', { name: 'x', startDate: '2026-10-01', endDate: null }],
      ['PATCH', '/api/v1/terms/x', { name: 'x' }],
      ['DELETE', '/api/v1/terms/x', undefined],
    ] as const;
    for (const [method, url, payload] of requests) {
      const response = await call(context, method, url, undefined, payload);
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});
