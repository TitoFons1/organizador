import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

export function createDb(url: string, authToken?: string) {
  const client: Client = createClient(authToken ? { url, authToken } : { url });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Database = ReturnType<typeof createDb>;
