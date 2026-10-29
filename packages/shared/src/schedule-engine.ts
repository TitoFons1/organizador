import { courseBounds, dominantMark, marksOn, type Mark } from './calendar';
import { addDays, dayNumber, startOfWeek, weekday, type CivilDate } from './civil-date';
import type { CivilTime, Slot, SlotException, SlotKind } from './schedule';

/**
 * Motor de horario (D2): a partir de las franjas, sus excepciones y el calendario del curso
 * calcula las clases reales de un rango de fechas. Es una funcion pura sobre fechas y horas
 * civiles, asi que da lo mismo en el navegador que en el servidor y no le afecta el cambio de hora.
 *
 * Orden de precedencia de una fecha candidata: excepcion (cancelada/movida) > calendario
 * (dia bloqueado) > regla. Las clases movidas aqui y las extra se anaden aunque el dia este
 * bloqueado o fuera del curso: son decisiones explicitas.
 */

export type OccurrenceStatus = 'scheduled' | 'cancelled' | 'moved' | 'blocked';

export interface Occurrence {
  slotId: string;
  subjectId: string;
  kind: SlotKind;
  date: CivilDate;
  start: CivilTime;
  end: CivilTime;
  status: OccurrenceStatus;
  /** Motivo de la cancelacion o del cambio, o etiqueta de la marca que bloquea el dia. */
  reason: string | null;
  /** Excepcion que crea o modifica esta clase (para deshacerla). */
  exceptionId: string | null;
  /** `moved`: adonde se fue la clase. */
  movedTo: { date: CivilDate; start: CivilTime; end: CivilTime } | null;
  /** Clase que llega movida desde otro dia. */
  movedFrom: CivilDate | null;
  /** Clase anadida que no sale de la regla. */
  extra: boolean;
}

export type SlotRule = Pick<
  Slot,
  | 'id'
  | 'subjectId'
  | 'kind'
  | 'recurrence'
  | 'weekday'
  | 'intervalWeeks'
  | 'anchorDate'
  | 'dates'
  | 'startTime'
  | 'endTime'
  | 'validFrom'
  | 'validTo'
>;

export type ExceptionRule = Pick<
  SlotException,
  'id' | 'slotId' | 'date' | 'kind' | 'newDate' | 'newStart' | 'newEnd' | 'reason'
>;

export type CalendarRule = Pick<Mark, 'kind' | 'startDate' | 'endDate' | 'blocksClasses' | 'label'>;

export interface ScheduleData {
  slots: readonly SlotRule[];
  exceptions: readonly ExceptionRule[];
  marks: readonly CalendarRule[];
}

export interface DateRange {
  from: CivilDate;
  to: CivilDate;
}

const later = (a: CivilDate, b: CivilDate | null) => (b !== null && b > a ? b : a);
const earlier = (a: CivilDate, b: CivilDate | null) => (b !== null && b < a ? b : a);
const inRange = (date: CivilDate, range: DateRange) => range.from <= date && date <= range.to;
const mod = (value: number, n: number) => ((value % n) + n) % n;

/** Semanas (de lunes a domingo) que separan dos fechas; negativo si `b` es anterior. */
function weeksBetween(a: CivilDate, b: CivilDate): number {
  return (dayNumber(startOfWeek(b)) - dayNumber(startOfWeek(a))) / 7;
}

/** Fechas que cumple la regla dentro de `[from, to]`, sin mirar excepciones ni calendario. */
function candidates(slot: SlotRule, from: CivilDate, to: CivilDate): CivilDate[] {
  if (to < from) return [];
  if (slot.recurrence === 'dates') {
    return [...new Set(slot.dates ?? [])].filter((date) => from <= date && date <= to).sort();
  }
  if (slot.weekday === null) return [];

  const first = addDays(from, mod(slot.weekday - weekday(from), 7));
  const anchor = slot.anchorDate ?? first;
  const result: CivilDate[] = [];
  for (let date = first; date <= to; date = addDays(date, 7)) {
    if (mod(weeksBetween(anchor, date), slot.intervalWeeks) === 0) result.push(date);
  }
  return result;
}

/** Etiqueta de la marca que anula clases ese dia (la de mas prioridad), o `null`. */
function blockingReason(marks: readonly CalendarRule[], date: CivilDate): string | null {
  return dominantMark(marksOn(marks, date).filter((mark) => mark.blocksClasses))?.label ?? null;
}

export function expand(range: DateRange, data: ScheduleData): Occurrence[] {
  if (range.to < range.from) return [];
  const course = courseBounds(data.marks);
  const occurrences: Occurrence[] = [];

  for (const slot of data.slots) {
    const exceptions = data.exceptions.filter((exception) => exception.slotId === slot.id);
    const onDate = (date: CivilDate) =>
      exceptions.find(
        (exception) =>
          exception.date === date && (exception.kind === 'cancelled' || exception.kind === 'moved'),
      );
    const base = {
      slotId: slot.id,
      subjectId: slot.subjectId,
      kind: slot.kind,
      reason: null,
      exceptionId: null,
      movedTo: null,
      movedFrom: null,
      extra: false,
    } satisfies Partial<Occurrence>;

    // 1. Lo que dice la regla, recortado al curso y a la vigencia de la franja.
    const from = later(later(range.from, course.start), slot.validFrom);
    const to = earlier(earlier(range.to, course.end), slot.validTo);
    for (const date of candidates(slot, from, to)) {
      const occurrence: Occurrence = {
        ...base,
        date,
        start: slot.startTime,
        end: slot.endTime,
        status: 'scheduled',
      };
      const exception = onDate(date);
      if (exception?.kind === 'cancelled') {
        occurrences.push({
          ...occurrence,
          status: 'cancelled',
          reason: exception.reason,
          exceptionId: exception.id,
        });
      } else if (exception?.kind === 'moved') {
        occurrences.push({
          ...occurrence,
          status: 'moved',
          reason: exception.reason,
          exceptionId: exception.id,
          movedTo: {
            date: exception.newDate ?? date,
            start: exception.newStart ?? slot.startTime,
            end: exception.newEnd ?? slot.endTime,
          },
        });
      } else {
        const blocked = blockingReason(data.marks, date);
        occurrences.push(
          blocked === null ? occurrence : { ...occurrence, status: 'blocked', reason: blocked },
        );
      }
    }

    // 2. Clases que llegan movidas desde otro dia y clases extra.
    for (const exception of exceptions) {
      const date = exception.kind === 'moved' ? exception.newDate : exception.date;
      if (exception.kind === 'cancelled' || date === null || !inRange(date, range)) continue;
      occurrences.push({
        ...base,
        date,
        start: exception.newStart ?? slot.startTime,
        end: exception.newEnd ?? slot.endTime,
        status: 'scheduled',
        reason: exception.reason,
        exceptionId: exception.id,
        movedFrom: exception.kind === 'moved' ? exception.date : null,
        extra: exception.kind === 'extra',
      });
    }
  }

  return occurrences.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.start.localeCompare(b.start) ||
      a.slotId.localeCompare(b.slotId),
  );
}

/** Minutos desde las 00:00 de una hora `HH:MM`. */
export const minutesOf = (time: CivilTime) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** Minutos antes del inicio desde los que se ofrece "Unirme" (docs/01, 7.2). */
export const JOIN_WINDOW_MIN = 15;

/** `true` desde 15 minutos antes de una clase que se imparte hoy hasta que termina. */
export function isJoinable(
  occurrence: Pick<Occurrence, 'date' | 'start' | 'end' | 'status'>,
  now: { date: CivilDate; time: CivilTime },
): boolean {
  if (occurrence.status !== 'scheduled' || occurrence.date !== now.date) return false;
  const minute = minutesOf(now.time);
  return (
    minute >= minutesOf(occurrence.start) - JOIN_WINDOW_MIN && minute < minutesOf(occurrence.end)
  );
}

/** Lunes a domingo de la semana que contiene `date`. */
export function weekOf(date: CivilDate): DateRange {
  const from = startOfWeek(date);
  return { from, to: addDays(from, 6) };
}

/** Parejas de clases que se pisan el mismo dia (solo las que se imparten de verdad). */
export function findOverlaps(occurrences: readonly Occurrence[]): [Occurrence, Occurrence][] {
  const live = occurrences.filter((occurrence) => occurrence.status === 'scheduled');
  const pairs: [Occurrence, Occurrence][] = [];
  live.forEach((a, index) => {
    for (const b of live.slice(index + 1)) {
      if (a.date === b.date && a.start < b.end && b.start < a.end) pairs.push([a, b]);
    }
  });
  return pairs;
}
