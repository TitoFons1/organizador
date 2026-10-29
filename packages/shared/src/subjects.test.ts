import { describe, expect, it } from 'vitest';
import {
  EMPTY_SUBJECT_LINKS,
  httpUrlSchema,
  subjectInputSchema,
  subjectPatchSchema,
  SUBJECT_COLORS,
} from './subjects';

const valid = {
  name: 'Programación',
  shortName: 'PRO',
  color: 'blue',
  teacher: 'Marta',
  links: EMPTY_SUBJECT_LINKS,
};

describe('httpUrlSchema', () => {
  it.each(['https://aula.example.com/curso/1', 'http://localhost:3000/x'])('acepta %s', (url) => {
    expect(httpUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each(['javascript:alert(1)', 'data:text/html,hola', 'ftp://example.com', 'no es una url', ''])(
    'rechaza %s',
    (url) => {
      expect(httpUrlSchema.safeParse(url).success).toBe(false);
    },
  );
});

describe('subjectInputSchema', () => {
  it('acepta una asignatura valida y recorta espacios', () => {
    const parsed = subjectInputSchema.parse({ ...valid, name: '  Programación ' });
    expect(parsed.name).toBe('Programación');
  });

  it('acepta todos los colores de la paleta y solo esos', () => {
    for (const color of SUBJECT_COLORS) {
      expect(subjectInputSchema.safeParse({ ...valid, color }).success).toBe(true);
    }
    expect(subjectInputSchema.safeParse({ ...valid, color: 'negro' }).success).toBe(false);
  });

  it('exige nombre y limita su longitud', () => {
    expect(subjectInputSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
    expect(subjectInputSchema.safeParse({ ...valid, name: 'x'.repeat(81) }).success).toBe(false);
  });

  it('permite profesor y abreviatura nulos', () => {
    expect(subjectInputSchema.safeParse({ ...valid, teacher: null, shortName: null }).success).toBe(
      true,
    );
  });

  it('rechaza enlaces con protocolo peligroso', () => {
    const links = { ...EMPTY_SUBJECT_LINKS, classroom: 'javascript:alert(1)' };
    expect(subjectInputSchema.safeParse({ ...valid, links }).success).toBe(false);
  });
});

describe('subjectPatchSchema', () => {
  it('admite un subconjunto de campos', () => {
    expect(subjectPatchSchema.parse({ color: 'red' })).toEqual({ color: 'red' });
    expect(subjectPatchSchema.parse({})).toEqual({});
  });

  it('sigue validando los campos que llegan', () => {
    expect(subjectPatchSchema.safeParse({ name: '' }).success).toBe(false);
  });
});
