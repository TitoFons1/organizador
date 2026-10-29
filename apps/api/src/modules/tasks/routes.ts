import {
  taskInputSchema,
  taskListResponseSchema,
  taskPatchSchema,
  taskProgressInputSchema,
  taskSchema,
} from '@organizador/shared';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Database } from '../../db/client';
import { viewerOf as toViewer, type Viewer } from '../workspaces/access';
import { createTask, deleteTask, listTasks, setProgress, updateTask } from './tasks';

const idParams = z.object({ id: z.string().min(1).max(64) });

export function registerTaskRoutes(app: FastifyInstance, deps: { database: Database }) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const { database } = deps;

  const viewerOf = async (request: FastifyRequest): Promise<Viewer> =>
    toViewer(await app.requireWorkspaceAccess(request));

  typed.get(
    '/api/v1/tasks',
    { schema: { response: { 200: taskListResponseSchema } } },
    async (request) => ({ tasks: await listTasks(database, await viewerOf(request)) }),
  );

  typed.post(
    '/api/v1/tasks',
    { schema: { body: taskInputSchema, response: { 201: taskSchema } } },
    async (request, reply) => {
      const created = await createTask(database, await viewerOf(request), request.body);
      return reply.code(201).send(created);
    },
  );

  typed.patch(
    '/api/v1/tasks/:id',
    { schema: { params: idParams, body: taskPatchSchema, response: { 200: taskSchema } } },
    async (request) =>
      updateTask(database, await viewerOf(request), request.params.id, request.body),
  );

  typed.delete('/api/v1/tasks/:id', { schema: { params: idParams } }, async (request, reply) => {
    await deleteTask(database, await viewerOf(request), request.params.id);
    return reply.code(204).send();
  });

  // Cada persona marca su propio estado (en un grupo, la tarea es la misma para todas).
  typed.put(
    '/api/v1/tasks/:id/progress',
    {
      schema: { params: idParams, body: taskProgressInputSchema, response: { 200: taskSchema } },
    },
    async (request) =>
      setProgress(database, await viewerOf(request), request.params.id, request.body.status),
  );
}
