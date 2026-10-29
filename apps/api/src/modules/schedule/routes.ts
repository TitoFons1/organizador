import {
  exceptionInputSchema,
  scheduleResponseSchema,
  slotExceptionSchema,
  slotInputSchema,
  slotPatchSchema,
  slotSchema,
} from '@organizador/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Database } from '../../db/client';
import {
  createException,
  createSlot,
  deleteException,
  deleteSlot,
  getSchedule,
  updateSlot,
} from './schedule';

const idParams = z.object({ id: z.string().min(1).max(64) });

export function registerScheduleRoutes(app: FastifyInstance, deps: { database: Database }) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const { database } = deps;

  typed.get(
    '/api/v1/schedule',
    { schema: { response: { 200: scheduleResponseSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return getSchedule(database, workspace.id);
    },
  );

  // ── Franjas ───────────────────────────────────────────────────────────────
  typed.post(
    '/api/v1/slots',
    { schema: { body: slotInputSchema, response: { 201: slotSchema } } },
    async (request, reply) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return reply.code(201).send(await createSlot(database, workspace.id, request.body));
    },
  );

  typed.patch(
    '/api/v1/slots/:id',
    { schema: { params: idParams, body: slotPatchSchema, response: { 200: slotSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return updateSlot(database, workspace.id, request.params.id, request.body);
    },
  );

  typed.delete('/api/v1/slots/:id', { schema: { params: idParams } }, async (request, reply) => {
    const { workspace } = await app.requireWorkspaceAccess(request);
    await deleteSlot(database, workspace.id, request.params.id);
    return reply.code(204).send();
  });

  // ── Excepciones (cancelar, mover o anadir una clase concreta) ──────────────
  typed.post(
    '/api/v1/slots/:id/exceptions',
    {
      schema: {
        params: idParams,
        body: exceptionInputSchema,
        response: { 201: slotExceptionSchema },
      },
    },
    async (request, reply) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      const created = await createException(
        database,
        workspace.id,
        request.params.id,
        request.body,
      );
      return reply.code(201).send(created);
    },
  );

  typed.delete(
    '/api/v1/exceptions/:id',
    { schema: { params: idParams } },
    async (request, reply) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      await deleteException(database, workspace.id, request.params.id);
      return reply.code(204).send();
    },
  );
}
