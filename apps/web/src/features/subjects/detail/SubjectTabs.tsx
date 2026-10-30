import {
  addDays,
  courseBounds,
  todayCivil,
  type CivilDate,
  type Occurrence,
} from '@organizador/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, buttonClasses } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { es } from '../../../i18n/es';
import { cn } from '../../../lib/cn';
import { formatShort, formatWeekday } from '../../../lib/dates';
import { SessionForm } from '../../schedule/SessionForm';
import {
  occurrenceKey,
  useScheduleData,
  type ScheduleModel,
} from '../../schedule/use-schedule-data';
import { TasksSection } from '../../tasks/TasksSection';
import { archiveSubject, SUBJECTS_KEY, unarchiveSubject } from '../api';
import { useSubject } from './SubjectDetailLayout';

const texts = es.subjectDetail;
const week = es.schedule.week;
/** Cuanto se mira hacia delante para "Proximas clases". */
const UPCOMING_DAYS = 56;
const UPCOMING_MAX = 6;

function statusText(occurrence: Occurrence): string | null {
  if (occurrence.status === 'scheduled') {
    return occurrence.movedFrom ? week.movedFrom(formatShort(occurrence.movedFrom)) : null;
  }
  if (occurrence.status === 'cancelled') return week.cancelled;
  if (occurrence.status === 'moved') return week.moved(formatShort(occurrence.movedTo!.date));
  return occurrence.reason;
}

/** Una fila "martes, 20 oct · 17:40–19:25 · Tutoria" que lleva a ese dia en el Panel. */
function OccurrenceRow({ occurrence }: { occurrence: Occurrence }) {
  const status = statusText(occurrence);
  const parts = [
    `${occurrence.start}–${occurrence.end}`,
    occurrence.kind === 'tutoria' ? es.schedule.kinds.tutoria : null,
    status,
  ].filter(Boolean);
  return (
    <Link
      to={`/?semana=${occurrence.date}&dia=${occurrence.date}`}
      className={cn(
        'flex flex-col rounded-lg border border-border bg-surface px-3 py-2 hover:bg-surface-muted',
        occurrence.status !== 'scheduled' && 'text-fg-muted',
      )}
    >
      <span className="font-medium first-letter:uppercase">{formatWeekday(occurrence.date)}</span>
      <span className={cn('text-sm', occurrence.status === 'cancelled' && 'line-through')}>
        {parts.join(' · ')}
      </span>
    </Link>
  );
}

function useSubjectOccurrences(from: CivilDate, to: CivilDate) {
  const subject = useSubject();
  const data = useScheduleData();
  if (data.status !== 'ready') return { data, occurrences: [] as Occurrence[] };
  const occurrences = data.model
    .occurrencesIn({ from, to })
    .occurrences.filter((occurrence) => occurrence.subjectId === subject.id);
  return { data, occurrences };
}

export function SubjectSummary() {
  const subject = useSubject();
  const today = todayCivil();
  const { data, occurrences } = useSubjectOccurrences(today, addDays(today, UPCOMING_DAYS));
  // Lo bloqueado por el calendario no es una "proxima clase".
  const upcoming = occurrences.filter((o) => o.status !== 'blocked').slice(0, UPCOMING_MAX);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="upcoming-title" className="flex flex-col gap-2">
        <h2 id="upcoming-title" className="text-lg font-semibold">
          {texts.upcoming}
        </h2>
        {data.status === 'pending' ? <Skeleton lines={2} /> : null}
        {data.status === 'ready' && upcoming.length === 0 ? (
          <p className="text-fg-muted">{texts.noUpcoming}</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {upcoming.map((occurrence) => (
            <li key={occurrenceKey(occurrence)}>
              <OccurrenceRow occurrence={occurrence} />
            </li>
          ))}
        </ul>
      </section>
      <TasksSection subjectId={subject.id} urgentOnly title={texts.urgent} />
    </div>
  );
}

export function SubjectTasks() {
  const subject = useSubject();
  return <TasksSection subjectId={subject.id} title={texts.tabs.tasks} />;
}

/** Del inicio al fin de curso; sin calendario, cuatro meses a cada lado de hoy. */
function tutorialRange(model: ScheduleModel | undefined, today: CivilDate) {
  const bounds = model ? courseBounds(model.marks) : { start: null, end: null };
  return { from: bounds.start ?? addDays(today, -120), to: bounds.end ?? addDays(today, 120) };
}

export function SubjectTutorials() {
  const subject = useSubject();
  const today = todayCivil();
  const data = useScheduleData();
  const [open, setOpen] = useState<string | null>(null);

  if (data.status === 'pending') return <Skeleton lines={3} />;
  if (data.status === 'error') return <p role="alert">{es.schedule.loadError}</p>;

  const { model } = data;
  const tutorials = model
    .occurrencesIn(tutorialRange(model, today))
    .occurrences.filter(
      (o) => o.subjectId === subject.id && o.kind === 'tutoria' && o.status !== 'blocked',
    );
  if (tutorials.length === 0) return <p className="text-fg-muted">{texts.noTutorials}</p>;

  const next = tutorials.filter((o) => o.date >= today);
  const past = tutorials.filter((o) => o.date < today).reverse();

  const list = (title: string, items: Occurrence[]) =>
    items.length === 0 ? null : (
      <section aria-label={title} className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <ul className="flex flex-col gap-2">
          {items.map((occurrence) => {
            const key = occurrenceKey(occurrence);
            const record = model.recordOf(occurrence.slotId, occurrence.date);
            return (
              <li key={key} className="flex flex-col gap-2">
                <OccurrenceRow occurrence={occurrence} />
                {record?.topic ? <p className="px-3 text-sm">{week.topic(record.topic)}</p> : null}
                {record?.notes ? (
                  <p className="px-3 text-sm whitespace-pre-line text-fg-muted">{record.notes}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 px-3">
                  {record?.recordingUrl ? (
                    <a
                      href={record.recordingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-primary underline"
                    >
                      {week.session.recording}
                      <ExternalLink aria-hidden className="size-3.5" />
                    </a>
                  ) : null}
                  {occurrence.status === 'scheduled' ? (
                    <Button
                      variant="ghost"
                      aria-expanded={open === key}
                      onClick={() => setOpen(open === key ? null : key)}
                    >
                      {week.session.title}
                    </Button>
                  ) : null}
                </div>
                {open === key ? (
                  <div className="rounded-lg border border-border p-3">
                    <SessionForm
                      slotId={occurrence.slotId}
                      date={occurrence.date}
                      record={record}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    );

  return (
    <div className="flex flex-col gap-6">
      {list(texts.nextTutorials, next)}
      {list(texts.pastTutorials, past)}
    </div>
  );
}

export function SubjectNotes() {
  return (
    <p className="rounded-xl border border-dashed border-border p-6 text-center text-fg-muted">
      {texts.notesSoon}
    </p>
  );
}

export function SubjectSettings() {
  const subject = useSubject();
  const queryClient = useQueryClient();
  const archived = subject.archivedAt !== null;
  const toggle = useMutation({
    mutationFn: () => (archived ? unarchiveSubject(subject.id) : archiveSubject(subject.id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY }),
  });

  return (
    <div className="flex flex-col items-start gap-3">
      <Link to={`/asignaturas/${subject.id}/editar`} className={buttonClasses('secondary')}>
        {texts.settings.edit}
      </Link>
      <Button variant="secondary" onClick={() => toggle.mutate()} disabled={toggle.isPending}>
        {archived ? texts.settings.unarchive : texts.settings.archive}
      </Button>
      {toggle.isError ? (
        <p role="alert" className="text-sm text-danger">
          {es.subjects.actionError}
        </p>
      ) : null}
      <Link
        to={`/asignaturas/${subject.id}/eliminar`}
        className={buttonClasses('ghost', 'text-danger')}
      >
        {texts.settings.remove}
      </Link>
    </div>
  );
}
