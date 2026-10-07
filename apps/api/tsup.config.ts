import { defineConfig } from 'tsup';

// El paquete compartido se publica como TypeScript, asi que lo empaquetamos dentro del build.
export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  noExternal: ['@organizador/shared'],
});
