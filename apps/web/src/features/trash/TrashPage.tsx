import type { TrashEntity } from '@organizador/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArchiveRestore } from 'lucide-react';
import { Link } from 'react-router';
import { Button, buttonClasses } from '../../components/ui/Button';
import { es } from '../../i18n/es';
import { fetchTrash, restoreFromTrash, SUBJECTS_KEY, TRASH_KEY } from '../subjects/api';

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'long' }).format(new Date(iso));

export function TrashPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: TRASH_KEY, queryFn: fetchTrash });

  const restore = useMutation({
    mutationFn: ({ entity, id }: { entity: TrashEntity; id: string }) =>
      restoreFromTrash(entity, id),
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: TRASH_KEY }),
        queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY, refetchType: 'all' }),
      ]),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{es.trash.title}</h1>
        <p className="mt-1 text-fg-muted">{es.trash.intro}</p>
      </header>

      {query.isPending ? <p className="text-fg-muted">{es.common.loading}</p> : null}
      {query.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert">{es.trash.loadError}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {es.common.retry}
          </Button>
        </div>
      ) : null}
      {restore.isError ? (
        <p role="alert" className="text-sm text-danger">
          {es.subjects.actionError}
        </p>
      ) : null}

      {query.data?.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-fg-muted">
          {es.trash.empty}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {query.data?.map((item) => (
          <li
            key={`${item.entity}-${item.id}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-fg-muted uppercase">
                {es.trash.entity[item.entity]}
              </p>
              <p className="font-medium break-words">{item.name}</p>
              <p className="text-sm text-fg-muted">
                {es.trash.deletedOn(formatDate(item.deletedAt))}
              </p>
              <p className="text-sm text-fg-muted">{es.trash.purgeOn(formatDate(item.purgeAt))}</p>
            </div>
            <Button
              variant="secondary"
              aria-label={es.trash.restoreLabel(item.name)}
              disabled={restore.isPending}
              onClick={() => restore.mutate({ entity: item.entity, id: item.id })}
            >
              <ArchiveRestore aria-hidden className="size-4" />
              {es.trash.restore}
            </Button>
          </li>
        ))}
      </ul>

      <Link to="/mas" className={buttonClasses('ghost', 'self-start')}>
        {es.common.back}
      </Link>
    </div>
  );
}
