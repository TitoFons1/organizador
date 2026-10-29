import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      // Los tests e2e levantan su propia API en otro puerto para no chocar con `npm run dev`.
      '/api': process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:3000',
    },
  },
  test: {
    environment: 'jsdom',
    // Las pantallas grandes (los 12 meses del calendario, ~365 botones) pasan de 5 s en Windows
    // con la cobertura activada. No es un test colgado: es jsdom pintando mucho.
    testTimeout: 15_000,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
