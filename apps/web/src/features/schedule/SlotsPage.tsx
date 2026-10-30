import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button, IconButton } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { es } from '../../i18n/es';
import { useSubject } from '../subjects/detail/SubjectDetailLayout';
import { deleteSlot, fetchSchedule, SCHEDULE_KEY } from './api';
import { describeSlot } from './slot-form';
import { SlotForm } from './SlotForm';

const NEW = 'new';

/** Pestana Horario: las franjas de la asignatura, cada una una regla ("martes 16-18, cada 2..."). */
export function SlotsPage() {
  const subject = useSubject();
  const queryClient = useQueryClient();
  const schedule = useQuery({ queryKey: SCHEDULE_KEY, queryFn: fetchSchedule });
  // Por id: un refresco de la consulta crea objetos nuevos y no debe cerrar el formulario.
  const [editing, setEditing] = useState<string | null>(null);

  const remove = useMutation({
    mutationFn: deleteSlot,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SCHEDULE_KEY }),
  });

  if (schedule.isPending) return <Skeleton lines={2} />;
  if (schedule.isError) return <p role="alert">{es.schedule.loadError}</p>;

  const slots = schedule.data.slots.filter((slot) => slot.subjectId === subject.id);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-fg-muted">{es.schedule.intro}</p>
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
    </div>
  );
}
