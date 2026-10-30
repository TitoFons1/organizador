import type { Subject } from '@organizador/shared';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { Link, NavLink, Outlet, useOutletContext, useParams } from 'react-router';
import { buttonClasses } from '../../../components/ui/Button';
import { Skeleton } from '../../../components/ui/Skeleton';
import { es } from '../../../i18n/es';
import { cn } from '../../../lib/cn';
import { fetchSubjects, SUBJECTS_KEY } from '../api';
import { SubjectBadge } from '../SubjectBadge';

const texts = es.subjectDetail;

const TABS = [
  { to: '', label: texts.tabs.summary },
  { to: 'tareas', label: texts.tabs.tasks },
  { to: 'tutorias', label: texts.tabs.tutorials },
  { to: 'notas', label: texts.tabs.notes },
  { to: 'horario', label: texts.tabs.schedule },
  { to: 'ajustes', label: texts.tabs.settings },
] as const;

const LINKS = [
  ['classroom', es.subjects.classroom],
  ['notebooklm', es.subjects.notebooklm],
  ['repo', es.subjects.repo],
] as const;

/** Lo que cada pestana recibe de la cabecera. */
export const useSubject = () => useOutletContext<{ subject: Subject }>().subject;

/**
 * Detalle de asignatura (docs/01 7.4): cabecera con color, profesor/a y accesos rapidos, y una
 * pestana por ruta (`/asignaturas/:id/tareas`...) para poder enlazarlas y volver con "atras".
 */
export function SubjectDetailLayout() {
  const { id } = useParams();
  const subjects = useQuery({ queryKey: SUBJECTS_KEY, queryFn: fetchSubjects });

  if (subjects.isPending) return <Skeleton lines={4} className="mx-auto max-w-3xl" />;
  const subject = subjects.data?.find((candidate) => candidate.id === id);
  if (!subject) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert">{subjects.isError ? es.subjects.loadError : es.subjects.notFound}</p>
        <Link to="/asignaturas" className={buttonClasses('secondary')}>
          {es.common.back}
        </Link>
      </div>
    );
  }

  const links = LINKS.flatMap(([key, label]) => {
    const href = subject.links[key];
    return href ? [{ key, label, href }] : [];
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-2">
        <SubjectBadge color={subject.color} label={subject.shortName} className="self-start" />
        <h1 className="text-2xl font-semibold break-words">{subject.name}</h1>
        {subject.teacher ? (
          <p className="text-fg-muted">
            {es.subjects.teacher}: {subject.teacher}
          </p>
        ) : null}
        {subject.archivedAt ? (
          <p className="text-sm text-fg-muted">{texts.settings.archived}</p>
        ) : null}
        {links.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {links.map(({ key, label, href }) => (
              <li key={key}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses('secondary')}
                >
                  {label}
                  <ExternalLink aria-hidden className="size-4" />
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      {/* Desplazable en movil: seis pestanas no caben en 360 px, pero la pagina no se mueve. */}
      <nav
        aria-label={texts.tabsLabel}
        className="-mx-4 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0"
      >
        {TABS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === ''}
            className={({ isActive }) =>
              cn(
                'flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-medium',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-fg-muted hover:text-fg',
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      <Outlet context={{ subject }} />
    </div>
  );
}
