document.addEventListener('DOMContentLoaded', () => {
  const DATA_URL = 'assets/data/subjects.json';
  let columns = 5;

  const columnsContainer = document.querySelector('.columns-grid');
  const statsTotalPeso = document.getElementById('stat-peso');
  const statsAvg = document.getElementById('stat-promedio');
  const statPlaceholder1 = document.getElementById('stat-placeholder-1');
  const statPlaceholder2 = document.getElementById('stat-placeholder-2');
  const progressBar = document.getElementById('progress-bar');
  const progressLabel = document.getElementById('progress-label');

  // Correlativas toggle: read persisted preference and bind toggle UI
  const correlativasToggle = document.getElementById('toggle-correlativas');
  let correlativasEnabled = true;
  function loadCorrelativasPref(){
    const v = localStorage.getItem('mostrarCorrelativas');
    return v === null ? true : v === '1';
  }
  function saveCorrelativasPref(val){
    localStorage.setItem('mostrarCorrelativas', val ? '1' : '0');
  }
  // Initialize state (will be set again after DOM rendered elements exist)
  correlativasEnabled = loadCorrelativasPref();

  fetch(DATA_URL)
    .then(r => r.json())
    .then(data => renderGroups(data))
    .catch(err => {
      console.error('Error loading groups', err);
      columnsContainer.innerHTML = '<div class="alert alert-warning">No se pudieron cargar las materias.</div>';
    });

  function renderGroups(data){
    const groups = Array.isArray(data.groups) ? data.groups : [];
    if (groups.length === 0) {
      columnsContainer.innerHTML = '<div class="alert alert-info">No hay grupos disponibles.</div>';
      return;
    }

    // Use number of groups as columns (limit to max 8 for layout sanity)
    columns = Math.min(Math.max(groups.length, 1), 8);
    columnsContainer.innerHTML = '';

    groups.forEach((group, idx) => {
      const col = document.createElement('div');
      col.className = 'column-col';
      col.dataset.index = idx;

        // Column header with group name and color indicator
        const header = document.createElement('div');
        header.className = 'mb-2';
        header.innerHTML = `<strong>${escapeHtml(group.name)}</strong> <span style="display:inline-block;width:12px;height:12px;border-radius:3px;margin-left:6px;background:${escapeHtml(group.color || '#6c757d')};"></span>`;
      col.appendChild(header);

      // Render all subjects per group
      const subjects = Array.isArray(group.subjects) ? group.subjects : [];
      subjects.forEach(subj => col.appendChild(createCard(subj, group)));

      columnsContainer.appendChild(col);
    });

    // Compute stats from all displayed subjects
    const displayed = [];
    groups.forEach(g => {
      if (Array.isArray(g.subjects)) {
        displayed.push(...g.subjects);
      }
    });
    computeStats(displayed);

    // Setup overlay SVG and interactivity for correlativas
    setupOverlayAndInteractions();

    // Ensure the toggle reflects persisted preference and reacts to changes
    if (correlativasToggle){
      correlativasToggle.checked = correlativasEnabled;
      correlativasToggle.setAttribute('aria-checked', correlativasEnabled);
      correlativasToggle.addEventListener('change', (ev) => {
        correlativasEnabled = correlativasToggle.checked;
        correlativasToggle.setAttribute('aria-checked', correlativasEnabled);
        saveCorrelativasPref(correlativasEnabled);
        if (!correlativasEnabled){
          // clear overlay and remove any dim/highlight state
          clearOverlay();
          const allCards = columnsContainer.querySelectorAll('.card-subject');
          allCards.forEach(c => { c.classList.remove('card-dim'); c.classList.remove('card-highlight'); });
        }
      });
    }
  }

  function createCard(subject, group = null){
    const card = document.createElement('div');
    card.className = 'card card-subject';
    // attach metadata for interactions
    if (subject.code) card.dataset.code = subject.code;
    if (subject.requires) card.dataset.requires = JSON.stringify(subject.requires);
    if (group && group.color) card.dataset.groupColor = group.color;
    card.innerHTML = `
      <div class="card-body p-2">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="card-title mb-1">${escapeHtml(subject.name)}</h6>
            <small class="text-muted">${escapeHtml(subject.code)}</small>
          </div>
          <div class="text-end">
            <span class="badge bg-primary">${subject.credits} cr</span>
          </div>
        </div>
        <div class="mt-2 d-flex justify-content-between align-items-center">
          <small class="text-muted">Nota: ${subject.grade === null || subject.grade === undefined ? '—' : subject.grade}</small>
          <div>
            <button class="btn btn-sm btn-outline-secondary me-1">Ver</button>
            <button class="btn btn-sm btn-outline-success">Acciones</button>
          </div>
        </div>
      </div>
    `;
    // add hover cursor
    card.style.cursor = 'pointer';
    return card;
  }

  // Overlay and arrows
  let overlaySvg = null;
  let codeMap = {};
  let dependentsMap = {};

  function setupOverlayAndInteractions(){
    // create overlay SVG inside columnsContainer
    if (!columnsContainer) return;
    // remove existing overlay
    const existing = columnsContainer.querySelector('svg.overlay-svg');
    if (existing) existing.remove();

    overlaySvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    overlaySvg.classList.add('overlay-svg');
    overlaySvg.setAttribute('width', '100%');
    overlaySvg.setAttribute('height', '100%');
    overlaySvg.setAttribute('aria-hidden', 'true');
    // marker definition for arrowhead
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    defs.innerHTML = `
      <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
        <polygon class="arrow-head" points="0 0, 10 3.5, 0 7"></polygon>
      </marker>
    `;
    overlaySvg.appendChild(defs);

    columnsContainer.appendChild(overlaySvg);

    // build code map: code -> element center
    codeMap = {};
    const cards = columnsContainer.querySelectorAll('.card-subject');
    cards.forEach(card => {
      const code = card.dataset.code;
      if (code) codeMap[code] = card;

      // attach events
      card.addEventListener('mouseenter', onCardHover);
      card.addEventListener('mouseleave', onCardLeave);
    });

    // build dependents map (reverse of requires)
    dependentsMap = {};
    cards.forEach(card => {
      const reqs = card.dataset.requires ? JSON.parse(card.dataset.requires) : [];
      reqs.forEach(r => {
        if (!dependentsMap[r]) dependentsMap[r] = [];
        dependentsMap[r].push(card);
      });
    });
  }

  function onCardHover(e){
    // Respect the user's toggle preference
    if (!correlativasEnabled) return;
    const card = e.currentTarget;
    // clear previous drawings
    clearOverlay();
    const requires = card.dataset.requires ? JSON.parse(card.dataset.requires) : [];
    const code = card.dataset.code;
    const dependents = dependentsMap[code] || [];

    // Draw incoming arrows: from each requirement -> hovered card
    if (requires && requires.length) {
      drawArrowsFromRequirementsToCard(card, requires);
    }

    // Draw outgoing arrows: from hovered card -> dependents
    if (dependents && dependents.length) {
      drawArrowsToCard(card, dependents);
    }

    // Dim non-involved cards and highlight involved ones
    try {
      const involved = new Set();
      if (code) involved.add(code);
      (requires || []).forEach(r => involved.add(r));
      (dependents || []).forEach(dc => { if (dc.dataset && dc.dataset.code) involved.add(dc.dataset.code); });

      const allCards = columnsContainer.querySelectorAll('.card-subject');
      allCards.forEach(c => {
        const ccode = c.dataset.code;
        if (!ccode) return;
        if (involved.has(ccode)){
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

  function onCardLeave(e){
    clearOverlay();
    // remove dim/highlight from all cards
    const allCards = columnsContainer.querySelectorAll('.card-subject');
    allCards.forEach(c => {
      c.classList.remove('card-dim');
      c.classList.remove('card-highlight');
    });
  }

  function clearOverlay(){
    if (!overlaySvg) return;
    // remove only generated arrow paths (keep defs/markers)
    const toRemove = Array.from(overlaySvg.querySelectorAll('path.arrow-line'));
    toRemove.forEach(n => n.remove());
  }

  function drawArrowsFromCard(fromCard, requires){
    // Deprecated: drawArrowsFromCard replaced by drawArrowsFromRequirementsToCard
    // kept for backward compatibility but no longer used
    return;
  }

  function drawArrowsFromRequirementsToCard(toCard, requires){
    if (!overlaySvg) return;
    const containerRect = columnsContainer.getBoundingClientRect();
    const toRect = toCard.getBoundingClientRect();
    const toX = (toRect.left + toRect.right)/2 - containerRect.left;
    const toY = (toRect.top + toRect.bottom)/2 - containerRect.top;

    requires.forEach(code => {
      const source = codeMap[code];
      if (!source) return;
      const fromRect = source.getBoundingClientRect();
      const fromX = (fromRect.left + fromRect.right)/2 - containerRect.left;
      const fromY = (fromRect.top + fromRect.bottom)/2 - containerRect.top;

      const dx = toX - fromX;
      const qx = fromX + dx * 0.5;
      const qy = fromY;
      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = `M ${fromX} ${fromY} Q ${qx} ${qy} ${toX} ${toY}`;
      path.setAttribute('d', d);
      path.setAttribute('class','arrow-line');
      path.setAttribute('marker-end','url(#arrowhead)');
      // color by group of source if available
      const color = source.dataset.groupColor || null;
      if (color) path.setAttribute('stroke', color);
      overlaySvg.appendChild(path);
    });
  }

  function drawArrowsToCard(toCard, dependents){
    // Draw arrows from the hovered card (toCard) to each dependent
    if (!overlaySvg) return;
    const containerRect = columnsContainer.getBoundingClientRect();
    const fromRect = toCard.getBoundingClientRect();
    const fromX = (fromRect.left + fromRect.right)/2 - containerRect.left;
    const fromY = (fromRect.top + fromRect.bottom)/2 - containerRect.top;

    dependents.forEach(depCard => {
      const toRect = depCard.getBoundingClientRect();
      const toX = (toRect.left + toRect.right)/2 - containerRect.left;
      const toY = (toRect.top + toRect.bottom)/2 - containerRect.top;

      const dx = toX - fromX;
      const dy = toY - fromY;
      const qx = fromX + dx * 0.5;
      const qy = fromY;

      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = `M ${fromX} ${fromY} Q ${qx} ${qy} ${toX} ${toY}`;
      path.setAttribute('d', d);
      path.setAttribute('class','arrow-line');
      path.setAttribute('marker-end','url(#arrowhead)');
      // color by group of hovered (source)
      const color = toCard.dataset.groupColor || null;
      if (color) path.setAttribute('stroke', color);
      overlaySvg.appendChild(path);
    });
  }

  function computeStats(list){
    const totalPeso = list.reduce((sum, s) => sum + (s.credits || 0), 0);
    const grades = list.map(s => s.grade).filter(g => g !== null && g !== undefined);
    const avg = grades.length ? (grades.reduce((a,b)=>a+b,0)/grades.length) : null;
    const passedCount = grades.filter(g => g >= 6).length;
    const passPercent = grades.length ? Math.round((passedCount/grades.length)*100) : 0;

    statsTotalPeso.textContent = totalPeso + ' créditos';
    statsAvg.textContent = avg ? avg.toFixed(2) : '—';
    statPlaceholder1.textContent = 'Materias mostradas: ' + list.length;
    statPlaceholder2.textContent = 'Aprobadas: ' + passedCount;

    progressBar.style.width = passPercent + '%';
    progressBar.setAttribute('aria-valuenow', passPercent);
    progressLabel.textContent = passPercent + '% aprobadas';
  }

  // Simple escape to avoid HTML injection in sample
  function escapeHtml(text){
    if (text === null || text === undefined) return '';
    return String(text).replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]);
    });
  }
});
