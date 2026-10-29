import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Button, buttonClasses, IconButton } from '../../components/ui/Button';
import { es } from '../../i18n/es';
import { fetchSubjects, SUBJECTS_KEY } from '../subjects/api';
import { SubjectBadge } from '../subjects/SubjectBadge';
import { deleteSlot, fetchSchedule, SCHEDULE_KEY } from './api';
import { describeSlot } from './slot-form';
import { SlotForm } from './SlotForm';

const NEW = 'new';

/** Las franjas de una asignatura: cada una es una regla ("martes 16-18, cada 2 semanas..."). */
export function SlotsPage() {
  const { id = '' } = useParams();
  const queryClient = useQueryClient();
  const subjects = useQuery({ queryKey: SUBJECTS_KEY, queryFn: fetchSubjects });
  const schedule = useQuery({ queryKey: SCHEDULE_KEY, queryFn: fetchSchedule });
  // Por id: un refresco de la consulta crea objetos nuevos y no debe cerrar el formulario.
  const [editing, setEditing] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: deleteSlot,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY }),
  });

  if (subjects.isPending || schedule.isPending) {
    return <p className="text-fg-muted">{es.common.loading}</p>;
  }
  const subject = subjects.data?.find((candidate) => candidate.id === id);
  if (!subject || schedule.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert">{subject ? es.schedule.loadError : es.subjects.notFound}</p>
        <Link to="/asignaturas" className={buttonClasses('secondary')}>
          {es.common.back}
        </Link>
      </div>
    );
  }

  const slots = schedule.data.slots.filter((slot) => slot.subjectId === subject.id);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-2">
        <SubjectBadge color={subject.color} label={subject.shortName} className="self-start" />
        <h1 className="text-2xl font-semibold">{es.schedule.title(subject.name)}</h1>
        <p className="text-fg-muted">{es.schedule.intro}</p>
      </header>

      {remove.isError ? (
        <p role="alert" className="text-sm text-danger">
          {es.schedule.actionError}
        </p>
      ) : null}
      {slots.length === 0 && editing !== NEW ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-fg-muted">
          {es.schedule.empty}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {slots.map((slot) => {
          const description = describeSlot(slot);
          return editing === slot.id ? (
            <li key={slot.id}>
              <SlotForm subjectId={subject.id} slot={slot} onClose={() => setEditing(null)} />
            </li>
          ) : (
            <li
              key={slot.id}
              className="flex items-center gap-2 rounded-xl border border-border bg-surface p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium break-words">{description}</p>
                {slot.location ? <p className="text-sm text-fg-muted">{slot.location}</p> : null}
              </div>
              <IconButton label={es.schedule.edit(description)} onClick={() => setEditing(slot.id)}>
                <Pencil aria-hidden className="size-5" />
              </IconButton>
              <IconButton
                label={es.schedule.remove(description)}
                disabled={remove.isPending}
                className="hover:text-danger"
                onClick={() => remove.mutate(slot.id)}
              >
                <Trash2 aria-hidden className="size-5" />
              </IconButton>
            </li>
          );
        })}
      </ul>

      {editing === NEW ? (
        <SlotForm subjectId={subject.id} onClose={() => setEditing(null)} />
      ) : (
        <Button onClick={() => setEditing(NEW)} className="self-start">
          <Plus aria-hidden className="size-4" />
          {es.schedule.add}
        </Button>
      )}

      <Link to="/asignaturas" className={buttonClasses('ghost', 'self-start')}>
        {es.common.back}
      </Link>
    </div>
  );
}
