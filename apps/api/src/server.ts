import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildApp } from './app';
import { createDb } from './db/client';
import { loadEnv } from './env';

const env = loadEnv();

// Con una URL file:./ruta/archivo.db nos aseguramos de que la carpeta exista.
if (env.DATABASE_URL.startsWith('file:') && !env.DATABASE_URL.includes(':memory:')) {
  mkdirSync(dirname(env.DATABASE_URL.slice('file:'.length)), { recursive: true });
}

const database = createDb(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);

const app = await buildApp({ database, logger: true });

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
