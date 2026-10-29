import {
  addMonths,
  courseBounds,
  type CalendarWarning,
  type CivilDate,
  type Mark,
} from '@organizador/shared';
import { es } from '../../i18n/es';

const FIRST_MONTH = 9; // el curso se pinta de septiembre a agosto

/** Los 12 meses (`AAAA-MM`) del curso que contiene el inicio marcado o, si no lo hay, hoy. */
export function courseMonths(
  marks: readonly Pick<Mark, 'kind' | 'startDate' | 'endDate'>[],
  today: CivilDate,
): string[] {
  const reference = courseBounds(marks).start ?? today;
  const [year, month] = reference.split('-').map(Number) as [number, number];
  const startYear = month >= FIRST_MONTH ? year : year - 1;
  const first = `${startYear}-${String(FIRST_MONTH).padStart(2, '0')}`;
  return Array.from({ length: 12 }, (_, index) => addMonths(first, index));
}

export function warningText(warning: CalendarWarning): string {
  const texts = es.calendar.warnings;
  switch (warning.code) {
    case 'TERM_WITHOUT_END':
      return texts.TERM_WITHOUT_END(warning.term);
    case 'TERMS_OVERLAP':
      return texts.TERMS_OVERLAP(...warning.terms);
    default:
      return texts[warning.code];
  }
}
