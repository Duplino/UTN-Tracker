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
    // store requirements object (cursar/aprobar)
    const reqsObj = subject.requirements || { cursar: [], aprobar: [] };
    card.dataset.requirements = JSON.stringify(reqsObj);
    if (group && group.color) card.dataset.groupColor = group.color;
    card.innerHTML = `
      <div class="card-body p-1">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="card-title mb-0">${escapeHtml(subject.name)}</h6>
            <small class="text-muted d-block">${escapeHtml(subject.code)}</small>
          </div>
          <div class="text-end">
            <small class="text-muted" aria-hidden="true"></small>
          </div>
        </div>
      </div>
    `;
    // add hover cursor
    card.style.cursor = 'pointer';
    // open subject modal on click
    card.addEventListener('click', onCardClick);
    return card;
  }

  // Subject modal behavior
  let currentCard = null;
  function onCardClick(e){
    // open modal and populate minimal info
    currentCard = e.currentTarget;
    const code = currentCard.dataset.code || '';
    const titleEl = document.getElementById('subjectModalLabel');
    const name = currentCard.querySelector('.card-title') ? currentCard.querySelector('.card-title').textContent : code;
    titleEl.textContent = `${name} ${code ? '(' + code + ')' : ''}`;

    // clear inputs for now (new layout: parciales with 3 fields each)
    ['parcial1_1','parcial1_2','parcial1_3','parcial2_1','parcial2_2','parcial2_3','final1','final2','final3','final4'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    // reset partial placeholders and visibility to defaults
    const p1_2 = document.getElementById('parcial1_2');
    const p1_3 = document.getElementById('parcial1_3');
    const p2_2 = document.getElementById('parcial2_2');
    const p2_3 = document.getElementById('parcial2_3');
    if (p1_2) { p1_2.placeholder = 'Debe Recuperar'; p1_2.classList.add('d-none'); }
    if (p1_3) { p1_3.placeholder = 'Debe Recuperar'; p1_3.classList.add('d-none'); }
    if (p2_2) { p2_2.placeholder = 'Debe Recuperar'; p2_2.classList.add('d-none'); }
    if (p2_3) { p2_3.placeholder = 'Debe Recuperar'; p2_3.classList.add('d-none'); }
    // ensure only first parcial attempt visible initially
    const p1group = document.getElementById('parcial1-group'); if (p1group) p1group.classList.remove('d-none');
    const p2group = document.getElementById('parcial2-group'); if (p2group) p2group.classList.remove('d-none');

    const modalEl = document.getElementById('subjectModal');
    if (modalEl){
      const bsModal = new bootstrap.Modal(modalEl);
      bsModal.show();
      // wire live status updates: listen to partials and finals and recalc
      const partialIds = ['parcial1_1','parcial1_2','parcial1_3','parcial2_1','parcial2_2','parcial2_3'];
      const finalIds = ['final1','final2','final3','final4'];
      function bindLiveInputs(){
        partialIds.concat(finalIds).forEach(id => {
          const inp = document.getElementById(id);
          if (!inp) return;
          inp.removeEventListener('input', updateSubjectStatus);
          inp.addEventListener('input', updateSubjectStatus);
        });
      }
      // ensure finals container initially hidden until status logic decides
      const finalsContainer = document.getElementById('finals-container');
      if (finalsContainer) finalsContainer.classList.add('d-none');
      // clear any previous status
      const statusContainer = document.getElementById('subject-status');
      if (statusContainer) statusContainer.innerHTML = '';
      // bind and run initial status calculation
      bindLiveInputs();
      updateSubjectStatus();
      // wire save to close the modal and log values (placeholder behavior)
      const saveBtn = document.getElementById('subject-save');
      if (saveBtn){
        const handler = () => {
          const values = {};
          ['parcial1_1','parcial1_2','parcial1_3','parcial2_1','parcial2_2','parcial2_3','final1','final2','final3','final4'].forEach(id => {
            const i = document.getElementById(id);
            values[id] = i ? i.value : null;
          });
          console.log('Guardar notas para', code, values);
          bsModal.hide();
          saveBtn.removeEventListener('click', handler);
        };
        // remove any previous handlers by cloning
        const newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        newSave.addEventListener('click', handler);
      }
    }
  }

  // Helpers for status calculation and UI updates
  function parseNum(v){
    if (v === null || v === undefined || v === '') return NaN;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  function avgOf(arr){
    const nums = arr.map(parseNum).filter(n => Number.isFinite(n));
    if (nums.length === 0) return NaN;
    return nums.reduce((a,b)=>a+b,0)/nums.length;
  }

  function setStatusBanner(status){
    const statusContainer = document.getElementById('subject-status');
    if (!statusContainer) return;
    let cls = 'alert-secondary';
    let text = status;
    switch(status){
      case 'Aprobada': cls = 'alert-success'; break;
      case 'Desaprobada': cls = 'alert-danger'; break;
      case 'Promocionada': cls = 'alert-info text-dark'; break;
      case 'Regularizada': cls = 'alert-warning text-dark'; break;
      default: cls = 'alert-secondary'; break;
    }
    statusContainer.innerHTML = `<div class="alert ${cls} py-1 px-2 mb-0" role="status">${text}</div>`;
  }

  function showFinalsUpTo(n){
    const finals = [1,2,3,4].map(i => document.getElementById('final'+i)).filter(Boolean);
    finals.forEach((el, idx) => {
      if (idx < n) el.classList.remove('d-none'); else el.classList.add('d-none');
    });
    const finalsContainer = document.getElementById('finals-container');
    if (finalsContainer){
      if (n > 0) finalsContainer.classList.remove('d-none'); else finalsContainer.classList.add('d-none');
    }
  }

  function showPartialAttemptsUpTo(partialIndex, n){
    // partialIndex: 1 or 2, n: number of attempts to show (1..3)
    const ids = [1,2,3].map(i => document.getElementById(`parcial${partialIndex}_${i}`)).filter(Boolean);
    ids.forEach((el, idx) => {
      if (idx < n) el.classList.remove('d-none'); else el.classList.add('d-none');
    });
    const group = document.getElementById(`parcial${partialIndex}-group`);
    if (group){
      // keep group visible if at least one attempt visible
      if (n > 0) group.classList.remove('d-none'); else group.classList.add('d-none');
    }
  }

  function updateSubjectStatus(){
    // read partial attempts (attempts are ordered: 1=first try, 2=recup1, 3=recup2)
    const p1 = [document.getElementById('parcial1_1'),document.getElementById('parcial1_2'),document.getElementById('parcial1_3')];
    const p2 = [document.getElementById('parcial2_1'),document.getElementById('parcial2_2'),document.getElementById('parcial2_3')];
    const p1_vals = p1.map(i => i ? i.value : '');
    const p2_vals = p2.map(i => i ? i.value : '');
    const p1_first = parseNum(p1_vals[0]);
    const p2_first = parseNum(p2_vals[0]);

    // compute averages across provided attempts for regularizada check
    const p1_avg = avgOf(p1_vals);
    const p2_avg = avgOf(p2_vals);

    // finals values
    const finals = [document.getElementById('final1'),document.getElementById('final2'),document.getElementById('final3'),document.getElementById('final4')];
    const finalsVals = finals.map(f => f ? parseNum(f.value) : NaN);

    // Reset: hide all partial recuperatories; we will reveal those needed
    showPartialAttemptsUpTo(1,1);
    showPartialAttemptsUpTo(2,1);

    // Helper to detect filled attempts count per parcial
    function lastAttemptValue(attemptEls){
      for (let i = attemptEls.length - 1; i >= 0; i--){
        const v = attemptEls[i] ? parseNum(attemptEls[i].value) : NaN;
        if (!Number.isNaN(v)) return {value: v, index: i+1};
      }
      return {value: NaN, index: 0};
    }

    // Promotion logic with at most ONE recuperatory allowed across both partials
    // Case 1: both first tries >=8 => promocionada
    if (!Number.isNaN(p1_first) && !Number.isNaN(p2_first) && p1_first >= 8 && p2_first >= 8){
      showFinalsUpTo(0);
      setStatusBanner('Promocionada');
      return;
    }

    // Case 2: one first >=8 and the other <8 -> allow ONE recuperatory on the lower one to try to reach >=8
    let promotionCandidate = null; // {partialIndex:1|2}
    if (!Number.isNaN(p1_first) && !Number.isNaN(p2_first)){
      if (p1_first >= 8 && p2_first < 8) promotionCandidate = 2;
      else if (p2_first >= 8 && p1_first < 8) promotionCandidate = 1;
    }

    if (promotionCandidate){
      // show recuperatory attempt 2 for the candidate with placeholder 'Puede promocionar'
      const candidateEls = promotionCandidate === 1 ? p1 : p2;
      const otherFirst = promotionCandidate === 1 ? p2_first : p1_first;
      // reveal attempt2 for the candidate
      showPartialAttemptsUpTo(promotionCandidate, 2);
      const attempt2 = candidateEls[1];
      if (attempt2){
        attempt2.placeholder = 'Puede promocionar';
        attempt2.classList.remove('d-none');
      }
      // check if attempt2 filled and >=8 -> promocionada
      const attempt2val = attempt2 ? parseNum(attempt2.value) : NaN;
      if (!Number.isNaN(attempt2val) && attempt2val >= 8){
        // promotion achieved via single recuperatory
        showFinalsUpTo(0);
        setStatusBanner('Promocionada');
        return;
      }
      // If attempt2 filled but <8, promotion lost for this subject; fall through to recovery/regularized logic below
    }

    // Recovery logic for partials: if a parcial's (latest visible) attempt < 6, reveal next recuperatory(s)
    // For each parcial, reveal next attempt when needed and set proper placeholders
    [ {els: p1, idx:1}, {els: p2, idx:2} ].forEach(part => {
      const firstVal = parseNum(part.els[0] ? part.els[0].value : '');
      // If first attempt <6 or if second attempt already filled and <6, reveal next
      if (!Number.isNaN(firstVal) && firstVal < 6){
        // reveal attempt2
        showPartialAttemptsUpTo(part.idx, 2);
        const a2 = part.els[1];
        if (a2){
          // If this parcial was the promotion candidate, show 'Puede promocionar', otherwise 'Debe Recuperar'
          if (promotionCandidate === part.idx) a2.placeholder = 'Puede promocionar'; else a2.placeholder = 'Debe Recuperar';
          a2.classList.remove('d-none');
        }
        const a2val = a2 ? parseNum(a2.value) : NaN;
        if (!Number.isNaN(a2val) && a2val < 6){
          // reveal third recuperatory
          showPartialAttemptsUpTo(part.idx, 3);
          const a3 = part.els[2];
          if (a3) a3.classList.remove('d-none');
        }
      }
    });

    // After recovery attempts visibility, compute effective last-attempt values for regularizada
    const p1_last = lastAttemptValue(p1).value;
    const p2_last = lastAttemptValue(p2).value;
    if (!Number.isNaN(p1_last) && !Number.isNaN(p2_last) && p1_last >= 6 && p2_last >= 6){
      // Regularizada path: show finals progressively as before
      let attemptsToShow = 1;
      for (let i=0;i<finalsVals.length;i++){
        const v = finalsVals[i];
        if (Number.isNaN(v)) break;
        if (v < 6) attemptsToShow = i+2; else { showFinalsUpTo(i+1); setStatusBanner('Aprobada'); return; }
      }
      if (attemptsToShow > finals.length) attemptsToShow = finals.length;
      showFinalsUpTo(attemptsToShow);
      setStatusBanner('Regularizada');
      return;
    }

    // Fallback: not regularizada, not promocionada -> Desaprobada
    showFinalsUpTo(0);
    setStatusBanner('Desaprobada');
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
    // marker definitions for arrowheads (black and green) so arrowheads match stroke color
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
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
      const rObj = card.dataset.requirements ? JSON.parse(card.dataset.requirements) : { cursar: [], aprobar: [] };
      // cursar relations
      (rObj.cursar || []).forEach(r => {
        const id = (typeof r === 'string') ? r : (r.id || r.code);
        if (!dependentsMap[id]) dependentsMap[id] = [];
        dependentsMap[id].push({ card, relation: 'cursar', type: r.type || 'aprobada' });
      });
      // aprobar relations
      (rObj.aprobar || []).forEach(r => {
        const id = (typeof r === 'string') ? r : (r.id || r.code);
        if (!dependentsMap[id]) dependentsMap[id] = [];
        dependentsMap[id].push({ card, relation: 'aprobar', type: r.type || 'aprobada' });
      });
    });
  }

  function onCardHover(e){
    // Respect the user's toggle preference
    if (!correlativasEnabled) return;
    const card = e.currentTarget;
    // clear previous drawings
    clearOverlay();
    const reqObj = card.dataset.requirements ? JSON.parse(card.dataset.requirements) : { cursar: [], aprobar: [] };
    const requiresCursar = reqObj.cursar || [];
    const requiresAprobar = reqObj.aprobar || [];
    const code = card.dataset.code;
    const dependents = dependentsMap[code] || [];

    // Draw incoming arrows: from each requirement -> hovered card
    if ((requiresCursar && requiresCursar.length) || (requiresAprobar && requiresAprobar.length)) {
      drawArrowsFromRequirementsToCard(card, { cursar: requiresCursar, aprobar: requiresAprobar });
    }

    // Draw outgoing arrows: from hovered card -> dependents
    if (dependents && dependents.length) {
      drawArrowsToCard(card, dependents);
    }

    // Dim non-involved cards and highlight involved ones
    try {
      const involved = new Set();
      if (code) involved.add(code);
      (requiresCursar || []).forEach(r => involved.add((typeof r === 'string')? r : r.id));
      (requiresAprobar || []).forEach(r => involved.add((typeof r === 'string')? r : r.id));
      (dependents || []).forEach(dep => { if (dep.card && dep.card.dataset && dep.card.dataset.code) involved.add(dep.card.dataset.code); });

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

    // cursar: black, dashed if type === 'regularizada'
    (requires.cursar || []).forEach(r => {
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      const source = codeMap[id];
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
      // dashed if regularizada
      if (typeof r === 'object' && r.type === 'regularizada'){
        path.setAttribute('stroke-dasharray', '6,4');
      }
      path.setAttribute('stroke', '#000');
      path.setAttribute('marker-end','url(#arrowhead-black)');
      overlaySvg.appendChild(path);
    });

    // aprobar: green, dashed if regularizada
    (requires.aprobar || []).forEach(r => {
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      const source = codeMap[id];
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
      path.setAttribute('stroke', '#28a745');
      const t = (typeof r === 'object' && r.type) ? r.type : 'aprobada';
      if (t === 'regularizada') path.setAttribute('stroke-dasharray', '6,4');
      path.setAttribute('marker-end','url(#arrowhead-green)');
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
    dependents.forEach(dep => {
      const depCard = dep.card;
      const toRect = depCard.getBoundingClientRect();
      const toX = (toRect.left + toRect.right)/2 - containerRect.left;
      const toY = (toRect.top + toRect.bottom)/2 - containerRect.top;

      const dx = toX - fromX;
      const qx = fromX + dx * 0.5;
      const qy = fromY;

      const path = document.createElementNS('http://www.w3.org/2000/svg','path');
      const d = `M ${fromX} ${fromY} Q ${qx} ${qy} ${toX} ${toY}`;
      path.setAttribute('d', d);
      path.setAttribute('class','arrow-line');
      // set stroke + marker depending on relation and type
      if (dep.relation === 'cursar'){
        path.setAttribute('stroke', '#000');
        if (dep.type === 'regularizada') path.setAttribute('stroke-dasharray', '6,4');
        path.setAttribute('marker-end','url(#arrowhead-black)');
      } else if (dep.relation === 'aprobar'){
        path.setAttribute('stroke', '#28a745');
        if (dep.type === 'regularizada') path.setAttribute('stroke-dasharray', '6,4');
        path.setAttribute('marker-end','url(#arrowhead-green)');
      }
      overlaySvg.appendChild(path);
    });
  }

  function computeStats(list){
    // With grades removed, show simplified stats: total subjects and placeholders
    statsTotalPeso.textContent = '—';
    statsAvg.textContent = '—';
    statPlaceholder1.textContent = 'Materias mostradas: ' + list.length;
    statPlaceholder2.textContent = 'Aprobadas: N/D';

    progressBar.style.width = '0%';
    progressBar.setAttribute('aria-valuenow', 0);
    progressLabel.textContent = '—';
  }

  // Simple escape to avoid HTML injection in sample
  function escapeHtml(text){
    if (text === null || text === undefined) return '';
    return String(text).replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]);
    });
  }
});
