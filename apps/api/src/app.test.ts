import { healthResponseSchema } from '@organizador/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './test/helpers';

describe('GET /api/v1/health', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
  });
  afterAll(() => context.close());

  it('responde ok y confirma que la base de datos esta arriba', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    const body = healthResponseSchema.parse(response.json());
    expect(body.status).toBe('ok');
    expect(body.db).toBe('up');
  });

  it('envia cabeceras de seguridad basicas', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
