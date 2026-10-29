/** Solo rutas internas: evita redirigir a otro sitio con `//evil.example` o `https://...`. */
export function safeRedirect(from: unknown) {
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}

export function redirectTarget(state: unknown) {
  return safeRedirect((state as { from?: unknown } | null)?.from);
}
