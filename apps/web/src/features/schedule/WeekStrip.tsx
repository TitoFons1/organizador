import {
  dominantMark,
  marksOn,
  type CivilDate,
  type Mark,
  type Occurrence,
  type Subject,
} from '@organizador/shared';
import { useRef } from 'react';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { formatWeekday } from '../../lib/dates';
import { subjectColorStyle } from '../../lib/subject-colors';
import { KIND_SYMBOL } from '../calendar/kind-style';

interface WeekStripProps {
  days: CivilDate[];
  today: CivilDate;
  selected: CivilDate;
  occurrences: Occurrence[];
  marks: readonly Mark[];
  subjects: Map<string, Subject>;
  onSelect: (date: CivilDate) => void;
  /** Deslizar a la izquierda = semana siguiente (+1); a la derecha = anterior (-1). */
  onSwipe: (direction: -1 | 1) => void;
}

const SWIPE_MIN_PX = 50;
const texts = es.schedule.week;

/** Movil: los 7 dias con un punto por clase (color de la asignatura) y el simbolo del festivo. */
export function WeekStrip({
  days,
  today,
  selected,
  occurrences,
  marks,
  subjects,
  onSelect,
  onSwipe,
}: WeekStripProps) {
  const touchStart = useRef<number | null>(null);

  return (
    <div
      role="group"
      aria-label={texts.days}
      className="grid touch-pan-y grid-cols-7 gap-1"
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const end = event.changedTouches[0]?.clientX;
        touchStart.current = null;
        if (start === null || end === undefined) return;
        const dx = end - start;
        if (Math.abs(dx) >= SWIPE_MIN_PX) onSwipe(dx < 0 ? 1 : -1);
      }}
    >
      {days.map((date, index) => {
        const live = occurrences.filter((o) => o.date === date && o.status === 'scheduled');
        const mark = dominantMark(marksOn(marks, date));
        const isSelected = date === selected;
        return (
          <button
            key={date}
            type="button"
            aria-pressed={isSelected}
            aria-current={date === today ? 'date' : undefined}
            aria-label={texts.dayButton(formatWeekday(date), live.length)}
            onClick={() => onSelect(date)}
            className={cn(
              'flex min-h-16 flex-col items-center justify-start gap-1 rounded-lg py-1.5',
              isSelected ? 'bg-primary text-primary-contrast' : 'hover:bg-surface-muted',
            )}
          >
            <span className={cn('text-xs', !isSelected && 'text-fg-muted')}>
              {es.calendar.weekdays[index]}
            </span>
            <span
              className={cn(
                'text-sm font-semibold',
                date === today && 'underline decoration-2 underline-offset-4',
              )}
            >
              {Number(date.slice(8))}
            </span>
            <span aria-hidden className="flex h-2 items-center gap-0.5">
              {live.slice(0, 3).map((occurrence) => {
                const subject = subjects.get(occurrence.subjectId);
                return subject ? (
                  <span
                    key={`${occurrence.slotId}-${occurrence.start}`}
                    className="subject-dot size-1.5 rounded-full"
                    style={subjectColorStyle(subject.color)}
                  />
                ) : null;
              })}
              {live.length === 0 && mark ? (
                <span className="text-[10px] leading-none">{KIND_SYMBOL[mark.kind]}</span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}
