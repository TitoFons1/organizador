import { TRASH_RETENTION_DAYS, type TrashEntity, type TrashItem } from '@organizador/shared';
import type { Database } from '../../db/client';
import { listDeletedSubjects, purgeDeletedSubjects, restoreSubject } from '../subjects/subjects';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Cada entidad con borrado logico se registra aqui (M5 anade tareas, M7 notas). */
interface TrashProvider {
  entity: TrashEntity;
  list(
    database: Database,
    workspaceId: string,
    since: Date,
  ): Promise<{ id: string; name: string; deletedAt: Date }[]>;
  restore(database: Database, workspaceId: string, id: string, since: Date): Promise<boolean>;
  purge(database: Database, before: Date): Promise<number>;
}

const providers: TrashProvider[] = [
  {
    entity: 'subject',
    list: listDeletedSubjects,
    restore: restoreSubject,
    purge: purgeDeletedSubjects,
  },
];

const retentionStart = (now: Date) => new Date(now.getTime() - TRASH_RETENTION_DAYS * DAY_MS);

export async function listTrash(
  database: Database,
  workspaceId: string,
  now = new Date(),
): Promise<TrashItem[]> {
  const since = retentionStart(now);
  const groups = await Promise.all(
    providers.map(async (provider) =>
      (await provider.list(database, workspaceId, since)).map((row) => ({
        entity: provider.entity,
        id: row.id,
        name: row.name,
        deletedAt: row.deletedAt.toISOString(),
        purgeAt: new Date(row.deletedAt.getTime() + TRASH_RETENTION_DAYS * DAY_MS).toISOString(),
      })),
    ),
  );
  return groups.flat().sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

export async function restoreFromTrash(
  database: Database,
  workspaceId: string,
  entity: TrashEntity,
  id: string,
  now = new Date(),
) {
  const provider = providers.find((candidate) => candidate.entity === entity);
  if (!provider) return false;
  return provider.restore(database, workspaceId, id, retentionStart(now));
}

/** Borra de verdad lo que lleva mas de 30 dias en la papelera. Devuelve cuantos elementos. */
export async function purgeExpiredTrash(database: Database, now = new Date()) {
  const before = retentionStart(now);
  const counts = await Promise.all(providers.map((provider) => provider.purge(database, before)));
  return counts.reduce((total, count) => total + count, 0);
}
