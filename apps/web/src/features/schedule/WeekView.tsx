import {
  addDays,
  dominantMark,
  eachDay,
  expand,
  findOverlaps,
  isCivilDate,
  marksOn,
  weekday,
  weekOf,
  type CivilDate,
} from '@organizador/shared';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, buttonClasses, IconButton } from '../../components/ui/Button';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { formatDateRange, formatWeekday } from '../../lib/dates';
import { useNow } from '../../lib/use-now';
import { CALENDAR_KEY, fetchCalendar } from '../calendar/api';
import { KIND_SYMBOL, kindStyle } from '../calendar/kind-style';
import { fetchSubjects, SUBJECTS_KEY } from '../subjects/api';
import { fetchSchedule, SCHEDULE_KEY } from './api';
import { OccurrenceCard } from './OccurrenceCard';

const texts = es.schedule.week;
const occurrenceKey = (o: { slotId: string; date: string; exceptionId: string | null }) =>
  `${o.slotId}|${o.date}|${o.exceptionId ?? 'regla'}`;

/**
 * Las clases de una semana calculadas con el motor (D2/D3): franjas + excepciones + calendario.
 * La semana va en la URL (`?semana=AAAA-MM-DD`) para poder enlazarla y volver a ella.
 */
export function WeekView() {
  const [params, setParams] = useSearchParams();
  const now = useNow();
  const today = now.date;
  const requested = params.get('semana');
  const week = weekOf(requested && isCivilDate(requested) ? requested : today);
  const [open, setOpen] = useState<string | null>(null);

  const subjects = useQuery({ queryKey: SUBJECTS_KEY, queryFn: fetchSubjects });
  const calendar = useQuery({ queryKey: CALENDAR_KEY, queryFn: fetchCalendar });
  const schedule = useQuery({ queryKey: SCHEDULE_KEY, queryFn: fetchSchedule });

  const showWeek = (date: CivilDate | null) => {
    setOpen(null);
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (date) next.set('semana', date);
        else next.delete('semana');
        return next;
      },
      { replace: true },
    );
  };

  const header = (
    <header className="flex flex-wrap items-center gap-2">
      <h2 className="min-w-0 flex-1 text-lg font-semibold">
        <span className="sr-only">{texts.title}: </span>
        {formatDateRange(week.from, week.to)}
      </h2>
      <IconButton label={texts.previous} onClick={() => showWeek(addDays(week.from, -7))}>
        <ChevronLeft aria-hidden className="size-5" />
      </IconButton>
      <Button variant="secondary" onClick={() => showWeek(null)}>
        {texts.today}
      </Button>
      <IconButton label={texts.next} onClick={() => showWeek(addDays(week.from, 7))}>
        <ChevronRight aria-hidden className="size-5" />
      </IconButton>
    </header>
  );

  const queries = [subjects, calendar, schedule];
  if (queries.some((query) => query.isPending)) {
    return (
      <section aria-label={texts.title} className="flex flex-col gap-3">
        {header}
        <p className="text-fg-muted">{es.common.loading}</p>
      </section>
    );
  }
  if (!subjects.data || !calendar.data || !schedule.data) {
    return (
      <section aria-label={texts.title} className="flex flex-col items-start gap-3">
        {header}
        <p role="alert">{es.schedule.loadError}</p>
        <Button
          variant="secondary"
          onClick={() => queries.forEach((query) => void query.refetch())}
        >
          {es.common.retry}
        </Button>
      </section>
    );
  }

  // Las asignaturas archivadas ya terminaron: no salen en el dia a dia.
  const active = new Map(
    subjects.data.filter((subject) => subject.archivedAt === null).map((s) => [s.id, s]),
  );
  const slots = schedule.data.slots.filter((slot) => active.has(slot.subjectId));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const { marks } = calendar.data;
  const occurrences = expand(week, { slots, exceptions: schedule.data.exceptions, marks });
  const overlapping = new Set(findOverlaps(occurrences).flat());
  const recordOf = (slotId: string, date: string) =>
    schedule.data.sessionRecords.find((r) => r.slotId === slotId && r.date === date);

  if (active.size === 0 || slots.length === 0) {
    return (
      <section aria-label={texts.title} className="flex flex-col gap-3">
        {header}
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-6">
          <p className="text-fg-muted">{active.size === 0 ? texts.noSubjects : texts.noSlots}</p>
          <Link to="/asignaturas" className={buttonClasses('secondary')}>
            {texts.goSubjects}
          </Link>
        </div>
      </section>
    );
  }

  const days = eachDay(week.from, week.to).filter(
    // El fin de semana solo se muestra si hay algo ese dia.
    (date) => weekday(date) <= 5 || occurrences.some((o) => o.date === date),
  );

  return (
    <section aria-label={texts.title} className="flex flex-col gap-3">
      {header}
      <ol className="flex flex-col gap-3">
        {days.map((date) => {
          const dayOccurrences = occurrences.filter((o) => o.date === date);
          const mark = dominantMark(marksOn(marks, date));
          const style = mark ? kindStyle(mark.kind) : null;
          return (
            <li
              key={date}
              aria-label={formatWeekday(date)}
              className={cn(
                'flex flex-col gap-2 rounded-xl border bg-surface p-3',
                date === today ? 'border-primary' : 'border-border',
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold first-letter:uppercase">{formatWeekday(date)}</h3>
                {date === today ? (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-contrast">
                    {texts.todayBadge}
                  </span>
                ) : null}
                {mark && style ? (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs font-semibold',
                      style.className,
                    )}
                    style={style.style}
                  >
                    <span aria-hidden>{KIND_SYMBOL[mark.kind]} </span>
                    {mark.label}
                  </span>
                ) : null}
              </div>
              {dayOccurrences.length === 0 ? (
                <p className="text-sm text-fg-muted">{texts.noClasses}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {dayOccurrences.map((occurrence) => {
                    const key = occurrenceKey(occurrence);
                    return (
                      <OccurrenceCard
                        key={key}
                        occurrence={occurrence}
                        subject={active.get(occurrence.subjectId)!}
                        slot={slotById.get(occurrence.slotId)}
                        record={recordOf(occurrence.slotId, occurrence.date)}
                        now={now}
                        overlaps={overlapping.has(occurrence)}
                        open={open === key}
                        onToggle={() => setOpen(open === key ? null : key)}
                      />
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
