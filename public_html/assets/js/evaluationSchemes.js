// Carga y cachea la lista pública de esquemas de evaluación (GET /api/evaluation-schemes).
// No requiere sesión: tanto el store local (invitado) como el store remoto (API) la usan
// para poder elegir/mostrar el esquema de una materia.

import { api } from './apiClient.js';

let cache = null;
let inflight = null;

export async function getEvaluationSchemes() {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = api.get('/evaluation-schemes')
    .then((res) => {
      cache = Array.isArray(res?.schemes) ? res.schemes : [];
      inflight = null;
      return cache;
    })
    .catch((err) => {
      inflight = null;
      console.error('No se pudieron cargar los esquemas de evaluación', err);
      return [];
    });
  return inflight;
}

export function findSchemeByCode(schemes, code) {
  if (!Array.isArray(schemes) || !code) return null;
  return schemes.find((s) => s.code === code) || null;
}

// Permite forzar un refetch (por ejemplo, si se sospecha que el cache quedó viejo).
export function invalidateEvaluationSchemesCache() {
  cache = null;
}
