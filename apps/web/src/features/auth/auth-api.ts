import {
  meResponseSchema,
  type LoginForm,
  type MeResponse,
  type RegisterForm,
} from '@organizador/shared';
import { z } from 'zod';
import { es } from '../../i18n/es';
import { ApiError, apiGet, apiPost } from '../../lib/api';

const AUTH = '/api/v1/auth';

// Better Auth devuelve el usuario y el token; la web solo necesita saber que fue bien (la
// identidad real se lee de `/me` con la cookie httpOnly).
const ignored = z.unknown();

export const signUp = (form: RegisterForm) => apiPost(`${AUTH}/sign-up/email`, form, ignored);
export const signIn = (form: LoginForm) => apiPost(`${AUTH}/sign-in/email`, form, ignored);
export const signOut = () => apiPost(`${AUTH}/sign-out`, {}, ignored);

/** Quien soy. Sin sesion (401) devuelve `null`: no estar identificado es un estado normal. */
export async function fetchMe(): Promise<MeResponse | null> {
  try {
    return await apiGet('/api/v1/me', meResponseSchema);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** Traduce un error del servidor a un texto para la persona usuaria. */
export function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429) return es.auth.errors.tooManyRequests;
    if (error.code && error.code in es.auth.errors) {
      return es.auth.errors[error.code as keyof typeof es.auth.errors];
    }
    return es.auth.errors.generic;
  }
  return es.common.serverError;
}
