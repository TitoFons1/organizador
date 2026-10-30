import { addDays, eachDay, isCivilDate, weekOf, type CivilDate } from '@organizador/shared';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Button, buttonClasses, IconButton } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { es } from '../../i18n/es';
import { formatDateRange, formatDateRangeShort } from '../../lib/dates';
import { useIsDesktop } from '../../lib/use-media-query';
import { useNow } from '../../lib/use-now';
import { DayAgenda } from './DayAgenda';
import { OccurrenceCard } from './OccurrenceCard';
import { occurrenceKey, useScheduleData } from './use-schedule-data';
import { WeekGrid } from './WeekGrid';
import { WeekStrip } from './WeekStrip';

const texts = es.schedule.week;

/**
 * La semana calculada con el motor (D2/D3). En movil, tira de dias + agenda del dia elegido; en
 * escritorio, rejilla de la semana. Semana y dia van en la URL (`?semana=` y `?dia=`).
 */
export function WeekView() {
  const [params, setParams] = useSearchParams();
  const now = useNow();
  const today = now.date;
  const isDesktop = useIsDesktop();
  const requested = params.get('semana');
  const week = weekOf(requested && isCivilDate(requested) ? requested : today);
  const days = eachDay(week.from, week.to);
  const requestedDay = params.get('dia');
  const selectedDay =
    requestedDay && days.includes(requestedDay)
      ? requestedDay
      : days.includes(today)
        ? today
        : week.from;
  // Movil: tarjeta con las acciones abiertas. Escritorio: bloque elegido en la rejilla.
  const [open, setOpen] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const data = useScheduleData();

  const update = (changes: Record<string, string | null>) =>
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [name, value] of Object.entries(changes)) {
          if (value === null) next.delete(name);
          else next.set(name, value);
        }
        return next;
      },
      { replace: true },
    );
  const showWeek = (date: CivilDate | null) => {
    setOpen(null);
    setPicked(null);
    update({ semana: date, dia: null });
  };
  const toggle = (key: string) => setOpen(open === key ? null : key);

  const header = (
    <header className="flex flex-wrap items-center gap-2">
      <h2 className="min-w-0 flex-1 text-lg font-semibold">
        <span className="sr-only">{texts.title}: </span>
        {(isDesktop ? formatDateRange : formatDateRangeShort)(week.from, week.to)}
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

  if (data.status !== 'ready') {
    return (
      <section aria-label={texts.title} className="flex flex-col gap-3">
        {header}
        {data.status === 'pending' ? (
          <Skeleton lines={isDesktop ? 2 : 3} />
        ) : (
          <div className="flex flex-col items-start gap-3">
            <p role="alert">{es.schedule.loadError}</p>
            <Button variant="secondary" onClick={data.retry}>
              {es.common.retry}
            </Button>
          </div>
        )}
      </section>
    );
  }

  const { model } = data;
  if (model.active.size === 0 || model.slots.length === 0) {
    return (
      <section aria-label={texts.title} className="flex flex-col gap-3">
        {header}
        <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-border p-6">
          <p className="text-fg-muted">
            {model.active.size === 0 ? texts.noSubjects : texts.noSlots}
          </p>
          <Link to="/asignaturas" className={buttonClasses('secondary')}>
            {texts.goSubjects}
          </Link>
        </div>
      </section>
    );
  }

  const { occurrences, overlapping } = model.occurrencesIn(week);

  if (isDesktop) {
    const chosen = occurrences.find((occurrence) => occurrenceKey(occurrence) === picked);
    return (
      <section aria-label={texts.title} className="flex flex-col gap-3">
        {header}
        <WeekGrid
          days={days}
          now={now}
          occurrences={occurrences}
          model={model}
          selected={picked}
          onSelect={(key) => {
            setOpen(null);
            setPicked(picked === key ? null : key);
          }}
        />
        {chosen ? (
          <section aria-label={texts.selected} className="flex items-start gap-2">
            <ul className="min-w-0 flex-1">
              <OccurrenceCard
                occurrence={chosen}
                subject={model.active.get(chosen.subjectId)!}
                slot={model.slotById.get(chosen.slotId)}
                record={model.recordOf(chosen.slotId, chosen.date)}
                now={now}
                overlaps={overlapping.has(chosen)}
                open={open === picked}
                onToggle={() => toggle(occurrenceKey(chosen))}
              />
            </ul>
            <IconButton label={es.common.close} onClick={() => setPicked(null)}>
              <X aria-hidden className="size-5" />
            </IconButton>
          </section>
        ) : null}
      </section>
    );
  }

  return (
    <section aria-label={texts.title} className="flex flex-col gap-3">
      {header}
      <WeekStrip
        days={days}
        today={today}
        selected={selectedDay}
        occurrences={occurrences}
        marks={model.marks}
        subjects={model.active}
        onSelect={(date) => {
          setOpen(null);
          update({ dia: date });
        }}
        onSwipe={(direction) => showWeek(addDays(week.from, direction * 7))}
      />
      <DayAgenda
        date={selectedDay}
        now={now}
        occurrences={occurrences.filter((occurrence) => occurrence.date === selectedDay)}
        overlapping={overlapping}
        model={model}
        open={open}
        onToggle={toggle}
      />
    </section>
  );
}
