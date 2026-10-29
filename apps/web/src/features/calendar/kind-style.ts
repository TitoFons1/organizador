import type { MarkKind, SubjectColor } from '@organizador/shared';
import type { CSSProperties } from 'react';
import { subjectColorStyle } from '../../lib/subject-colors';

/**
 * Color de cada tipo de marca. Reutiliza la paleta accesible de las asignaturas (mismos
 * contrastes comprobados en `subject-colors.test.ts`). Los grises usan los tokens neutros.
 */
const KIND_COLOR: Record<MarkKind, SubjectColor | 'neutral'> = {
  inicio_curso: 'violet',
  fin_curso: 'violet',
  festivo: 'blue',
  festivo_local: 'red',
  vacaciones: 'cyan',
  examenes: 'green',
  defensa_proyecto: 'neutral',
};

export function kindStyle(kind: MarkKind): { className: string; style?: CSSProperties } {
  const color = KIND_COLOR[kind];
  if (color === 'neutral') return { className: 'bg-surface-muted text-fg' };
  return { className: 'subject-chip', style: subjectColorStyle(color) };
}

/** Forma extra que acompana al color: asi la leyenda no depende solo del tono. */
export const KIND_SYMBOL: Record<MarkKind, string> = {
  inicio_curso: '▶',
  fin_curso: '■',
  festivo: '●',
  festivo_local: '◆',
  vacaciones: '≈',
  examenes: '✎',
  defensa_proyecto: '◇',
};
