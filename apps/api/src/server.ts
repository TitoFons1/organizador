import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { createDb } from './db/client';
import { runMigrations } from './db/migrate';
import { loadEnv } from './env';
import { purgeExpiredTrash } from './modules/trash/trash';

const env = loadEnv();

// Con una URL file:./ruta/archivo.db nos aseguramos de que la carpeta exista.
if (env.DATABASE_URL.startsWith('file:') && !env.DATABASE_URL.includes(':memory:')) {
  mkdirSync(dirname(env.DATABASE_URL.slice('file:'.length)), { recursive: true });
}

const database = createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);

// `../drizzle` resuelve a apps/api/drizzle tanto desde src/ (tsx) como desde dist/ (tsup).
await runMigrations(database, fileURLToPath(new URL('../drizzle', import.meta.url)));

const app = await buildApp({ database, env, logger: true });

// Papelera: se vacia lo que lleva mas de 30 dias, al arrancar y despues cada 6 horas.
const purgeTrash = async () => {
  try {
    const purged = await purgeExpiredTrash(database);
    if (purged > 0) app.log.info(`Papelera: ${purged} elemento(s) purgado(s)`);
  } catch (error) {
    app.log.error({ err: error }, 'No se pudo purgar la papelera');
  }
};
await purgeTrash();
const purgeTimer = setInterval(() => void purgeTrash(), 6 * 60 * 60 * 1000);
purgeTimer.unref();

const close = async (signal: string) => {
  app.log.info(`${signal} recibido, cerrando`);
  await app.close();
  database.client.close();
  process.exit(0);
};
process.on('SIGINT', () => void close('SIGINT'));
process.on('SIGTERM', () => void close('SIGTERM'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
