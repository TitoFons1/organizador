import type { Subject, SubjectImpact, SubjectInput, SubjectPatch } from '@organizador/shared';
import { and, asc, eq, gte, isNotNull, isNull, lt, sql } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { subject } from '../../db/schema';
import { HttpError } from '../../http-error';
import { countSlots } from '../schedule/schedule';

type SubjectRow = typeof subject.$inferSelect;

const SHORT_NAME_FALLBACK_LENGTH = 12;

export function toSubject(row: SubjectRow): Subject {
  return {
    id: row.id,
    name: row.name,
    shortName: row.shortName,
    color: row.color,
    teacher: row.teacher,
    links: row.links,
    position: row.position,
    archivedAt: row.archivedAt?.toISOString() ?? null,
  };
}

const notFound = () => new HttpError(404, 'Asignatura no encontrada.', 'SUBJECT_NOT_FOUND');

/** Todas las consultas pasan por aqui para que NINGUNA olvide filtrar por espacio (D1). */
const inWorkspace = (workspaceId: string) => eq(subject.workspaceId, workspaceId);

export async function listSubjects(database: Database, workspaceId: string) {
  const rows = await database.db
    .select()
    .from(subject)
    .where(and(inWorkspace(workspaceId), isNull(subject.deletedAt)))
    .orderBy(asc(subject.position), asc(subject.createdAt));
  return rows.map(toSubject);
}

async function findActive(database: Database, workspaceId: string, id: string) {
  const row = await database.db
    .select()
    .from(subject)
    .where(and(inWorkspace(workspaceId), eq(subject.id, id), isNull(subject.deletedAt)))
    .get();
  if (!row) throw notFound();
  return row;
}

export async function getSubject(database: Database, workspaceId: string, id: string) {
  return toSubject(await findActive(database, workspaceId, id));
}

export async function createSubject(database: Database, workspaceId: string, input: SubjectInput) {
  const [row] = await database.db
    .insert(subject)
    .values({
      workspaceId,
      name: input.name,
      shortName: input.shortName ?? input.name.slice(0, SHORT_NAME_FALLBACK_LENGTH),
      color: input.color,
      teacher: input.teacher,
      links: input.links,
      // Calculado dentro del INSERT para que dos altas simultaneas no repitan posicion.
      position: sql<number>`(select coalesce(max(position), -1) + 1 from subject where workspace_id = ${workspaceId} and deleted_at is null)`,
    })
    .returning();
  return toSubject(row!);
}

export async function updateSubject(
  database: Database,
  workspaceId: string,
  id: string,
  patch: SubjectPatch,
) {
  const current = await findActive(database, workspaceId, id);
  const name = patch.name ?? current.name;
  const [row] = await database.db
    .update(subject)
    .set({
      name,
      // Si se vacia la abreviatura vuelve a derivarse del nombre.
      shortName:
        patch.shortName === undefined
          ? current.shortName
          : (patch.shortName ?? name.slice(0, SHORT_NAME_FALLBACK_LENGTH)),
      color: patch.color ?? current.color,
      teacher: patch.teacher === undefined ? current.teacher : patch.teacher,
      links: patch.links ?? current.links,
    })
    .where(and(inWorkspace(workspaceId), eq(subject.id, id)))
    .returning();
  return toSubject(row!);
}

export async function setArchived(
  database: Database,
  workspaceId: string,
  id: string,
  archived: boolean,
) {
  await findActive(database, workspaceId, id);
  const [row] = await database.db
    .update(subject)
    .set({ archivedAt: archived ? new Date() : null })
    .where(and(inWorkspace(workspaceId), eq(subject.id, id)))
    .returning();
  return toSubject(row!);
}

/** `ids` debe ser exactamente el conjunto de asignaturas vivas del espacio, en el orden nuevo. */
export async function reorderSubjects(database: Database, workspaceId: string, ids: string[]) {
  const current = await listSubjects(database, workspaceId);
  const known = new Set(current.map((item) => item.id));
  const sameSet = ids.length === known.size && new Set(ids).size === ids.length;
  if (!sameSet || !ids.every((id) => known.has(id))) {
    throw new HttpError(
      400,
      'La lista debe contener todas las asignaturas, sin repetidas.',
      'INVALID_ORDER',
    );
  }
  const { db } = database;
  const [first, ...rest] = ids.map((id, position) =>
    db
      .update(subject)
      .set({ position })
      .where(and(inWorkspace(workspaceId), eq(subject.id, id))),
  );
  if (first) await db.batch([first, ...rest]);
  return listSubjects(database, workspaceId);
}

/**
 * Que se vera afectado al borrar la asignatura. Cada hito que cuelgue datos de una asignatura
 * (franjas en M4, tareas en M5, notas en M7) suma aqui su contador.
 */
export async function subjectImpact(
  database: Database,
  workspaceId: string,
  id: string,
): Promise<SubjectImpact> {
  const row = await findActive(database, workspaceId, id);
  const slots = await countSlots(database, workspaceId, id);
  return { subject: { id: row.id, name: row.name }, tasks: 0, notes: 0, slots };
}

/** Compara sin importar mayusculas ni espacios en los extremos. */
const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function deleteSubject(
  database: Database,
  workspaceId: string,
  id: string,
  confirmName: string,
) {
  const row = await findActive(database, workspaceId, id);
  if (!sameName(row.name, confirmName)) {
    throw new HttpError(
      400,
      'El nombre no coincide: escribe el nombre exacto de la asignatura para borrarla.',
      'CONFIRM_NAME_MISMATCH',
    );
  }
  await database.db
    .update(subject)
    .set({ deletedAt: new Date() })
    .where(and(inWorkspace(workspaceId), eq(subject.id, id)));
}

// ── Papelera ────────────────────────────────────────────────────────────────

export async function listDeletedSubjects(database: Database, workspaceId: string, since: Date) {
  const rows = await database.db
    .select({ id: subject.id, name: subject.name, deletedAt: subject.deletedAt })
    .from(subject)
    .where(
      and(inWorkspace(workspaceId), isNotNull(subject.deletedAt), gte(subject.deletedAt, since)),
    );
  return rows.flatMap((row) => (row.deletedAt ? [{ ...row, deletedAt: row.deletedAt }] : []));
}

/** Devuelve `false` si no esta en la papelera de ese espacio (o ya caduco). */
export async function restoreSubject(
  database: Database,
  workspaceId: string,
  id: string,
  since: Date,
) {
  const rows = await listDeletedSubjects(database, workspaceId, since);
  if (!rows.some((row) => row.id === id)) return false;
  await database.db
    .update(subject)
    .set({
      deletedAt: null,
      // Vuelve al final de la lista, no a una posicion que quiza ya ocupa otra asignatura.
      position: sql<number>`(select coalesce(max(position), -1) + 1 from subject where workspace_id = ${workspaceId} and deleted_at is null)`,
    })
    .where(and(inWorkspace(workspaceId), eq(subject.id, id)));
  return true;
}

export async function purgeDeletedSubjects(database: Database, before: Date) {
  const result = await database.db
    .delete(subject)
    .where(and(isNotNull(subject.deletedAt), lt(subject.deletedAt, before)));
  return result.rowsAffected;
}
