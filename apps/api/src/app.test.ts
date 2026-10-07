import { healthResponseSchema } from '@organizador/shared';
import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { createDb } from './db/client';

describe('GET /api/v1/health', () => {
  const database = createDb(':memory:');

  afterAll(() => database.client.close());

  it('responde ok y confirma que la base de datos esta arriba', async () => {
    const app = await buildApp({ database });
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    const body = healthResponseSchema.parse(response.json());
    expect(body.status).toBe('ok');
    expect(body.db).toBe('up');
    await app.close();
  });

  it('envia cabeceras de seguridad basicas', async () => {
    const app = await buildApp({ database });
    const response = await app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    await app.close();
  });
});
