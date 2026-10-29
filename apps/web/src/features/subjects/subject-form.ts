import {
  httpUrlSchema,
  SUBJECT_NAME_MAX,
  SUBJECT_SHORT_NAME_MAX,
  SUBJECT_TEACHER_MAX,
  subjectColorSchema,
  type Subject,
  type SubjectInput,
} from '@organizador/shared';
import { z } from 'zod';

const optionalUrl = z
  .string()
  .trim()
  .refine((value) => value === '' || httpUrlSchema.safeParse(value).success, {
    message: 'Escribe la dirección completa, empezando por https://',
  });

/** El formulario trabaja con cadenas (vacio = sin valor); `toSubjectInput` las pasa a `null`. */
export const subjectFormSchema = z.object({
  name: z.string().trim().min(1).max(SUBJECT_NAME_MAX),
  shortName: z.string().trim().max(SUBJECT_SHORT_NAME_MAX),
  teacher: z.string().trim().max(SUBJECT_TEACHER_MAX),
  color: subjectColorSchema,
  classroom: optionalUrl,
  notebooklm: optionalUrl,
  repo: optionalUrl,
});

export type SubjectFormValues = z.infer<typeof subjectFormSchema>;

const orNull = (value: string) => (value === '' ? null : value);

export function toSubjectInput(values: SubjectFormValues): SubjectInput {
  return {
    name: values.name,
    shortName: orNull(values.shortName),
    color: values.color,
    teacher: orNull(values.teacher),
    links: {
      classroom: orNull(values.classroom),
      notebooklm: orNull(values.notebooklm),
      repo: orNull(values.repo),
    },
  };
}

export function fromSubject(subject?: Subject): SubjectFormValues {
  return {
    name: subject?.name ?? '',
    shortName: subject?.shortName ?? '',
    teacher: subject?.teacher ?? '',
    color: subject?.color ?? 'blue',
    classroom: subject?.links.classroom ?? '',
    notebooklm: subject?.links.notebooklm ?? '',
    repo: subject?.links.repo ?? '',
  };
}
