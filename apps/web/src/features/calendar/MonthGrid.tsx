import {
  addDays,
  daysInMonth,
  dominantMark,
  marksOn,
  weekday,
  type CivilDate,
  type Mark,
} from '@organizador/shared';
import { useMemo } from 'react';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { formatFull, formatMonth } from '../../lib/dates';
import { kindStyle } from './kind-style';

interface MonthGridProps {
  /** `AAAA-MM` */
  month: string;
  marks: readonly Mark[];
  today: CivilDate;
  selectedDay: CivilDate | null;
  /** Primer dia elegido con el pincel (a la espera del ultimo). */
  anchor: CivilDate | null;
  onDayClick: (date: CivilDate) => void;
}

/** Un mes con sus dias coloreados segun la marca dominante. Los dias son botones de 44 px. */
export function MonthGrid({
  month,
  marks,
  today,
  selectedDay,
  anchor,
  onDayClick,
}: MonthGridProps) {
  const [year, monthNumber] = month.split('-').map(Number) as [number, number];

  const days = useMemo(() => {
    const first: CivilDate = `${month}-01`;
    const lead = weekday(first) - 1; // huecos antes del dia 1 (la semana empieza en lunes)
    const total = daysInMonth(year, monthNumber);
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: total }, (_, index) => addDays(first, index)),
    ];
  }, [month, year, monthNumber]);

  return (
    <section
      aria-label={formatMonth(month)}
      className="rounded-xl border border-border bg-surface p-3"
    >
      <h3 className="mb-2 text-sm font-semibold capitalize">{formatMonth(month)}</h3>
      <div className="grid grid-cols-7 gap-1 text-center">
        {es.calendar.weekdays.map((name, index) => (
          <span key={name + index} aria-hidden className="pb-1 text-xs font-medium text-fg-muted">
            {name}
          </span>
        ))}
        {days.map((date, index) => {
          if (date === null) return <span key={`blank-${index}`} aria-hidden />;
          return (
            <DayCell
              key={date}
              date={date}
              marks={marksOn(marks, date)}
              isToday={date === today}
              isSelected={date === selectedDay}
              isAnchor={date === anchor}
              onClick={onDayClick}
            />
          );
        })}
      </div>
    </section>
  );
}

interface DayCellProps {
  date: CivilDate;
  marks: Mark[];
  isToday: boolean;
  isSelected: boolean;
  isAnchor: boolean;
  onClick: (date: CivilDate) => void;
}

function DayCell({ date, marks, isToday, isSelected, isAnchor, onClick }: DayCellProps) {
  const main = dominantMark(marks);
  const style = main ? kindStyle(main.kind) : null;
  const isWeekend = weekday(date) >= 6;
  const description = [formatFull(date), ...marks.map((mark) => mark.label)].join('. ');
  const emphasized = marks.some(
    (mark) => mark.kind === 'inicio_curso' || mark.kind === 'fin_curso',
  );

  return (
    <button
      type="button"
      onClick={() => onClick(date)}
      aria-label={description}
      aria-pressed={isSelected || isAnchor}
      aria-current={isToday ? 'date' : undefined}
      data-date={date}
      style={style?.style}
      className={cn(
        'flex size-10 items-center justify-center justify-self-center rounded-lg text-sm sm:size-9',
        style?.className,
        !style && (isWeekend ? 'text-fg-muted' : 'text-fg'),
        !style && 'hover:bg-surface-muted',
        emphasized && 'font-bold ring-2 ring-fg',
        isToday && 'underline decoration-2 underline-offset-4',
        (isSelected || isAnchor) && 'outline-2 outline-offset-1 outline-primary',
      )}
    >
      {Number(date.slice(8))}
    </button>
  );
}
