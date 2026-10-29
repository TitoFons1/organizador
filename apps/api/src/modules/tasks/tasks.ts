import type { Task, TaskInput, TaskPatch, TaskStatus } from '@organizador/shared';
import { and, count, eq, gte, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import type { Database } from '../../db/client';
import { subject, task, taskProgress } from '../../db/schema';
import { HttpError } from '../../http-error';
import type { Viewer } from '../workspaces/access';

type TaskRow = typeof task.$inferSelect;

const parent = alias(task, 'parent');

const notFound = () => new HttpError(404, 'Tarea no encontrada.', 'TASK_NOT_FOUND');

/**
 * D1 + visibilidad: del espacio y, si es personal, solo de quien la creo. Todas las consultas
 * pasan por aqui para que ninguna ensene la tarea personal de otra persona del grupo.
 */
const visibleTo = (viewer: Viewer) =>
  and(
    eq(task.workspaceId, viewer.workspaceId),
    or(eq(task.visibility, 'workspace'), eq(task.createdBy, viewer.userId)),
  );

// Viva: ni ella, ni su tarea madre, ni su asignatura estan en la papelera.
const isLive = and(isNull(task.deletedAt), isNull(parent.deletedAt), isNull(subject.deletedAt));

function toTask(row: TaskRow, status: TaskStatus | null, doneAt: Date | null): Task {
  return {
    id: row.id,
    subjectId: row.subjectId,
    parentId: row.parentId,
    visibility: row.visibility,
    title: row.title,
    description: row.description,
    type: row.type,
    dueDate: row.dueDate,
    dueTime: row.dueTime,
    priority: row.priority,
    estimateMin: row.estimateMin,
    createdBy: row.createdBy,
    status: status ?? 'todo',
    doneAt: doneAt?.toISOString() ?? null,
  };
}

function selectTasks(database: Database, viewer: Viewer) {
  return database.db
    .select({ task, status: taskProgress.status, doneAt: taskProgress.doneAt })
    .from(task)
    .leftJoin(parent, eq(parent.id, task.parentId))
    .leftJoin(subject, eq(subject.id, task.subjectId))
    .leftJoin(
      taskProgress,
      and(eq(taskProgress.taskId, task.id), eq(taskProgress.userId, viewer.userId)),
    );
}

export async function listTasks(database: Database, viewer: Viewer): Promise<Task[]> {
  const rows = await selectTasks(database, viewer)
    .where(and(visibleTo(viewer), isLive))
    .orderBy(task.createdAt);
  return rows.map((row) => toTask(row.task, row.status, row.doneAt));
}

async function findTask(database: Database, viewer: Viewer, id: string) {
  const row = await selectTasks(database, viewer)
    .where(and(visibleTo(viewer), isLive, eq(task.id, id)))
    .get();
  if (!row) throw notFound();
  return row;
}

async function assertSubjectIsLive(database: Database, workspaceId: string, subjectId: string) {
  const row = await database.db
    .select({ id: subject.id })
    .from(subject)
    .where(
      and(
        eq(subject.workspaceId, workspaceId),
        eq(subject.id, subjectId),
        isNull(subject.deletedAt),
      ),
    )
    .get();
  if (!row) throw new HttpError(404, 'Asignatura no encontrada.', 'SUBJECT_NOT_FOUND');
}

export async function createTask(database: Database, viewer: Viewer, input: TaskInput) {
  let values = input;
  if (input.parentId !== null) {
    const mother = (await findTask(database, viewer, input.parentId)).task;
    if (mother.parentId !== null) {
      throw new HttpError(400, 'Una subtarea no puede tener subtareas.', 'NESTED_SUBTASK');
    }
    // La subtarea va siempre con la asignatura y la visibilidad de su tarea madre.
    values = { ...input, subjectId: mother.subjectId, visibility: mother.visibility };
  } else if (input.subjectId !== null) {
    await assertSubjectIsLive(database, viewer.workspaceId, input.subjectId);
  }

  const [row] = await database.db
    .insert(task)
    .values({ ...values, workspaceId: viewer.workspaceId, createdBy: viewer.userId })
    .returning();
  return toTask(row!, null, null);
}

export async function updateTask(database: Database, viewer: Viewer, id: string, patch: TaskPatch) {
  const { task: current } = await findTask(database, viewer, id);
  if (
    patch.visibility !== undefined &&
    patch.visibility !== current.visibility &&
    current.createdBy !== viewer.userId
  ) {
    throw new HttpError(
      403,
      'Solo quien creó la tarea puede cambiar quién la ve.',
      'NOT_TASK_OWNER',
    );
  }

  // Una subtarea no cambia de asignatura ni de visibilidad: son las de su tarea madre.
  const next: TaskPatch = { ...patch };
  if (current.parentId !== null) {
    delete next.subjectId;
    delete next.visibility;
  }
  const subjectId = next.subjectId === undefined ? current.subjectId : next.subjectId;
  const visibility = next.visibility ?? current.visibility;
  const dueDate = next.dueDate === undefined ? current.dueDate : next.dueDate;
  const dueTime = next.dueTime === undefined ? current.dueTime : next.dueTime;
  if (dueTime !== null && dueDate === null) {
    throw new HttpError(400, 'Una hora de entrega necesita fecha.', 'TIME_WITHOUT_DATE');
  }
  if (next.subjectId) await assertSubjectIsLive(database, viewer.workspaceId, next.subjectId);

  const { db } = database;
  await db.batch([
    db
      .update(task)
      .set(next)
      .where(and(visibleTo(viewer), eq(task.id, id))),
    // Las subtareas siguen a su madre si cambia de asignatura o de visibilidad.
    db
      .update(task)
      .set({ subjectId, visibility })
      .where(and(eq(task.workspaceId, viewer.workspaceId), eq(task.parentId, id))),
  ]);
  const updated = await findTask(database, viewer, id);
  return toTask(updated.task, updated.status, updated.doneAt);
}

/** Borrado logico (D5): a la papelera. Sus subtareas se ocultan con ella y vuelven con ella. */
export async function deleteTask(database: Database, viewer: Viewer, id: string) {
  await findTask(database, viewer, id);
  await database.db
    .update(task)
    .set({ deletedAt: new Date() })
    .where(and(visibleTo(viewer), eq(task.id, id)));
}

export async function setProgress(
  database: Database,
  viewer: Viewer,
  id: string,
  status: TaskStatus,
) {
  const { task: row } = await findTask(database, viewer, id);
  const doneAt = status === 'done' ? new Date() : null;
  await database.db
    .insert(taskProgress)
    .values({ taskId: id, userId: viewer.userId, status, doneAt })
    .onConflictDoUpdate({
      target: [taskProgress.taskId, taskProgress.userId],
      set: { status, doneAt },
    });
  return toTask(row, status, doneAt);
}

/** Para el impacto de borrar una asignatura: tareas principales vivas que se iran con ella. */
export async function countTasks(database: Database, viewer: Viewer, subjectId: string) {
  const [row] = await database.db
    .select({ total: count() })
    .from(task)
    .where(
      and(
        visibleTo(viewer),
        eq(task.subjectId, subjectId),
        isNull(task.parentId),
        isNull(task.deletedAt),
      ),
    );
  return row?.total ?? 0;
}

// ── Papelera ────────────────────────────────────────────────────────────────

/** Lo que cada persona puede recuperar: lo borrado que ve y cuya tarea madre no esta borrada. */
export async function listDeletedTasks(database: Database, viewer: Viewer, since: Date) {
  const rows = await database.db
    .select({ id: task.id, name: task.title, deletedAt: task.deletedAt })
    .from(task)
    .leftJoin(parent, eq(parent.id, task.parentId))
    .where(
      and(
        visibleTo(viewer),
        isNotNull(task.deletedAt),
        gte(task.deletedAt, since),
        isNull(parent.deletedAt),
      ),
    );
  return rows.flatMap((row) => (row.deletedAt ? [{ ...row, deletedAt: row.deletedAt }] : []));
}

export async function restoreTask(database: Database, viewer: Viewer, id: string, since: Date) {
  const rows = await listDeletedTasks(database, viewer, since);
  if (!rows.some((row) => row.id === id)) return false;
  await database.db
    .update(task)
    .set({ deletedAt: null })
    .where(and(visibleTo(viewer), eq(task.id, id)));
  return true;
}

export async function purgeDeletedTasks(database: Database, before: Date) {
  const result = await database.db
    .delete(task)
    .where(and(isNotNull(task.deletedAt), lt(task.deletedAt, before)));
  return result.rowsAffected;
}
