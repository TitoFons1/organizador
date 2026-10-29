import { z } from 'zod';

/**
 * Fechas "civiles" (D4): texto `YYYY-MM-DD` sin hora ni zona. Toda la aritmetica se hace con
 * numeros de dia desde 1970-01-01 en UTC, que no tiene cambios de hora, asi que sumar dias o
 * contar semanas nunca falla por el cambio horario de marzo u octubre.
 */
export type CivilDate = string;

const PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
/** Tope de seguridad para `eachDay`: ~10 anos. Evita bucles enormes por una fecha mal escrita. */
const MAX_RANGE_DAYS = 3660;

/** `true` solo si es una fecha real del calendario (rechaza 2026-02-30 o 2026-13-01). */
export function isCivilDate(value: string): value is CivilDate {
  const match = PATTERN.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1) return false;
  return day <= daysInMonth(year, month);
}

export const civilDateSchema = z.string().refine(isCivilDate, {
  message: 'Fecha no válida (se espera AAAA-MM-DD)',
});

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Dias transcurridos desde 1970-01-01 (puede ser negativo). */
export function dayNumber(date: CivilDate): number {
  const [year, month, day] = parts(date);
  return Math.round(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}

export function fromDayNumber(n: number): CivilDate {
  const d = new Date(n * MS_PER_DAY);
  return format(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

export function addDays(date: CivilDate, days: number): CivilDate {
  return fromDayNumber(dayNumber(date) + days);
}

/** `b - a` en dias. */
export function diffDays(a: CivilDate, b: CivilDate): number {
  return dayNumber(b) - dayNumber(a);
}

/** Dia de la semana ISO: 1 = lunes ... 7 = domingo. */
export function weekday(date: CivilDate): number {
  const dow = (dayNumber(date) + 4) % 7; // 1970-01-01 fue jueves
  const normalized = dow < 0 ? dow + 7 : dow; // 0 = domingo ... 6 = sabado
  return normalized === 0 ? 7 : normalized;
}

/** Lunes de la semana de `date`. */
export function startOfWeek(date: CivilDate): CivilDate {
  return addDays(date, 1 - weekday(date));
}

/** Todos los dias entre `start` y `end`, ambos incluidos. Vacio si `end < start`. */
export function eachDay(start: CivilDate, end: CivilDate): CivilDate[] {
  const length = diffDays(start, end) + 1;
  if (length <= 0) return [];
  if (length > MAX_RANGE_DAYS) throw new RangeError(`Rango demasiado largo (${length} dias)`);
  return Array.from({ length }, (_, index) => addDays(start, index));
}

/** `AAAA-MM` de una fecha. */
export function monthOf(date: CivilDate): string {
  return date.slice(0, 7);
}

/** Primer dia del mes `AAAA-MM`, sumando `offset` meses (puede ser negativo). */
export function addMonths(month: string, offset: number): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  const total = year * 12 + (m - 1) + offset;
  return `${String(Math.floor(total / 12)).padStart(4, '0')}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * La fecha civil de hoy en una zona horaria (por defecto la del centro). Se calcula con `Intl`,
 * asi que a las 23:30 en Madrid sigue siendo "hoy" aunque en UTC ya sea otro dia.
 */
export function todayCivil(now: Date = new Date(), timeZone = 'Europe/Madrid'): CivilDate {
  // El locale `en-CA` formatea como AAAA-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function parts(date: CivilDate): [number, number, number] {
  const match = PATTERN.exec(date);
  if (!match) throw new RangeError(`Fecha civil no valida: ${date}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function format(year: number, month: number, day: number): CivilDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
