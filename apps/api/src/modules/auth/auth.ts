import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@organizador/shared';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from '../../db/client';
import * as schema from '../../db/schema';
import type { Env } from '../../env';
import { provisionPersonalWorkspace } from '../workspaces/provision';

export const AUTH_BASE_PATH = '/api/v1/auth';

type AuthEnv = Pick<Env, 'APP_URL' | 'BETTER_AUTH_SECRET' | 'ALLOW_SIGNUP' | 'NODE_ENV'>;

export function createAuth(database: Database, env: AuthEnv) {
  const isProduction = env.NODE_ENV === 'production';

  return betterAuth({
    appName: 'Organizador DAM',
    baseURL: env.APP_URL,
    basePath: AUTH_BASE_PATH,
    secret: env.BETTER_AUTH_SECRET,
    // Solo se aceptan peticiones con `Origin` de la propia web (proteccion CSRF de Better Auth).
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(database.db, { provider: 'sqlite', schema }),
    emailAndPassword: {
      enabled: true,
      // D7: con ALLOW_SIGNUP=false nadie nuevo puede registrarse.
      disableSignUp: !env.ALLOW_SIGNUP,
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
    },
    // El limite de intentos lo aplica `@fastify/rate-limit` en la ruta (ver auth/routes.ts).
    rateLimit: { enabled: false },
    advanced: {
      useSecureCookies: isProduction,
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax', secure: isProduction },
    },
    databaseHooks: {
      user: {
        create: {
          // Se ejecuta tras confirmar el registro. Si falla, `requireWorkspaceAccess` lo repara.
          after: async (user) => {
            await provisionPersonalWorkspace(database, user.id);
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
