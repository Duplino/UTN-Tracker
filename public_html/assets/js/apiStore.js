// Store remoto: misma interfaz que localGuestStore.js pero pegándole a /api/* a través de
// apiClient.js (cookies de sesión, same-origin). Usado cuando GET /api/auth/me indica que
// hay una sesión activa.

import { api } from './apiClient.js';

function enc(v) {
  return encodeURIComponent(v);
}

export const apiStore = {
  kind: 'api',

  async getEnrollments() {
    const res = await api.get('/enrollments');
    return Array.isArray(res?.enrollments) ? res.enrollments : [];
  },

  async getEnrollment(planCode, subjectCode) {
    const all = await this.getEnrollments();
    return all.find((e) => e.planCode === planCode && e.subjectCode === subjectCode) || null;
  },

  async createEnrollment(planCode, subjectCode, schemeCode) {
    return api.post('/enrollments', { planCode, subjectCode, schemeCode });
  },

  async updateEnrollmentSettings(planCode, subjectCode, { schemeCode, enrollmentYear } = {}) {
    const body = {};
    if (schemeCode !== undefined && schemeCode !== null) body.schemeCode = schemeCode;
    if (enrollmentYear !== undefined && enrollmentYear !== null) body.enrollmentYear = enrollmentYear;
    return api.patch(`/enrollments/${enc(planCode)}/${enc(subjectCode)}`, body);
  },

  async recursar(planCode, subjectCode) {
    return api.post(`/enrollments/${enc(planCode)}/${enc(subjectCode)}/recursar`);
  },

  async setOverride(planCode, subjectCode, status) {
    return api.patch(`/enrollments/${enc(planCode)}/${enc(subjectCode)}/override`, { status: status ?? null });
  },

  async saveResults(planCode, subjectCode, { partials, finals, checklist, clearOverride } = {}) {
    const body = {
      partials: partials || {},
      finals: finals || {},
      checklist: checklist || {},
    };
    if (clearOverride === false) body.clearOverride = false;
    return api.put(`/enrollments/${enc(planCode)}/${enc(subjectCode)}/results`, body);
  },

  // El backend no expone un endpoint de "baja" real (no hay DELETE /enrollments).
  // Mejor aproximación disponible: resetear resultados y limpiar el override; la
  // inscripción sigue existiendo del lado del servidor mostrando "Faltan notas".
  async dropEnrollment(planCode, subjectCode) {
    await this.saveResults(planCode, subjectCode, { partials: {}, finals: {}, checklist: {}, clearOverride: true });
    return this.setOverride(planCode, subjectCode, null);
  },

  // --- Electivas ---
  async getElectives() {
    const res = await api.get('/electives');
    return Array.isArray(res?.placements) ? res.placements : [];
  },

  async setElective(planCode, subjectCode, columnIndex) {
    await api.put(`/electives/${enc(planCode)}/${enc(subjectCode)}`, { columnIndex });
  },

  async removeElective(planCode, subjectCode) {
    await api.delete(`/electives/${enc(planCode)}/${enc(subjectCode)}`);
  },

  // --- Preferencias ---
  async getPreferences() {
    return api.get('/preferences');
  },

  async updatePreferences(fields) {
    return api.patch('/preferences', fields || {});
  },
};
