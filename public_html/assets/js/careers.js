// Carga y cachea el catálogo público de carreras (GET /api/careers) y el curriculum
// de cada una (GET /api/careers/{code}/curriculum). No requiere sesión: reemplaza el
// viejo fetch a assets/data/*.json — la respuesta tiene la misma forma que esos JSON
// (modules[].subjects[].requirements.cursar/aprobar, etc.), más metadata.hasIntermediateTitle
// /intermediateTitle y los flags por materia onlyForIntermediate/requiredForIntermediateTitle.

import { api } from './apiClient.js';

let careersCache = null;
let careersInflight = null;
const curriculumCache = new Map();

export async function getCareers() {
  if (careersCache) return careersCache;
  if (careersInflight) return careersInflight;
  careersInflight = api.get('/careers')
    .then((res) => {
      careersCache = Array.isArray(res?.careers) ? res.careers : [];
      careersInflight = null;
      return careersCache;
    })
    .catch((err) => {
      careersInflight = null;
      console.error('No se pudo cargar el catálogo de carreras', err);
      return [];
    });
  return careersInflight;
}

export function findCareerByCode(careers, code) {
  if (!Array.isArray(careers) || !code) return null;
  return careers.find((c) => c.code === code) || null;
}

// El curriculum casi nunca cambia: se guarda también en localStorage para poder
// dibujar el tablero sin esperar a la red (stale-while-revalidate: se devuelve la
// copia local y se refresca en segundo plano para la próxima vez). Se cachea la
// Promise, no el resultado, para que dos llamadas simultáneas compartan el fetch.
const CURRICULUM_STORAGE_PREFIX = 'utn.curriculum.v1.';

function readStoredCurriculum(code) {
  try {
    const raw = localStorage.getItem(CURRICULUM_STORAGE_PREFIX + code);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function storeCurriculum(code, curriculum) {
  try { localStorage.setItem(CURRICULUM_STORAGE_PREFIX + code, JSON.stringify(curriculum)); } catch (e) { /* ignore */ }
}

function fetchCurriculum(code) {
  return api.get(`/careers/${encodeURIComponent(code)}/curriculum`).then((curriculum) => {
    storeCurriculum(code, curriculum);
    return curriculum;
  });
}

export function getCareerCurriculum(code) {
  if (!code) return Promise.resolve(null);
  if (curriculumCache.has(code)) return curriculumCache.get(code);

  const stored = readStoredCurriculum(code);
  let promise;
  if (stored) {
    promise = Promise.resolve(stored);
    fetchCurriculum(code)
      .then((fresh) => { curriculumCache.set(code, Promise.resolve(fresh)); })
      .catch(() => { /* se sigue usando la copia local */ });
  } else {
    promise = fetchCurriculum(code).catch((err) => {
      console.error(`No se pudo cargar el curriculum de la carrera '${code}'`, err);
      curriculumCache.delete(code);
      return null;
    });
  }
  curriculumCache.set(code, promise);
  return promise;
}

export function invalidateCareersCache() {
  careersCache = null;
  curriculumCache.clear();
}
