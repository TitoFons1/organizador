import { defineConfig } from 'vitest/config';

export default defineConfig({
  // La primera ejecucion en Windows carga modulos nativos en frio y puede tardar varios segundos.
  test: { name: 'api', environment: 'node', testTimeout: 30_000, hookTimeout: 30_000 },
});
