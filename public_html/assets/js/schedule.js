// Horario semanal: días y horas de cursada de cada materia, en una grilla armada
// con los bloques fijos de la facultad (45 minutos, con un corte de 15 entre el 2
// y el 3 de cada turno).
//
// Se carga a mano (materia + filas de día/desde/hasta, cada día con su horario y
// pudiendo cruzar de turno) o importando el comprobante de inscripción a cursada
// del SIU (PDF), que se lee en el navegador con pdf.js y no se sube a ningún lado.
//
// El horario vive en el store activo (GET/PUT /api/class-schedule con sesión,
// localStorage como invitado) y se guarda como horas 'HH:MM', no como números de
// bloque: la tabla de bloques es solo para dibujar y para los desplegables.

import { toastError, setBusy } from './ui.js';

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const SHIFTS = { M: 'Mañana', T: 'Tarde', N: 'Noche' };

// --- Bloques ---

export function toMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}

export function fromMinutes(min) {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

// Bloques de 45 minutos desde `start`, con 15 de corte después del bloque 2.
function shiftBlocks(shift, start, count) {
  const out = [];
  let t = toMinutes(start);
  for (let n = 0; n < count; n++) {
    out.push({ id: `${shift}${n}`, shift, n, start: fromMinutes(t), end: fromMinutes(t + 45) });
    t += 45 + (n === 2 ? 15 : 0);
  }
  return out;
}

export const BLOCKS = [
  ...shiftBlocks('M', '07:45', 7),
  ...shiftBlocks('T', '13:30', 7),
  ...shiftBlocks('N', '18:15', 6),
];

// Filas de la grilla: un bloque por horario distinto. El T6 y el N0 son el mismo
// horario (18:15 a 19:00), así que comparten fila.
export const ROWS = (() => {
  const rows = [];
  for (const b of BLOCKS) {
    const same = rows.find(r => r.start === b.start && r.end === b.end);
    if (same) { same.ids.push(b.id); same.shifts.push(b.shift); continue; }
    rows.push({ start: b.start, end: b.end, ids: [b.id], shifts: [b.shift], n: b.n });
  }
  return rows.sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
})();

// Opciones de los desplegables "Desde" y "Hasta" (todo el día, sin elegir turno).
export function startOptions() {
  return ROWS.map(r => ({ value: r.start, label: `${r.start} · ${r.ids.join('/')}` }));
}

export function endOptions(start) {
  const from = toMinutes(start);
  return ROWS.filter(r => from === null || toMinutes(r.end) > from)
    .map(r => ({ value: r.end, label: `${r.end} · ${r.ids.join('/')}` }));
}

// Índices de las filas que toca un horario (las que se superponen con él).
export function rowsFor(start, end) {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (s === null || e === null) return [];
  const out = [];
  ROWS.forEach((r, i) => { if (toMinutes(r.start) < e && toMinutes(r.end) > s) out.push(i); });
  return out;
}

// Bloques que ocupa un horario, para mostrar ("M1 a M5", "M6 a T2").
export function blockRange(start, end) {
  const rows = rowsFor(start, end);
  if (!rows.length) return '';
  const first = ROWS[rows[0]];
  const last = ROWS[rows[rows.length - 1]];
  // En la fila compartida T6/N0, se nombra según el turno del otro extremo.
  const pick = (row, other) => row.ids.find(id => id[0] === other.shifts[0]) || row.ids[0];
  const a = pick(first, last);
  const b = pick(last, first);
  return a === b ? a : `${a} a ${b}`;
}

// Turnos a mostrar: los que tienen clases (o todos si no hay nada cargado o si se
// pidió verlos todos).
export function visibleShifts(sessions, showAll = false) {
  if (showAll || !sessions || !sessions.length) return ['M', 'T', 'N'];
  const used = new Set();
  sessions.forEach(s => rowsFor(s.start, s.end).forEach(i => ROWS[i].shifts.forEach(sh => used.add(sh))));
  // La fila T6/N0 sola no alcanza para mostrar toda la noche.
  if (used.has('N') && !sessions.some(s => toMinutes(s.end) > toMinutes('19:00'))) used.delete('N');
  return ['M', 'T', 'N'].filter(sh => used.has(sh));
}

// --- Sesiones ---

// { code: { subjectCode, commission, campus, sessions: [...] } }, en el orden en que
// aparecen (por día y hora).
export function groupBySubject(sessions) {
  const out = new Map();
  for (const s of Array.isArray(sessions) ? sessions : []) {
    if (!out.has(s.subjectCode)) {
      out.set(s.subjectCode, { subjectCode: s.subjectCode, commission: s.commission || '', campus: s.campus || '', sessions: [] });
    }
    out.get(s.subjectCode).sessions.push({ weekday: s.weekday, start: s.start, end: s.end });
  }
  return out;
}

export function sessionLabel(s) {
  return `${WEEKDAYS[s.weekday] || '?'} ${s.start} a ${s.end}`;
}

// Primera sesión de otra materia que se pisa con alguna de `candidate` (o null).
export function findOverlap(sessions, subjectCode, candidate) {
  for (const c of candidate) {
    const cs = toMinutes(c.start);
    const ce = toMinutes(c.end);
    const hit = (sessions || []).find(s => s.subjectCode !== subjectCode && s.weekday === c.weekday
      && toMinutes(s.start) < ce && toMinutes(s.end) > cs);
    if (hit) return { session: hit, candidate: c };
  }
  return null;
}

// Filas del formulario válidas y sin repetir. Devuelve un string con el error si
// alguna no cierra.
export function validateRows(rows) {
  if (!rows.length) return 'Agregá al menos un día.';
  for (const r of rows) {
    if (!Number.isInteger(r.weekday) || r.weekday < 0 || r.weekday > 5) return 'Elegí el día.';
    if (toMinutes(r.start) === null || toMinutes(r.end) === null) return 'Elegí desde y hasta.';
    if (toMinutes(r.start) >= toMinutes(r.end)) return `El ${WEEKDAYS[r.weekday]} termina antes de empezar.`;
  }
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i]; const b = rows[j];
      if (a.weekday === b.weekday && toMinutes(a.start) < toMinutes(b.end) && toMinutes(b.start) < toMinutes(a.end)) {
        return `Hay dos horarios que se pisan el ${WEEKDAYS[a.weekday]}.`;
      }
    }
  }
  return null;
}

// Abreviatura para la grilla: el código si es una sigla, o las iniciales del
// nombre si el código es numérico (electivas).
export function shortName(code, name) {
  if (code && !/^\d+$/.test(code)) return code;
  const words = String(name || code || '').split(/\s+/).filter(w => w.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(w));
  return words.map(w => w[0].toUpperCase()).join('').slice(0, 5) || code;
}

// --- Comprobante de inscripción a cursada (SIU) ---

const DAY_TOKENS = { lun: 0, mar: 1, mie: 2, mié: 2, jue: 3, vie: 4, sab: 5, sáb: 5 };

export function normalize(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// "Lun 14:15 a 18:15 - Mie 14:15 a" -> [{weekday 0, 14:15, 18:15}, {weekday 2, 14:15, end null}].
// Un horario sin fin es porque el PDF corta la celda: se completa a mano.
export function parseScheduleText(text) {
  const out = [];
  const re = /(Lun|Mar|Mi[eé]|Jue|Vie|S[aá]b)\w*\.?\s+(\d{1,2}[:.]\d{2})\s*(?:a|-)?\s*(\d{1,2}[:.]\d{2})?/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    const weekday = DAY_TOKENS[m[1].toLowerCase()];
    const fix = t => (t ? fromMinutes(toMinutes(t.replace('.', ':'))) : null);
    if (weekday !== undefined) out.push({ weekday, start: fix(m[2]), end: fix(m[3]) });
  }
  return out;
}

// Lee los ítems de texto del PDF ([{str, x, y}], y crece hacia arriba) y arma las
// filas del comprobante. Cada fila empieza en un código de actividad de 6 dígitos
// (columna "Código"); la sede y el horario pueden estar unos puntos más arriba o
// abajo que el nombre, así que se toma la franja entre una fila y la siguiente.
// Los encabezados están centrados y los valores no, así que en vez de cortar por
// columnas cada dato se reconoce por su forma (comisión K2005, "Sede ...", "Lun
// 08:30 a 12:30", "Anual 2026") y el nombre es lo que queda antes del período.
export function parseComprobante(items) {
  const clean = (Array.isArray(items) ? items : [])
    .filter(i => i && typeof i.str === 'string' && i.str.trim())
    .map(i => ({ str: i.str.trim().replace(/\s+/g, ' '), x: Number(i.x), y: Number(i.y) }));
  const header = name => clean.find(i => normalize(i.str) === name);
  const hCode = header('codigo');
  const hName = header('actividad');
  const hPeriod = header('periodo');
  if (!hCode || !hName || !header('horario')) return null;
  const nameMaxX = hPeriod ? hPeriod.x - 15 : Infinity;

  const isPeriod = str => /^(anual|\d\s*(er|do|ro|to|°|º)?\s*cuat)/i.test(str);
  const isCommission = str => /^[A-Z]{1,2}\d{3,5}$/.test(str);
  const isCampus = str => /^sede\b/i.test(str);
  const isSchedule = str => parseScheduleText(str).length > 0 || /^(a\s*)?\d{1,2}[:.]\d{2}\s*-?$/.test(str);

  const anchors = clean.filter(i => /^\d{6}$/.test(i.str) && i.y < hCode.y - 2 && i.x < hName.x)
    .sort((a, b) => b.y - a.y);
  const entries = anchors.map((a, idx) => {
    const top = idx === 0 ? hCode.y - 4 : (anchors[idx - 1].y + a.y) / 2;
    const bottom = idx === anchors.length - 1 ? a.y - 14 : (a.y + anchors[idx + 1].y) / 2;
    const band = clean.filter(i => i !== a && i.y < top && i.y >= bottom).sort((p, q) => q.y - p.y || p.x - q.x);
    const take = test => band.filter(i => test(i.str)).map(i => i.str);
    const name = band.filter(i => i.x >= hName.x - 8 && i.x < nameMaxX && !isPeriod(i.str) && !isCommission(i.str)
      && !isCampus(i.str) && !isSchedule(i.str)).map(i => i.str).join(' ');
    return {
      code: a.str,
      name,
      period: take(isPeriod).join(' '),
      commission: take(isCommission)[0] || '',
      campus: (take(isCampus)[0] || '').replace(/^sede\s+/i, ''),
      sessions: parseScheduleText(take(isSchedule).join(' ')),
    };
  });
  const student = clean.find(i => /^\d{3}\.\d{3}-\d\b/.test(i.str));
  return { legajo: student ? student.str.split(' ')[0] : null, entries };
}

// Materia de la carrera que corresponde a una fila del comprobante: por código (las
// electivas usan el código del SIU) y si no, por nombre.
export function matchSubject(entry, careerSubjects) {
  const list = Array.isArray(careerSubjects) ? careerSubjects : [];
  const byCode = list.find(s => s.code === entry.code);
  if (byCode) return byCode.code;
  const name = normalize(entry.name);
  const byName = list.find(s => normalize(s.name) === name);
  return byName ? byName.code : null;
}

// Ítems de texto de todas las páginas del PDF, con pdf.js (se carga recién acá).
export async function readPdfItems(file) {
  const base = new URL('../lib/pdfjs/', import.meta.url);
  const pdfjs = await import(new URL('pdf.min.js', base).href);
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.js', base).href;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const items = [];
  // Cada página se corre hacia abajo para que las filas no se mezclen entre páginas.
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const offset = (p - 1) * 2000;
    const tc = await page.getTextContent();
    tc.items.forEach(i => items.push({ str: i.str, x: i.transform[4], y: i.transform[5] - offset }));
  }
  return items;
}

// --- UI ---

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const COLORS = 8;
const NOT_CURSANDO = ['Aprobada', 'Promocionada', 'Regularizada'];

// ctx: { getStore, getEnrollments, getEnrollment(code), getSubjectName(code),
//        getCareerSubjects() -> [{code, name, elective}], getAvailableCodes(),
//        startCursada(codes) -> marca esas materias en curso en el tablero }
export function initSchedule(ctx) {
  const modalEl = document.getElementById('scheduleModal');
  if (!modalEl) return;
  const $ = id => document.getElementById(id);
  const mainEl = $('schedule-main');
  const importEl = $('schedule-import');
  const summaryEl = $('schedule-summary');
  const gridEl = $('schedule-grid');
  const daysEl = $('schedule-days');
  const subjectsEl = $('schedule-subjects');
  const form = $('schedule-form');
  const formTitle = $('schedule-form-title');
  const subjectSel = $('schedule-subject');
  const rowsEl = $('schedule-rows');
  const commissionInput = $('schedule-commission');
  const campusInput = $('schedule-campus');
  const formError = $('schedule-form-error');
  const saveBtn = $('schedule-save');
  const removeBtn = $('schedule-remove');
  const cancelBtn = $('schedule-cancel');
  const fileInput = $('schedule-file');

  let sessions = [];
  let showAllShifts = false;
  let mobileDay = Math.min(Math.max(new Date().getDay() - 1, 0), 5);
  let editing = null; // código de la materia que se está editando
  let pendingImport = null;
  let dragged = []; // filas elegidas arrastrando sobre la grilla, todavía sin guardar

  const nameOf = code => ctx.getSubjectName(code) || code;

  function colorOf(code) {
    const codes = [...groupBySubject(sessions).keys()];
    const i = codes.indexOf(code);
    return i < 0 ? 0 : i % COLORS;
  }

  // --- Grilla ---

  function renderSummary() {
    const groups = groupBySubject(sessions);
    const blocks = sessions.reduce((n, s) => n + rowsFor(s.start, s.end).length, 0);
    summaryEl.textContent = groups.size
      ? `${groups.size} ${groups.size === 1 ? 'materia' : 'materias'} · ${blocks} bloques por semana`
      : 'Cargá tus materias a mano o importá el comprobante de inscripción.';
  }

  function renderGrid() {
    const shifts = visibleShifts(sessions, showAllShifts);
    const rowIdx = ROWS.map((r, i) => i).filter(i => ROWS[i].shifts.some(sh => shifts.includes(sh)));
    // Pistas de la grilla: encabezado, y por cada fila visible una pista (más un
    // espacio entre turnos y en el corte de 15 minutos).
    const tracks = ['auto'];
    const trackOf = {};
    let prevShift = null;
    rowIdx.forEach((i, k) => {
      const row = ROWS[i];
      const shift = row.shifts.find(sh => shifts.includes(sh));
      const prev = k > 0 ? ROWS[rowIdx[k - 1]] : null;
      if (prev && toMinutes(row.start) - toMinutes(prev.end) > 0) {
        tracks.push(shift !== prevShift ? '14px' : '5px');
      }
      tracks.push('var(--sch-row)');
      trackOf[i] = tracks.length; // líneas de grid empiezan en 1
      prevShift = shift;
    });

    let html = `<div class="sch-grid" style="grid-template-rows:${tracks.join(' ')}">`;
    html += '<div></div>' + WEEKDAYS.map((d, i) => `<div class="sch-day" style="grid-column:${i + 2}">${d}</div>`).join('');
    let lastShift = null;
    rowIdx.forEach(i => {
      const row = ROWS[i];
      const shift = row.shifts.find(sh => shifts.includes(sh));
      const label = row.ids.filter(id => shifts.includes(id[0])).join('/');
      html += `<div class="sch-label" style="grid-row:${trackOf[i]}">`
        + (shift !== lastShift ? `<span class="sch-shift">${SHIFTS[shift]}</span>` : '')
        + `<b>${label}</b> ${row.start}</div>`;
      lastShift = shift;
      for (let d = 0; d < 6; d++) {
        html += `<div class="sch-cell" data-day="${d}" data-row="${i}" style="grid-row:${trackOf[i]};grid-column:${d + 2}"></div>`;
      }
    });
    sessions.forEach((s, k) => {
      const rows = rowsFor(s.start, s.end).filter(i => trackOf[i]);
      if (!rows.length) return;
      const from = trackOf[rows[0]];
      const to = trackOf[rows[rows.length - 1]] + 1;
      const name = nameOf(s.subjectCode);
      const extra = [s.commission, s.campus].filter(Boolean).join(' · ');
      html += `<button type="button" class="sch-block sch-c${colorOf(s.subjectCode)}${editing === s.subjectCode ? ' sch-editing' : ''}" data-code="${esc(s.subjectCode)}" data-k="${k}"
        style="grid-row:${from} / ${to};grid-column:${s.weekday + 2}" title="${esc(`${name}\n${sessionLabel(s)}${extra ? `\n${extra}` : ''}`)}">
        <span class="sch-block-name">${esc(shortName(s.subjectCode, name))}</span>
        <span class="sch-block-time">${esc(s.start)} a ${esc(s.end)}</span>
        ${rows.length > 2 && extra ? `<span class="sch-block-time">${esc(extra)}</span>` : ''}
      </button>`;
    });
    html += '</div>';
    const hidden = ['M', 'T', 'N'].filter(sh => !shifts.includes(sh));
    if (hidden.length || showAllShifts) {
      html += `<button type="button" class="btn btn-link btn-sm px-0 mt-1" data-action="toggle-shifts">${showAllShifts && sessions.length
        ? 'Mostrar solo los turnos con clases'
        : `Mostrar turno ${hidden.map(sh => SHIFTS[sh].toLowerCase()).join(' y ')}`}</button>`;
    }
    gridEl.innerHTML = html;
  }

  function renderDays() {
    const today = sessions.filter(s => s.weekday === mobileDay);
    let html = `<ul class="nav nav-pills nav-fill small mb-3" role="tablist">${WEEKDAYS.map((d, i) => `
      <li class="nav-item"><button type="button" class="nav-link px-1 py-1${i === mobileDay ? ' active' : ''}" data-day="${i}">${d}${sessions.some(s => s.weekday === i) ? '' : '<span class="visually-hidden"> (sin clases)</span>'}</button></li>`).join('')}</ul>`;
    html += today.length
      ? today.map(s => `
        <button type="button" class="sch-day-item sch-c${colorOf(s.subjectCode)} w-100 text-start mb-2" data-code="${esc(s.subjectCode)}">
          <span class="sch-day-time">${esc(s.start)}<br>${esc(s.end)}</span>
          <span class="flex-grow-1 min-w-0"><span class="fw-semibold d-block">${esc(nameOf(s.subjectCode))}</span>
          <span class="small text-body-secondary">${esc([blockRange(s.start, s.end), s.commission, s.campus && `Sede ${s.campus}`].filter(Boolean).join(' · '))}</span></span>
        </button>`).join('')
      : '<p class="text-body-secondary text-center my-3">Sin clases este día.</p>';
    daysEl.innerHTML = html;
  }

  function renderSubjects() {
    const groups = [...groupBySubject(sessions).values()];
    subjectsEl.innerHTML = groups.length ? `<ul class="list-group">${groups.map(g => `
      <li class="list-group-item list-group-item-action d-flex align-items-center gap-2 px-2 py-2${editing === g.subjectCode ? ' active' : ''}" role="button" tabindex="0" data-code="${esc(g.subjectCode)}">
        <span class="sch-dot sch-c${colorOf(g.subjectCode)}" aria-hidden="true"></span>
        <span class="flex-grow-1 min-w-0 small">
          <span class="fw-semibold d-block text-truncate">${esc(nameOf(g.subjectCode))}</span>
          <span class="d-block text-truncate${editing === g.subjectCode ? '' : ' text-body-secondary'}">${esc(g.sessions.map(sessionLabel).join(' · '))}</span>
        </span>
        ${g.commission ? `<span class="small text-nowrap${editing === g.subjectCode ? '' : ' text-body-secondary'}">${esc(g.commission)}</span>` : ''}
      </li>`).join('')}</ul>` : '';
  }

  function renderAll() {
    renderSummary();
    renderGrid();
    renderDays();
    renderSubjects();
  }

  // --- Formulario ---

  function subjectChoices() {
    const scheduled = new Set(sessions.map(s => s.subjectCode));
    const cursando = (ctx.getEnrollments() || [])
      .filter(e => e && e.subjectCode && !NOT_CURSANDO.includes(e.status))
      .map(e => e.subjectCode);
    const codes = [...new Set([...cursando, ...scheduled])];
    return codes.map(code => ({ code, name: nameOf(code) })).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  function options(list, selected) {
    return list.map(o => `<option value="${esc(o.value)}"${o.value === selected ? ' selected' : ''}>${esc(o.label)}</option>`).join('');
  }

  function rowHtml(r = {}) {
    const start = r.start || '';
    return `<div class="row g-1 mb-1 align-items-center schedule-row">
      <div class="col-3"><select class="form-select form-select-sm" data-field="weekday" aria-label="Día">
        ${options(WEEKDAYS.map((d, i) => ({ value: String(i), label: d })), r.weekday !== undefined ? String(r.weekday) : '')}</select></div>
      <div class="col-4"><select class="form-select form-select-sm" data-field="start" aria-label="Desde">
        <option value="">Desde</option>${options(startOptions(), start)}</select></div>
      <div class="col-4"><select class="form-select form-select-sm" data-field="end" aria-label="Hasta">
        <option value="">Hasta</option>${options(endOptions(start || null), r.end || '')}</select></div>
      <div class="col-1 text-center"><button type="button" class="btn btn-sm btn-icon px-1" data-action="remove-row" title="Quitar este día" aria-label="Quitar este día"><i class="bi bi-trash" aria-hidden="true"></i></button></div>
    </div>`;
  }

  function readRows() {
    return [...rowsEl.querySelectorAll('.schedule-row')].map(el => ({
      weekday: Number(el.querySelector('[data-field="weekday"]').value),
      start: el.querySelector('[data-field="start"]').value,
      end: el.querySelector('[data-field="end"]').value,
    }));
  }

  function setFormRows(rows) {
    rowsEl.innerHTML = (rows.length ? rows : [{}]).map(rowHtml).join('');
  }

  function fillForm(code, rows) {
    const choices = subjectChoices();
    subjectSel.innerHTML = choices.length
      ? '<option value="">Elegí una materia…</option>' + choices.map(c => `<option value="${esc(c.code)}">${esc(c.name)}</option>`).join('')
      : '<option value="">No tenés materias en curso</option>';
    subjectSel.value = code && choices.some(c => c.code === code) ? code : '';
    const group = groupBySubject(sessions).get(subjectSel.value);
    editing = group ? subjectSel.value : null;
    setFormRows(rows || (group ? group.sessions : []));
    commissionInput.value = group ? group.commission : '';
    campusInput.value = group ? group.campus : '';
    formTitle.textContent = editing ? 'Editar horario' : 'Cargar a mano';
    removeBtn.classList.toggle('d-none', !editing);
    cancelBtn.classList.toggle('d-none', !editing);
    formError.classList.add('d-none');
    saveBtn.disabled = !choices.length;
    renderGrid();
    renderSubjects();
  }

  function showError(msg) {
    formError.textContent = msg;
    formError.classList.toggle('d-none', !msg);
  }

  async function saveSubject(code, data) {
    sessions = await ctx.getStore().saveSubjectSchedule(code, data);
  }

  // Elegir la materia después de arrastrar sobre la grilla suma esos días a los que
  // ya tenía cargados.
  subjectSel.addEventListener('change', () => {
    const group = groupBySubject(sessions).get(subjectSel.value);
    fillForm(subjectSel.value, dragged.length ? (group ? group.sessions : []).concat(dragged) : undefined);
  });

  rowsEl.addEventListener('change', ev => {
    if (ev.target.dataset.field !== 'start') return;
    const row = ev.target.closest('.schedule-row');
    const endSel = row.querySelector('[data-field="end"]');
    const keep = endSel.value;
    endSel.innerHTML = `<option value="">Hasta</option>${options(endOptions(ev.target.value), keep)}`;
    if (toMinutes(keep) !== null && toMinutes(keep) <= toMinutes(ev.target.value)) endSel.value = '';
  });

  form.addEventListener('click', ev => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'add-row') {
      rowsEl.insertAdjacentHTML('beforeend', rowHtml());
    } else if (btn.dataset.action === 'remove-row') {
      btn.closest('.schedule-row').remove();
      if (!rowsEl.children.length) setFormRows([]);
    }
  });

  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const code = subjectSel.value;
    if (!code) { showError('Elegí la materia.'); subjectSel.focus(); return; }
    const rows = readRows();
    const err = validateRows(rows);
    if (err) { showError(err); return; }
    const clash = findOverlap(sessions, code, rows);
    if (clash) {
      showError(`Se pisa con ${nameOf(clash.session.subjectCode)} (${sessionLabel(clash.session)}). Revisá los horarios.`);
      return;
    }
    showError('');
    dragged = [];
    setBusy(saveBtn, true);
    try {
      await saveSubject(code, { sessions: rows, commission: commissionInput.value, campus: campusInput.value });
      editing = null;
      renderAll();
      fillForm(null);
    } catch (e) {
      toastError('No se pudo guardar el horario', e);
    } finally {
      setBusy(saveBtn, false);
    }
  });

  removeBtn.addEventListener('click', async () => {
    const code = editing;
    if (!code) return;
    setBusy(removeBtn, true);
    try {
      await saveSubject(code, { sessions: [] });
      editing = null;
      renderAll();
      fillForm(null);
    } catch (e) {
      toastError('No se pudo quitar la materia del horario', e);
    } finally {
      setBusy(removeBtn, false);
    }
  });

  cancelBtn.addEventListener('click', () => { editing = null; dragged = []; fillForm(null); renderSubjects(); });

  // Click en una materia (grilla, lista del día o lista de materias): editarla.
  function onPickSubject(ev) {
    const el = ev.target.closest('[data-code]');
    if (!el) return;
    dragged = [];
    fillForm(el.dataset.code);
    subjectSel.focus();
  }
  gridEl.addEventListener('click', ev => {
    if (ev.target.closest('[data-action="toggle-shifts"]')) { showAllShifts = !showAllShifts; renderGrid(); return; }
    onPickSubject(ev);
  });
  subjectsEl.addEventListener('click', onPickSubject);
  subjectsEl.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onPickSubject(ev); } });
  daysEl.addEventListener('click', ev => {
    const tab = ev.target.closest('[data-day]');
    if (tab) { mobileDay = Number(tab.dataset.day); renderDays(); return; }
    onPickSubject(ev);
  });

  // Arrastrar sobre celdas libres de un mismo día: completa una fila del formulario
  // con ese día y esos bloques (puede cruzar de turno).
  let drag = null;
  function paintDrag() {
    gridEl.querySelectorAll('.sch-cell.sch-sel').forEach(c => c.classList.remove('sch-sel'));
    if (!drag) return;
    const [a, b] = [Math.min(drag.from, drag.to), Math.max(drag.from, drag.to)];
    gridEl.querySelectorAll(`.sch-cell[data-day="${drag.day}"]`).forEach(c => {
      const r = Number(c.dataset.row);
      if (r >= a && r <= b) c.classList.add('sch-sel');
    });
  }
  gridEl.addEventListener('pointerdown', ev => {
    const cell = ev.target.closest('.sch-cell');
    if (!cell || ev.button !== 0) return;
    ev.preventDefault();
    drag = { day: Number(cell.dataset.day), from: Number(cell.dataset.row), to: Number(cell.dataset.row) };
    paintDrag();
  });
  gridEl.addEventListener('pointerover', ev => {
    if (!drag) return;
    const cell = ev.target.closest('.sch-cell');
    if (!cell || Number(cell.dataset.day) !== drag.day) return;
    drag.to = Number(cell.dataset.row);
    paintDrag();
  });
  document.addEventListener('pointerup', () => {
    if (!drag) return;
    const [a, b] = [Math.min(drag.from, drag.to), Math.max(drag.from, drag.to)];
    const row = { weekday: drag.day, start: ROWS[a].start, end: ROWS[b].end };
    drag = null;
    paintDrag();
    dragged.push(row);
    const rows = readRows().filter(r => r.start && r.end);
    setFormRows(rows.concat(row));
    showError('');
    subjectSel.focus();
  });

  // --- Importar el comprobante ---

  $('schedule-import-btn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (file) processFile(file);
  });

  // Lee el PDF y muestra la revisión. Si el modal está cerrado (llamado desde
  // afuera, ej. el onboarding), lo abre y espera a que cargue el horario.
  async function processFile(file) {
    if (!modalEl.classList.contains('show')) {
      bootstrap.Modal.getOrCreateInstance(modalEl).show();
    }
    await loaded;
    const btn = $('schedule-import-btn');
    setBusy(btn, true);
    try {
      const parsed = parseComprobante(await readPdfItems(file));
      if (!parsed || !parsed.entries.length) {
        toastError('No encontramos materias en ese PDF. ¿Es el comprobante de inscripción a cursada del SIU?');
        return;
      }
      openImport(file.name, parsed);
    } catch (e) {
      toastError('No se pudo leer el PDF', e);
    } finally {
      setBusy(btn, false);
    }
  }

  // Punto de entrada para otras pantallas: openScheduleImport() (abajo) dispara
  // este evento. Con archivo lo procesa; sin archivo abre el selector (tiene que
  // llamarse desde un click para que el navegador lo permita).
  document.addEventListener(IMPORT_EVENT, ev => {
    const file = ev.detail && ev.detail.file;
    if (file) processFile(file);
    else fileInput.click();
  });

  function boardState(code) {
    if (!code) return { kind: 'none', label: 'No está en tu carrera' };
    const enr = ctx.getEnrollment(code);
    if (enr && !NOT_CURSANDO.includes(enr.status)) return { kind: 'ok', label: 'En curso' };
    if (enr) return { kind: 'other', label: enr.status };
    const subject = (ctx.getCareerSubjects() || []).find(s => s.code === code);
    if (subject && !subject.elective && (ctx.getAvailableCodes() || []).includes(code)) return { kind: 'start', label: 'Se marca en curso' };
    return { kind: 'other', label: 'Sin empezar en el tablero' };
  }

  function openImport(fileName, parsed) {
    const careerSubjects = ctx.getCareerSubjects() || [];
    pendingImport = parsed.entries.map(e => {
      const subjectCode = matchSubject(e, careerSubjects);
      return { ...e, subjectCode, include: !!subjectCode && e.sessions.length > 0 };
    });
    $('schedule-import-file').textContent = [fileName, parsed.legajo && `Legajo ${parsed.legajo}`].filter(Boolean).join(' · ');
    renderImport();
    mainEl.classList.add('d-none');
    importEl.classList.remove('d-none');
    $('schedule-footer-main').classList.add('d-none');
    $('schedule-footer-import').classList.remove('d-none');
  }

  function closeImport() {
    pendingImport = null;
    importEl.classList.add('d-none');
    mainEl.classList.remove('d-none');
    $('schedule-footer-import').classList.add('d-none');
    $('schedule-footer-main').classList.remove('d-none');
  }

  function renderImport() {
    const careerSubjects = (ctx.getCareerSubjects() || []).slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const incomplete = pendingImport.filter(e => e.sessions.some(s => !s.end));
    const unmatched = pendingImport.filter(e => !e.subjectCode);
    const notes = [];
    if (unmatched.length) notes.push(`${unmatched.length === 1 ? 'Una materia no coincide' : `${unmatched.length} materias no coinciden`} con tu carrera: elegí a cuál corresponde${unmatched.length === 1 ? '' : 'n'} o destildala${unmatched.length === 1 ? '' : 's'}.`);
    if (incomplete.length) notes.push(`El PDF corta el horario de ${incomplete.map(e => e.name).join(', ')}: completá a qué hora termina.`);
    const alert = $('schedule-import-alert');
    alert.className = `alert ${notes.length ? 'alert-warning' : 'alert-success'} py-2 small`;
    alert.innerHTML = `Encontramos <strong>${pendingImport.length} ${pendingImport.length === 1 ? 'materia' : 'materias'}</strong>. ${notes.length ? esc(notes.join(' ')) : 'Revisá antes de guardar.'}`;

    $('schedule-import-rows').innerHTML = pendingImport.map((e, i) => {
      const state = boardState(e.subjectCode);
      const badge = { ok: 'text-bg-primary', start: 'text-bg-warning', other: 'text-bg-secondary', none: 'text-bg-danger' }[state.kind];
      const meta = [e.code, e.commission, e.campus].filter(Boolean).join(' · ');
      const subjectCell = e.subjectCode
        ? `<div class="fw-semibold">${esc(nameOf(e.subjectCode))}</div><div class="text-body-secondary">${esc(meta)}</div>`
        : `<div class="fw-semibold">${esc(e.name)}</div><div class="text-body-secondary">${esc(meta)}</div>
           <select class="form-select form-select-sm mt-1" data-i="${i}" data-field="subject" aria-label="Materia de la carrera para ${esc(e.name)}">
             <option value="">Elegí la materia…</option>${careerSubjects.map(s => `<option value="${esc(s.code)}">${esc(s.name)}</option>`).join('')}
           </select>`;
      const times = e.sessions.map((s, k) => s.end
        ? `<div>${esc(sessionLabel(s))} <span class="text-body-secondary">· ${esc(blockRange(s.start, s.end))}</span></div>`
        : `<div class="d-flex align-items-center gap-1 flex-wrap">${esc(WEEKDAYS[s.weekday])} ${esc(s.start)} a
            <select class="form-select form-select-sm w-auto border-warning" data-i="${i}" data-k="${k}" data-field="end" aria-label="Hora de fin">
              <option value="">¿hasta?</option>${options(endOptions(s.start), '')}</select></div>`).join('');
      return `<tr>
        <td><input class="form-check-input" type="checkbox" data-i="${i}" data-field="include" ${e.include ? 'checked' : ''} ${e.sessions.length ? '' : 'disabled'} aria-label="Importar ${esc(e.name)}"></td>
        <td>${subjectCell}<span class="badge ${badge} mt-1">${esc(state.label)}</span></td>
        <td>${times || '<span class="text-body-secondary">Sin horario</span>'}</td>
      </tr>`;
    }).join('');
    updateImportButton();
  }

  function selectedImports() {
    return (pendingImport || []).filter(e => e.include);
  }

  function updateImportButton() {
    const n = selectedImports().length;
    $('schedule-import-save').innerHTML = `<i class="bi bi-check-lg me-1" aria-hidden="true"></i>Guardar ${n} ${n === 1 ? 'materia' : 'materias'}`;
    $('schedule-import-save').disabled = n === 0;
  }

  importEl.addEventListener('change', ev => {
    const el = ev.target;
    const entry = pendingImport && pendingImport[Number(el.dataset.i)];
    if (!entry) return;
    if (el.dataset.field === 'subject') {
      entry.subjectCode = el.value || null;
      entry.include = !!entry.subjectCode;
      renderImport();
    } else if (el.dataset.field === 'end') {
      entry.sessions[Number(el.dataset.k)].end = el.value || null;
      el.classList.toggle('border-warning', !el.value);
    } else if (el.dataset.field === 'include') {
      entry.include = el.checked;
      updateImportButton();
    }
  });

  $('schedule-import-cancel').addEventListener('click', closeImport);

  $('schedule-import-save').addEventListener('click', async () => {
    const chosen = selectedImports();
    const missingSubject = chosen.find(e => !e.subjectCode);
    if (missingSubject) { toastError(`Elegí a qué materia corresponde ${missingSubject.name}, o destildala.`); return; }
    const missingEnd = chosen.find(e => e.sessions.some(s => !s.end));
    if (missingEnd) { toastError(`Completá a qué hora termina ${missingEnd.name}.`); return; }
    const payload = chosen.map(e => ({ subjectCode: e.subjectCode, commission: e.commission, campus: e.campus, sessions: e.sessions }));
    const replace = $('schedule-import-replace').checked;
    const toStart = chosen.filter(e => boardState(e.subjectCode).kind === 'start').map(e => e.subjectCode);
    const btn = $('schedule-import-save');
    setBusy(btn, true);
    try {
      if (replace) {
        sessions = await ctx.getStore().replaceClassSchedule(payload);
      } else {
        for (const p of payload) await saveSubject(p.subjectCode, p);
      }
      if (toStart.length) await ctx.startCursada(toStart);
      closeImport();
      renderAll();
      fillForm(null);
    } catch (e) {
      toastError('No se pudo guardar el horario', e);
    } finally {
      setBusy(btn, false);
    }
  });

  // --- Abrir ---

  let loaded = Promise.resolve();
  modalEl.addEventListener('show.bs.modal', () => { loaded = load(); });

  async function load() {
    closeImport();
    editing = null;
    dragged = [];
    gridEl.innerHTML = '<div class="d-flex justify-content-center p-4"><div class="spinner-border text-secondary" role="status"><span class="visually-hidden">Cargando…</span></div></div>';
    try {
      sessions = await ctx.getStore().getClassSchedule();
    } catch (e) {
      sessions = [];
      toastError('No se pudo cargar tu horario', e);
    }
    const days = new Set(sessions.map(s => s.weekday));
    if (days.size && !days.has(mobileDay)) mobileDay = Math.min(...days);
    renderAll();
    fillForm(null);
  }
}

// Importar el comprobante de inscripción a cursada desde cualquier lado (perfil,
// onboarding): sin archivo abre el selector de archivos (llamar desde un click),
// con un File lo lee y abre el horario con la revisión de lo importado.
const IMPORT_EVENT = 'utn:schedule-import';
export function openScheduleImport(file = null) {
  document.dispatchEvent(new CustomEvent(IMPORT_EVENT, { detail: { file } }));
}
