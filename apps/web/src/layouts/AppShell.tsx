import { BookOpen, CalendarDays, Ellipsis, LayoutDashboard, NotebookPen } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { es } from '../i18n/es';
import { cn } from '../lib/cn';

const NAV_ITEMS = [
  { to: '/', label: es.nav.panel, icon: LayoutDashboard },
  { to: '/calendario', label: es.nav.calendar, icon: CalendarDays },
  { to: '/asignaturas', label: es.nav.subjects, icon: BookOpen },
  { to: '/notas', label: es.nav.notes, icon: NotebookPen },
  { to: '/mas', label: es.nav.more, icon: Ellipsis },
] as const;

/** Movil: barra inferior. Escritorio (md+): barra lateral. */
export function AppShell() {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <aside className="hidden border-r border-border bg-surface md:block">
        <div className="sticky top-0 flex flex-col gap-6 p-4">
          <p className="px-3 pt-2 text-lg font-semibold">{es.appName}</p>
          <nav aria-label="Principal" className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
                  )
                }
              >
                <Icon aria-hidden className="size-5" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main className="px-4 pt-6 pb-28 md:px-8 md:pb-10">
        <Outlet />
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
                isActive ? 'text-primary' : 'text-fg-muted',
              )
            }
          >
            <Icon aria-hidden className="size-5" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
