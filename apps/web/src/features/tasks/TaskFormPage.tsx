import { zodResolver } from '@hookform/resolvers/zod';
import {
  newTaskInput,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TASK_TITLE_MAX,
  TASK_TYPES,
  TASK_VISIBILITIES,
  taskStatusSchema,
  type Subject,
  type Task,
} from '@organizador/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { Button, buttonClasses, IconButton } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { TextArea } from '../../components/ui/TextArea';
import { es } from '../../i18n/es';
import { useMe } from '../auth/useMe';
import { fetchSubjects, SUBJECTS_KEY, TRASH_KEY } from '../subjects/api';
import { createTask, deleteTask, fetchTasks, TASKS_KEY, updateTask } from './api';
import {
  taskFormDefaults,
  taskFormSchema,
  toTaskFields,
  toTaskInput,
  type TaskFormValues,
} from './task-form';
import { useTaskStatus } from './useTaskStatus';

const texts = es.tasks.form;

/** Alta (`/pendientes/nueva`) y ficha (`/pendientes/:id`) de un pendiente. */
export function TaskFormPage() {
  const { id } = useParams();
  const tasks = useQuery({ queryKey: TASKS_KEY, queryFn: fetchTasks });
  const subjects = useQuery({ queryKey: SUBJECTS_KEY, queryFn: fetchSubjects });

  if (tasks.isPending || subjects.isPending) {
    return <p className="text-fg-muted">{es.common.loading}</p>;
  }
  const task = id === undefined ? undefined : tasks.data?.find((candidate) => candidate.id === id);
  if (id !== undefined && !task) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p role="alert">{texts.notFound}</p>
        <Link to="/" className={buttonClasses('secondary')}>
          {es.common.back}
        </Link>
      </div>
    );
  }
  // Las archivadas siguen elegibles si la tarea ya era suya.
  const choices = (subjects.data ?? []).filter(
    (subject) => subject.archivedAt === null || subject.id === task?.subjectId,
  );

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <TaskForm key={task?.id ?? 'nueva'} task={task} subjects={choices} />
      {task ? <TaskExtras task={task} tasks={tasks.data ?? []} /> : null}
    </div>
  );
}

function TaskForm({ task, subjects }: { task?: Task; subjects: Subject[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const me = useMe();
  const isSubtask = task !== undefined && task.parentId !== null;
  const isGroup = me.data?.workspace.kind === 'group';
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: taskFormDefaults(task),
  });

  const save = useMutation({
    mutationFn: (values: TaskFormValues) =>
      task ? updateTask(task.id, toTaskFields(values)) : createTask(toTaskInput(values)),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TASKS_KEY });
      void navigate('/');
    },
  });

  const { errors } = form.formState;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">{task ? texts.editTitle : texts.newTitle}</h1>
      <form
        noValidate
        onSubmit={form.handleSubmit((values) => save.mutate(values))}
        className="flex flex-col gap-4"
      >
        <Field
          label={texts.title}
          autoComplete="off"
          maxLength={TASK_TITLE_MAX}
          error={errors.title?.message}
          {...form.register('title')}
        />
        {isSubtask ? null : (
          <Select label={texts.subject} {...form.register('subjectId')}>
            <option value="">{texts.noSubject}</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </Select>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label={texts.type} {...form.register('type')}>
            {TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {es.tasks.types[type]}
              </option>
            ))}
          </Select>
          <Select label={texts.priority} {...form.register('priority')}>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {es.tasks.priorities[priority]}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={texts.dueDate} type="date" {...form.register('dueDate')} />
          <Field
            label={texts.dueTime}
            type="time"
            error={errors.dueTime?.message}
            {...form.register('dueTime')}
          />
        </div>
        <Field
          label={texts.estimate}
          type="number"
          inputMode="numeric"
          min={1}
          error={errors.estimateMin ? texts.invalidEstimate : undefined}
          {...form.register('estimateMin')}
        />
        <TextArea label={texts.description} {...form.register('description')} />
        {isGroup && !isSubtask ? (
          <Select label={texts.visibility} {...form.register('visibility')}>
            {TASK_VISIBILITIES.map((visibility) => (
              <option key={visibility} value={visibility}>
                {texts.visibilities[visibility]}
              </option>
            ))}
          </Select>
        ) : null}

        {save.isError ? (
          <p role="alert" className="text-sm text-danger">
            {es.tasks.actionError}
          </p>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" disabled={save.isPending} className="flex-1">
            {save.isPending ? es.common.saving : es.common.save}
          </Button>
          <Link to="/" className={buttonClasses('secondary')}>
            {es.common.cancel}
          </Link>
        </div>
      </form>
    </section>
  );
}

/** Lo que solo existe en un pendiente ya creado: mi estado, subtareas y borrar. */
function TaskExtras({ task, tasks }: { task: Task; tasks: Task[] }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const status = useTaskStatus();
  const [newSubtask, setNewSubtask] = useState('');
  const subtasks = tasks.filter((candidate) => candidate.parentId === task.id);

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: TASKS_KEY }),
      queryClient.invalidateQueries({ queryKey: TRASH_KEY }),
    ]);
  const addSubtask = useMutation({
    mutationFn: (title: string) => createTask(newTaskInput(title, { parentId: task.id })),
    onSuccess: async () => {
      setNewSubtask('');
      await invalidate();
    },
  });
  const removeSubtask = useMutation({ mutationFn: deleteTask, onSuccess: invalidate });
  const remove = useMutation({
    mutationFn: () => deleteTask(task.id),
    onSuccess: async () => {
      await invalidate();
      void navigate('/', { replace: true });
    },
  });

  const failed = status.isError || addSubtask.isError || removeSubtask.isError || remove.isError;

  return (
    <>
      <Select
        label={texts.status}
        value={task.status}
        onChange={(event) => {
          const next = taskStatusSchema.safeParse(event.target.value);
          if (next.success) status.mutate({ id: task.id, status: next.data });
        }}
      >
        {TASK_STATUSES.map((value) => (
          <option key={value} value={value}>
            {es.tasks.statuses[value]}
          </option>
        ))}
      </Select>

      {task.parentId === null ? (
        <section aria-labelledby="subtasks-title" className="flex flex-col gap-3">
          <h2 id="subtasks-title" className="text-lg font-semibold">
            {es.tasks.subtasksTitle}
          </h2>
          {subtasks.length === 0 ? (
            <p className="text-sm text-fg-muted">{es.tasks.noSubtasks}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {subtasks.map((subtask) => (
                <li
                  key={subtask.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-2 pl-3"
                >
                  <input
                    type="checkbox"
                    className="size-5 shrink-0"
                    checked={subtask.status === 'done'}
                    aria-label={subtask.title}
                    onChange={(event) =>
                      status.mutate({
                        id: subtask.id,
                        status: event.target.checked ? 'done' : 'todo',
                      })
                    }
                  />
                  <span className="min-w-0 flex-1 break-words">{subtask.title}</span>
                  <IconButton
                    label={es.tasks.removeSubtask(subtask.title)}
                    disabled={removeSubtask.isPending}
                    className="hover:text-danger"
                    onClick={() => removeSubtask.mutate(subtask.id)}
                  >
                    <Trash2 aria-hidden className="size-5" />
                  </IconButton>
                </li>
              ))}
            </ul>
          )}
          <form
            noValidate
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const title = newSubtask.trim();
              if (title) addSubtask.mutate(title);
            }}
          >
            <div className="flex-1">
              <Field
                label={es.tasks.newSubtask}
                value={newSubtask}
                maxLength={TASK_TITLE_MAX}
                autoComplete="off"
                onChange={(event) => setNewSubtask(event.target.value)}
              />
            </div>
            <Button
              type="submit"
              variant="secondary"
              disabled={addSubtask.isPending || !newSubtask.trim()}
            >
              {es.tasks.addSubtask}
            </Button>
          </form>
        </section>
      ) : null}

      {failed ? (
        <p role="alert" className="text-sm text-danger">
          {es.tasks.actionError}
        </p>
      ) : null}
      <Button
        variant="danger"
        onClick={() => remove.mutate()}
        disabled={remove.isPending}
        className="self-start"
      >
        <Trash2 aria-hidden className="size-4" />
        {texts.delete}
      </Button>
    </>
  );
}
