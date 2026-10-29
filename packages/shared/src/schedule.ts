import { z } from 'zod';
import { civilDateSchema, isCivilDate, weekday } from './civil-date';
import { httpUrlSchema } from './subjects';

/**
 * Horas "civiles" `HH:MM` (24 h) sin zona, igual que las fechas (D4): una clase a las 17:40 sigue
 * a las 17:40 el dia del cambio de hora.
 */
export type CivilTime = string;

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isCivilTime = (value: string): value is CivilTime => TIME_PATTERN.test(value);

export const civilTimeSchema = z.string().refine(isCivilTime, {
  message: 'Hora no válida (se espera HH:MM)',
});

// ── Franjas de horario ──────────────────────────────────────────────────────

export const SLOT_KINDS = ['clase', 'tutoria'] as const;
export const slotKindSchema = z.enum(SLOT_KINDS);
export type SlotKind = z.infer<typeof slotKindSchema>;

/** `weekly`: un dia de la semana cada N semanas. `dates`: fechas sueltas e irregulares. */
export const RECURRENCES = ['weekly', 'dates'] as const;
export const recurrenceSchema = z.enum(RECURRENCES);
export type Recurrence = z.infer<typeof recurrenceSchema>;

export const MAX_INTERVAL_WEEKS = 4;
export const SLOT_DATES_MAX = 200;
export const SLOT_LOCATION_MAX = 80;

const slotFields = z.object({
  subjectId: z.string().min(1).max(64),
  kind: slotKindSchema,
  recurrence: recurrenceSchema,
  /** Dia ISO: 1 = lunes ... 7 = domingo. Solo en `weekly`. */
  weekday: z.number().int().min(1).max(7).nullable(),
  intervalWeeks: z.number().int().min(1).max(MAX_INTERVAL_WEEKS),
  /**
   * Un dia con clase que fija que semanas tocan cuando hay intervalo ("la primera es el 13 oct").
   * La paridad es fija desde el ancla aunque un festivo se coma una clase (decision del plan).
   */
  anchorDate: civilDateSchema.nullable(),
  /** Solo en `dates`. */
  dates: z.array(civilDateSchema).max(SLOT_DATES_MAX).nullable(),
  startTime: civilTimeSchema,
  endTime: civilTimeSchema,
  location: z.string().trim().min(1).max(SLOT_LOCATION_MAX).nullable(),
  meetingUrl: httpUrlSchema.nullable(),
  /** Limites opcionales (p. ej. una asignatura que solo es del 2o cuatrimestre). */
  validFrom: civilDateSchema.nullable(),
  validTo: civilDateSchema.nullable(),
});

type SlotFields = z.infer<typeof slotFields>;

export type SlotProblem =
  | 'END_NOT_AFTER_START'
  | 'WEEKDAY_REQUIRED'
  | 'ANCHOR_REQUIRED'
  | 'ANCHOR_WRONG_WEEKDAY'
  | 'DATES_REQUIRED'
  | 'INVALID_VALIDITY';

/**
 * Coherencia entre campos de una franja. Lo comparten el esquema de alta y el servidor al
 * aplicar un PATCH. Ignora los campos con formato invalido: de esos ya avisa su propio esquema.
 */
export function slotProblems(slot: SlotFields): SlotProblem[] {
  const problems: SlotProblem[] = [];
  if (isCivilTime(slot.startTime) && isCivilTime(slot.endTime) && slot.endTime <= slot.startTime) {
    problems.push('END_NOT_AFTER_START');
  }
  if (slot.recurrence === 'weekly') {
    if (slot.weekday === null) problems.push('WEEKDAY_REQUIRED');
    if (slot.intervalWeeks > 1 && slot.anchorDate === null) problems.push('ANCHOR_REQUIRED');
    if (
      slot.weekday !== null &&
      slot.anchorDate !== null &&
      isCivilDate(slot.anchorDate) &&
      weekday(slot.anchorDate) !== slot.weekday
    ) {
      problems.push('ANCHOR_WRONG_WEEKDAY');
    }
  } else if (slot.dates === null || slot.dates.length === 0) {
    problems.push('DATES_REQUIRED');
  }
  if (slot.validFrom !== null && slot.validTo !== null && slot.validTo < slot.validFrom) {
    problems.push('INVALID_VALIDITY');
  }
  return problems;
}

export const SLOT_PROBLEM_MESSAGES: Record<SlotProblem, string> = {
  END_NOT_AFTER_START: 'La hora de fin debe ser posterior a la de inicio',
  WEEKDAY_REQUIRED: 'Falta el día de la semana',
  ANCHOR_REQUIRED: 'Con clases cada varias semanas hay que indicar un día con clase',
  ANCHOR_WRONG_WEEKDAY: 'El día de referencia no cae en el día de la semana elegido',
  DATES_REQUIRED: 'Añade al menos una fecha',
  INVALID_VALIDITY: 'La fecha final no puede ser anterior a la inicial',
};

export const slotInputSchema = slotFields.superRefine((slot, ctx) => {
  for (const problem of slotProblems(slot)) {
    ctx.addIssue({ code: 'custom', message: SLOT_PROBLEM_MESSAGES[problem], params: { problem } });
  }
});
export type SlotInput = z.infer<typeof slotInputSchema>;

/** PATCH: cualquier subconjunto; el servidor valida la franja resultante con `slotProblems`. */
export const slotPatchSchema = slotFields.omit({ subjectId: true }).partial();
export type SlotPatch = z.infer<typeof slotPatchSchema>;

export const slotSchema = slotFields.extend({ id: z.string() });
export type Slot = z.infer<typeof slotSchema>;

// ── Excepciones sobre una fecha concreta ────────────────────────────────────

/**
 * `cancelled`: no hay clase ese dia. `moved`: la clase de `date` pasa a `newDate` (y quiza otra
 * hora). `extra`: clase anadida en `date`. Las excepciones son decisiones explicitas, asi que
 * mandan sobre el calendario: una clase movida o extra a un dia de examenes se mantiene.
 */
export const EXCEPTION_KINDS = ['cancelled', 'moved', 'extra'] as const;
export const exceptionKindSchema = z.enum(EXCEPTION_KINDS);
export type ExceptionKind = z.infer<typeof exceptionKindSchema>;

export const EXCEPTION_REASON_MAX = 200;

const exceptionFields = z.object({
  date: civilDateSchema,
  kind: exceptionKindSchema,
  newDate: civilDateSchema.nullable(),
  /** Si faltan, se usa la hora de la franja. */
  newStart: civilTimeSchema.nullable(),
  newEnd: civilTimeSchema.nullable(),
  reason: z.string().trim().min(1).max(EXCEPTION_REASON_MAX).nullable(),
});

export const exceptionInputSchema = exceptionFields.superRefine((exception, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (exception.kind === 'moved' && exception.newDate === null) {
    issue('Falta la fecha a la que se mueve la clase');
  }
  if (exception.kind !== 'moved' && exception.newDate !== null) {
    issue('Solo una clase movida tiene fecha nueva');
  }
  if (
    exception.kind === 'cancelled' &&
    (exception.newStart !== null || exception.newEnd !== null)
  ) {
    issue('Una clase cancelada no tiene horario');
  }
  if ((exception.newStart === null) !== (exception.newEnd === null)) {
    issue('Indica las dos horas o ninguna');
  }
  if (
    exception.newStart !== null &&
    exception.newEnd !== null &&
    isCivilTime(exception.newStart) &&
    isCivilTime(exception.newEnd) &&
    exception.newEnd <= exception.newStart
  ) {
    issue(SLOT_PROBLEM_MESSAGES.END_NOT_AFTER_START);
  }
});
export type ExceptionInput = z.infer<typeof exceptionInputSchema>;

export const slotExceptionSchema = exceptionFields.extend({ id: z.string(), slotId: z.string() });
export type SlotException = z.infer<typeof slotExceptionSchema>;

/** `GET /schedule`: franjas y excepciones en bruto (D3: el cliente calcula las semanas). */
export const scheduleResponseSchema = z.object({
  slots: z.array(slotSchema),
  exceptions: z.array(slotExceptionSchema),
});
export type ScheduleResponse = z.infer<typeof scheduleResponseSchema>;
