import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { meResponseSchema } from '@organizador/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app';
import { createDb, type Database } from '../db/client';
import { membership, userSettings } from '../db/schema';
import { runMigrations } from '../db/migrate';
import { loadEnv, type Env } from '../env';

const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));
const NO_LIMIT = { max: 100_000, timeWindow: '1 minute' };

type AppOptions = Parameters<typeof buildApp>[0];

export interface TestContext {
  database: Database;
  env: Env;
  app: FastifyInstance;
  /** Cierra la app y la BD y borra los ficheros temporales. */
  close: () => Promise<void>;
  /** Vuelve a montar la app sobre la misma BD con otras variables de entorno. */
  rebuild: (envOverrides: Record<string, string>) => Promise<FastifyInstance>;
}

/**
 * App completa sobre una BD SQLite temporal con las migraciones reales aplicadas.
 * Se usa un fichero y no `:memory:` porque libsql pierde la BD en memoria al abrir una
 * transaccion, y Better Auth las usa al registrar.
 */
export async function createTestContext(
  envOverrides: Record<string, string> = {},
  appOptions: Partial<AppOptions> = {},
): Promise<TestContext> {
  const dir = mkdtempSync(join(tmpdir(), 'organizador-api-'));
  const database = createDb(pathToFileURL(join(dir, 'test.db')).href);
  await runMigrations(database, MIGRATIONS_FOLDER);

  const apps: FastifyInstance[] = [];
  const mount = async (overrides: Record<string, string>) => {
    const env = loadEnv({ NODE_ENV: 'test', ...overrides });
    const app = await buildApp({
      database,
      env,
      authRateLimit: { write: NO_LIMIT, read: NO_LIMIT },
      ...appOptions,
    });
    apps.push(app);
    return { app, env };
  };

  const first = await mount(envOverrides);
  const context: TestContext = {
    database,
    env: first.env,
    app: first.app,
    rebuild: async (overrides) => {
      const next = await mount(overrides);
      context.env = next.env;
      context.app = next.app;
      return next.app;
    },
    close: async () => {
      for (const app of apps) await app.close();
      database.client.close();
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // En Windows libsql puede mantener el fichero bloqueado un instante; es solo basura temporal.
      }
    },
  };
  return context;
}

export interface Credentials {
  name: string;
  email: string;
  password: string;
}

export const ANA: Credentials = {
  name: 'Ana',
  email: 'ana@example.com',
  password: 'contrasena-de-ana',
};
export const BEA: Credentials = {
  name: 'Bea',
  email: 'bea@example.com',
  password: 'contrasena-de-bea',
};

/** Cabeceras de una peticion de la web: Better Auth exige `Origin` en las que cambian estado. */
export function webHeaders(env: Env, cookie?: string): Record<string, string> {
  return {
    'content-type': 'application/json',
    origin: env.APP_URL,
    ...(cookie ? { cookie } : {}),
  };
}

/** `Set-Cookie` -> valor de la cabecera `Cookie` (solo `nombre=valor`, sin atributos). */
export function cookieHeaderFrom(setCookie: string | string[] | undefined): string {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  return list.map((cookie) => cookie.split(';')[0]).join('; ');
}

export async function signUp(context: TestContext, credentials: Credentials) {
  const response = await context.app.inject({
    method: 'POST',
    url: '/api/v1/auth/sign-up/email',
    headers: webHeaders(context.env),
    payload: credentials,
  });
  return { response, cookie: cookieHeaderFrom(response.headers['set-cookie']) };
}

export async function signIn(context: TestContext, credentials: Credentials) {
  const response = await context.app.inject({
    method: 'POST',
    url: '/api/v1/auth/sign-in/email',
    headers: webHeaders(context.env),
    payload: { email: credentials.email, password: credentials.password },
  });
  return { response, cookie: cookieHeaderFrom(response.headers['set-cookie']) };
}

export function get(context: TestContext, url: string, cookie?: string) {
  return context.app.inject({
    method: 'GET',
    url,
    headers: cookie ? { cookie } : {},
  });
}

/** Peticion de la web a la API: JSON solo si hay cuerpo (Fastify rechaza JSON vacio). */
export function call(
  context: TestContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  cookie?: string,
  payload?: unknown,
) {
  const headers = webHeaders(context.env, cookie);
  if (payload === undefined) delete headers['content-type'];
  return context.app.inject({
    method,
    url,
    headers,
    ...(payload === undefined ? {} : { payload: payload as object }),
  });
}

export async function whoAmI(context: TestContext, cookie: string) {
  const response = await get(context, '/api/v1/me', cookie);
  return meResponseSchema.parse(response.json());
}

/**
 * Hasta que M7 tenga la API de grupos: mete a `member` como miembro del espacio de `owner` y lo
 * deja como su espacio activo, igual que hara "unirse con codigo".
 */
export async function joinWorkspaceOf(
  context: TestContext,
  ownerCookie: string,
  memberCookie: string,
) {
  const owner = await whoAmI(context, ownerCookie);
  const member = await whoAmI(context, memberCookie);
  const { db } = context.database;
  await db
    .insert(membership)
    .values({ workspaceId: owner.workspace.id, userId: member.user.id, role: 'member' });
  await db
    .update(userSettings)
    .set({ activeWorkspaceId: owner.workspace.id })
    .where(eq(userSettings.userId, member.user.id));
  return { owner, member };
}
