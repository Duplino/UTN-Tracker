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

export async function getCareerCurriculum(code) {
  if (!code) return null;
  if (curriculumCache.has(code)) return curriculumCache.get(code);
  try {
    const curriculum = await api.get(`/careers/${encodeURIComponent(code)}/curriculum`);
    curriculumCache.set(code, curriculum);
    return curriculum;
  } catch (err) {
    console.error(`No se pudo cargar el curriculum de la carrera '${code}'`, err);
    return null;
  }
}

export function invalidateCareersCache() {
  careersCache = null;
  curriculumCache.clear();
}
