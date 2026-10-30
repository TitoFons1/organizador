import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, buttonClasses } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { es } from '../../i18n/es';
import { ApiError } from '../../lib/api';
import { TASKS_KEY } from '../tasks/api';
import {
  deleteSubject,
  fetchSubjectImpact,
  SUBJECTS_KEY,
  subjectImpactKey,
  TRASH_KEY,
} from './api';

const normalize = (value: string) => value.trim().toLowerCase();

/**
 * Borrado con doble confirmacion: 1) revisar que se vera afectado, 2) escribir el nombre.
 * El servidor repite la comprobacion del nombre, asi que esto no es solo cosmetica.
 */
export function DeleteSubjectPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<'review' | 'confirm'>('review');
  const [typed, setTyped] = useState('');

  const impact = useQuery({
    queryKey: subjectImpactKey(id),
    queryFn: () => fetchSubjectImpact(id),
    retry: false,
  });

  const remove = useMutation({
    mutationFn: (name: string) => deleteSubject(id, name),
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: subjectImpactKey(id) });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SUBJECTS_KEY, refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: TRASH_KEY, refetchType: 'all' }),
        // Sus tareas se van con ella a la papelera.
        queryClient.invalidateQueries({ queryKey: TASKS_KEY, refetchType: 'all' }),
      ]);
      void navigate('/asignaturas', { replace: true });
    },
  });

  if (impact.isPending) return <p className="text-fg-muted">{es.common.loading}</p>;
  if (impact.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert">{es.subjects.notFound}</p>
        <Link to="/asignaturas" className={buttonClasses('secondary')}>
          {es.common.back}
        </Link>
      </div>
    );
  }

  const { subject, tasks, notes, slots } = impact.data;
  const affected = [
    tasks > 0 ? es.subjects.delete.tasks(tasks) : null,
    notes > 0 ? es.subjects.delete.notes(notes) : null,
    slots > 0 ? es.subjects.delete.slots(slots) : null,
  ].filter((item): item is string => item !== null);
  const matches = normalize(typed) === normalize(subject.name);
  const mismatch =
    remove.error instanceof ApiError && remove.error.code === 'CONFIRM_NAME_MISMATCH';

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <h1 className="text-2xl font-semibold">{es.subjects.delete.title}</h1>
      <p>{es.subjects.delete.intro(subject.name)}</p>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-medium">{es.subjects.delete.impactTitle}</h2>
        {affected.length > 0 ? (
          <ul className="mt-2 list-disc pl-5">
            {affected.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-fg-muted">{es.subjects.delete.nothing}</p>
        )}
        <p className="mt-3 text-sm text-fg-muted">{es.subjects.delete.trashInfo}</p>
        <p className="mt-1 text-sm text-fg-muted">{es.subjects.delete.archiveInstead}</p>
      </section>

      {step === 'review' ? (
        <div className="flex gap-3">
          <Button variant="danger" onClick={() => setStep('confirm')} className="flex-1">
            {es.subjects.delete.continue}
          </Button>
          <Link to="/asignaturas" className={buttonClasses('secondary')}>
            {es.common.cancel}
          </Link>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (matches) remove.mutate(typed);
          }}
          className="flex flex-col gap-4"
        >
          <Field
            label={es.subjects.delete.confirmLabel(subject.name)}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoFocus
            error={mismatch ? es.subjects.delete.mismatch : undefined}
          />
          {remove.isError && !mismatch ? (
            <p role="alert" className="text-sm text-danger">
              {es.subjects.actionError}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button
              type="submit"
              variant="danger"
              disabled={!matches || remove.isPending}
              className="flex-1"
            >
              {remove.isPending ? es.subjects.delete.confirming : es.subjects.delete.confirm}
            </Button>
            <Link to="/asignaturas" className={buttonClasses('secondary')}>
              {es.common.cancel}
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
