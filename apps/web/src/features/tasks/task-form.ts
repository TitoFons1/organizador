import {
  isCivilDate,
  isCivilTime,
  TASK_DESCRIPTION_MAX,
  TASK_ESTIMATE_MAX_MIN,
  TASK_TITLE_MAX,
  taskPrioritySchema,
  taskTypeSchema,
  taskVisibilitySchema,
  type Task,
  type TaskInput,
} from '@organizador/shared';
import { z } from 'zod';
import { es } from '../../i18n/es';

/** El formulario trabaja con texto (vacio = sin valor); `toTaskFields` lo traduce. */
export const taskFormSchema = z
  .object({
    title: z.string().trim().min(1).max(TASK_TITLE_MAX),
    subjectId: z.string(),
    type: taskTypeSchema,
    dueDate: z.string().refine((value) => value === '' || isCivilDate(value)),
    dueTime: z.string().refine((value) => value === '' || isCivilTime(value)),
    priority: taskPrioritySchema,
    estimateMin: z
      .string()
      .refine(
        (value) =>
          value === '' ||
          (/^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= TASK_ESTIMATE_MAX_MIN),
      ),
    description: z.string().trim().max(TASK_DESCRIPTION_MAX),
    visibility: taskVisibilitySchema,
  })
  .refine((values) => values.dueTime === '' || values.dueDate !== '', {
    path: ['dueTime'],
    message: es.tasks.form.timeNeedsDate,
  });

export type TaskFormValues = z.infer<typeof taskFormSchema>;

const orNull = (value: string) => (value.trim() === '' ? null : value.trim());

/** Los campos editables; una subtarea ignora asignatura y visibilidad (son las de su madre). */
export function toTaskFields(values: TaskFormValues): Omit<TaskInput, 'parentId'> {
  return {
    title: values.title,
    subjectId: orNull(values.subjectId),
    type: values.type,
    dueDate: orNull(values.dueDate),
    dueTime: orNull(values.dueTime),
    priority: values.priority,
    estimateMin: values.estimateMin === '' ? null : Number(values.estimateMin),
    description: orNull(values.description),
    visibility: values.visibility,
  };
}

export const toTaskInput = (values: TaskFormValues): TaskInput => ({
  ...toTaskFields(values),
  parentId: null,
});

export function taskFormDefaults(task?: Task): TaskFormValues {
  return {
    title: task?.title ?? '',
    subjectId: task?.subjectId ?? '',
    type: task?.type ?? 'otro',
    dueDate: task?.dueDate ?? '',
    dueTime: task?.dueTime ?? '',
    priority: task?.priority ?? 'media',
    estimateMin: task?.estimateMin ? String(task.estimateMin) : '',
    description: task?.description ?? '',
    visibility: task?.visibility ?? 'workspace',
  };
}
