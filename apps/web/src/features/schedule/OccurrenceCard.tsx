import {
  isCivilDate,
  isCivilTime,
  isJoinable,
  type ExceptionInput,
  type Occurrence,
  type SessionRecord,
  type Slot,
  type Subject,
} from '@organizador/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ellipsis, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Button, buttonClasses, IconButton } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { formatShort } from '../../lib/dates';
import { SubjectBadge } from '../subjects/SubjectBadge';
import { createException, deleteException, SCHEDULE_KEY } from './api';
import { SessionForm } from './SessionForm';

interface OccurrenceCardProps {
  occurrence: Occurrence;
  subject: Subject;
  slot: Slot | undefined;
  /** Notas de esta sesion (tutorias), si las hay. */
  record: SessionRecord | undefined;
  now: { date: string; time: string };
  overlaps: boolean;
  open: boolean;
  onToggle: () => void;
}

const texts = es.schedule.week;

function statusLine(occurrence: Occurrence): string | null {
  const withReason = (text: string) =>
    occurrence.reason ? `${text} · ${occurrence.reason}` : text;
  switch (occurrence.status) {
    case 'blocked':
      return occurrence.reason;
    case 'cancelled':
      return withReason(texts.cancelled);
    case 'moved':
      return withReason(texts.moved(formatShort(occurrence.movedTo!.date)));
    case 'scheduled':
      if (occurrence.movedFrom)
        return withReason(texts.movedFrom(formatShort(occurrence.movedFrom)));
      if (occurrence.extra) return withReason(texts.extra);
      return null;
  }
}

/** Una clase de la semana. Las que no se imparten se ven atenuadas y con su motivo. */
export function OccurrenceCard({
  occurrence,
  subject,
  slot,
  record,
  now,
  overlaps,
  open,
  onToggle,
}: OccurrenceCardProps) {
  const live = occurrence.status === 'scheduled';
  const details = [
    `${occurrence.start}–${occurrence.end}`,
    occurrence.kind === 'tutoria' ? es.schedule.kinds.tutoria : null,
    slot?.location ?? null,
  ].filter(Boolean);
  const line = statusLine(occurrence);

  return (
    <li className={cn('rounded-lg border border-border p-3', !live && 'bg-surface-muted')}>
      <div className="flex items-start gap-3">
        <SubjectBadge
          color={subject.color}
          label={subject.shortName}
          className={cn('mt-0.5 shrink-0', !live && 'opacity-60')}
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'font-medium break-words',
              occurrence.status === 'cancelled' && 'line-through',
              !live && 'text-fg-muted',
            )}
          >
            {subject.name}
          </p>
          <p className="text-sm text-fg-muted">{details.join(' · ')}</p>
          {line ? <p className="text-sm font-medium">{line}</p> : null}
          {record?.topic ? <p className="text-sm">{texts.topic(record.topic)}</p> : null}
          {overlaps ? <p className="text-sm text-danger">{texts.overlap}</p> : null}
          {live && slot?.meetingUrl ? (
            // Desde 15 minutos antes, la videollamada pasa a ser el boton principal.
            <a
              href={slot.meetingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={
                isJoinable(occurrence, now)
                  ? buttonClasses('primary', 'mt-2')
                  : 'mt-1 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-primary underline'
              }
            >
              {isJoinable(occurrence, now) ? texts.join : texts.meeting}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          ) : null}
          {record?.recordingUrl ? (
            <a
              href={record.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 ml-3 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-primary underline"
            >
              {texts.session.recording}
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          ) : null}
        </div>
        {occurrence.status === 'blocked' ? null : (
          <IconButton
            label={texts.options(subject.name, formatShort(occurrence.date))}
            aria-expanded={open}
            onClick={onToggle}
          >
            <Ellipsis aria-hidden className="size-5" />
          </IconButton>
        )}
      </div>
      {open ? (
        <OccurrenceActions occurrence={occurrence} record={record} onDone={onToggle} />
      ) : null}
    </li>
  );
}

function OccurrenceActions({
  occurrence,
  record,
  onDone,
}: {
  occurrence: Occurrence;
  record: SessionRecord | undefined;
  onDone: () => void;
}) {
  const live = occurrence.status === 'scheduled';
  return (
    <div className="mt-3 flex flex-col gap-4 border-t border-border pt-3">
      {occurrence.kind === 'tutoria' && live ? (
        <SessionForm slotId={occurrence.slotId} date={occurrence.date} record={record} />
      ) : null}
      {occurrence.exceptionId ? (
        <UndoChange exceptionId={occurrence.exceptionId} onDone={onDone} />
      ) : live ? (
        <ChangeClass occurrence={occurrence} onDone={onDone} />
      ) : null}
    </div>
  );
}

function useScheduleChange(onDone: () => void) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
    onDone();
  };
}

/** Quita la excepcion: la clase vuelve a ser la de la regla. */
function UndoChange({ exceptionId, onDone }: { exceptionId: string; onDone: () => void }) {
  const refresh = useScheduleChange(onDone);
  const undo = useMutation({ mutationFn: deleteException, onSuccess: refresh });
  return (
    <div className="flex flex-col gap-2">
      {undo.isError ? (
        <p role="alert" className="text-sm text-danger">
          {es.schedule.actionError}
        </p>
      ) : null}
      <Button
        variant="secondary"
        onClick={() => undo.mutate(exceptionId)}
        disabled={undo.isPending}
        className="self-start"
      >
        {texts.undo}
      </Button>
    </div>
  );
}

/** Cancelar esta clase (con motivo) o moverla a otro dia y hora. */
function ChangeClass({ occurrence, onDone }: { occurrence: Occurrence; onDone: () => void }) {
  const [reason, setReason] = useState('');
  const [newDate, setNewDate] = useState(occurrence.date);
  const [newStart, setNewStart] = useState(occurrence.start);
  const [newEnd, setNewEnd] = useState(occurrence.end);
  const [invalid, setInvalid] = useState(false);
  const refresh = useScheduleChange(onDone);
  const change = useMutation({
    mutationFn: (input: ExceptionInput) => createException(occurrence.slotId, input),
    onSuccess: refresh,
  });

  const base = { date: occurrence.date, reason: reason.trim() === '' ? null : reason.trim() };
  const cancel = () =>
    change.mutate({ ...base, kind: 'cancelled', newDate: null, newStart: null, newEnd: null });
  const move = () => {
    const valid =
      isCivilDate(newDate) && isCivilTime(newStart) && isCivilTime(newEnd) && newEnd > newStart;
    setInvalid(!valid);
    if (valid) change.mutate({ ...base, kind: 'moved', newDate, newStart, newEnd });
  };

  return (
    <div className="flex flex-col gap-3">
      <Field
        label={texts.reason}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        maxLength={200}
        autoComplete="off"
      />
      <Button variant="danger" onClick={cancel} disabled={change.isPending} className="self-start">
        {texts.cancel}
      </Button>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-medium">{texts.moveTitle}</legend>
        <Field
          label={texts.moveDate}
          type="date"
          value={newDate}
          onChange={(event) => setNewDate(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field
            label={es.schedule.form.start}
            type="time"
            value={newStart}
            onChange={(event) => setNewStart(event.target.value)}
          />
          <Field
            label={es.schedule.form.end}
            type="time"
            value={newEnd}
            onChange={(event) => setNewEnd(event.target.value)}
          />
        </div>
        {invalid ? (
          <p role="alert" className="text-sm text-danger">
            {texts.invalidMove}
          </p>
        ) : null}
        <Button
          variant="secondary"
          onClick={move}
          disabled={change.isPending}
          className="self-start"
        >
          {texts.move}
        </Button>
      </fieldset>

      {change.isError ? (
        <p role="alert" className="text-sm text-danger">
          {es.schedule.actionError}
        </p>
      ) : null}
    </div>
  );
}
