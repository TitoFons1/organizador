import { describe, expect, it } from 'vitest';
import seed from '../../../data/calendario-2026-2027.seed.json';
import porFechas from '../../../data/fixtures/ejemplo-tutorias-por-fechas.json';
import programacion from '../../../data/fixtures/programacion-videotutorias-2026-27.json';
import { normalizeSeed } from './calendar';
import { weekday } from './civil-date';
import {
  expand,
  findOverlaps,
  weekOf,
  type CalendarRule,
  type ExceptionRule,
  type Occurrence,
  type ScheduleData,
  type SlotRule,
} from './schedule-engine';

const COURSE = normalizeSeed(seed).marks;
const WHOLE_COURSE = { from: '2026-09-01', to: '2027-08-31' };

const slot = (overrides: Partial<SlotRule> = {}): SlotRule => ({
  id: 'pro',
  subjectId: 'programacion',
  kind: 'tutoria',
  recurrence: 'weekly',
  weekday: 2, // martes
  intervalWeeks: 1,
  anchorDate: null,
  dates: null,
  startTime: '17:40',
  endTime: '19:25',
  validFrom: null,
  validTo: null,
  ...overrides,
});

const exception = (overrides: Partial<ExceptionRule> & Pick<ExceptionRule, 'date' | 'kind'>) => ({
  id: `e-${overrides.kind}-${overrides.date}`,
  slotId: 'pro',
  newDate: null,
  newStart: null,
  newEnd: null,
  reason: null,
  ...overrides,
});

const data = (overrides: Partial<ScheduleData> = {}): ScheduleData => ({
  slots: [slot()],
  exceptions: [],
  marks: COURSE,
  ...overrides,
});

const dates = (occurrences: Occurrence[], status: Occurrence['status'] = 'scheduled') =>
  occurrences.filter((o) => o.status === status).map((o) => o.date);

const only = (occurrences: Occurrence[], date: string) => {
  const found = occurrences.filter((o) => o.date === date);
  expect(found).toHaveLength(1);
  return found[0]!;
};

describe('PRUEBAS DORADAS con el calendario real 2026-27', () => {
  it('Programacion, "todos los martes": exactamente los 27 martes del PDF', () => {
    const result = expand(WHOLE_COURSE, data());
    expect(dates(result)).toEqual(programacion.dates);
    expect(programacion.dates).toHaveLength(27);
  });

  it('BBDD, "todos los lunes": 26 lunes lectivos', () => {
    const result = expand(WHOLE_COURSE, data({ slots: [slot({ id: 'bbdd', weekday: 1 })] }));
    const mondays = dates(result);
    expect(mondays).toHaveLength(26);
    expect(mondays.every((date) => weekday(date) === 1)).toBe(true);
    expect(mondays[0]).toBe('2026-10-05');
    expect(mondays.at(-1)).toBe('2027-06-07');
  });

  it('recurrencia "dates": las 15 fechas sueltas del ejemplo, ni una mas', () => {
    const result = expand(
      WHOLE_COURSE,
      data({ slots: [slot({ recurrence: 'dates', weekday: null, dates: porFechas.dates })] }),
    );
    expect(dates(result)).toEqual(porFechas.dates);
  });

  it('CRITERIO DE M4: la semana del 12 oct muestra 12-14 como festivos y el resto normal', () => {
    const slots = [
      slot({ id: 'bbdd', subjectId: 'bbdd', weekday: 1, startTime: '16:00', endTime: '18:00' }),
      slot({ id: 'pro', weekday: 2 }),
      slot({ id: 'sis', subjectId: 'sistemas', weekday: 3, startTime: '18:00', endTime: '19:00' }),
      slot({ id: 'ent', subjectId: 'entornos', weekday: 4, startTime: '16:00', endTime: '17:00' }),
    ];
    const week = expand(weekOf('2026-10-14'), data({ slots }));

    expect(week.map((o) => [o.date, o.status, o.reason])).toEqual([
      ['2026-10-12', 'blocked', 'Festivo (Pilar)'],
      ['2026-10-13', 'blocked', 'Festivo Zaragoza'],
      ['2026-10-14', 'blocked', 'Festivo Zaragoza'],
      ['2026-10-15', 'scheduled', null],
    ]);
  });
});

describe('semanas alternas', () => {
  it('cada 2 semanas desde el ancla, tambien hacia atras', () => {
    const result = expand(
      { from: '2026-10-01', to: '2026-11-30' },
      data({ slots: [slot({ intervalWeeks: 2, anchorDate: '2026-10-20' })], marks: [] }),
    );
    expect(dates(result)).toEqual(['2026-10-06', '2026-10-20', '2026-11-03', '2026-11-17']);
  });

  it('un ancla una semana despues cambia la paridad', () => {
    const result = expand(
      { from: '2026-10-01', to: '2026-11-30' },
      data({ slots: [slot({ intervalWeeks: 2, anchorDate: '2026-10-27' })], marks: [] }),
    );
    expect(dates(result)).toEqual(['2026-10-13', '2026-10-27', '2026-11-10', '2026-11-24']);
  });

  it('la paridad es fija: si un festivo se come una clase, la siguiente no se desplaza', () => {
    // Ancla el 13 oct, que es festivo: la siguiente es el 27 (dos semanas despues de la regla),
    // no el 20 (dos semanas despues de la ultima clase impartida).
    const quincenal = slot({ intervalWeeks: 2, anchorDate: '2026-10-13' });
    const result = expand({ from: '2026-10-01', to: '2026-12-31' }, data({ slots: [quincenal] }));
    expect(dates(result, 'blocked')).toEqual(['2026-10-13', '2026-12-08', '2026-12-22']);
    expect(dates(result)).toEqual(['2026-10-27', '2026-11-10', '2026-11-24']);
  });

  it('cada 3 y cada 4 semanas', () => {
    const range = { from: '2026-10-01', to: '2026-12-31' };
    const every = (intervalWeeks: number) =>
      dates(
        expand(
          range,
          data({ slots: [slot({ intervalWeeks, anchorDate: '2026-10-06' })], marks: [] }),
        ),
      );
    expect(every(3)).toEqual([
      '2026-10-06',
      '2026-10-27',
      '2026-11-17',
      '2026-12-08',
      '2026-12-29',
    ]);
    expect(every(4)).toEqual(['2026-10-06', '2026-11-03', '2026-12-01', '2026-12-29']);
  });
});

describe('calendario del curso', () => {
  it('festivos, vacaciones y examenes bloquean con su motivo; las defensas no', () => {
    const result = expand(WHOLE_COURSE, data());
    expect(only(result, '2026-12-08')).toMatchObject({
      status: 'blocked',
      reason: 'Festivo (puente + Inmaculada)',
    });
    expect(only(result, '2026-12-29')).toMatchObject({
      status: 'blocked',
      reason: 'Vacaciones de Navidad',
    });
    expect(only(result, '2027-02-02')).toMatchObject({
      status: 'blocked',
      reason: 'Examenes 1er cuatrimestre',
    });
    expect(only(result, '2027-05-25')).toMatchObject({ status: 'scheduled', reason: null });
  });

  it('no hay clases fuera del curso aunque el rango sea mayor', () => {
    const result = expand(WHOLE_COURSE, data());
    expect(result[0]!.date).toBe('2026-10-06');
    expect(result.at(-1)!.date).toBe('2027-06-15');
  });

  it('sin inicio ni fin de curso solo recorta el rango pedido', () => {
    const result = expand({ from: '2026-10-01', to: '2026-10-31' }, data({ marks: [] }));
    expect(dates(result)).toEqual(['2026-10-06', '2026-10-13', '2026-10-20', '2026-10-27']);
  });

  it('si dos marcas bloquean el mismo dia, el motivo es el de mas prioridad', () => {
    const marks: CalendarRule[] = [
      {
        kind: 'festivo',
        startDate: '2026-10-13',
        endDate: '2026-10-13',
        blocksClasses: true,
        label: 'Festivo',
      },
      {
        kind: 'examenes',
        startDate: '2026-10-12',
        endDate: '2026-10-16',
        blocksClasses: true,
        label: 'Examenes',
      },
    ];
    const result = expand({ from: '2026-10-12', to: '2026-10-18' }, data({ marks }));
    expect(only(result, '2026-10-13').reason).toBe('Examenes');
  });

  it('respeta la vigencia de la franja (validFrom / validTo)', () => {
    const segundo = slot({ validFrom: '2027-02-08', validTo: '2027-02-28' });
    const result = expand(WHOLE_COURSE, data({ slots: [segundo] }));
    expect(dates(result)).toEqual(['2027-02-09', '2027-02-16', '2027-02-23']);
  });
});

describe('excepciones', () => {
  const range = { from: '2026-10-19', to: '2026-11-01' };

  it('cancelar una clase la deja visible como cancelada, con su motivo', () => {
    const cancel = exception({ date: '2026-10-20', kind: 'cancelled', reason: 'Huelga' });
    const result = expand(range, data({ exceptions: [cancel] }));
    expect(only(result, '2026-10-20')).toMatchObject({
      status: 'cancelled',
      reason: 'Huelga',
      exceptionId: cancel.id,
    });
    expect(only(result, '2026-10-27').status).toBe('scheduled');
  });

  it('mover una clase: el dia original queda como movida y aparece en el nuevo dia y hora', () => {
    const move = exception({
      date: '2026-10-20',
      kind: 'moved',
      newDate: '2026-10-22',
      newStart: '10:00',
      newEnd: '11:30',
      reason: 'Cambio de aula',
    });
    const result = expand(range, data({ exceptions: [move] }));
    expect(only(result, '2026-10-20')).toMatchObject({
      status: 'moved',
      movedTo: { date: '2026-10-22', start: '10:00', end: '11:30' },
    });
    expect(only(result, '2026-10-22')).toMatchObject({
      status: 'scheduled',
      start: '10:00',
      end: '11:30',
      movedFrom: '2026-10-20',
      exceptionId: move.id,
    });
  });

  it('mover sin hora nueva conserva la de la franja; si el destino cae fuera del rango no sale', () => {
    const move = exception({ date: '2026-10-27', kind: 'moved', newDate: '2026-11-05' });
    const result = expand(range, data({ exceptions: [move] }));
    expect(only(result, '2026-10-27').movedTo).toEqual({
      date: '2026-11-05',
      start: '17:40',
      end: '19:25',
    });
    expect(result.some((o) => o.date === '2026-11-05')).toBe(false);
  });

  it('una clase extra o movida a un dia bloqueado se mantiene (decision explicita)', () => {
    const extra = exception({
      date: '2027-02-03',
      kind: 'extra',
      newStart: '09:00',
      newEnd: '10:00',
    });
    const move = exception({ date: '2027-01-26', kind: 'moved', newDate: '2027-02-04' });
    const result = expand(
      { from: '2027-01-25', to: '2027-02-07' },
      data({ exceptions: [extra, move] }),
    );
    expect(only(result, '2027-02-03')).toMatchObject({
      status: 'scheduled',
      extra: true,
      start: '09:00',
    });
    expect(only(result, '2027-02-04')).toMatchObject({
      status: 'scheduled',
      movedFrom: '2027-01-26',
    });
    // El martes de examenes sigue bloqueado.
    expect(only(result, '2027-02-02').status).toBe('blocked');
  });

  it('cancelar manda sobre el bloqueo, y las excepciones de otra franja no afectan', () => {
    const cancel = exception({ date: '2026-10-13', kind: 'cancelled', reason: 'Ya avisado' });
    const otherSlot = exception({ date: '2026-10-20', kind: 'cancelled', slotId: 'otra' });
    const result = expand(
      { from: '2026-10-12', to: '2026-10-25' },
      data({ exceptions: [cancel, otherSlot] }),
    );
    expect(only(result, '2026-10-13').status).toBe('cancelled');
    expect(only(result, '2026-10-20').status).toBe('scheduled');
  });
});

describe('cambio de hora y fechas', () => {
  it('las semanas del 25 oct 2026 y del 28 mar 2027 mantienen dia y hora', () => {
    const otono = expand(weekOf('2026-10-26'), data({ marks: [] }));
    expect(otono.map((o) => [o.date, o.start, o.end])).toEqual([['2026-10-27', '17:40', '19:25']]);
    const primavera = expand(weekOf('2027-03-29'), data({ marks: [] }));
    expect(primavera.map((o) => [o.date, o.start, o.end])).toEqual([
      ['2027-03-30', '17:40', '19:25'],
    ]);
  });

  it('weekOf va de lunes a domingo', () => {
    expect(weekOf('2026-10-14')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
    expect(weekOf('2026-10-18')).toEqual({ from: '2026-10-12', to: '2026-10-18' });
  });

  it('un rango vacio o al reves no da clases', () => {
    expect(expand({ from: '2026-10-20', to: '2026-10-19' }, data())).toEqual([]);
    expect(expand({ from: '2026-10-21', to: '2026-10-26' }, data())).toEqual([]);
  });

  it('una franja semanal sin dia o "dates" sin fechas no genera nada (dato incompleto)', () => {
    const slots = [slot({ weekday: null }), slot({ id: 'b', recurrence: 'dates', dates: null })];
    expect(expand(WHOLE_COURSE, data({ slots }))).toEqual([]);
  });

  it('fechas sueltas repetidas o fuera del curso se ignoran, y salen ordenadas', () => {
    const fechas = slot({
      recurrence: 'dates',
      dates: ['2026-11-09', '2026-10-05', '2026-11-09', '2025-01-01'],
    });
    expect(dates(expand(WHOLE_COURSE, data({ slots: [fechas] })))).toEqual([
      '2026-10-05',
      '2026-11-09',
    ]);
  });
});

describe('solapes', () => {
  it('detecta dos clases que se pisan el mismo dia, no las que solo se tocan', () => {
    const slots = [
      slot({ id: 'a', startTime: '16:00', endTime: '18:00' }),
      slot({ id: 'b', startTime: '17:00', endTime: '19:00' }),
      slot({ id: 'c', startTime: '18:00', endTime: '19:00' }),
    ];
    const week = expand(weekOf('2026-10-20'), data({ slots, marks: [] }));
    const pairs = findOverlaps(week).map(([x, y]) => [x.slotId, y.slotId]);
    expect(pairs).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ]);
  });

  it('las clases canceladas o bloqueadas no cuentan como solape', () => {
    const slots = [slot({ id: 'a' }), slot({ id: 'b' })];
    const week = expand(weekOf('2026-10-13'), data({ slots }));
    expect(week.every((o) => o.status === 'blocked')).toBe(true);
    expect(findOverlaps(week)).toEqual([]);
  });
});
