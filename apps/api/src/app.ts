import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { healthResponseSchema } from '@organizador/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import type { Database } from './db/client';
import type { Env } from './env';
import { createAuth } from './modules/auth/auth';
import { registerAuthRoutes, type RateLimitRule } from './modules/auth/routes';
import { createRequireWorkspaceAccess } from './modules/workspaces/access';
import { registerCalendarRoutes } from './modules/calendar/routes';
import { registerSubjectRoutes } from './modules/subjects/routes';
import { registerTrashRoutes } from './modules/trash/routes';
import { registerWorkspaceRoutes } from './modules/workspaces/routes';
import { registerOriginCheck } from './plugins/origin-check';

interface BuildAppOptions {
  database: Database;
  env: Env;
  logger?: boolean;
  /** Para los tests: sustituye los limites de intentos por IP de las rutas de autenticacion. */
  authRateLimit?: { write?: RateLimitRule; read?: RateLimitRule };
}

export async function buildApp({ database, env, logger = false, authRateLimit }: BuildAppOptions) {
  const app = Fastify({ logger }).withTypeProvider<ZodTypeProvider>();
  // Los modulos reciben la instancia sin el proveedor de tipos y lo activan en cada ruta.
  const plainApp = app as unknown as FastifyInstance;

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, {
    // La CSP la afinaremos al servir la web desde la propia API (fase de despliegue).
    contentSecurityPolicy: false,
  });

  registerOriginCheck(plainApp, env.APP_URL);

  // `global: false`: solo limitan las rutas que lo piden con `config.rateLimit`.
  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: (_request, context) => ({
      statusCode: context.statusCode,
      error: 'Too Many Requests',
      message: 'Demasiados intentos. Espera un momento antes de volver a probar.',
    }),
  });

  const auth = createAuth(database, env);
  app.decorate('requireWorkspaceAccess', createRequireWorkspaceAccess({ auth, database }));

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

  registerAuthRoutes(plainApp, {
    auth,
    writeLimit: authRateLimit?.write ?? { max: 10, timeWindow: '1 minute' },
    readLimit: authRateLimit?.read ?? { max: 120, timeWindow: '1 minute' },
  });
  registerWorkspaceRoutes(plainApp, { database });
  registerCalendarRoutes(plainApp, { database });
  registerSubjectRoutes(plainApp, { database });
  registerTrashRoutes(plainApp, { database });

  return plainApp;
}
