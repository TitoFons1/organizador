import { dominantMark, marksOn, type CivilDate, type Occurrence } from '@organizador/shared';
import { Fragment } from 'react';
import { es } from '../../i18n/es';
import { formatWeekday } from '../../lib/dates';
import { DayMarkBadge } from '../calendar/DayMarkBadge';
import { OccurrenceCard } from './OccurrenceCard';
import { occurrenceKey, type ScheduleModel } from './use-schedule-data';

interface DayAgendaProps {
  date: CivilDate;
  now: { date: CivilDate; time: string };
  occurrences: Occurrence[];
  overlapping: Set<Occurrence>;
  model: ScheduleModel;
  open: string | null;
  onToggle: (key: string) => void;
}

const texts = es.schedule.week;

/** Linea "Ahora · 17:05" entre lo que ya empezo y lo que falta (vista Hoy, docs/01 7.2). */
export function NowMarker({ time }: { time: string }) {
  return (
    <li className="flex items-center gap-2 text-xs font-semibold text-danger">
      <span aria-hidden className="h-px flex-1 bg-danger" />
      {texts.now(time)}
      <span aria-hidden className="h-px flex-1 bg-danger" />
    </li>
  );
}

/** Posicion de la linea "ahora": antes de la primera clase que aun no ha empezado. */
export function nowIndex(occurrences: readonly Occurrence[], time: string): number {
  const index = occurrences.findIndex((occurrence) => occurrence.start > time);
  return index === -1 ? occurrences.length : index;
}

/** Movil: las clases de un dia, con su marca del calendario y la linea "ahora" si es hoy. */
export function DayAgenda({
  date,
  now,
  occurrences,
  overlapping,
  model,
  open,
  onToggle,
}: DayAgendaProps) {
  const mark = dominantMark(marksOn(model.marks, date));
  const isToday = date === now.date;
  const marker = isToday && occurrences.length > 0 ? nowIndex(occurrences, now.time) : -1;

  return (
    <section aria-label={formatWeekday(date)} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold first-letter:uppercase">{formatWeekday(date)}</h3>
        {isToday ? (
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-contrast">
            {texts.todayBadge}
          </span>
        ) : null}
        {mark ? <DayMarkBadge mark={mark} /> : null}
      </div>
      {occurrences.length === 0 ? (
        <p className="text-sm text-fg-muted">{texts.noClasses}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {occurrences.map((occurrence, index) => {
            const key = occurrenceKey(occurrence);
            return (
              <Fragment key={key}>
                {index === marker ? <NowMarker time={now.time} /> : null}
                <OccurrenceCard
                  occurrence={occurrence}
                  subject={model.active.get(occurrence.subjectId)!}
                  slot={model.slotById.get(occurrence.slotId)}
                  record={model.recordOf(occurrence.slotId, occurrence.date)}
                  now={now}
                  overlaps={overlapping.has(occurrence)}
                  open={open === key}
                  onToggle={() => onToggle(key)}
                />
              </Fragment>
            );
          })}
          {marker === occurrences.length ? <NowMarker time={now.time} /> : null}
        </ul>
      )}
    </section>
  );
}
