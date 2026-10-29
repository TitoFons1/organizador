import type { FastifyInstance } from 'fastify';
import { HttpError } from '../http-error';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Rechaza las peticiones que cambian estado y llegan desde otro origen. Complementa a
 * `SameSite=Lax`, y es necesaria porque Better Auth solo valida `Origin` cuando la peticion
 * trae cookies (un registro o login sin cookie desde otro sitio pasaria). Cubre tambien las
 * rutas propias que se vayan anadiendo.
 *
 * Los navegadores siempre envian `Origin` en estas peticiones; si falta, el cliente no es un
 * navegador (curl, tests) y no hay cookies ajenas que abusar, asi que se deja pasar.
 */
export function registerOriginCheck(app: FastifyInstance, appUrl: string) {
  const allowedOrigin = new URL(appUrl).origin;

  app.addHook('onRequest', async (request) => {
    if (!STATE_CHANGING_METHODS.has(request.method)) return;
    const origin = request.headers.origin;
    if (origin !== undefined && origin !== allowedOrigin) {
      throw new HttpError(403, 'Origen no permitido.');
    }
  });
}
