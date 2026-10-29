import { z } from 'zod';

/** Claves de la paleta de asignatura. Los colores concretos (claro/oscuro) viven en la web. */
export const SUBJECT_COLORS = [
  'red',
  'orange',
  'amber',
  'lime',
  'green',
  'teal',
  'cyan',
  'blue',
  'indigo',
  'violet',
  'fuchsia',
  'pink',
] as const;

export const subjectColorSchema = z.enum(SUBJECT_COLORS);
export type SubjectColor = z.infer<typeof subjectColorSchema>;

export const SUBJECT_NAME_MAX = 80;
export const SUBJECT_SHORT_NAME_MAX = 12;
export const SUBJECT_TEACHER_MAX = 80;

/**
 * Solo http(s): estos enlaces se pintan como `<a href>` y `z.url()` a secas aceptaria
 * `javascript:` o `data:` (XSS al hacer clic).
 */
export const httpUrlSchema = z.url({ protocol: /^https?$/ }).max(2000);

export const subjectLinksSchema = z.object({
  classroom: httpUrlSchema.nullable(),
  notebooklm: httpUrlSchema.nullable(),
  repo: httpUrlSchema.nullable(),
});
export type SubjectLinks = z.infer<typeof subjectLinksSchema>;

export const EMPTY_SUBJECT_LINKS: SubjectLinks = { classroom: null, notebooklm: null, repo: null };

/** Cuerpo de `POST /subjects`. `null` = sin valor. */
export const subjectInputSchema = z.object({
  name: z.string().trim().min(1).max(SUBJECT_NAME_MAX),
  shortName: z.string().trim().min(1).max(SUBJECT_SHORT_NAME_MAX).nullable(),
  color: subjectColorSchema,
  teacher: z.string().trim().min(1).max(SUBJECT_TEACHER_MAX).nullable(),
  links: subjectLinksSchema,
});
export type SubjectInput = z.infer<typeof subjectInputSchema>;

/** Cuerpo de `PATCH /subjects/:id`: cualquier subconjunto de campos. */
export const subjectPatchSchema = subjectInputSchema.partial();
export type SubjectPatch = z.infer<typeof subjectPatchSchema>;

export const subjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  color: subjectColorSchema,
  teacher: z.string().nullable(),
  links: subjectLinksSchema,
  position: z.number().int(),
  archivedAt: z.string().nullable(),
});
export type Subject = z.infer<typeof subjectSchema>;

export const subjectListResponseSchema = z.object({ subjects: z.array(subjectSchema) });
export type SubjectListResponse = z.infer<typeof subjectListResponseSchema>;

/** Cuerpo de `PUT /subjects/order`: todos los ids, en el orden deseado. */
export const subjectOrderSchema = z.object({ ids: z.array(z.string()).max(500) });

/** `GET /subjects/:id/impact`: lo que se vera afectado al borrar la asignatura. */
export const subjectImpactSchema = z.object({
  subject: z.object({ id: z.string(), name: z.string() }),
  tasks: z.number().int(),
  notes: z.number().int(),
  slots: z.number().int(),
});
export type SubjectImpact = z.infer<typeof subjectImpactSchema>;

/** Cuerpo de `DELETE /subjects/:id`: hay que repetir el nombre para confirmar. */
export const subjectDeleteSchema = z.object({ confirmName: z.string() });

/** Dias que permanece un elemento en la papelera antes de purgarse. */
export const TRASH_RETENTION_DAYS = 30;

export const trashEntitySchema = z.enum(['subject', 'task']);
export type TrashEntity = z.infer<typeof trashEntitySchema>;

export const trashItemSchema = z.object({
  entity: trashEntitySchema,
  id: z.string(),
  name: z.string(),
  deletedAt: z.string(),
  purgeAt: z.string(),
});
export type TrashItem = z.infer<typeof trashItemSchema>;

export const trashListResponseSchema = z.object({ items: z.array(trashItemSchema) });
export type TrashListResponse = z.infer<typeof trashListResponseSchema>;
