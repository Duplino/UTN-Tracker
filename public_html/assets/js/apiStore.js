// Store remoto: misma interfaz que localGuestStore.js pero pegándole a /api/* a través de
// apiClient.js (cookies de sesión, same-origin). Usado cuando GET /api/auth/me indica que
// hay una sesión activa.
//
// Las inscripciones (notas/checklist/override) están linkeadas a la MATERIA, no a la
// carrera — por eso sus métodos ya no reciben `careerCode`. Las electivas sí mantienen
// el scope por carrera (dónde se coloca visualmente una electiva es una decisión por
// carrera).

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

  async getEnrollment(subjectCode) {
    const all = await this.getEnrollments();
    return all.find((e) => e.subjectCode === subjectCode) || null;
  },

  async createEnrollment(subjectCode, schemeCode) {
    return api.post('/enrollments', { subjectCode, schemeCode });
  },

  async updateEnrollmentSettings(subjectCode, { schemeCode, enrollmentYear } = {}) {
    const body = {};
    if (schemeCode !== undefined && schemeCode !== null) body.schemeCode = schemeCode;
    if (enrollmentYear !== undefined && enrollmentYear !== null) body.enrollmentYear = enrollmentYear;
    return api.patch(`/enrollments/${enc(subjectCode)}`, body);
  },

  async recursar(subjectCode) {
    return api.post(`/enrollments/${enc(subjectCode)}/recursar`);
  },

  async setOverride(subjectCode, status) {
    return api.patch(`/enrollments/${enc(subjectCode)}/override`, { status: status ?? null });
  },

  async saveResults(subjectCode, { partials, finals, checklist, clearOverride } = {}) {
    const body = {
      partials: partials || {},
      finals: finals || {},
      checklist: checklist || {},
    };
    if (clearOverride === false) body.clearOverride = false;
    return api.put(`/enrollments/${enc(subjectCode)}/results`, body);
  },

  // El backend no expone un endpoint de "baja" real (no hay DELETE /enrollments).
  // Mejor aproximación disponible: resetear resultados y limpiar el override; la
  // inscripción sigue existiendo del lado del servidor mostrando "Faltan notas".
  async dropEnrollment(subjectCode) {
    await this.saveResults(subjectCode, { partials: {}, finals: {}, checklist: {}, clearOverride: true });
    return this.setOverride(subjectCode, null);
  },

  // --- Electivas (scope por carrera) ---
  async getElectives() {
    const res = await api.get('/electives');
    return Array.isArray(res?.placements) ? res.placements : [];
  },

  async setElective(careerCode, subjectCode, columnIndex) {
    await api.put(`/electives/${enc(careerCode)}/${enc(subjectCode)}`, { columnIndex });
  },

  async removeElective(careerCode, subjectCode) {
    await api.delete(`/electives/${enc(careerCode)}/${enc(subjectCode)}`);
  },

  // --- Carreras: en cuáles está anotado el usuario (el catálogo público de carreras
  // y su curriculum se leen directo de assets/js/careers.js, no dependen del store) ---
  async getUserCareers() {
    const res = await api.get('/user-careers');
    return Array.isArray(res?.careers) ? res.careers : [];
  },

  async enrollCareer(careerCode) {
    const res = await api.post('/user-careers', { careerCode });
    return Array.isArray(res?.careers) ? res.careers : [];
  },

  async unenrollCareer(careerCode) {
    await api.delete(`/user-careers/${enc(careerCode)}`);
  },

  async setShowIntermediateTitle(careerCode, value) {
    await api.patch(`/user-careers/${enc(careerCode)}`, { showIntermediateTitle: !!value });
  },

  // --- Preferencias ---
  async getPreferences() {
    return api.get('/preferences');
  },

  async updatePreferences(fields) {
    return api.patch('/preferences', fields || {});
  },
};
