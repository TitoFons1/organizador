import { type CivilDate, type Mark } from '@organizador/shared';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button, IconButton } from '../../components/ui/Button';
import { es } from '../../i18n/es';
import { cn } from '../../lib/cn';
import { formatFull, formatRange } from '../../lib/dates';
import { KIND_SYMBOL, kindStyle } from './kind-style';

interface DayPanelProps {
  date: CivilDate;
  marks: readonly Mark[];
  disabled: boolean;
  onAdd: () => void;
  onEdit: (mark: Mark) => void;
  onDelete: (mark: Mark) => void;
  onClose: () => void;
}

/** Lo que hay marcado en un dia, con acciones para editarlo, borrarlo o anadir otra marca. */
export function DayPanel({
  date,
  marks,
  disabled,
  onAdd,
  onEdit,
  onDelete,
  onClose,
}: DayPanelProps) {
  const title = es.calendar.dayMarks(formatFull(date));

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <h2 className="pt-2 text-base font-semibold">{title}</h2>
        <IconButton label={es.common.close} onClick={onClose}>
          <X aria-hidden className="size-5" />
        </IconButton>
      </header>

      {marks.length === 0 ? (
        <p className="text-fg-muted">{es.calendar.noMarks}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {marks.map((mark) => {
            const style = kindStyle(mark.kind);
            return (
              <li key={mark.id} className="flex items-start gap-3 border-t border-border pt-3">
                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
                      style.className,
                    )}
                    style={style.style}
                  >
                    <span aria-hidden>{KIND_SYMBOL[mark.kind]}</span>
                    {es.calendar.kinds[mark.kind]}
                  </span>
                  <p className="mt-1 font-medium break-words">{mark.label}</p>
                  <p className="text-sm text-fg-muted">
                    {formatRange(mark.startDate, mark.endDate)}
                    {mark.blocksClasses ? ` · ${es.calendar.blocks}` : ''}
                  </p>
                  {mark.groups && mark.groups.length > 0 ? (
                    <p className="text-sm text-fg-muted">
                      {es.calendar.groups(mark.groups.join(', '))}
                    </p>
                  ) : null}
                </div>
                <IconButton
                  label={es.calendar.editMark(mark.label)}
                  disabled={disabled}
                  onClick={() => onEdit(mark)}
                >
                  <Pencil aria-hidden className="size-5" />
                </IconButton>
                <IconButton
                  label={es.calendar.deleteMark(mark.label)}
                  disabled={disabled}
                  className="hover:text-danger"
                  onClick={() => onDelete(mark)}
                >
                  <Trash2 aria-hidden className="size-5" />
                </IconButton>
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="secondary" onClick={onAdd} className="self-start">
        <Plus aria-hidden className="size-4" />
        {es.calendar.addMark}
      </Button>
    </section>
  );
}
