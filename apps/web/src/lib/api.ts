import type { ZodType } from 'zod';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiGet<T>(path: string, schema: ZodType<T>): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new ApiError(`GET ${path} -> ${response.status}`, response.status);
  }
  return schema.parse(await response.json());
}
