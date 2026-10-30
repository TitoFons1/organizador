import {
  expand,
  findOverlaps,
  type DateRange,
  type Mark,
  type Occurrence,
  type SessionRecord,
  type Slot,
  type Subject,
} from '@organizador/shared';
import { useQuery } from '@tanstack/react-query';
import { CALENDAR_KEY, fetchCalendar } from '../calendar/api';
import { fetchSubjects, SUBJECTS_KEY } from '../subjects/api';
import { fetchSchedule, SCHEDULE_KEY } from './api';

/**
 * Clave estable de una clase concreta. La de la regla no cambia al cancelarla o moverla (si no, la
 * clase elegida en la rejilla se perderia tras el cambio); las extra y las que llegan movidas de
 * otro dia nacen de su excepcion y usan su id (puede haber una extra el mismo dia que la regla).
 */
export const occurrenceKey = (
  o: Pick<Occurrence, 'slotId' | 'date' | 'exceptionId' | 'extra' | 'movedFrom'>,
) => `${o.slotId}|${o.date}|${o.extra || o.movedFrom ? o.exceptionId : 'regla'}`;

export interface ScheduleModel {
  /** Asignaturas no archivadas (las archivadas ya terminaron: no salen en el dia a dia). */
  active: Map<string, Subject>;
  slots: Slot[];
  slotById: Map<string, Slot>;
  marks: Mark[];
  /** Clases reales de un rango, con las que se solapan marcadas. */
  occurrencesIn: (range: DateRange) => { occurrences: Occurrence[]; overlapping: Set<Occurrence> };
  recordOf: (slotId: string, date: string) => SessionRecord | undefined;
}

/** Asignaturas + calendario + horario, listos para el motor (D2/D3). */
export function useScheduleData() {
  const subjects = useQuery({ queryKey: SUBJECTS_KEY, queryFn: fetchSubjects });
  const calendar = useQuery({ queryKey: CALENDAR_KEY, queryFn: fetchCalendar });
  const schedule = useQuery({ queryKey: SCHEDULE_KEY, queryFn: fetchSchedule });
  const queries = [subjects, calendar, schedule];
  const retry = () => queries.forEach((query) => void query.refetch());

  if (queries.some((query) => query.isPending)) return { status: 'pending' as const, retry };
  if (!subjects.data || !calendar.data || !schedule.data) {
    return { status: 'error' as const, retry };
  }

  const active = new Map(
    subjects.data.filter((subject) => subject.archivedAt === null).map((s) => [s.id, s]),
  );
  const slots = schedule.data.slots.filter((slot) => active.has(slot.subjectId));
  const { marks } = calendar.data;
  const { exceptions, sessionRecords } = schedule.data;
  const model: ScheduleModel = {
    active,
    slots,
    slotById: new Map(slots.map((slot) => [slot.id, slot])),
    marks,
    occurrencesIn: (range) => {
      const occurrences = expand(range, { slots, exceptions, marks });
      return { occurrences, overlapping: new Set(findOverlaps(occurrences).flat()) };
    },
    recordOf: (slotId, date) =>
      sessionRecords.find((record) => record.slotId === slotId && record.date === date),
  };
  return { status: 'ready' as const, retry, model };
}
