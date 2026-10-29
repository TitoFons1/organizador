import {
  SLOT_PROBLEM_MESSAGES,
  slotProblems,
  type ExceptionInput,
  type ScheduleResponse,
  type Slot,
  type SlotException,
  type SlotInput,
  type SlotPatch,
} from '@organizador/shared';
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { scheduleSlot, slotException, subject } from '../../db/schema';
import { HttpError } from '../../http-error';

type SlotRow = typeof scheduleSlot.$inferSelect;
type ExceptionRow = typeof slotException.$inferSelect;

/** Los campos de una franja sin su id: lo que se valida y se guarda. */
const slotFieldsOf = (row: SlotRow): Omit<Slot, 'id'> => ({
  subjectId: row.subjectId,
  kind: row.kind,
  recurrence: row.recurrence,
  weekday: row.weekday,
  intervalWeeks: row.intervalWeeks,
  anchorDate: row.anchorDate,
  dates: row.dates,
  startTime: row.startTime,
  endTime: row.endTime,
  location: row.location,
  meetingUrl: row.meetingUrl,
  validFrom: row.validFrom,
  validTo: row.validTo,
});

const toSlot = (row: SlotRow): Slot => ({ id: row.id, ...slotFieldsOf(row) });

const toException = (row: ExceptionRow): SlotException => ({
  id: row.id,
  slotId: row.slotId,
  date: row.date,
  kind: row.kind,
  newDate: row.newDate,
  newStart: row.newStart,
  newEnd: row.newEnd,
  reason: row.reason,
});

const slotNotFound = () => new HttpError(404, 'Franja no encontrada.', 'SLOT_NOT_FOUND');
const subjectNotFound = () => new HttpError(404, 'Asignatura no encontrada.', 'SUBJECT_NOT_FOUND');

/** Todas las consultas pasan por aqui para que ninguna olvide filtrar por espacio (D1). */
const slotInWorkspace = (workspaceId: string) => eq(scheduleSlot.workspaceId, workspaceId);
const exceptionInWorkspace = (workspaceId: string) => eq(slotException.workspaceId, workspaceId);
// Las franjas de una asignatura en la papelera no existen para nadie hasta que se restaure.
const subjectIsLive = isNull(subject.deletedAt);

async function findSlot(database: Database, workspaceId: string, id: string) {
  const row = await database.db
    .select({ slot: scheduleSlot })
    .from(scheduleSlot)
    .innerJoin(subject, eq(subject.id, scheduleSlot.subjectId))
    .where(and(slotInWorkspace(workspaceId), eq(scheduleSlot.id, id), subjectIsLive))
    .get();
  if (!row) throw slotNotFound();
  return row.slot;
}

function assertCoherent(slot: Omit<Slot, 'id'>) {
  const [problem] = slotProblems(slot);
  if (problem) throw new HttpError(400, `${SLOT_PROBLEM_MESSAGES[problem]}.`, problem);
}

/** D3: franjas y excepciones en bruto; el cliente calcula las semanas con el motor. */
export async function getSchedule(
  database: Database,
  workspaceId: string,
): Promise<ScheduleResponse> {
  const { db } = database;
  const slots = await db
    .select({ slot: scheduleSlot })
    .from(scheduleSlot)
    .innerJoin(subject, eq(subject.id, scheduleSlot.subjectId))
    .where(and(slotInWorkspace(workspaceId), subjectIsLive))
    .orderBy(asc(scheduleSlot.createdAt));
  const ids = slots.map(({ slot }) => slot.id);
  const exceptions =
    ids.length === 0
      ? []
      : await db
          .select()
          .from(slotException)
          .where(and(exceptionInWorkspace(workspaceId), inArray(slotException.slotId, ids)))
          .orderBy(asc(slotException.date));
  return {
    slots: slots.map(({ slot }) => toSlot(slot)),
    exceptions: exceptions.map(toException),
  };
}

export async function createSlot(database: Database, workspaceId: string, input: SlotInput) {
  const owner = await database.db
    .select({ id: subject.id })
    .from(subject)
    .where(
      and(eq(subject.workspaceId, workspaceId), eq(subject.id, input.subjectId), subjectIsLive),
    )
    .get();
  if (!owner) throw subjectNotFound();

  const [row] = await database.db
    .insert(scheduleSlot)
    .values({ ...input, workspaceId })
    .returning();
  return toSlot(row!);
}

/** El PATCH valida la franja resultante: cambiar solo el intervalo puede dejarla sin ancla. */
export async function updateSlot(
  database: Database,
  workspaceId: string,
  id: string,
  patch: SlotPatch,
) {
  const next = { ...slotFieldsOf(await findSlot(database, workspaceId, id)), ...patch };
  assertCoherent(next);

  const [row] = await database.db
    .update(scheduleSlot)
    .set(next)
    .where(and(slotInWorkspace(workspaceId), eq(scheduleSlot.id, id)))
    .returning();
  return toSlot(row!);
}

/** Borrado definitivo: una franja se rehace en segundos. Sus excepciones caen en cascada. */
export async function deleteSlot(database: Database, workspaceId: string, id: string) {
  await findSlot(database, workspaceId, id);
  await database.db
    .delete(scheduleSlot)
    .where(and(slotInWorkspace(workspaceId), eq(scheduleSlot.id, id)));
}

export async function createException(
  database: Database,
  workspaceId: string,
  slotId: string,
  input: ExceptionInput,
) {
  await findSlot(database, workspaceId, slotId);

  // Un dia de clase solo puede estar cancelado o movido una vez (las clases extra no cuentan).
  if (input.kind !== 'extra') {
    const clash = await database.db
      .select({ id: slotException.id })
      .from(slotException)
      .where(
        and(
          exceptionInWorkspace(workspaceId),
          eq(slotException.slotId, slotId),
          eq(slotException.date, input.date),
          inArray(slotException.kind, ['cancelled', 'moved']),
        ),
      )
      .get();
    if (clash) {
      throw new HttpError(
        409,
        'Esa clase ya esta cancelada o movida: deshaz el cambio antes de hacer otro.',
        'EXCEPTION_EXISTS',
      );
    }
  }

  const [row] = await database.db
    .insert(slotException)
    .values({ ...input, slotId, workspaceId })
    .returning();
  return toException(row!);
}

export async function deleteException(database: Database, workspaceId: string, id: string) {
  const result = await database.db
    .delete(slotException)
    .where(and(exceptionInWorkspace(workspaceId), eq(slotException.id, id)));
  if (result.rowsAffected === 0) {
    throw new HttpError(404, 'Cambio no encontrado.', 'EXCEPTION_NOT_FOUND');
  }
}

/** Para el impacto de borrar una asignatura (doble confirmacion). */
export async function countSlots(database: Database, workspaceId: string, subjectId: string) {
  const [row] = await database.db
    .select({ total: count() })
    .from(scheduleSlot)
    .where(and(slotInWorkspace(workspaceId), eq(scheduleSlot.subjectId, subjectId)));
  return row?.total ?? 0;
}
