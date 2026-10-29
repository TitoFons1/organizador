import {
  subjectDeleteSchema,
  subjectImpactSchema,
  subjectInputSchema,
  subjectListResponseSchema,
  subjectOrderSchema,
  subjectPatchSchema,
  subjectSchema,
} from '@organizador/shared';
import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import type { Database } from '../../db/client';
import {
  createSubject,
  deleteSubject,
  getSubject,
  listSubjects,
  reorderSubjects,
  setArchived,
  subjectImpact,
  updateSubject,
} from './subjects';

const idParams = z.object({ id: z.string().min(1).max(64) });

export function registerSubjectRoutes(app: FastifyInstance, deps: { database: Database }) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const { database } = deps;

  typed.get(
    '/api/v1/subjects',
    { schema: { response: { 200: subjectListResponseSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return { subjects: await listSubjects(database, workspace.id) };
    },
  );

  typed.post(
    '/api/v1/subjects',
    { schema: { body: subjectInputSchema, response: { 201: subjectSchema } } },
    async (request, reply) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      const created = await createSubject(database, workspace.id, request.body);
      return reply.code(201).send(created);
    },
  );

  // Registrada antes que `/:id` para que "order" no se interprete como un id.
  typed.put(
    '/api/v1/subjects/order',
    { schema: { body: subjectOrderSchema, response: { 200: subjectListResponseSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return { subjects: await reorderSubjects(database, workspace.id, request.body.ids) };
    },
  );

  typed.get(
    '/api/v1/subjects/:id',
    { schema: { params: idParams, response: { 200: subjectSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return getSubject(database, workspace.id, request.params.id);
    },
  );

  typed.patch(
    '/api/v1/subjects/:id',
    { schema: { params: idParams, body: subjectPatchSchema, response: { 200: subjectSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return updateSubject(database, workspace.id, request.params.id, request.body);
    },
  );

  for (const [action, archived] of [
    ['archive', true],
    ['unarchive', false],
  ] as const) {
    typed.post(
      `/api/v1/subjects/:id/${action}`,
      { schema: { params: idParams, response: { 200: subjectSchema } } },
      async (request) => {
        const { workspace } = await app.requireWorkspaceAccess(request);
        return setArchived(database, workspace.id, request.params.id, archived);
      },
    );
  }

  typed.get(
    '/api/v1/subjects/:id/impact',
    { schema: { params: idParams, response: { 200: subjectImpactSchema } } },
    async (request) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      return subjectImpact(database, workspace.id, request.params.id);
    },
  );

  // Doble confirmacion tambien en el servidor: hay que repetir el nombre (ver plan, seccion 5).
  typed.delete(
    '/api/v1/subjects/:id',
    { schema: { params: idParams, body: subjectDeleteSchema } },
    async (request, reply) => {
      const { workspace } = await app.requireWorkspaceAccess(request);
      await deleteSubject(database, workspace.id, request.params.id, request.body.confirmName);
      return reply.code(204).send();
    },
  );
}
