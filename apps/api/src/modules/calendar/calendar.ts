import type {
  CalendarResponse,
  ImportResult,
  Mark,
  MarkInput,
  MarkPatch,
  Term,
  TermInput,
  TermPatch,
} from '@organizador/shared';
import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { calendarMark, term } from '../../db/schema';
import { HttpError } from '../../http-error';

type MarkRow = typeof calendarMark.$inferSelect;
type TermRow = typeof term.$inferSelect;

const toMark = (row: MarkRow): Mark => ({
  id: row.id,
  kind: row.kind,
  startDate: row.startDate,
  endDate: row.endDate,
  label: row.label,
  blocksClasses: row.blocksClasses,
  groups: row.groups,
});

const toTerm = (row: TermRow): Term => ({
  id: row.id,
  name: row.name,
  startDate: row.startDate,
  endDate: row.endDate,
});

const markNotFound = () => new HttpError(404, 'Marca no encontrada.', 'MARK_NOT_FOUND');
const termNotFound = () => new HttpError(404, 'Cuatrimestre no encontrado.', 'TERM_NOT_FOUND');
const invalidRange = () =>
  new HttpError(400, 'La fecha final no puede ser anterior a la inicial.', 'INVALID_RANGE');

/** Todas las consultas pasan por aqui para que ninguna olvide filtrar por espacio (D1). */
const markInWorkspace = (workspaceId: string) => eq(calendarMark.workspaceId, workspaceId);
const termInWorkspace = (workspaceId: string) => eq(term.workspaceId, workspaceId);

export async function getCalendar(
  database: Database,
  workspaceId: string,
): Promise<CalendarResponse> {
  const { db } = database;
  const [terms, marks] = await Promise.all([
    db
      .select()
      .from(term)
      .where(termInWorkspace(workspaceId))
      .orderBy(asc(term.startDate), asc(term.name)),
    db
      .select()
      .from(calendarMark)
      .where(markInWorkspace(workspaceId))
      .orderBy(asc(calendarMark.startDate), asc(calendarMark.endDate), asc(calendarMark.label)),
  ]);
  return { terms: terms.map(toTerm), marks: marks.map(toMark) };
}

// ── Marcas ──────────────────────────────────────────────────────────────────

export async function createMark(database: Database, workspaceId: string, input: MarkInput) {
  const [row] = await database.db
    .insert(calendarMark)
    .values({ workspaceId, ...input })
    .returning();
  return toMark(row!);
}

export async function updateMark(
  database: Database,
  workspaceId: string,
  id: string,
  patch: MarkPatch,
) {
  const current = await database.db
    .select()
    .from(calendarMark)
    .where(and(markInWorkspace(workspaceId), eq(calendarMark.id, id)))
    .get();
  if (!current) throw markNotFound();

  const next = {
    kind: patch.kind ?? current.kind,
    startDate: patch.startDate ?? current.startDate,
    endDate: patch.endDate ?? current.endDate,
    label: patch.label ?? current.label,
    blocksClasses: patch.blocksClasses ?? current.blocksClasses,
    groups: patch.groups === undefined ? current.groups : patch.groups,
  };
  // El PATCH solo valida campos sueltos; la coherencia entre fechas se comprueba con el resultado.
  if (next.endDate < next.startDate) throw invalidRange();

  const [row] = await database.db
    .update(calendarMark)
    .set(next)
    .where(and(markInWorkspace(workspaceId), eq(calendarMark.id, id)))
    .returning();
  return toMark(row!);
}

export async function deleteMark(database: Database, workspaceId: string, id: string) {
  const result = await database.db
    .delete(calendarMark)
    .where(and(markInWorkspace(workspaceId), eq(calendarMark.id, id)));
  if (result.rowsAffected === 0) throw markNotFound();
}

// ── Cuatrimestres ───────────────────────────────────────────────────────────

export async function createTerm(database: Database, workspaceId: string, input: TermInput) {
  const [row] = await database.db
    .insert(term)
    .values({ workspaceId, ...input })
    .returning();
  return toTerm(row!);
}

export async function updateTerm(
  database: Database,
  workspaceId: string,
  id: string,
  patch: TermPatch,
) {
  const current = await database.db
    .select()
    .from(term)
    .where(and(termInWorkspace(workspaceId), eq(term.id, id)))
    .get();
  if (!current) throw termNotFound();

  const next = {
    name: patch.name ?? current.name,
    startDate: patch.startDate ?? current.startDate,
    endDate: patch.endDate === undefined ? current.endDate : patch.endDate,
  };
  if (next.endDate !== null && next.endDate < next.startDate) throw invalidRange();

  const [row] = await database.db
    .update(term)
    .set(next)
    .where(and(termInWorkspace(workspaceId), eq(term.id, id)))
    .returning();
  return toTerm(row!);
}

export async function deleteTerm(database: Database, workspaceId: string, id: string) {
  const result = await database.db
    .delete(term)
    .where(and(termInWorkspace(workspaceId), eq(term.id, id)));
  if (result.rowsAffected === 0) throw termNotFound();
}

// ── Importacion del seed ────────────────────────────────────────────────────

const markKey = (m: Pick<MarkInput, 'kind' | 'startDate' | 'endDate' | 'label'>) =>
  [m.kind, m.startDate, m.endDate, m.label].join('|');
const termKey = (t: Pick<TermInput, 'name' | 'startDate'>) => [t.name, t.startDate].join('|');

/**
 * Carga marcas y cuatrimestres. Es idempotente: lo que ya existe (mismo tipo, fechas y etiqueta;
 * o mismo nombre y fecha de inicio) se omite, asi que pulsar "Cargar" dos veces no duplica nada.
 * Todo se inserta en una sola transaccion.
 */
export async function importCalendar(
  database: Database,
  workspaceId: string,
  seed: { terms: TermInput[]; marks: MarkInput[] },
): Promise<ImportResult> {
  const existing = await getCalendar(database, workspaceId);
  const knownMarks = new Set(existing.marks.map(markKey));
  const knownTerms = new Set(existing.terms.map(termKey));

  // Tambien se evitan duplicados dentro del propio seed.
  const newMarks = seed.marks.filter(
    (m) => !knownMarks.has(markKey(m)) && knownMarks.add(markKey(m)),
  );
  const newTerms = seed.terms.filter(
    (t) => !knownTerms.has(termKey(t)) && knownTerms.add(termKey(t)),
  );

  const { db } = database;
  const statements = [
    ...newTerms.map((t) => db.insert(term).values({ workspaceId, ...t })),
    ...newMarks.map((m) => db.insert(calendarMark).values({ workspaceId, ...m })),
  ];
  const [first, ...rest] = statements;
  if (first) await db.batch([first, ...rest]);

  return {
    createdTerms: newTerms.length,
    skippedTerms: seed.terms.length - newTerms.length,
    createdMarks: newMarks.length,
    skippedMarks: seed.marks.length - newMarks.length,
  };
}
