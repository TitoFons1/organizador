import { z } from 'zod';

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

export const workspaceKindSchema = z.enum(['personal', 'group']);
export const workspaceRoleSchema = z.enum(['owner', 'member']);

export type WorkspaceKind = z.infer<typeof workspaceKindSchema>;
export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

/** Formulario de registro: lo usa el cliente para validar antes de enviar. */
export const registerFormSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

export const loginFormSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
});

export type RegisterForm = z.infer<typeof registerFormSchema>;
export type LoginForm = z.infer<typeof loginFormSchema>;

const workspaceSummarySchema = z.object({
  id: z.string(),
  kind: workspaceKindSchema,
  name: z.string(),
});

/** `GET /api/v1/me`: quien soy y en que espacio estoy trabajando. */
export const meResponseSchema = z.object({
  user: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  workspace: workspaceSummarySchema.extend({ role: workspaceRoleSchema }),
});

export type MeResponse = z.infer<typeof meResponseSchema>;

/** `GET /api/v1/workspace`: datos del espacio activo (crecera con cada hito). */
export const workspaceResponseSchema = z.object({
  workspace: workspaceSummarySchema,
  role: workspaceRoleSchema,
  members: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      role: workspaceRoleSchema,
    }),
  ),
});

export type WorkspaceResponse = z.infer<typeof workspaceResponseSchema>;
