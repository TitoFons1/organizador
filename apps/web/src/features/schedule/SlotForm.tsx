import { zodResolver } from '@hookform/resolvers/zod';
import { isCivilDate, SLOT_KINDS, type Slot } from '@organizador/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button, IconButton } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { es } from '../../i18n/es';
import { formatLong } from '../../lib/dates';
import { createSlot, SCHEDULE_KEY, updateSlot } from './api';
import {
  REPEAT_OPTIONS,
  slotFormDefaults,
  slotFormSchema,
  toSlotFields,
  toSlotInput,
  type SlotFormValues,
} from './slot-form';

interface SlotFormProps {
  subjectId: string;
  /** Franja a editar; sin ella se crea una nueva. */
  slot?: Slot;
  onClose: () => void;
}

const texts = es.schedule.form;

export function SlotForm({ subjectId, slot, onClose }: SlotFormProps) {
  const queryClient = useQueryClient();
  const form = useForm<SlotFormValues>({
    resolver: zodResolver(slotFormSchema),
    defaultValues: slotFormDefaults(slot),
  });
  const [pendingDate, setPendingDate] = useState('');

  const save = useMutation({
    mutationFn: (values: SlotFormValues) =>
      slot ? updateSlot(slot.id, toSlotFields(values)) : createSlot(toSlotInput(values, subjectId)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY });
      onClose();
    },
  });

  const repeat = useWatch({ control: form.control, name: 'repeat' });
  const dates = useWatch({ control: form.control, name: 'dates' });
  const { errors } = form.formState;

  const addDate = () => {
    if (!isCivilDate(pendingDate)) return;
    const next = [...new Set([...dates, pendingDate])].sort();
    form.setValue('dates', next, { shouldValidate: form.formState.isSubmitted });
    setPendingDate('');
  };
  const removeDate = (date: string) =>
    form.setValue(
      'dates',
      dates.filter((item) => item !== date),
      { shouldValidate: form.formState.isSubmitted },
    );

  return (
    <form
      noValidate
      aria-label={slot ? es.schedule.editTitle : es.schedule.newTitle}
      onSubmit={form.handleSubmit((values) => save.mutate(values))}
      className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4"
    >
      <h2 className="text-lg font-semibold">
        {slot ? es.schedule.editTitle : es.schedule.newTitle}
      </h2>

      {/* En movil van uno sobre otro: "Cada 2 semanas" no cabe en media pantalla. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Select label={texts.kind} {...form.register('kind')}>
          {SLOT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {es.schedule.kinds[kind]}
            </option>
          ))}
        </Select>
        <Select label={texts.repeat} {...form.register('repeat')}>
          {REPEAT_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {texts.repeatOptions[option]}
            </option>
          ))}
        </Select>
      </div>

      {repeat === 'dates' ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium">{texts.dates}</legend>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Field
                label={texts.newDate}
                type="date"
                value={pendingDate}
                onChange={(event) => setPendingDate(event.target.value)}
              />
            </div>
            <Button variant="secondary" onClick={addDate} disabled={!isCivilDate(pendingDate)}>
              {texts.addDate}
            </Button>
          </div>
          {dates.length === 0 ? (
            <p className="text-sm text-fg-muted">{texts.noDates}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {dates.map((date) => (
                <li
                  key={date}
                  className="flex items-center gap-1 rounded-full border border-border pl-3 text-sm"
                >
                  {formatLong(date)}
                  <IconButton
                    label={texts.removeDate(formatLong(date))}
                    onClick={() => removeDate(date)}
                    className="size-9"
                  >
                    <X aria-hidden className="size-4" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          {errors.dates?.message ? (
            <p role="alert" className="text-sm text-danger">
              {errors.dates.message}
            </p>
          ) : null}
        </fieldset>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={texts.weekday}
            error={errors.weekday?.message}
            {...form.register('weekday')}
          >
            {es.schedule.weekdays.map((name, index) => (
              <option key={name} value={String(index + 1)}>
                {name}
              </option>
            ))}
          </Select>
          {repeat !== '1' ? (
            <Field
              label={texts.anchor}
              hint={texts.anchorHint}
              type="date"
              error={errors.anchorDate?.message}
              {...form.register('anchorDate')}
            />
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={texts.start}
          type="time"
          error={errors.startTime?.message}
          {...form.register('startTime')}
        />
        <Field
          label={texts.end}
          type="time"
          error={errors.endTime?.message}
          {...form.register('endTime')}
        />
      </div>

      <Field
        label={texts.location}
        autoComplete="off"
        error={errors.location?.message}
        {...form.register('location')}
      />
      <Field
        label={texts.meetingUrl}
        type="url"
        inputMode="url"
        placeholder="https://"
        error={errors.meetingUrl?.message}
        {...form.register('meetingUrl')}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field
          label={texts.validFrom}
          type="date"
          error={errors.validFrom?.message}
          {...form.register('validFrom')}
        />
        <Field
          label={texts.validTo}
          type="date"
          error={errors.validTo?.message}
          {...form.register('validTo')}
        />
      </div>

      {save.isError ? (
        <p role="alert" className="text-sm text-danger">
          {es.schedule.actionError}
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
