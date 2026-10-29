import {
  httpUrlSchema,
  isCivilDate,
  isCivilTime,
  slotKindSchema,
  slotProblems,
  type Slot,
  type SlotInput,
  type SlotProblem,
} from '@organizador/shared';
import { z } from 'zod';
import { es } from '../../i18n/es';
import { formatShort } from '../../lib/dates';

const texts = es.schedule.form;

const REPEATS = ['1', '2', '3', '4', 'dates'] as const;
export type Repeat = (typeof REPEATS)[number];
export const REPEAT_OPTIONS = REPEATS;

const optionalDate = z
  .string()
  .refine((value) => value === '' || isCivilDate(value), { message: texts.invalidDate });
const time = z.string().refine(isCivilTime, { message: texts.invalidTime });

/** Campos del formulario (texto, como los da el navegador). `toSlotInput` los traduce. */
const formFields = z.object({
  kind: slotKindSchema,
  repeat: z.enum(REPEATS),
  weekday: z.enum(['1', '2', '3', '4', '5', '6', '7']),
  anchorDate: optionalDate,
  dates: z.array(z.string().refine(isCivilDate)),
  startTime: time,
  endTime: time,
  location: z.string().trim().max(80),
  meetingUrl: z
    .string()
    .trim()
    .refine((value) => value === '' || httpUrlSchema.safeParse(value).success, {
      message: texts.invalidUrl,
    }),
  validFrom: optionalDate,
  validTo: optionalDate,
});

export type SlotFormValues = z.infer<typeof formFields>;

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Los campos de la franja sin la asignatura: es lo que se envia en un PATCH. */
export function toSlotFields(values: SlotFormValues): Omit<SlotInput, 'subjectId'> {
  const weekly = values.repeat !== 'dates';
  const intervalWeeks = weekly ? Number(values.repeat) : 1;
  return {
    kind: values.kind,
    recurrence: weekly ? 'weekly' : 'dates',
    weekday: weekly ? Number(values.weekday) : null,
    intervalWeeks,
    // Cada semana no necesita ancla: se ignora aunque quedara escrita de antes.
    anchorDate: weekly && intervalWeeks > 1 ? orNull(values.anchorDate) : null,
    dates: weekly ? null : [...new Set(values.dates)].sort(),
    startTime: values.startTime,
    endTime: values.endTime,
    location: orNull(values.location),
    meetingUrl: orNull(values.meetingUrl),
    validFrom: orNull(values.validFrom),
    validTo: orNull(values.validTo),
  };
}

export const toSlotInput = (values: SlotFormValues, subjectId: string): SlotInput => ({
  subjectId,
  ...toSlotFields(values),
});

// Cada incoherencia se senala en el campo que hay que corregir.
const PROBLEM_FIELD: Record<SlotProblem, keyof SlotFormValues> = {
  END_NOT_AFTER_START: 'endTime',
  WEEKDAY_REQUIRED: 'weekday',
  ANCHOR_REQUIRED: 'anchorDate',
  ANCHOR_WRONG_WEEKDAY: 'anchorDate',
  DATES_REQUIRED: 'dates',
  INVALID_VALIDITY: 'validTo',
};

export const slotFormSchema = formFields.superRefine((values, ctx) => {
  // La asignatura no influye en la coherencia: basta una cualquiera para comprobarla.
  for (const problem of slotProblems(toSlotInput(values, '-'))) {
    ctx.addIssue({
      code: 'custom',
      path: [PROBLEM_FIELD[problem]],
      message: problemMessage(problem),
    });
  }
});

function problemMessage(problem: SlotProblem): string {
  switch (problem) {
    case 'END_NOT_AFTER_START':
      return 'La hora de fin debe ser posterior a la de inicio.';
    case 'WEEKDAY_REQUIRED':
      return 'Elige el día de la semana.';
    case 'ANCHOR_REQUIRED':
      return 'Indica un día con clase para saber qué semanas toca.';
    case 'ANCHOR_WRONG_WEEKDAY':
      return 'Ese día no cae en el día de la semana elegido.';
    case 'DATES_REQUIRED':
      return 'Añade al menos una fecha.';
    case 'INVALID_VALIDITY':
      return 'La fecha final no puede ser anterior a la inicial.';
  }
}

export function slotFormDefaults(slot?: Slot): SlotFormValues {
  if (!slot) {
    return {
      kind: 'clase',
      repeat: '1',
      weekday: '1',
      anchorDate: '',
      dates: [],
      startTime: '',
      endTime: '',
      location: '',
      meetingUrl: '',
      validFrom: '',
      validTo: '',
    };
  }
  return {
    kind: slot.kind,
    repeat: slot.recurrence === 'dates' ? 'dates' : (String(slot.intervalWeeks) as Repeat),
    weekday: String(slot.weekday ?? 1) as SlotFormValues['weekday'],
    anchorDate: slot.anchorDate ?? '',
    dates: slot.dates ?? [],
    startTime: slot.startTime,
    endTime: slot.endTime,
    location: slot.location ?? '',
    meetingUrl: slot.meetingUrl ?? '',
    validFrom: slot.validFrom ?? '',
    validTo: slot.validTo ?? '',
  };
}

/** "Clase · martes · 17:40–19:25 · cada 2 semanas, contando desde el 13 oct" */
export function describeSlot(slot: Slot): string {
  const s = es.schedule;
  const parts: string[] = [s.kinds[slot.kind]];
  if (slot.recurrence === 'weekly' && slot.weekday !== null) {
    parts.push(s.weekdays[slot.weekday - 1]!);
  }
  parts.push(`${slot.startTime}–${slot.endTime}`);
  if (slot.recurrence === 'dates') {
    parts.push(s.looseDates(slot.dates?.length ?? 0));
  } else {
    const every = s.every(slot.intervalWeeks);
    parts.push(
      slot.intervalWeeks > 1 && slot.anchorDate
        ? `${every}, ${s.fromAnchor(formatShort(slot.anchorDate))}`
        : every,
    );
  }
  if (slot.validFrom && slot.validTo) {
    parts.push(s.validity(formatShort(slot.validFrom), formatShort(slot.validTo)));
  } else if (slot.validFrom) {
    parts.push(s.validFromOnly(formatShort(slot.validFrom)));
  } else if (slot.validTo) {
    parts.push(s.validToOnly(formatShort(slot.validTo)));
  }
  return parts.join(' · ');
}
