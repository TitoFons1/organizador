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

describe('errores no controlados', () => {
  let context: TestContext;

  beforeAll(async () => {
    context = await createTestContext();
    // Ruta solo para el test: simula un fallo de la BD con detalles que no deben llegar al cliente.
    context.app.get('/api/v1/test/boom', async () => {
      throw new Error('Failed query: select * from "user" params: ana@example.com');
    });
  });
  afterAll(() => context.close());

  it('responden 500 con un mensaje generico, sin la SQL ni los parametros', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/api/v1/test/boom' });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ statusCode: 500, code: 'INTERNAL_ERROR' });
    expect(response.body).not.toContain('Failed query');
    expect(response.body).not.toContain('ana@example.com');
  });

  it('los errores 4xx conservan su mensaje y su codigo', async () => {
    const response = await context.app.inject({ method: 'GET', url: '/api/v1/subjects' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ statusCode: 401, message: 'Debes iniciar sesion.' });
  });
});
