# Organizador DAM

Panel mobile-first para organizar asignaturas, horarios, videotutorías y pendientes, con grupo opcional.

- Análisis y diseño: [`docs/01-analisis-y-diseno.md`](docs/01-analisis-y-diseno.md)
- Plan de implementación: [`docs/02-plan-de-implementacion.md`](docs/02-plan-de-implementacion.md)
- Calendario del curso 2026-27 y fixtures: [`data/`](data)

## Requisitos

- Node.js ≥ 22 (se usa la 24, ver `.nvmrc`) y npm. No hace falta Docker ni PostgreSQL: en local la
  base de datos es un archivo SQLite.

## Empezar

```bash
npm install
npm run dev        # API en http://127.0.0.1:3000 · web en http://localhost:5173
```

La web hace proxy de `/api` hacia la API, así que basta con abrir `http://localhost:5173` (con
`localhost`, no con `127.0.0.1`: la API solo acepta peticiones cuyo `Origin` sea `APP_URL`).

Las migraciones de la base de datos se aplican solas al arrancar la API. Para crear una nueva tras
cambiar `apps/api/src/db/schema.ts`: `npm run db:generate -w @organizador/api` (y revisa el SQL).

## Scripts

| Comando             | Qué hace                                            |
| ------------------- | --------------------------------------------------- |
| `npm run dev`       | API + web en modo desarrollo                        |
| `npm test`          | Todos los tests (Vitest)                            |
| `npm run typecheck` | Comprobación de tipos de todos los paquetes         |
| `npm run lint`      | ESLint                                              |
| `npm run format`    | Prettier                                            |
| `npm run check`     | Formato + lint + tipos + tests (lo mismo que el CI) |
| `npm run build`     | Build de producción (web y API)                     |

## Estructura

```
apps/api         Fastify + Drizzle (SQLite/libSQL)
apps/web         React + Vite + Tailwind
packages/shared  Esquemas zod y (en M4) el motor de horario
data/            Calendario del curso y fixtures de pruebas
docs/            Análisis, diseño y plan
```

## Configuración

Copia `.env.example` a `apps/api/.env` si quieres cambiar el puerto, la base de datos o el registro.
En **producción** `BETTER_AUTH_SECRET` es obligatorio (32+ caracteres; el comando para generarlo
está en `.env.example`) y conviene poner `ALLOW_SIGNUP=false` cuando ya estén creadas las cuentas.
