import type { ReactNode } from 'react';
import { es } from '../../i18n/es';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-lg font-semibold text-primary">{es.appName}</p>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-1 mb-6 text-sm text-fg-muted">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  );
}
