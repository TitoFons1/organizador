import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from './health';

describe('healthResponseSchema', () => {
  it('acepta una respuesta valida', () => {
    const result = healthResponseSchema.safeParse({
      status: 'ok',
      db: 'up',
      time: '2026-10-07T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rechaza un estado de base de datos desconocido', () => {
    const result = healthResponseSchema.safeParse({ status: 'ok', db: 'maybe', time: 'x' });
    expect(result.success).toBe(false);
  });
});
