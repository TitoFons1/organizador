import { z } from 'zod';
import { civilDateSchema, diffDays, eachDay, isCivilDate, type CivilDate } from './civil-date';

/** Tipos de marca del calendario del curso (la leyenda del Excel). */
export const MARK_KINDS = [
  'inicio_curso',
  'fin_curso',
  'festivo',
  'festivo_local',
  'vacaciones',
  'examenes',
  'defensa_proyecto',
] as const;

export const markKindSchema = z.enum(MARK_KINDS);
export type MarkKind = z.infer<typeof markKindSchema>;

/** Si una marca de ese tipo anula clases y tutorias por defecto (se puede cambiar en cada marca). */
export const DEFAULT_BLOCKS_CLASSES: Record<MarkKind, boolean> = {
  inicio_curso: false,
  fin_curso: false,
  festivo: true,
  festivo_local: true,
  vacaciones: true,
  examenes: true,
  defensa_proyecto: false,
};

/** De mayor a menor: la marca que "gana" al pintar un dia cubierto por varias. */
export const MARK_PRIORITY: readonly MarkKind[] = [
  'examenes',
  'vacaciones',
  'festivo_local',
  'festivo',
  'defensa_proyecto',
  'fin_curso',
  'inicio_curso',
];

export const MARK_LABEL_MAX = 120;
export const TERM_NAME_MAX = 60;
export const MARK_GROUP_MAX = 20;
/** Una marca dura como mucho un ano: una fecha mal escrita (2026 -> 2206) no debe colarse. */
export const MARK_MAX_DAYS = 366;

const rangeIsValid = (value: { startDate: string; endDate: string }) =>
  value.endDate >= value.startDate;
const rangeMessage = { message: 'La fecha final no puede ser anterior a la inicial' };

const markFields = z.object({
  kind: markKindSchema,
  startDate: civilDateSchema,
  endDate: civilDateSchema,
  label: z.string().trim().min(1).max(MARK_LABEL_MAX),
  blocksClasses: z.boolean(),
  /** Grupos a los que aplica (solo informativo; p. ej. los examenes de DAM/DAW). */
  groups: z.array(z.string().trim().min(1).max(MARK_GROUP_MAX)).max(12).nullable(),
});

// zod ejecuta los refine del objeto aunque una fecha ya sea invalida: sin la guarda, markLength
// lanzaria una excepcion en vez de devolver un error de validacion.
const rangeNotTooLong = (value: { startDate: string; endDate: string }) =>
  !isCivilDate(value.startDate) ||
  !isCivilDate(value.endDate) ||
  markLength(value) <= MARK_MAX_DAYS;

export const markInputSchema = markFields
  .refine(rangeIsValid, rangeMessage)
  .refine(rangeNotTooLong, {
    message: `Una marca no puede durar mas de ${MARK_MAX_DAYS} dias`,
  });
export type MarkInput = z.infer<typeof markInputSchema>;

export const markPatchSchema = markFields.partial();
export type MarkPatch = z.infer<typeof markPatchSchema>;

export const markSchema = markFields.extend({ id: z.string() });
export type Mark = z.infer<typeof markSchema>;

const termFields = z.object({
  name: z.string().trim().min(1).max(TERM_NAME_MAX),
  startDate: civilDateSchema,
  /** Sin fecha de fin = dato incompleto (genera un aviso, no un error). */
  endDate: civilDateSchema.nullable(),
});

const termRangeIsValid = (value: { startDate: string; endDate: string | null }) =>
  value.endDate === null || value.endDate >= value.startDate;

export const termInputSchema = termFields.refine(termRangeIsValid, rangeMessage);
export type TermInput = z.infer<typeof termInputSchema>;

export const termPatchSchema = termFields.partial();
export type TermPatch = z.infer<typeof termPatchSchema>;

export const termSchema = termFields.extend({ id: z.string() });
export type Term = z.infer<typeof termSchema>;

/** `GET /calendar`: todo el calendario del espacio (D3: datos en bruto, el cliente calcula). */
export const calendarResponseSchema = z.object({
  terms: z.array(termSchema),
  marks: z.array(markSchema),
});
export type CalendarResponse = z.infer<typeof calendarResponseSchema>;

export const importResultSchema = z.object({
  createdTerms: z.number().int(),
  skippedTerms: z.number().int(),
  createdMarks: z.number().int(),
  skippedMarks: z.number().int(),
});
export type ImportResult = z.infer<typeof importResultSchema>;

// ── Seed (data/calendario-2026-2027.seed.json) ──────────────────────────────

const seedKindSchema = z.enum([...MARK_KINDS, 'festivo_zaragoza']);

export const calendarSeedSchema = z.object({
  terms: z.array(
    z.object({
      name: z.string(),
      start: civilDateSchema,
      end: civilDateSchema.nullable().optional(),
    }),
  ),
  marks: z.array(
    z.object({
      kind: seedKindSchema,
      start: civilDateSchema,
      end: civilDateSchema,
      label: z.string(),
      blocksClasses: z.boolean(),
      groups: z.array(z.string()).optional(),
    }),
  ),
});
export type CalendarSeed = z.infer<typeof calendarSeedSchema>;

/** Convierte el seed al formato interno validando cada entrada (el seed es un Excel pasado a mano). */
export function normalizeSeed(seed: unknown): { terms: TermInput[]; marks: MarkInput[] } {
  const parsed = calendarSeedSchema.parse(seed);
  return {
    terms: parsed.terms.map((term) =>
      termInputSchema.parse({ name: term.name, startDate: term.start, endDate: term.end ?? null }),
    ),
    marks: parsed.marks.map((mark) =>
      markInputSchema.parse({
        // El Excel distingue "festivo de Zaragoza"; en la app es un festivo local.
        kind: mark.kind === 'festivo_zaragoza' ? 'festivo_local' : mark.kind,
        startDate: mark.start,
        endDate: mark.end,
        label: mark.label,
        blocksClasses: mark.blocksClasses,
        groups: mark.groups ?? null,
      }),
    ),
  };
}

// ── Consultas sobre marcas ──────────────────────────────────────────────────

type MarkLike = Pick<Mark, 'kind' | 'startDate' | 'endDate' | 'blocksClasses'>;

export function marksOn<T extends MarkLike>(marks: readonly T[], date: CivilDate): T[] {
  return marks.filter((mark) => mark.startDate <= date && date <= mark.endDate);
}

/** La marca que manda sobre las demas al pintar un dia (segun `MARK_PRIORITY`). */
export function dominantMark<T extends MarkLike>(marks: readonly T[]): T | undefined {
  return [...marks].sort(
    (a, b) => MARK_PRIORITY.indexOf(a.kind) - MARK_PRIORITY.indexOf(b.kind),
  )[0];
}

/** `true` si alguna marca de ese dia anula clases y tutorias. */
export function isBlockedDay(marks: readonly MarkLike[], date: CivilDate): boolean {
  return marksOn(marks, date).some((mark) => mark.blocksClasses);
}

// ── Avisos de datos incompletos ─────────────────────────────────────────────

export type CalendarWarning =
  | { code: 'NO_COURSE_START' }
  | { code: 'NO_COURSE_END' }
  | { code: 'COURSE_ENDS_BEFORE_START' }
  | { code: 'NO_TERMS' }
  | { code: 'TERM_WITHOUT_END'; term: string }
  | { code: 'TERMS_OVERLAP'; terms: [string, string] };

type TermLike = Pick<Term, 'name' | 'startDate' | 'endDate'>;

/** Fechas de inicio y fin de curso segun las marcas `inicio_curso` / `fin_curso`. */
export function courseBounds(marks: readonly Pick<Mark, 'kind' | 'startDate' | 'endDate'>[]) {
  const starts = marks.filter((m) => m.kind === 'inicio_curso').map((m) => m.startDate);
  const ends = marks.filter((m) => m.kind === 'fin_curso').map((m) => m.endDate);
  return {
    start: starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : null,
    end: ends.length > 0 ? ends.reduce((a, b) => (a > b ? a : b)) : null,
  };
}

/**
 * Avisos (no errores) sobre un calendario incompleto o incoherente. El motor de horario (M4)
 * depende de estos datos: sin fin de curso no se pueden calcular las clases futuras.
 */
export function calendarWarnings(
  terms: readonly TermLike[],
  marks: readonly Pick<Mark, 'kind' | 'startDate' | 'endDate'>[],
): CalendarWarning[] {
  const warnings: CalendarWarning[] = [];
  const { start, end } = courseBounds(marks);

  if (!start) warnings.push({ code: 'NO_COURSE_START' });
  if (!end) warnings.push({ code: 'NO_COURSE_END' });
  if (start && end && end < start) warnings.push({ code: 'COURSE_ENDS_BEFORE_START' });

  if (terms.length === 0) warnings.push({ code: 'NO_TERMS' });
  for (const term of terms) {
    if (term.endDate === null) warnings.push({ code: 'TERM_WITHOUT_END', term: term.name });
  }

  const sorted = [...terms].sort((a, b) => a.startDate.localeCompare(b.startDate));
  for (let i = 1; i < sorted.length; i += 1) {
    const previous = sorted[i - 1]!;
    const current = sorted[i]!;
    if (previous.endDate !== null && current.startDate <= previous.endDate) {
      warnings.push({ code: 'TERMS_OVERLAP', terms: [previous.name, current.name] });
    }
  }
  return warnings;
}

/** Numero de dias de un rango de marca (ambos extremos incluidos). */
export function markLength(mark: Pick<Mark, 'startDate' | 'endDate'>): number {
  return diffDays(mark.startDate, mark.endDate) + 1;
}

/** Todos los dias cubiertos por las marcas que bloquean clases (util para el motor y los tests). */
export function blockedDays(marks: readonly MarkLike[]): Set<CivilDate> {
  const days = new Set<CivilDate>();
  for (const mark of marks) {
    if (!mark.blocksClasses) continue;
    for (const day of eachDay(mark.startDate, mark.endDate)) days.add(day);
  }
  return days;
}
