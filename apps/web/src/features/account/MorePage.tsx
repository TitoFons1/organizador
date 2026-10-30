import { ChevronRight, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Select } from '../../components/ui/Select';
import { es } from '../../i18n/es';
import { saveTheme, storedTheme, THEMES, type Theme } from '../../lib/theme';
import { AccountCard } from '../auth/AccountCard';
import { ServerStatus } from '../health/ServerStatus';

/** "Más": lo que no cabe en la barra inferior. Crecera con grupos y notas (M7). */
export function MorePage() {
  const [theme, setTheme] = useState<Theme>(storedTheme);

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
      <section className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4">
        <Select
          label={es.more.appearance}
          value={theme}
          onChange={(event) => {
            const next = THEMES.find((candidate) => candidate === event.target.value) ?? 'system';
            setTheme(next);
            saveTheme(next);
          }}
        >
          {THEMES.map((option) => (
            <option key={option} value={option}>
              {es.more.themes[option]}
            </option>
          ))}
        </Select>
        <p className="text-xs text-fg-muted">{es.more.themeHint}</p>
      </section>
      <AccountCard />
      <ServerStatus />
    </div>
  );
}
