# 01 · Análisis y diseño — Organizador DAM

> Estado: **borrador v2** (tras la primera ronda de respuestas). Lo marcado con ⚠️ son supuestos que hay que confirmar.

## 1. Producto en una frase

Un panel **mobile-first** (que también funciona bien en ordenador) donde ves de un vistazo tus 6 asignaturas con su horario real —descontando festivos, vacaciones, exámenes y clases canceladas—, las videotutorías y todo lo pendiente clasificado; con **grupo opcional** para compartir la estructura del curso y apuntes con una compañera.

**Principios de diseño**

1. *Una pantalla responde a "¿qué toca hoy y qué se me acumula?"* en menos de 5 s.
2. *El horario se calcula, no se escribe*: configuras la regla una vez (martes 16:00, cada 2 semanas) y el calendario real sale solo.
3. *Nada se pierde por error*: borrado con doble confirmación, papelera, historial de notas.
4. *Móvil primero*: pulgar, una mano, poca escritura. Escritorio = misma app con más espacio.
5. *Coste cero* mientras se pueda.

## 2. Requisitos

### 2.1 Funcionales del MVP

| ID | Requisito | Notas |
|---|---|---|
| R1 | Añadir y eliminar asignaturas (6 ahora, sin límite fijo) | Eliminar = **doble confirmación** (1º: muestra el impacto; 2º: escribir el nombre). Alternativa "Archivar" |
| R2 | Horario por asignatura: días, hora inicio/fin, **frecuencia** (cada semana / cada 2 / cada 3 / cada 4 semanas) | Varias franjas por asignatura. Se indica la semana de referencia ("la primera es el 13 oct") |
| R3 | **Cancelar o mover** una clase concreta (sin tocar la regla) | Motivo opcional. La clase cancelada sigue visible en gris |
| R4 | **Calendario del curso** editable: festivos, vacaciones, exámenes, tutorías virtuales, inicio/fin | Precargado con el curso 2026-27 (ver §3). Los días "bloqueantes" eliminan las clases |
| R5 | **Videotutorías**: fecha, hora, enlace, tema, preguntas previas, notas posteriores, enlace de grabación | Cada asignatura tiene su propio horario de tutoría (franja `tutoria`); el calendario del curso solo la anula en festivos y exámenes |
| R6 | **Pendientes** por asignatura: tipo, fecha de entrega, prioridad, estimación, estado, subtareas | Clasificados: Atrasadas · Hoy · Esta semana · Más adelante · Sin fecha |
| R7 | **Panel principal único**: horario arriba, pendientes abajo; tocar una asignatura abre su detalle | Móvil: tira semanal + agenda del día + pendientes en la misma página |
| R8 | **Detalle de asignatura**: horario, próximas clases/tutorías, tareas, notas, enlaces (Moodle, NotebookLM, repo) | |
| R9 | **Cuentas** (email + contraseña) | Necesario por el grupo |
| R10 | **Grupo opcional**: crear, unirse con código, salir, expulsar, regenerar código | Ver §5 |
| R11 | **Notas de grupo** (las edita cualquier miembro) y **notas personales** (solo tú) | Markdown |
| R12 | **PWA instalable**, con la última información disponible sin conexión | |

### 2.2 No funcionales

- Responsive real: probado a 360 px, 768 px y 1280 px.
- Zona horaria `Europe/Madrid`; fechas y horas "civiles" (`2026-10-13`, `16:00`), no instantes UTC. Evita errores con el cambio de hora (25 oct 2026 y 28 mar 2027).
- Accesible: contraste AA, navegación por teclado, objetivos táctiles ≥ 44 px, modo oscuro.
- Interfaz en español (cadenas centralizadas por si algún día hay otro idioma).
- Privacidad: solo se guardan email, nombre y contenido del curso. Exportar/borrar mis datos (v1.1).

## 3. Calendario del curso 2026-27

Fuentes: la captura de ejemplo y el PDF completo de Programación (`Calendario PROGRAMACIÓN 26_27`). Datos en `data/calendario-2026-2027.seed.json`. **El calendario del curso solo lleva lo que es común a todas las asignaturas**; las videotutorías son de cada asignatura (§4).

| Qué | Fechas |
|---|---|
| 🟪 Inicio / fin de curso | jue 1 oct 2026 / vie 18 jun 2027 |
| 🟦 Festivos | 12 oct · 2 nov · 7–8 dic · 23 abr · 3 may |
| 🟥 Festivos Zaragoza | 13–14 oct · 29 ene (San Valero) · 5 mar (Cincomarzada) |
| 🟦 Vacaciones de Navidad | 22 dic → 6 ene |
| 🟦 Vacaciones de Semana Santa | 25 mar → 4 abr |
| 🟩 Exámenes 1er cuatrimestre | 1–5 feb 2027 (DAM / DAW / IABD / DALP) |
| 🟩 Exámenes 2º cuatrimestre | 10–14 may 2027 |
| 🟩 Convocatorias de junio | J1: 31 may–4 jun · J2: 14–18 jun |
| ⬜ Defensas de proyectos (DAM, DAW, SMR, ASIR) | 1ª conv.: 24–28 may · 2ª conv.: 8–11 jun |

**Observaciones que influyen en el diseño**

- **Las tutorías no son comunes**: cada asignatura tiene su día, su hora y su frecuencia (Programación los martes, BBDD los lunes, Sostenibilidad martes alternos). ⇒ viven en el horario de la asignatura, no en el calendario del curso.
- **El calendario del curso tiene prioridad sobre las reglas de horario**: un festivo, las vacaciones y las semanas de examen anulan clases y tutorías (confirmado: en semana de exámenes no hay videotutorías). Las defensas de proyectos **no** bloquean (Programación tiene tutoría el 25 may y el 8 jun).
- **El curso tiene dos cuatrimestres** con semana de exámenes al final de cada uno, más las convocatorias de junio ⇒ hace falta el concepto de *cuatrimestre* (estadísticas y filtros).
- **Prueba de fuego**: la regla "todos los martes lectivos" da exactamente los 27 martes que el PDF marca como videotutoría de Programación (festivos, Navidad, Semana Santa y exámenes incluidos). Ese resultado es el primer test automático del motor (`data/fixtures/`).

### Editor del calendario del curso (idea de UX)

Una pantalla con los 12 meses y la **misma leyenda de colores que tu Excel**. Eliges un "pincel" (🟦, 🟥, 🟨, 🟩…) y pulsas o arrastras sobre los días. Es lo más familiar para ti y tiene casi cero curva de aprendizaje.

## 4. Reglas del horario

Cada asignatura tiene **franjas** (`ScheduleSlot`). Hay dos tipos de recurrencia:

| Tipo | Ejemplo | Campos |
|---|---|---|
| `weekly` | Programación: "martes 17:40–19:25, todas las semanas lectivas". Sostenibilidad: "martes 15:50–16:40, cada 2 semanas, empezando el…" | `weekday`, `startTime`, `endTime`, `intervalWeeks` (1–4), `anchorDate`, `validFrom?`, `validTo?` |
| `dates` | Una asignatura que publica sus tutorías en fechas sueltas e irregulares | lista de fechas + `startTime`, `endTime` |

Cada franja es de tipo `clase` o `tutoria`, y puede llevar `meetingUrl`.

**Cómo se calcula una semana** (motor puro en `packages/shared`, con tests):

1. *Candidatas*: fechas que cumplen la regla dentro del periodo del curso. En `weekly` con intervalo N: `((semana(fecha) − semana(anchorDate)) mod N) == 0`.
2. *Bloqueo*: si la fecha cae en una marca con `blocksClasses = true` (festivo, vacaciones, exámenes) la clase pasa a estado `bloqueada` (se muestra tenue con el motivo).
3. *Excepciones* (`SlotException`) sobre una fecha concreta: `cancelled` (con motivo), `moved` (nueva fecha/hora) o `extra` (clase añadida).
4. Resultado: `Occurrence { slotId, subjectId, date, start, end, status: scheduled | cancelled | moved | blocked, reason? }`.

**Decisiones por defecto** (⚠️ confírmalas):

- **La paridad de las clases quincenales es fija**: si un festivo se come una clase, la siguiente sigue siendo 2 semanas después de la *regla*, no de la última impartida. Si no es así en tu centro, se corrige con un "mover" o cambiando el ancla.
- **En semanas de exámenes no hay clase ni tutoría** (confirmado), aunque se puede forzar una con una excepción `extra`.
- Avisos automáticos (no errores): "esta tutoría cae en festivo", "dos clases se solapan".

## 5. Grupos

### 5.1 Qué se comparte

| | Compartido en el grupo | Personal (cada miembro) |
|---|---|---|
| Estructura | Asignaturas, horario, excepciones, calendario del curso, tutorías | — |
| Pendientes | **Tareas del grupo** (mismo título y fecha de entrega) | **Tareas personales** |
| Estado de una tarea | — | **Cada uno marca la suya** como hecha (`TaskProgress`) |
| Notas | **Notas de grupo**: las edita cualquier miembro | **Notas personales**: solo las ve su autora |
| Estudio | — | Sesiones de estudio, estadísticas, calificaciones |

✅ Confirmado. Compartir la estructura evita que cada una configure 6 asignaturas, el horario y los festivos por duplicado y que se desincronicen.

### 5.2 Cómo funciona

- Cada usuario tiene un **espacio personal** (se crea al registrarse). Un **grupo** es otro espacio, compartido.
- Un usuario tiene un **espacio activo**: o el personal o el del grupo al que pertenece. Un grupo por usuario en el MVP.
- **Crear grupo** → se genera un código de 8 caracteres (`K7QM-4XD9`, alfabeto sin `0/O/1/I`).
- **Unirse** → pegar el código. La app explica: *"Verás las asignaturas, el horario, el calendario y las notas del grupo. Tus datos actuales se guardan y vuelven si sales."*
- **Salir** → opción de *"llevarme una copia de la estructura y de mi contenido personal"* a mi espacio personal.
- **Permisos**: todos los miembros editan todo lo del grupo (lo que pediste). Solo el creador puede regenerar el código, expulsar o disolver el grupo.
- **Salvaguardas** (porque cualquiera con el código edita): borrado lógico + papelera de 30 días, historial de las últimas 20 versiones de cada nota, y un registro de actividad ("Laura movió la clase de BBDD del 15 al 16").
- **Seguridad del código**: se puede regenerar (invalida el anterior), caducidad opcional, límite de miembros (por defecto 5) y límite de intentos por IP/usuario.
- **Edición simultánea de notas**: en el MVP, guardado automático con control de versión. Si dos personas editan a la vez, se avisa y se ofrece *quedarme con la mía / con la suya / guardar la mía como nota nueva*. En una fase posterior, edición en tiempo real con Yjs + Tiptap.

## 6. Inspiración: otras plataformas

| Plataforma | Qué tiene de valioso | Qué nos llevamos | Fase |
|---|---|---|---|
| **My Study Life** | Horario de estudiante con **rotación por semanas**, tareas y exámenes en una app | La idea de semanas alternas (nuestro `intervalWeeks`), exámenes como entidad propia, cuenta atrás | MVP |
| **Canvas / Moodle** | To-do lateral, tareas con color por curso, calificaciones y notas hipotéticas | Código de color por asignatura en todas partes; calculadora "¿qué nota necesito en el examen?" | MVP / 1.1 |
| **Structured** | Línea de tiempo vertical del día con "ahora" marcado | La vista **Hoy** del móvil | MVP |
| **Todoist** | Entrada rápida en lenguaje natural ("práctica BBDD viernes"), vistas Hoy/Próximos | Botón "+" de captura en 1 línea; el parser básico es sencillo | 1.1 |
| **TickTick** | Pomodoro, hábitos, cuenta atrás y calendario en una app | Temporizador de estudio ligado a asignatura; cuentas atrás de exámenes | 1.1–2 |
| **Notion** | Misma base de datos en varias vistas (lista, tablero, calendario) | Vistas de pendientes: lista agrupada y tablero | MVP / 1.1 |
| **Trello** | Tablero Kanban | Columnas por estado dentro de una asignatura (proyectos) | 2 |
| **Sunsama** | Ritual de planificación diaria (revisar, elegir, cerrar el día) | "Planificar mi día" por la mañana y "Cerrar el día" por la noche | 2 |
| **Motion / Reclaim** | Colocan tareas automáticamente en tus huecos libres según fecha límite | **Sugerir hueco de estudio** (algoritmo simple sobre tu horario) | 2 |
| **Forest** | Concentración sin móvil, gamificada | Racha de sesiones de estudio (sin sobrecargar) | 2 |
| **Anki** | Repaso espaciado (SM-2/FSRS) | Repasos de temas a +1/+3/+7/+21 días | 2 |
| **Obsidian** | Notas en Markdown con enlaces entre notas | Markdown, `[[enlaces]]` y plantillas de nota (clase, tutoría) | 1.1 |
| **Google Calendar** | Suscripción por ICS | **Feed .ics** para ver tu horario y recibir avisos en el calendario del móvil | 1.1 |

Fuentes consultadas: [My Study Life](https://mystudylife.com/best-study-apps-for-students-2026/), [comparativa de planners para estudiantes](https://www.savemyexams.com/learning-hub/useful-resources/best-productivity-apps-for-students/).

## 7. Diseño UX (mobile-first)

### 7.1 Navegación

- **Móvil**: barra inferior con 5 destinos — **Panel · Calendario · Asignaturas · Notas · Más** (grupo, ajustes, papelera). Botón flotante **＋** para añadir tarea.
- **Escritorio**: barra lateral con los mismos destinos y el Panel en 2 zonas (semana arriba, pendientes abajo).

### 7.2 Panel — móvil

```
┌──────────────────────────┐
│  ◀  12–18 oct 2026   ▶  │
│  L   M   X   J   V   S  D│
│  12  13  14  15  16  17 18│
│  🎌  🎌  🎌  ●●  ●🟨      │  ← puntos = lo que hay ese día
├──────────────────────────┤
│  Jueves 15               │
│  16:00 ▌Prog.      Aula 2│
│  ─ ahora ───────────────  │
│  18:00 ▌BBDD   (cancelada)│
├──────────────────────────┤
│  PENDIENTES    [Todas ▾] │
│  [Atrasadas 1][Hoy 2]    │
│  [Semana 4][Después 6]   │
│  ☐ Práctica 2 · BBDD  vie│
│  ☐ Leer tema 3 · Prog. hoy│
├──────────────────────────┤
│ Panel Calend. Asig. Notas Más│
└──────────────────────────┘
```

- Deslizar lateral sobre la tira cambia de semana; tocar un día cambia la agenda.
- Cada bloque usa el **color de su asignatura**; tocarlo abre su detalle.
- La tutoría muestra **[Unirme]** cuando faltan < 15 min.

### 7.3 Panel — escritorio

```
┌──────────┬──────────────────────────────────────────────────────┐
│ Panel    │  ◀  Semana 12–18 oct ▶   [Hoy]            [＋ Tarea] │
│ Calend.  ├────────┬────────┬────────┬────────┬────────┬─────────┤
│ Asig.    │ Lun 12 │ Mar 13 │ Mié 14 │ Jue 15 │ Vie 16 │ Sáb·Dom │
│ Notas    │ 🎌     │ 🎌     │ 🎌     │ [Prog.]│ [BBDD] │         │
│ Más      │        │        │        │ [BBDD] │        │         │
│          ├────────┴────────┴────────┴────────┴────────┴─────────┤
│          │ Atrasadas │ Hoy │ Esta semana │ Más adelante           │
│          │  tarjetas por tarea (color + asignatura + fecha)      │
└──────────┴──────────────────────────────────────────────────────┘
```

### 7.4 Detalle de asignatura

Cabecera con color, profesor y botones rápidos (**Aula virtual · NotebookLM · Repo**). Pestañas: **Resumen** (próximas clases/tutorías, tareas urgentes) · **Tareas** · **Tutorías** · **Notas** (grupo | personales) · **Horario** · **Ajustes**.

### 7.5 Detalles de interfaz

- Paleta de 12 colores de asignatura con contraste AA en claro y oscuro.
- Estados vacíos con una acción ("Aún no tienes asignaturas → Añadir la primera").
- Deshacer tras acciones (toast con **Deshacer** 8 s) antes que diálogos de confirmación, excepto en el borrado de asignaturas.
- Skeletons y datos en caché al abrir (la app nunca debe verse "en blanco").

## 8. Modelo de datos (borrador)

```
User(id, email, passwordHash, name, createdAt)
Workspace(id, kind: personal|group, name, joinCode?, joinCodeExpiresAt?, maxMembers, createdBy)
Membership(workspaceId, userId, role: owner|member, joinedAt)
UserSettings(userId, activeWorkspaceId, theme, weekStart)

── Estructura del curso (pertenece al Workspace) ─────────────────
Term(id, workspaceId, name, startDate, endDate?)                 ← cuatrimestres
CalendarMark(id, workspaceId, kind, startDate, endDate, label, blocksClasses, groups?)
Subject(id, workspaceId, name, shortName, color, teacher, links(json),
        position, archivedAt?, deletedAt?)
ScheduleSlot(id, subjectId, kind: clase|tutoria,
             recurrence: weekly|dates, weekday?, intervalWeeks, anchorDate?,
             dates?(json), startTime, endTime, location?, meetingUrl?, validFrom?, validTo?)
SlotException(id, slotId, date, kind: cancelled|moved|extra, newDate?, newStart?, newEnd?, reason?)
SessionRecord(slotId, date, topic?, questions?, notes?, recordingUrl?, meetingUrlOverride?)

── Contenido ────────────────────────────────────────────────────
Task(id, workspaceId, subjectId, createdBy, visibility: workspace|personal,
     title, description?, type, dueDate?, dueTime?, remindFrom?, priority,
     estimateMin?, parentId?, deletedAt?)
TaskProgress(taskId, userId, status: todo|doing|done, doneAt?, grade?)
Note(id, workspaceId, subjectId, visibility: group|personal, authorId,
     title, markdown, version, updatedBy, updatedAt, deletedAt?)
NoteRevision(noteId, version, markdown, editedBy, editedAt)
ActivityLog(id, workspaceId, userId, entity, entityId, action, summary, at)

── Fase 2 (no MVP) ──────────────────────────────────────────────
StudySession(id, userId, subjectId, taskId?, plannedStart?, plannedMin, actualMin?)
```

Notas de diseño:

- **Todo cuelga de `workspaceId`** desde el primer día. Así "grupo" no obliga a reescribir nada después.
- Si solo quisieras compartir notas, bastaría con un `Workspace` de grupo que solo contenga `Note` y que `Subject` siga siendo personal con una clave de emparejamiento por nombre. No lo recomiendo (se desincroniza).
- `visibility = personal` sigue guardándose en el espacio del grupo pero solo la lee su autora; al salir del grupo se copia al espacio personal.
- `deletedAt` en lugar de `DELETE`: papelera y deshacer.

## 9. NotebookLM

- **No hay API pública para cuentas personales**: solo existe la *NotebookLM Enterprise API* dentro de Google Cloud (de pago), así que la descartamos. Fuente: [resumen de integraciones de NotebookLM 2026](https://pasqualepillitteri.it/en/news/3874/notebooklm-canvas-personal-preferences-connectors-coming-2026) y [hilo del foro de Google AI](https://discuss.ai.google.dev/t/notebooklm-api/55950). Google cambia esto a menudo, así que conviene volver a mirarlo antes de la Fase 3.
- **Integración de "enlace" (coste 0)**: cada asignatura guarda la URL de su cuaderno y un botón la abre.
- **Flujo extra barato**: botón **"Exportar asignatura a Markdown"** (apuntes de grupo + tareas + resumen de tutorías) para subirlo como fuente al cuaderno. ⚠️ Comprobar que NotebookLM acepta el formato `.md`/`.txt` en el momento de implementarlo.
- Recíprocamente: pegar en una nota lo que genere NotebookLM (guía de estudio, FAQ, test).

## 10. Fuera del MVP (y por qué)

Notificaciones push, Pomodoro/estudio, repaso espaciado, estadísticas, calificaciones, feed `.ics`, edición en tiempo real, importación del calendario por foto/OCR, varios grupos por usuario, roles de solo lectura, app nativa. Todos están en el backlog de la Fase 3 (ver `02-plan-de-implementacion.md`).
