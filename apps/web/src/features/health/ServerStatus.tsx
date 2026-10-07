import { healthResponseSchema } from '@organizador/shared';
import { useQuery } from '@tanstack/react-query';
import { es } from '../../i18n/es';
import { apiGet } from '../../lib/api';

export function ServerStatus() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet('/api/v1/health', healthResponseSchema),
    refetchInterval: 30_000,
    retry: false,
  });

  let label: string = es.status.loading;
  let dot = 'bg-fg-muted';
  if (!isPending) {
    if (isError) {
      label = es.status.error;
      dot = 'bg-danger';
    } else if (data.db === 'down') {
      label = es.status.dbDown;
      dot = 'bg-danger';
    } else {
      label = es.status.ok;
      dot = 'bg-success';
    }
  }

  return (
    <section
      aria-label={es.status.title}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <span aria-hidden className={`size-2.5 rounded-full ${dot}`} />
      <div>
        <h2 className="text-sm font-medium">{es.status.title}</h2>
        <p role="status" className="text-sm text-fg-muted">
          {label}
        </p>
      </div>
    </section>
  );
}
