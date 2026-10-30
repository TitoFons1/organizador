import {
  httpUrlSchema,
  SESSION_TEXT_MAX,
  SESSION_TOPIC_MAX,
  type SessionRecord,
} from '@organizador/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type ChangeEvent } from 'react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { TextArea } from '../../components/ui/TextArea';
import { es } from '../../i18n/es';
import { saveSessionRecord } from '../tasks/api';
import { SCHEDULE_KEY } from './api';

const texts = es.schedule.week.session;
const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Antes de la tutoria: tema y preguntas. Despues: notas y enlace a la grabacion. */
export function SessionForm({
  slotId,
  date,
  record,
}: {
  slotId: string;
  date: string;
  record: SessionRecord | undefined;
}) {
  const queryClient = useQueryClient();
  const [topic, setTopic] = useState(record?.topic ?? '');
  const [questions, setQuestions] = useState(record?.questions ?? '');
  const [notes, setNotes] = useState(record?.notes ?? '');
  const [recordingUrl, setRecordingUrl] = useState(record?.recordingUrl ?? '');
  const [saved, setSaved] = useState(false);
  const urlInvalid =
    recordingUrl.trim() !== '' && !httpUrlSchema.safeParse(recordingUrl.trim()).success;

  const save = useMutation({
    mutationFn: () =>
      saveSessionRecord(slotId, date, {
        topic: orNull(topic),
        questions: orNull(questions),
        notes: orNull(notes),
        recordingUrl: orNull(recordingUrl),
      }),
    onSuccess: async () => {
      setSaved(true);
      await queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
    },
  });
  // Al tocar cualquier campo desaparece el "Notas guardadas".
  const edit =
    (setter: (value: string) => void) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setSaved(false);
      setter(event.target.value);
    };

  return (
    <form
      noValidate
      aria-label={texts.title}
      onSubmit={(event) => {
        event.preventDefault();
        if (!urlInvalid) save.mutate();
      }}
      className="flex flex-col gap-3"
    >
      <p className="text-sm font-semibold">{texts.title}</p>
      <Field
        label={texts.topic}
        value={topic}
        maxLength={SESSION_TOPIC_MAX}
        autoComplete="off"
        onChange={edit(setTopic)}
      />
      <TextArea
        label={texts.questions}
        value={questions}
        maxLength={SESSION_TEXT_MAX}
        onChange={edit(setQuestions)}
      />
      <TextArea
        label={texts.notes}
        value={notes}
        maxLength={SESSION_TEXT_MAX}
        onChange={edit(setNotes)}
      />
      <Field
        label={texts.recordingUrl}
        type="url"
        inputMode="url"
        placeholder="https://"
        value={recordingUrl}
        error={urlInvalid ? es.schedule.form.invalidUrl : undefined}
        onChange={edit(setRecordingUrl)}
      />
      {saved ? (
        <p role="status" className="text-sm font-medium">
          {texts.saved}
        </p>
      ) : null}
      {save.isError ? (
        <p role="alert" className="text-sm text-danger">
          {es.schedule.actionError}
        </p>
      ) : null}
      <Button type="submit" variant="secondary" disabled={save.isPending} className="self-start">
        {texts.save}
      </Button>
    </form>
  );
}
