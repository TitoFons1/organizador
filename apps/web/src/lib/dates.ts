import type { CivilDate } from '@organizador/shared';

// Las fechas civiles se formatean siempre en UTC: la fecha "2026-10-13" es 13 de octubre en
// cualquier zona horaria del navegador (D4).
const long = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' });
const full = new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeZone: 'UTC' });
const short = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const month = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const dayOfWeek = new Intl.DateTimeFormat('es-ES', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const shortRange = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});
const longRange = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const toDate = (date: CivilDate) => new Date(`${date}T00:00:00Z`);

/** 13 de octubre de 2026 */
export const formatLong = (date: CivilDate) => long.format(toDate(date));
/** martes, 13 de octubre de 2026 */
export const formatFull = (date: CivilDate) => full.format(toDate(date));
/** 13 oct */
export const formatShort = (date: CivilDate) => short.format(toDate(date));
/** octubre de 2026 (recibe `AAAA-MM`) */
export const formatMonth = (value: string) => month.format(toDate(`${value}-01`));

/** "13 oct" o "13 oct – 14 oct" */
export function formatRange(start: CivilDate, end: CivilDate) {
  return start === end ? formatShort(start) : `${formatShort(start)} – ${formatShort(end)}`;
}

/** lunes, 12 oct */
export const formatWeekday = (date: CivilDate) => dayOfWeek.format(toDate(date));

/** 12–18 de octubre de 2026 (o 28 de septiembre–4 de octubre de 2026) */
export const formatDateRange = (start: CivilDate, end: CivilDate) =>
  longRange.formatRange(toDate(start), toDate(end));

/** 12–18 oct 2026 (o 26 oct – 1 nov 2026): cabe en una linea del movil. */
export const formatDateRangeShort = (start: CivilDate, end: CivilDate) =>
  shortRange.formatRange(toDate(start), toDate(end));
