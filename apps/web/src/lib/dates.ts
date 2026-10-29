import type { CivilDate } from '@organizador/shared';

// Las fechas civiles se formatean siempre en UTC: la fecha "2026-10-13" es 13 de octubre en
// cualquier zona horaria del navegador (D4).
const long = new Intl.DateTimeFormat('es-ES', { dateStyle: 'long', timeZone: 'UTC' });
const full = new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeZone: 'UTC' });
const short = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const month = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });

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
