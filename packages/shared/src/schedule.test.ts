import { describe, expect, it } from 'vitest';
import {
  exceptionInputSchema,
  isCivilTime,
  slotInputSchema,
  slotProblems,
  type ExceptionInput,
  type SlotInput,
} from './schedule';

const weekly: SlotInput = {
  subjectId: 'pro',
  kind: 'clase',
  recurrence: 'weekly',
  weekday: 2,
  intervalWeeks: 1,
  anchorDate: null,
  dates: null,
  startTime: '17:40',
  endTime: '19:25',
  location: null,
  meetingUrl: null,
  validFrom: null,
  validTo: null,
};

describe('horas civiles', () => {
  it('acepta HH:MM de 00:00 a 23:59 y nada mas', () => {
    for (const ok of ['00:00', '09:05', '17:40', '23:59']) expect(isCivilTime(ok)).toBe(true);
    for (const bad of ['7:40', '24:00', '17:60', '17h40', '']) expect(isCivilTime(bad)).toBe(false);
  });
});

describe('franjas', () => {
  it('acepta una franja semanal valida', () => {
    expect(slotInputSchema.safeParse(weekly).success).toBe(true);
    expect(slotProblems(weekly)).toEqual([]);
  });

  it('detecta cada incoherencia con un codigo propio', () => {
    expect(slotProblems({ ...weekly, endTime: '17:40' })).toEqual(['END_NOT_AFTER_START']);
    expect(slotProblems({ ...weekly, weekday: null })).toEqual(['WEEKDAY_REQUIRED']);
    expect(slotProblems({ ...weekly, intervalWeeks: 2 })).toEqual(['ANCHOR_REQUIRED']);
    expect(slotProblems({ ...weekly, anchorDate: '2026-10-14' })).toEqual(['ANCHOR_WRONG_WEEKDAY']);
    expect(slotProblems({ ...weekly, recurrence: 'dates', dates: [] })).toEqual(['DATES_REQUIRED']);
    expect(slotProblems({ ...weekly, validFrom: '2027-02-08', validTo: '2027-02-01' })).toEqual([
      'INVALID_VALIDITY',
    ]);
  });

  it('una franja quincenal con ancla en el dia correcto es valida', () => {
    const quincenal = { ...weekly, intervalWeeks: 2, anchorDate: '2026-10-13' };
    expect(slotInputSchema.safeParse(quincenal).success).toBe(true);
  });

  it('rechaza horas y fechas mal escritas sin lanzar excepciones', () => {
    for (const bad of [
      { startTime: '7:40' },
      { endTime: '25:00' },
      { anchorDate: 'abc' },
      { intervalWeeks: 5 },
      { weekday: 8 },
      { meetingUrl: 'javascript:alert(1)' },
    ]) {
      expect(slotInputSchema.safeParse({ ...weekly, ...bad }).success, JSON.stringify(bad)).toBe(
        false,
      );
    }
  });
});

describe('excepciones', () => {
  const cancelled: ExceptionInput = {
    date: '2026-10-20',
    kind: 'cancelled',
    newDate: null,
    newStart: null,
    newEnd: null,
    reason: 'Huelga',
  };

  it('acepta cancelar, mover (con o sin hora nueva) y anadir una clase extra', () => {
    expect(exceptionInputSchema.safeParse(cancelled).success).toBe(true);
    const moved = { ...cancelled, kind: 'moved', newDate: '2026-10-22' } as const;
    expect(exceptionInputSchema.safeParse(moved).success).toBe(true);
    expect(
      exceptionInputSchema.safeParse({ ...moved, newStart: '10:00', newEnd: '11:00' }).success,
    ).toBe(true);
    expect(
      exceptionInputSchema.safeParse({
        ...cancelled,
        kind: 'extra',
        newStart: '09:00',
        newEnd: '10:00',
      }).success,
    ).toBe(true);
  });

  it('rechaza combinaciones sin sentido', () => {
    for (const bad of [
      { kind: 'moved' }, // sin fecha nueva
      { newDate: '2026-10-22' }, // cancelada con fecha nueva
      { newStart: '10:00', newEnd: '11:00' }, // cancelada con horario
      { kind: 'extra', newStart: '10:00' }, // solo una hora
      { kind: 'extra', newStart: '11:00', newEnd: '10:00' }, // fin antes que inicio
      { reason: '   ' },
    ]) {
      expect(
        exceptionInputSchema.safeParse({ ...cancelled, ...bad }).success,
        JSON.stringify(bad),
      ).toBe(false);
    }
  });
});
