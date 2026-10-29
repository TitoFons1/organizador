import { meResponseSchema, workspaceResponseSchema } from '@organizador/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import type { Database } from '../../db/client';
import { membership, user } from '../../db/schema';

export function registerWorkspaceRoutes(app: FastifyInstance, deps: { database: Database }) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const { db } = deps.database;

  typed.get('/api/v1/me', { schema: { response: { 200: meResponseSchema } } }, async (request) => {
    const access = await app.requireWorkspaceAccess(request);
    return { user: access.user, workspace: { ...access.workspace, role: access.role } };
  });

  typed.get(
    '/api/v1/workspace',
    { schema: { response: { 200: workspaceResponseSchema } } },
    async (request) => {
      const access = await app.requireWorkspaceAccess(request);
      const members = await db
        .select({ userId: membership.userId, name: user.name, role: membership.role })
        .from(membership)
        .innerJoin(user, eq(user.id, membership.userId))
        .where(eq(membership.workspaceId, access.workspace.id))
        .orderBy(membership.joinedAt);
      return { workspace: access.workspace, role: access.role, members };
    },
  );
}
