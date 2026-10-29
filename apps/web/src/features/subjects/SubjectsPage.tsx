import type { Subject } from '@organizador/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Link } from 'react-router';
import { Button, buttonClasses, IconButton } from '../../components/ui/Button';
import { es } from '../../i18n/es';
import {
  archiveSubject,
  fetchSubjects,
  reorderSubjects,
  SUBJECTS_KEY,
  unarchiveSubject,
} from './api';
import { SubjectBadge } from './SubjectBadge';

const LINK_LABELS = [
  ['classroom', es.subjects.classroom],
  ['notebooklm', es.subjects.notebooklm],
  ['repo', es.subjects.repo],
] as const;

export function SubjectsPage() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SUBJECTS_KEY, queryFn: fetchSubjects });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY });

  const archive = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      archived ? archiveSubject(id) : unarchiveSubject(id),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: reorderSubjects,
    // Se mueve al instante en pantalla y se deshace si el servidor lo rechaza.
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: SUBJECTS_KEY });
      const previous = queryClient.getQueryData<Subject[]>(SUBJECTS_KEY);
      if (previous) {
        queryClient.setQueryData(
          SUBJECTS_KEY,
          ids.flatMap((id) => previous.filter((subject) => subject.id === id)),
        );
      }
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(SUBJECTS_KEY, context.previous);
    },
    onSettled: invalidate,
  });

  const all = query.data ?? [];
  const active = all.filter((subject) => subject.archivedAt === null);
  const archived = all.filter((subject) => subject.archivedAt !== null);

  /** Intercambia la asignatura con su vecina activa; el servidor recibe la lista completa. */
  const move = (id: string, delta: -1 | 1) => {
    const index = active.findIndex((subject) => subject.id === id);
    const neighbour = active[index + delta];
    if (!neighbour) return;
    const ids = all.map((subject) => subject.id);
    const a = ids.indexOf(id);
    const b = ids.indexOf(neighbour.id);
    [ids[a], ids[b]] = [ids[b]!, ids[a]!];
    reorder.mutate(ids);
  };

  const failed = archive.isError || reorder.isError;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{es.subjects.title}</h1>
        {query.isSuccess && all.length > 0 ? (
          <Link to="/asignaturas/nueva" className={buttonClasses('primary')}>
            <Plus aria-hidden className="size-4" />
            {es.subjects.add}
          </Link>
        ) : null}
      </header>

      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {es.subjects.actionError}
        </p>
      ) : null}

      {query.isPending ? <p className="text-fg-muted">{es.common.loading}</p> : null}
      {query.isError ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert">{es.subjects.loadError}</p>
          <Button variant="secondary" onClick={() => void query.refetch()}>
            {es.common.retry}
          </Button>
        </div>
      ) : null}

      {query.isSuccess && all.length === 0 ? (
        <section className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
          <h2 className="text-lg font-medium">{es.subjects.emptyTitle}</h2>
          <p className="text-fg-muted">{es.subjects.emptyText}</p>
          <Link to="/asignaturas/nueva" className={buttonClasses('primary')}>
            <Plus aria-hidden className="size-4" />
            {es.subjects.addFirst}
          </Link>
        </section>
      ) : null}

      <ul className="flex flex-col gap-3">
        {active.map((subject, index) => (
          <SubjectCard key={subject.id} subject={subject}>
            <IconButton
              label={es.subjects.moveUp(subject.name)}
              disabled={index === 0 || reorder.isPending}
              onClick={() => move(subject.id, -1)}
            >
              <ChevronUp aria-hidden className="size-5" />
            </IconButton>
            <IconButton
              label={es.subjects.moveDown(subject.name)}
              disabled={index === active.length - 1 || reorder.isPending}
              onClick={() => move(subject.id, 1)}
            >
              <ChevronDown aria-hidden className="size-5" />
            </IconButton>
            <EditLink subject={subject} />
            <IconButton
              label={es.subjects.archive(subject.name)}
              disabled={archive.isPending}
              onClick={() => archive.mutate({ id: subject.id, archived: true })}
            >
              <Archive aria-hidden className="size-5" />
            </IconButton>
            <DeleteLink subject={subject} />
          </SubjectCard>
        ))}
      </ul>

      {archived.length > 0 ? (
        <details className="rounded-xl border border-border bg-surface">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">
            {es.subjects.archived(archived.length)}
          </summary>
          <ul className="flex flex-col gap-3 p-3 pt-0">
            {archived.map((subject) => (
              <SubjectCard key={subject.id} subject={subject}>
                <EditLink subject={subject} />
                <IconButton
                  label={es.subjects.unarchive(subject.name)}
                  disabled={archive.isPending}
                  onClick={() => archive.mutate({ id: subject.id, archived: false })}
                >
                  <ArchiveRestore aria-hidden className="size-5" />
                </IconButton>
                <DeleteLink subject={subject} />
              </SubjectCard>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function EditLink({ subject }: { subject: Subject }) {
  return (
    <Link
      to={`/asignaturas/${subject.id}/editar`}
      aria-label={es.subjects.edit(subject.name)}
      title={es.subjects.edit(subject.name)}
      className={buttonClasses('ghost', 'size-11 px-0')}
    >
      <Pencil aria-hidden className="size-5" />
    </Link>
  );
}

function DeleteLink({ subject }: { subject: Subject }) {
  return (
    <Link
      to={`/asignaturas/${subject.id}/eliminar`}
      aria-label={es.subjects.remove(subject.name)}
      title={es.subjects.remove(subject.name)}
      className={buttonClasses('ghost', 'size-11 px-0 hover:text-danger')}
    >
      <Trash2 aria-hidden className="size-5" />
    </Link>
  );
}

function SubjectCard({ subject, children }: { subject: Subject; children: React.ReactNode }) {
  const links = LINK_LABELS.flatMap(([key, label]) => {
    const href = subject.links[key];
    return href ? [{ key, label, href }] : [];
  });

  return (
    <li className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <SubjectBadge color={subject.color} label={subject.shortName} className="mt-0.5 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="font-medium break-words">{subject.name}</h2>
          {subject.teacher ? (
            <p className="text-sm text-fg-muted">
              {es.subjects.teacher}: {subject.teacher}
            </p>
          ) : null}
          {links.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {links.map(({ key, label, href }) => (
                <li key={key}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={es.subjects.openLink(label, subject.name)}
                    className="inline-flex min-h-8 items-center gap-1 text-sm font-medium text-primary underline"
                  >
                    {label}
                    <ExternalLink aria-hidden className="size-3.5" />
                  </a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1 border-t border-border pt-2">{children}</div>
    </li>
  );
}
