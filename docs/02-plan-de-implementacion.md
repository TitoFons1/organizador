# 02 · Plan de implementación — Organizador DAM

> Complementa a `01-analisis-y-diseno.md`. Estado: M0–M3 hechos; el siguiente es M4.
> Tamaños orientativos en **sesiones** (≈ 2–3 h de trabajo conjunto). No son una promesa: sirven para ordenar.

## 1. Alcance del MVP (congelado)

Entra: R1–R12 de `01-analisis-y-diseno.md` (asignaturas, horario con frecuencia y cancelaciones, calendario del curso 2026-27, tutorías, pendientes, panel mobile-first, detalle, cuentas, grupo con código, notas de grupo/personales, PWA básica).

**Regla**: cualquier idea nueva durante el MVP va al backlog de la Fase 3 salvo que bloquee un requisito.

## 2. Stack

| Capa | Elección | Por qué |
|---|---|---|
| Monorepo | **npm workspaces** (`apps/web`, `apps/api`, `packages/shared`) | Tipos y lógica de horario compartidos; sin instalar nada extra (pnpm no está en el equipo) |
| Frontend | **React 19 + Vite + TypeScript**, React Router | Estándar, rápido |
| UI | **Tailwind CSS** + componentes propios (`components/ui`) | Accesible, mobile-first, tema claro/oscuro. Se descartó shadcn/ui: con pocos componentes no compensaba |
| Datos en cliente | **TanStack Query** (+ persistencia en IndexedDB) | Caché, refresco al volver a la app, lectura sin conexión |
| Formularios | **react-hook-form + zod** | Mismo esquema que el servidor |
| Fechas | **date-fns** (fechas "civiles" como texto `YYYY-MM-DD`) | Evita bugs de zona horaria / cambio de hora |
| Notas | `react-markdown` + textarea (MVP) → **Tiptap + Yjs** (Fase 3) | Tiptap tiene colaboración en tiempo real con Yjs: [guía](https://tiptap.dev/tutorials/get-started-with-tiptap-collab) |
| PWA | **vite-plugin-pwa** (Workbox) | Instalable + caché |
| Backend | **Fastify 5 + TypeScript** + `fastify-type-provider-zod` | Ligero, validación por esquema |
| BD | **SQLite (libSQL) + Drizzle ORM** · producción: **Turso** (plan gratuito) | Mismo dialecto en local y en producción, un archivo en local, **sin Docker ni servidor**. Drizzle escribe SQL casi directo y es tipado |
| Auth | **Better Auth** (email + contraseña, sesión por cookie `httpOnly`) | Evita escribir autenticación a mano |
| Tests | **Vitest** (unidad + API) · **Playwright** (e2e, viewport móvil) | |
| Calidad | ESLint + Prettier + `tsc --noEmit` + GitHub Actions | |
| Despliegue | **Un solo servicio Node** que sirve la API y el `dist` de la web · BD en Turso | Mismo origen = cookies y CORS sin dolor |

**Cambio respecto a la v1 del plan** (Postgres + Prisma + pnpm): en tu equipo no hay Docker, Postgres ni pnpm, y el presupuesto es 0. SQLite + Drizzle funciona hoy sin instalar nada. Si algún día pagas un servidor con disco persistente, el mismo código sirve con un archivo SQLite local; y si quisieras Postgres, el cambio se limita a la capa `apps/api/src/db`.

## 3. Arquitectura y decisiones clave

```
 Móvil / PC ──HTTPS──► Fastify (API REST /api/v1 + estático de la web)
   │  PWA + caché                  │  zod · auth · autorización por workspace
   │  motor de horario (shared)    ▼
   └── TanStack Query         Drizzle ──► SQLite / Turso
```

| # | Decisión | Motivo |
|---|---|---|
| D1 | **Todo cuelga de `workspaceId`** y toda ruta pasa por un helper `requireWorkspaceAccess` | El grupo no obliga a reescribir; evita fugas de datos entre usuarios |
| D2 | **El motor de horario vive en `packages/shared`** y es una función pura `expand(range, data) → Occurrence[]` | Se testea a fondo y corre en cliente y servidor |
| D3 | **El servidor envía los datos "en bruto"** (asignaturas, franjas, excepciones, marcas) y el cliente calcula las semanas | Son pocos KB; navegar entre semanas es instantáneo y funciona offline |
| D4 | **Fechas civiles** (`"2026-10-13"`, `"16:00"`) en vez de timestamps | Cero problemas con el cambio de hora |
| D5 | **Borrado lógico** (`deletedAt`) + papelera 30 días | Seguridad en grupo; permite *Deshacer* |
| D6 | **Control optimista de versión en notas** (`baseVersion` → 409 si cambió) + `NoteRevision` | Sin tiempo real al principio, pero sin perder texto |
| D7 | **Registro cerrable** (`ALLOW_SIGNUP=false` tras crear las cuentas) | La app estará en internet; solo debe entrar quien tú quieras |
| D8 | **Sin push ni WebSockets en el MVP**; refresco por foco/intervalo | Menos piezas; push y tiempo real son Fase 3 |

## 4. Estructura del repositorio

```
organizador-dam/
├─ apps/
│  ├─ api/            Fastify · src/{modules/{auth,workspaces,subjects,schedule,calendar,tasks,notes}, plugins}
│  └─ web/            React · src/{routes,features,components,lib,i18n}
├─ packages/
│  └─ shared/         zod schemas · tipos · schedule-engine · fechas · tests
│                      (api/drizzle = migraciones · api/src/db = esquema, cliente y seed)
├─ data/              calendario-2026-2027.seed.json · fixtures/ (casos dorados de tests)
├─ docs/
└─ .github/workflows/ci.yml
```

## 5. API (borrador, `/api/v1`)

| Área | Endpoints |
|---|---|
| Auth | Better Auth bajo `/auth/*`: `POST /auth/sign-up/email` · `/auth/sign-in/email` · `/auth/sign-out` · `GET /auth/get-session`; propio: `GET /me` |
| Workspace/grupo | `POST /groups` · `POST /groups/join {code}` · `POST /groups/leave` · `POST /groups/code/regenerate` · `DELETE /groups/members/:id` · `GET /workspace` (datos en bruto del espacio activo) |
| Asignaturas | `GET/POST /subjects` · `PATCH /subjects/:id` · `POST /subjects/:id/archive` · `DELETE /subjects/:id` (con `confirmName`) · `POST /subjects/:id/restore` |
| Horario | `POST/PATCH/DELETE /slots` · `POST /slots/:id/exceptions` · `DELETE /exceptions/:id` · `PUT /session-records/:slotId/:date` |
| Calendario | `GET/POST/PATCH/DELETE /marks` · `POST /marks/import` (seed JSON) |
| Tareas | `GET/POST/PATCH/DELETE /tasks` · `PUT /tasks/:id/progress` |
| Notas | `GET/POST /notes` · `PUT /notes/:id {baseVersion}` · `GET /notes/:id/revisions` · `DELETE /notes/:id` |
| Papelera | `GET /trash` · `POST /trash/:entity/:id/restore` |

**Eliminar asignatura con doble confirmación** también en el servidor: el cliente primero pide `GET /subjects/:id/impact` (tareas, notas, tutorías afectadas) y luego `DELETE` exige `confirmName` igual al nombre. Así un clic accidental o un script no pueden borrarla.

## 6. Hitos del MVP

Cada hito termina con la app **ejecutándose y probada**, y una demo corta.

### M0 · Fundaciones — *1–2 sesiones* ✅ hecho
- `git init`, npm workspaces, TS estricto, ESLint/Prettier, Vitest, CI (formato + lint + typecheck + test + build).
- SQLite (libSQL) + Drizzle conectado; `.env.example`.
- Fastify con `/api/v1/health`; Vite con Tailwind; layout vacío con barra inferior (móvil) / lateral (PC); tokens de color claro/oscuro.
- Componentes de UI propios en `apps/web/src/components/ui` (Button, Field, Select) en lugar de shadcn/ui.
- **Hecho cuando**: `npm run dev` levanta web + API + BD, el panel muestra "Conectado" y `npm run check` pasa en verde.

### M1 · Cuentas y espacios — *2 sesiones* ✅ hecho
- Registro / login / logout con Better Auth; cookie `httpOnly`, `SameSite=Lax`.
- Al registrarse: `Workspace(personal)` + `Membership(owner)` + `UserSettings`.
- Helper `requireWorkspaceAccess`; rate limit en auth; `ALLOW_SIGNUP`.
- Además (hallazgo de seguridad): comprobación global de `Origin` en peticiones que cambian estado, porque Better Auth solo la aplica cuando la petición trae cookies.
- **Hecho cuando**: dos usuarios de prueba no ven nada del otro (test automático de acceso cruzado).

### M2 · Asignaturas — *2 sesiones* ✅ hecho
- CRUD, color de paleta, profesor, enlaces (aula virtual, NotebookLM, repo), reordenar.
- **Eliminar con doble confirmación** (impacto → escribir nombre) y **Archivar**. Papelera.
- **Hecho cuando**: puedo crear 6 asignaturas, archivar una, borrar otra y restaurarla desde la papelera; e2e en móvil.
- e2e: `e2e/tests/subjects.spec.ts` recorre este criterio con Playwright en móvil (360 px) y escritorio (1280 px), también en el CI.

### M3 · Calendario del curso — *2 sesiones* ✅ hecho
- `Term` y `CalendarMark` con CRUD; importador de `data/calendario-2026-2027.seed.json`.
- Editor de calendario con "pincel" de colores (los 12 meses, táctil).
- Avisos de datos incompletos (fin de curso sin definir).
- **Hecho cuando**: el calendario 2026-27 queda cargado y editable, y la leyenda coincide con tu Excel.
- e2e: `e2e/tests/calendar.spec.ts` carga el 2026-27, pinta y edita una marca y comprueba que persiste (móvil y escritorio). Las marcas duran como mucho 366 días.

### M4 · Horario y motor de recurrencia — *3 sesiones* (el hito más delicado)
- `ScheduleSlot` (`weekly`/`dates`, `intervalWeeks`, `anchorDate`) y `SlotException` (cancelar/mover/extra).
- `schedule-engine` en `packages/shared` con tests de: semanas alternas, ancla distinta, festivo que cae en clase, vacaciones, exámenes, cancelaciones, mover, recurrencia `dates`, cambio de hora (25 oct y 28 mar), solapes.
- **Tests dorados con datos reales** (`data/fixtures/`): "martes lectivos" de Programación = los 27 martes del PDF; "lunes lectivos" de BBDD = 26 lunes; las 15 fechas sueltas del ejemplo con recurrencia `dates`.
- UI: formulario de franjas ("martes 16–18, cada 2 semanas, empezando el…"), vista semanal, acción "Cancelar esta clase".
- **Hecho cuando**: la semana del 12 oct muestra 12–14 oct como festivos y las demás clases correctas; los tests del motor ≥ 95 % de cobertura.

### M5 · Pendientes y tutorías — *2–3 sesiones*
- `Task` con tipo, fecha, prioridad, estimación, subtareas; `TaskProgress` (estado por usuario).
- Clasificación Atrasadas / Hoy / Esta semana / Más adelante / Sin fecha (función pura con tests).
- Tutoría: tema, preguntas previas, notas, enlace de grabación (`SessionRecord`); botón **Unirme**.
- Captura rápida (＋) en una sola línea.
- **Hecho cuando**: marco una tarea hecha y cambia de grupo al instante; una tarea vencida aparece en Atrasadas.

### M6 · Panel principal y detalle — *3 sesiones*
- Panel móvil (tira semanal + agenda + pendientes) y escritorio (rejilla semanal + 4 columnas).
- Detalle de asignatura con pestañas; vista **Hoy** con marcador "ahora".
- Estados vacíos, skeletons, modo oscuro.
- **Hecho cuando**: en un móvil de 360 px se ve todo sin desplazamiento horizontal y en un monitor de 1280 px se ve semana + pendientes sin hacer scroll.

### M7 · Grupos y notas — *3–4 sesiones*
- Crear grupo, código, unirse, salir (con copia de estructura/personal), expulsar, regenerar; límites de intentos.
- Cambio de espacio activo; `visibility` en tareas y notas; registro de actividad.
- Notas Markdown (grupo/personales), autoguardado, `baseVersion` → conflicto 409 con diálogo, historial de versiones.
- **Hecho cuando**: e2e con **dos navegadores**: A crea el grupo y una nota, B se une con el código, edita la nota, y A la ve actualizada; una nota personal de B es invisible para A.

### M8 · PWA y cierre del MVP — *2–3 sesiones*
- Manifest + iconos + service worker: la app abre al instante y muestra los últimos datos sin conexión (lectura).
- Pasada de accesibilidad (contraste, foco, tamaño táctil), textos, errores y toasts de *Deshacer*.
- Auditoría Lighthouse (PWA ≥ 90 · Accesibilidad ≥ 95), carga de datos reales.
- **Hecho cuando**: instalada en tu móvil, usas la app una semana real sin bloqueos graves.

**Total orientativo**: 20–25 sesiones.

## 7. Calidad

| Qué | Cómo | Dónde pesa más |
|---|---|---|
| Unidad | Vitest en `shared` | Motor de horario y clasificador de tareas (aquí están los errores caros) |
| API | Vitest + BD de pruebas | Permisos de workspace, doble confirmación, versión de notas |
| e2e | Playwright (iPhone/Android + escritorio) | Crear asignatura → horario → ver en el panel · borrar con 2 confirmaciones · grupo con 2 usuarios |
| CI | GitHub Actions en cada PR | lint · typecheck · test · build |
| Revisión | Migraciones de Drizzle revisadas a mano antes de aplicarlas | |

## 8. Seguridad (checklist)

- Contraseñas con un hash lento y con sal (scrypt/argon2id; lo gestiona Better Auth, comprobar el algoritmo por defecto al integrarlo); cookies `httpOnly` + `Secure` + `SameSite=Lax`.
- Todos los datos de entrada validados con zod; ninguna consulta sin filtro de `workspaceId`.
- **Tests de acceso cruzado (IDOR)** por cada recurso.
- `@fastify/helmet`, `@fastify/rate-limit` (auth, unirse a grupo); comprobación de `Origin` en peticiones que modifican datos.
- Código de grupo: 8 caracteres de un alfabeto de 32 (≈ 10¹² combinaciones) + límites de intentos + regenerable.
- Sin secretos en el repositorio; `npm audit` en CI; `ALLOW_SIGNUP=false` en producción.

## 9. Fase 3 · Refinar (backlog priorizado)

| Prioridad | Mejora | Notas |
|---|---|---|
| Alta | **Feed `.ics` privado** (tu horario en Google/Apple Calendar con avisos) | Barato; Google tarda horas en refrescar suscripciones |
| Alta | Recordatorios push (clase, tutoría con enlace, entregas) | Android directo; en iOS solo con la PWA instalada |
| Alta | Estimaciones y **carga semanal** ("14 h de trabajo, 8 h libres") | |
| Media | Notas en tiempo real (**Tiptap + Yjs**), plantillas de nota | |
| Media | Bloques de estudio: arrastrar tarea a un hueco; **sugerir hueco** | Estilo Motion/Reclaim, versión simple |
| Media | Pomodoro ligado a asignatura + estadísticas | |
| Media | Calificaciones y "¿qué nota necesito?" | |
| Media | Lenguaje natural en la captura rápida | |
| Baja | Repaso espaciado por temas (+1/+3/+7/+21) | |
| Baja | Revisión semanal del domingo; exportar mis datos (JSON); exportar asignatura a Markdown para NotebookLM | |
| Baja | Tablero Kanban para proyectos | |

## 10. Fase 4 · Despliegue

1. **Contenedor**: `Dockerfile` multi-etapa (build web → build API → imagen `node:alpine` que sirve API + estáticos).
2. **Opción gratuita recomendada** (presupuesto 0 €): servicio web en **Render** (el plan gratuito se "duerme" tras inactividad y tarda ~1 min en despertar) + **Turso** (SQLite alojado, plan gratuito; el disco de Render gratuito se borra, por eso la BD va fuera). La PWA muestra la caché al instante y oculta casi todo el arranque en frío. Fuentes: [Render](https://render.com/articles/platforms-with-a-real-free-tier-for-developers-in-2026), [comparativa de BD](https://agentdeals.dev/database-free-tier-comparison-2026).
3. **Si más adelante hay presupuesto** (~3–6 €/mes): VPS o Railway sin arranque en frío y con disco persistente (SQLite local). Fly.io ya no tiene plan gratuito para cuentas nuevas.
4. **Migraciones** automáticas en el arranque (`drizzle-kit migrate`) y variables de entorno en el panel del servicio.
5. **Copias de seguridad**: volcado semanal de la BD (`turso db shell … .dump` o export desde el cliente) con GitHub Actions a un artefacto/almacenamiento; probar la restauración una vez.
6. **Monitorización**: UptimeRobot (aviso si cae) + Sentry (errores) en planes gratuitos.
7. **Dominio y HTTPS**: dominio opcional; HTTPS lo da el proveedor.
8. **Lista de comprobación final**: `ALLOW_SIGNUP=false`, secretos rotados, Lighthouse, probar instalación en iOS y Android.

Los precios y planes gratuitos cambian a menudo: se revisan justo antes de desplegar.

## 11. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Errores sutiles de calendario (paridad, festivos, cambio de hora) | Alto: pierdes confianza en la app | Motor puro con tests exhaustivos (M4) y tabla de casos reales de tu curso |
| Alguien del grupo borra o sobreescribe algo | Medio | Papelera, historial de notas, registro de actividad, 2 confirmaciones |
| Ampliación de alcance | Alto | MVP congelado; todo lo demás al backlog |
| Arranque en frío del hosting gratuito | Bajo | PWA + caché; ping opcional; plan de pago como salida |
| Cambios de NotebookLM | Bajo | Solo enlace + exportación Markdown, sin depender de su API |
| Datos del calendario incompletos o erróneos | Medio | Editor de calendario; avisos de huecos; revisar con el Excel original |
| Notificaciones en iOS | Bajo | Feed `.ics` como alternativa |

## 12. Supuestos y preguntas abiertas

**Resueltas** ✅ calendario completo (PDF de Programación) · tutorías propias de cada asignatura · sin tutorías en semanas de examen · grupo comparte estructura, tareas y notas de grupo (progreso y notas personales privados) · presupuesto 0 € por ahora · acceso con email y contraseña.

**Pendientes**
1. ⚠️ **Paridad quincenal de Sostenibilidad**: ¿cuál es el primer martes en que hay tutoría? (el ancla). Supuesto: la paridad es fija desde esa fecha aunque un festivo se salte una.
2. ⚠️ **Programación**: ¿"Tutorías · martes 17:40–19:25" es la videotutoría o también tienes clase directa otro día? Se interpreta como la videotutoría.
3. ⚠️ **Resto de asignaturas** (3 más): nombre, horario, frecuencia y enlaces cuando los tengas. Tampoco tengo aún los enlaces de aula virtual / videollamada.
4. **Nombre de la app** (opcional, para manifest e iconos).
