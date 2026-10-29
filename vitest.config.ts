import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/api', 'apps/web', 'packages/shared'],
    coverage: {
      provider: 'v8',
      include: ['apps/*/src/**/*.{ts,tsx}', 'packages/*/src/**/*.ts'],
      exclude: ['**/*.test.{ts,tsx}', '**/test/**'],
      reporter: ['text-summary', 'text', 'html'],
      // El motor de horario es donde un error sale caro (docs/02, M4: cobertura >= 95 %).
      thresholds: {
        'packages/shared/src/schedule*.ts': {
          lines: 95,
          branches: 95,
          functions: 95,
          statements: 95,
        },
      },
    },
  },
});
