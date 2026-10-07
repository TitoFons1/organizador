import helmet from '@fastify/helmet';
import { healthResponseSchema } from '@organizador/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Database } from './db/client';

interface BuildAppOptions {
  database: Database;
  logger?: boolean;
}

export async function buildApp({ database, logger = false }: BuildAppOptions) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, {
    // La CSP la afinaremos al servir la web desde la propia API (fase de despliegue).
    contentSecurityPolicy: false,
  });

  app.get('/api/v1/health', { schema: { response: { 200: healthResponseSchema } } }, async () => {
    let db: 'up' | 'down' = 'up';
    try {
      await database.client.execute('select 1');
    } catch (error) {
      app.log.error({ err: error }, 'La base de datos no responde');
      db = 'down';
    }
    return { status: 'ok' as const, db, time: new Date().toISOString() };
  });

  return app as unknown as FastifyInstance;
}
