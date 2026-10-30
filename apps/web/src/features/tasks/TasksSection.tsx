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
import { Link } from 'react-router';
import { Button, buttonClasses } from '../../components/ui/Button';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { formatShort, formatWeekday } from '../../lib/dates';
import { useMe } from '../auth/useMe';
import { fetchSubjects, SUBJECTS_KEY } from '../subjects/api';
import { SubjectBadge } from '../subjects/SubjectBadge';
import { fetchTasks, TASKS_KEY } from './api';
import { useTaskStatus } from './useTaskStatus';

const texts = es.tasks;
const OPEN_BUCKETS = TASK_BUCKETS.filter((bucket) => bucket !== 'done');

function dueLabel(task: Task, today: CivilDate): string | null {
  if (task.dueDate === null) return null;
  const time = task.dueTime ? ` ${texts.due.at(task.dueTime)}` : '';
  if (task.status !== 'done' && task.dueDate < today) {
    return texts.due.overdue(formatShort(task.dueDate)) + time;
  }
  if (task.dueDate === today) return texts.due.today + time;
  return texts.due.on(formatWeekday(task.dueDate)) + time;
}

/** Pendientes del espacio agrupados por urgencia (lo hecho, plegado al final). */
export function TasksSection() {
  const tasks = useQuery({ queryKey: TASKS_KEY, queryFn: fetchTasks });
  const subjects = useQuery({ queryKey: SUBJECTS_KEY, queryFn: fetchSubjects });
  const me = useMe();
  const toggle = useTaskStatus();
  const today = todayCivil();

  const header = (
    <header className="flex items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">{texts.title}</h2>
      <Link to="/pendientes/nueva" className={buttonClasses('secondary')}>
        <Plus aria-hidden className="size-4" />
        {texts.add}
      </Link>
    </header>
  );

  if (tasks.isPending || subjects.isPending) {
    return (
      <section aria-label={texts.title} className="flex flex-col gap-3">
        {header}
        <p className="text-fg-muted">{es.common.loading}</p>
      </section>
    );
  }
  if (!tasks.data || !subjects.data) {
    return (
      <section aria-label={texts.title} className="flex flex-col items-start gap-3">
        {header}
        <p role="alert">{texts.loadError}</p>
        <Button variant="secondary" onClick={() => void tasks.refetch()}>
          {es.common.retry}
        </Button>
      </section>
    );
  }

  const buckets = classifyTasks(tasks.data, today);
  const subjectById = new Map(subjects.data.map((subject) => [subject.id, subject]));
  const isGroup = me.data?.workspace.kind === 'group';
  const pending = OPEN_BUCKETS.filter((bucket) => buckets[bucket].length > 0);

  const item = (task: Task) => (
    <TaskItem
      key={task.id}
      task={task}
      subject={task.subjectId ? subjectById.get(task.subjectId) : undefined}
      due={dueLabel(task, today)}
      overdue={task.status !== 'done' && task.dueDate !== null && task.dueDate < today}
      subtasks={subtaskProgress(tasks.data, task.id)}
      showPersonal={isGroup}
      onToggle={(done) => toggle.mutate({ id: task.id, status: done ? 'done' : 'todo' })}
    />
  );

  return (
    <section aria-label={texts.title} className="flex flex-col gap-4">
      {header}
      {toggle.isError ? (
        <p role="alert" className="text-sm text-danger">
          {texts.actionError}
        </p>
      ) : null}
      {pending.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-6 text-center text-fg-muted">
          {texts.empty}
        </p>
      ) : null}
      {pending.map((bucket) => (
        <BucketList key={bucket} bucket={bucket} count={buckets[bucket].length}>
          {buckets[bucket].map(item)}
        </BucketList>
      ))}
      {buckets.done.length > 0 ? (
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
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3
        id={id}
        className={cn(
          'text-sm font-semibold',
          bucket === 'overdue' ? 'text-danger' : 'text-fg-muted',
        )}
      >
        {texts.buckets[bucket]} <span className="font-normal">({count})</span>
      </h3>
      <ul className="flex flex-col gap-2">{children}</ul>
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
