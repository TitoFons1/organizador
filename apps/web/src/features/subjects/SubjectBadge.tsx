import type { SubjectColor } from '@organizador/shared';
import { cn } from '../../lib/cn';
import { subjectColorStyle } from '../../lib/subject-colors';

interface SubjectBadgeProps {
  color: SubjectColor;
  label: string;
  className?: string;
}

/** Etiqueta de asignatura: punto de color + abreviatura. Accesible en claro y oscuro. */
export function SubjectBadge({ color, label, className }: SubjectBadgeProps) {
  return (
    <span
      className={cn(
        'subject-chip inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        className,
      )}
      style={subjectColorStyle(color)}
    >
      <span aria-hidden className="subject-dot size-2 shrink-0 rounded-full" />
      {label}
    </span>
  );
}
