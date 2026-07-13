// Share page JavaScript - Read-only public profile view. Consume GET /api/public/{id}
// (mismo shape que usa index.js: enrollments ya vienen con `status` calculado server-side).
import { api } from './apiClient.js';
import { getCareers, getCareerCurriculum } from './careers.js';

document.addEventListener('DOMContentLoaded', async () => {
  // El share view no tiene selector de carrera ni toggle de título intermedio (a
  // diferencia de index.js): siempre muestra la carrera activa del dueño del perfil
  // (preferences.activeCareerCode) y nunca las materias onlyForIntermediate.
  let currentCareer = null;
  let planData = null;
  let electivasList = [];
  let columns = 5;

  const columnsContainer = document.querySelector('.columns-grid');
  const statsTotalPeso = document.getElementById('stat-peso');
  const statsAvg = document.getElementById('stat-promedio');
  const statPlaceholder1 = document.getElementById('stat-placeholder-1');
  const statPlaceholder2 = document.getElementById('stat-placeholder-2');
  const statDisponibles = document.getElementById('stat-disponibles');
  const progressBar = document.getElementById('progress-bar');
  const progressLabel = document.getElementById('progress-label');
  let displayedSubjects = [];

  // Datos remotos (poblados por loadRemoteData() al inicio, ver más abajo)
  let enrollmentsByCode = {};
  let electivesList = [];

  function showAlert(message){
    const alertEl = document.getElementById('share-alert');
    if (!alertEl) return;
    alertEl.textContent = message;
    alertEl.classList.remove('d-none');
  }

  // Correlativas toggle
  const correlativasToggle = document.getElementById('toggle-correlativas');
  let correlativasEnabled = true;
  if (correlativasToggle) {
    correlativasToggle.checked = true;
    correlativasToggle.addEventListener('change', (ev) => {
      correlativasEnabled = !!ev.target.checked;
      if (!correlativasEnabled) {
        clearOverlay();
        if (columnsContainer) {
          const all = columnsContainer.querySelectorAll('.card-subject');
          all.forEach(c => {
            c.classList.remove('card-dim');
            c.classList.remove('card-highlight');
          });
        }
      }
    });
  }

  function loadSubjectData(code) {
    if (!code) return null;
    return enrollmentsByCode[code] || null;
  }

  function parseNum(v) {
    if (v === null || v === undefined || v === '') return NaN;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  function countPassedSubjects(subjects) {
    if (!Array.isArray(subjects)) return 0;
    return subjects.filter(s => {
      const key = (s.code && s.code.trim()) ? s.code : (s.name || '');
      const stored = key ? loadSubjectData(key) : null;
      const st = stored ? stored.status : null;
      return st === 'Aprobada' || st === 'Promocionada';
    }).length;
  }

  function getStatusDescription(status) {
    switch (status) {
      case 'Aprobada': return 'Aprobada';
      case 'Promocionada': return 'Promocionada';
      case 'Regularizada': return 'Regularizada';
      case 'Desaprobada': return 'Desaprobada';
      case 'No regularizada': return 'Debe recuperar';
      case 'Faltan notas': return 'En curso';
      default: return status || null;
    }
  }

  // Heurística de UI (no autoritativa) igual que en index.js.
  function canPromote(stored) {
    if (!stored || !stored.schemeConfig || !stored.partials) return false;
    const config = stored.schemeConfig;
    const highNote = config?.promotion?.high_note ?? 8;
    const n = config?.partials ?? 2;
    const partials = stored.partials || {};
    let closeCount = 0;
    let hasOpenRecovery = false;
    for (let p = 1; p <= n; p++) {
      const attempts = partials[p] || {};
      const a1 = attempts[1] ?? null;
      const a2 = attempts[2] ?? null;
      if (a1 !== null && a1 >= highNote) { closeCount++; continue; }
      if (a1 !== null && a1 >= 6 && a2 === null) hasOpenRecovery = true;
    }
    if (closeCount >= n) return false;
    return closeCount === n - 1 && hasOpenRecovery;
  }

  function applyCardStatusStyle(card, status) {
    if (!card) return;
    ['card-status-aprobada', 'card-status-desaprobada', 'card-status-promocionada', 'card-status-regularizada'].forEach(c => card.classList.remove(c));
    if (status === 'Faltan notas') status = null;

    const mapping = {
      'Aprobada': 'card-status-aprobada',
      'Desaprobada': 'card-status-desaprobada',
      'Promocionada': 'card-status-promocionada',
      'Regularizada': 'card-status-regularizada'
    };
    const cls = mapping[status];
    if (cls) card.classList.add(cls);

    try {
      let bc = card.querySelector('.card-badge-container');
      if (!bc) {
        const right = card.querySelector('.text-end');
        bc = document.createElement('div');
        bc.className = 'card-badge-container';
        if (right) right.appendChild(bc);
        else {
          const header = card.querySelector('.card-body');
          if (header) header.appendChild(bc);
        }
      }
      const weekHours = Number.isFinite(Number(card.dataset.weekHours)) ? Number(card.dataset.weekHours) : 6;
      const code = card.dataset && card.dataset.code ? card.dataset.code : null;
      const stored = code ? loadSubjectData(code) : null;
      bc.innerHTML = '';

      if (status === 'Aprobada') {
        let grade = null;
        try {
          if (stored && Array.isArray(stored.finals)) {
            const sorted = [...stored.finals].sort((a, b) => a.attemptNumber - b.attemptNumber);
            for (const f of sorted) {
              if (f && f.grade !== null && f.grade !== undefined && f.grade >= 6) { grade = f.grade; break; }
            }
          }
        } catch (e) {/* ignore */}
        if (grade !== null && !Number.isNaN(grade)) {
          const span = document.createElement('span');
          span.className = 'badge bg-success';
          span.style.fontSize = '0.8rem';
          span.textContent = String(grade);
          bc.appendChild(span);
        }
      } else if (status === 'Promocionada') {
        let sum = 0, count = 0;
        try {
          if (stored && stored.partials && stored.schemeConfig) {
            const n = stored.schemeConfig.partials ?? 2;
            for (let p = 1; p <= n; p++) {
              const attempts = stored.partials[p] || {};
              let eff = null;
              for (let a = 3; a >= 1; a--) { if (attempts[a] !== null && attempts[a] !== undefined) { eff = attempts[a]; break; } }
              if (eff !== null) { sum += eff; count++; }
            }
          }
        } catch (e) {/* ignore */}
        if (count > 0) {
          const avg = Math.round(sum / count);
          const span = document.createElement('span');
          span.className = 'badge bg-success';
          span.style.fontSize = '0.8rem';
          span.textContent = String(avg);
          bc.appendChild(span);
        }
      } else if (status === 'Regularizada') {
        // No badge for Regularizada
      } else {
        const span = document.createElement('span');
        span.className = 'badge bg-primary';
        span.style.fontSize = '0.8rem';
        const duration = card.dataset.duration || 'anual';
        const durationIndicator = duration === 'cuatrimestral' ? 'C' : 'A';
        span.textContent = `${weekHours} hs - ${durationIndicator}`;
        bc.appendChild(span);
      }
    } catch (e) {/* ignore badge errors */}
  }

  function cursarRequirementsMetForCard(card) {
    if (!card) return true;
    const reqObj = card.dataset.requirements ? JSON.parse(card.dataset.requirements) : { cursar: [] };
    const cursar = reqObj.cursar || [];
    if (!cursar || cursar.length === 0) return true;

    for (const r of cursar) {
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      if (!id) return false;
      const stored = loadSubjectData(id);
      const status = stored ? stored.status : null;
      if (!status) return false;
      const type = (typeof r === 'object' && r.type) ? r.type : 'aprobada';
      if (type === 'regularizada') {
        if (['Regularizada', 'Aprobada', 'Promocionada'].includes(status)) continue;
        return false;
      } else {
        if (['Aprobada', 'Promocionada'].includes(status)) continue;
        return false;
      }
    }
    return true;
  }

  function updateAllCardCursarState() {
    try {
      if (!columnsContainer) return;
      const all = columnsContainer.querySelectorAll('.card-subject');
      all.forEach(c => {
        try {
          if (c.classList.contains('card-electiva-placeholder')) return;
          const meets = cursarRequirementsMetForCard(c);
          if (!meets) {
            c.classList.add('card-disabled');
            c.setAttribute('aria-disabled', 'true');
          } else {
            c.classList.remove('card-disabled');
            c.removeAttribute('aria-disabled');
          }
          try {
            const code = c.dataset && c.dataset.code ? c.dataset.code : null;
            const stored = code ? loadSubjectData(code) : null;
            if (meets && !stored) c.classList.add('card-available');
            else c.classList.remove('card-available');
          } catch (e) {/* ignore per-card */}
        } catch (e) {/* ignore per-card errors */}
      });
    } catch (e) { console.error('Error actualizando estado de cursar en cards', e); }
  }

  function renderGroups(data) {
    const modules = Array.isArray(data.modules) ? data.modules : [];
    const visibleModules = modules.filter(m => m && m.render !== false);
    if (visibleModules.length === 0) {
      columnsContainer.innerHTML = '<div class="alert alert-info">No hay módulos disponibles.</div>';
      return;
    }

    columns = Math.min(Math.max(visibleModules.length, 1), 8);
    columnsContainer.innerHTML = '';
    columnsContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    visibleModules.forEach((module, visIdx) => {
      const col = document.createElement('div');
      col.className = 'column-col';
      col.dataset.index = visIdx;

      const header = document.createElement('div');
      header.className = 'mb-2';
      // El share view nunca muestra materias onlyForIntermediate (ej. Seminario
      // Integrador) — no hay toggle de título intermedio acá, a diferencia de index.js.
      const subjects = (Array.isArray(module.subjects) ? module.subjects : []).filter(s => !s.onlyForIntermediate);
      const modulePassed = countPassedSubjects(subjects);
      header.innerHTML = `<strong>${escapeHtml(module.name)}</strong> <span class="text-muted small">${modulePassed}/${subjects.length}</span>`;
      col.appendChild(header);

      subjects.forEach(subj => col.appendChild(createCard(subj, module)));

      const electivasCount = Number.isFinite(Number(module.electivas)) ? Number(module.electivas) : 0;
      for (let i = 0; i < electivasCount; i++) {
        const placed = getPlacedElectiveForSlot(visIdx, i);
        if (placed) col.appendChild(createElectivaCard(placed));
        else col.appendChild(createEmptyElectivaPlaceholder());
      }

      columnsContainer.appendChild(col);
    });

    displayedSubjects = [];
    visibleModules.forEach(m => {
      const subjects = (Array.isArray(m.subjects) ? m.subjects : []).filter(s => !s.onlyForIntermediate);
      displayedSubjects.push(...subjects);
    });
    setupOverlayAndInteractions();
    computeStats(displayedSubjects);
  }

  // NOTE: solo devuelve electivas que existan en electivasList del plan actual
  function getPlacedElectiveForSlot(colIndex, slotIndex) {
    if (!electivesList.length) return null;
    const byCode = {};
    const byName = {};
    electivasList.forEach(e => { if (e.code) byCode[e.code] = e; if (e.name) byName[e.name] = e; });

    let slotCounter = 0;
    for (const entry of electivesList) {
      if (entry.careerCode !== currentCareer) continue;
      const electiveMeta = byCode[entry.subjectCode] || byName[entry.subjectCode];
      if (!electiveMeta) continue;
      if (entry.columnIndex === colIndex) {
        if (slotCounter === slotIndex) return electiveMeta;
        slotCounter++;
      }
    }
    return null;
  }

  function createCard(subject, group = null) {
    const card = document.createElement('div');
    card.className = 'card card-subject card-readonly';
    if (subject.code) card.dataset.code = subject.code;
    card.dataset.weekHours = typeof subject.weekHours === 'number' ? String(subject.weekHours) : '6';
    card.dataset.duration = subject.duration || 'anual';
    const reqsObj = subject.requirements || { cursar: [], aprobar: [] };
    card.dataset.requirements = JSON.stringify(reqsObj);
    if (group && group.color) card.dataset.groupColor = group.color;

    const stored = loadSubjectData(subject.code);
    const status = stored ? stored.status : null;
    const statusDesc = getStatusDescription(status);
    const promotable = (status === 'Regularizada' || status === 'No regularizada') && canPromote(stored);
    const statusLabel = statusDesc ? (promotable ? `${escapeHtml(statusDesc)} • Puede promocionar` : escapeHtml(statusDesc)) : '';

    card.innerHTML = `
      <div class="card-body p-1">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="card-title mb-0">${escapeHtml(subject.name)}</h6>
            <small class="text-muted d-block">${escapeHtml(subject.code)}</small>
            ${statusLabel ? `<small class="text-muted status-label">${statusLabel}</small>` : ''}
          </div>
          <div class="text-end">
            <div class="card-badge-container" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    `;

    applyCardStatusStyle(card, status);
    card.style.cursor = 'default';
    return card;
  }

  function createElectivaCard(subj) {
    const card = createCard(subj);
    card.classList.add('card-electiva');
    return card;
  }

  function createEmptyElectivaPlaceholder() {
    const card = document.createElement('div');
    card.className = 'card card-subject card-electiva-placeholder';
    card.innerHTML = `
      <div class="card-body p-1 text-center text-muted">
        <small>Electiva no elegida</small>
      </div>
    `;
    card.style.cursor = 'default';
    card.style.opacity = '0.5';
    return card;
  }

  // Overlay and arrows
  let overlaySvg = null;
  let codeMap = {};
  let dependentsMap = {};

  function setupOverlayAndInteractions() {
    if (!columnsContainer) return;
    const existing = columnsContainer.querySelector('svg.overlay-svg');
    if (existing) existing.remove();

    overlaySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlaySvg.classList.add('overlay-svg');
    overlaySvg.setAttribute('width', '100%');
    overlaySvg.setAttribute('height', '100%');
    overlaySvg.setAttribute('aria-hidden', 'true');
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <marker id="arrowhead-black" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
        <polygon points="0 0, 10 3.5, 0 7" fill="#000"></polygon>
      </marker>
      <marker id="arrowhead-green" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto" markerUnits="strokeWidth">
        <polygon points="0 0, 10 3.5, 0 7" fill="#28a745"></polygon>
      </marker>
    `;
    overlaySvg.appendChild(defs);
    columnsContainer.appendChild(overlaySvg);

    codeMap = {};
    const cards = columnsContainer.querySelectorAll('.card-subject');
    cards.forEach(card => {
      const code = card.dataset.code;
      if (code) codeMap[code] = card;
      card.addEventListener('mouseenter', onCardHover);
      card.addEventListener('mouseleave', onCardLeave);
    });

    Object.keys(codeMap).forEach(code => {
      try {
        const stored = loadSubjectData(code);
        applyCardStatusStyle(codeMap[code], stored ? stored.status : null);
      } catch (e) {/* ignore */}
    });

    updateAllCardCursarState();

    dependentsMap = {};
    cards.forEach(card => {
      const rObj = card.dataset.requirements ? JSON.parse(card.dataset.requirements) : { cursar: [], aprobar: [] };
      (rObj.cursar || []).forEach(r => {
        const id = (typeof r === 'string') ? r : (r.id || r.code);
        if (!dependentsMap[id]) dependentsMap[id] = [];
        dependentsMap[id].push({ card, relation: 'cursar', type: r.type || 'aprobada' });
      });
      (rObj.aprobar || []).forEach(r => {
        const id = (typeof r === 'string') ? r : (r.id || r.code);
        if (!dependentsMap[id]) dependentsMap[id] = [];
        dependentsMap[id].push({ card, relation: 'aprobar', type: r.type || 'aprobada' });
      });
    });
  }

  function onCardHover(e) {
    const card = e.currentTarget;
    if (!correlativasEnabled) return;
    clearOverlay();
    const reqObj = card.dataset.requirements ? JSON.parse(card.dataset.requirements) : { cursar: [], aprobar: [] };
    const requiresCursar = reqObj.cursar || [];
    const requiresAprobar = reqObj.aprobar || [];
    const code = card.dataset.code;
    const dependents = dependentsMap[code] || [];

    if ((requiresCursar && requiresCursar.length) || (requiresAprobar && requiresAprobar.length)) {
      drawArrowsFromRequirementsToCard(card, { cursar: requiresCursar, aprobar: requiresAprobar });
    }
    if (dependents && dependents.length) {
      drawArrowsToCard(card, dependents);
    }

    try {
      const involved = new Set();
      if (code) involved.add(code);
      (requiresCursar || []).forEach(r => involved.add((typeof r === 'string') ? r : r.id));
      (requiresAprobar || []).forEach(r => involved.add((typeof r === 'string') ? r : r.id));
      (dependents || []).forEach(dep => { if (dep.card && dep.card.dataset && dep.card.dataset.code) involved.add(dep.card.dataset.code); });

      const allCards = columnsContainer.querySelectorAll('.card-subject');
      allCards.forEach(c => {
        const ccode = c.dataset.code;
        if (!ccode) return;
        if (involved.has(ccode)) {
          c.classList.remove('card-dim');
          c.classList.add('card-highlight');
        } else {
          c.classList.add('card-dim');
          c.classList.remove('card-highlight');
        }
      });
    } catch (err) {
      console.error('Error applying dim/highlight', err);
    }
  }

  function onCardLeave(e) {
    clearOverlay();
    const allCards = columnsContainer.querySelectorAll('.card-subject');
    allCards.forEach(c => {
      c.classList.remove('card-dim');
      c.classList.remove('card-highlight');
    });
  }

  function clearOverlay() {
    if (!overlaySvg) return;
    const toRemove = Array.from(overlaySvg.querySelectorAll('path.arrow-line'));
    toRemove.forEach(n => n.remove());
  }

  function drawArrowsFromRequirementsToCard(toCard, requires) {
    if (!overlaySvg) return;
    const containerRect = columnsContainer.getBoundingClientRect();
    const toRect = toCard.getBoundingClientRect();
    const toX = (toRect.left + toRect.right) / 2 - containerRect.left;
    const toY = (toRect.top + toRect.bottom) / 2 - containerRect.top;

    (requires.cursar || []).forEach(r => {
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      const source = codeMap[id];
      if (!source) return;
      const fromRect = source.getBoundingClientRect();
      const fromX = (fromRect.left + fromRect.right) / 2 - containerRect.left;
      const fromY = (fromRect.top + fromRect.bottom) / 2 - containerRect.top;
      const dx = toX - fromX;
      const qx = fromX + dx * 0.5;
      const qy = fromY;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${fromX} ${fromY} Q ${qx} ${qy} ${toX} ${toY}`);
      path.setAttribute('class', 'arrow-line');
      if (typeof r === 'object' && r.type === 'regularizada') path.setAttribute('stroke-dasharray', '6,4');
      path.setAttribute('stroke', '#000');
      path.setAttribute('marker-end', 'url(#arrowhead-black)');
      overlaySvg.appendChild(path);
    });

    (requires.aprobar || []).forEach(r => {
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      const source = codeMap[id];
      if (!source) return;
      const fromRect = source.getBoundingClientRect();
      const fromX = (fromRect.left + fromRect.right) / 2 - containerRect.left;
      const fromY = (fromRect.top + fromRect.bottom) / 2 - containerRect.top;
      const dx = toX - fromX;
      const qx = fromX + dx * 0.5;
      const qy = fromY;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${fromX} ${fromY} Q ${qx} ${qy} ${toX} ${toY}`);
      path.setAttribute('class', 'arrow-line');
      path.setAttribute('stroke', '#28a745');
      const t = (typeof r === 'object' && r.type) ? r.type : 'aprobada';
      if (t === 'regularizada') path.setAttribute('stroke-dasharray', '6,4');
      path.setAttribute('marker-end', 'url(#arrowhead-green)');
      overlaySvg.appendChild(path);
    });
  }

  function drawArrowsToCard(toCard, dependents) {
    if (!overlaySvg) return;
    const containerRect = columnsContainer.getBoundingClientRect();
    const fromRect = toCard.getBoundingClientRect();
    const fromX = (fromRect.left + fromRect.right) / 2 - containerRect.left;
    const fromY = (fromRect.top + fromRect.bottom) / 2 - containerRect.top;
    dependents.forEach(dep => {
      const depCard = dep.card;
      const toRect = depCard.getBoundingClientRect();
      const toX = (toRect.left + toRect.right) / 2 - containerRect.left;
      const toY = (toRect.top + toRect.bottom) / 2 - containerRect.top;
      const dx = toX - fromX;
      const qx = fromX + dx * 0.5;
      const qy = fromY;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${fromX} ${fromY} Q ${qx} ${qy} ${toX} ${toY}`);
      path.setAttribute('class', 'arrow-line');
      if (dep.relation === 'cursar') {
        path.setAttribute('stroke', '#000');
        if (dep.type === 'regularizada') path.setAttribute('stroke-dasharray', '6,4');
        path.setAttribute('marker-end', 'url(#arrowhead-black)');
      } else if (dep.relation === 'aprobar') {
        path.setAttribute('stroke', '#28a745');
        if (dep.type === 'regularizada') path.setAttribute('stroke-dasharray', '6,4');
        path.setAttribute('marker-end', 'url(#arrowhead-green)');
      }
      overlaySvg.appendChild(path);
    });
  }

  function electivesForCurrentCareer() {
    return electivesList.filter(e => e.careerCode === currentCareer);
  }

  function computeStats(list) {
    const baseTotal = Array.isArray(list) ? list.length : 0;
    let approved = 0;
    let regularized = 0;

    for (const subj of (list || [])) {
      const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
      const stored = key ? loadSubjectData(key) : null;
      const status = stored ? stored.status : null;
      if (status === 'Aprobada' || status === 'Promocionada') approved++;
      else if (status === 'Regularizada') regularized++;
    }

    let electivasRequired = 0;
    try {
      if (planData && Array.isArray(planData.modules)) {
        const visibleModules = planData.modules.filter(m => m && m.render !== false);
        visibleModules.forEach(m => {
          const n = Number.isFinite(Number(m.electivas)) ? Number(m.electivas) : 0;
          electivasRequired += n;
        });
      }
    } catch (e) { electivasRequired = 0; }

    try {
      electivesForCurrentCareer().forEach(entry => {
        const stored = loadSubjectData(entry.subjectCode);
        const status = stored ? stored.status : null;
        if (status === 'Aprobada' || status === 'Promocionada') approved++;
        else if (status === 'Regularizada') regularized++;
      });
    } catch (e) {/* ignore */}

    const total = baseTotal + electivasRequired;

    let inCourseHours = 0;
    try {
      const terminal = ['Aprobada', 'Promocionada', 'Regularizada', 'Desaprobada'];
      for (const subj of (list || [])) {
        const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
        const stored = key ? loadSubjectData(key) : null;
        const status = stored ? stored.status : null;
        if (stored && !terminal.includes(status)) {
          const wh = Number.isFinite(Number(subj.weekHours)) ? Number(subj.weekHours) : 6;
          inCourseHours += wh;
        }
      }
      const byCode = {};
      const byName = {};
      electivasList.forEach(e => { if (e.code) byCode[e.code] = e; if (e.name) byName[e.name] = e; });
      electivesForCurrentCareer().forEach(entry => {
        const stored = loadSubjectData(entry.subjectCode);
        const status = stored ? stored.status : null;
        if (stored && !terminal.includes(status)) {
          const meta = byCode[entry.subjectCode] || byName[entry.subjectCode] || null;
          const wh = meta && Number.isFinite(Number(meta.weekHours)) ? Number(meta.weekHours) : 6;
          inCourseHours += wh;
        }
      });
    } catch (e) { inCourseHours = 0; }

    statsTotalPeso.textContent = inCourseHours > 0 ? (String(inCourseHours) + ' hs') : '—';

    let approvedGradeSum = 0;
    let approvedGradeCount = 0;
    try {
      for (const subj of (list || [])) {
        const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
        const stored = key ? loadSubjectData(key) : null;
        const status = stored ? stored.status : null;
        if (status === 'Aprobada' || status === 'Promocionada') {
          let grade = NaN;
          try {
            if (status === 'Aprobada' && stored && Array.isArray(stored.finals)) {
              const sorted = [...stored.finals].sort((a, b) => a.attemptNumber - b.attemptNumber);
              for (const f of sorted) {
                if (f && f.grade !== null && f.grade !== undefined && f.grade >= 6) { grade = f.grade; break; }
              }
            } else if (status === 'Promocionada' && stored && stored.partials && stored.schemeConfig) {
              let sum = 0, count = 0;
              const n = stored.schemeConfig.partials ?? 2;
              for (let p = 1; p <= n; p++) {
                const attempts = stored.partials[p] || {};
                let eff = null;
                for (let a = 3; a >= 1; a--) { if (attempts[a] !== null && attempts[a] !== undefined) { eff = attempts[a]; break; } }
                if (eff !== null) { sum += eff; count++; }
              }
              if (count > 0) grade = Math.round(sum / count);
            }
          } catch (e) {/* ignore */}
          if (!Number.isNaN(grade)) {
            approvedGradeSum += Number(grade);
            approvedGradeCount += 1;
          }
        }
      }
    } catch (e) {/* ignore */}

    if (approvedGradeCount > 0) {
      const avg = approvedGradeSum / approvedGradeCount;
      statsAvg.textContent = String(avg.toFixed(2)).replace('.', ',');
    } else {
      statsAvg.textContent = '—';
    }
    statPlaceholder1.textContent = approved + ' / ' + total;
    statPlaceholder2.textContent = regularized;

    let disponibles = 0;
    try {
      if (columnsContainer) {
        const availableCards = columnsContainer.querySelectorAll('.card-subject.card-available:not(.card-electiva-placeholder)');
        disponibles = availableCards.length;
      }
    } catch (e) { disponibles = 0; }
    if (statDisponibles) statDisponibles.textContent = disponibles;

    let progress = 0;
    if (total > 0) {
      progress = ((approved + (regularized / 2)) / total) * 100;
      if (!Number.isFinite(progress)) progress = 0;
    }
    const pct = Math.round(progress);
    progressBar.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', pct);
    progressLabel.textContent = total > 0 ? `${pct}%` : '—';
  }

  function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    return String(text).replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]);
    });
  }

  function loadPlanData() {
    if (!currentCareer) {
      if (columnsContainer) columnsContainer.innerHTML = '<div class="alert alert-info">Esta persona todavía no está anotada en ninguna carrera.</div>';
      return;
    }
    getCareerCurriculum(currentCareer)
      .then(d => {
        if (!d) throw new Error('curriculum_not_found');
        planData = d;
        const modules = Array.isArray(d.modules) ? d.modules : [];
        const electModule = modules.find(m => m && m.id === 'electives') || modules.find(m => m && m.render === false && Array.isArray(m.subjects));
        electivasList = electModule && Array.isArray(electModule.subjects) ? electModule.subjects : [];
        try { renderGroups(d); } catch (e) { console.error('Error renderizando grupos', e); }
      })
      .catch(err => {
        console.error('Error cargando el curriculum de la carrera', err);
        if (columnsContainer) columnsContainer.innerHTML = '<div class="alert alert-danger">No se pudo cargar el plan de materias.</div>';
      });
  }

  // --- Carga inicial: GET /api/public/{identifier} ---
  const urlParams = new URLSearchParams(window.location.search);
  const identifier = urlParams.get('uid');

  if (!identifier) {
    showAlert('No se especificó un perfil para mostrar.');
    return;
  }

  try {
    const data = await api.get(`/public/${encodeURIComponent(identifier)}`);
    enrollmentsByCode = {};
    (data.enrollments || []).forEach(e => { enrollmentsByCode[e.subjectCode] = e; });
    electivesList = data.electives || [];

    const userCareers = Array.isArray(data.userCareers) ? data.userCareers : [];
    const activeCareerCode = data.preferences && data.preferences.activeCareerCode;
    currentCareer = (activeCareerCode && userCareers.some(c => c.code === activeCareerCode))
      ? activeCareerCode
      : (userCareers[0] ? userCareers[0].code : null);

    const programBadge = document.getElementById('share-program');
    if (programBadge && currentCareer) {
      const careerEntry = userCareers.find(c => c.code === currentCareer);
      if (careerEntry) {
        programBadge.textContent = careerEntry.name;
      } else {
        const catalog = await getCareers();
        const fallback = catalog.find(c => c.code === currentCareer);
        if (fallback) programBadge.textContent = fallback.name;
      }
    }

    loadPlanData();
  } catch (err) {
    console.error('Error fetching public profile', err);
    if (err && err.status === 403) showAlert('Este perfil no es público.');
    else if (err && err.status === 404) showAlert('Este perfil no existe.');
    else showAlert('Error al cargar el perfil.');
  }
});
