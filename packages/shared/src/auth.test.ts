import { describe, expect, it } from 'vitest';
import { loginFormSchema, PASSWORD_MIN_LENGTH, registerFormSchema } from './auth';

describe('registerFormSchema', () => {
  const valid = {
    name: 'Ana',
    email: 'ana@example.com',
    password: 'a'.repeat(PASSWORD_MIN_LENGTH),
  };

  it('acepta un registro valido', () => {
    expect(registerFormSchema.safeParse(valid).success).toBe(true);
  });

  it('recorta espacios del nombre y rechaza un nombre vacio', () => {
    expect(registerFormSchema.parse({ ...valid, name: '  Ana  ' }).name).toBe('Ana');
    expect(registerFormSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
  });

  it('rechaza un email mal formado', () => {
    expect(registerFormSchema.safeParse({ ...valid, email: 'ana@' }).success).toBe(false);
  });

  it('rechaza una contrasena demasiado corta', () => {
    const short = 'a'.repeat(PASSWORD_MIN_LENGTH - 1);
    expect(registerFormSchema.safeParse({ ...valid, password: short }).success).toBe(false);
  });
});

describe('loginFormSchema', () => {
  it('no exige la longitud minima al entrar (cuentas antiguas)', () => {
    expect(loginFormSchema.safeParse({ email: 'ana@example.com', password: 'x' }).success).toBe(
      true,
    );
  });

  it('rechaza una contrasena vacia', () => {
    expect(loginFormSchema.safeParse({ email: 'ana@example.com', password: '' }).success).toBe(
      false,
    );
  });
});
