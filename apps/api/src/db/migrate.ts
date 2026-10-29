import { migrate } from 'drizzle-orm/libsql/migrator';
import type { Database } from './client';

/** Aplica las migraciones pendientes de `apps/api/drizzle`. Es idempotente. */
export async function runMigrations(database: Database, migrationsFolder: string) {
  await migrate(database.db, { migrationsFolder });
}
