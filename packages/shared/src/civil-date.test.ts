import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  dayNumber,
  daysInMonth,
  diffDays,
  eachDay,
  fromDayNumber,
  isCivilDate,
  monthOf,
  startOfWeek,
  todayCivil,
  weekday,
} from './civil-date';

describe('isCivilDate', () => {
  it.each(['2026-10-13', '2028-02-29', '2000-02-29', '2026-12-31'])('acepta %s', (value) => {
    expect(isCivilDate(value)).toBe(true);
  });

  it.each([
    '2026-02-30',
    '2027-02-29', // 2027 no es bisiesto
    '1900-02-29', // siglo no bisiesto
    '2026-13-01',
    '2026-00-10',
    '2026-10-00',
    '2026-1-5',
    '26-10-13',
    '2026-10-13T10:00',
    '',
  ])('rechaza %s', (value) => {
    expect(isCivilDate(value)).toBe(false);
  });
});

describe('aritmetica de dias', () => {
  it('dayNumber y fromDayNumber son inversas', () => {
    for (const date of ['1970-01-01', '2026-10-25', '2027-03-28', '2028-02-29', '1969-12-31']) {
      expect(fromDayNumber(dayNumber(date))).toBe(date);
    }
    expect(dayNumber('1970-01-01')).toBe(0);
    expect(dayNumber('1969-12-31')).toBe(-1);
  });

  it('suma dias cruzando meses, anos y bisiestos', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-10-13', -13)).toBe('2026-09-30');
  });

  it('no se altera con los cambios de hora (25 oct 2026 y 28 mar 2027)', () => {
    // Domingo 25 de octubre de 2026: el dia dura 25 h; el de marzo de 2027, 23 h.
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
    expect(addDays('2027-03-27', 1)).toBe('2027-03-28');
    expect(addDays('2027-03-28', 1)).toBe('2027-03-29');
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(diffDays('2027-03-27', '2027-03-29')).toBe(2);
  });

  it('diffDays cuenta con signo', () => {
    expect(diffDays('2026-10-01', '2027-06-18')).toBe(260);
    expect(diffDays('2027-06-18', '2026-10-01')).toBe(-260);
    expect(diffDays('2026-10-13', '2026-10-13')).toBe(0);
  });

  it('daysInMonth', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 10)).toBe(31);
    expect(daysInMonth(2026, 11)).toBe(30);
  });
});

describe('weekday (ISO: lunes = 1)', () => {
  it.each([
    ['2026-10-01', 4], // jueves: inicio de curso
    ['2026-10-12', 1], // lunes (Pilar)
    ['2026-10-13', 2], // martes
    ['2026-10-25', 7], // domingo (cambio de hora)
    ['2027-03-28', 7], // domingo (cambio de hora)
    ['2027-06-18', 5], // viernes: fin de curso
    ['1970-01-01', 4],
    ['1969-12-31', 3],
  ])('%s -> %i', (date, expected) => {
    expect(weekday(date)).toBe(expected);
  });

  it('startOfWeek devuelve el lunes', () => {
    expect(startOfWeek('2026-10-14')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-12')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-18')).toBe('2026-10-12');
    expect(startOfWeek('2026-10-19')).toBe('2026-10-19');
  });
});

describe('eachDay', () => {
  it('incluye ambos extremos', () => {
    expect(eachDay('2026-10-13', '2026-10-14')).toEqual(['2026-10-13', '2026-10-14']);
    expect(eachDay('2026-10-13', '2026-10-13')).toEqual(['2026-10-13']);
  });

  it('devuelve vacio si el final es anterior', () => {
    expect(eachDay('2026-10-14', '2026-10-13')).toEqual([]);
  });

  it('cuenta los 16 dias de las vacaciones de Navidad 2026', () => {
    expect(eachDay('2026-12-22', '2027-01-06')).toHaveLength(16);
  });

  it('se niega a recorrer rangos absurdos', () => {
    expect(() => eachDay('2000-01-01', '2030-01-01')).toThrow(RangeError);
  });
});

describe('meses', () => {
  it('monthOf y addMonths', () => {
    expect(monthOf('2026-10-13')).toBe('2026-10');
    expect(addMonths('2026-10', 1)).toBe('2026-11');
    expect(addMonths('2026-10', 3)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-10', 11)).toBe('2027-09');
  });
});

describe('todayCivil', () => {
  it('usa la zona de Madrid, no UTC', () => {
    // 22:30 UTC del 24 oct es ya las 00:30 del 25 oct en Madrid (CEST, UTC+2).
    expect(todayCivil(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
    expect(todayCivil(new Date('2026-10-24T21:59:00Z'))).toBe('2026-10-24');
  });

  it('respeta el cambio de hora de octubre (CET, UTC+1)', () => {
    // Tras el cambio, 23:30 UTC del 25 oct son las 00:30 del 26 en Madrid.
    expect(todayCivil(new Date('2026-10-25T22:59:00Z'))).toBe('2026-10-25');
    expect(todayCivil(new Date('2026-10-25T23:00:00Z'))).toBe('2026-10-26');
  });

  it('admite otra zona horaria', () => {
    expect(todayCivil(new Date('2026-10-24T22:30:00Z'), 'UTC')).toBe('2026-10-24');
  });
});
