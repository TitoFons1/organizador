import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const strongSecret = 'x'.repeat(40);

describe('loadEnv', () => {
  it('aplica valores por defecto en desarrollo', () => {
    const env = loadEnv({ NODE_ENV: 'development' });
    expect(env.PORT).toBe(3000);
    expect(env.APP_URL).toBe('http://localhost:5173');
    expect(env.ALLOW_SIGNUP).toBe(true);
    expect(env.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
  });

  it('interpreta ALLOW_SIGNUP=false como falso (no como cadena truthy)', () => {
    expect(loadEnv({ ALLOW_SIGNUP: 'false' }).ALLOW_SIGNUP).toBe(false);
    expect(loadEnv({ ALLOW_SIGNUP: 'true' }).ALLOW_SIGNUP).toBe(true);
  });

  it('rechaza un valor de ALLOW_SIGNUP que no sea true/false', () => {
    expect(() => loadEnv({ ALLOW_SIGNUP: 'no' })).toThrow(/ALLOW_SIGNUP/);
  });

  it('exige BETTER_AUTH_SECRET en produccion', () => {
    expect(() => loadEnv({ NODE_ENV: 'production' })).toThrow(/BETTER_AUTH_SECRET/);
    expect(() => loadEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: '' })).toThrow(
      /BETTER_AUTH_SECRET/,
    );
    expect(loadEnv({ NODE_ENV: 'production', BETTER_AUTH_SECRET: strongSecret })).toBeTruthy();
  });

  it('rechaza un secreto corto aunque no sea produccion', () => {
    expect(() => loadEnv({ BETTER_AUTH_SECRET: 'corto' })).toThrow(/32 caracteres/);
  });

  it('rechaza una APP_URL que no sea una URL', () => {
    expect(() => loadEnv({ APP_URL: 'localhost' })).toThrow(/APP_URL/);
  });
});
