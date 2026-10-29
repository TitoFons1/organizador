/**
 * Error con codigo HTTP: Fastify lo serializa como `{ statusCode, code?, error, message }`.
 * `code` es un identificador estable que el cliente puede traducir o usar para decidir.
 */
export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
