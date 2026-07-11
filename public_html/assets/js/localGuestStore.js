// Store para el modo invitado (sin sesión): persiste en localStorage con el MISMO shape
// que devuelve la API (ver EnrollmentRepository::hydrate en el backend), para que el resto
// de la app (modal, render, stats) pueda usar siempre la misma interfaz de "store" sin
// ramificar por estado de auth. Ver assets/js/apiStore.js para la contraparte remota.
//
// Las inscripciones están linkeadas a la MATERIA, no a la carrera (una materia común
// aprobada cuenta para cualquier carrera que la incluya), por eso `subjectData:<code>`
// ya no lleva el código de carrera. Las electivas sí mantienen el scope por carrera.
//
// Claves de localStorage usadas:
//  - `subjectData:<subjectCode>` -> raw enrollment (ver `hydrate()` abajo)
//  - `subjectRetakes` -> objeto JSON { subjectCode: recursedCount, ... }. Separado
//    de `subjectData:<code>` a propósito: "recursar"/"dar de baja" borran esa clave
//    entera, pero el conteo de recursadas tiene que sobrevivir a eso.
//  - `electives` -> array JSON [{careerCode, subjectCode, columnIndex}, ...]
//  - `enrolledCareers` -> array JSON [{careerCode, showIntermediateTitle}, ...]
//  - `preferences` -> objeto JSON (mismo shape que GET /api/preferences)

import { computeStatus } from './statusEngine.js';
import { getEvaluationSchemes, findSchemeByCode } from './evaluationSchemes.js';
import { getCareers } from './careers.js';

const ENROLLMENT_PREFIX = 'subjectData:';
const RETAKES_KEY = 'subjectRetakes';
const ELECTIVES_KEY = 'electives';
const ENROLLED_CAREERS_KEY = 'enrolledCareers';
const PREFERENCES_KEY = 'preferences';

const DEFAULT_SELECTED_STATS = ['horasSemanales', 'promedio', 'materiasAprobadas', 'finalesPendientes', 'materiasCursables'];

function nowIso() {
  return new Date().toISOString();
}

function enrollmentKey(subjectCode) {
  return `${ENROLLMENT_PREFIX}${subjectCode}`;
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch (e) {
    console.warn(`Error leyendo '${key}' de localStorage`, e);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error(`Error guardando '${key}' en localStorage`, e);
  }
}

function readRawEnrollment(subjectCode) {
  return readJson(enrollmentKey(subjectCode), null);
}

function writeRawEnrollment(subjectCode, raw) {
  writeJson(enrollmentKey(subjectCode), raw);
}

function readRetakes() {
  return readJson(RETAKES_KEY, {});
}

function writeRetakes(map) {
  writeJson(RETAKES_KEY, map);
}

async function hydrate(subjectCode, raw) {
  if (!raw) return null;
  const schemes = await getEvaluationSchemes();
  const scheme = findSchemeByCode(schemes, raw.schemeCode);
  const config = scheme ? scheme.config : {};
  const partials = raw.partials || {};
  const finals = Array.isArray(raw.finals) ? raw.finals : [];
  const checklist = raw.checklist || {};
  const override = raw.statusOverride || null;
  const status = computeStatus(config, partials, finals, checklist, override);
  return {
    subjectCode,
    schemeCode: raw.schemeCode || null,
    schemeConfig: config,
    enrollmentYear: raw.enrollmentYear ?? new Date().getFullYear(),
    // Fuente de verdad: el mapa `subjectRetakes`, no `raw.recursedCount` — sobrevive
    // a recursar/dar de baja (que borran esta clave `raw` entera).
    recursedCount: readRetakes()[subjectCode] || 0,
    statusOverride: override,
    status,
    partials,
    finals,
    checklist,
    updatedAt: raw.updatedAt || nowIso(),
  };
}

function listAllEnrollmentCodes() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(ENROLLMENT_PREFIX)) continue;
    const rest = k.slice(ENROLLMENT_PREFIX.length);
    if (rest.includes(':')) continue; // formato viejo (subjectData:<plan>:<code>) - se ignora
    out.push(rest);
  }
  return out;
}

function normalizeFinalsInput(finals) {
  // Acepta el mismo shape que el body de PUT /results: {"1": {"grade":7,"examDate":"..."}, ...}
  const obj = finals || {};
  return Object.keys(obj)
    .map((k) => ({
      attemptNumber: parseInt(k, 10),
      grade: obj[k] && obj[k].grade !== undefined ? obj[k].grade : null,
      examDate: obj[k] && obj[k].examDate !== undefined ? obj[k].examDate : null,
    }))
    .filter((f) => Number.isFinite(f.attemptNumber))
    .sort((a, b) => a.attemptNumber - b.attemptNumber);
}

export const localGuestStore = {
  kind: 'local',

  async getEnrollments() {
    const codes = listAllEnrollmentCodes();
    const results = [];
    for (const subjectCode of codes) {
      const raw = readRawEnrollment(subjectCode);
      const hydrated = await hydrate(subjectCode, raw);
      if (hydrated) results.push(hydrated);
    }
    return results;
  },

  async getEnrollment(subjectCode) {
    const raw = readRawEnrollment(subjectCode);
    return hydrate(subjectCode, raw);
  },

  async createEnrollment(subjectCode, schemeCode) {
    if (readRawEnrollment(subjectCode)) {
      const err = new Error('already_enrolled');
      err.status = 409;
      throw err;
    }
    const raw = {
      schemeCode,
      enrollmentYear: new Date().getFullYear(),
      statusOverride: null,
      partials: {},
      finals: [],
      checklist: {},
      updatedAt: nowIso(),
    };
    writeRawEnrollment(subjectCode, raw);
    return hydrate(subjectCode, raw);
  },

  async updateEnrollmentSettings(subjectCode, { schemeCode, enrollmentYear } = {}) {
    const raw = readRawEnrollment(subjectCode) || {
      schemeCode: null, enrollmentYear: new Date().getFullYear(),
      statusOverride: null, partials: {}, finals: [], checklist: {},
    };
    if (schemeCode !== undefined && schemeCode !== null && schemeCode !== raw.schemeCode) {
      raw.schemeCode = schemeCode;
      // Mismo criterio que el backend: cambiar de esquema borra los resultados cargados.
      raw.partials = {};
      raw.finals = [];
      raw.checklist = {};
    }
    if (enrollmentYear !== undefined && enrollmentYear !== null) {
      raw.enrollmentYear = enrollmentYear;
    }
    raw.updatedAt = nowIso();
    writeRawEnrollment(subjectCode, raw);
    return hydrate(subjectCode, raw);
  },

  // Recursar borra la inscripción entera (vuelve a "disponible para cursar") y suma
  // 1 al conteo persistente `subjectRetakes`, que sobrevive a esa baja. Devuelve un
  // objeto liviano (no un enrollment hidratado, porque ya no queda ninguno), mismo
  // shape que la contraparte remota (ver apiStore.recursar).
  async recursar(subjectCode) {
    localStorage.removeItem(enrollmentKey(subjectCode));
    const retakes = readRetakes();
    retakes[subjectCode] = (retakes[subjectCode] || 0) + 1;
    writeRetakes(retakes);
    return { subjectCode, recursedCount: retakes[subjectCode], enrolled: false };
  },

  async setOverride(subjectCode, status) {
    const raw = readRawEnrollment(subjectCode) || {
      schemeCode: null, enrollmentYear: new Date().getFullYear(),
      statusOverride: null, partials: {}, finals: [], checklist: {},
    };
    raw.statusOverride = status || null;
    raw.updatedAt = nowIso();
    writeRawEnrollment(subjectCode, raw);
    return hydrate(subjectCode, raw);
  },

  async saveResults(subjectCode, { partials, finals, checklist, clearOverride } = {}) {
    const raw = readRawEnrollment(subjectCode) || {
      schemeCode: null, enrollmentYear: new Date().getFullYear(),
      statusOverride: null, partials: {}, finals: [], checklist: {},
    };
    raw.partials = partials || {};
    raw.finals = normalizeFinalsInput(finals);
    raw.checklist = checklist || {};
    if (clearOverride !== false) raw.statusOverride = null;
    raw.updatedAt = nowIso();
    writeRawEnrollment(subjectCode, raw);
    return hydrate(subjectCode, raw);
  },

  // Baja completa: borra la clave entera, la materia vuelve a verse como "no
  // iniciada". A propósito NO toca `subjectRetakes` (el conteo de recursadas
  // persiste, no se pierde por dar de baja).
  async dropEnrollment(subjectCode) {
    localStorage.removeItem(enrollmentKey(subjectCode));
  },

  // --- Conteo de recursadas (independiente de la inscripción activa) ---
  async getSubjectRetakes() {
    return readRetakes();
  },

  async setRecursedCount(subjectCode, recursedCount) {
    const retakes = readRetakes();
    retakes[subjectCode] = Math.max(0, recursedCount);
    writeRetakes(retakes);
    return { subjectCode, recursedCount: retakes[subjectCode] };
  },

  // --- Electivas (scope por carrera) ---
  async getElectives() {
    const arr = readJson(ELECTIVES_KEY, []);
    return Array.isArray(arr) ? arr : [];
  },

  async setElective(careerCode, subjectCode, columnIndex) {
    const arr = await this.getElectives();
    const idx = arr.findIndex((e) => e.careerCode === careerCode && e.subjectCode === subjectCode);
    const entry = { careerCode, subjectCode, columnIndex };
    if (idx >= 0) arr[idx] = entry; else arr.push(entry);
    writeJson(ELECTIVES_KEY, arr);
  },

  async removeElective(careerCode, subjectCode) {
    const arr = await this.getElectives();
    const next = arr.filter((e) => !(e.careerCode === careerCode && e.subjectCode === subjectCode));
    writeJson(ELECTIVES_KEY, next);
  },

  // --- Carreras: en cuáles está "anotado" el invitado (local nada más). Si todavía no
  // eligió ninguna, se auto-anota en todas las carreras del catálogo (hoy solo hay una)
  // para no romper la experiencia de quien ya usaba la app antes de esta feature. ---
  async getUserCareers() {
    let list = readJson(ENROLLED_CAREERS_KEY, null);
    if (!Array.isArray(list) || list.length === 0) {
      const catalog = await getCareers();
      list = catalog.map((c) => ({ careerCode: c.code, showIntermediateTitle: false }));
      writeJson(ENROLLED_CAREERS_KEY, list);
    }
    const catalog = await getCareers();
    return list
      .map((entry) => {
        const career = catalog.find((c) => c.code === entry.careerCode);
        if (!career) return null;
        return {
          code: career.code,
          name: career.name,
          hasIntermediateTitle: career.hasIntermediateTitle,
          intermediateTitle: career.intermediateTitle,
          showIntermediateTitle: !!entry.showIntermediateTitle,
        };
      })
      .filter(Boolean);
  },

  async enrollCareer(careerCode) {
    const list = readJson(ENROLLED_CAREERS_KEY, []);
    if (!list.some((e) => e.careerCode === careerCode)) {
      list.push({ careerCode, showIntermediateTitle: false });
      writeJson(ENROLLED_CAREERS_KEY, list);
    }
    return this.getUserCareers();
  },

  async unenrollCareer(careerCode) {
    const list = readJson(ENROLLED_CAREERS_KEY, []);
    writeJson(ENROLLED_CAREERS_KEY, list.filter((e) => e.careerCode !== careerCode));
  },

  async setShowIntermediateTitle(careerCode, value) {
    const list = readJson(ENROLLED_CAREERS_KEY, []);
    const idx = list.findIndex((e) => e.careerCode === careerCode);
    if (idx >= 0) {
      list[idx].showIntermediateTitle = !!value;
      writeJson(ENROLLED_CAREERS_KEY, list);
    }
  },

  // --- Preferencias ---
  async getPreferences() {
    const defaults = {
      activeCareerCode: null,
      showCorrelativas: true,
      showStatus: false,
      viewMode: 'grid',
      selectedStats: DEFAULT_SELECTED_STATS.slice(),
      yearStarted: null,
      isPublic: false,
      shareToken: null,
    };
    const stored = readJson(PREFERENCES_KEY, {});
    return { ...defaults, ...stored };
  },

  async updatePreferences(fields) {
    const current = await this.getPreferences();
    const next = { ...current, ...(fields || {}) };
    // El modo invitado no puede publicar un tablero público (requiere backend/sesión).
    next.isPublic = false;
    next.shareToken = null;
    writeJson(PREFERENCES_KEY, next);
    return next;
  },
};
