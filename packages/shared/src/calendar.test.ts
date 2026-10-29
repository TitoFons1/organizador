import { describe, expect, it } from 'vitest';
import seed from '../../../data/calendario-2026-2027.seed.json';
import programacion from '../../../data/fixtures/programacion-videotutorias-2026-27.json';
import {
  blockedDays,
  calendarWarnings,
  courseBounds,
  dominantMark,
  isBlockedDay,
  markInputSchema,
  marksOn,
  normalizeSeed,
  termInputSchema,
  type Mark,
} from './calendar';
import { eachDay, weekday } from './civil-date';

const mark = (overrides: Partial<Mark> = {}): Mark => ({
  id: 'm',
  kind: 'festivo',
  startDate: '2026-10-12',
  endDate: '2026-10-12',
  label: 'Festivo',
  blocksClasses: true,
  groups: null,
  ...overrides,
});

describe('markInputSchema / termInputSchema', () => {
  const base = {
    kind: 'vacaciones',
    startDate: '2026-12-22',
    endDate: '2027-01-06',
    label: 'Navidad',
    blocksClasses: true,
    groups: null,
  };

  it('acepta una marca valida y recorta la etiqueta', () => {
    expect(markInputSchema.parse({ ...base, label: '  Navidad ' }).label).toBe('Navidad');
  });

  it('rechaza fin anterior al inicio, fechas inexistentes y tipos desconocidos', () => {
    expect(markInputSchema.safeParse({ ...base, endDate: '2026-12-21' }).success).toBe(false);
    expect(markInputSchema.safeParse({ ...base, startDate: '2026-02-30' }).success).toBe(false);
    expect(markInputSchema.safeParse({ ...base, kind: 'fiesta' }).success).toBe(false);
    expect(markInputSchema.safeParse({ ...base, label: '  ' }).success).toBe(false);
  });

  it('un cuatrimestre puede no tener fecha de fin, pero no acabar antes de empezar', () => {
    const term = { name: '1er cuatrimestre', startDate: '2026-10-01', endDate: null };
    expect(termInputSchema.safeParse(term).success).toBe(true);
    expect(termInputSchema.safeParse({ ...term, endDate: '2026-09-30' }).success).toBe(false);
  });
});

describe('marcas por dia', () => {
  const marks = [
    mark({ kind: 'vacaciones', startDate: '2026-12-22', endDate: '2027-01-06' }),
    mark({ kind: 'festivo', startDate: '2027-01-06', endDate: '2027-01-06' }),
    mark({
      kind: 'defensa_proyecto',
      startDate: '2027-05-24',
      endDate: '2027-05-28',
      blocksClasses: false,
    }),
  ];

  it('marksOn incluye ambos extremos del rango', () => {
    expect(marksOn(marks, '2026-12-22')).toHaveLength(1);
    expect(marksOn(marks, '2027-01-06')).toHaveLength(2);
    expect(marksOn(marks, '2027-01-07')).toHaveLength(0);
  });

  it('dominantMark elige por prioridad, no por orden', () => {
    expect(dominantMark(marksOn(marks, '2027-01-06'))?.kind).toBe('vacaciones');
    expect(dominantMark([])).toBeUndefined();
  });

  it('isBlockedDay respeta blocksClasses (las defensas no bloquean)', () => {
    expect(isBlockedDay(marks, '2026-12-25')).toBe(true);
    expect(isBlockedDay(marks, '2027-05-25')).toBe(false);
    expect(isBlockedDay(marks, '2026-11-11')).toBe(false);
  });
});

describe('avisos de calendario incompleto', () => {
  const full = [
    mark({
      kind: 'inicio_curso',
      startDate: '2026-10-01',
      endDate: '2026-10-01',
      blocksClasses: false,
    }),
    mark({
      kind: 'fin_curso',
      startDate: '2027-06-18',
      endDate: '2027-06-18',
      blocksClasses: false,
    }),
  ];
  const terms = [
    { name: '1er', startDate: '2026-10-01', endDate: '2027-02-05' },
    { name: '2o', startDate: '2027-02-08', endDate: '2027-06-18' },
  ];

  it('un calendario completo no avisa de nada', () => {
    expect(calendarWarnings(terms, full)).toEqual([]);
  });

  it('avisa de que falta el fin de curso (caso del plan)', () => {
    const withoutEnd = full.filter((m) => m.kind !== 'fin_curso');
    expect(calendarWarnings(terms, withoutEnd)).toEqual([{ code: 'NO_COURSE_END' }]);
  });

  it('avisa de que falta el inicio, los cuatrimestres o la fecha final de uno', () => {
    expect(calendarWarnings([], [])).toEqual([
      { code: 'NO_COURSE_START' },
      { code: 'NO_COURSE_END' },
      { code: 'NO_TERMS' },
    ]);
    expect(calendarWarnings([{ ...terms[0]!, endDate: null }], full)).toEqual([
      { code: 'TERM_WITHOUT_END', term: '1er' },
    ]);
  });

  it('avisa si el fin de curso es anterior al inicio y si dos cuatrimestres se solapan', () => {
    const reversed = [
      mark({ kind: 'inicio_curso', startDate: '2027-06-18', endDate: '2027-06-18' }),
      mark({ kind: 'fin_curso', startDate: '2026-10-01', endDate: '2026-10-01' }),
    ];
    expect(calendarWarnings(terms, reversed)).toContainEqual({ code: 'COURSE_ENDS_BEFORE_START' });

    const overlapping = [terms[0]!, { name: '2o', startDate: '2027-02-05', endDate: '2027-06-18' }];
    expect(calendarWarnings(overlapping, full)).toEqual([
      { code: 'TERMS_OVERLAP', terms: ['1er', '2o'] },
    ]);
  });

  it('courseBounds toma el inicio mas temprano y el fin mas tardio', () => {
    expect(courseBounds(full)).toEqual({ start: '2026-10-01', end: '2027-06-18' });
    expect(courseBounds([])).toEqual({ start: null, end: null });
  });
});

describe('seed del curso 2026-27', () => {
  const { terms, marks } = normalizeSeed(seed);

  it('se importa entero y valido', () => {
    expect(terms).toHaveLength(2);
    expect(marks).toHaveLength(seed.marks.length);
  });

  it('convierte "festivo_zaragoza" en "festivo_local" y conserva las etiquetas', () => {
    const local = marks.filter((m) => m.kind === 'festivo_local');
    expect(local.map((m) => m.label)).toEqual([
      'Festivo Zaragoza',
      'Festivo Zaragoza (San Valero)',
      'Festivo Zaragoza (Cincomarzada)',
    ]);
    expect(marks.some((m) => (m.kind as string) === 'festivo_zaragoza')).toBe(false);
  });

  it('coincide con la leyenda del Excel: cuantas marcas de cada tipo', () => {
    const count = (kind: string) => marks.filter((m) => m.kind === kind).length;
    expect(count('inicio_curso')).toBe(1);
    expect(count('fin_curso')).toBe(1);
    expect(count('festivo')).toBe(5);
    expect(count('festivo_local')).toBe(3);
    expect(count('vacaciones')).toBe(2);
    expect(count('examenes')).toBe(4);
    expect(count('defensa_proyecto')).toBe(2);
  });

  it('no genera ningun aviso', () => {
    const withIds = marks.map((m, index) => ({ ...m, id: String(index) }));
    expect(calendarWarnings(terms, withIds)).toEqual([]);
    expect(courseBounds(withIds)).toEqual({ start: '2026-10-01', end: '2027-06-18' });
  });

  it('bloquea 57 dias: 37 de festivos y vacaciones + 20 de examenes; las defensas no', () => {
    const withIds = marks.map((m, index) => ({ ...m, id: String(index) }));
    expect(blockedDays(withIds).size).toBe(57);
  });

  it('PRUEBA DE FUEGO: los martes lectivos son exactamente los 27 del PDF de Programacion', () => {
    const withIds = marks.map((m, index) => ({ ...m, id: String(index) }));
    const { start, end } = courseBounds(withIds);
    const blocked = blockedDays(withIds);

    const tuesdays = eachDay(start!, end!).filter((day) => weekday(day) === 2 && !blocked.has(day));

    expect(tuesdays).toHaveLength(27);
    expect(tuesdays).toEqual(programacion.dates);
  });
});
