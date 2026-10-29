import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { AUTH_BASE_PATH, type Auth } from './auth';

export interface RateLimitRule {
  max: number;
  timeWindow: string | number;
}

export interface AuthRoutesOptions {
  auth: Auth;
  /** Limite por IP para las peticiones que cambian estado (registro, login, logout). */
  writeLimit: RateLimitRule;
  /** Limite por IP para las lecturas (`get-session`), que el cliente repite a menudo. */
  readLimit: RateLimitRule;
}

// Cabeceras que Fastify/undici calculan por su cuenta al reenviar el cuerpo ya procesado.
const HOP_HEADERS = new Set(['content-length', 'transfer-encoding', 'connection']);

function toWebRequest(request: FastifyRequest) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || HOP_HEADERS.has(name)) continue;
    for (const item of Array.isArray(value) ? value : [value]) headers.append(name, item);
  }
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD' && request.body != null;
  return new Request(new URL(request.url, `${request.protocol}://${request.host}`), {
    method: request.method,
    headers,
    ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
  });
}

async function sendWebResponse(reply: FastifyReply, response: Response) {
  reply.status(response.status);
  response.headers.forEach((value, name) => {
    // `forEach` fusionaria varias Set-Cookie en una sola: se reenvian aparte con getSetCookie().
    if (name === 'set-cookie' || HOP_HEADERS.has(name)) return;
    reply.header(name, value);
  });
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) reply.header('set-cookie', cookies);
  const body = await response.text();
  return reply.send(body.length > 0 ? body : null);
}

/** Monta Better Auth bajo `/api/v1/auth/*` (registro, login, logout y sesion). */
export function registerAuthRoutes(app: FastifyInstance, options: AuthRoutesOptions) {
  const handler = async (request: FastifyRequest, reply: FastifyReply) =>
    sendWebResponse(reply, await options.auth.handler(toWebRequest(request)));

  app.route({
    method: ['POST'],
    url: `${AUTH_BASE_PATH}/*`,
    config: { rateLimit: options.writeLimit },
    handler,
  });
  app.route({
    method: ['GET'],
    url: `${AUTH_BASE_PATH}/*`,
    config: { rateLimit: options.readLimit },
    handler,
  });
}
