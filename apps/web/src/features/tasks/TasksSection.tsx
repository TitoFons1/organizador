import {
  classifyTasks,
  subtaskProgress,
  TASK_BUCKETS,
  todayCivil,
  type CivilDate,
  type Subject,
  type Task,
  type TaskBucket,
} from '@organizador/shared';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { Button, buttonClasses } from '../../components/ui/Button';
import { Skeleton } from '../../components/ui/Skeleton';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { formatShort, formatWeekday } from '../../lib/dates';
import { useIsDesktop } from '../../lib/use-media-query';
import { useMe } from '../auth/useMe';
import { fetchSubjects, SUBJECTS_KEY } from '../subjects/api';
import { SubjectBadge } from '../subjects/SubjectBadge';
import { fetchTasks, TASKS_KEY } from './api';
import { useTaskStatus } from './useTaskStatus';

const texts = es.tasks;
const OPEN_BUCKETS = TASK_BUCKETS.filter((bucket) => bucket !== 'done');
const URGENT_BUCKETS: readonly TaskBucket[] = ['overdue', 'today', 'week'];

function dueLabel(task: Task, today: CivilDate): string | null {
  if (task.dueDate === null) return null;
  const time = task.dueTime ? ` ${texts.due.at(task.dueTime)}` : '';
  if (task.status !== 'done' && task.dueDate < today) {
    return texts.due.overdue(formatShort(task.dueDate)) + time;
  }
  if (task.dueDate === today) return texts.due.today + time;
  return texts.due.on(formatWeekday(task.dueDate)) + time;
}

interface TasksSectionProps {
  /** Solo las tareas de esta asignatura (detalle de asignatura). */
  subjectId?: string;
  /** Solo lo urgente (Atrasadas, Hoy, Esta semana), sin lo hecho: resumen de la asignatura. */
  urgentOnly?: boolean;
  title?: string;
}

/**
 * Pendientes agrupados por urgencia. En el panel de escritorio, en 4 columnas (docs/01 7.3); en
 * movil y en el detalle de una asignatura, en lista con fichas para filtrar (docs/01 7.2).
 */
export function TasksSection({
  subjectId,
  urgentOnly = false,
  title = texts.title,
}: TasksSectionProps) {
  const tasks = useQuery({ queryKey: TASKS_KEY, queryFn: fetchTasks });
  const subjects = useQuery({ queryKey: SUBJECTS_KEY, queryFn: fetchSubjects });
  const me = useMe();
  const toggle = useTaskStatus();
  const isDesktop = useIsDesktop();
  const [filter, setFilter] = useState<TaskBucket | 'all'>('all');
  const today = todayCivil();
  const columns = isDesktop && subjectId === undefined;

  const header = (
    <header className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <Link
        to={subjectId ? `/pendientes/nueva?asignatura=${subjectId}` : '/pendientes/nueva'}
        className={buttonClasses('secondary')}
      >
        <Plus aria-hidden className="size-4" />
        {subjectId ? es.subjectDetail.addTask : texts.add}
      </Link>
    </header>
  );

  if (tasks.isPending || subjects.isPending) {
    return (
      <section aria-label={title} className="flex flex-col gap-3">
        {header}
        <Skeleton lines={2} />
      </section>
    );
  }
  if (!tasks.data || !subjects.data) {
    return (
      <section aria-label={title} className="flex flex-col items-start gap-3">
        {header}
        <p role="alert">{texts.loadError}</p>
        <Button variant="secondary" onClick={() => void tasks.refetch()}>
          {es.common.retry}
        </Button>
      </section>
    );
  }

  const allTasks = tasks.data;
  const mine = subjectId ? allTasks.filter((task) => task.subjectId === subjectId) : allTasks;
  const buckets = classifyTasks(mine, today);
  const subjectById = new Map(subjects.data.map((subject) => [subject.id, subject]));
  const isGroup = me.data?.workspace.kind === 'group';
  const shown = urgentOnly ? URGENT_BUCKETS : OPEN_BUCKETS;
  const pending = shown.filter((bucket) => buckets[bucket].length > 0);

  const item = (task: Task) => (
    <TaskItem
      key={task.id}
      task={task}
      subject={task.subjectId ? subjectById.get(task.subjectId) : undefined}
      due={dueLabel(task, today)}
      overdue={task.status !== 'done' && task.dueDate !== null && task.dueDate < today}
      subtasks={subtaskProgress(allTasks, task.id)}
      showPersonal={isGroup}
      onToggle={(done) => toggle.mutate({ id: task.id, status: done ? 'done' : 'todo' })}
    />
  );
  const list = (bucket: TaskBucket) => (
    <BucketList key={bucket} bucket={bucket} count={buckets[bucket].length}>
      {buckets[bucket].map(item)}
    </BucketList>
  );

  let body: React.ReactNode;
  if (columns) {
    // Siempre las 4 columnas (aunque esten vacias) para que el panel no "salte".
    body = (
      <div className="grid grid-cols-4 gap-3">
        {(['overdue', 'today', 'week'] as const).map(list)}
        <div className="flex flex-col gap-4">
          {list('later')}
          {buckets.noDate.length > 0 ? list('noDate') : null}
        </div>
      </div>
    );
  } else if (pending.length === 0) {
    body = (
      <p className="rounded-xl border border-dashed border-border p-6 text-center text-fg-muted">
        {urgentOnly ? es.subjectDetail.noUrgent : texts.empty}
      </p>
    );
  } else {
    // Si el grupo filtrado se vacia (p. ej. al marcar su ultima tarea), se vuelve a "Todos".
    const current = filter !== 'all' && pending.includes(filter) ? filter : 'all';
    const visible = current === 'all' ? pending : [current];
    body = (
      <>
        {pending.length > 1 ? (
          <div role="group" aria-label={texts.filter} className="flex flex-wrap gap-2">
            <Chip pressed={current === 'all'} onClick={() => setFilter('all')}>
              {texts.all}
            </Chip>
            {pending.map((bucket) => (
              <Chip key={bucket} pressed={current === bucket} onClick={() => setFilter(bucket)}>
                {texts.buckets[bucket]} {buckets[bucket].length}
              </Chip>
            ))}
          </div>
        ) : null}
        {visible.map(list)}
      </>
    );
  }

  return (
    <section aria-label={title} className="flex flex-col gap-4">
      {header}
      {toggle.isError ? (
        <p role="alert" className="text-sm text-danger">
          {texts.actionError}
        </p>
      ) : null}
      {body}
      {!urgentOnly && buckets.done.length > 0 ? (
        <details className="rounded-xl border border-border bg-surface">
          <summary className="min-h-11 cursor-pointer px-4 py-3 text-sm font-medium">
            {texts.buckets.done} ({buckets.done.length})
          </summary>
          <ul className="flex flex-col gap-2 p-3 pt-0">{buckets.done.map(item)}</ul>
        </details>
      ) : null}
    </section>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'min-h-9 rounded-full border px-3 text-sm font-medium',
        pressed
          ? 'border-primary bg-primary text-primary-contrast'
          : 'border-border bg-surface hover:bg-surface-muted',
      )}
    >
      {children}
    </button>
  );
}

function BucketList({
  bucket,
  count,
  children,
}: {
  bucket: TaskBucket;
  count: number;
  children: React.ReactNode;
}) {
  const id = `tasks-${bucket}`;
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h3
        id={id}
        className={cn(
          'text-sm font-semibold',
          bucket === 'overdue' && count > 0 ? 'text-danger' : 'text-fg-muted',
        )}
      >
        {texts.buckets[bucket]} <span className="font-normal">({count})</span>
      </h3>
      {count === 0 ? (
        <p className="text-sm text-fg-muted">{texts.none}</p>
      ) : (
        <ul className="flex flex-col gap-2">{children}</ul>
      )}
    </section>
  );
}

interface TaskItemProps {
  task: Task;
  subject: Subject | undefined;
  due: string | null;
  overdue: boolean;
  subtasks: { done: number; total: number };
  showPersonal: boolean;
  onToggle: (done: boolean) => void;
}

function TaskItem({
  task,
  subject,
  due,
  overdue,
  subtasks,
  showPersonal,
  onToggle,
}: TaskItemProps) {
  const done = task.status === 'done';
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0"
        checked={done}
        onChange={(event) => onToggle(event.target.checked)}
        aria-label={task.title}
      />
      <div className="min-w-0 flex-1">
        <Link
          to={`/pendientes/${task.id}`}
          className={cn(
            'font-medium break-words hover:underline',
            done && 'text-fg-muted line-through',
          )}
        >
          {task.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
          {subject ? <SubjectBadge color={subject.color} label={subject.shortName} /> : null}
          {due ? <span className={cn(overdue && 'font-medium text-danger')}>{due}</span> : null}
          {task.priority === 'alta' && !done ? (
            <span className="font-semibold text-danger">{texts.highPriority}</span>
          ) : null}
          {subtasks.total > 0 ? <span>{texts.subtasks(subtasks.done, subtasks.total)}</span> : null}
          {showPersonal && task.visibility === 'personal' ? <span>{texts.personal}</span> : null}
        </div>
      </div>
    </li>
  );
}
