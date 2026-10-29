import { normalizeSeed, type Mark, type Slot } from '@organizador/shared';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
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

const day = (name: string) => screen.getByRole('listitem', { name });
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

describe('semana en el panel', () => {
  const backend = () =>
    createFakeBackend({
      subjects: [programacion, bases],
      slots: [proTuesday, bbddMonday],
      marks: COURSE,
    });

  it('CRITERIO DE M4: la semana del 12 oct muestra los festivos y el jueves normal', async () => {
    const thursday = slot({ id: 'slot-ent', subjectId: 's-bbdd', weekday: 4 });
    createFakeBackend({
      subjects: [programacion, bases],
      slots: [proTuesday, bbddMonday, thursday],
      marks: COURSE,
    }).install();
    renderApp('/?semana=2026-10-14');

    // El encabezado sale ya mientras carga: se espera a que esten los dias.
    const monday = await screen.findByRole('listitem', { name: 'lunes, 12 oct' });
    expect(screen.getByRole('heading', { name: /12.18 de octubre de 2026/ })).toBeVisible();
    expect(within(monday).getAllByText('Festivo (Pilar)')).toHaveLength(2); // dia y clase
    expect(within(day('martes, 13 oct')).getAllByText('Festivo Zaragoza')).toHaveLength(2);
    expect(within(day('miércoles, 14 oct')).getByText('Festivo Zaragoza')).toBeVisible();
    const jueves = day('jueves, 15 oct');
    expect(within(jueves).getByText('Bases de Datos')).toBeVisible();
    expect(within(jueves).getByText('17:40–19:25')).toBeVisible();
    // Las clases bloqueadas no se pueden cambiar.
    expect(within(monday).queryByRole('button', { name: /Cambiar la clase/ })).toBeNull();
  });

  it('navega de semana y muestra el enlace de la videollamada en la tutoria', async () => {
    backend().install();
    const user = userEvent.setup();
    renderApp('/?semana=2026-10-14');

    await user.click(await screen.findByRole('button', { name: 'Semana siguiente' }));
    const tuesday = day('martes, 20 oct');
    expect(within(tuesday).getByText('17:40–19:25 · Tutoría')).toBeVisible();
    expect(within(tuesday).getByRole('link', { name: /Videollamada/ })).toHaveAttribute(
      'href',
      'https://meet.example.com/pro',
    );
  });

  it('cancelar una clase la deja visible como cancelada, y se puede deshacer', async () => {
    const api = backend().install();
    const user = userEvent.setup();
    renderApp('/?semana=2026-10-20');

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
    renderApp('/?semana=2026-10-20');

    await user.click(
      await screen.findByRole('button', { name: 'Cambiar la clase de Programación del 20 oct' }),
    );
    setValue('Nuevo día', '2026-10-22');
    setValue('Empieza', '10:00');
    setValue('Termina', '11:30');
    await user.click(screen.getByRole('button', { name: 'Mover la clase' }));

    expect(await within(day('martes, 20 oct')).findByText('Movida al 22 oct')).toBeVisible();
    const thursday = day('jueves, 22 oct');
    expect(within(thursday).getByText('Movida desde el 20 oct')).toBeVisible();
    expect(within(thursday).getByText('10:00–11:30 · Tutoría')).toBeVisible();
  });

  it('sin asignaturas invita a crearlas', async () => {
    createFakeBackend().install();
    renderApp('/');
    expect(
      await screen.findByText('Añade tus asignaturas y su horario para ver aquí tus clases.'),
    ).toBeVisible();
  });
});
