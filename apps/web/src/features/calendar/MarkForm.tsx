import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEFAULT_BLOCKS_CLASSES,
  MARK_KINDS,
  markKindSchema,
  type CivilDate,
  type Mark,
} from '@organizador/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { es } from '../../i18n/es';
import { CALENDAR_KEY, createMark, updateMark } from './api';
import {
  markFormDefaults,
  markFormSchema,
  toMarkInput,
  type MarkFormValues,
} from './calendar-forms';

interface MarkFormProps {
  /** Marca a editar; sin ella se crea una nueva en `date`. */
  mark?: Mark;
  date: CivilDate;
  onDone: (mark: Mark) => void;
  onCancel: () => void;
}

const KIND_LABELS = new Set<string>(Object.values(es.calendar.kinds));

export function MarkForm({ mark, date, onDone, onCancel }: MarkFormProps) {
  const queryClient = useQueryClient();
  const form = useForm<MarkFormValues>({
    resolver: zodResolver(markFormSchema),
    defaultValues: markFormDefaults(mark, date),
  });

  const save = useMutation({
    mutationFn: (values: MarkFormValues) =>
      mark ? updateMark(mark.id, values) : createMark(toMarkInput(values)),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: CALENDAR_KEY });
      onDone(saved);
    },
  });

  // Al cambiar de tipo en una marca nueva se proponen su nombre y si anula clases (editable).
  const onKindChange = (value: string) => {
    const kind = markKindSchema.safeParse(value);
    if (mark || !kind.success) return;
    form.setValue('blocksClasses', DEFAULT_BLOCKS_CLASSES[kind.data]);
    const label = form.getValues('label').trim();
    if (label === '' || KIND_LABELS.has(label)) {
      form.setValue('label', es.calendar.kinds[kind.data]);
    }
  };

  const { errors } = form.formState;
  const texts = es.calendar.markForm;

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <h2 className="text-lg font-semibold">{mark ? texts.editTitle : texts.newTitle}</h2>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="flex flex-col gap-4"
      >
        <Select
          label={texts.kind}
          {...form.register('kind', { onChange: (event) => onKindChange(event.target.value) })}
        >
          {MARK_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {es.calendar.kinds[kind]}
            </option>
          ))}
        </Select>
        <Field
          label={texts.label}
          autoComplete="off"
          error={errors.label?.message}
          {...form.register('label')}
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
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="size-5" {...form.register('blocksClasses')} />
          {texts.blocks}
        </label>

        {save.isError ? (
          <p role="alert" className="text-sm text-danger">
            {es.calendar.actionError}
          </p>
        ) : null}

        <div className="flex gap-3">
          <Button type="submit" disabled={save.isPending} className="flex-1">
            {save.isPending ? es.common.saving : es.common.save}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {es.common.cancel}
          </Button>
        </div>
      </form>
    </section>
  );
}
