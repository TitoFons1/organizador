import { trashEntitySchema, trashListResponseSchema } from '@organizador/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Database } from '../../db/client';
import { HttpError } from '../../http-error';
import { viewerOf } from '../workspaces/access';
import { listTrash, restoreFromTrash } from './trash';

export function registerTrashRoutes(app: FastifyInstance, deps: { database: Database }) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const { database } = deps;

  typed.get(
    '/api/v1/trash',
    { schema: { response: { 200: trashListResponseSchema } } },
    async (request) => {
      const viewer = viewerOf(await app.requireWorkspaceAccess(request));
      return { items: await listTrash(database, viewer) };
    },
  );

  typed.post(
    '/api/v1/trash/:entity/:id/restore',
    {
      schema: {
        params: z.object({ entity: trashEntitySchema, id: z.string().min(1).max(64) }),
      },
    },
    async (request, reply) => {
      const viewer = viewerOf(await app.requireWorkspaceAccess(request));
      const { entity, id } = request.params;
      const restored = await restoreFromTrash(database, viewer, entity, id);
      if (!restored) {
        throw new HttpError(404, 'No está en la papelera (o ya caducó).', 'TRASH_ITEM_NOT_FOUND');
      }
      return reply.code(204).send();
    },
  );
}
