// Importar la "historia académica" del SIU Guaraní (PDF) al tablero.
//
// Pensado para quien empieza a usar la app a mitad de la carrera: en vez de cargar
// materia por materia, sube el PDF que genera el SIU y se cargan solas las materias
// aprobadas, promocionadas, regularizadas y en curso, con sus notas y recursadas.
//
// El PDF se lee en el navegador (pdfText.js) y nunca se sube al servidor: lo único
// que se manda son las mismas llamadas del store que hace la carga manual.
//
// Cómo se interpreta cada fila (criterio del SIU / UTN):
// - Regularidad: la cursada. Aprobada = materia regularizada (la nota es la de la
//   cursada). Reprobada = una recursada más para el contador.
// - Examen: un final. Aprobado = materia aprobada por final, con la nota del examen.
//   Reprobado = un aplazo (queda cargado como intento de final).
// - Promocion: materia aprobada por promoción, con esa nota.
// - En curso: la materia se está cursando ahora.

import { computeStatus } from './statusEngine.js';
import { extractPdfTextItems } from './pdfText.js';
import { toast, toastError, setBusy } from './ui.js';

export const SIU_HISTORIA_URL = 'https://guarani.frba.utn.edu.ar/autogestion/grado/historia_academica';
const MAX_FINALS = 4;
const HEADERS = ['actividad', 'fecha', 'tipo', 'nota', 'resultado'];

// --- Texto ---

export function normalizeText(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function toIsoDate(str) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(str || '').trim());
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

function parseGrade(str) {
  const m = /^\s*(\d{1,2})(?:[.,]\d+)?\s*$/.exec(String(str ?? ''));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 10 ? n : null;
}

// --- PDF → filas ---

// Agrupa los ítems de texto (de pdfText.js) en las filas de la tabla
// Actividad | Fecha | Tipo | Nota | Resultado, usando la posición x de los
// encabezados de cada página para saber a qué columna va cada texto.
export function parseHistoriaAcademica(items) {
  const list = Array.isArray(items) ? items : [];
  const out = { career: null, student: null, rows: [] };

  const pages = new Map();
  for (const it of list) {
    if (!pages.has(it.page)) pages.set(it.page, []);
    pages.get(it.page).push(it);
  }

  let columns = null;
  let foundHeader = false;
  for (const page of [...pages.keys()].sort((a, b) => a - b)) {
    const pageItems = pages.get(page);
    for (const it of pageItems) {
      const s = String(it.str).trim();
      if (!out.career && /^propuesta\s*:/i.test(s)) out.career = s.replace(/^propuesta\s*:\s*/i, '').trim();
      if (!out.student && /^alumno\s*:/i.test(s)) out.student = s.replace(/^alumno\s*:\s*/i, '').trim();
    }

    // Encabezados: la fila (misma y) que tiene "Actividad" y "Fecha".
    const actividad = pageItems.find(it => normalizeText(it.str) === 'actividad');
    let headerY = null;
    if (actividad) {
      const sameRow = pageItems.filter(it => Math.abs(it.y - actividad.y) < 2);
      const cols = {};
      for (const h of HEADERS) {
        const found = sameRow.find(it => normalizeText(it.str) === h);
        if (found) cols[h] = found.x;
      }
      if (cols.fecha !== undefined && cols.tipo !== undefined) {
        columns = cols;
        headerY = actividad.y;
        foundHeader = true;
      }
    }
    if (!columns) continue;

    // Filas: ítems debajo del encabezado agrupados por y (de arriba hacia abajo).
    const body = pageItems.filter(it => headerY === null || it.y < headerY - 1);
    const rowsByY = [];
    for (const it of body.sort((a, b) => b.y - a.y || a.x - b.x)) {
      let row = rowsByY.find(r => Math.abs(r.y - it.y) < 2);
      if (!row) { row = { y: it.y, cells: {} }; rowsByY.push(row); }
      const col = columnFor(columns, it.x);
      if (!col) continue;
      row.cells[col] = row.cells[col] ? `${row.cells[col]} ${String(it.str).trim()}` : String(it.str).trim();
    }

    for (const r of rowsByY) {
      const c = r.cells;
      const date = toIsoDate(c.fecha);
      if (!c.actividad || !date || !c.tipo) {
        // Nombre largo partido en dos líneas: la continuación no trae fecha.
        const prev = out.rows[out.rows.length - 1];
        if (c.actividad && !c.fecha && !c.tipo && prev && prev.page === page && !prev.siuCode) {
          Object.assign(prev, splitActivity(`${prev.name} ${c.actividad}`));
        }
        continue;
      }
      out.rows.push({
        page,
        ...splitActivity(c.actividad),
        date,
        type: c.tipo.trim(),
        grade: parseGrade(c.nota),
        gradeText: (c.nota || '').trim(),
        result: (c.resultado || '').trim(),
      });
    }
  }

  if (!foundHeader) throw new Error('not_historia_academica');
  return out;
}

function columnFor(columns, x) {
  let best = null;
  let bestX = -Infinity;
  for (const [name, colX] of Object.entries(columns)) {
    if (colX <= x + 3 && colX > bestX) { best = name; bestX = colX; }
  }
  return best;
}

function splitActivity(text) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  const m = /^(.*?)\s*\((\d{3,})\)\s*$/.exec(s);
  if (!m) return { name: s, siuCode: null };
  return { name: m[1].trim(), siuCode: Number(m[2]) };
}

// --- Filas → estado por materia ---

function kindOf(type) {
  const t = normalizeText(type);
  if (t.startsWith('regular')) return 'regularidad';
  if (t.startsWith('examen') || t.startsWith('final')) return 'examen';
  if (t.startsWith('promoc')) return 'promocion';
  if (t.startsWith('en curso') || t === 'cursando') return 'en_curso';
  if (t.startsWith('equival')) return 'equivalencia';
  return 'otro';
}

function isApproved(result) {
  const r = normalizeText(result);
  return r.startsWith('aprob') || r.startsWith('promoc');
}

const KIND_ORDER = { regularidad: 0, promocion: 1, equivalencia: 1, examen: 2, en_curso: 3, otro: 4 };

// Resume las filas de cada materia en lo que hay que cargar en el tablero:
// { siuCode, name, status, grade, regularGrade, enrollmentYear, retakes, finals, warnings }
// status: 'Promocionada' | 'Aprobada' | 'Regularizada' | 'En curso' | null (solo
// tiene cursadas reprobadas: no queda inscripta, solo suma recursadas).
export function summarizeSubjects(rows) {
  const groups = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const key = row.siuCode ?? `name:${normalizeText(row.name)}`;
    if (!groups.has(key)) groups.set(key, { siuCode: row.siuCode ?? null, name: row.name, rows: [] });
    groups.get(key).rows.push({ ...row, kind: kindOf(row.type) });
  }

  const out = [];
  for (const g of groups.values()) {
    const rs = g.rows.slice().sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
    const year = (row) => (row ? Number(row.date.slice(0, 4)) : null);
    const regs = rs.filter(r => r.kind === 'regularidad');
    const approvedRegs = regs.filter(r => isApproved(r.result));
    const lastReg = regs[regs.length - 1] || null;
    const lastApprovedReg = approvedRegs[approvedRegs.length - 1] || null;
    const retakes = regs.filter(r => !isApproved(r.result)).length;
    const approval = rs.find(r => ['promocion', 'examen', 'equivalencia'].includes(r.kind) && isApproved(r.result)) || null;
    const enCurso = rs.filter(r => r.kind === 'en_curso').pop() || null;
    const warnings = rs.filter(r => r.kind === 'otro').map(r => `Fila no reconocida: ${r.type} ${r.result}`.trim());

    // Finales rendidos con nota (aplazos y el aprobado), en orden, hasta el que aprobó.
    let finals = rs.filter(r => r.kind === 'examen' && r.grade !== null);
    if (approval && approval.kind === 'examen') finals = finals.filter(r => r.date <= approval.date);
    finals = finals.map(r => ({ grade: r.grade, examDate: r.date }));
    if (finals.length > MAX_FINALS) {
      warnings.push(`Tiene ${finals.length} finales rendidos; se cargan los últimos ${MAX_FINALS}.`);
      finals = finals.slice(-MAX_FINALS);
    }

    const s = {
      siuCode: g.siuCode,
      name: g.name,
      status: null,
      grade: null,
      regularGrade: lastApprovedReg ? lastApprovedReg.grade : null,
      enrollmentYear: null,
      retakes,
      finals: [],
      warnings,
    };

    if (approval) {
      s.status = approval.kind === 'promocion' ? 'Promocionada' : 'Aprobada';
      s.grade = approval.grade;
      s.enrollmentYear = year(lastApprovedReg) ?? year(approval);
      s.finals = approval.kind === 'examen' ? finals : [];
      if (approval.kind === 'promocion' && s.regularGrade === null) s.regularGrade = approval.grade;
    } else if (enCurso && (!lastReg || enCurso.date >= lastReg.date)) {
      s.status = 'En curso';
      s.enrollmentYear = year(enCurso);
      s.regularGrade = null;
    } else if (lastApprovedReg && lastApprovedReg === lastReg) {
      s.status = 'Regularizada';
      s.enrollmentYear = year(lastApprovedReg);
      s.finals = finals;
    } else if (retakes === 0) {
      warnings.push('No se pudo determinar el estado de la materia.');
    }
    out.push(s);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

// --- Materias del SIU ↔ materias de la carrera ---

// Busca cada materia del PDF en el plan de la carrera activa: primero por el código
// del SIU (siuCode del curriculum, que es el id de la materia), después por nombre.
export function matchSubjects(summaries, curriculum) {
  const modules = Array.isArray(curriculum?.modules) ? curriculum.modules : [];
  const visible = modules.filter(m => m && m.render !== false);
  const bySiu = new Map();
  const byName = new Map();
  for (const m of modules) {
    const isElective = m.render === false || m.id === 'electives';
    for (const subj of Array.isArray(m.subjects) ? m.subjects : []) {
      const entry = { subject: subj, isElective, moduleIndex: isElective ? null : visible.indexOf(m) };
      if (subj.siuCode !== undefined && subj.siuCode !== null) bySiu.set(Number(subj.siuCode), entry);
      const n = normalizeText(subj.name);
      if (n && !byName.has(n)) byName.set(n, entry);
    }
  }
  const matched = [];
  const unmatched = [];
  for (const s of summaries) {
    const hit = (s.siuCode !== null && bySiu.get(Number(s.siuCode))) || byName.get(normalizeText(s.name));
    if (hit) matched.push({ ...s, ...hit, code: hit.subject.code });
    else unmatched.push(s);
  }
  return { matched, unmatched };
}

// Columna del tablero donde colocar una electiva importada: la primera con lugares
// de electiva libres (las ya colocadas ocupan uno cada una), o la última que tenga
// lugares si están todos ocupados.
export function pickElectiveColumn(curriculum, placedColumnIndexes) {
  const visible = (Array.isArray(curriculum?.modules) ? curriculum.modules : []).filter(m => m && m.render !== false);
  const used = {};
  for (const i of placedColumnIndexes || []) used[i] = (used[i] || 0) + 1;
  let last = null;
  for (let i = 0; i < visible.length; i++) {
    const slots = Number(visible[i].electivas) || 0;
    if (slots <= 0) continue;
    last = i;
    if ((used[i] || 0) < slots) return i;
  }
  return last ?? Math.max(visible.length - 1, 0);
}

// --- Qué cargar en cada materia ---

function fullChecklist(config) {
  const checklist = {};
  for (const [type, key] of [['tp', 'tp'], ['lab', 'labs']]) {
    const n = config?.[key] ?? 0;
    if (!n) continue;
    checklist[type] = {};
    for (let i = 1; i <= n; i++) checklist[type][i] = true;
  }
  return checklist;
}

// Esquema con el que se crea la inscripción: "libre" si solo hay final (sin
// cursada ni promoción), el estándar en el resto de los casos.
export function schemeFor(summary, schemes) {
  const codes = (schemes || []).map(s => s.code);
  if (summary.status === 'Aprobada' && summary.regularGrade === null && codes.includes('libre')) return 'libre';
  if (codes.includes('2-partials')) return '2-partials';
  return codes[0] || null;
}

// Notas a guardar (mismo formato que PUT /enrollments/{code}/results) y, si con
// esas notas el esquema no llega solo al estado del SIU, el override a aplicar.
// La nota de la cursada (o de la promoción) se carga en todos los parciales, así el
// tablero y el promedio muestran la misma nota que el SIU.
export function buildResults(summary, config) {
  const target = summary.status;
  if (!['Promocionada', 'Aprobada', 'Regularizada'].includes(target)) return null;
  const n = config?.partials ?? 2;
  const partialGrade = target === 'Promocionada' ? summary.grade : summary.regularGrade;
  const partials = {};
  if (partialGrade !== null && partialGrade !== undefined) {
    for (let p = 1; p <= n; p++) partials[p] = { 1: partialGrade, 2: null, 3: null };
  }
  const finals = {};
  (target === 'Promocionada' ? [] : summary.finals).forEach((f, i) => {
    finals[i + 1] = { grade: f.grade, examDate: f.examDate };
  });
  const checklist = fullChecklist(config);
  const finalsList = Object.keys(finals).map(k => ({ attemptNumber: Number(k), ...finals[k] }));
  const computed = computeStatus(config || {}, partials, finalsList, checklist, null);
  return { partials, finals, checklist, override: computed === target ? null : target };
}

// --- Aplicar ---

// Carga una materia en el store (invitado o API). `existing` es la inscripción
// actual (si la hay): se reutiliza su esquema y se pisan sus notas.
export async function applySubject(store, item, { existing, schemes, currentRetakes = 0 }) {
  const code = item.code;
  if (item.status) {
    let enrollment = existing;
    if (!enrollment) {
      enrollment = await store.createEnrollment(code, schemeFor(item, schemes));
    }
    if (item.enrollmentYear) {
      enrollment = await store.updateEnrollmentSettings(code, { enrollmentYear: item.enrollmentYear });
    }
    const plan = buildResults(item, enrollment.schemeConfig || {});
    if (plan) {
      enrollment = await store.saveResults(code, { partials: plan.partials, finals: plan.finals, checklist: plan.checklist });
      if (plan.override) enrollment = await store.setOverride(code, plan.override);
    }
    // "En curso": el SIU no tiene notas de parciales, así que si ya estaba cargada
    // se dejan las que haya puesto el usuario.
  }
  if (item.retakes > currentRetakes) {
    await store.setRecursedCount(code, item.retakes);
  }
}

// --- UI ---

const STATUS_BADGE = {
  Promocionada: 'text-bg-success',
  Aprobada: 'text-bg-success',
  Regularizada: 'text-bg-info',
  'En curso': 'text-bg-primary',
};

function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function statusLabel(item) {
  if (!item.status) return item.retakes ? 'Para recursar' : 'Sin estado';
  return item.status;
}

function detailLabel(item) {
  const parts = [];
  if (item.grade !== null && item.grade !== undefined && item.status !== 'Regularizada') parts.push(`Nota ${item.grade}`);
  if (item.status === 'Regularizada' && item.regularGrade !== null) parts.push(`Cursada ${item.regularGrade}`);
  const aplazos = (item.finals || []).filter(f => f.grade < 6).length;
  if (aplazos) parts.push(aplazos === 1 ? '1 aplazo' : `${aplazos} aplazos`);
  if (item.retakes) parts.push(item.retakes === 1 ? '1 recursada' : `${item.retakes} recursadas`);
  if (item.enrollmentYear) parts.push(String(item.enrollmentYear));
  return parts.join(' · ');
}

// ctx: {
//   getStore, getCurriculum, getCareerName, getEnrollment(code), getRetakes(code),
//   getSchemes, getElectivePlacements() → [{ subjectCode, columnIndex }],
//   placeElective(code, columnIndex), onImported()
// }
export function initSiuImport(ctx) {
  const modalEl = document.getElementById('siuImportModal');
  if (!modalEl) return;
  const fileInput = modalEl.querySelector('#siu-file');
  const dropZone = modalEl.querySelector('#siu-drop');
  const previewEl = modalEl.querySelector('#siu-preview');
  const importBtn = modalEl.querySelector('#siu-import-btn');
  const stepsEl = modalEl.querySelector('#siu-steps');
  let current = null; // { parsed, matched, unmatched }

  const reset = () => {
    current = null;
    previewEl.innerHTML = '';
    importBtn.classList.add('d-none');
    stepsEl.classList.remove('d-none');
    if (fileInput) fileInput.value = '';
  };

  async function handleFile(file) {
    if (!file) return;
    previewEl.innerHTML = '<div class="d-flex justify-content-center p-3"><div class="spinner-border text-secondary" role="status"><span class="visually-hidden">Leyendo…</span></div></div>';
    importBtn.classList.add('d-none');
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const items = await extractPdfTextItems(bytes);
      const parsed = parseHistoriaAcademica(items);
      const summaries = summarizeSubjects(parsed.rows);
      const curriculum = ctx.getCurriculum();
      if (!curriculum) throw new Error('no_curriculum');
      const { matched, unmatched } = matchSubjects(summaries, curriculum);
      current = { parsed, matched, unmatched };
      renderPreview();
    } catch (err) {
      console.error('Error leyendo la historia académica', err);
      current = null;
      const msg = {
        not_a_pdf: 'El archivo no es un PDF.',
        encrypted_pdf: 'El PDF está protegido y no se puede leer.',
        not_historia_academica: 'No parece ser la historia académica del SIU: no se encontró la tabla de actividades.',
        no_curriculum: 'Primero elegí tu carrera en el tablero.',
      }[err && err.message] || 'No se pudo leer el PDF.';
      previewEl.innerHTML = `<div class="alert alert-danger py-2 small mb-0">${esc(msg)}</div>`;
    }
  }

  function renderPreview() {
    const { parsed, matched, unmatched } = current;
    stepsEl.classList.add('d-none');
    const careerName = ctx.getCareerName() || '';
    let html = '';
    html += `<div class="d-flex flex-wrap justify-content-between align-items-baseline gap-2 mb-2">
      <div class="small">${parsed.student ? `<strong>${esc(parsed.student)}</strong> · ` : ''}${esc(parsed.career || '')}</div>
      <button type="button" class="btn btn-link btn-sm p-0" data-action="change-file">Elegir otro archivo</button>
    </div>`;
    if (parsed.career && careerName && !normalizeText(careerName).includes(normalizeText(parsed.career))) {
      html += `<div class="alert alert-warning py-2 small">El PDF es de <strong>${esc(parsed.career)}</strong> y en el tablero tenés elegida <strong>${esc(careerName)}</strong>. Solo se importan las materias que estén en el plan de la carrera elegida.</div>`;
    }
    if (!matched.length) {
      html += '<div class="alert alert-info py-2 small mb-0">Ninguna materia del PDF está en el plan de la carrera elegida.</div>';
      previewEl.innerHTML = html;
      importBtn.classList.add('d-none');
      return;
    }
    const anyExisting = matched.some(m => ctx.getEnrollment(m.code));
    if (anyExisting) {
      html += '<p class="small text-body-secondary mb-2">Las materias que ya tenés cargadas quedan sin marcar. Si las marcás, se reemplazan sus notas por las del SIU.</p>';
    }
    html += `<div class="table-responsive siu-table-wrap"><table class="table table-sm align-middle mb-2 siu-table">
      <thead><tr><th scope="col" class="siu-check"><input class="form-check-input" type="checkbox" id="siu-check-all" aria-label="Marcar todas"></th><th scope="col">Materia</th><th scope="col">Se carga como</th><th scope="col" class="d-none d-sm-table-cell">Detalle</th></tr></thead><tbody>`;
    matched.forEach((m, i) => {
      const existing = ctx.getEnrollment(m.code);
      const checked = !existing && (m.status || m.retakes);
      const badge = STATUS_BADGE[m.status] || 'text-bg-secondary';
      const notes = [];
      if (existing) notes.push(`Ya cargada (${esc(existing.status)})`);
      if (m.isElective) notes.push('Electiva');
      m.warnings.forEach(w => notes.push(esc(w)));
      html += `<tr>
        <td class="siu-check"><input class="form-check-input" type="checkbox" data-index="${i}" ${checked ? 'checked' : ''} ${!m.status && !m.retakes ? 'disabled' : ''} aria-label="Importar ${esc(m.subject.name)}"></td>
        <td><div>${esc(m.subject.name)}</div>${notes.length ? `<div class="small text-body-secondary">${notes.join(' · ')}</div>` : ''}<div class="small text-body-secondary d-sm-none">${esc(detailLabel(m))}</div></td>
        <td><span class="badge ${badge}">${esc(statusLabel(m))}</span></td>
        <td class="small text-body-secondary d-none d-sm-table-cell">${esc(detailLabel(m))}</td>
      </tr>`;
    });
    html += '</tbody></table></div>';
    if (unmatched.length) {
      html += `<details class="small"><summary class="text-body-secondary">${unmatched.length === 1 ? '1 materia del PDF no está' : `${unmatched.length} materias del PDF no están`} en el plan de esta carrera</summary>
        <ul class="mt-1 mb-0">${unmatched.map(u => `<li>${esc(u.name)}${u.siuCode ? ` <span class="text-body-secondary">(${u.siuCode})</span>` : ''}</li>`).join('')}</ul></details>`;
    }
    previewEl.innerHTML = html;
    importBtn.classList.remove('d-none');
    syncImportButton();
  }

  function selectedItems() {
    if (!current) return [];
    return [...previewEl.querySelectorAll('input[data-index]:checked')].map(el => current.matched[Number(el.dataset.index)]);
  }

  function syncImportButton() {
    const n = selectedItems().length;
    importBtn.disabled = n === 0;
    importBtn.textContent = n === 1 ? 'Importar 1 materia' : `Importar ${n} materias`;
    const all = previewEl.querySelector('#siu-check-all');
    const boxes = [...previewEl.querySelectorAll('input[data-index]:not(:disabled)')];
    if (all) {
      all.checked = boxes.length > 0 && boxes.every(b => b.checked);
      all.indeterminate = !all.checked && boxes.some(b => b.checked);
    }
  }

  previewEl.addEventListener('change', (ev) => {
    if (ev.target.id === 'siu-check-all') {
      previewEl.querySelectorAll('input[data-index]:not(:disabled)').forEach(b => { b.checked = ev.target.checked; });
    }
    syncImportButton();
  });
  previewEl.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-action="change-file"]')) { reset(); fileInput.click(); }
  });

  fileInput.addEventListener('change', () => handleFile(fileInput.files && fileInput.files[0]));
  if (dropZone) {
    dropZone.addEventListener('dragover', (ev) => { ev.preventDefault(); dropZone.classList.add('siu-drop-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('siu-drop-over'));
    dropZone.addEventListener('drop', (ev) => {
      ev.preventDefault();
      dropZone.classList.remove('siu-drop-over');
      const file = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (file) handleFile(file);
    });
  }

  importBtn.addEventListener('click', async () => {
    const items = selectedItems();
    if (!items.length) return;
    setBusy(importBtn, true);
    const store = ctx.getStore();
    const schemes = await ctx.getSchemes();
    const curriculum = ctx.getCurriculum();
    const placed = (ctx.getElectivePlacements() || []).map(e => ({ ...e }));
    const failed = [];
    for (const item of items) {
      try {
        await applySubject(store, item, {
          existing: ctx.getEnrollment(item.code),
          schemes,
          currentRetakes: ctx.getRetakes(item.code) || 0,
        });
        if (item.isElective && item.status && !placed.some(p => p.subjectCode === item.code)) {
          const col = pickElectiveColumn(curriculum, placed.map(p => p.columnIndex));
          await ctx.placeElective(item.code, col);
          placed.push({ subjectCode: item.code, columnIndex: col });
        }
      } catch (err) {
        console.error('Error importando', item.code, err);
        failed.push(item.subject.name);
      }
    }
    try { await ctx.onImported(); } catch (err) { console.error(err); }
    setBusy(importBtn, false);
    if (failed.length) {
      toastError(`No se pudieron importar: ${failed.join(', ')}`);
    }
    const ok = items.length - failed.length;
    if (ok > 0) {
      const inst = window.bootstrap && window.bootstrap.Modal.getInstance(modalEl);
      if (inst) inst.hide();
      toast(ok === 1 ? 'Se importó 1 materia del SIU.' : `Se importaron ${ok} materias del SIU.`, { variant: 'success' });
    }
  });

  modalEl.addEventListener('show.bs.modal', reset);
}
