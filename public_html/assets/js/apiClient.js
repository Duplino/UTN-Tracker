// Cliente HTTP delgado para /api. Same-origin: usa cookies de sesión
// (credentials:'include'), sin necesidad de CORS ni tokens en el cliente.

class ApiError extends Error {
  constructor(status, body) {
    super(body?.error || `api_error_${status}`);
    this.status = status;
    this.body = body;
  }
}

// Escrituras (todo lo que no es GET): cuántas hay en vuelo y cuántas empezaron en
// total. syncFromServer() lo usa para descartar una respuesta de /bootstrap que salió
// antes de una escritura y por eso trae datos viejos (ver index.js).
const writes = { pending: 0, started: 0 };
let writesIdle = [];

export function writeState() {
  return { pending: writes.pending, started: writes.started };
}

// Se resuelve cuando no queda ninguna escritura en vuelo.
export function whenWritesIdle() {
  if (writes.pending === 0) return Promise.resolve();
  return new Promise((resolve) => writesIdle.push(resolve));
}

async function request(method, path, body) {
  if (method === 'GET') return send(method, path, body);
  writes.pending++;
  writes.started++;
  try {
    return await send(method, path, body);
  } finally {
    writes.pending--;
    if (writes.pending === 0) {
      const waiting = writesIdle;
      writesIdle = [];
      waiting.forEach((resolve) => resolve());
    }
  }
}

async function send(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return null;
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(res.status, data);
  }

  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  patch: (path, body) => request('PATCH', path, body ?? {}),
  delete: (path) => request('DELETE', path),
};

export { ApiError };
