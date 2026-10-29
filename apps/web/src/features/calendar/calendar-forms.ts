import {
  isCivilDate,
  MARK_LABEL_MAX,
  MARK_MAX_DAYS,
  markKindSchema,
  markLength,
  TERM_NAME_MAX,
  type CivilDate,
  type Mark,
  type MarkInput,
  type Term,
  type TermInput,
} from '@organizador/shared';
import { z } from 'zod';
import { es } from '../../i18n/es';

const texts = es.calendar.markForm;

// `<input type="date">` ya entrega AAAA-MM-DD, el formato de las fechas civiles.
const dateField = z.string().refine(isCivilDate, { message: texts.invalidDate });
const bothValid = (value: { startDate: string; endDate: string }) =>
  isCivilDate(value.startDate) && isCivilDate(value.endDate);

export const markFormSchema = z
  .object({
    kind: markKindSchema,
    label: z.string().trim().min(1).max(MARK_LABEL_MAX),
    startDate: dateField,
    endDate: dateField,
    blocksClasses: z.boolean(),
  })
  .refine((value) => !bothValid(value) || value.endDate >= value.startDate, {
    path: ['endDate'],
    message: texts.invalidRange,
  })
  .refine((value) => !bothValid(value) || markLength(value) <= MARK_MAX_DAYS, {
    path: ['endDate'],
    message: texts.tooLong,
  });

export type MarkFormValues = z.infer<typeof markFormSchema>;

export function markFormDefaults(mark: Mark | undefined, date: CivilDate): MarkFormValues {
  if (mark) {
    const { kind, label, startDate, endDate, blocksClasses } = mark;
    return { kind, label, startDate, endDate, blocksClasses };
  }
  return {
    kind: 'festivo',
    label: es.calendar.kinds.festivo,
    startDate: date,
    endDate: date,
    blocksClasses: true,
  };
}

/** Los grupos no se editan en el formulario: al crear quedan vacios y al editar no se tocan. */
export const toMarkInput = (values: MarkFormValues): MarkInput => ({ ...values, groups: null });

export const termFormSchema = z
  .object({
    name: z.string().trim().min(1).max(TERM_NAME_MAX),
    startDate: dateField,
    // Vacio = sin fecha de fin (dato incompleto: genera un aviso, no un error).
    endDate: z.union([z.literal(''), dateField]),
  })
  .refine(
    (value) => value.endDate === '' || !bothValid(value) || value.endDate >= value.startDate,
    { path: ['endDate'], message: texts.invalidRange },
  );

export type TermFormValues = z.infer<typeof termFormSchema>;

export const termFormDefaults = (term?: Term): TermFormValues => ({
  name: term?.name ?? '',
  startDate: term?.startDate ?? '',
  endDate: term?.endDate ?? '',
});

export const toTermInput = (values: TermFormValues): TermInput => ({
  name: values.name,
  startDate: values.startDate,
  endDate: values.endDate === '' ? null : values.endDate,
});
