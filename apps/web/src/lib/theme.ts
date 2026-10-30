/** Tema elegido en "Mas > Apariencia". Se guarda por dispositivo: en el movil puedes querer otro. */
export const THEMES = ['system', 'light', 'dark'] as const;
export type Theme = (typeof THEMES)[number];

const STORAGE_KEY = 'organizador.theme';

const isTheme = (value: unknown): value is Theme =>
  typeof value === 'string' && (THEMES as readonly string[]).includes(value);

export function storedTheme(): Theme {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(value) ? value : 'system';
  } catch {
    // Modo privado o almacenamiento bloqueado: se sigue al sistema.
    return 'system';
  }
}

/** `system` quita el atributo y manda `prefers-color-scheme` (ver index.css). */
export function applyTheme(theme: Theme) {
  if (theme === 'system') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = theme;
}

export function saveTheme(theme: Theme) {
  applyTheme(theme);
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sin almacenamiento el tema dura hasta recargar: no es grave.
  }
}
