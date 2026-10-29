import {
  calendarResponseSchema,
  EMPTY_SUBJECT_LINKS,
  expand,
  scheduleResponseSchema,
  sessionRecordSchema,
  slotExceptionSchema,
  slotSchema,
  subjectSchema,
  type ExceptionInput,
  type SlotInput,
} from '@organizador/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import programacion from '../../../../../data/fixtures/programacion-videotutorias-2026-27.json';
import { scheduleSlot, slotException } from '../../db/schema';
import { ANA, BEA, call, createTestContext, signUp, type TestContext } from '../../test/helpers';
import { purgeExpiredTrash } from '../trash/trash';

let context: TestContext;
let ana: string;
let bea: string;

beforeAll(async () => {
  context = await createTestContext();
  ana = (await signUp(context, ANA)).cookie;
  bea = (await signUp(context, BEA)).cookie;
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
  expect(response.statusCode).toBe(201);
  return subjectSchema.parse(response.json());
}

const slotInput = (subjectId: string, overrides: Partial<SlotInput> = {}): SlotInput => ({
  subjectId,
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
  ...overrides,
});

async function createSlot(cookie: string, input: SlotInput) {
  const response = await call(context, 'POST', '/api/v1/slots', cookie, input);
  expect(response.statusCode, response.body).toBe(201);
  return slotSchema.parse(response.json());
}

const exceptionInput = (overrides: Partial<ExceptionInput> = {}): ExceptionInput => ({
  date: '2026-10-20',
  kind: 'cancelled',
  newDate: null,
  newStart: null,
  newEnd: null,
  reason: 'Huelga',
  ...overrides,
});

async function scheduleOf(cookie: string) {
  const response = await call(context, 'GET', '/api/v1/schedule', cookie);
  expect(response.statusCode).toBe(200);
  return scheduleResponseSchema.parse(response.json());
}

describe('franjas', () => {
  it('el horario empieza vacio', async () => {
    expect(await scheduleOf(ana)).toEqual({ slots: [], exceptions: [], sessionRecords: [] });
  });

  it('INTEGRACION: con el calendario 2026-27 cargado, el motor da los 27 martes del PDF', async () => {
    const pro = await createSubject(ana, 'Programación');
    await createSlot(ana, slotInput(pro.id));
    await call(context, 'POST', '/api/v1/calendar/import-seed', ana);

    const schedule = await scheduleOf(ana);
    const calendar = calendarResponseSchema.parse(
      (await call(context, 'GET', '/api/v1/calendar', ana)).json(),
    );
    const occurrences = expand(
      { from: '2026-09-01', to: '2027-08-31' },
      { ...schedule, marks: calendar.marks },
    );
    expect(occurrences.filter((o) => o.status === 'scheduled').map((o) => o.date)).toEqual(
      programacion.dates,
    );
  });

  it('valida la coherencia al crear y la franja resultante de un PATCH', async () => {
    const subject = await createSubject(ana, 'Sostenibilidad');
    const noAnchor = await call(
      context,
      'POST',
      '/api/v1/slots',
      ana,
      slotInput(subject.id, { intervalWeeks: 2 }),
    );
    expect(noAnchor.statusCode).toBe(400);

    const slot = await createSlot(ana, slotInput(subject.id));
    const patched = await call(context, 'PATCH', `/api/v1/slots/${slot.id}`, ana, {
      intervalWeeks: 2,
    });
    expect(patched.statusCode).toBe(400);
    expect(patched.json()).toMatchObject({ code: 'ANCHOR_REQUIRED' });

    const fixed = await call(context, 'PATCH', `/api/v1/slots/${slot.id}`, ana, {
      intervalWeeks: 2,
      anchorDate: '2026-10-13',
    });
    expect(fixed.statusCode).toBe(200);
    expect(slotSchema.parse(fixed.json())).toMatchObject({
      intervalWeeks: 2,
      anchorDate: '2026-10-13',
      startTime: '17:40',
    });
  });

  it('rechaza horas mal escritas y fechas sueltas vacias', async () => {
    const subject = await createSubject(ana, 'Lenguajes');
    for (const overrides of [
      { startTime: '7:40' },
      { endTime: '17:00' }, // antes del inicio
      { recurrence: 'dates' as const, weekday: null, dates: [] },
      { meetingUrl: 'javascript:alert(1)' },
    ]) {
      const response = await call(
        context,
        'POST',
        '/api/v1/slots',
        ana,
        slotInput(subject.id, overrides),
      );
      expect(response.statusCode, JSON.stringify(overrides)).toBe(400);
    }
  });

  it('no se crea una franja en una asignatura que no existe', async () => {
    const response = await call(context, 'POST', '/api/v1/slots', ana, slotInput('no-existe'));
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: 'SUBJECT_NOT_FOUND' });
  });

  it('el impacto de borrar una asignatura cuenta sus franjas', async () => {
    const subject = await createSubject(ana, 'Con dos franjas');
    await createSlot(ana, slotInput(subject.id));
    await createSlot(ana, slotInput(subject.id, { weekday: 4 }));
    const impact = await call(context, 'GET', `/api/v1/subjects/${subject.id}/impact`, ana);
    expect(impact.json()).toMatchObject({ slots: 2 });
  });
});

describe('excepciones', () => {
  it('cancelar, mover y anadir; un dia no se cancela o mueve dos veces; deshacer', async () => {
    const subject = await createSubject(ana, 'Bases de Datos');
    const slot = await createSlot(ana, slotInput(subject.id));
    const url = `/api/v1/slots/${slot.id}/exceptions`;

    const cancelled = await call(context, 'POST', url, ana, exceptionInput());
    expect(cancelled.statusCode).toBe(201);
    const { id } = slotExceptionSchema.parse(cancelled.json());

    for (const again of [
      exceptionInput(),
      exceptionInput({ kind: 'moved', newDate: '2026-10-22' }),
    ]) {
      const clash = await call(context, 'POST', url, ana, again);
      expect(clash.statusCode).toBe(409);
      expect(clash.json()).toMatchObject({ code: 'EXCEPTION_EXISTS' });
    }
    // Una clase extra el mismo dia si se permite.
    const extra = await call(
      context,
      'POST',
      url,
      ana,
      exceptionInput({ kind: 'extra', reason: null }),
    );
    expect(extra.statusCode).toBe(201);

    expect((await call(context, 'DELETE', `/api/v1/exceptions/${id}`, ana)).statusCode).toBe(204);
    expect((await call(context, 'DELETE', `/api/v1/exceptions/${id}`, ana)).statusCode).toBe(404);
    const moved = await call(
      context,
      'POST',
      url,
      ana,
      exceptionInput({ kind: 'moved', newDate: '2026-10-22', newStart: '10:00', newEnd: '11:00' }),
    );
    expect(moved.statusCode).toBe(201);

    const schedule = await scheduleOf(ana);
    expect(
      schedule.exceptions
        .filter((e) => e.slotId === slot.id)
        .map((e) => e.kind)
        .sort(),
    ).toEqual(['extra', 'moved']);
  });

  it('borrar una franja borra sus excepciones', async () => {
    const subject = await createSubject(ana, 'Efímera');
    const slot = await createSlot(ana, slotInput(subject.id));
    await call(context, 'POST', `/api/v1/slots/${slot.id}/exceptions`, ana, exceptionInput());

    expect((await call(context, 'DELETE', `/api/v1/slots/${slot.id}`, ana)).statusCode).toBe(204);
    const schedule = await scheduleOf(ana);
    expect(schedule.slots.some((s) => s.id === slot.id)).toBe(false);
    expect(schedule.exceptions.some((e) => e.slotId === slot.id)).toBe(false);
  });
});

describe('notas de una tutoria', () => {
  const notes = {
    topic: 'Normalizacion',
    questions: '¿Cuando conviene desnormalizar?',
    notes: null,
    recordingUrl: null,
  };

  it('se guardan por franja y dia, se sustituyen y llegan en /schedule', async () => {
    const subject = await createSubject(ana, 'Con tutoria');
    const slot = await createSlot(ana, slotInput(subject.id));
    const url = `/api/v1/session-records/${slot.id}/2026-10-20`;

    const saved = await call(context, 'PUT', url, ana, notes);
    expect(saved.statusCode, saved.body).toBe(200);
    expect(sessionRecordSchema.parse(saved.json())).toMatchObject({
      slotId: slot.id,
      date: '2026-10-20',
      topic: 'Normalizacion',
    });

    const after = await call(context, 'PUT', url, ana, {
      ...notes,
      notes: 'BCNF explicada con ejemplos',
      recordingUrl: 'https://videos.example.com/t1',
    });
    expect(after.statusCode).toBe(200);
    const records = (await scheduleOf(ana)).sessionRecords.filter((r) => r.slotId === slot.id);
    expect(records).toEqual([
      {
        slotId: slot.id,
        date: '2026-10-20',
        topic: 'Normalizacion',
        questions: '¿Cuando conviene desnormalizar?',
        notes: 'BCNF explicada con ejemplos',
        recordingUrl: 'https://videos.example.com/t1',
      },
    ]);
  });

  it('valida la grabacion y la fecha, y Bea no puede tocar las de Ana', async () => {
    const subject = await createSubject(ana, 'Tutoria privada');
    const slot = await createSlot(ana, slotInput(subject.id));
    const bad = await call(context, 'PUT', `/api/v1/session-records/${slot.id}/2026-10-20`, ana, {
      ...notes,
      recordingUrl: 'javascript:alert(1)',
    });
    expect(bad.statusCode).toBe(400);
    const badDate = await call(
      context,
      'PUT',
      `/api/v1/session-records/${slot.id}/2026-13-01`,
      ana,
      notes,
    );
    expect(badDate.statusCode).toBe(400);

    const foreign = await call(
      context,
      'PUT',
      `/api/v1/session-records/${slot.id}/2026-10-20`,
      bea,
      notes,
    );
    expect(foreign.statusCode).toBe(404);
    expect(JSON.stringify(await scheduleOf(bea))).not.toContain('Normalizacion');
  });
});

describe('asignatura en la papelera', () => {
  it('sus franjas desaparecen, vuelven al restaurarla y se purgan en cascada', async () => {
    const subject = await createSubject(ana, 'Temporal');
    const slot = await createSlot(ana, slotInput(subject.id));
    await call(context, 'POST', `/api/v1/slots/${slot.id}/exceptions`, ana, exceptionInput());
    const remove = () =>
      call(context, 'DELETE', `/api/v1/subjects/${subject.id}`, ana, { confirmName: 'Temporal' });

    expect((await remove()).statusCode).toBe(204);
    expect((await scheduleOf(ana)).slots.some((s) => s.id === slot.id)).toBe(false);
    const hidden = await call(context, 'PATCH', `/api/v1/slots/${slot.id}`, ana, { weekday: 3 });
    expect(hidden.statusCode).toBe(404);

    await call(context, 'POST', `/api/v1/trash/subject/${subject.id}/restore`, ana);
    expect((await scheduleOf(ana)).slots.some((s) => s.id === slot.id)).toBe(true);

    // Purga a los 30 dias: sin la cascada, las claves foraneas la harian fallar.
    await remove();
    const inAMonth = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(await purgeExpiredTrash(context.database, inAMonth)).toBeGreaterThanOrEqual(1);
    const { db } = context.database;
    expect((await db.select().from(scheduleSlot)).some((s) => s.id === slot.id)).toBe(false);
    expect((await db.select().from(slotException)).some((e) => e.slotId === slot.id)).toBe(false);
  });
});

describe('acceso cruzado: Bea no ve ni toca el horario de Ana', () => {
  let slotId: string;
  let subjectId: string;
  let exceptionId: string;

  beforeAll(async () => {
    const subject = await createSubject(ana, 'Solo de Ana');
    subjectId = subject.id;
    slotId = (await createSlot(ana, slotInput(subject.id))).id;
    const created = await call(
      context,
      'POST',
      `/api/v1/slots/${slotId}/exceptions`,
      ana,
      exceptionInput({ reason: 'Motivo privado' }),
    );
    exceptionId = slotExceptionSchema.parse(created.json()).id;
  });

  it('su horario no contiene nada de Ana', async () => {
    const schedule = await scheduleOf(bea);
    expect(JSON.stringify(schedule)).not.toContain(slotId);
    expect(JSON.stringify(schedule)).not.toContain('Motivo privado');
  });

  it('no puede crear, cambiar ni borrar nada de Ana (404, sin cambios)', async () => {
    const attempts = [
      ['POST', '/api/v1/slots', slotInput(subjectId)],
      ['PATCH', `/api/v1/slots/${slotId}`, { weekday: 5 }],
      ['DELETE', `/api/v1/slots/${slotId}`, undefined],
      ['POST', `/api/v1/slots/${slotId}/exceptions`, exceptionInput({ date: '2026-10-27' })],
      ['DELETE', `/api/v1/exceptions/${exceptionId}`, undefined],
    ] as const;
    for (const [method, url, payload] of attempts) {
      const response = await call(context, method, url, bea, payload);
      expect(response.statusCode, `${method} ${url}`).toBe(404);
    }
    const schedule = await scheduleOf(ana);
    expect(schedule.slots.find((s) => s.id === slotId)?.weekday).toBe(2);
    expect(schedule.exceptions.some((e) => e.id === exceptionId)).toBe(true);
  });

  it('todas las rutas exigen sesion', async () => {
    const requests = [
      ['GET', '/api/v1/schedule', undefined],
      ['POST', '/api/v1/slots', slotInput(subjectId)],
      ['PATCH', `/api/v1/slots/${slotId}`, { weekday: 5 }],
      ['DELETE', `/api/v1/slots/${slotId}`, undefined],
      ['POST', `/api/v1/slots/${slotId}/exceptions`, exceptionInput()],
      ['DELETE', `/api/v1/exceptions/${exceptionId}`, undefined],
    ] as const;
    for (const [method, url, payload] of requests) {
      const response = await call(context, method, url, undefined, payload);
      expect(response.statusCode, `${method} ${url}`).toBe(401);
    }
  });
});
