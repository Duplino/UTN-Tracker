// Mesas de final publicadas en el SIU Guaraní, para sugerir la fecha al cargar un
// final (en la agenda y en el modal de la materia). Son solo sugerencias: la fecha
// se puede escribir a mano igual.
//
// Vienen de GET /api/guarani-exam-dates (público, sirve también como invitado), que
// el servidor actualiza los lunes con bin/fetch-exam-dates.php. Se piden una vez por
// carga de la página y, si fallan, simplemente no se muestran sugerencias.

import { api } from './apiClient.js';

let inflight = null;

export function getGuaraniExamDates() {
  if (!inflight) {
    inflight = api.get('/guarani-exam-dates')
      .then(res => (Array.isArray(res?.examDates) ? res.examDates : []))
      .catch(err => {
        console.warn('No se pudieron cargar las fechas de Guaraní', err);
        inflight = null;
        return [];
      });
  }
  return inflight;
}

function isoToday(today) {
  const p = n => String(n).padStart(2, '0');
  return `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
}

// Mesas de una materia de hoy en adelante, una por fecha (el mismo día puede
// haber mesa Regular y Libre, o en las dos sedes), ordenadas.
export function suggestionsFor(list, subjectCode, today = new Date()) {
  const from = isoToday(today);
  const byDate = new Map();
  (Array.isArray(list) ? list : []).forEach(m => {
    if (!m || m.subjectCode !== subjectCode || !/^\d{4}-\d{2}-\d{2}$/.test(m.date || '') || m.date < from) return;
    const s = byDate.get(m.date) || { date: m.date, startTime: null, types: [], locations: [] };
    if (!s.startTime && m.startTime) s.startTime = m.startTime;
    if (m.inscriptionType && !s.types.includes(m.inscriptionType)) s.types.push(m.inscriptionType);
    if (m.location && !s.locations.includes(m.location)) s.locations.push(m.location);
    byDate.set(m.date, s);
  });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const chipFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' });

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function chipLabel(s) {
  const [y, m, d] = s.date.split('-').map(Number);
  return chipFmt.format(new Date(y, m - 1, d)).replace(/\./g, '');
}

export function chipTitle(s) {
  const parts = [];
  if (s.startTime) parts.push(`${s.startTime} h`);
  if (s.types.length) parts.push(s.types.join(' / '));
  if (s.locations.length) parts.push(s.locations.join(' / '));
  return parts.join(' · ');
}

// Botones para elegir la fecha. `taken`: fechas ya cargadas, que se muestran
// tachadas en vez de ofrecerlas de nuevo. Devuelve '' si no hay sugerencias.
export function suggestionsHtml(suggestions, taken = []) {
  if (!suggestions.length) return '';
  const chips = suggestions.map(s => {
    const used = taken.includes(s.date);
    return `<button type="button" class="btn btn-sm ${used ? 'btn-outline-secondary text-decoration-line-through' : 'btn-outline-primary'} guarani-date"
      data-date="${esc(s.date)}" title="${esc(chipTitle(s))}"${used ? ' disabled aria-disabled="true"' : ''}>${esc(chipLabel(s))}</button>`;
  }).join('');
  return `<div class="small text-body-secondary mb-1"><i class="bi bi-calendar-event" aria-hidden="true"></i> Mesas en Guaraní (sugeridas)</div>
    <div class="d-flex flex-wrap gap-1">${chips}</div>`;
}
