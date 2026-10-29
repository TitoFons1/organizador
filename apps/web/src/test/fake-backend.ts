import {
  EMPTY_SUBJECT_LINKS,
  subjectInputSchema,
  type Subject,
  type SubjectInput,
  type TrashItem,
} from '@organizador/shared';
import { ANA_ME, HEALTH_OK, mockApi } from './mock-api';

type Handlers = Parameters<typeof mockApi>[0];

/**
 * Backend en memoria con la misma forma que la API real, para probar la web de punta a punta
 * sin servidor. Cada hito anade aqui sus endpoints.
 */
export function createFakeBackend(initial: { subjects?: Subject[] } = {}) {
  const state = {
    subjects: [...(initial.subjects ?? [])],
    trash: [] as TrashItem[],
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

    'GET /api/v1/trash': () => ({ body: { items: state.trash } }),
    'POST /api/v1/trash/:entity/:id/restore': ({ params }) => {
      const item = state.trash.find((entry) => entry.id === params.id);
      if (!item) return { status: 404, body: { message: 'No esta', code: 'TRASH_ITEM_NOT_FOUND' } };
      state.trash = state.trash.filter((entry) => entry !== item);
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
