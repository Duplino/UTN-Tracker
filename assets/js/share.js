// Share page JavaScript - Read-only public profile view
document.addEventListener('DOMContentLoaded', () => {
  const DATA_URL = 'assets/data/k23.json';
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

  // User data from Firestore (set by the module script in share.html)
  let remoteSubjectData = {};
  let remoteElectives = {};

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

  // --- LocalStorage-like helpers but reading from remote data ---
  function loadSubjectData(code) {
    if (!code) return null;
    return remoteSubjectData[code] || null;
  }

  // Parse number helper
  function parseNum(v) {
    if (v === null || v === undefined || v === '') return NaN;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  // Compute status text for display
  function getStatusText(stored) {
    if (!stored) return null;
    const status = stored.overrideStatus || stored.status || null;
    return status;
  }

  // Get a user-friendly description for the status
  function getStatusDescription(status) {
    switch (status) {
      case 'Aprobada': return 'Aprobada';
      case 'Promocionada': return 'Promocionada';
      case 'Regularizada': return 'Regularizada';
      case 'Desaprobada': return 'Desaprobada';
      case 'No regularizada': return 'Debe recuperar';
      case 'Faltan notas': return 'En curso';
      case 'Faltan examenes': return 'En curso';
      default: return status || null;
    }
  }

  // Apply card status style (visual appearance based on status)
  function applyCardStatusStyle(card, status) {
    if (!card) return;
    // remove previous status classes
    ['card-status-aprobada', 'card-status-desaprobada', 'card-status-promocionada', 'card-status-regularizada'].forEach(c => card.classList.remove(c));
    
    if (status === 'Faltan notas' || status === 'Faltan examenes') status = null;
    
    const mapping = {
      'Aprobada': 'card-status-aprobada',
      'Desaprobada': 'card-status-desaprobada',
      'Promocionada': 'card-status-promocionada',
      'Regularizada': 'card-status-regularizada'
    };
    const cls = mapping[status];
    if (cls) card.classList.add(cls);

    // Badge rendering
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
          if (stored && stored.values) {
            for (let i = 1; i <= 4; i++) {
              const v = stored.values['final' + i];
              const n = parseNum(v);
              if (!Number.isNaN(n) && n >= 6) { grade = n; break; }
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
        let p1 = NaN, p2 = NaN;
        try {
          if (stored && stored.values) {
            for (let i = 3; i >= 1; i--) {
              const v = stored.values['parcial1_' + i];
              const n = parseNum(v);
              if (!Number.isNaN(n)) { p1 = n; break; }
            }
            for (let i = 3; i >= 1; i--) {
              const v = stored.values['parcial2_' + i];
              const n = parseNum(v);
              if (!Number.isNaN(n)) { p2 = n; break; }
            }
          }
        } catch (e) {/* ignore */}
        if (!Number.isNaN(p1) && !Number.isNaN(p2)) {
          const avg = Math.round((p1 + p2) / 2);
          const span = document.createElement('span');
          span.className = 'badge bg-success';
          span.style.fontSize = '0.8rem';
          span.textContent = String(avg);
          bc.appendChild(span);
        }
      } else if (status === 'Regularizada') {
        // No badge for Regularizada
      } else {
        // Not approved -> show weekHours badge (blue)
        const span = document.createElement('span');
        span.className = 'badge bg-primary';
        span.style.fontSize = '0.8rem';
        span.textContent = `${weekHours} hs`;
        bc.appendChild(span);
      }
    } catch (e) {/* ignore badge errors */}
  }

  // Evaluate 'cursar' requirements for a given card
  function cursarRequirementsMetForCard(card) {
    if (!card) return true;
    const reqObj = card.dataset.requirements ? JSON.parse(card.dataset.requirements) : { cursar: [] };
    const cursar = reqObj.cursar || [];
    if (!cursar || cursar.length === 0) return true;
    
    for (const r of cursar) {
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      if (!id) return false;
      const stored = loadSubjectData(id);
      const status = stored && stored.overrideStatus ? stored.overrideStatus : (stored && stored.status ? stored.status : null);
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

  // Update all cards' disabled/enabled state according to cursar requirements
  function updateAllCardCursarState() {
    try {
      if (!columnsContainer) return;
      const all = columnsContainer.querySelectorAll('.card-subject');
      all.forEach(c => {
        try {
          // Skip electiva placeholder cards (they have no subject code and shouldn't be counted)
          if (c.classList.contains('card-electiva-placeholder')) return;
          
          const meets = cursarRequirementsMetForCard(c);
          if (!meets) {
            c.classList.add('card-disabled');
            c.setAttribute('aria-disabled', 'true');
          } else {
            c.classList.remove('card-disabled');
            c.removeAttribute('aria-disabled');
          }
          // available (dashed border) when requirements met but subject not started/saved
          try {
            const code = c.dataset && c.dataset.code ? c.dataset.code : null;
            const stored = code ? loadSubjectData(code) : null;
            if (meets && !stored) {
              c.classList.add('card-available');
            } else {
              c.classList.remove('card-available');
            }
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

    visibleModules.forEach((module, visIdx) => {
      const col = document.createElement('div');
      col.className = 'column-col';
      col.dataset.index = visIdx;

      const header = document.createElement('div');
      header.className = 'mb-2';
      header.innerHTML = `<strong>${escapeHtml(module.name)}</strong>`;
      col.appendChild(header);

      const subjects = Array.isArray(module.subjects) ? module.subjects : [];
      subjects.forEach(subj => col.appendChild(createCard(subj, module)));

      // Insert electiva cards for placed electives in this column
      const electivasCount = Number.isFinite(Number(module.electivas)) ? Number(module.electivas) : 0;
      for (let i = 0; i < electivasCount; i++) {
        // Check if there's an elective placed in this column
        const placed = getPlacedElectiveForSlot(visIdx, i);
        if (placed) {
          col.appendChild(createElectivaCard(placed));
        } else {
          // Show empty placeholder (no interaction in public view)
          col.appendChild(createEmptyElectivaPlaceholder());
        }
      }

      columnsContainer.appendChild(col);
    });

    displayedSubjects = [];
    visibleModules.forEach(m => {
      if (Array.isArray(m.subjects)) displayedSubjects.push(...m.subjects);
    });
    setupOverlayAndInteractions();
    // Compute stats after cursar state is updated (so .card-available classes are present)
    computeStats(displayedSubjects);
  }

  // Get placed elective for a specific slot
  function getPlacedElectiveForSlot(colIndex, slotIndex) {
    if (!remoteElectives || Object.keys(remoteElectives).length === 0) return null;
    const electList = Array.isArray(electivasList) ? electivasList : [];
    const byCode = {};
    const byName = {};
    electList.forEach(e => { if (e.code) byCode[e.code] = e; if (e.name) byName[e.name] = e; });

    let slotCounter = 0;
    for (const key of Object.keys(remoteElectives)) {
      const entry = remoteElectives[key];
      const entryColIndex = typeof entry.colIndex === 'number' ? entry.colIndex : parseInt(entry.colIndex, 10);
      if (entryColIndex === colIndex) {
        if (slotCounter === slotIndex) {
          return byCode[key] || byName[key] || { code: key, name: key };
        }
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
    const reqsObj = subject.requirements || { cursar: [], aprobar: [] };
    card.dataset.requirements = JSON.stringify(reqsObj);
    if (group && group.color) card.dataset.groupColor = group.color;

    // Get status for this subject
    const stored = loadSubjectData(subject.code);
    const status = getStatusText(stored);
    const statusDesc = getStatusDescription(status);

    card.innerHTML = `
      <div class="card-body p-1">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="card-title mb-0">${escapeHtml(subject.name)}</h6>
            <small class="text-muted d-block">${escapeHtml(subject.code)}</small>
            ${statusDesc ? `<small class="text-muted status-label">${escapeHtml(statusDesc)}</small>` : ''}
          </div>
          <div class="text-end">
            <div class="card-badge-container" aria-hidden="true"></div>
          </div>
        </div>
      </div>
    `;

    // Apply visual status styling
    applyCardStatusStyle(card, status);

    // Read-only: no click handler to open modal
    card.style.cursor = 'default';

    return card;
  }

  function createElectivaCard(subj) {
    const card = document.createElement('div');
    card.className = 'card card-subject card-electiva card-readonly';
    if (subj.code) card.dataset.code = subj.code;
    card.dataset.weekHours = typeof subj.weekHours === 'number' ? String(subj.weekHours) : '6';
    const reqsObj = subj.requirements || { cursar: [], aprobar: [] };
    card.dataset.requirements = JSON.stringify(reqsObj);

    // Get status for this elective
    const stored = loadSubjectData(subj.code);
    const status = getStatusText(stored);
    const statusDesc = getStatusDescription(status);

    card.innerHTML = `
      <div class="card-body p-1">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="card-title mb-0">${escapeHtml(subj.name)}</h6>
            <small class="text-muted d-block">${escapeHtml(subj.code)}</small>
            ${statusDesc ? `<small class="text-muted status-label">${escapeHtml(statusDesc)}</small>` : ''}
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

    // build code map
    codeMap = {};
    const cards = columnsContainer.querySelectorAll('.card-subject');
    cards.forEach(card => {
      const code = card.dataset.code;
      if (code) codeMap[code] = card;
      card.addEventListener('mouseenter', onCardHover);
      card.addEventListener('mouseleave', onCardLeave);
    });

    // Apply saved styles / badges for each card
    Object.keys(codeMap).forEach(code => {
      try {
        const stored = loadSubjectData(code);
        const effectiveStatus = stored ? (stored.overrideStatus ? stored.overrideStatus : (stored.status ? stored.status : null)) : null;
        applyCardStatusStyle(codeMap[code], effectiveStatus);
      } catch (e) {/* ignore */}
    });

    updateAllCardCursarState();

    // build dependents map
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
      const d = `M ${fromX} ${fromY} Q ${qx} ${qy} ${toX} ${toY}`;
      path.setAttribute('d', d);
      path.setAttribute('class', 'arrow-line');
      if (typeof r === 'object' && r.type === 'regularizada') {
        path.setAttribute('stroke-dasharray', '6,4');
      }
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
      const d = `M ${fromX} ${fromY} Q ${qx} ${qy} ${toX} ${toY}`;
      path.setAttribute('d', d);
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
      const d = `M ${fromX} ${fromY} Q ${qx} ${qy} ${toX} ${toY}`;
      path.setAttribute('d', d);
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

  function computeStats(list) {
    const baseTotal = Array.isArray(list) ? list.length : 0;
    let approved = 0;
    let regularized = 0;
    
    for (const subj of (list || [])) {
      const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
      const stored = key ? loadSubjectData(key) : null;
      const status = stored && stored.overrideStatus ? stored.overrideStatus : (stored && stored.status ? stored.status : null);
      if (status === 'Aprobada' || status === 'Promocionada') approved++;
      else if (status === 'Regularizada') regularized++;
    }

    // Add required electivas per visible module to the total
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

    // Count electivas that have saved statuses
    try {
      if (remoteElectives) {
        Object.keys(remoteElectives || {}).forEach(k => {
          try {
            const stored = loadSubjectData(k);
            const status = stored && stored.overrideStatus ? stored.overrideStatus : (stored && stored.status ? stored.status : null);
            if (status === 'Aprobada' || status === 'Promocionada') approved++;
            else if (status === 'Regularizada') regularized++;
          } catch (e) {/* ignore */}
        });
      }
    } catch (e) {/* ignore */}

    const total = baseTotal + electivasRequired;

    // Sum weekly hours for subjects that are 'EN CURSO'
    let inCourseHours = 0;
    try {
      for (const subj of (list || [])) {
        const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
        const stored = key ? loadSubjectData(key) : null;
        const status = stored && stored.overrideStatus ? stored.overrideStatus : (stored && stored.status ? stored.status : null);
        const terminal = ['Aprobada', 'Promocionada', 'Regularizada', 'Desaprobada'];
        if (stored && !terminal.includes(status)) {
          const wh = Number.isFinite(Number(subj.weekHours)) ? Number(subj.weekHours) : 6;
          inCourseHours += wh;
        }
      }
      // Also include electivas
      if (remoteElectives) {
        const electList = Array.isArray(electivasList) ? electivasList : [];
        const byCode = {};
        const byName = {};
        electList.forEach(e => { if (e.code) byCode[e.code] = e; if (e.name) byName[e.name] = e; });
        Object.keys(remoteElectives).forEach(k => {
          try {
            const stored = loadSubjectData(k);
            const status = stored && stored.overrideStatus ? stored.overrideStatus : (stored && stored.status ? stored.status : null);
            const terminal = ['Aprobada', 'Promocionada', 'Regularizada', 'Desaprobada'];
            if (stored && !terminal.includes(status)) {
              const meta = byCode[k] || byName[k] || null;
              const wh = meta && Number.isFinite(Number(meta.weekHours)) ? Number(meta.weekHours) : 6;
              inCourseHours += wh;
            }
          } catch (e) {/* ignore */}
        });
      }
    } catch (e) { inCourseHours = 0; }

    statsTotalPeso.textContent = inCourseHours > 0 ? (String(inCourseHours) + ' hs') : '—';

    // Compute average grade for approved subjects
    let approvedGradeSum = 0;
    let approvedGradeCount = 0;
    try {
      for (const subj of (list || [])) {
        const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
        const stored = key ? loadSubjectData(key) : null;
        const status = stored && stored.overrideStatus ? stored.overrideStatus : (stored && stored.status ? stored.status : null);
        if (status === 'Aprobada' || status === 'Promocionada') {
          let grade = NaN;
          try {
            if (status === 'Aprobada' && stored && stored.values) {
              for (let i = 1; i <= 4; i++) {
                const v = stored.values['final' + i];
                const n = parseNum(v);
                if (!Number.isNaN(n) && n >= 6) { grade = n; break; }
              }
            } else if (status === 'Promocionada' && stored && stored.values) {
              let p1 = NaN, p2 = NaN;
              for (let i = 3; i >= 1; i--) { const v = stored.values['parcial1_' + i]; const n = parseNum(v); if (!Number.isNaN(n)) { p1 = n; break; } }
              for (let i = 3; i >= 1; i--) { const v = stored.values['parcial2_' + i]; const n = parseNum(v); if (!Number.isNaN(n)) { p2 = n; break; } }
              if (!Number.isNaN(p1) && !Number.isNaN(p2)) grade = Math.round((p1 + p2) / 2);
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

    // Count available subjects (cards with .card-available class = meet cursar requirements and not started)
    // Exclude electiva placeholders from the count
    let disponibles = 0;
    try {
      if (columnsContainer) {
        const availableCards = columnsContainer.querySelectorAll('.card-subject.card-available:not(.card-electiva-placeholder)');
        disponibles = availableCards.length;
      }
    } catch (e) { disponibles = 0; }
    if (statDisponibles) statDisponibles.textContent = disponibles;

    // Progress formula: (approved + regularized/2) / total
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

  // Listen for data ready event from the module script
  document.addEventListener('share:data-ready', (ev) => {
    try {
      const data = ev.detail || {};
      remoteSubjectData = data.subjectData || {};
      remoteElectives = data.electives || {};
      // Re-render if planData is already loaded
      if (planData) {
        renderGroups(planData);
      }
    } catch (e) {
      console.error('Error processing share data', e);
    }
  });

  // Load the main plan from DATA_URL and render
  fetch(DATA_URL)
    .then(r => r.json())
    .then(d => {
      planData = d;
      const modules = Array.isArray(d.modules) ? d.modules : [];
      const electModule = modules.find(m => m && m.id === 'electives') || modules.find(m => m && m.render === false && Array.isArray(m.subjects));
      electivasList = electModule && Array.isArray(electModule.subjects) ? electModule.subjects : [];
      // If remote data is already available, render with it
      if (window.shareUserData) {
        remoteSubjectData = window.shareUserData;
        remoteElectives = window.shareElectives || {};
      }
      try { renderGroups(d); } catch (e) { console.error('Error renderizando grupos', e); }
    })
    .catch(err => {
      console.error('Error cargando plan desde DATA_URL', err);
      if (columnsContainer) columnsContainer.innerHTML = '<div class="alert alert-danger">No se pudo cargar el plan de materias.</div>';
    });
});
