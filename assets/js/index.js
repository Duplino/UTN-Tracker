document.addEventListener('DOMContentLoaded', () => {
  const DATA_URL = 'assets/data/k23.json';
  // Electivas will be read from the main DATA_URL (k23.json) under the module with id 'electives'
  let planData = null;
  let electivasList = [];
  let columns = 5;

  const columnsContainer = document.querySelector('.columns-grid');
  const statsTotalPeso = document.getElementById('stat-peso');
  const statsAvg = document.getElementById('stat-promedio');
  const statPlaceholder1 = document.getElementById('stat-placeholder-1');
  const statPlaceholder2 = document.getElementById('stat-placeholder-2');
  const progressBar = document.getElementById('progress-bar');
  const progressLabel = document.getElementById('progress-label');
  let displayedSubjects = [];

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

  // Electivas button: open modal and load electivas from separate file
  const electivasBtn = document.getElementById('btn-electivas');
  function openElectivasModal(){
    // Use electivasList populated when the main DATA_URL was loaded
    const list = Array.isArray(electivasList) ? electivasList : [];
    if (!list || list.length === 0){
      console.warn('No hay electivas cargadas en el plan');
      const container = document.getElementById('electivas-container');
      if (container) container.innerHTML = '<div class="alert alert-warning">No hay electivas disponibles en el plan.</div>';
      const modalEl = document.getElementById('electivasModal');
      if (modalEl){ const inst = new bootstrap.Modal(modalEl); inst.show(); }
      return;
    }
    renderElectivasModal(list);
  }
  if (electivasBtn) electivasBtn.addEventListener('click', openElectivasModal);

  // --- LocalStorage helpers for subject data ---
  function getSubjectStorageKey(code){
    if (!code) return null;
    return `subjectData:${code}`;
  }

  function loadSubjectData(code){
    const key = getSubjectStorageKey(code);
    if (!key) return null;
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      console.warn('Error parseando subject data', e);
      return null;
    }
  }

  function saveSubjectData(code, payload){
    const key = getSubjectStorageKey(code);
    if (!key) return;
    try{
      localStorage.setItem(key, JSON.stringify(payload));
    }catch(e){
      console.error('Error guardando subject data', e);
    }
  }

  // Apply a very light status background class to a card (except 'Faltan notas')
  function applyCardStatusStyle(card, status){
    if (!card) return;
    // remove previous status classes
    ['card-status-aprobada','card-status-desaprobada','card-status-promocionada','card-status-regularizada'].forEach(c => card.classList.remove(c));
    if (!status) return;
    if (status === 'Faltan notas') return; // don't style when missing notes
    const mapping = {
      'Aprobada': 'card-status-aprobada',
      'Desaprobada': 'card-status-desaprobada',
      'Promocionada': 'card-status-promocionada',
      'Regularizada': 'card-status-regularizada'
    };
    const cls = mapping[status];
    if (cls) card.classList.add(cls);
  }

  // Create or remove a "Recursar" button inside the modal footer depending on status.
  function toggleRecursarButton(code){
    const modalFooter = document.querySelector('#subjectModal .modal-footer');
    if (!modalFooter) return;
    // remove existing if any
    const existing = modalFooter.querySelector('#subject-recursar');
    if (existing) existing.remove();
    // show button only when there is saved data for this subject
    const stored = loadSubjectData(code || '');
    if (!stored) return;

    // create button (text varies: 'Recursar' when Desaprobada, otherwise 'Dar de baja')
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'subject-recursar';
    btn.className = 'btn btn-danger me-auto';
    // decide label based on computed banner status (if present) else stored/override status
    const bannerEl = document.getElementById('subject-status-text');
    const bannerStatus = bannerEl ? bannerEl.textContent.trim() : null;
    const storedStatus = stored && (stored.overrideStatus || stored.status) ? (stored.overrideStatus || stored.status) : null;
    const label = (bannerStatus === 'Desaprobada' || storedStatus === 'Desaprobada') ? 'Recursar' : 'Dar de baja';
    btn.textContent = label;
    // handler: clear stored data for this subject and reset inputs
    btn.addEventListener('click', () => {
      // animate unlocks: capture available-before, remove data, then capture after and animate
      let prevAvailable = [];
      try{ prevAvailable = getAvailableSubjectCodes(); }catch(e){}
      const key = getSubjectStorageKey(code);
      if (key) localStorage.removeItem(key);
      // clear inputs
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
      showPartialAttemptsUpTo(1,1);
      showPartialAttemptsUpTo(2,1);
      // hide finals
      showFinalsUpTo(0);
      // clear status banner
      const statusContainer = document.getElementById('subject-status');
      if (statusContainer) statusContainer.innerHTML = '';
  // remove card styling and re-evaluate cursar state
  if (currentCard) applyCardStatusStyle(currentCard, null);
  updateAllCardCursarState();
  try{ const nowAvailable = getAvailableSubjectCodes(); animateNewlyUnlocked(prevAvailable, nowAvailable); }catch(e){}
      // remove the button itself
      btn.remove();
      // close modal after dar de baja
      try{
        const modalEl = document.getElementById('subjectModal');
        if (modalEl){
          const inst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
          inst.hide();
        }
      }catch(err){/* ignore */}
      // re-bind inputs listeners may already be bound; ensure status updates reflect cleared values
      updateSubjectStatus();
    });

    // insert at the start of footer (left side)
    modalFooter.insertBefore(btn, modalFooter.firstChild);
  }

  // The override control is now static in HTML (see index.html). Event binding and
  // initialization happens when opening the modal (onCardClick) so we remove the
  // dynamic renderer previously used.

  function clearOverrideFor(code){
    if (!code) return;
    const stored = loadSubjectData(code) || null;
    if (!stored) return;
    if (stored.overrideStatus){
      delete stored.overrideStatus;
      saveSubjectData(code, stored);
    }
    // update select UI if present
    const sel = document.getElementById('subject-override');
    if (sel) sel.value = 'computed';
  }

  // Evaluate 'cursar' requirements for a given card. Returns true if all requirements met.
  function cursarRequirementsMetForCard(card){
    if (!card) return true;
    const reqObj = card.dataset.requirements ? JSON.parse(card.dataset.requirements) : { cursar: [] };
    const cursar = reqObj.cursar || [];
    // If there are no cursar requirements, it's allowed
    if (!cursar || cursar.length === 0) return true;
    // For each requirement id check stored status
    for (const r of cursar){
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      if (!id) return false;
      const stored = loadSubjectData(id);
      // if user override exists, consider it
      const status = stored && stored.overrideStatus ? stored.overrideStatus : (stored && stored.status ? stored.status : null);
      // If no status, requirement not met
      if (!status) return false;
      // Determine acceptable statuses
      const type = (typeof r === 'object' && r.type) ? r.type : 'aprobada';
      if (type === 'regularizada'){
        // regularizada requirement can be met by Regularizada, Aprobada or Promocionada
        if (['Regularizada','Aprobada','Promocionada'].includes(status)) continue;
        return false;
      } else {
        // default: require aprobada (Aprobada or Promocionada)
        if (['Aprobada','Promocionada'].includes(status)) continue;
        return false;
      }
    }
    return true;
  }

  // Update all cards to mark as disabled if they don't meet cursar requirements
  function renderGroups(data){
    const modules = Array.isArray(data.modules) ? data.modules : [];
    // filter out modules that should not be rendered as columns
    const visibleModules = modules.filter(m => m && m.render !== false);
    if (visibleModules.length === 0) {
      columnsContainer.innerHTML = '<div class="alert alert-info">No hay módulos disponibles.</div>';
      return;
    }

    // Use number of visible modules as columns (limit to max 8 for layout sanity)
    columns = Math.min(Math.max(visibleModules.length, 1), 8);
    columnsContainer.innerHTML = '';

    // assign consecutive data-index values for visible columns
    visibleModules.forEach((module, visIdx) => {
      const col = document.createElement('div');
      col.className = 'column-col';
      col.dataset.index = visIdx;

      // Column header with module name (no color in new format)
      const header = document.createElement('div');
      header.className = 'mb-2';
      header.innerHTML = `<strong>${escapeHtml(module.name)}</strong>`;
      col.appendChild(header);

      // Render all subjects per module
      const subjects = Array.isArray(module.subjects) ? module.subjects : [];
      subjects.forEach(subj => col.appendChild(createCard(subj, module)));

      // Insert electiva placeholders according to module.electivas (if present)
      const electivasCount = Number.isFinite(Number(module.electivas)) ? Number(module.electivas) : 0;
      for (let i = 0; i < electivasCount; i++){
        col.appendChild(createAddElectivaPlaceholder(visIdx));
      }

      columnsContainer.appendChild(col);
    });

    // Compute stats from all displayed subjects (use visible modules)
    displayedSubjects = [];
    visibleModules.forEach(m => {
      if (Array.isArray(m.subjects)) displayedSubjects.push(...m.subjects);
    });
    computeStats(displayedSubjects);

    // Setup overlay SVG and interactivity for correlativas
    setupOverlayAndInteractions();
    // restore any previously added electivas from localStorage (will replace placeholders)
    try{ restoreElectivesFromStorage(); }catch(e){/* ignore */}
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
      // recompute stats after recursar
      try{ computeStats(displayedSubjects); }catch(e){/* ignore */}
    // open subject modal on click
    card.addEventListener('click', onCardClick);
    return card;
  }

  // Create a placeholder 'add electiva' card: dotted gray border, transparent background, centered +
  // Accepts column index where it was placed so we can later insert the electiva in that column
  function createAddElectivaPlaceholder(colIndex){
    const card = document.createElement('div');
    card.className = 'card card-subject card-electiva-add';
    card.setAttribute('role','button');
    card.setAttribute('aria-label','Agregar electiva');
    card.style.cursor = 'pointer';
    card.dataset.targetColumn = String(typeof colIndex === 'number' ? colIndex : '');
    card.innerHTML = `<div>+</div>`;
    // Open electivas modal when clicked and remember insertion target
    card.addEventListener('click', (ev) => {
      electivaInsertTarget = { colIndex: typeof colIndex === 'number' ? colIndex : null, placeholderEl: card };
      try{ openElectivasModal(); }catch(e){ console.error('Error opening electivas modal', e); }
    });
    return card;
  }

  // Subject modal behavior
  let currentCard = null;
  function onCardClick(e){
    // open modal and populate minimal info
    currentCard = e.currentTarget;
    // If card is disabled (doesn't meet cursar requirements) highlight missing requirements instead of opening modal
    if (currentCard.classList && currentCard.classList.contains('card-disabled')){
      try{ highlightMissingRequirements(currentCard); }catch(err){/* ignore */}
      return;
    }
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
      // ensure footer is visible by default when opening modal
      const mf = modalEl.querySelector('.modal-footer'); if (mf) mf.style.display = '';
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
          inp.addEventListener('input', () => {
            // Clearing any user override when notes are modified so the status is recomputed
            clearOverrideFor(code);
            updateSubjectStatus();
            toggleRecursarButton(code);
          });
        });
      }
      // If we have saved data for this subject, populate fields
      const stored = loadSubjectData(code || name);
      if (stored && stored.values){
        Object.keys(stored.values).forEach(id => {
          const el = document.getElementById(id);
          if (el && stored.values[id] !== null && stored.values[id] !== undefined){
            el.value = stored.values[id];
            // Ensure visibility for attempts/finals that were stored
            if (id.startsWith('parcial1_')) showPartialAttemptsUpTo(1, Math.max(1, parseInt(id.split('_')[1] || '1')));
            if (id.startsWith('parcial2_')) showPartialAttemptsUpTo(2, Math.max(1, parseInt(id.split('_')[1] || '1')));
            if (id.startsWith('final')){
              // determine how many finals should be visible based on highest final index with value
              const idx = parseInt(id.replace('final','') || '1');
              showFinalsUpTo(idx);
            }
          }
        });
      }
      // ensure finals container initially hidden until status logic decides
      const finalsContainer = document.getElementById('finals-container');
      if (finalsContainer) finalsContainer.classList.add('d-none');
      // clear any previous status
      const statusContainer = document.getElementById('subject-status');
      if (statusContainer) statusContainer.innerHTML = '';
      // render 'Empezar' button when subject not present in localStorage and is available to cursar
      function renderStartButton(code){
        // remove any previous wrapper
        const prev = document.getElementById('subject-start-wrap');
        if (prev) prev.remove();
        const effectiveCode = code || (currentCard && currentCard.dataset && currentCard.dataset.code) || '';
        if (!effectiveCode) return;
        const stored = loadSubjectData(effectiveCode);
        // only show when NOT stored and when subject can be cursar
        if (stored) return;
        if (!cursarRequirementsMetForCard(currentCard)) return;

        // Hide main form and status area so the big button occupies the modal
        const formEl = document.getElementById('subject-form');
        const statusEl = document.getElementById('subject-status');
        const modalFooter = document.querySelector('#subjectModal .modal-footer');
  const overrideWrap = document.getElementById('subject-override-wrap');
        if (formEl) formEl.classList.add('d-none');
        if (statusEl) statusEl.classList.add('d-none');
  if (modalFooter) modalFooter.style.display = 'none';
  // hide the small override control while the big 'Empezar' button is shown
  if (overrideWrap) overrideWrap.classList.add('d-none');

        const wrap = document.createElement('div');
        wrap.id = 'subject-start-wrap';
        wrap.className = 'd-flex flex-column justify-content-center align-items-center';
        wrap.style.minHeight = '180px';
        wrap.style.gap = '12px';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'subject-start';
        btn.className = 'btn btn-success btn-lg';
        btn.style.padding = '0.75rem 2rem';
        btn.textContent = 'Empezar';

        btn.addEventListener('click', () => {
          // animate unlocks: capture available-before, save minimal stored object, then animate any newly unlocked
          let prevAvailable = [];
          try{ prevAvailable = getAvailableSubjectCodes(); }catch(e){}
          // create minimal stored object
          const obj = { values: {}, status: 'Faltan examenes', savedAt: (new Date()).toISOString() };
          saveSubjectData(effectiveCode, obj);

          // If this modal was opened for an electiva selection and we have a pending insert target,
          // create a real dashboard card in that column and remove the placeholder.
          try{
            if (currentCard && currentCard._electivaMeta && currentCard._insertTarget){
              const meta = currentCard._electivaMeta;
              const target = currentCard._insertTarget;
              // avoid duplicates: if code already present, just remove placeholder
              if (!meta.code || !codeMap[meta.code]){
                const newCard = createCard(meta);
                const colEl = columnsContainer.querySelector(`.column-col[data-index="${target.colIndex}"]`);
                if (colEl){
                  if (target.placeholderEl && target.placeholderEl.parentNode === colEl){
                    colEl.insertBefore(newCard, target.placeholderEl);
                    target.placeholderEl.remove();
                  } else {
                    colEl.appendChild(newCard);
                  }
                  // Rebuild overlay/maps so the new card is included
                  setupOverlayAndInteractions();
                  try{ computeStats(displayedSubjects); }catch(e){}
                  // set currentCard to the newly created real card so subsequent UI updates apply to it
                  currentCard = codeMap[meta.code] || newCard;
                }
              } else {
                // already exists: remove placeholder if present
                try{ if (target && target.placeholderEl && target.placeholderEl.parentNode) target.placeholderEl.remove(); }catch(e){}
              }
              // clear pending insert
              electivaInsertTarget = null;
              if (currentCard && currentCard._insertTarget) delete currentCard._insertTarget;
            }
          }catch(e){ console.error('Error inserting electiva into column', e); }

          // restore modal content
          if (formEl) formEl.classList.remove('d-none');
          if (statusEl) { statusEl.classList.remove('d-none'); setStatusBanner(obj.status); }
          // restore override control visibility when returning from 'Empezar'
          if (overrideWrap) overrideWrap.classList.remove('d-none');
          if (modalFooter) modalFooter.style.display = '';
          // update visuals
          applyCardStatusStyle(currentCard, null);
          updateAllCardCursarState();
          try{ const nowAvailable = getAvailableSubjectCodes(); animateNewlyUnlocked(prevAvailable, nowAvailable); }catch(e){}
          try{ computeStats(displayedSubjects); }catch(e){}
          // remove the big start wrapper
          wrap.remove();
        });

        wrap.appendChild(btn);
        // place the wrapper into the modal body (replace content area)
        const modalBody = modalEl.querySelector('.modal-body');
        if (modalBody) modalBody.appendChild(wrap);
      }
      // bind and run initial status calculation
      bindLiveInputs();
      updateSubjectStatus();
      // ensure recursar button reflects current status
      toggleRecursarButton(code);
      // initialize static override control (exists in HTML) and bind change handler
      try{
        const overrideSel = document.getElementById('subject-override');
        const effectiveCode = code || (currentCard && currentCard.dataset && currentCard.dataset.code) || '';
        if (overrideSel){
          // set initial value from stored override
          const storedOverride = loadSubjectData(effectiveCode || '') || {};
          overrideSel.value = storedOverride && storedOverride.overrideStatus ? storedOverride.overrideStatus : 'computed';
          // replace to remove previous handlers then attach
          const newSel = overrideSel.cloneNode(true);
          overrideSel.parentNode.replaceChild(newSel, overrideSel);
          newSel.addEventListener('change', () => {
            // before changing override, capture available subjects
            let prev = [];
            try{ prev = getAvailableSubjectCodes(); }catch(e){}
            let s = loadSubjectData(effectiveCode || '') || {};
            const val = newSel.value;
            if (val === 'computed'){
              if (s.overrideStatus) delete s.overrideStatus;
            } else {
              s.overrideStatus = val;
            }
            if (!s.values) s.values = (s.values || {});
            saveSubjectData(effectiveCode || '', s);
            const applyStatus = (val === 'computed') ? (document.getElementById('subject-status-text') ? document.getElementById('subject-status-text').textContent.trim() : '') : val;
            setStatusBanner(applyStatus || '');
            applyCardStatusStyle(currentCard, (val === 'computed') ? (s && s.status ? s.status : null) : val);
            try{ computeStats(displayedSubjects); }catch(e){}
            // re-evaluate cursar state and animate newly unlocked subjects
            try{ updateAllCardCursarState(); const now = getAvailableSubjectCodes(); animateNewlyUnlocked(prev, now); }catch(e){}
            try{
              const modalEl = document.getElementById('subjectModal');
              if (modalEl){
                const inst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
                inst.hide();
              }
            }catch(err){/* ignore */}
          });
          // ensure override wrapper is visible by default when modal opens
          const overrideWrap = document.getElementById('subject-override-wrap');
          if (overrideWrap) overrideWrap.classList.remove('d-none');
        }
      }catch(e){}
      // render start button for current subject AFTER banner/override are rendered
      try{ renderStartButton(code); }catch(e){}
      // wire save to close the modal and log values (placeholder behavior)
      const saveBtn = document.getElementById('subject-save');
      if (saveBtn){
        const handler = () => {
          // capture available-before to animate newly unlocked after save
          let prevAvailable = [];
          try{ prevAvailable = getAvailableSubjectCodes(); }catch(e){}
          const values = {};
          ['parcial1_1','parcial1_2','parcial1_3','parcial2_1','parcial2_2','parcial2_3','final1','final2','final3','final4'].forEach(id => {
            const i = document.getElementById(id);
            values[id] = i ? i.value : null;
          });
          // ensure status reflects latest inputs
          updateSubjectStatus();
          const statusEl = document.getElementById('subject-status');
          const statusText = statusEl ? statusEl.textContent.trim() : '';
          // persist to localStorage
          const storedObj = { values, status: statusText, savedAt: (new Date()).toISOString() };
          // Do NOT preserve existing override: saving the modal should clear any manual override
          // so the computed status (from the entered notes) becomes the source of truth.
          saveSubjectData(code || name, storedObj);
          // Ensure the static override control resets to 'computed' in the UI
          try{
            const ov = document.getElementById('subject-override');
            if (ov){
              const newOv = ov.cloneNode(true);
              newOv.value = 'computed';
              ov.parentNode.replaceChild(newOv, ov);
            }
          }catch(e){}
          console.log('Guardado subject:', code || name, { values, status: statusText });
          // update card style in dashboard
          applyCardStatusStyle(currentCard, statusText);
          // after saving, re-evaluate cursar state for all cards (some may unlock)
          updateAllCardCursarState();
          try{ const nowAvailable = getAvailableSubjectCodes(); animateNewlyUnlocked(prevAvailable, nowAvailable); }catch(e){}
          // recompute stats after saving
          try{ computeStats(displayedSubjects); }catch(e){/* ignore */}
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

  // When a disabled card is clicked, highlight the missing 'cursar' requirements
  function highlightMissingRequirements(card){
    if (!card) return;
    const reqObj = card.dataset.requirements ? JSON.parse(card.dataset.requirements) : { cursar: [] };
    const cursar = reqObj.cursar || [];
    if (!cursar || cursar.length === 0) return;
    // For each required id, find the card in codeMap and animate it
    cursar.forEach((r, idx) => {
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      if (!id) return;
      const target = codeMap[id];
      if (!target) return;
      // add highlight class
      target.classList.add('req-highlight');
      // optionally scroll the first missing into view
      if (idx === 0){
        try{ target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }catch(e){}
      }
      // remove after animation
      setTimeout(() => {
        try{ target.classList.remove('req-highlight'); }catch(e){}
      }, 800);
    });
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
    // Build alert element as DOM so we can place the override select inside it
    statusContainer.innerHTML = '';
    let cls = 'alert-secondary';
    switch(status){
      case 'Aprobada': cls = 'alert-success'; break;
      case 'Desaprobada': cls = 'alert-danger'; break;
      case 'Promocionada': cls = 'alert-info text-dark'; break;
      case 'Regularizada': cls = 'alert-warning text-dark'; break;
      case 'Faltan notas': cls = 'alert-warning text-dark'; break;
      case 'No regularizada': cls = 'alert-warning text-dark'; break;
      default: cls = 'alert-secondary'; break;
    }
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${cls} py-1 px-2 mb-0 d-flex justify-content-between align-items-center`;
    alertDiv.setAttribute('role','status');
    const left = document.createElement('div');
    left.id = 'subject-status-text';
    left.textContent = status || '';
    alertDiv.appendChild(left);
    statusContainer.appendChild(alertDiv);
  // The override control is static in HTML; its value will be synced when modal opens.
  }

  function showFinalsUpTo(n){
    const finals = [1,2,3,4].map(i => document.getElementById('final'+i)).filter(Boolean);
    finals.forEach((el, idx) => {
      if (idx < n) el.classList.remove('d-none'); else el.classList.add('d-none');
    });
    const finalsContainer = document.getElementById('finals-container');
    if (finalsContainer){
      const finalsLabel = finalsContainer.previousElementSibling && finalsContainer.previousElementSibling.tagName === 'LABEL' ? finalsContainer.previousElementSibling : null;
      if (n > 0){
        finalsContainer.classList.remove('d-none');
        if (finalsLabel) finalsLabel.classList.remove('d-none');
      } else {
        finalsContainer.classList.add('d-none');
        if (finalsLabel) finalsLabel.classList.add('d-none');
      }
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

    // Detect presence of notas per parcial. If some notas are missing we still want to
    // run the recovery / "Debe Recuperar" calculation for the parcial(s) that have values.
    // We will mark a 'faltanNotas' flag and avoid early returning so the UI shows recuperatories
    // while keeping finals hidden and the banner as 'Faltan notas' when appropriate.
    const p1_hasNote = p1_vals.map(v=>parseNum(v)).some(n=>!Number.isNaN(n));
    const p2_hasNote = p2_vals.map(v=>parseNum(v)).some(n=>!Number.isNaN(n));
    const faltanNotas = (!p1_hasNote || !p2_hasNote);
    if (faltanNotas){
      // keep finals hidden while notes are incomplete, but continue computing recuperatories
      showFinalsUpTo(0);
      // don't return here; continue to run recovery/placeholder logic below
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
    const p1_last_info = lastAttemptValue(p1);
    const p2_last_info = lastAttemptValue(p2);
    const p1_last = p1_last_info.value;
    const p2_last = p2_last_info.value;
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

    // If any parcial has exhausted all attempts (index === 3) and the last value is <6, the subject is Desaprobada
    if ((p1_last_info.index === 3 && !Number.isNaN(p1_last_info.value) && p1_last_info.value < 6) ||
        (p2_last_info.index === 3 && !Number.isNaN(p2_last_info.value) && p2_last_info.value < 6)){
      showFinalsUpTo(0);
      // If notes are missing, prefer showing 'Faltan notas' instead of marking Desaprobada
      if (faltanNotas){
        setStatusBanner('Faltan notas');
      } else {
        setStatusBanner('Desaprobada');
      }
      return;
    }

    // Fallback: not regularizada, not promocionada -> either 'No regularizada' if there are remaining attempts, or 'Desaprobada' when all attempts exhausted
    // Check if any partial or final attempt slots are still available (empty)
    const partialAttemptEls = p1.concat(p2).filter(Boolean);
    const partialRemaining = partialAttemptEls.some(el => {
      const v = el.value; return v === null || v === undefined || v === '';
    });
    const finalEls = finals.filter(Boolean);
    const finalRemaining = finalEls.some(el => {
      const v = el.value; return v === null || v === undefined || v === '';
    });
    showFinalsUpTo(0);
    // If some notas are missing, show that message instead of inferring No regularizada / Desaprobada
    if (faltanNotas){
      setStatusBanner('Faltan notas');
      return;
    }
    if (partialRemaining || finalRemaining){
      setStatusBanner('No regularizada');
    } else {
      setStatusBanner('Desaprobada');
    }
  }

  // Overlay and arrows
  let overlaySvg = null;
  let codeMap = {};
  let dependentsMap = {};
  // When clicking a placeholder + to add an electiva, we store the target column and placeholder element here
  let electivaInsertTarget = null;

  // Update all cards' disabled/enabled state according to cursar requirements
  function updateAllCardCursarState(){
    try{
      if (!columnsContainer) return;
      const all = columnsContainer.querySelectorAll('.card-subject');
      all.forEach(c => {
        try{
          const meets = cursarRequirementsMetForCard(c);
          // disabled when requirements NOT met
          if (!meets){
            c.classList.add('card-disabled');
            c.setAttribute('aria-disabled','true');
          } else {
            c.classList.remove('card-disabled');
            c.removeAttribute('aria-disabled');
          }
          // available (dashed border) when requirements met but subject not started/saved
          try{
            const code = c.dataset && c.dataset.code ? c.dataset.code : null;
            const stored = code ? loadSubjectData(code) : null;
            if (meets && !stored){
              c.classList.add('card-available');
            } else {
              c.classList.remove('card-available');
            }
          }catch(e){ /* ignore per-card */ }
        }catch(e){/* ignore per-card errors */}
      });
    }catch(e){ console.error('Error actualizando estado de cursar en cards', e); }
  }

  // Return array of subject codes that currently meet 'cursar' requirements and are not started (no stored data)
  function getAvailableSubjectCodes(){
    const codes = [];
    try{
      if (!columnsContainer) return codes;
      const all = columnsContainer.querySelectorAll('.card-subject');
      all.forEach(c => {
        try{
          const code = c.dataset && c.dataset.code ? c.dataset.code : null;
          if (!code) return;
          const meets = cursarRequirementsMetForCard(c);
          const stored = loadSubjectData(code);
          if (meets && !stored) codes.push(code);
        }catch(e){/* ignore per-card */}
      });
    }catch(e){/* ignore */}
    return codes;
  }

  // Animate newly unlocked subject cards (codes present in newCodes but not in prevCodes)
  function animateNewlyUnlocked(prevCodes, newCodes){
    try{
      const prevSet = new Set(prevCodes || []);
      (newCodes || []).forEach(code => {
        if (!prevSet.has(code)){
          const card = codeMap[code] || (columnsContainer ? columnsContainer.querySelector(`.card-subject[data-code="${code}"]`) : null);
          if (card){
            card.classList.add('card-unlocked');
            setTimeout(()=>{ try{ card.classList.remove('card-unlocked'); }catch(e){} }, 1400);
          }
        }
      });
    }catch(e){/* ignore */}
  }

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

    // Apply saved styles for each card based on persisted status
    Object.keys(codeMap).forEach(code => {
      try{
        const stored = loadSubjectData(code);
        if (stored){
          const effectiveStatus = stored.overrideStatus ? stored.overrideStatus : (stored.status ? stored.status : null);
          if (effectiveStatus) applyCardStatusStyle(codeMap[code], effectiveStatus);
        }
      }catch(e){/* ignore */}
    });

    // After applying styles, evaluate cursar requirements and disable cards that don't meet them
    updateAllCardCursarState();

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
    // Compute approved and regularized counts based on saved statuses in localStorage
    const total = Array.isArray(list) ? list.length : 0;
    let approved = 0;
    let regularized = 0;
    for (const subj of (list || [])){
      const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
      const stored = key ? loadSubjectData(key) : null;
      const status = stored && stored.overrideStatus ? stored.overrideStatus : (stored && stored.status ? stored.status : null);
      if (status === 'Aprobada' || status === 'Promocionada') approved++;
      else if (status === 'Regularizada') regularized++;
    }

    // Update stat cards
    statsTotalPeso.textContent = '—';
    statsAvg.textContent = '—';
    statPlaceholder1.textContent = approved + ' / ' + total;
    statPlaceholder2.textContent = regularized;

    // Progress formula: (approved + regularized/2) / total
    let progress = 0;
    if (total > 0){
      progress = ((approved + (regularized / 2)) / total) * 100;
      if (!Number.isFinite(progress)) progress = 0;
    }
    const pct = Math.round(progress);
    progressBar.style.width = `${pct}%`;
    progressBar.setAttribute('aria-valuenow', pct);
    progressLabel.textContent = total > 0 ? `${pct}%` : '—';
  }

  // Simple escape to avoid HTML injection in sample
  function escapeHtml(text){
    if (text === null || text === undefined) return '';
    return String(text).replace(/[&<>"']/g, function(ch){
      return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]);
    });
  }

  // Render electivas list into the electivas modal container and show modal
  function renderElectivasModal(list){
    const container = document.getElementById('electivas-container');
    if (!container) return;
    container.innerHTML = '';
    if (!Array.isArray(list) || list.length === 0){
      container.innerHTML = '<div class="col-12"><div class="alert alert-info">No hay electivas disponibles.</div></div>';
    } else {
      list.forEach(subj => {
        const col = document.createElement('div');
        col.className = 'col-12 col-md-6 col-lg-4 mb-3';
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <div class="card-body p-2">
            <h6 class="mb-1">${escapeHtml(subj.name || subj.code)}</h6>
            <small class="text-muted">${escapeHtml(subj.code || '')}</small>
            <div class="mt-2"><small class="text-muted">${escapeHtml((subj.requirements && subj.requirements.cursar && subj.requirements.cursar.length) ? ('Requiere: ' + subj.requirements.cursar.map(r => (typeof r === 'string' ? r : (r.id||r.code))).join(', ')) : '')}</small></div>
            <div class="mt-2 d-flex gap-2">
              <button class="btn btn-sm btn-primary btn-add-elective">Agregar al tablero</button>
              <button class="btn btn-sm btn-outline-secondary btn-view-elective">Ver</button>
            </div>
          </div>
        `;
        // Clicking an electiva opens the subject modal prepopulated for that elective
        card.style.cursor = 'pointer';
        // Determine if this electiva is already on the tablero (by code)
        const alreadyOnBoard = subj && subj.code && codeMap && codeMap[subj.code];

        // 'Ver' button: show only when electiva is on the board; it should open the real card modal
        const viewBtn = card.querySelector('.btn-view-elective');
        if (viewBtn){
          if (alreadyOnBoard){
            // Open the actual card on the board
            viewBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              try{
                const real = codeMap[subj.code];
                if (real) onCardClick({ currentTarget: real });
              }catch(e){ console.error('Error abriendo electiva real', e); }
              try{ const m = document.getElementById('electivasModal'); if (m){ const inst = bootstrap.Modal.getInstance(m) || new bootstrap.Modal(m); inst.hide(); } }catch(e){}
            });
          } else {
            // hide the view button when electiva not on board
            viewBtn.style.display = 'none';
          }
        }

        // 'Agregar al tablero' button: show only when electiva is NOT on the board
        const addBtn = card.querySelector('.btn-add-elective');
        if (addBtn){
          if (alreadyOnBoard){
            addBtn.style.display = 'none';
          } else {
            addBtn.addEventListener('click', (ev) => {
              ev.stopPropagation();
              // If there's a pending insert target (user clicked a + placeholder), insert directly
              // into that column and replace the placeholder element.
              if (electivaInsertTarget && typeof electivaInsertTarget.colIndex === 'number'){
                // close electivas modal first
                try{ const m = document.getElementById('electivasModal'); if (m){ const inst = bootstrap.Modal.getInstance(m) || new bootstrap.Modal(m); inst.hide(); } }catch(e){}
                performAddElectiveToColumn(subj, electivaInsertTarget.colIndex, electivaInsertTarget.placeholderEl);
                // clear pending insert target
                electivaInsertTarget = null;
                return;
              }
              // fallback: ask user which column to add to
              showPickColumnModal(subj);
            });
          }
        }
        col.appendChild(card);
        container.appendChild(col);
      });
    }
    const modalEl = document.getElementById('electivasModal');
    if (modalEl){ const inst = new bootstrap.Modal(modalEl); inst.show(); }
  }

  // Show a small modal to pick a column where to insert the electiva
  function showPickColumnModal(subj){
    // build modal if not present
    let pick = document.getElementById('pickColumnModal');
    if (!pick){
      pick = document.createElement('div');
      pick.id = 'pickColumnModal';
      pick.className = 'modal fade';
      pick.tabIndex = -1;
      pick.innerHTML = `
        <div class="modal-dialog modal-sm modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header"><h5 class="modal-title">Agregar al tablero</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button></div>
            <div class="modal-body">
              <div class="mb-2"><label class="form-label">Elegí columna</label><select id="pickColumnSelect" class="form-select"></select></div>
              <div id="pickColumnAlert"></div>
            </div>
            <div class="modal-footer"><button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button><button type="button" class="btn btn-primary" id="pickColumnConfirm">Agregar</button></div>
          </div>
        </div>
      `;
      document.body.appendChild(pick);
    }
    // populate select with current columns
    const select = pick.querySelector('#pickColumnSelect');
    select.innerHTML = '';
    const cols = Array.from(document.querySelectorAll('.column-col'));
    if (cols.length === 0){
      const alert = pick.querySelector('#pickColumnAlert');
      if (alert) alert.innerHTML = '<div class="alert alert-warning">No hay columnas disponibles para insertar.</div>';
      const modal = new bootstrap.Modal(pick); modal.show();
      return;
    }
    cols.forEach(c => {
      const idx = c.dataset.index;
      const nameEl = c.querySelector('strong');
      const name = nameEl ? nameEl.textContent.trim() : (`Col ${idx}`);
      const opt = document.createElement('option'); opt.value = idx; opt.textContent = `${idx} — ${name}`;
      select.appendChild(opt);
    });
    // show modal
    const modal = new bootstrap.Modal(pick);
    modal.show();
    // confirm handler
    const confirmBtn = pick.querySelector('#pickColumnConfirm');
    const handler = () => {
      const chosen = parseInt(select.value, 10);
      // if there's a placeholder in the chosen column, prefer replacing it
      const colEl = columnsContainer.querySelector(`.column-col[data-index="${chosen}"]`);
      let placeholderEl = null;
      if (colEl){
        placeholderEl = colEl.querySelector('.card-electiva-add');
      }
      performAddElectiveToColumn(subj, chosen, placeholderEl);
      confirmBtn.removeEventListener('click', handler);
      modal.hide();
    };
    confirmBtn.addEventListener('click', handler);
  }

  // Insert electiva into a given column index and persist in localStorage under key 'electives'
  function performAddElectiveToColumn(subj, colIndex, placeholderEl, skipConfirm){
    try{
      // avoid duplicates
      if (subj.code && codeMap[subj.code]){
        showElectivasAlert('warning', 'La electiva ya está presente en el tablero.');
        return;
      }
      // check cursar requirements for this electiva using existing stored data
      const tmp = document.createElement('div');
      tmp.dataset.requirements = JSON.stringify(subj.requirements || { cursar: [], aprobar: [] });
      const meets = cursarRequirementsMetForCard(tmp);
      if (!meets && !skipConfirm){
        const proceed = window.confirm('La electiva no cumple las correlativas para cursar. ¿Deseás agregarla de todos modos?');
        if (!proceed) return;
      }
      const newCard = createCard(subj);
      // mark as electiva and add a delete (trash) button on the top-right corner
      try{
        newCard.classList.add('card-electiva');
        newCard.dataset.electiva = '1';
        // ensure relative positioning so the trash button can be absolute
        const prevPos = newCard.style.position;
        if (!prevPos) newCard.style.position = 'relative';
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn-sm btn-outline-danger btn-electiva-remove';
        removeBtn.setAttribute('aria-label','Eliminar electiva');
        removeBtn.style.position = 'absolute';
        removeBtn.style.top = '6px';
        removeBtn.style.right = '6px';
        removeBtn.style.zIndex = '10';
        removeBtn.style.padding = '0.15rem 0.4rem';
        removeBtn.innerHTML = '🗑';
        // deletion handler: stop propagation (don't open modal), remove from board and storage
        removeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          try{
            const key = subj.code || subj.name;
            // if subject in course, remove its stored data (dar de baja)
            try{ const sk = getSubjectStorageKey(key); if (sk) localStorage.removeItem(sk); }catch(e){}
            // remove from electives map
            try{
              const raw = localStorage.getItem('electives');
              if (raw){ const obj = JSON.parse(raw); if (obj && obj[key]){ delete obj[key]; localStorage.setItem('electives', JSON.stringify(obj)); } }
            }catch(e){ console.error('Error actualizando electives al eliminar', e); }
            // Remove the card from DOM and replace with a placeholder in the same column and position
            const parent = newCard.parentNode;
            const next = newCard.nextSibling;
            newCard.remove();
            try{
              const colIdx = typeof colIndex === 'number' ? colIndex : (parent && parent.dataset ? parseInt(parent.dataset.index,10) : NaN);
              if (!Number.isNaN(colIdx) && parent){
                const ph = createAddElectivaPlaceholder(colIdx);
                if (next) parent.insertBefore(ph, next); else parent.appendChild(ph);
              }
            }catch(e){/* ignore */}
            // refresh overlay and stats
            try{ setupOverlayAndInteractions(); }catch(e){}
            try{ computeStats(displayedSubjects); }catch(e){}
          }catch(err){ console.error('Error eliminando electiva', err); }
        });
        // prepend remove button into the card body
        const body = newCard.querySelector('.card-body') || newCard;
        body.appendChild(removeBtn);
      }catch(e){ console.error('Error agregando boton eliminar a la card', e); }
      const colEl = columnsContainer.querySelector(`.column-col[data-index="${colIndex}"]`);
      if (colEl){
        // If a placeholder element was provided and it lives in the target column,
        // replace it with the new card. Otherwise append at the end of the column.
        if (placeholderEl && placeholderEl.parentNode === colEl){
          colEl.insertBefore(newCard, placeholderEl);
          try{ placeholderEl.remove(); }catch(e){}
        } else {
          colEl.appendChild(newCard);
        }
      } else {
        // no column found: append directly to container
        columnsContainer.appendChild(newCard);
      }
      // persist placement
      try{
        const raw = localStorage.getItem('electives');
        const obj = raw ? JSON.parse(raw) : {};
        obj[subj.code || subj.name] = { colIndex };
        localStorage.setItem('electives', JSON.stringify(obj));
      }catch(e){ console.error('Error guardando electives', e); }
      // refresh overlays and stats
      setupOverlayAndInteractions();
      try{ computeStats(displayedSubjects); }catch(e){}
      showElectivasAlert('success', 'Electiva agregada al tablero.');
    }catch(e){ console.error('Error agregando electiva', e); showElectivasAlert('danger','Error al agregar electiva.'); }
  }

  // Restore electivas previously saved in localStorage into the dashboard.
  // Behavior: read `localStorage.electives` and use electivasList (loaded from DATA_URL)
  // to get the real metadata (so cards show the electiva name instead of just the code),
  // then insert each electiva into its saved column, replacing placeholders when possible.
  function restoreElectivesFromStorage(){
    try{
      const raw = localStorage.getItem('electives');
      if (!raw) return;
      const stored = JSON.parse(raw);
      if (!stored || Object.keys(stored).length === 0) return;
      // Build lookup from electivasList (loaded from DATA_URL)
      const list = Array.isArray(electivasList) ? electivasList : [];
      const byCode = {};
      const byName = {};
      list.forEach(s => { if (s.code) byCode[s.code] = s; if (s.name) byName[s.name] = s; });
      Object.keys(stored).forEach(key => {
        try{
          const entry = stored[key];
          const colIndex = typeof entry.colIndex === 'number' ? entry.colIndex : parseInt(entry.colIndex,10);
          // prefer matching by code first, then by name
          let subjMeta = null;
          if (byCode[key]) subjMeta = byCode[key];
          else if (byName[key]) subjMeta = byName[key];
          else {
            // fallback minimal object (use key as name so UI isn't just the code)
            subjMeta = { code: key, name: key, requirements: { cursar: [], aprobar: [] } };
          }
          const colEl = columnsContainer.querySelector(`.column-col[data-index="${colIndex}"]`);
          let placeholderEl = null;
          if (colEl) placeholderEl = colEl.querySelector('.card-electiva-add');
          // insert without prompting
          performAddElectiveToColumn(subjMeta, colIndex, placeholderEl, true);
        }catch(e){ console.error('Error restaurando electiva', key, e); }
      });
    }catch(e){ console.error('Error leyendo electives from storage', e); }
  }

  function showElectivasAlert(level, msg){
    const container = document.getElementById('electivas-container');
    if (!container) return;
    const a = document.createElement('div');
    a.className = `col-12`;
    a.innerHTML = `<div class="alert alert-${level} py-1">${escapeHtml(msg)}</div>`;
    container.insertBefore(a, container.firstChild);
    setTimeout(()=>{ try{ a.remove(); }catch(e){} }, 2500);
  }

  // Load the main plan (subjects + modules + electivas) from DATA_URL and render
  fetch(DATA_URL)
    .then(r => r.json())
    .then(d => {
      planData = d;
      const modules = Array.isArray(d.modules) ? d.modules : [];
      // electivas module typically has id 'electives' and render: false
      const electModule = modules.find(m => m && m.id === 'electives') || modules.find(m => m && m.render === false && Array.isArray(m.subjects));
      electivasList = electModule && Array.isArray(electModule.subjects) ? electModule.subjects : [];
      try{ renderGroups(d); }catch(e){ console.error('Error renderizando grupos', e); }
    })
    .catch(err => {
      console.error('Error cargando plan desde DATA_URL', err);
      if (columnsContainer) columnsContainer.innerHTML = '<div class="alert alert-danger">No se pudo cargar el plan de materias.</div>';
    });
});
