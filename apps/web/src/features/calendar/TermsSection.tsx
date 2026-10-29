import { zodResolver } from '@hookform/resolvers/zod';
import type { Term } from '@organizador/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button, IconButton } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { es } from '../../i18n/es';
import { formatLong } from '../../lib/dates';
import { CALENDAR_KEY, createTerm, deleteTerm, updateTerm } from './api';
import {
  termFormDefaults,
  termFormSchema,
  toTermInput,
  type TermFormValues,
} from './calendar-forms';

const texts = es.calendar.terms;
const NEW = 'new';

export function TermsSection({ terms }: { terms: readonly Term[] }) {
  const queryClient = useQueryClient();
  // Por id: un refresco de la consulta crea objetos nuevos y no debe cerrar el formulario.
  const [editing, setEditing] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: deleteTerm,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CALENDAR_KEY }),
  });

  return (
    <section
      aria-labelledby="terms-title"
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <h2 id="terms-title" className="text-lg font-semibold">
        {texts.title}
      </h2>
      {terms.length === 0 ? <p className="text-fg-muted">{texts.empty}</p> : null}
      {remove.isError ? (
        <p role="alert" className="text-sm text-danger">
          {es.calendar.actionError}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {terms.map((term) =>
          editing === term.id ? (
            <li key={term.id}>
              <TermForm term={term} onClose={() => setEditing(null)} />
            </li>
          ) : (
            <li key={term.id} className="flex items-center gap-2 border-t border-border pt-2">
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{term.name}</p>
                <p className="text-sm text-fg-muted">
                  {formatLong(term.startDate)} –{' '}
                  {term.endDate ? formatLong(term.endDate) : texts.noEnd}
                </p>
              </div>
              <IconButton label={texts.edit(term.name)} onClick={() => setEditing(term.id)}>
                <Pencil aria-hidden className="size-5" />
              </IconButton>
              <IconButton
                label={texts.remove(term.name)}
                disabled={remove.isPending}
                className="hover:text-danger"
                onClick={() => remove.mutate(term.id)}
              >
                <Trash2 aria-hidden className="size-5" />
              </IconButton>
            </li>
          ),
        )}
      </ul>

      {editing === NEW ? (
        <TermForm onClose={() => setEditing(null)} />
      ) : (
        <Button variant="secondary" onClick={() => setEditing(NEW)} className="self-start">
          <Plus aria-hidden className="size-4" />
          {texts.add}
        </Button>
      )}
    </section>
  );
}

function TermForm({ term, onClose }: { term?: Term; onClose: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<TermFormValues>({
    resolver: zodResolver(termFormSchema),
    defaultValues: termFormDefaults(term),
  });

  const save = useMutation({
    mutationFn: (values: TermFormValues) =>
      term ? updateTerm(term.id, toTermInput(values)) : createTerm(toTermInput(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      onClose();
    },
  });

  const { errors } = form.formState;

  return (
    <form
      noValidate
      aria-label={term ? texts.editTitle : texts.newTitle}
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <Field
        label={texts.name}
        autoComplete="off"
        error={errors.name?.message}
        {...form.register('name')}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={texts.from}
          type="date"
          error={errors.startDate?.message}
          {...form.register('startDate')}
        />
        <Field
          label={texts.to}
          type="date"
          error={errors.endDate?.message}
          {...form.register('endDate')}
        />
      </div>
      {save.isError ? (
        <p role="alert" className="text-sm text-danger">
          {es.calendar.actionError}
        </p>
      ) : null}
      <div className="flex gap-3">
        <Button type="submit" disabled={save.isPending} className="flex-1">
          {save.isPending ? es.common.saving : es.common.save}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          {es.common.cancel}
        </Button>
      </div>
    </form>
  );
}
