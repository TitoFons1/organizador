import type { WorkspaceKind, WorkspaceRole } from '@organizador/shared';
import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { fromNodeHeaders } from 'better-auth/node';
import type { Database } from '../../db/client';
import { membership, workspace } from '../../db/schema';
import { HttpError } from '../../http-error';
import type { Auth } from '../auth/auth';
import { provisionPersonalWorkspace } from './provision';

export interface WorkspaceAccess {
  user: { id: string; name: string; email: string };
  workspace: { id: string; kind: WorkspaceKind; name: string };
  role: WorkspaceRole;
}

/** Quien pide y en que espacio: lo que necesitan los datos que dependen de la persona. */
export interface Viewer {
  workspaceId: string;
  userId: string;
}

export const viewerOf = (access: WorkspaceAccess): Viewer => ({
  workspaceId: access.workspace.id,
  userId: access.user.id,
});

export interface AccessOptions {
  /** Espacio concreto al que se quiere acceder. Si falta, se usa el espacio activo del usuario. */
  workspaceId?: string;
  /** Rol minimo exigido. `owner` reserva la ruta a quien administra el espacio. */
  role?: WorkspaceRole;
}

export type RequireWorkspaceAccess = (
  request: FastifyRequest,
  options?: AccessOptions,
) => Promise<WorkspaceAccess>;

declare module 'fastify' {
  interface FastifyInstance {
    requireWorkspaceAccess: RequireWorkspaceAccess;
  }
}

/**
 * D1: toda ruta que toque datos de un espacio pasa por aqui. Garantiza, en este orden, que hay
 * sesion (401), que el usuario es miembro del espacio (404, para no revelar si existe) y que
 * tiene el rol exigido (403). Las consultas posteriores deben filtrar por `workspace.id`.
 */
export function createRequireWorkspaceAccess(deps: {
  auth: Auth;
  database: Database;
}): RequireWorkspaceAccess {
  const { auth, database } = deps;

  return async (request, options = {}) => {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) throw new HttpError(401, 'Debes iniciar sesion.');

    const { id, name, email } = session.user;
    // Si el registro quedo a medias (sin espacio), se repara aqui en vez de dejar la cuenta rota.
    const workspaceId = options.workspaceId ?? (await provisionPersonalWorkspace(database, id));

    const row = await database.db
      .select({
        id: workspace.id,
        kind: workspace.kind,
        name: workspace.name,
        role: membership.role,
      })
      .from(membership)
      .innerJoin(workspace, eq(workspace.id, membership.workspaceId))
      .where(and(eq(membership.userId, id), eq(membership.workspaceId, workspaceId)))
      .get();

    if (!row) throw new HttpError(404, 'Espacio no encontrado.');
    if (options.role === 'owner' && row.role !== 'owner') {
      throw new HttpError(403, 'No tienes permiso para hacer esto en este espacio.');
    }

    return {
      user: { id, name, email },
      workspace: { id: row.id, kind: row.kind, name: row.name },
      role: row.role,
    };
  };
}
