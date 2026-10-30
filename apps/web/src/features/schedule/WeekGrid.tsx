import { dominantMark, marksOn, type CivilDate, type Occurrence } from '@organizador/shared';
import { Fragment } from 'react';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { formatWeekday } from '../../lib/dates';
import { subjectColorStyle } from '../../lib/subject-colors';
import { DayMarkBadge } from '../calendar/DayMarkBadge';
import { NowMarker, nowIndex } from './DayAgenda';
import { occurrenceKey, type ScheduleModel } from './use-schedule-data';

interface WeekGridProps {
  days: CivilDate[];
  now: { date: CivilDate; time: string };
  occurrences: Occurrence[];
  model: ScheduleModel;
  selected: string | null;
  onSelect: (key: string) => void;
}

const texts = es.schedule.week;

/** Escritorio: lunes a viernes en columnas y el fin de semana junto en la sexta (docs/01 7.3). */
export function WeekGrid({ days, now, occurrences, model, selected, onSelect }: WeekGridProps) {
  const column = (date: CivilDate, compact = false) => {
    const dayOccurrences = occurrences.filter((o) => o.date === date);
    const mark = dominantMark(marksOn(model.marks, date));
    const isToday = date === now.date;
    const marker = isToday && dayOccurrences.length > 0 ? nowIndex(dayOccurrences, now.time) : -1;
    return (
      <section
        key={date}
        aria-label={formatWeekday(date)}
        className={cn(
          'flex flex-col gap-1.5 rounded-xl border bg-surface p-2',
          compact ? 'min-h-16' : 'min-h-36',
          isToday ? 'border-primary' : 'border-border',
        )}
      >
        <h3 className="text-sm font-semibold first-letter:uppercase">{formatWeekday(date)}</h3>
        {mark ? <DayMarkBadge mark={mark} className="self-start" /> : null}
        <ul className="flex flex-col gap-1.5">
          {dayOccurrences.map((occurrence, index) => {
            const key = occurrenceKey(occurrence);
            const subject = model.active.get(occurrence.subjectId)!;
            const status =
              occurrence.status === 'scheduled' ? null : texts.statusShort[occurrence.status];
            return (
              <Fragment key={key}>
                {index === marker ? <NowMarker time={now.time} /> : null}
                <li>
                  <button
                    type="button"
                    aria-pressed={selected === key}
                    aria-label={texts.block(subject.name, occurrence.start, occurrence.end, status)}
                    onClick={() => onSelect(key)}
                    style={subjectColorStyle(subject.color)}
                    className={cn(
                      'subject-chip flex w-full flex-col items-start rounded-lg px-2 py-1 text-left text-xs',
                      occurrence.status !== 'scheduled' && 'opacity-50',
                      occurrence.status === 'cancelled' && 'line-through',
                      selected === key && 'ring-2 ring-fg',
                    )}
                  >
                    <span className="font-semibold">{occurrence.start}</span>
                    <span className="w-full truncate">{subject.shortName}</span>
                  </button>
                </li>
              </Fragment>
            );
          })}
          {marker === dayOccurrences.length ? <NowMarker time={now.time} /> : null}
        </ul>
      </section>
    );
  };

  const weekdays = days.slice(0, 5);
  const weekend = days.slice(5);
  return (
    <div className="grid grid-cols-6 gap-2">
      {weekdays.map((date) => column(date))}
      <div className="flex flex-col gap-2">{weekend.map((date) => column(date, true))}</div>
    </div>
  );
}
