import { z } from 'zod';
import { addDays, civilDateSchema, startOfWeek, type CivilDate } from './civil-date';
import { civilTimeSchema } from './schedule';

// ── Pendientes ──────────────────────────────────────────────────────────────

export const TASK_TYPES = ['entrega', 'examen', 'practica', 'estudio', 'lectura', 'otro'] as const;
export const taskTypeSchema = z.enum(TASK_TYPES);
export type TaskType = z.infer<typeof taskTypeSchema>;

/** De mas a menos urgente (el orden importa al ordenar). */
export const TASK_PRIORITIES = ['alta', 'media', 'baja'] as const;
export const taskPrioritySchema = z.enum(TASK_PRIORITIES);
export type TaskPriority = z.infer<typeof taskPrioritySchema>;

/** Estado de cada persona: en un grupo, cada una marca la suya (TaskProgress). */
export const TASK_STATUSES = ['todo', 'doing', 'done'] as const;
export const taskStatusSchema = z.enum(TASK_STATUSES);
export type TaskStatus = z.infer<typeof taskStatusSchema>;

/** `workspace`: la ve todo el espacio (el grupo). `personal`: solo quien la creo. */
export const TASK_VISIBILITIES = ['workspace', 'personal'] as const;
export const taskVisibilitySchema = z.enum(TASK_VISIBILITIES);
export type TaskVisibility = z.infer<typeof taskVisibilitySchema>;

export const TASK_TITLE_MAX = 200;
export const TASK_DESCRIPTION_MAX = 4000;
/** Estimacion maxima: 40 horas. */
export const TASK_ESTIMATE_MAX_MIN = 2400;

const taskFields = z.object({
  /** `null` = sin asignatura (p. ej. lo apuntado con la captura rapida). */
  subjectId: z.string().min(1).max(64).nullable(),
  /** Subtarea de otra tarea (un solo nivel). Hereda su asignatura y su visibilidad. */
  parentId: z.string().min(1).max(64).nullable(),
  visibility: taskVisibilitySchema,
  title: z.string().trim().min(1).max(TASK_TITLE_MAX),
  description: z.string().trim().min(1).max(TASK_DESCRIPTION_MAX).nullable(),
  type: taskTypeSchema,
  dueDate: civilDateSchema.nullable(),
  dueTime: civilTimeSchema.nullable(),
  priority: taskPrioritySchema,
  estimateMin: z.number().int().min(1).max(TASK_ESTIMATE_MAX_MIN).nullable(),
});

const timeNeedsDate = (task: { dueDate?: string | null; dueTime?: string | null }) =>
  !(task.dueTime && !task.dueDate);
const timeNeedsDateMessage = { message: 'Una hora de entrega necesita fecha', path: ['dueTime'] };

export const taskInputSchema = taskFields.refine(timeNeedsDate, timeNeedsDateMessage);
export type TaskInput = z.infer<typeof taskInputSchema>;

/** PATCH: una subtarea no cambia de tarea madre; la coherencia se comprueba con el resultado. */
export const taskPatchSchema = taskFields.omit({ parentId: true }).partial();
export type TaskPatch = z.infer<typeof taskPatchSchema>;

export const taskSchema = taskFields.extend({
  id: z.string(),
  createdBy: z.string().nullable(),
  /** Estado de quien pide (cada miembro del grupo tiene el suyo). */
  status: taskStatusSchema,
  doneAt: z.string().nullable(),
});
export type Task = z.infer<typeof taskSchema>;

export const taskListResponseSchema = z.object({ tasks: z.array(taskSchema) });
export const taskProgressInputSchema = z.object({ status: taskStatusSchema });

/** Valores de una tarea nueva: lo que crea la captura rapida con solo el titulo. */
export function newTaskInput(title: string, overrides: Partial<TaskInput> = {}): TaskInput {
  return {
    subjectId: null,
    parentId: null,
    visibility: 'workspace',
    title,
    description: null,
    type: 'otro',
    dueDate: null,
    dueTime: null,
    priority: 'media',
    estimateMin: null,
    ...overrides,
  };
}

// ── Clasificacion: Atrasadas · Hoy · Esta semana · Mas adelante · Sin fecha ───

export const TASK_BUCKETS = ['overdue', 'today', 'week', 'later', 'noDate', 'done'] as const;
export type TaskBucket = (typeof TASK_BUCKETS)[number];

type Classifiable = Pick<
  Task,
  'parentId' | 'dueDate' | 'dueTime' | 'priority' | 'title' | 'status' | 'doneAt'
>;

/**
 * Grupo de una tarea respecto a `today` (fecha civil de Madrid). "Esta semana" es lo que queda
 * hasta el domingo; lo hecho va aparte para que al marcarla salga de su grupo al instante.
 */
export function taskBucket(task: Pick<Task, 'dueDate' | 'status'>, today: CivilDate): TaskBucket {
  if (task.status === 'done') return 'done';
  if (task.dueDate === null) return 'noDate';
  if (task.dueDate < today) return 'overdue';
  if (task.dueDate === today) return 'today';
  return task.dueDate <= addDays(startOfWeek(today), 6) ? 'week' : 'later';
}

const nullsLast = (a: string | null, b: string | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : a.localeCompare(b);

/** Primero lo que vence antes; a igual fecha, la hora, la prioridad y el titulo. */
export function compareTasks(a: Classifiable, b: Classifiable): number {
  return (
    nullsLast(a.dueDate, b.dueDate) ||
    nullsLast(a.dueTime, b.dueTime) ||
    TASK_PRIORITIES.indexOf(a.priority) - TASK_PRIORITIES.indexOf(b.priority) ||
    a.title.localeCompare(b.title, 'es')
  );
}

/** Solo las tareas principales: las subtareas se ven dentro de su tarea. */
export function classifyTasks<T extends Classifiable>(
  tasks: readonly T[],
  today: CivilDate,
): Record<TaskBucket, T[]> {
  const buckets = Object.fromEntries(TASK_BUCKETS.map((bucket) => [bucket, [] as T[]])) as Record<
    TaskBucket,
    T[]
  >;
  for (const task of tasks) {
    if (task.parentId === null) buckets[taskBucket(task, today)].push(task);
  }
  for (const bucket of TASK_BUCKETS) buckets[bucket].sort(compareTasks);
  // Lo ultimo hecho, arriba (sin fecha de hecho, al final).
  buckets.done.sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  return buckets;
}

/** "2/5": subtareas hechas de una tarea. */
export function subtaskProgress(
  tasks: readonly Pick<Task, 'parentId' | 'status'>[],
  parentId: string,
): { done: number; total: number } {
  const children = tasks.filter((task) => task.parentId === parentId);
  return {
    done: children.filter((task) => task.status === 'done').length,
    total: children.length,
  };
}
