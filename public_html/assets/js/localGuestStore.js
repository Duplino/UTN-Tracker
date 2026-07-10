// Store para el modo invitado (sin sesión): persiste en localStorage con el MISMO shape
// que devuelve la API (ver EnrollmentRepository::hydrate en el backend), para que el resto
// de la app (modal, render, stats) pueda usar siempre la misma interfaz de "store" sin
// ramificar por estado de auth. Ver assets/js/apiStore.js para la contraparte remota.
//
// Claves de localStorage usadas:
//  - `subjectData:<planCode>:<subjectCode>` -> raw enrollment (ver `hydrate()` abajo)
//  - `electives` -> array JSON [{planCode, subjectCode, columnIndex}, ...]
//  - `preferences` -> objeto JSON (mismo shape que GET /api/preferences)

import { computeStatus } from './statusEngine.js';
import { getEvaluationSchemes, findSchemeByCode } from './evaluationSchemes.js';

const ENROLLMENT_PREFIX = 'subjectData:';
const ELECTIVES_KEY = 'electives';
const PREFERENCES_KEY = 'preferences';

const DEFAULT_SELECTED_STATS = ['horasSemanales', 'promedio', 'materiasAprobadas', 'finalesPendientes', 'materiasCursables'];

function nowIso() {
  return new Date().toISOString();
}

function enrollmentKey(planCode, subjectCode) {
  return `${ENROLLMENT_PREFIX}${planCode}:${subjectCode}`;
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

function readRawEnrollment(planCode, subjectCode) {
  return readJson(enrollmentKey(planCode, subjectCode), null);
}

function writeRawEnrollment(planCode, subjectCode, raw) {
  writeJson(enrollmentKey(planCode, subjectCode), raw);
}

async function hydrate(planCode, subjectCode, raw) {
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
    planCode,
    subjectCode,
    schemeCode: raw.schemeCode || null,
    schemeConfig: config,
    enrollmentYear: raw.enrollmentYear ?? new Date().getFullYear(),
    recursedCount: raw.recursedCount || 0,
    statusOverride: override,
    status,
    partials,
    finals,
    checklist,
    updatedAt: raw.updatedAt || nowIso(),
  };
}

function listAllEnrollmentRefs() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(ENROLLMENT_PREFIX)) continue;
    const rest = k.slice(ENROLLMENT_PREFIX.length);
    const sep = rest.indexOf(':');
    if (sep === -1) continue; // formato viejo (subjectData:<code>, sin plan) - se ignora
    out.push({ planCode: rest.slice(0, sep), subjectCode: rest.slice(sep + 1) });
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
    const refs = listAllEnrollmentRefs();
    const results = [];
    for (const { planCode, subjectCode } of refs) {
      const raw = readRawEnrollment(planCode, subjectCode);
      const hydrated = await hydrate(planCode, subjectCode, raw);
      if (hydrated) results.push(hydrated);
    }
    return results;
  },

  async getEnrollment(planCode, subjectCode) {
    const raw = readRawEnrollment(planCode, subjectCode);
    return hydrate(planCode, subjectCode, raw);
  },

  async createEnrollment(planCode, subjectCode, schemeCode) {
    if (readRawEnrollment(planCode, subjectCode)) {
      const err = new Error('already_enrolled');
      err.status = 409;
      throw err;
    }
    const raw = {
      schemeCode,
      enrollmentYear: new Date().getFullYear(),
      recursedCount: 0,
      statusOverride: null,
      partials: {},
      finals: [],
      checklist: {},
      updatedAt: nowIso(),
    };
    writeRawEnrollment(planCode, subjectCode, raw);
    return hydrate(planCode, subjectCode, raw);
  },

  async updateEnrollmentSettings(planCode, subjectCode, { schemeCode, enrollmentYear } = {}) {
    const raw = readRawEnrollment(planCode, subjectCode) || {
      schemeCode: null, enrollmentYear: new Date().getFullYear(), recursedCount: 0,
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
    writeRawEnrollment(planCode, subjectCode, raw);
    return hydrate(planCode, subjectCode, raw);
  },

  async recursar(planCode, subjectCode) {
    const raw = readRawEnrollment(planCode, subjectCode) || {
      schemeCode: null, enrollmentYear: new Date().getFullYear(), recursedCount: 0,
      statusOverride: null, partials: {}, finals: [], checklist: {},
    };
    raw.recursedCount = (raw.recursedCount || 0) + 1;
    raw.partials = {};
    raw.finals = [];
    raw.checklist = {};
    raw.statusOverride = null;
    raw.updatedAt = nowIso();
    writeRawEnrollment(planCode, subjectCode, raw);
    return hydrate(planCode, subjectCode, raw);
  },

  async setOverride(planCode, subjectCode, status) {
    const raw = readRawEnrollment(planCode, subjectCode) || {
      schemeCode: null, enrollmentYear: new Date().getFullYear(), recursedCount: 0,
      statusOverride: null, partials: {}, finals: [], checklist: {},
    };
    raw.statusOverride = status || null;
    raw.updatedAt = nowIso();
    writeRawEnrollment(planCode, subjectCode, raw);
    return hydrate(planCode, subjectCode, raw);
  },

  async saveResults(planCode, subjectCode, { partials, finals, checklist, clearOverride } = {}) {
    const raw = readRawEnrollment(planCode, subjectCode) || {
      schemeCode: null, enrollmentYear: new Date().getFullYear(), recursedCount: 0,
      statusOverride: null, partials: {}, finals: [], checklist: {},
    };
    raw.partials = partials || {};
    raw.finals = normalizeFinalsInput(finals);
    raw.checklist = checklist || {};
    if (clearOverride !== false) raw.statusOverride = null;
    raw.updatedAt = nowIso();
    writeRawEnrollment(planCode, subjectCode, raw);
    return hydrate(planCode, subjectCode, raw);
  },

  // No hay endpoint de "baja" en el backend (ver apiStore.dropEnrollment); en modo local
  // sí podemos borrar la clave completa, que es el comportamiento histórico de "Dar de baja".
  async dropEnrollment(planCode, subjectCode) {
    localStorage.removeItem(enrollmentKey(planCode, subjectCode));
  },

  // --- Electivas ---
  async getElectives() {
    const arr = readJson(ELECTIVES_KEY, []);
    return Array.isArray(arr) ? arr : [];
  },

  async setElective(planCode, subjectCode, columnIndex) {
    const arr = await this.getElectives();
    const idx = arr.findIndex((e) => e.planCode === planCode && e.subjectCode === subjectCode);
    const entry = { planCode, subjectCode, columnIndex };
    if (idx >= 0) arr[idx] = entry; else arr.push(entry);
    writeJson(ELECTIVES_KEY, arr);
  },

  async removeElective(planCode, subjectCode) {
    const arr = await this.getElectives();
    const next = arr.filter((e) => !(e.planCode === planCode && e.subjectCode === subjectCode));
    writeJson(ELECTIVES_KEY, next);
  },

  // --- Preferencias ---
  async getPreferences() {
    const defaults = {
      activePlanCode: 'k23',
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
