// Copia local de la última respuesta de GET /api/bootstrap (solo usuarios con
// sesión), para dibujar el tablero al instante al abrir la app y revalidar contra
// el servidor en segundo plano. No es la fuente de verdad: si el servidor dice otra
// cosa, gana el servidor. Se borra al cerrar sesión.

const KEY = 'utn.bootstrap.v1';

export function readBootCache() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    return data && data.authenticated && data.user ? data : null;
  } catch (e) {
    return null;
  }
}

export function writeBootCache(data) {
  try {
    if (data && data.authenticated) localStorage.setItem(KEY, JSON.stringify(data));
  } catch (e) {
    // Cuota llena o storage bloqueado: la app funciona igual, solo sin arranque instantáneo.
  }
}

export function clearBootCache() {
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
}
