// Agenda: fechas de parciales (con su instancia) y de finales.
//
// Se cargan con dos desplegables: el examen (Parcial 1..n según el esquema de
// evaluación de la materia, o Final) y la instancia (primera fecha o uno de los
// recuperatorios). Cualquier instancia se puede cargar aunque no haga falta
// rendirla: las fechas de recuperatorios se suelen dar todas a principio de año.
//
// Las fechas viven en el store activo (GET/POST/DELETE /api/exam-dates con sesión,
// localStorage como invitado) y se leen recién al abrir la agenda. Si la nota de
// esa instancia ya está cargada en la materia, se muestra al lado de la fecha.

import { toastError, setBusy } from './ui.js';

const APPROVED = ['Aprobada', 'Promocionada'];
export const ATTEMPT_LABELS = { 1: 'Primera fecha', 2: '1er recuperatorio', 3: '2do recuperatorio' };
const MAX_ATTEMPT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

// --- Fechas ---

// 'YYYY-MM-DD' como fecha local (new Date('YYYY-MM-DD') la toma en UTC y en
// Argentina cae el día anterior).
export function parseDate(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str || ''));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

export function daysUntil(dateStr, today = new Date()) {
  const d = parseDate(dateStr);
  if (!d) return null;
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - t) / DAY_MS);
}

export function relativeLabel(days) {
  if (days === null || days === undefined) return '';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  if (days === -1) return 'Ayer';
  if (days > 0) return days < 14 ? `En ${days} días` : `En ${Math.round(days / 7)} semanas`;
  return -days < 14 ? `Hace ${-days} días` : `Hace ${Math.round(-days / 7)} semanas`;
}

// --- Entradas ---

export function examLabel(entry) {
  if (!entry) return '';
  if (entry.kind === 'final') return 'Final';
  const attempt = ATTEMPT_LABELS[entry.attemptNumber] || `Instancia ${entry.attemptNumber}`;
  return `Parcial ${entry.partialNumber} · ${attempt}`;
}

// Próximas (de hoy en adelante, la más cercana primero) y pasadas (la más
// reciente primero).
export function splitAgenda(entries, today = new Date()) {
  const withDays = (Array.isArray(entries) ? entries : [])
    .map(e => ({ ...e, days: daysUntil(e.date, today) }))
    .filter(e => e.days !== null);
  const order = (a, b) => a.days - b.days || examOrder(a) - examOrder(b);
  return {
    upcoming: withDays.filter(e => e.days >= 0).sort(order),
    past: withDays.filter(e => e.days < 0).sort((a, b) => order(b, a)),
  };
}

function examOrder(e) {
  return e.kind === 'final' ? 1000 : (e.partialNumber || 0) * 10 + (e.attemptNumber || 0);
}

// Nota ya cargada en la materia para esa instancia (o null).
export function gradeFor(entry, enrollment) {
  if (!entry || !enrollment) return null;
  if (entry.kind === 'final') {
    const f = (Array.isArray(enrollment.finals) ? enrollment.finals : []).find(x => x && x.examDate === entry.date);
    return f && f.grade !== null && f.grade !== undefined ? f.grade : null;
  }
  const attempts = (enrollment.partials || {})[entry.partialNumber] || {};
  const v = attempts[entry.attemptNumber];
  return v === null || v === undefined ? null : v;
}

// Materias que se pueden elegir: las que tienen inscripción y todavía no están
// aprobadas (cursando o con el final pendiente).
export function subjectOptions(enrollments, nameOf = c => c) {
  return (Array.isArray(enrollments) ? enrollments : [])
    .filter(e => e && e.subjectCode && !APPROVED.includes(e.status))
    .map(e => ({ code: e.subjectCode, name: nameOf(e.subjectCode) || e.subjectCode, partials: partialCount(e) }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

function partialCount(enrollment) {
  const n = enrollment && enrollment.schemeConfig ? enrollment.schemeConfig.partials : undefined;
  return Number.isInteger(n) && n >= 0 ? n : 2;
}

// ¿Hay que cargar la nota de esta fecha (ya pasada)? No, si la materia ya está
// aprobada, si la nota ya está o si no hay inscripción donde guardarla. Un
// recuperatorio solo cuenta si la instancia anterior tiene nota y no alcanzó
// para regularizar: si aprobaste el parcial, el recuperatorio no se rindió.
export function needsGrade(entry, enrollment) {
  if (!entry || !enrollment || APPROVED.includes(enrollment.status)) return false;
  if (gradeFor(entry, enrollment) !== null) return false;
  if (entry.kind === 'final' || entry.attemptNumber <= 1) return true;
  const prev = gradeFor({ ...entry, attemptNumber: entry.attemptNumber - 1 }, enrollment);
  const minNote = enrollment.schemeConfig?.regularization?.min_note ?? 6;
  return prev !== null && prev < minNote;
}

// Resultados de la inscripción con la nota de esta fecha agregada, con el shape
// del body de PUT /results. Un final va en la mesa con esa fecha o, si no hay
// ninguna, en la siguiente libre.
export function resultsWithGrade(enrollment, entry, grade) {
  const partials = {};
  Object.entries(enrollment.partials || {}).forEach(([p, attempts]) => { partials[p] = { ...attempts }; });
  const finals = {};
  (Array.isArray(enrollment.finals) ? enrollment.finals : []).forEach(f => {
    if (f) finals[f.attemptNumber] = { grade: f.grade ?? null, examDate: f.examDate ?? null };
  });
  if (entry.kind === 'final') {
    const same = Object.keys(finals).find(k => finals[k].examDate === entry.date);
    const attempt = same || String(Object.keys(finals).reduce((max, k) => Math.max(max, Number(k)), 0) + 1);
    finals[attempt] = { grade, examDate: entry.date };
  } else {
    partials[entry.partialNumber] = { ...(partials[entry.partialNumber] || {}), [entry.attemptNumber]: grade };
  }
  return { partials, finals, checklist: enrollment.checklist || {} };
}

// Después de agregar un parcial, el formulario pasa a la instancia siguiente
// para cargar el cronograma de una materia de un tirón.
export function nextInstance(partialNumber, attemptNumber, partials) {
  if (attemptNumber < MAX_ATTEMPT) return { partialNumber, attemptNumber: attemptNumber + 1 };
  if (partialNumber < partials) return { partialNumber: partialNumber + 1, attemptNumber: 1 };
  return { partialNumber, attemptNumber };
}

// --- UI ---

const monthFmt = new Intl.DateTimeFormat('es-AR', { month: 'short' });
const weekdayFmt = new Intl.DateTimeFormat('es-AR', { weekday: 'short' });

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ctx: { getStore, getEnrollments, getEnrollment(code), getSubjectName(code),
//        saveResults(code, results) -> guarda las notas y actualiza el tablero }
export function initAgenda(ctx) {
  const modalEl = document.getElementById('agendaModal');
  if (!modalEl) return;
  const form = document.getElementById('agenda-form');
  const subjectSel = document.getElementById('agenda-subject');
  const examSel = document.getElementById('agenda-exam');
  const attemptSel = document.getElementById('agenda-attempt');
  const attemptWrap = document.getElementById('agenda-attempt-wrap');
  const dateInput = document.getElementById('agenda-date');
  const submitBtn = document.getElementById('agenda-submit');
  const listEl = document.getElementById('agenda-list');
  const emptyFormEl = document.getElementById('agenda-no-subjects');

  let entries = [];
  let options = [];

  attemptSel.innerHTML = Object.entries(ATTEMPT_LABELS)
    .map(([v, label]) => `<option value="${v}">${label}</option>`).join('');

  function selectedSubject() {
    return options.find(o => o.code === subjectSel.value) || null;
  }

  function renderExamOptions(keep) {
    const subject = selectedSubject();
    const n = subject ? subject.partials : 0;
    let html = '';
    for (let p = 1; p <= n; p++) html += `<option value="${p}">Parcial ${p}</option>`;
    html += '<option value="final">Final</option>';
    examSel.innerHTML = html;
    if (keep && [...examSel.options].some(o => o.value === keep)) examSel.value = keep;
    syncAttempt();
  }

  function syncAttempt() {
    const isFinal = examSel.value === 'final';
    attemptWrap.classList.toggle('d-none', isFinal);
    attemptSel.disabled = isFinal;
  }

  function renderForm() {
    const prev = subjectSel.value;
    options = subjectOptions(ctx.getEnrollments(), ctx.getSubjectName);
    subjectSel.innerHTML = options.map(o => `<option value="${esc(o.code)}">${esc(o.name)}</option>`).join('');
    if (options.some(o => o.code === prev)) subjectSel.value = prev;
    const empty = options.length === 0;
    form.classList.toggle('d-none', empty);
    emptyFormEl.classList.toggle('d-none', !empty);
    renderExamOptions(examSel.value);
  }

  function rowHtml(e, pending = false) {
    const d = parseDate(e.date);
    const grade = gradeFor(e, ctx.getEnrollment(e.subjectCode));
    const soon = e.days >= 0 && e.days <= 7;
    const name = ctx.getSubjectName(e.subjectCode) || e.subjectCode;
    return `
      <li class="list-group-item agenda-item d-flex align-items-center gap-2 gap-sm-3${e.days < 0 && !pending ? ' agenda-past' : ''}">
        <div class="agenda-date text-center">
          <div class="agenda-date-day">${d.getDate()}</div>
          <div class="agenda-date-month">${esc(monthFmt.format(d).replace('.', ''))}</div>
          <div class="agenda-date-weekday">${esc(weekdayFmt.format(d).replace('.', ''))}</div>
        </div>
        <div class="flex-grow-1 min-w-0">
          <div class="fw-semibold">${esc(name)}</div>
          <div class="small text-body-secondary">${esc(examLabel(e))}</div>
        </div>
        ${pending ? `
        <form class="agenda-grade d-flex align-items-center gap-1 flex-shrink-0" data-id="${esc(e.id)}">
          <input type="number" min="1" max="10" step="1" class="form-control form-control-sm" placeholder="Nota" aria-label="Nota de ${esc(examLabel(e))}" required>
          <button type="submit" class="btn btn-sm btn-outline-primary">Guardar</button>
        </form>` : `
        <div class="d-flex flex-column flex-sm-row align-items-end align-items-sm-center gap-1 gap-sm-2 flex-shrink-0">
          <span class="badge rounded-pill ${soon ? 'text-bg-warning' : 'bg-body-secondary text-body border'}">${esc(relativeLabel(e.days))}</span>
          ${grade !== null ? `<span class="badge text-bg-secondary">Nota ${esc(grade)}</span>` : ''}
        </div>`}
        <button type="button" class="btn btn-sm btn-icon" data-action="delete" data-id="${esc(e.id)}" title="Borrar fecha" aria-label="Borrar fecha">
          <i class="bi bi-trash" aria-hidden="true"></i>
        </button>
      </li>`;
  }

  function renderList() {
    const pastOpen = !!listEl.querySelector('details[open]');
    const { upcoming, past } = splitAgenda(entries);
    if (!upcoming.length && !past.length) {
      listEl.innerHTML = '<p class="text-body-secondary text-center my-4">Todavía no cargaste fechas.</p>';
      return;
    }
    let html = '<h6 class="mt-3">Próximas</h6>';
    html += upcoming.length
      ? `<ul class="list-group">${upcoming.map(e => rowHtml(e)).join('')}</ul>`
      : '<p class="small text-body-secondary">No hay fechas por delante.</p>';
    // Las pasadas sin nota van aparte y a la vista (en orden cronológico), para
    // cargarlas todas juntas.
    const missing = past.filter(e => needsGrade(e, ctx.getEnrollment(e.subjectCode))).reverse();
    const rest = past.filter(e => !missing.includes(e));
    if (missing.length) {
      html += `<h6 class="mt-3">Falta cargar la nota <span class="badge rounded-pill text-bg-danger align-text-top">${missing.length}</span></h6>
        <ul class="list-group">${missing.map(e => rowHtml(e, true)).join('')}</ul>`;
    }
    if (rest.length) {
      html += `<details class="mt-3"${pastOpen ? ' open' : ''}><summary class="small text-body-secondary">Pasadas (${rest.length})</summary>
        <ul class="list-group mt-2">${rest.map(e => rowHtml(e)).join('')}</ul></details>`;
    }
    listEl.innerHTML = html;
  }

  subjectSel.addEventListener('change', () => renderExamOptions(examSel.value));
  examSel.addEventListener('change', syncAttempt);

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const subject = selectedSubject();
    if (!subject) return;
    if (!dateInput.value) { dateInput.reportValidity(); return; }
    const isFinal = examSel.value === 'final';
    const payload = {
      subjectCode: subject.code,
      kind: isFinal ? 'final' : 'parcial',
      partialNumber: isFinal ? null : Number(examSel.value),
      attemptNumber: isFinal ? null : Number(attemptSel.value),
      date: dateInput.value,
    };
    setBusy(submitBtn, true);
    try {
      const saved = await ctx.getStore().saveExamDate(payload);
      entries = entries.filter(e => e.id !== saved.id).concat(saved);
      renderList();
      dateInput.value = '';
      if (!isFinal) {
        const next = nextInstance(payload.partialNumber, payload.attemptNumber, subject.partials);
        examSel.value = String(next.partialNumber);
        attemptSel.value = String(next.attemptNumber);
      }
      dateInput.focus();
    } catch (err) {
      toastError('No se pudo guardar la fecha', err);
    } finally {
      setBusy(submitBtn, false);
    }
  });

  listEl.addEventListener('click', async (ev) => {
    const btn = ev.target.closest('[data-action="delete"]');
    if (!btn) return;
    const entry = entries.find(e => String(e.id) === btn.dataset.id);
    if (!entry) return;
    btn.disabled = true;
    try {
      await ctx.getStore().deleteExamDate(entry.id);
      entries = entries.filter(e => e !== entry);
      renderList();
    } catch (err) {
      btn.disabled = false;
      toastError('No se pudo borrar la fecha', err);
    }
  });

  listEl.addEventListener('submit', async (ev) => {
    const gradeForm = ev.target.closest('form.agenda-grade');
    if (!gradeForm) return;
    ev.preventDefault();
    const entry = entries.find(e => String(e.id) === gradeForm.dataset.id);
    const enrollment = entry ? ctx.getEnrollment(entry.subjectCode) : null;
    const input = gradeForm.querySelector('input');
    const grade = Number(input.value);
    if (!entry || !enrollment) return;
    if (!Number.isInteger(grade) || grade < 1 || grade > 10) { input.reportValidity(); return; }
    const btn = gradeForm.querySelector('button');
    setBusy(btn, true);
    try {
      await ctx.saveResults(entry.subjectCode, resultsWithGrade(enrollment, entry, grade));
      renderList();
      const next = listEl.querySelector('form.agenda-grade input');
      if (next) next.focus();
    } catch (err) {
      setBusy(btn, false);
      toastError('No se pudo guardar la nota', err);
    }
  });

  modalEl.addEventListener('show.bs.modal', async () => {
    renderForm();
    listEl.innerHTML = '<div class="d-flex justify-content-center p-4"><div class="spinner-border text-secondary" role="status"><span class="visually-hidden">Cargando…</span></div></div>';
    try {
      entries = await ctx.getStore().getExamDates();
    } catch (err) {
      entries = [];
      toastError('No se pudo cargar tu agenda', err);
    }
    renderList();
  });
}
