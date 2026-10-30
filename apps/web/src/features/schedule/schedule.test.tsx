import { normalizeSeed, type Mark, type Slot } from '@organizador/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import seed from '../../../../../data/calendario-2026-2027.seed.json';
import { createFakeBackend, subjectFixture } from '../../test/fake-backend';
import { sentBodies } from '../../test/mock-api';
import { renderApp } from '../../test/render';

const programacion = subjectFixture({ id: 's-pro', name: 'Programación', shortName: 'PRO' });
const bases = subjectFixture({ id: 's-bbdd', name: 'Bases de Datos', shortName: 'BBDD' });
const COURSE: Mark[] = normalizeSeed(seed).marks.map((mark, index) => ({
  ...mark,
  id: `m${index}`,
}));

const slot = (overrides: Partial<Slot> & Pick<Slot, 'id' | 'subjectId'>): Slot => ({
  kind: 'clase',
  recurrence: 'weekly',
  weekday: 2,
  intervalWeeks: 1,
  anchorDate: null,
  dates: null,
  startTime: '17:40',
  endTime: '19:25',
  location: null,
  meetingUrl: null,
  validFrom: null,
  validTo: null,
  ...overrides,
});

const proTuesday = slot({
  id: 'slot-pro',
  subjectId: 's-pro',
  kind: 'tutoria',
  meetingUrl: 'https://meet.example.com/pro',
});
const bbddMonday = slot({
  id: 'slot-bbdd',
  subjectId: 's-bbdd',
  weekday: 1,
  startTime: '16:00',
  endTime: '18:00',
});

const day = (name: string) => screen.getByRole('region', { name });
const setValue = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('franjas de una asignatura', () => {
  it('anade una tutoria quincenal: exige un dia con clase que caiga en martes', async () => {
    const api = createFakeBackend({ subjects: [programacion] }).install();
    const user = userEvent.setup();
    renderApp('/asignaturas/s-pro/horario');

    expect(await screen.findByRole('heading', { name: 'Horario de Programación' })).toBeVisible();
    expect(screen.getByText('Esta asignatura aún no tiene franjas de horario.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Añadir franja' }));
    await user.selectOptions(screen.getByLabelText('Tipo'), 'Tutoría');
    await user.selectOptions(screen.getByLabelText('Se repite'), 'Cada 2 semanas');
    await user.selectOptions(screen.getByLabelText('Día'), 'martes');
    setValue('Un día con clase', '2026-10-14'); // miercoles
    setValue('Empieza', '17:40');
    setValue('Termina', '19:25');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Ese día no cae en el día de la semana elegido.')).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/slots')).toEqual([]);

    setValue('Un día con clase', '2026-10-13');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      await screen.findByText(
        /Tutoría · martes · 17:40–19:25 · cada 2 semanas, contando desde el 13/,
      ),
    ).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/slots')).toEqual([
      {
        subjectId: 's-pro',
        kind: 'tutoria',
        recurrence: 'weekly',
        weekday: 2,
        intervalWeeks: 2,
        anchorDate: '2026-10-13',
        dates: null,
        startTime: '17:40',
        endTime: '19:25',
        location: null,
        meetingUrl: null,
        validFrom: null,
        validTo: null,
      },
    ]);
  });

  it('en fechas sueltas se anaden y quitan fechas; la hora de fin va despues', async () => {
    const api = createFakeBackend({ subjects: [programacion] }).install();
    const user = userEvent.setup();
    renderApp('/asignaturas/s-pro/horario');

    await user.click(await screen.findByRole('button', { name: 'Añadir franja' }));
    await user.selectOptions(screen.getByLabelText('Se repite'), 'En fechas sueltas');
    for (const date of ['2026-10-26', '2026-10-05', '2026-11-09']) {
      setValue('Fecha', date);
      await user.click(screen.getByRole('button', { name: 'Añadir fecha' }));
    }
    await user.click(screen.getByRole('button', { name: 'Quitar 9 de noviembre de 2026' }));
    setValue('Empieza', '18:00');
    setValue('Termina', '17:00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(
      await screen.findByText('La hora de fin debe ser posterior a la de inicio.'),
    ).toBeVisible();

    setValue('Termina', '19:00');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText(/2 fechas sueltas/)).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/slots')[0]).toMatchObject({
      recurrence: 'dates',
      weekday: null,
      dates: ['2026-10-05', '2026-10-26'],
    });
  });

  it('edita y borra una franja', async () => {
    const api = createFakeBackend({ subjects: [programacion], slots: [proTuesday] }).install();
    const user = userEvent.setup();
    renderApp('/asignaturas/s-pro/horario');

    const description = 'Tutoría · martes · 17:40–19:25 · cada semana';
    await user.click(await screen.findByRole('button', { name: `Editar ${description}` }));
    await user.selectOptions(screen.getByLabelText('Día'), 'jueves');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Tutoría · jueves · 17:40–19:25 · cada semana')).toBeVisible();
    expect(sentBodies(api, 'PATCH', '/api/v1/slots/slot-pro')[0]).toMatchObject({ weekday: 4 });

    await user.click(
      screen.getByRole('button', { name: 'Borrar Tutoría · jueves · 17:40–19:25 · cada semana' }),
    );
    expect(
      await screen.findByText('Esta asignatura aún no tiene franjas de horario.'),
    ).toBeVisible();
  });
});

describe('semana en el panel (movil)', () => {
  const backend = () =>
    createFakeBackend({
      subjects: [programacion, bases],
      slots: [proTuesday, bbddMonday],
      marks: COURSE,
    });
  const pick = (user: ReturnType<typeof userEvent.setup>, name: string) =>
    user.click(screen.getByRole('button', { name: new RegExp(`^${name}`) }));

  it('CRITERIO DE M4: la semana del 12 oct muestra los festivos y el jueves normal', async () => {
    const thursday = slot({ id: 'slot-ent', subjectId: 's-bbdd', weekday: 4 });
    createFakeBackend({
      subjects: [programacion, bases],
      slots: [proTuesday, bbddMonday, thursday],
      marks: COURSE,
    }).install();
    const user = userEvent.setup();
    renderApp('/?semana=2026-10-14&dia=2026-10-12');

    // El encabezado sale ya mientras carga: se espera a que este el dia.
    const monday = await screen.findByRole('region', { name: 'lunes, 12 oct' });
    expect(screen.getByRole('heading', { name: /12.18 oct 2026/ })).toBeVisible();
    expect(within(monday).getAllByText('Festivo (Pilar)')).toHaveLength(2); // dia y clase
    // Las clases bloqueadas no se pueden cambiar.
    expect(within(monday).queryByRole('button', { name: /Cambiar la clase/ })).toBeNull();
    // La tira cuenta las clases que se imparten: solo el jueves tiene.
    expect(screen.getByRole('button', { name: 'lunes, 12 oct' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'jueves, 15 oct, 1 clase' })).toBeVisible();

    await pick(user, 'martes, 13 oct');
    expect(within(day('martes, 13 oct')).getAllByText('Festivo Zaragoza')).toHaveLength(2);
    await pick(user, 'miércoles, 14 oct');
    expect(within(day('miércoles, 14 oct')).getByText('Festivo Zaragoza')).toBeVisible();
    await pick(user, 'jueves, 15 oct');
    const jueves = day('jueves, 15 oct');
    expect(within(jueves).getByText('Bases de Datos')).toBeVisible();
    expect(within(jueves).getByText('17:40–19:25')).toBeVisible();
  });

  it('cambia de semana con las flechas y deslizando, y enlaza la videollamada', async () => {
    backend().install();
    const user = userEvent.setup();
    renderApp('/?semana=2026-10-14');

    await user.click(await screen.findByRole('button', { name: 'Semana siguiente' }));
    expect(screen.getByRole('heading', { name: /19.25 oct 2026/ })).toBeVisible();
    await pick(user, 'martes, 20 oct');
    const tuesday = day('martes, 20 oct');
    expect(within(tuesday).getByText('17:40–19:25 · Tutoría')).toBeVisible();
    expect(within(tuesday).getByRole('link', { name: /Videollamada/ })).toHaveAttribute(
      'href',
      'https://meet.example.com/pro',
    );

    // Deslizar la tira hacia la izquierda pasa a la semana siguiente.
    const strip = screen.getByRole('group', { name: 'Días de la semana' });
    fireEvent.touchStart(strip, { touches: [{ clientX: 300 }] });
    fireEvent.touchEnd(strip, { changedTouches: [{ clientX: 100 }] });
    expect(await screen.findByRole('heading', { name: /26 oct.*1 nov 2026/ })).toBeVisible();
  });

  it('el nombre de la asignatura lleva a su detalle', async () => {
    backend().install();
    renderApp('/?semana=2026-10-20&dia=2026-10-20');
    const tuesday = await screen.findByRole('region', { name: 'martes, 20 oct' });
    expect(within(tuesday).getByRole('link', { name: 'Programación' })).toHaveAttribute(
      'href',
      '/asignaturas/s-pro',
    );
  });

  it('cancelar una clase la deja visible como cancelada, y se puede deshacer', async () => {
    const api = backend().install();
    const user = userEvent.setup();
    renderApp('/?semana=2026-10-20&dia=2026-10-20');

    await user.click(
      await screen.findByRole('button', { name: 'Cambiar la clase de Programación del 20 oct' }),
    );
    await user.type(screen.getByLabelText('Motivo (opcional)'), 'Huelga');
    await user.click(screen.getByRole('button', { name: 'Cancelar esta clase' }));

    expect(await within(day('martes, 20 oct')).findByText('Cancelada · Huelga')).toBeVisible();
    expect(sentBodies(api, 'POST', '/api/v1/slots/slot-pro/exceptions')).toEqual([
      {
        date: '2026-10-20',
        kind: 'cancelled',
        newDate: null,
        newStart: null,
        newEnd: null,
        reason: 'Huelga',
      },
    ]);

    await user.click(
      screen.getByRole('button', { name: 'Cambiar la clase de Programación del 20 oct' }),
    );
    await user.click(screen.getByRole('button', { name: 'Deshacer el cambio' }));
    expect(await within(day('martes, 20 oct')).findByText('17:40–19:25 · Tutoría')).toBeVisible();
    expect(within(day('martes, 20 oct')).queryByText(/Cancelada/)).toBeNull();
  });

  it('mover una clase: el dia original avisa y la clase aparece en el nuevo dia y hora', async () => {
    backend().install();
    const user = userEvent.setup();
    renderApp('/?semana=2026-10-20&dia=2026-10-20');

    await user.click(
      await screen.findByRole('button', { name: 'Cambiar la clase de Programación del 20 oct' }),
    );
    setValue('Nuevo día', '2026-10-22');
    setValue('Empieza', '10:00');
    setValue('Termina', '11:30');
    await user.click(screen.getByRole('button', { name: 'Mover la clase' }));

    expect(await within(day('martes, 20 oct')).findByText('Movida al 22 oct')).toBeVisible();
    await pick(user, 'jueves, 22 oct');
    const thursday = day('jueves, 22 oct');
    expect(within(thursday).getByText('Movida desde el 20 oct')).toBeVisible();
    expect(within(thursday).getByText('10:00–11:30 · Tutoría')).toBeVisible();
  });

  it('hoy marca "ahora" entre lo que ya empezo y lo que falta', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T15:00:00Z')); // martes 20, 17:00 en Madrid
    try {
      const early = slot({
        id: 'slot-early',
        subjectId: 's-bbdd',
        startTime: '16:00',
        endTime: '17:00',
      });
      createFakeBackend({
        subjects: [programacion, bases],
        slots: [proTuesday, early],
        marks: COURSE,
      }).install();
      renderApp('/');

      const today = await screen.findByRole('region', { name: 'martes, 20 oct' });
      const items = within(today)
        .getAllByRole('listitem')
        .map((item) => item.textContent ?? '');
      expect(items).toHaveLength(3);
      expect(items[0]).toContain('Bases de Datos');
      expect(items[1]).toBe('Ahora · 17:00');
      expect(items[2]).toContain('Programación');
    } finally {
      vi.useRealTimers();
    }
  });

  it('sin asignaturas invita a crearlas', async () => {
    createFakeBackend().install();
    renderApp('/');
    expect(
      await screen.findByText('Añade tus asignaturas y su horario para ver aquí tus clases.'),
    ).toBeVisible();
  });
});

describe('semana en el panel (escritorio)', () => {
  beforeEach(() => {
    // jsdom no tiene matchMedia: se simula una pantalla ancha (se deshace en setup.ts).
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: true,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });

  it('rejilla con los 7 dias; un bloque se elige y muestra la clase con sus acciones', async () => {
    createFakeBackend({
      subjects: [programacion, bases],
      slots: [proTuesday, bbddMonday],
      marks: COURSE,
    }).install();
    const user = userEvent.setup();
    renderApp('/?semana=2026-10-19');

    const monday = await screen.findByRole('region', { name: 'lunes, 19 oct' });
    expect(screen.getByRole('region', { name: 'sábado, 24 oct' })).toBeVisible();
    expect(screen.getByRole('region', { name: 'domingo, 25 oct' })).toBeVisible();
    await user.click(within(monday).getByRole('button', { name: 'Bases de Datos, 16:00–18:00' }));

    const chosen = screen.getByRole('region', { name: 'Clase seleccionada' });
    expect(within(chosen).getByText('16:00–18:00')).toBeVisible();
    await user.click(
      within(chosen).getByRole('button', { name: 'Cambiar la clase de Bases de Datos del 19 oct' }),
    );
    await user.click(within(chosen).getByRole('button', { name: 'Cancelar esta clase' }));

    // La clase sigue elegida tras el cambio (su clave no depende de la excepcion).
    expect(await within(chosen).findByText('Cancelada')).toBeVisible();
    expect(
      within(monday).getByRole('button', { name: 'Bases de Datos, 16:00–18:00, cancelada' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('los bloques de un festivo dicen que no hay clase', async () => {
    createFakeBackend({ subjects: [bases], slots: [bbddMonday], marks: COURSE }).install();
    renderApp('/?semana=2026-10-12');

    const monday = await screen.findByRole('region', { name: 'lunes, 12 oct' });
    expect(within(monday).getByText('Festivo (Pilar)')).toBeVisible();
    expect(
      within(monday).getByRole('button', { name: 'Bases de Datos, 16:00–18:00, sin clase' }),
    ).toBeVisible();
  });
});
