// Planificador de cuatrimestres: "¿qué puedo cursar el próximo cuatrimestre?",
// simulación de cuatrimestres futuros según correlativas y fecha estimada de egreso.
//
// La simulación no toca las inscripciones reales. Supone que:
//  - lo que hoy está en curso queda regularizado al empezar el primer cuatrimestre
//    a planificar;
//  - lo planificado en un cuatrimestre queda regularizado al terminarlo (las anuales
//    ocupan ese cuatrimestre y el siguiente);
//  - el final se aprueba `lag` cuatrimestres después de regularizar (configurable).
//
// Los cuatrimestres se manejan como un número absoluto (año*2 + 0/1), así la
// simulación funciona aunque el plan tenga huecos entre cuatrimestres.
//
// El plan se guarda por carrera en las preferencias del usuario (`semesterPlans`,
// un mapa { codigoCarrera: { lag, terms: [{ year, half, subjects: [codigos] }] } }).

import { toastError, confirmDialog } from './ui.js';

const APPROVED = ['Aprobada', 'Promocionada'];
const NEVER = Infinity;
const DEFAULT_LAG = 1;
// Resultado supuesto de una materia que se está cursando ahora. Al hacer click se
// pasa al siguiente; 'regular' es el valor por defecto (no se guarda).
const OUTCOMES = ['approved', 'regular', 'failed'];
const DEFAULT_OUTCOME = 'regular';
const OUTCOME_LABELS = { approved: 'Aprobada', regular: 'Regularizada', failed: 'Desaprobada' };
const LAG_OPTIONS = [
  { value: 0, label: 'al terminar de cursarlas' },
  { value: 1, label: 'un cuatrimestre después' },
  { value: 2, label: 'dos cuatrimestres después' },
];

// --- Cuatrimestres ---

export function termNumber(year, half) {
  return year * 2 + (half - 1);
}

function termYear(t) { return Math.floor(t / 2); }
function termHalf(t) { return (t % 2) + 1; }

export function termLabel(t) {
  return `${termHalf(t)}C ${termYear(t)}`;
}

function termLongLabel(t) {
  return `${termHalf(t) === 1 ? 'Primer' : 'Segundo'} cuatrimestre ${termYear(t)}`;
}

// Próximo cuatrimestre a planificar: en enero/febrero todavía no arrancó el
// primero; de marzo a julio se está cursando el primero; de agosto en adelante,
// el segundo.
export function nextTerm(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  if (m <= 2) return termNumber(y, 1);
  if (m <= 7) return termNumber(y, 2);
  return termNumber(y + 1, 1);
}

// --- Plan guardado ---
// { lag, terms: [{ year, half, subjects }], current: { codigo: 'approved' | 'failed' } }

export function normalizePlan(raw) {
  const plan = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const lag = LAG_OPTIONS.some(o => o.value === plan.lag) ? plan.lag : DEFAULT_LAG;
  const seen = new Set();
  const terms = (Array.isArray(plan.terms) ? plan.terms : [])
    .filter(t => t && Number.isInteger(t.year) && (t.half === 1 || t.half === 2))
    .map(t => ({ year: t.year, half: t.half, subjects: (Array.isArray(t.subjects) ? t.subjects : []).filter(c => typeof c === 'string') }))
    .filter(t => {
      const n = termNumber(t.year, t.half);
      if (seen.has(n)) return false;
      seen.add(n);
      return true;
    })
    .sort((a, b) => termNumber(a.year, a.half) - termNumber(b.year, b.half));
  const current = {};
  if (plan.current && typeof plan.current === 'object' && !Array.isArray(plan.current)) {
    Object.entries(plan.current).forEach(([code, outcome]) => {
      if (OUTCOMES.includes(outcome) && outcome !== DEFAULT_OUTCOME) current[code] = outcome;
    });
  }
  return { lag, terms, current };
}

// --- Simulación ---

function requirementId(r) {
  return typeof r === 'string' ? r : (r && (r.id || r.code)) || null;
}

function requirementType(r) {
  return (r && typeof r === 'object' && r.type === 'regularizada') ? 'regularizada' : 'aprobada';
}

// Materias de la carrera que cuentan para el plan: las de los módulos visibles
// (menos las que son solo del título intermedio) y el pool de electivas, con la
// cantidad de electivas que pide la carrera.
export function curriculumUniverse(curriculum) {
  const modules = Array.isArray(curriculum && curriculum.modules) ? curriculum.modules : [];
  const visible = modules.filter(m => m && m.render !== false);
  const electiveModule = modules.find(m => m && m.id === 'electives') || modules.find(m => m && m.render === false && Array.isArray(m.subjects));
  const required = [];
  visible.forEach(m => (Array.isArray(m.subjects) ? m.subjects : []).forEach(s => {
    if (s && s.code && !s.onlyForIntermediate) required.push(s);
  }));
  const requiredCodes = new Set(required.map(s => s.code));
  const electives = (electiveModule && Array.isArray(electiveModule.subjects) ? electiveModule.subjects : [])
    .filter(s => s && s.code && !requiredCodes.has(s.code));
  const electiveSlots = visible.reduce((acc, m) => acc + (Number.isFinite(Number(m.electivas)) ? Number(m.electivas) : 0), 0);
  const byCode = {};
  [...required, ...electives].forEach(s => { byCode[s.code] = s; });
  return { required, electives, electiveSlots, byCode };
}

function durationOf(subject) {
  return subject && subject.duration === 'anual' ? 2 : 1;
}

// Estado real de una materia según su inscripción: 'approved', 'regular',
// 'inProgress' o 'none' (sin inscripción o desaprobada: hay que cursarla).
export function realState(enrollment) {
  const status = enrollment ? enrollment.status : null;
  if (!status || status === 'Desaprobada') return 'none';
  if (APPROVED.includes(status)) return 'approved';
  if (status === 'Regularizada') return 'regular';
  return 'inProgress';
}

// Arma la simulación completa: cuándo queda regularizada y aprobada cada materia
// (real + plan), qué se puede sumar a cada cuatrimestre y qué destraba cada una.
export function simulate({ universe, plan, getEnrollment, start }) {
  const { byCode } = universe;
  const regAt = {};
  const aprobAt = {};
  const real = {};
  const plannedAt = {};
  const inProgress = [];
  const current = plan.current || {};

  Object.keys(byCode).forEach(code => {
    let state = realState(getEnrollment(code));
    if (state === 'inProgress') {
      inProgress.push(code);
      // Lo que se está cursando ahora termina antes del primer cuatrimestre a
      // planificar, con el resultado que se eligió en la columna "En curso".
      const outcome = current[code] || DEFAULT_OUTCOME;
      if (outcome === 'approved') { regAt[code] = start; aprobAt[code] = start; }
      else if (outcome === 'regular') { regAt[code] = start; aprobAt[code] = start + plan.lag; }
      else state = 'none';
    }
    real[code] = state;
    if (state === 'approved') { regAt[code] = -NEVER; aprobAt[code] = -NEVER; }
    else if (state === 'regular') { regAt[code] = -NEVER; aprobAt[code] = start + plan.lag; }
    else if (state === 'none') { regAt[code] = NEVER; aprobAt[code] = NEVER; }
  });

  plan.terms.forEach(term => {
    const t = termNumber(term.year, term.half);
    term.subjects.forEach(code => {
      const subject = byCode[code];
      if (!subject || plannedAt[code] !== undefined) return;
      plannedAt[code] = t;
      if (real[code] !== 'none') return;
      const done = t + durationOf(subject);
      regAt[code] = Math.min(regAt[code], done);
      aprobAt[code] = Math.min(aprobAt[code], done + plan.lag);
    });
  });

  // Correlativas "para cursar" de una materia que no se cumplen al empezar el
  // cuatrimestre t. `extra` simula tener una materia más aprobada.
  function missingAt(subject, t, extra = null) {
    const reqs = (subject.requirements && Array.isArray(subject.requirements.cursar)) ? subject.requirements.cursar : [];
    const missing = [];
    reqs.forEach(r => {
      const id = requirementId(r);
      if (!id || id === extra) return;
      const at = requirementType(r) === 'regularizada' ? (regAt[id] ?? NEVER) : (aprobAt[id] ?? NEVER);
      if (at > t) missing.push(id);
    });
    return missing;
  }

  const isPending = code => real[code] === 'none' && plannedAt[code] === undefined;

  const electivesTaken = universe.electives.filter(s => real[s.code] !== 'none' || plannedAt[s.code] !== undefined).length;
  const electivesLeft = Math.max(0, universe.electiveSlots - electivesTaken);

  // Lo que se puede sumar al cuatrimestre t, ordenado por cuánto destraba.
  function candidatesAt(t) {
    const pool = [...universe.required, ...(electivesLeft > 0 ? universe.electives : [])];
    const blocked = pool.filter(s => isPending(s.code) && missingAt(s, t).length > 0);
    return pool
      .filter(s => isPending(s.code) && missingAt(s, t).length === 0)
      .map(s => ({
        subject: s,
        elective: !universe.required.includes(s),
        unlocks: blocked.filter(b => missingAt(b, t, s.code).length === 0
          && (b.requirements.cursar || []).some(r => requirementId(r) === s.code)),
      }))
      .sort((a, b) => (a.elective - b.elective) || (b.unlocks.length - a.unlocks.length) || a.subject.name.localeCompare(b.subject.name, 'es'));
  }

  // Cuánto falta para terminar de cursar y recibirse con este plan.
  const requiredOpen = universe.required.filter(s => regAt[s.code] === NEVER).length;
  const electivesOpen = electivesLeft;
  const endReg = Math.max(start, ...universe.required.map(s => regAt[s.code]).filter(Number.isFinite),
    ...universe.electives.map(s => regAt[s.code]).filter(Number.isFinite));
  const endAprob = Math.max(start, ...universe.required.map(s => aprobAt[s.code]).filter(Number.isFinite),
    ...universe.electives.map(s => aprobAt[s.code]).filter(Number.isFinite));

  return {
    real, plannedAt, regAt, aprobAt, missingAt, candidatesAt, inProgress,
    pendingToPlan: requiredOpen + electivesOpen,
    requiredOpen, electivesOpen,
    // regAt/aprobAt marcan el inicio del cuatrimestre siguiente al que se termina.
    finishCursadaTerm: endReg - 1,
    graduationTerm: endAprob - 1,
  };
}

// Egreso estimado al ritmo actual: materias aprobadas por año desde el ingreso.
export function paceEstimate({ universe, getEnrollment, yearStarted, now = new Date() }) {
  const approved = [...universe.required, ...universe.electives].filter(s => realState(getEnrollment(s.code)) === 'approved');
  const approvedElectives = approved.filter(s => !universe.required.includes(s)).length;
  const approvedRequired = approved.length - approvedElectives;
  const total = universe.required.length + universe.electiveSlots;
  const done = approvedRequired + Math.min(approvedElectives, universe.electiveSlots);
  const remaining = Math.max(0, total - done);

  let from = Number.isInteger(yearStarted) ? yearStarted : null;
  if (from === null) {
    const years = approved.map(s => getEnrollment(s.code)).map(e => e && Number(e.enrollmentYear)).filter(Number.isFinite);
    if (years.length) from = Math.min(...years);
  }
  if (remaining === 0) return { remaining, total, done, pace: null, term: null, reason: 'done' };
  if (done === 0) return { remaining, total, done, pace: null, term: null, reason: 'no-approved' };
  if (from === null) return { remaining, total, done, pace: null, term: null, reason: 'no-year' };

  const startDate = new Date(from, 2, 1);
  const elapsedYears = Math.max(0.5, (now - startDate) / (365.25 * 24 * 3600 * 1000));
  const pace = done / elapsedYears;
  const finishDate = new Date(now.getTime() + (remaining / pace) * 365.25 * 24 * 3600 * 1000);
  // Se redondea al cuatrimestre en el que cae la fecha (julio en adelante = 2C).
  const term = termNumber(finishDate.getFullYear(), finishDate.getMonth() + 1 <= 7 ? 1 : 2);
  return { remaining, total, done, pace, term, reason: null };
}

// --- UI ---

function escapeHtml(text) {
  return String(text ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatList(items) {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
}

function formatPace(pace) {
  return pace.toLocaleString('es-AR', { maximumFractionDigits: 1 });
}

// ctx: lo que el planificador necesita del tablero (ver index.js).
//  getCurriculum(), getCareerCode(), getCareerName(), getEnrollment(code),
//  getYearStarted(), loadPlans() -> Promise<mapa>, savePlans(mapa) -> Promise.
export function initPlanner(ctx) {
  const modalEl = document.getElementById('plannerModal');
  const bodyEl = document.getElementById('planner-body');
  const saveStateEl = document.getElementById('planner-save-state');
  if (!modalEl || !bodyEl) return;

  let plans = {};
  let plan = normalizePlan(null);
  let careerCode = null;
  let openPickers = new Set();
  let saveTimer = null;
  let saving = Promise.resolve();

  function nameOf(code, universe) {
    const s = universe.byCode[code];
    return s ? s.name : code;
  }

  function setSaveState(text) {
    if (saveStateEl) saveStateEl.textContent = text;
  }

  function scheduleSave() {
    plans = { ...plans, [careerCode]: plan };
    setSaveState('Guardando…');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const snapshot = plans;
      saving = saving.then(() => ctx.savePlans(snapshot))
        .then(() => setSaveState('Plan guardado'))
        .catch(err => {
          setSaveState('No se pudo guardar');
          toastError('No se pudo guardar el plan', err);
        });
    }, 500);
  }

  function update(mutator) {
    mutator();
    plan = normalizePlan(plan);
    scheduleSave();
    render();
  }

  function subjectMeta(subject) {
    const hours = typeof subject.weekHours === 'number' ? subject.weekHours : null;
    return `
      ${hours !== null ? `<span class="badge planner-badge">${hours} h</span>` : ''}
      ${subject.duration === 'anual' ? '<span class="badge planner-badge">Anual</span>' : ''}`;
  }

  function renderSummary(universe, sim, start) {
    const pace = paceEstimate({ universe, getEnrollment: ctx.getEnrollment, yearStarted: ctx.getYearStarted() });
    // Lo que se puede cursar en el próximo cuatrimestre sin contar lo ya planificado.
    const unplanned = simulate({ universe, plan: { ...plan, terms: [] }, getEnrollment: ctx.getEnrollment, start });
    const nowCandidates = unplanned.candidatesAt(start).filter(c => !c.elective).length;

    let paceText;
    if (pace.reason === 'done') paceText = 'Ya aprobaste todas las materias.';
    else if (pace.reason === 'no-approved') paceText = 'Todavía no hay materias aprobadas para calcular tu ritmo.';
    else if (pace.reason === 'no-year') paceText = 'Cargá tu año de ingreso en Perfil y carreras para estimarlo.';
    else paceText = `A ${formatPace(pace.pace)} materias por año, te faltan ${pace.remaining} de ${pace.total}.`;

    let planValue;
    let planText;
    if (sim.pendingToPlan === 0) {
      planValue = termLabel(sim.graduationTerm);
      planText = `Terminás de cursar en ${termLabel(sim.finishCursadaTerm)} y rendís los últimos finales en ${termLabel(sim.graduationTerm)}.`;
    } else {
      planValue = `Faltan ${sim.pendingToPlan}`;
      const parts = [];
      if (sim.requiredOpen) parts.push(`${sim.requiredOpen} ${sim.requiredOpen === 1 ? 'materia' : 'materias'}`);
      if (sim.electivesOpen) parts.push(`${sim.electivesOpen} ${sim.electivesOpen === 1 ? 'electiva' : 'electivas'}`);
      planText = `Te quedan ${formatList(parts)} por ubicar en el plan para ver cuándo te recibís.`;
    }

    return `
      <div class="planner-summary">
        <div class="planner-stat">
          <div class="planner-stat-label">Podés cursar en ${termLabel(start)}</div>
          <div class="planner-stat-value">${nowCandidates} ${nowCandidates === 1 ? 'materia' : 'materias'}</div>
          <div class="planner-stat-note">Según tus correlativas y el resultado que supusiste para lo que estás cursando.</div>
        </div>
        <div class="planner-stat">
          <div class="planner-stat-label">Egreso al ritmo actual</div>
          <div class="planner-stat-value">${pace.term !== null ? termLabel(pace.term) : '—'}</div>
          <div class="planner-stat-note">${escapeHtml(paceText)}</div>
        </div>
        <div class="planner-stat">
          <div class="planner-stat-label">Egreso con este plan</div>
          <div class="planner-stat-value">${escapeHtml(planValue)}</div>
          <div class="planner-stat-note">${escapeHtml(planText)}</div>
        </div>
      </div>
      <div class="d-flex flex-wrap align-items-center gap-2 small mb-3">
        <label for="planner-lag" class="text-body-secondary mb-0">Los finales los rindo</label>
        <select id="planner-lag" class="form-select form-select-sm w-auto">
          ${LAG_OPTIONS.map(o => `<option value="${o.value}" ${o.value === plan.lag ? 'selected' : ''}>${escapeHtml(o.label)}</option>`).join('')}
        </select>
        <span class="text-body-secondary">Afecta las correlativas que piden la materia aprobada.</span>
        ${plan.terms.length ? '<button type="button" class="btn btn-sm btn-link text-danger ms-auto" data-action="clear">Vaciar plan</button>' : ''}
      </div>`;
  }

  function renderPlannedItem(code, t, universe, sim, start) {
    const subject = universe.byCode[code];
    if (!subject) {
      return `
        <li class="planner-item planner-item-warning">
          <div class="flex-grow-1 min-w-0">
            <div class="planner-item-name">${escapeHtml(code)}</div>
            <div class="planner-item-note">Ya no está en el plan de la carrera.</div>
          </div>
          <button type="button" class="btn btn-sm btn-icon" data-action="remove-subject" data-term="${t}" data-code="${escapeHtml(code)}" aria-label="Quitar ${escapeHtml(code)}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
        </li>`;
    }
    let note = '';
    let cls = '';
    const state = sim.real[code];
    if (state === 'approved') { note = 'Ya la aprobaste.'; cls = 'planner-item-muted'; }
    else if (state === 'regular') { note = 'Ya la regularizaste.'; cls = 'planner-item-muted'; }
    else if (state === 'inProgress') { note = 'Ya la estás cursando.'; cls = 'planner-item-muted'; }
    else if (sim.plannedAt[code] !== t) { note = `Ya está en ${termLabel(sim.plannedAt[code])}.`; cls = 'planner-item-muted'; }
    else {
      const missing = sim.missingAt(subject, t);
      if (missing.length) {
        cls = 'planner-item-warning';
        note = `Para cursarla te falta ${formatList(missing.map(c => nameOf(c, universe)))}.`;
      } else if (subject.duration === 'anual' && termHalf(t) === 2) {
        cls = 'planner-item-warning';
        note = 'Las anuales suelen empezar en el primer cuatrimestre.';
      }
    }
    return `
      <li class="planner-item ${cls}">
        <div class="flex-grow-1 min-w-0">
          <div class="planner-item-name">${escapeHtml(subject.name)}</div>
          <div class="d-flex flex-wrap gap-1 align-items-center">
            <small class="text-body-secondary me-1">${escapeHtml(subject.code)}</small>${subjectMeta(subject)}
          </div>
          ${note ? `<div class="planner-item-note">${escapeHtml(note)}</div>` : ''}
        </div>
        <button type="button" class="btn btn-sm btn-icon" data-action="remove-subject" data-term="${t}" data-code="${escapeHtml(code)}" aria-label="Quitar ${escapeHtml(subject.name)}"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
      </li>`;
  }

  function renderPicker(t, universe, sim) {
    const candidates = sim.candidatesAt(t);
    if (!candidates.length) {
      return '<div class="planner-picker"><div class="small text-body-secondary p-2">No hay más materias que puedas cursar en este cuatrimestre con lo planificado antes.</div></div>';
    }
    const item = c => `
      <li>
        <button type="button" class="planner-candidate" data-action="add-subject" data-term="${t}" data-code="${escapeHtml(c.subject.code)}">
          <span class="d-flex justify-content-between align-items-start gap-2">
            <span class="planner-item-name">${escapeHtml(c.subject.name)}</span>
            <i class="bi bi-plus-lg text-primary" aria-hidden="true"></i>
          </span>
          <span class="d-flex flex-wrap gap-1 align-items-center">${subjectMeta(c.subject)}</span>
          ${c.unlocks.length ? `<span class="planner-item-note planner-unlocks"><i class="bi bi-unlock me-1" aria-hidden="true"></i>Destraba ${escapeHtml(formatList(c.unlocks.map(u => u.name)))}</span>` : ''}
        </button>
      </li>`;
    const required = candidates.filter(c => !c.elective);
    const electives = candidates.filter(c => c.elective);
    return `
      <div class="planner-picker">
        ${required.length ? `<ul class="list-unstyled mb-0">${required.map(item).join('')}</ul>` : ''}
        ${electives.length ? `
          <div class="planner-picker-heading">Electivas (te ${sim.electivesOpen === 1 ? 'falta 1' : `faltan ${sim.electivesOpen}`})</div>
          <ul class="list-unstyled mb-0">${electives.map(item).join('')}</ul>` : ''}
      </div>`;
  }

  function renderTerm(term, universe, sim, start) {
    const t = termNumber(term.year, term.half);
    const hours = plan.terms.reduce((acc, other) => {
      const ot = termNumber(other.year, other.half);
      other.subjects.forEach(code => {
        const s = universe.byCode[code];
        if (!s || sim.plannedAt[code] !== ot || sim.real[code] !== 'none') return;
        if (ot === t || (s.duration === 'anual' && ot + 1 === t)) acc += typeof s.weekHours === 'number' ? s.weekHours : 0;
      });
      return acc;
    }, 0);
    const carried = plan.terms
      .filter(other => termNumber(other.year, other.half) + 1 === t)
      .flatMap(other => other.subjects)
      .filter(code => universe.byCode[code] && universe.byCode[code].duration === 'anual' && sim.real[code] === 'none' && sim.plannedAt[code] === t - 1);
    const pickerOpen = openPickers.has(t);
    return `
      <section class="planner-term ${t < start ? 'planner-term-past' : ''}" aria-label="${escapeHtml(termLongLabel(t))}">
        <header class="planner-term-header">
          <div>
            <div class="fw-semibold">${termLabel(t)}</div>
            <div class="small text-body-secondary">${hours} h semanales${t < start ? ' · ya pasó' : ''}</div>
          </div>
          <button type="button" class="btn btn-sm btn-icon" data-action="remove-term" data-term="${t}" aria-label="Quitar ${escapeHtml(termLongLabel(t))}" title="Quitar cuatrimestre"><i class="bi bi-trash3" aria-hidden="true"></i></button>
        </header>
        <ul class="list-unstyled mb-2 d-flex flex-column gap-2">
          ${carried.map(code => `
            <li class="planner-item planner-item-muted">
              <div class="flex-grow-1 min-w-0">
                <div class="planner-item-name">${escapeHtml(universe.byCode[code].name)}</div>
                <div class="planner-item-note">Sigue de ${termLabel(t - 1)} (anual).</div>
              </div>
            </li>`).join('')}
          ${term.subjects.map(code => renderPlannedItem(code, t, universe, sim, start)).join('')}
        </ul>
        <button type="button" class="btn btn-sm ${pickerOpen ? 'btn-secondary' : 'btn-outline-primary'} w-100" data-action="toggle-picker" data-term="${t}" aria-expanded="${pickerOpen}">
          <i class="bi ${pickerOpen ? 'bi-chevron-up' : 'bi-plus-lg'} me-1" aria-hidden="true"></i>${pickerOpen ? 'Cerrar' : 'Agregar materia'}
        </button>
        ${pickerOpen ? renderPicker(t, universe, sim) : ''}
      </section>`;
  }

  // Columna "En curso": lo que se está cursando ahora, con un resultado supuesto
  // que se cambia con un click (aprobada → regularizada → desaprobada) para ver
  // qué destraba cada uno en el primer cuatrimestre del plan.
  function renderCurrent(universe, sim, start) {
    if (!sim.inProgress.length) return '';
    const base = { ...plan, terms: [] };
    const cursableWith = current => new Set(simulate({ universe, plan: { ...base, current }, getEnrollment: ctx.getEnrollment, start })
      .candidatesAt(start).filter(c => !c.elective).map(c => c.subject.code));
    const now = cursableWith(plan.current);
    const items = sim.inProgress.map(code => {
      const subject = universe.byCode[code];
      const outcome = plan.current[code] || DEFAULT_OUTCOME;
      const withoutIt = cursableWith({ ...plan.current, [code]: 'failed' });
      const unlocks = [...now].filter(c => !withoutIt.has(c)).map(c => nameOf(c, universe));
      let note;
      if (outcome === 'failed') note = 'La tenés que volver a cursar: aparece entre las materias para agregar.';
      else if (unlocks.length) note = `Destraba ${formatList(unlocks)}`;
      else note = `No destraba nada nuevo en ${termLabel(start)}.`;
      return `
        <li>
          <button type="button" class="planner-current planner-current-${outcome}" data-action="cycle-outcome" data-code="${escapeHtml(code)}"
            aria-label="${escapeHtml(subject.name)}: ${OUTCOME_LABELS[outcome]}. Cambiar resultado supuesto">
            <span class="d-flex justify-content-between align-items-start gap-2">
              <span class="planner-item-name">${escapeHtml(subject.name)}</span>
              <span class="badge planner-outcome">${OUTCOME_LABELS[outcome]}</span>
            </span>
            <span class="planner-item-note ${outcome !== 'failed' && unlocks.length ? 'planner-unlocks' : ''}">
              ${outcome !== 'failed' && unlocks.length ? '<i class="bi bi-unlock me-1" aria-hidden="true"></i>' : ''}${escapeHtml(note)}
            </span>
          </button>
        </li>`;
    }).join('');
    return `
      <section class="planner-term planner-term-current" aria-label="Materias en curso">
        <header class="planner-term-header">
          <div>
            <div class="fw-semibold">En curso</div>
            <div class="small text-body-secondary">Tocá una para cambiar cómo suponés que termina.</div>
          </div>
        </header>
        <ul class="list-unstyled mb-0 d-flex flex-column gap-2">${items}</ul>
      </section>`;
  }

  function render() {
    const curriculum = ctx.getCurriculum();
    if (!careerCode || !curriculum) {
      bodyEl.innerHTML = '<div class="alert alert-info mb-0">Anotate en una carrera para planificar tus cuatrimestres.</div>';
      return;
    }
    const universe = curriculumUniverse(curriculum);
    const start = nextTerm();
    const sim = simulate({ universe, plan, getEnrollment: ctx.getEnrollment, start });
    const lastTerm = plan.terms.length ? termNumber(plan.terms[plan.terms.length - 1].year, plan.terms[plan.terms.length - 1].half) : start - 1;
    const addTerm = plan.terms.length ? lastTerm + 1 : start;

    bodyEl.innerHTML = `
      ${renderSummary(universe, sim, start)}
      <div class="planner-terms">
        ${renderCurrent(universe, sim, start)}
        ${plan.terms.map(term => renderTerm(term, universe, sim, start)).join('')}
        <button type="button" class="planner-add-term" data-action="add-term" data-term="${addTerm}">
          <i class="bi bi-plus-lg" aria-hidden="true"></i>
          <span>Agregar ${termLabel(addTerm)}</span>
        </button>
      </div>`;

    const lagSelect = bodyEl.querySelector('#planner-lag');
    if (lagSelect) lagSelect.addEventListener('change', () => update(() => { plan.lag = Number(lagSelect.value); }));
  }

  function findTerm(t) {
    return plan.terms.find(term => termNumber(term.year, term.half) === t);
  }

  bodyEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn || !bodyEl.contains(btn)) return;
    const t = Number(btn.dataset.term);
    const code = btn.dataset.code;
    switch (btn.dataset.action) {
      case 'add-term':
        openPickers.add(t);
        update(() => { plan.terms.push({ year: termYear(t), half: termHalf(t), subjects: [] }); });
        break;
      case 'remove-term': {
        const term = findTerm(t);
        if (term && term.subjects.length) {
          const ok = await confirmDialog({
            title: `¿Quitar ${termLabel(t)}?`,
            message: `Se sacan del plan las ${term.subjects.length} materias de este cuatrimestre.`,
            confirmText: 'Quitar',
            danger: true,
          });
          if (!ok) return;
        }
        openPickers.delete(t);
        update(() => { plan.terms = plan.terms.filter(x => x !== term); });
        break;
      }
      case 'cycle-outcome':
        update(() => {
          const next = OUTCOMES[(OUTCOMES.indexOf(plan.current[code] || DEFAULT_OUTCOME) + 1) % OUTCOMES.length];
          plan.current = { ...plan.current, [code]: next };
        });
        break;
      case 'toggle-picker':
        if (openPickers.has(t)) openPickers.delete(t); else openPickers.add(t);
        render();
        break;
      case 'add-subject':
        update(() => { const term = findTerm(t); if (term && !term.subjects.includes(code)) term.subjects.push(code); });
        break;
      case 'remove-subject':
        update(() => { const term = findTerm(t); if (term) term.subjects = term.subjects.filter(c => c !== code); });
        break;
      case 'clear': {
        const ok = await confirmDialog({
          title: '¿Vaciar el plan?',
          message: 'Se borran todos los cuatrimestres planificados de esta carrera y los resultados supuestos de lo que estás cursando. Tus notas e inscripciones no se tocan.',
          confirmText: 'Vaciar',
          danger: true,
        });
        if (!ok) return;
        openPickers = new Set([nextTerm()]);
        update(() => { plan.terms = [{ year: termYear(nextTerm()), half: termHalf(nextTerm()), subjects: [] }]; plan.current = {}; });
        break;
      }
      default:
        break;
    }
  });

  async function open() {
    careerCode = ctx.getCareerCode();
    const careerName = careerCode ? ctx.getCareerName() : '';
    const subtitle = document.getElementById('planner-career');
    if (subtitle) subtitle.textContent = careerName || '';
    setSaveState('');
    bodyEl.innerHTML = '<div class="d-flex justify-content-center p-4"><div class="spinner-border text-secondary" role="status"><span class="visually-hidden">Cargando…</span></div></div>';
    try {
      const loaded = await ctx.loadPlans();
      plans = loaded && typeof loaded === 'object' && !Array.isArray(loaded) ? { ...loaded } : {};
    } catch (err) {
      plans = {};
      toastError('No se pudo cargar tu plan', err);
    }
    plan = normalizePlan(careerCode ? plans[careerCode] : null);
    openPickers = new Set();
    // Primera vez: arranca con el próximo cuatrimestre y la lista de lo que se
    // puede cursar abierta, que es la pregunta que viene a responder.
    if (!plan.terms.length) {
      const t = nextTerm();
      plan.terms.push({ year: termYear(t), half: termHalf(t), subjects: [] });
      openPickers.add(t);
    }
    render();
  }

  modalEl.addEventListener('show.bs.modal', open);
}
