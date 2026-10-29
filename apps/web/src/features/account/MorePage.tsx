import { ChevronRight, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { es } from '../../i18n/es';
import { AccountCard } from '../auth/AccountCard';

/** "Más": lo que no cabe en la barra inferior. Crecera con grupos, ajustes y notas (M7). */
export function MorePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">{es.more.title}</h1>
      <nav aria-label={es.more.title}>
        <Link
          to="/papelera"
          className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-surface px-4 font-medium"
        >
          <Trash2 aria-hidden className="size-5 text-fg-muted" />
          <span className="flex-1">{es.more.trash}</span>
          <ChevronRight aria-hidden className="size-5 text-fg-muted" />
        </Link>
      </nav>
      <AccountCard />
    </div>
  );
}
