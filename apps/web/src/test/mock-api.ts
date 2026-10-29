import { vi } from 'vitest';

export interface MockRequest {
  method: string;
  path: string;
  body: unknown;
  /** Parametros de ruta: con la clave `"GET /api/v1/subjects/:id"`, `params.id`. */
  params: Record<string, string>;
}

type Reply = { status?: number; body?: unknown };
type Handler = Reply | ((request: MockRequest) => Reply | Promise<Reply>);

interface Route {
  method: string;
  pattern: RegExp;
  names: string[];
  handler: Handler;
}

function compile(key: string, handler: Handler): Route {
  const [method = 'GET', path = '/'] = key.split(' ');
  const names: string[] = [];
  const source = path
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:(\w+)/g, (_, name: string) => {
      names.push(name);
      return '([^/]+)';
    });
  return { method, pattern: new RegExp(`^${source}$`), names, handler };
}

/**
 * Sustituye `fetch` por una API falsa. Las claves son `"METODO /ruta"` (sin query) y admiten
 * segmentos `:param`; lo que no este definido responde 404. Devuelve el mock para poder
 * inspeccionar las llamadas.
 */
export function mockApi(handlers: Record<string, Handler>) {
  const routes = Object.entries(handlers).map(([key, handler]) => compile(key, handler));

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = String(input).split('?')[0]!;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;

    for (const route of routes) {
      if (route.method !== method) continue;
      const match = route.pattern.exec(path);
      if (!match) continue;
      const params = Object.fromEntries(
        route.names.map((name, index) => [name, decodeURIComponent(match[index + 1]!)]),
      );
      const reply =
        typeof route.handler === 'function'
          ? await route.handler({ method, path, body, params })
          : route.handler;
      return json(reply.status ?? 200, reply.body);
    }
    return json(404, { message: `Sin mock para ${method} ${path}` });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function json(status: number, body: unknown) {
  // Las respuestas 204 no pueden llevar cuerpo.
  const empty = body === undefined || status === 204;
  return new Response(empty ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Cuerpos JSON enviados con un metodo concreto a una ruta, en orden. */
export function sentBodies(fetchMock: ReturnType<typeof mockApi>, method: string, path: string) {
  return fetchMock.mock.calls
    .filter(([input, init]) => String(input) === path && (init?.method ?? 'GET') === method)
    .map(([, init]) =>
      typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null,
    );
}

export const ANA_ME = {
  user: { id: 'u1', name: 'Ana', email: 'ana@example.com' },
  workspace: { id: 'w1', kind: 'personal', name: 'Mi espacio', role: 'owner' },
} as const;

export const HEALTH_OK = {
  status: 'ok',
  db: 'up',
  time: '2026-10-08T10:00:00.000Z',
} as const;

export const UNAUTHORIZED = {
  status: 401,
  body: { statusCode: 401, error: 'Unauthorized', message: 'Debes iniciar sesion.' },
} as const;
