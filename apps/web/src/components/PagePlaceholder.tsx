import type { ReactNode } from 'react';
import { es } from '../i18n/es';

interface PagePlaceholderProps {
  title: string;
  milestone: string;
  children?: ReactNode;
}

export function PagePlaceholder({ title, milestone, children }: PagePlaceholderProps) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-1 text-fg-muted">{es.placeholder.comingIn(milestone)}</p>
      </header>
      {children}
    </div>
  );
}
