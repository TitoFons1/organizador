import { z } from 'zod';

// Solo para desarrollo y tests: en produccion BETTER_AUTH_SECRET es obligatorio.
const DEV_AUTH_SECRET = 'solo-desarrollo-no-usar-en-produccion-0123456789';

// z.coerce.boolean() convertiria el texto "false" en true, asi que se parsea a mano. Vacia o sin
// definir queda `undefined` para que cada variable decida su valor por defecto.
const booleanFlag = z
  .enum(['true', 'false', ''])
  .optional()
  .transform((value) => (value ? value === 'true' : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    HOST: z.string().default('127.0.0.1'),
    DATABASE_URL: z.string().default('file:./data/dev.db'),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    // Origen publico de la web (el que ve el navegador). Better Auth lo usa para validar `Origin`.
    APP_URL: z.url().default('http://localhost:5173'),
    // Una variable vacia (`BETTER_AUTH_SECRET=`) cuenta como no definida.
    BETTER_AUTH_SECRET: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    ALLOW_SIGNUP: booleanFlag,
  })
  .superRefine((env, ctx) => {
    if (env.BETTER_AUTH_SECRET !== undefined && env.BETTER_AUTH_SECRET.length < 32) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message: 'Debe tener al menos 32 caracteres',
      });
    }
    if (env.NODE_ENV === 'production' && env.BETTER_AUTH_SECRET === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['BETTER_AUTH_SECRET'],
        message: 'Es obligatorio en produccion',
      });
    }
  })
  .transform((env) => ({
    ...env,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET ?? DEV_AUTH_SECRET,
    // D7: sin valor explicito, el registro queda abierto en desarrollo y cerrado en produccion.
    ALLOW_SIGNUP: env.ALLOW_SIGNUP ?? env.NODE_ENV !== 'production',
  }));

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Variables de entorno invalidas:\n${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}
