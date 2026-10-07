// Todas las cadenas de la interfaz viven aqui (por si algun dia hay otro idioma).
export const es = {
  appName: 'Organizador DAM',
  nav: {
    panel: 'Panel',
    calendar: 'Calendario',
    subjects: 'Asignaturas',
    notes: 'Notas',
    more: 'Más',
  },
  placeholder: {
    comingIn: (milestone: string) => `Esta sección llega en ${milestone}.`,
  },
  status: {
    title: 'Estado del servidor',
    loading: 'Comprobando…',
    ok: 'Conectado',
    dbDown: 'Servidor activo, base de datos caída',
    error: 'No se puede contactar con el servidor',
  },
} as const;
