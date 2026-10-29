import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Database } from '../../db/client';
import { membership, userSettings, workspace } from '../../db/schema';

const PERSONAL_WORKSPACE_NAME = 'Mi espacio';

async function findActiveWorkspaceId(database: Database, userId: string) {
  const row = await database.db.query.userSettings.findFirst({
    columns: { activeWorkspaceId: true },
    where: eq(userSettings.userId, userId),
  });
  return row?.activeWorkspaceId;
}

/**
 * Crea el espacio personal de un usuario: `Workspace(personal)` + `Membership(owner)` +
 * `UserSettings`. Devuelve el id del espacio activo.
 *
 * Es idempotente y atomica (un unico `batch` = una transaccion). Idempotente porque Better Auth
 * ejecuta su hook `create.after` fuera de la transaccion del registro: si fallase, el usuario
 * ya existiria sin espacio, y `requireWorkspaceAccess` volveria a llamar aqui para repararlo.
 */
export async function provisionPersonalWorkspace(database: Database, userId: string) {
  const existing = await findActiveWorkspaceId(database, userId);
  if (existing) return existing;

  const workspaceId = randomUUID();
  const { db } = database;
  try {
    await db.batch([
      db.insert(workspace).values({
        id: workspaceId,
        kind: 'personal',
        name: PERSONAL_WORKSPACE_NAME,
        createdBy: userId,
      }),
      db.insert(membership).values({ workspaceId, userId, role: 'owner' }),
      db.insert(userSettings).values({ userId, activeWorkspaceId: workspaceId }),
    ]);
    return workspaceId;
  } catch (error) {
    // Si dos peticiones repararon a la vez, la perdedora falla en `user_settings` y su batch
    // se revierte entero; basta con devolver el espacio de la ganadora.
    const winner = await findActiveWorkspaceId(database, userId);
    if (winner) return winner;
    throw error;
  }
}
