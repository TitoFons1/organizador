import type { ZodType } from 'zod';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** Codigo estable del servidor (p. ej. `INVALID_EMAIL_OR_PASSWORD`), si lo hay. */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

async function request<T>(method: Method, path: string, schema: ZodType<T>, body?: unknown) {
  const response = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const info = (payload ?? {}) as { message?: unknown; code?: unknown };
    throw new ApiError(
      typeof info.message === 'string' ? info.message : `${method} ${path} -> ${response.status}`,
      response.status,
      typeof info.code === 'string' ? info.code : undefined,
    );
  }
  // 204 y respuestas vacias: el esquema decide si eso es valido.
  const text = await response.text();
  return schema.parse(text.length > 0 ? JSON.parse(text) : undefined);
}

export const apiGet = <T>(path: string, schema: ZodType<T>) => request('GET', path, schema);
export const apiPost = <T>(path: string, body: unknown, schema: ZodType<T>) =>
  request('POST', path, schema, body);
export const apiPut = <T>(path: string, body: unknown, schema: ZodType<T>) =>
  request('PUT', path, schema, body);
export const apiPatch = <T>(path: string, body: unknown, schema: ZodType<T>) =>
  request('PATCH', path, schema, body);
export const apiDelete = <T>(path: string, schema: ZodType<T>, body?: unknown) =>
  request('DELETE', path, schema, body);
