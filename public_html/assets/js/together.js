// "¿Qué podemos cursar juntos?": compara tus correlativas con las de un compañero
// que tenga el perfil público (GET /api/public/{token}) y separa las materias del
// próximo cuatrimestre en las que pueden cursar los dos, las que solo podés vos y
// las que solo puede el otro, con lo que le falta a cada uno.
//
// Usa la misma simulación que el planificador (assets/js/planner.js), sin plan:
// lo que cada uno está cursando ahora cuenta como regularizado al empezar el
// próximo cuatrimestre. El perfil público no trae el nombre, así que el compañero
// se guarda con un apodo, solo en este navegador.

import { toastError, setBusy } from './ui.js';
import { curriculumUniverse, nextTerm, normalizePlan, simulate, termLabel } from './planner.js';

const FRIENDS_KEY = 'utn.together.friends';
const MAX_FRIENDS = 6;

// --- Datos ---

// Token del perfil público: acepta el link de compartir (share.html?uid=...) o el
// token suelto.
export function parseShareToken(input) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const uid = url.searchParams.get('uid') || url.searchParams.get('u');
    return uid && /^[A-Za-z0-9_-]{6,128}$/.test(uid) ? uid : null;
  } catch (e) { /* no es una URL */ }
  return /^[A-Za-z0-9_-]{6,128}$/.test(raw) ? raw : null;
}

function requirementOf(subject, code) {
  const reqs = (subject.requirements && Array.isArray(subject.requirements.cursar)) ? subject.requirements.cursar : [];
  const r = reqs.find(x => (typeof x === 'string' ? x : (x && (x.id || x.code))) === code);
  return r && typeof r === 'object' && r.type === 'regularizada' ? 'regularizada' : 'aprobada';
}

// mine / theirs: code -> inscripción (o null). Devuelve
// { term, both, onlyMe, onlyThem, together, counts }; en onlyMe/onlyThem cada
// materia trae lo que le falta al otro: [{ code, need: 'regularizada'|'aprobada' }].
export function compareTogether({ curriculum, mine, theirs, start = nextTerm() }) {
  const universe = curriculumUniverse(curriculum);
  const plan = normalizePlan({});
  const simMe = simulate({ universe, plan, getEnrollment: mine, start });
  const simThem = simulate({ universe, plan, getEnrollment: theirs, start });
  const isElective = s => !universe.required.includes(s);
  const can = (sim, s) => sim.real[s.code] === 'none' && sim.missingAt(s, start).length === 0 && (!isElective(s) || sim.electivesOpen > 0);
  const missing = (sim, s) => sim.missingAt(s, start).map(code => ({ code, need: requirementOf(s, code) }));

  const both = []; const onlyMe = []; const onlyThem = [];
  [...universe.required, ...universe.electives].forEach(s => {
    // Solo cuenta lo que los dos todavía tienen que cursar.
    if (simMe.real[s.code] !== 'none' || simThem.real[s.code] !== 'none') return;
    const me = can(simMe, s);
    const them = can(simThem, s);
    const item = { subject: s, elective: isElective(s) };
    if (me && them) both.push(item);
    else if (me && !isElective(s)) onlyMe.push({ ...item, missing: missing(simThem, s) });
    else if (them && !isElective(s)) onlyThem.push({ ...item, missing: missing(simMe, s) });
  });
  const order = (a, b) => (a.elective - b.elective) || a.subject.name.localeCompare(b.subject.name, 'es');
  const count = (sim, state) => Object.values(sim.real).filter(v => v === state).length;
  return {
    term: start,
    both: both.sort(order),
    onlyMe: onlyMe.sort(order),
    onlyThem: onlyThem.sort(order),
    together: simMe.inProgress.filter(c => simThem.inProgress.includes(c)).map(c => universe.byCode[c]).filter(Boolean),
    counts: {
      me: { approved: count(simMe, 'approved'), inProgress: simMe.inProgress.length },
      them: { approved: count(simThem, 'approved'), inProgress: simThem.inProgress.length },
    },
  };
}

// --- Compañeros guardados (solo en este navegador) ---

export function readFriends() {
  try {
    const arr = JSON.parse(localStorage.getItem(FRIENDS_KEY) || '[]');
    return Array.isArray(arr) ? arr.filter(f => f && typeof f.token === 'string') : [];
  } catch (e) { return []; }
}

function writeFriends(list) {
  try { localStorage.setItem(FRIENDS_KEY, JSON.stringify(list.slice(0, MAX_FRIENDS))); } catch (e) { /* ignore */ }
}

function rememberFriend(token, alias) {
  const rest = readFriends().filter(f => f.token !== token);
  writeFriends([{ token, alias: alias || '' }, ...rest]);
}

function forgetFriend(token) {
  writeFriends(readFriends().filter(f => f.token !== token));
}

// --- UI ---

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function initials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
}

// ctx: { getCurriculum, getCareerCode, getCareerName, getEnrollment(code),
//        fetchPublic(token) -> { enrollments, userCareers }, loadPlans, savePlans }
export function initTogether(ctx) {
  const modalEl = document.getElementById('togetherModal');
  if (!modalEl) return;
  const $ = id => document.getElementById(id);
  const form = $('together-form');
  const linkInput = $('together-link');
  const aliasInput = $('together-alias');
  const submitBtn = $('together-submit');
  const friendsEl = $('together-friends');
  const resultEl = $('together-result');

  let last = null; // { token, alias, result, careerNote }

  function renderFriends() {
    const friends = readFriends();
    friendsEl.innerHTML = friends.length ? `<span class="text-body-secondary">Comparados antes:</span> ${friends.map(f => `
      <span class="badge rounded-pill ${last && last.token === f.token ? 'text-bg-primary' : 'border text-body-secondary fw-normal'} d-inline-flex align-items-center gap-1">
        <button type="button" class="btn btn-link p-0 text-reset text-decoration-none together-chip" data-action="pick" data-token="${esc(f.token)}">${esc(f.alias || 'Sin nombre')}</button>
        <button type="button" class="btn btn-link p-0 text-reset together-chip" data-action="forget" data-token="${esc(f.token)}" aria-label="Olvidar a ${esc(f.alias || 'este compañero')}"><i class="bi bi-x" aria-hidden="true"></i></button>
      </span>`).join(' ')}` : '';
  }

  async function plannedCodes() {
    try {
      const plans = await ctx.loadPlans();
      const plan = normalizePlan(plans && plans[ctx.getCareerCode()]);
      return new Set(plan.terms.flatMap(t => t.subjects));
    } catch (e) { return new Set(); }
  }

  function needLabel(m) {
    const name = esc(nameOf(m.code));
    return `${m.need === 'regularizada' ? 'regularizar' : 'aprobar'} <strong>${name}</strong>`;
  }

  function nameOf(code) {
    const u = curriculumUniverse(ctx.getCurriculum());
    return (u.byCode[code] && u.byCode[code].name) || code;
  }

  function listJoin(parts) {
    if (parts.length <= 1) return parts.join('');
    return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
  }

  function itemHtml(item, extra, action) {
    const s = item.subject;
    return `<li class="list-group-item d-flex align-items-start gap-2 py-2">
      <div class="flex-grow-1 min-w-0">
        <div class="fw-semibold">${esc(s.name)}</div>
        <div class="d-flex flex-wrap gap-1 align-items-center small mt-1">
          <span class="text-body-secondary me-1">${esc(s.code)}</span>
          ${s.weekHours ? `<span class="badge border text-body-secondary fw-normal">${esc(s.weekHours)} h</span>` : ''}
          ${s.duration === 'anual' ? '<span class="badge border text-body-secondary fw-normal">Anual</span>' : ''}
          ${item.elective ? '<span class="badge border text-body-secondary fw-normal">Electiva</span>' : ''}
          ${extra || ''}
        </div>
      </div>${action || ''}</li>`;
  }

  async function renderResult() {
    if (!last) { resultEl.innerHTML = ''; return; }
    const { result: r, alias } = last;
    const who = alias || 'tu compañero';
    const Who = alias || 'Tu compañero';
    const planned = await plannedCodes();
    const term = termLabel(r.term);
    const addBtn = code => planned.has(code)
      ? '<span class="badge text-bg-primary bg-opacity-75 align-self-center">En tu plan</span>'
      : `<button type="button" class="btn btn-sm btn-outline-primary text-nowrap" data-action="plan" data-code="${esc(code)}" title="Agregar al plan del ${esc(term)}"><i class="bi bi-calendar-plus me-1" aria-hidden="true"></i>Al plan</button>`;
    const column = (title, sub, items, render, highlight) => `
      <div class="col-lg-4"><div class="h-100 border rounded${highlight ? ' border-success' : ''}">
        <div class="px-3 py-2 rounded-top ${highlight ? 'bg-success-subtle text-success-emphasis' : 'bg-body-tertiary'}">
          <div class="fw-semibold">${highlight ? '<i class="bi bi-check2-circle me-1" aria-hidden="true"></i>' : ''}${esc(title)} · ${items.length}</div>
          <div class="small${highlight ? '' : ' text-body-secondary'}">${esc(sub)}</div>
        </div>
        ${items.length ? `<ul class="list-group list-group-flush rounded-bottom">${items.map(render).join('')}</ul>` : '<p class="small text-body-secondary px-3 py-3 mb-0">Ninguna.</p>'}
      </div></div>`;

    resultEl.innerHTML = `
      <div class="border rounded p-3 mb-3 d-flex flex-wrap align-items-center gap-3">
        <div class="d-flex align-items-center gap-2"><span class="together-avatar text-bg-primary">Vos</span>
          <div class="small"><div class="fw-semibold">Vos</div><div class="text-body-secondary">${r.counts.me.approved} aprobadas · ${r.counts.me.inProgress} en curso</div></div></div>
        <i class="bi bi-arrow-left-right text-body-secondary" aria-hidden="true"></i>
        <div class="d-flex align-items-center gap-2"><span class="together-avatar text-bg-success">${esc(initials(alias || '?'))}</span>
          <div class="small"><div class="fw-semibold">${esc(Who)}</div><div class="text-body-secondary">${r.counts.them.approved} aprobadas · ${r.counts.them.inProgress} en curso</div></div></div>
        <div class="ms-md-auto small text-body-secondary">${esc(last.careerNote)}</div>
      </div>
      <div class="row g-3">
        ${column('Pueden cursar juntos', `Los dos cumplen las correlativas para el ${term}.`, r.both, i => itemHtml(i, '', addBtn(i.subject.code)), true)}
        ${column('Solo vos', `A ${who} le falta algo para anotarse.`, r.onlyMe,
          i => itemHtml(i, `<span class="text-body-secondary">A ${esc(who)} le falta ${listJoin(i.missing.map(needLabel))}</span>`))}
        ${column(`Solo ${Who}`, `Lo que te falta para cursarlas con ${who}.`, r.onlyThem,
          i => itemHtml(i, `<span class="text-body-secondary">Te falta ${listJoin(i.missing.map(m => needLabel(m)
            + (ctx.getEnrollment(m.code) && !['Aprobada', 'Promocionada', 'Regularizada', 'Desaprobada'].includes(ctx.getEnrollment(m.code).status)
              ? ' <span class="badge text-bg-warning">la estás cursando</span>' : '')))}</span>`))}
      </div>
      ${r.together.length ? `<div class="small text-body-secondary mt-3"><i class="bi bi-people-fill me-1" aria-hidden="true"></i>Ya cursan juntos este cuatrimestre: ${listJoin(r.together.map(s => `<strong>${esc(s.name)}</strong>`))}.</div>` : ''}`;
  }

  async function compare(token, alias) {
    if (!ctx.getCurriculum() || !ctx.getCareerCode()) {
      toastError('Elegí una carrera en el tablero para poder comparar.');
      return;
    }
    setBusy(submitBtn, true);
    try {
      let data;
      try {
        data = await ctx.fetchPublic(token);
      } catch (e) {
        const code = e && (e.code || e.error || (e.body && e.body.error));
        const status = e && e.status;
        if (status === 403 || code === 'private_profile') toastError('Ese perfil es privado. Tu compañero tiene que activar "Hacer mi perfil público".');
        else if (status === 404 || code === 'not_found') toastError('No encontramos ese perfil. Revisá el link: si lo volvió privado y público de nuevo, el link cambió.');
        else toastError('No se pudo cargar el perfil', e);
        return;
      }
      const byCode = {};
      (Array.isArray(data && data.enrollments) ? data.enrollments : []).forEach(e => { if (e && e.subjectCode) byCode[e.subjectCode] = e; });
      const career = ctx.getCareerCode();
      const theirCareers = (Array.isArray(data && data.userCareers) ? data.userCareers : []).map(c => c.careerCode);
      const careerName = ctx.getCareerName() || career;
      const careerNote = theirCareers.includes(career)
        ? `Los dos en ${careerName}`
        : `${alias || 'Tu compañero'} no está anotado en ${careerName}: se comparan las materias en común`;
      const result = compareTogether({ curriculum: ctx.getCurriculum(), mine: c => ctx.getEnrollment(c), theirs: c => byCode[c] || null });
      last = { token, alias, result, careerNote };
      rememberFriend(token, alias);
      renderFriends();
      await renderResult();
    } finally {
      setBusy(submitBtn, false);
    }
  }

  form.addEventListener('submit', ev => {
    ev.preventDefault();
    const token = parseShareToken(linkInput.value);
    if (!token) { toastError('Pegá el link del perfil público de tu compañero (el de "Compartir").'); linkInput.focus(); return; }
    const alias = aliasInput.value.trim() || (readFriends().find(f => f.token === token) || {}).alias || '';
    compare(token, alias);
  });

  friendsEl.addEventListener('click', ev => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const friend = readFriends().find(f => f.token === btn.dataset.token);
    if (btn.dataset.action === 'forget') {
      forgetFriend(btn.dataset.token);
      if (last && last.token === btn.dataset.token) { last = null; renderResult(); }
      renderFriends();
    } else if (friend) {
      linkInput.value = friend.token;
      aliasInput.value = friend.alias || '';
      compare(friend.token, friend.alias || '');
    }
  });

  resultEl.addEventListener('click', async ev => {
    const btn = ev.target.closest('[data-action="plan"]');
    if (!btn || !last) return;
    setBusy(btn, true);
    try {
      const plans = { ...((await ctx.loadPlans()) || {}) };
      const career = ctx.getCareerCode();
      const plan = normalizePlan(plans[career]);
      const year = Math.floor(last.result.term / 2);
      const half = (last.result.term % 2) + 1;
      let term = plan.terms.find(t => t.year === year && t.half === half);
      if (!term) { term = { year, half, subjects: [] }; plan.terms.push(term); }
      if (!term.subjects.includes(btn.dataset.code)) term.subjects.push(btn.dataset.code);
      plans[career] = { ...(plans[career] || {}), terms: plan.terms };
      await ctx.savePlans(plans);
      await renderResult();
    } catch (e) {
      setBusy(btn, false);
      toastError('No se pudo agregar al plan', e);
    }
  });

  modalEl.addEventListener('show.bs.modal', () => {
    renderFriends();
    if (last) renderResult();
  });
}
