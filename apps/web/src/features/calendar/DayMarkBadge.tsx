import type { Mark } from '@organizador/shared';
import { cn } from '../../lib/cn';
import { KIND_SYMBOL, kindStyle } from './kind-style';

/** Etiqueta de la marca del calendario de un dia (festivo, examenes...), con su color y simbolo. */
export function DayMarkBadge({ mark, className }: { mark: Mark; className?: string }) {
  const style = kindStyle(mark.kind);
  return (
    <span
      className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', style.className, className)}
      style={style.style}
    >
      <span aria-hidden>{KIND_SYMBOL[mark.kind]} </span>
      {mark.label}
    </span>
  );
}
