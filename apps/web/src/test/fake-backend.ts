import {
  EMPTY_SUBJECT_LINKS,
  exceptionInputSchema,
  markInputSchema,
  markPatchSchema,
  normalizeSeed,
  sessionRecordInputSchema,
  slotInputSchema,
  slotPatchSchema,
  subjectInputSchema,
  taskInputSchema,
  taskPatchSchema,
  taskProgressInputSchema,
  termInputSchema,
  termPatchSchema,
  type Mark,
  type SessionRecord,
  type Slot,
  type SlotException,
  type Subject,
  type SubjectInput,
  type Task,
  type Term,
  type TrashItem,
} from '@organizador/shared';
import courseSeed from '../../../../data/calendario-2026-2027.seed.json';
import { ANA_ME, HEALTH_OK, mockApi } from './mock-api';

type Handlers = Parameters<typeof mockApi>[0];

/**
 * Backend en memoria con la misma forma que la API real, para probar la web de punta a punta
 * sin servidor. Cada hito anade aqui sus endpoints.
 */
export function createFakeBackend(
  initial: {
    subjects?: Subject[];
    marks?: Mark[];
    terms?: Term[];
    slots?: Slot[];
    exceptions?: SlotException[];
    sessionRecords?: SessionRecord[];
    tasks?: Task[];
  } = {},
) {
  const state = {
    subjects: [...(initial.subjects ?? [])],
    trash: [] as TrashItem[],
    marks: [...(initial.marks ?? [])],
    terms: [...(initial.terms ?? [])],
    slots: [...(initial.slots ?? [])],
    exceptions: [...(initial.exceptions ?? [])],
    sessionRecords: [...(initial.sessionRecords ?? [])],
    tasks: [...(initial.tasks ?? [])],
    deletedTasks: [] as Task[],
    nextId: 1,
  };

  const find = (id: string) => state.subjects.find((subject) => subject.id === id);
  const notFound = { status: 404, body: { message: 'No existe', code: 'SUBJECT_NOT_FOUND' } };

  const handlers: Handlers = {
    'GET /api/v1/me': { body: ANA_ME },
    'GET /api/v1/health': { body: HEALTH_OK },

    'GET /api/v1/subjects': () => ({ body: { subjects: state.subjects } }),
    'POST /api/v1/subjects': ({ body }) => {
      const input = subjectInputSchema.parse(body) as SubjectInput;
      const created: Subject = {
        id: `s${state.nextId++}`,
        name: input.name,
        shortName: input.shortName ?? input.name.slice(0, 12),
        color: input.color,
        teacher: input.teacher,
        links: input.links,
        position: state.subjects.length,
        archivedAt: null,
      };
      state.subjects.push(created);
      return { status: 201, body: created };
    },
    'PUT /api/v1/subjects/order': ({ body }) => {
      const { ids } = body as { ids: string[] };
      state.subjects = ids.map((id, position) => ({ ...find(id)!, position }));
      return { body: { subjects: state.subjects } };
    },
    'PATCH /api/v1/subjects/:id': ({ params, body }) => {
      const current = find(params.id!);
      if (!current) return notFound;
      const patch = body as Partial<SubjectInput>;
      const updated: Subject = {
        ...current,
        ...patch,
        shortName: patch.shortName ?? current.shortName,
        links: patch.links ?? current.links,
      };
      state.subjects = state.subjects.map((s) => (s.id === current.id ? updated : s));
      return { body: updated };
    },
    'POST /api/v1/subjects/:id/archive': ({ params }) => archive(params.id!, true),
    'POST /api/v1/subjects/:id/unarchive': ({ params }) => archive(params.id!, false),
    'GET /api/v1/subjects/:id/impact': ({ params }) => {
      const current = find(params.id!);
      if (!current) return notFound;
      return {
        body: { subject: { id: current.id, name: current.name }, tasks: 0, notes: 0, slots: 0 },
      };
    },
    'DELETE /api/v1/subjects/:id': ({ params, body }) => {
      const current = find(params.id!);
      if (!current) return notFound;
      const { confirmName } = body as { confirmName: string };
      if (confirmName.trim().toLowerCase() !== current.name.trim().toLowerCase()) {
        return { status: 400, body: { message: 'No coincide', code: 'CONFIRM_NAME_MISMATCH' } };
      }
      state.subjects = state.subjects.filter((s) => s.id !== current.id);
      const deletedAt = '2026-10-08T10:00:00.000Z';
      state.trash.push({
        entity: 'subject',
        id: current.id,
        name: current.name,
        deletedAt,
        purgeAt: '2026-11-07T10:00:00.000Z',
      });
      return { status: 204 };
    },

    'GET /api/v1/calendar': () => ({ body: { terms: state.terms, marks: state.marks } }),
    'POST /api/v1/calendar/import-seed': () => {
      // Como el servidor: idempotente, lo que ya existe se omite.
      const seed = normalizeSeed(courseSeed);
      const known = new Set(state.marks.map((m) => `${m.kind}|${m.startDate}|${m.label}`));
      const newMarks = seed.marks.filter((m) => !known.has(`${m.kind}|${m.startDate}|${m.label}`));
      const newTerms = seed.terms.filter((t) => !state.terms.some((x) => x.name === t.name));
      state.marks.push(...newMarks.map((m) => ({ ...m, id: `m${state.nextId++}` })));
      state.terms.push(...newTerms.map((t) => ({ ...t, id: `t${state.nextId++}` })));
      return {
        body: {
          createdTerms: newTerms.length,
          skippedTerms: seed.terms.length - newTerms.length,
          createdMarks: newMarks.length,
          skippedMarks: seed.marks.length - newMarks.length,
        },
      };
    },
    'POST /api/v1/marks': ({ body }) => {
      const created: Mark = { ...markInputSchema.parse(body), id: `m${state.nextId++}` };
      state.marks.push(created);
      return { status: 201, body: created };
    },
    'PATCH /api/v1/marks/:id': ({ params, body }) => {
      const current = state.marks.find((m) => m.id === params.id);
      if (!current) return { status: 404, body: { code: 'MARK_NOT_FOUND' } };
      const updated: Mark = { ...current, ...markPatchSchema.parse(body) };
      state.marks = state.marks.map((m) => (m.id === current.id ? updated : m));
      return { body: updated };
    },
    'DELETE /api/v1/marks/:id': ({ params }) => {
      state.marks = state.marks.filter((m) => m.id !== params.id);
      return { status: 204 };
    },
    'POST /api/v1/terms': ({ body }) => {
      const created: Term = { ...termInputSchema.parse(body), id: `t${state.nextId++}` };
      state.terms.push(created);
      return { status: 201, body: created };
    },
    'PATCH /api/v1/terms/:id': ({ params, body }) => {
      const current = state.terms.find((t) => t.id === params.id);
      if (!current) return { status: 404, body: { code: 'TERM_NOT_FOUND' } };
      const updated: Term = { ...current, ...termPatchSchema.parse(body) };
      state.terms = state.terms.map((t) => (t.id === current.id ? updated : t));
      return { body: updated };
    },
    'DELETE /api/v1/terms/:id': ({ params }) => {
      state.terms = state.terms.filter((t) => t.id !== params.id);
      return { status: 204 };
    },

    'GET /api/v1/schedule': () => ({
      body: {
        slots: state.slots,
        exceptions: state.exceptions,
        sessionRecords: state.sessionRecords,
      },
    }),
    'POST /api/v1/slots': ({ body }) => {
      const created: Slot = { ...slotInputSchema.parse(body), id: `slot${state.nextId++}` };
      state.slots.push(created);
      return { status: 201, body: created };
    },
    'PATCH /api/v1/slots/:id': ({ params, body }) => {
      const current = state.slots.find((slot) => slot.id === params.id);
      if (!current) return { status: 404, body: { code: 'SLOT_NOT_FOUND' } };
      const updated: Slot = { ...current, ...slotPatchSchema.parse(body) };
      state.slots = state.slots.map((slot) => (slot.id === current.id ? updated : slot));
      return { body: updated };
    },
    'DELETE /api/v1/slots/:id': ({ params }) => {
      state.slots = state.slots.filter((slot) => slot.id !== params.id);
      state.exceptions = state.exceptions.filter((e) => e.slotId !== params.id);
      return { status: 204 };
    },
    'POST /api/v1/slots/:id/exceptions': ({ params, body }) => {
      const input = exceptionInputSchema.parse(body);
      // Como el servidor: un dia no se cancela o mueve dos veces.
      const clash = state.exceptions.some(
        (e) => e.slotId === params.id && e.date === input.date && e.kind !== 'extra',
      );
      if (input.kind !== 'extra' && clash) {
        return { status: 409, body: { code: 'EXCEPTION_EXISTS' } };
      }
      const created: SlotException = { ...input, id: `exc${state.nextId++}`, slotId: params.id! };
      state.exceptions.push(created);
      return { status: 201, body: created };
    },
    'DELETE /api/v1/exceptions/:id': ({ params }) => {
      state.exceptions = state.exceptions.filter((e) => e.id !== params.id);
      return { status: 204 };
    },

    'PUT /api/v1/session-records/:slotId/:date': ({ params, body }) => {
      const saved: SessionRecord = {
        ...sessionRecordInputSchema.parse(body),
        slotId: params.slotId!,
        date: params.date!,
      };
      state.sessionRecords = [
        ...state.sessionRecords.filter(
          (r) => !(r.slotId === saved.slotId && r.date === saved.date),
        ),
        saved,
      ];
      return { body: saved };
    },

    'GET /api/v1/tasks': () => ({ body: { tasks: state.tasks } }),
    'POST /api/v1/tasks': ({ body }) => {
      const input = taskInputSchema.parse(body);
      const mother = state.tasks.find((t) => t.id === input.parentId);
      const created: Task = {
        ...input,
        // Como el servidor: la subtarea va con la asignatura y la visibilidad de su madre.
        ...(mother ? { subjectId: mother.subjectId, visibility: mother.visibility } : {}),
        id: `task${state.nextId++}`,
        createdBy: ANA_ME.user.id,
        status: 'todo',
        doneAt: null,
      };
      state.tasks.push(created);
      return { status: 201, body: created };
    },
    'PATCH /api/v1/tasks/:id': ({ params, body }) => {
      const current = state.tasks.find((t) => t.id === params.id);
      if (!current) return { status: 404, body: { code: 'TASK_NOT_FOUND' } };
      const updated: Task = { ...current, ...taskPatchSchema.parse(body) };
      state.tasks = state.tasks.map((t) => (t.id === current.id ? updated : t));
      return { body: updated };
    },
    'PUT /api/v1/tasks/:id/progress': ({ params, body }) => {
      const current = state.tasks.find((t) => t.id === params.id);
      if (!current) return { status: 404, body: { code: 'TASK_NOT_FOUND' } };
      const { status } = taskProgressInputSchema.parse(body);
      const doneAt = status === 'done' ? '2026-10-14T10:00:00.000Z' : null;
      const updated: Task = { ...current, status, doneAt };
      state.tasks = state.tasks.map((t) => (t.id === current.id ? updated : t));
      return { body: updated };
    },
    'DELETE /api/v1/tasks/:id': ({ params }) => {
      // Se van ella y sus subtareas; a la papelera solo la que se borra.
      const gone = state.tasks.filter((t) => t.id === params.id || t.parentId === params.id);
      state.tasks = state.tasks.filter((t) => !gone.includes(t));
      state.deletedTasks.push(...gone);
      const task = gone.find((t) => t.id === params.id);
      if (task) {
        state.trash.push({
          entity: 'task',
          id: task.id,
          name: task.title,
          deletedAt: '2026-10-14T10:00:00.000Z',
          purgeAt: '2026-11-13T10:00:00.000Z',
        });
      }
      return { status: 204 };
    },

    'GET /api/v1/trash': () => ({ body: { items: state.trash } }),
    'POST /api/v1/trash/:entity/:id/restore': ({ params }) => {
      const item = state.trash.find((entry) => entry.id === params.id);
      if (!item) return { status: 404, body: { message: 'No esta', code: 'TRASH_ITEM_NOT_FOUND' } };
      state.trash = state.trash.filter((entry) => entry !== item);
      if (item.entity === 'task') {
        const back = state.deletedTasks.filter((t) => t.id === item.id || t.parentId === item.id);
        state.deletedTasks = state.deletedTasks.filter((t) => !back.includes(t));
        state.tasks.push(...back);
        return { status: 204 };
      }
      state.subjects.push({
        id: item.id,
        name: item.name,
        shortName: item.name.slice(0, 12),
        color: 'blue',
        teacher: null,
        links: EMPTY_SUBJECT_LINKS,
        position: state.subjects.length,
        archivedAt: null,
      });
      return { status: 204 };
    },
  };

  function archive(id: string, archived: boolean) {
    const current = find(id);
    if (!current) return notFound;
    const updated = { ...current, archivedAt: archived ? '2026-10-08T10:00:00.000Z' : null };
    state.subjects = state.subjects.map((s) => (s.id === id ? updated : s));
    return { body: updated };
  }

  return { state, handlers, install: () => mockApi(handlers) };
}

export function subjectFixture(
  overrides: Partial<Subject> & Pick<Subject, 'id' | 'name'>,
): Subject {
  return {
    shortName: overrides.name.slice(0, 3).toUpperCase(),
    color: 'blue',
    teacher: null,
    links: EMPTY_SUBJECT_LINKS,
    position: 0,
    archivedAt: null,
    ...overrides,
  };
}
