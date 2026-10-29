import type { SubjectColor } from '@organizador/shared';
import type { CSSProperties } from 'react';

interface Shade {
  /** Fondo de la etiqueta. */
  bg: string;
  /** Texto sobre ese fondo (contraste AA >= 4.5). */
  fg: string;
  /** Punto de color sobre la superficie de la tarjeta (contraste >= 3, elemento grafico). */
  dot: string;
}

interface SubjectPalette {
  label: string;
  light: Shade;
  dark: Shade;
}

/**
 * Paleta de 12 colores (tonos de Tailwind). `subject-colors.test.ts` comprueba los contrastes
 * en claro y oscuro: si cambias un valor, ese test te dice si sigue siendo accesible.
 */
export const SUBJECT_PALETTE: Record<SubjectColor, SubjectPalette> = {
  red: {
    label: 'Rojo',
    light: { bg: '#fee2e2', fg: '#991b1b', dot: '#dc2626' },
    dark: { bg: '#450a0a', fg: '#fecaca', dot: '#f87171' },
  },
  orange: {
    label: 'Naranja',
    light: { bg: '#ffedd5', fg: '#9a3412', dot: '#ea580c' },
    dark: { bg: '#431407', fg: '#fed7aa', dot: '#fb923c' },
  },
  amber: {
    label: 'Ámbar',
    light: { bg: '#fef3c7', fg: '#92400e', dot: '#d97706' },
    dark: { bg: '#451a03', fg: '#fde68a', dot: '#fbbf24' },
  },
  lime: {
    label: 'Lima',
    light: { bg: '#ecfccb', fg: '#3f6212', dot: '#65a30d' },
    dark: { bg: '#1a2e05', fg: '#d9f99d', dot: '#a3e635' },
  },
  green: {
    label: 'Verde',
    light: { bg: '#dcfce7', fg: '#166534', dot: '#16a34a' },
    dark: { bg: '#052e16', fg: '#bbf7d0', dot: '#4ade80' },
  },
  teal: {
    label: 'Turquesa',
    light: { bg: '#ccfbf1', fg: '#115e59', dot: '#0d9488' },
    dark: { bg: '#042f2e', fg: '#99f6e4', dot: '#2dd4bf' },
  },
  cyan: {
    label: 'Cian',
    light: { bg: '#cffafe', fg: '#155e75', dot: '#0891b2' },
    dark: { bg: '#083344', fg: '#a5f3fc', dot: '#22d3ee' },
  },
  blue: {
    label: 'Azul',
    light: { bg: '#dbeafe', fg: '#1e40af', dot: '#2563eb' },
    dark: { bg: '#172554', fg: '#bfdbfe', dot: '#60a5fa' },
  },
  indigo: {
    label: 'Índigo',
    light: { bg: '#e0e7ff', fg: '#3730a3', dot: '#4f46e5' },
    dark: { bg: '#1e1b4b', fg: '#c7d2fe', dot: '#818cf8' },
  },
  violet: {
    label: 'Violeta',
    light: { bg: '#ede9fe', fg: '#5b21b6', dot: '#7c3aed' },
    dark: { bg: '#2e1065', fg: '#ddd6fe', dot: '#a78bfa' },
  },
  fuchsia: {
    label: 'Fucsia',
    light: { bg: '#fae8ff', fg: '#86198f', dot: '#c026d3' },
    dark: { bg: '#4a044e', fg: '#f5d0fe', dot: '#e879f9' },
  },
  pink: {
    label: 'Rosa',
    light: { bg: '#fce7f3', fg: '#9d174d', dot: '#db2777' },
    dark: { bg: '#500724', fg: '#fbcfe8', dot: '#f472b6' },
  },
};

/**
 * Variables CSS con los tonos de claro y oscuro; `index.css` elige cuales usar segun
 * `prefers-color-scheme`. Asi el color no depende de JavaScript para cambiar de tema.
 */
export function subjectColorStyle(color: SubjectColor): CSSProperties {
  const { light, dark } = SUBJECT_PALETTE[color];
  return {
    '--subject-bg': light.bg,
    '--subject-fg': light.fg,
    '--subject-dot': light.dot,
    '--subject-bg-dark': dark.bg,
    '--subject-fg-dark': dark.fg,
    '--subject-dot-dark': dark.dot,
  } as CSSProperties;
}

function channel(value: number) {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

/** Ratio de contraste WCAG 2.x entre dos colores `#rrggbb`. */
export function contrastRatio(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
