import { z } from 'zod';

/** Mensajes de validacion en espanol para los formularios (el locale `es` de zod suena a traduccion automatica). */
export function configureZodMessages() {
  z.config({
    customError: (issue) => {
      switch (issue.code) {
        case 'invalid_type':
          return 'Este campo es obligatorio.';
        case 'too_small':
          if (issue.origin === 'string') {
            return Number(issue.minimum) <= 1
              ? 'Este campo es obligatorio.'
              : `Debe tener al menos ${String(issue.minimum)} caracteres.`;
          }
          return undefined;
        case 'too_big':
          if (issue.origin === 'string') {
            return `Debe tener como máximo ${String(issue.maximum)} caracteres.`;
          }
          return undefined;
        case 'invalid_format':
          return issue.format === 'email' ? 'Escribe un email válido.' : 'El formato no es válido.';
        default:
          return undefined;
      }
    },
  });
}
