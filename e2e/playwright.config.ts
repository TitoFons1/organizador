import { defineConfig, devices } from '@playwright/test';

const API_PORT = 3100;
const WEB_PORT = 5174;
// `localhost` y no 127.0.0.1: la API solo acepta peticiones cuyo `Origin` sea APP_URL.
const WEB_URL = `http://localhost:${WEB_PORT}`;
const isCI = Boolean(process.env.CI);

/**
 * Tests de punta a punta: web (Vite) + API + SQLite reales en Chromium. Usan puertos propios y una
 * BD que se borra en cada ejecucion (`apps/api/data/e2e.db`), asi que no tocan `npm run dev`.
 */
export default defineConfig({
  testDir: './tests',
  // Un solo worker: todos los tests comparten el fichero SQLite y el limite de 10 peticiones de
  // auth por minuto y por IP (cada test registra su propia cuenta).
  workers: 1,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: WEB_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // 360 px de ancho y tactil: el movil de referencia del plan.
    { name: 'movil', use: { ...devices['Galaxy S8'] } },
    { name: 'escritorio', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      // Sin `tsx watch` ni `.env`: solo cuenta la configuracion de aqui.
      command: `node -e "require('node:fs').rmSync('data/e2e.db', { force: true })" && npx tsx src/server.ts`,
      cwd: '../apps/api',
      url: `http://127.0.0.1:${API_PORT}/api/v1/health`,
      env: {
        NODE_ENV: 'test',
        HOST: '127.0.0.1',
        PORT: String(API_PORT),
        DATABASE_URL: 'file:./data/e2e.db',
        APP_URL: WEB_URL,
        ALLOW_SIGNUP: 'true',
      },
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      cwd: '../apps/web',
      url: WEB_URL,
      env: { API_PROXY_TARGET: `http://127.0.0.1:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
