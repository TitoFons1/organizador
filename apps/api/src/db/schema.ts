import { randomUUID } from 'node:crypto';
import {
  EXCEPTION_KINDS,
  MARK_KINDS,
  RECURRENCES,
  SLOT_KINDS,
  SUBJECT_COLORS,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TYPES,
  TASK_VISIBILITIES,
  type SubjectLinks,
} from '@organizador/shared';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) => integer(name, { mode: 'timestamp_ms' });
const createdAt = () =>
  timestamp('created_at')
    .notNull()
    .$defaultFn(() => new Date());
const updatedAt = () =>
  timestamp('updated_at')
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

// ── Better Auth ─────────────────────────────────────────────────────────────
// Los nombres de tabla y las propiedades (`user`, `emailVerified`...) los fija Better Auth;
// los nombres de columna en SQL son libres. Si se actualiza la libreria, revisar este bloque.

export const user = sqliteTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).notNull().default(false),
  image: text('image'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = sqliteTable(
  'session',
  {
    id: text('id').primaryKey(),
    expiresAt: timestamp('expires_at').notNull(),
    token: text('token').notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)],
);

export const account = sqliteTable(
  'account',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    // Hash scrypt de la contrasena (providerId = 'credential'). Nunca se devuelve por la API.
    password: text('password'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('account_user_id_idx').on(table.userId)],
);

export const verification = sqliteTable(
  'verification',
  {
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)],
);

// ── Espacios de trabajo ─────────────────────────────────────────────────────
// D1: toda la estructura del curso colgara de `workspace.id`.

export const workspace = sqliteTable('workspace', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  kind: text('kind', { enum: ['personal', 'group'] }).notNull(),
  name: text('name').notNull(),
  createdBy: text('created_by')
    .notNull()
    .references(() => user.id),
  createdAt: createdAt(),
});

export const membership = sqliteTable(
  'membership',
  {
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['owner', 'member'] }).notNull(),
    joinedAt: timestamp('joined_at')
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.workspaceId, table.userId] }),
    index('membership_user_id_idx').on(table.userId),
  ],
);

export const userSettings = sqliteTable('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  activeWorkspaceId: text('active_workspace_id')
    .notNull()
    .references(() => workspace.id),
  theme: text('theme', { enum: ['system', 'light', 'dark'] })
    .notNull()
    .default('system'),
  // Convencion de date-fns (`weekStartsOn`): 1 = lunes, 0 = domingo.
  weekStart: integer('week_start').notNull().default(1),
});

// ── Estructura del curso ────────────────────────────────────────────────────

export const subject = sqliteTable(
  'subject',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    shortName: text('short_name').notNull(),
    color: text('color', { enum: SUBJECT_COLORS }).notNull(),
    teacher: text('teacher'),
    links: text('links', { mode: 'json' }).$type<SubjectLinks>().notNull(),
    position: integer('position').notNull(),
    // Archivada: terminada, se oculta del dia a dia pero se conserva.
    archivedAt: timestamp('archived_at'),
    // Borrado logico (D5): en la papelera 30 dias antes de purgarse.
    deletedAt: timestamp('deleted_at'),
    createdAt: createdAt(),
  },
  (table) => [index('subject_workspace_idx').on(table.workspaceId, table.deletedAt)],
);

// ── Calendario del curso ────────────────────────────────────────────────────
// Las fechas son "civiles" (D4): texto AAAA-MM-DD, sin hora ni zona.

export const term = sqliteTable(
  'term',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    startDate: text('start_date').notNull(),
    // Sin fecha de fin = dato incompleto (la app avisa, no falla).
    endDate: text('end_date'),
    createdAt: createdAt(),
  },
  (table) => [index('term_workspace_idx').on(table.workspaceId)],
);

export const calendarMark = sqliteTable(
  'calendar_mark',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: MARK_KINDS }).notNull(),
    startDate: text('start_date').notNull(),
    endDate: text('end_date').notNull(),
    label: text('label').notNull(),
    blocksClasses: integer('blocks_classes', { mode: 'boolean' }).notNull(),
    groups: text('groups', { mode: 'json' }).$type<string[] | null>(),
    createdAt: createdAt(),
  },
  (table) => [index('calendar_mark_workspace_idx').on(table.workspaceId, table.startDate)],
);

// ── Horario ─────────────────────────────────────────────────────────────────
// Fechas y horas civiles (D4): AAAA-MM-DD y HH:MM. `workspace_id` se repite desde la asignatura
// para filtrar por espacio sin joins (D1). Al purgar una asignatura se borran en cascada.

export const scheduleSlot = sqliteTable(
  'schedule_slot',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subject.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: SLOT_KINDS }).notNull(),
    recurrence: text('recurrence', { enum: RECURRENCES }).notNull(),
    // 1 = lunes ... 7 = domingo (ISO). Solo en `weekly`.
    weekday: integer('weekday'),
    intervalWeeks: integer('interval_weeks').notNull().default(1),
    anchorDate: text('anchor_date'),
    dates: text('dates', { mode: 'json' }).$type<string[] | null>(),
    startTime: text('start_time').notNull(),
    endTime: text('end_time').notNull(),
    location: text('location'),
    meetingUrl: text('meeting_url'),
    validFrom: text('valid_from'),
    validTo: text('valid_to'),
    createdAt: createdAt(),
  },
  (table) => [
    index('schedule_slot_workspace_idx').on(table.workspaceId),
    index('schedule_slot_subject_idx').on(table.subjectId),
  ],
);

export const slotException = sqliteTable(
  'slot_exception',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    slotId: text('slot_id')
      .notNull()
      .references(() => scheduleSlot.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    kind: text('kind', { enum: EXCEPTION_KINDS }).notNull(),
    newDate: text('new_date'),
    newStart: text('new_start'),
    newEnd: text('new_end'),
    reason: text('reason'),
    createdAt: createdAt(),
  },
  (table) => [
    index('slot_exception_slot_idx').on(table.slotId, table.date),
    index('slot_exception_workspace_idx').on(table.workspaceId),
  ],
);

/** Notas de una sesion concreta (tutorias): se comparten con el espacio, como el horario. */
export const sessionRecord = sqliteTable(
  'session_record',
  {
    slotId: text('slot_id')
      .notNull()
      .references(() => scheduleSlot.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    topic: text('topic'),
    questions: text('questions'),
    notes: text('notes'),
    recordingUrl: text('recording_url'),
    updatedAt: updatedAt(),
  },
  (table) => [
    primaryKey({ columns: [table.slotId, table.date] }),
    index('session_record_workspace_idx').on(table.workspaceId),
  ],
);

// ── Pendientes ──────────────────────────────────────────────────────────────

export const task = sqliteTable(
  'task',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => randomUUID()),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspace.id, { onDelete: 'cascade' }),
    // Sin asignatura = apuntada con la captura rapida. Al purgar la asignatura se van con ella.
    subjectId: text('subject_id').references(() => subject.id, { onDelete: 'cascade' }),
    // Subtarea (un nivel). Al purgar la tarea madre se van sus subtareas.
    parentId: text('parent_id').references((): AnySQLiteColumn => task.id, {
      onDelete: 'cascade',
    }),
    // Si se borra la cuenta, las tareas del grupo que creo siguen ahi.
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    visibility: text('visibility', { enum: TASK_VISIBILITIES }).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type', { enum: TASK_TYPES }).notNull(),
    dueDate: text('due_date'),
    dueTime: text('due_time'),
    priority: text('priority', { enum: TASK_PRIORITIES }).notNull(),
    estimateMin: integer('estimate_min'),
    // Borrado logico (D5): en la papelera 30 dias antes de purgarse.
    deletedAt: timestamp('deleted_at'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [
    index('task_workspace_idx').on(table.workspaceId, table.deletedAt),
    index('task_parent_idx').on(table.parentId),
    index('task_subject_idx').on(table.subjectId),
  ],
);

/** Estado de cada persona en cada tarea: en un grupo cada una marca la suya. Sin fila = `todo`. */
export const taskProgress = sqliteTable(
  'task_progress',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => task.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    status: text('status', { enum: TASK_STATUSES }).notNull(),
    doneAt: timestamp('done_at'),
    updatedAt: updatedAt(),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.userId] })],
);
