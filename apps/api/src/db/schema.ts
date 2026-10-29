import { randomUUID } from 'node:crypto';
import { SUBJECT_COLORS, type SubjectLinks } from '@organizador/shared';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
