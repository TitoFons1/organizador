import {
  calendarResponseSchema,
  importResultSchema,
  markInputSchema,
  markPatchSchema,
  markSchema,
  normalizeSeed,
  termInputSchema,
  termPatchSchema,
  termSchema,
} from '@organizador/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
// El seed se incrusta en el build del servidor (no hay que copiar el fichero al desplegar).
import courseSeed from '../../../../../data/calendario-2026-2027.seed.json';
import type { Database } from '../../db/client';
import {
  createMark,
  createTerm,
  deleteMark,
  deleteTerm,
  getCalendar,
  importCalendar,
  updateMark,
  updateTerm,
} from './calendar';

const idParams = z.object({ id: z.string().min(1).max(64) });

export function registerCalendarRoutes(app: FastifyInstance, deps: { database: Database }) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const { database } = deps;

  typed.get(
    '/api/v1/calendar',
    { schema: { response: { 200: calendarResponseSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return getCalendar(database, workspace.id);
    },
  );

  // Carga el calendario 2026-27 del repositorio (ver data/). Idempotente.
  typed.post(
    '/api/v1/calendar/import-seed',
    { schema: { response: { 200: importResultSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return importCalendar(database, workspace.id, normalizeSeed(courseSeed));
    },
  );

  // ── Marcas ────────────────────────────────────────────────────────────────
  typed.post(
    '/api/v1/marks',
    { schema: { body: markInputSchema, response: { 201: markSchema } } },
    async (request, reply) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return reply.code(201).send(await createMark(database, workspace.id, request.body));
    },
  );

  typed.patch(
    '/api/v1/marks/:id',
    { schema: { params: idParams, body: markPatchSchema, response: { 200: markSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return updateMark(database, workspace.id, request.params.id, request.body);
    },
  );

  typed.delete('/api/v1/marks/:id', { schema: { params: idParams } }, async (request, reply) => {
    const { workspace } = await app.requireWorkspaceAccess(request);
    await deleteMark(database, workspace.id, request.params.id);
    return reply.code(204).send();
  });

  // ── Cuatrimestres ─────────────────────────────────────────────────────────
  typed.post(
    '/api/v1/terms',
    { schema: { body: termInputSchema, response: { 201: termSchema } } },
    async (request, reply) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return reply.code(201).send(await createTerm(database, workspace.id, request.body));
    },
  );

  typed.patch(
    '/api/v1/terms/:id',
    { schema: { params: idParams, body: termPatchSchema, response: { 200: termSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return updateTerm(database, workspace.id, request.params.id, request.body);
    },
  );

  typed.delete('/api/v1/terms/:id', { schema: { params: idParams } }, async (request, reply) => {
    const { workspace } = await app.requireWorkspaceAccess(request);
    await deleteTerm(database, workspace.id, request.params.id);
    return reply.code(204).send();
  });
}
