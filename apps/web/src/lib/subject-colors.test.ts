import { SUBJECT_COLORS } from '@organizador/shared';
import { describe, expect, it } from 'vitest';
import { contrastRatio, SUBJECT_PALETTE, subjectColorStyle } from './subject-colors';

// Superficies de las tarjetas, copiadas de index.css.
const SURFACE_LIGHT = '#ffffff';
const SURFACE_DARK = '#111a2e';

describe('contrastRatio', () => {
  it('coincide con los valores de referencia de WCAG', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });

  it('es simetrico', () => {
    expect(contrastRatio('#123456', '#fedcba')).toBeCloseTo(
      contrastRatio('#fedcba', '#123456'),
      10,
    );
  });
});

describe('paleta de asignaturas', () => {
  it('define los 12 colores del esquema compartido y ninguno mas', () => {
    expect(Object.keys(SUBJECT_PALETTE).sort()).toEqual([...SUBJECT_COLORS].sort());
    expect(SUBJECT_COLORS).toHaveLength(12);
  });

  it.each([...SUBJECT_COLORS])(
    '%s: texto de la etiqueta con contraste AA (>= 4.5) en claro y oscuro',
    (color) => {
      const { light, dark } = SUBJECT_PALETTE[color];
      expect(contrastRatio(light.fg, light.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(dark.fg, dark.bg)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it.each([...SUBJECT_COLORS])('%s: el punto de color destaca (>= 3) sobre la tarjeta', (color) => {
    const { light, dark } = SUBJECT_PALETTE[color];
    expect(contrastRatio(light.dot, SURFACE_LIGHT)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(dark.dot, SURFACE_DARK)).toBeGreaterThanOrEqual(3);
  });

  it('los colores se distinguen entre si (ningun punto repetido)', () => {
    const dots = SUBJECT_COLORS.map((c) => SUBJECT_PALETTE[c].light.dot);
    expect(new Set(dots).size).toBe(12);
  });
});

describe('subjectColorStyle', () => {
  it('expone las variables CSS de claro y oscuro', () => {
    const style = subjectColorStyle('blue') as Record<string, string>;
    expect(style['--subject-bg']).toBe(SUBJECT_PALETTE.blue.light.bg);
    expect(style['--subject-fg-dark']).toBe(SUBJECT_PALETTE.blue.dark.fg);
    expect(Object.keys(style)).toHaveLength(6);
  });
});
