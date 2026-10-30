import { newTaskInput, TASK_TITLE_MAX } from '@organizador/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { es } from '../../i18n/es';
import { createTask, TASKS_KEY } from './api';

const texts = es.tasks.quick;

/**
 * Captura rapida (docs/01, 7.1): boton flotante + una sola linea. Lo apuntado queda "Sin fecha"
 * y sin asignatura; se completa despues desde el pendiente. Queda abierto para apuntar varios.
 */
export function QuickAdd() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState<string | null>(null);

  const add = useMutation({
    mutationFn: (text: string) => createTask(newTaskInput(text)),
    onSuccess: async (task) => {
      setSaved(texts.saved(task.title));
      setTitle('');
      await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
    },
  });

  const close = () => {
    setOpen(false);
    setSaved(null);
    add.reset();
  };

  return (
    <>
      {open ? (
        <div
          role="dialog"
          aria-label={texts.open}
          onKeyDown={(event) => {
            if (event.key === 'Escape') close();
          }}
          className="fixed inset-x-4 bottom-36 z-20 rounded-xl border border-border bg-surface p-4 shadow-lg md:inset-x-auto md:right-8 md:bottom-28 md:w-96"
        >
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              const text = title.trim();
              if (text) add.mutate(text);
            }}
            className="flex flex-col gap-3"
          >
            <Field
              label={texts.label}
              placeholder={texts.placeholder}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                setSaved(null);
              }}
              maxLength={TASK_TITLE_MAX}
              autoComplete="off"
              autoFocus
            />
            {saved ? (
              <p role="status" className="text-sm font-medium">
                {saved}
              </p>
            ) : null}
            {add.isError ? (
              <p role="alert" className="text-sm text-danger">
                {es.tasks.actionError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={add.isPending || title.trim() === ''}
                className="flex-1"
              >
                {texts.submit}
              </Button>
              <Button variant="secondary" onClick={close}>
                {texts.close}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
      <button
        type="button"
        aria-label={texts.open}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="fixed right-4 bottom-20 z-20 flex size-14 items-center justify-center rounded-full bg-primary text-primary-contrast shadow-lg hover:opacity-90 md:right-8 md:bottom-8"
      >
        <Plus aria-hidden className="size-6" />
      </button>
    </>
  );
}
