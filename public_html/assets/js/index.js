import { api } from './apiClient.js';
import { computeStatus } from './statusEngine.js';
import { getEvaluationSchemes } from './evaluationSchemes.js';
import { getCareers, getCareerCurriculum } from './careers.js';
import { localGuestStore } from './localGuestStore.js';
import { apiStore } from './apiStore.js';
import { initAuth } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  // Carrera actualmente mostrada en el tablero. `userCareers` son las carreras en las
  // que el usuario está anotado (controla qué aparece en el dropdown); se puebla en
  // initApp()/onLoginSuccess/onLogout a partir de activeStore.getUserCareers().
  let currentCareer = null;
  let userCareers = [];
  let showIntermediateTitleEnabled = false;

  function getSavedCareer() {
    return localStorage.getItem('career');
  }

  function saveCareer(careerCode) {
    localStorage.setItem('career', careerCode);
    if (activeStore === apiStore) {
      activeStore.updatePreferences({ activeCareerCode: careerCode }).catch(e => console.error('Error sincronizando carrera', e));
    }
  }

  // Entre las carreras en las que el usuario está anotado, elige cuál mostrar: la
  // guardada en localStorage si sigue siendo válida, si no la primera disponible.
  function pickInitialCareer() {
    const saved = getSavedCareer();
    if (saved && userCareers.some(c => c.code === saved)) return saved;
    return userCareers.length ? userCareers[0].code : null;
  }

  function currentCareerEntry() {
    return userCareers.find(c => c.code === currentCareer) || null;
  }

  function syncIntermediateTitleState() {
    const entry = currentCareerEntry();
    showIntermediateTitleEnabled = !!(entry && entry.showIntermediateTitle);
    const wrap = document.getElementById('settings-intermediate-title-wrap');
    const toggle = document.getElementById('settings-intermediate-title');
    const hasIntermediate = !!(entry && entry.hasIntermediateTitle);
    if (wrap) wrap.classList.toggle('d-none', !hasIntermediate);
    if (toggle) toggle.checked = showIntermediateTitleEnabled;
  }

  let planData = null;
  let electivasList = [];
  let columns = 5;

  const columnsContainer = document.querySelector('.columns-grid');
  const progressBarIntermediate = document.getElementById('progress-bar-intermediate');
  const progressBarFinal = document.getElementById('progress-bar-final');
  const progressLabel = document.getElementById('progress-label');
  let displayedSubjects = [];

  // --- Store activo (invitado local o API autenticada) + caches síncronos ---
  // El resto de la app lee `enrollmentCache`/`electivesCache`/`schemesCache` de forma
  // síncrona (igual que antes leía localStorage directo); estos caches se pueblan al
  // bootear y se actualizan puntualmente después de cada escritura (ver putSubjectDataInCache).
  let activeStore = localGuestStore;
  let enrollmentCache = {};
  let electivesCache = [];
  let schemesCache = [];
  // Conteo de recursadas por materia que sobrevive a que se borre la inscripción
  // (recursar y dar de baja borran la fila de enrollments, pero el número de
  // cursada tiene que seguir mostrándose en la tarjeta aunque quede disponible
  // de nuevo). Se puebla junto con enrollmentCache/electivesCache y se corrige
  // puntualmente después de recursar/editar el número (ver doRecursar más abajo).
  let retakesCache = {};

  async function refreshEnrollmentCache(){
    const list = await activeStore.getEnrollments();
    enrollmentCache = {};
    list.forEach(e => { enrollmentCache[e.subjectCode] = e; });
  }

  async function refreshElectivesCache(){
    electivesCache = await activeStore.getElectives();
  }

  async function refreshRetakesCache(){
    try{ retakesCache = await activeStore.getSubjectRetakes(); }
    catch(e){ console.error('Error cargando conteo de recursadas', e); retakesCache = {}; }
  }

  async function switchStoreAndReload(nextStore){
    activeStore = nextStore;
    await Promise.all([refreshEnrollmentCache(), refreshElectivesCache(), refreshRetakesCache()]);
    userCareers = await activeStore.getUserCareers();
    populateProgramSelect();
    currentCareer = pickInitialCareer();
    syncIntermediateTitleState();
    loadPlanData();
  }

  // Detección de mobile: en pantallas angostas el tablero pasa a una sola columna,
  // se oculta el overlay de flechas de correlativas (no aplica sin hover / sin
  // columnas lado a lado) y el click en una materia bloqueada muestra un toast en
  // vez del scroll+flash que se usa en desktop (ver onCardClick más abajo).
  const mobileMediaQuery = window.matchMedia('(max-width: 768px)');
  function isMobile(){ return mobileMediaQuery.matches; }
  mobileMediaQuery.addEventListener('change', () => {
    try{ clearOverlay(); }catch(e){}
    try{ if (planData) renderGroups(planData); }catch(e){ console.error('Error re-renderizando tras cambio de viewport', e); }
  });

  // Correlativas toggle: read persisted preference and bind toggle UI
  const correlativasToggle = document.getElementById('settings-correlativas');
  let correlativasEnabled = true;
  function loadCorrelativasPref(){
    const v = localStorage.getItem('mostrarCorrelativas');
    return v === null ? true : v === '1';
  }
  function saveCorrelativasPref(val){
    localStorage.setItem('mostrarCorrelativas', val ? '1' : '0');
    if (activeStore === apiStore) {
      activeStore.updatePreferences({ showCorrelativas: !!val }).catch(e => console.error('Error sincronizando showCorrelativas', e));
    }
  }
  // Initialize state (will be set again after DOM rendered elements exist)
  correlativasEnabled = loadCorrelativasPref();
  // reflect toggle UI and bind change handler so the switch actually toggles correlativas
  try{
    if (correlativasToggle){
      correlativasToggle.checked = correlativasEnabled;
      correlativasToggle.addEventListener('change', (ev) => {
        correlativasEnabled = !!ev.target.checked;
        saveCorrelativasPref(correlativasEnabled);
        // when disabling, clear overlay and remove dim/highlight from all cards
        try{
          if (!correlativasEnabled){
            clearOverlay();
            if (columnsContainer){
              const all = columnsContainer.querySelectorAll('.card-subject');
              all.forEach(c => {
                c.classList.remove('card-dim');
                c.classList.remove('card-highlight');
                c.classList.remove('card-electiva-hover');
              });
            }
          } else {
            // enable: rebuild overlay and reattach events
            try{ setupOverlayAndInteractions(); }catch(e){}
          }
        }catch(e){}
      });
    }
  }catch(e){/* ignore */}

  // Show status toggle: read persisted preference and bind toggle UI
  const showStatusToggle = document.getElementById('settings-show-status');
  let showStatusEnabled = false;
  function loadShowStatusPref(){
    const v = localStorage.getItem('mostrarEstado');
    return v === '1';
  }
  function saveShowStatusPref(val){
    localStorage.setItem('mostrarEstado', val ? '1' : '0');
    if (activeStore === apiStore) {
      activeStore.updatePreferences({ showStatus: !!val }).catch(e => console.error('Error sincronizando showStatus', e));
    }
  }
  showStatusEnabled = loadShowStatusPref();
  try{
    if (showStatusToggle){
      showStatusToggle.checked = showStatusEnabled;
      showStatusToggle.addEventListener('change', (ev) => {
        showStatusEnabled = !!ev.target.checked;
        saveShowStatusPref(showStatusEnabled);
        // re-render groups to show/hide status labels
        try{ if (planData) renderGroups(planData); }catch(e){}
      });
    }
  }catch(e){/* ignore */}


  // Program selector: solo lista las carreras en las que el usuario está anotado
  // (userCareers, poblado en initApp()/switchStoreAndReload()); las opciones se generan
  // dinámicamente, ya no hay un <option> fijo por carrera en el HTML.
  const programSelect = document.getElementById('programSelect');
  function populateProgramSelect() {
    if (!programSelect) return;
    programSelect.innerHTML = userCareers.map(c => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.name)}</option>`).join('');
    if (currentCareer) programSelect.value = currentCareer;
  }
  function initProgramSelector() {
    if (!programSelect) return;
    programSelect.addEventListener('change', (ev) => {
      const newCareer = ev.target.value;
      if (!userCareers.some(c => c.code === newCareer)) return;
      saveCareer(newCareer);
      currentCareer = newCareer;
      syncIntermediateTitleState();
      loadPlanData();
    });
  }

  // Toggle "hasta el título intermedio": muestra/oculta las materias onlyForIntermediate
  // (ej. Seminario Integrador) de la carrera activa y cambia la barra de progreso.
  const intermediateTitleToggle = document.getElementById('settings-intermediate-title');
  if (intermediateTitleToggle) {
    intermediateTitleToggle.addEventListener('change', async (ev) => {
      showIntermediateTitleEnabled = !!ev.target.checked;
      const entry = currentCareerEntry();
      if (entry) entry.showIntermediateTitle = showIntermediateTitleEnabled;
      try{ await activeStore.setShowIntermediateTitle(currentCareer, showIntermediateTitleEnabled); }catch(e){ console.error('Error sincronizando título intermedio', e); }
      try{ if (planData) renderGroups(planData); }catch(e){}
    });
  }

  // Carga el curriculum de la carrera activa (GET /api/careers/{code}/curriculum) y renderiza.
  // Anota al usuario en una carrera y, si no tenía ninguna activa todavía, la
  // convierte en la actual y carga su tablero. Compartido entre el prompt del home
  // (cuando no hay ninguna carrera anotada) y la lista "Mis carreras" del perfil.
  async function enrollInCareer(careerCode){
    userCareers = await activeStore.enrollCareer(careerCode);
    populateProgramSelect();
    if (!currentCareer){
      currentCareer = pickInitialCareer();
      syncIntermediateTitleState();
      loadPlanData();
    }
  }

  // Cuando el usuario (o invitado) no está anotado en ninguna carrera, en vez de
  // mandarlo al perfil mostramos el listado de carreras disponibles directo en el
  // home para que se anote ahí mismo.
  async function renderCareerEnrollmentPrompt(){
    if (!columnsContainer) return;
    columnsContainer.style.gridTemplateColumns = '1fr';
    const catalog = await getCareers();
    columnsContainer.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'p-4';
    wrap.innerHTML = '<h5 class="mb-1">Todavía no estás anotado en ninguna carrera</h5><p class="text-muted">Elegí una para empezar a armar tu tablero:</p>';
    const list = document.createElement('div');
    list.className = 'list-group';
    if (!catalog.length){
      wrap.appendChild(Object.assign(document.createElement('div'), { className: 'alert alert-info', textContent: 'No hay carreras disponibles todavía.' }));
    } else {
      catalog.forEach(career => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        const label = document.createElement('span');
        label.textContent = career.name;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-success btn-sm';
        btn.textContent = 'Anotarme';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try{
            await enrollInCareer(career.code);
          }catch(e){
            console.error('Error anotándose a la carrera', e);
            alert('No se pudo anotar a la carrera.');
            btn.disabled = false;
          }
        });
        item.appendChild(label);
        item.appendChild(btn);
        list.appendChild(item);
      });
      wrap.appendChild(list);
    }
    columnsContainer.appendChild(wrap);
  }

  function loadPlanData() {
    if (!currentCareer) {
      planData = null;
      electivasList = [];
      try{ renderCareerEnrollmentPrompt(); }catch(e){ console.error('Error mostrando el listado de carreras', e); }
      try{ computeStats([]); }catch(e){}
      return;
    }
    getCareerCurriculum(currentCareer)
      .then(d => {
        if (!d) throw new Error('curriculum_not_found');
        planData = d;
        const modules = Array.isArray(d.modules) ? d.modules : [];
        // electivas module typically has id 'electives' and render: false
        const electModule = modules.find(m => m && m.id === 'electives') || modules.find(m => m && m.render === false && Array.isArray(m.subjects));
        electivasList = electModule && Array.isArray(electModule.subjects) ? electModule.subjects : [];
        try{ renderGroups(d); }catch(e){ console.error('Error renderizando grupos', e); }
      })
      .catch(err => {
        console.error('Error cargando el curriculum de la carrera', err);
        if (columnsContainer) columnsContainer.innerHTML = '<div class="alert alert-danger">No se pudo cargar el plan de materias.</div>';
      });
  }

  initProgramSelector();

  // Electivas button: open modal and load electivas from separate file
  const electivasBtn = document.getElementById('btn-electivas');
  function openElectivasModal(){
    // Use electivasList populated when the current career curriculum was loaded
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

  // --- Enrollment cache: synchronous reads backed by the active store (local o API) ---
  // `activeStore`/`enrollmentCache`/`electivesCache` se inicializan en el bootstrap de auth
  // (ver más abajo, cerca del final del archivo) antes del primer renderGroups().

  // Lectura síncrona desde el cache poblado al inicio (o tras cada escritura). El resto del
  // archivo (render, arrows, stats) sigue leyendo con esta misma firma que tenía antes.
  // Las inscripciones son globales por materia (no por carrera), así que el cache va
  // keyeado directo por subjectCode.
  function loadSubjectData(code){
    if (!code) return null;
    return enrollmentCache[code] || null;
  }

  function putSubjectDataInCache(code, hydrated){
    if (!code) return;
    if (hydrated) enrollmentCache[code] = hydrated;
    else delete enrollmentCache[code];
  }

  // Una materia "tiene progreso" simplemente si ya existe una inscripción (creada al
  // apretar "Empezar"), sin importar si todavía no cargó ninguna nota.
  function hasSubjectProgress(code){
    return !!loadSubjectData(code);
  }

  function countPassedSubjects(subjects){
    if (!Array.isArray(subjects)) return 0;
    return subjects.filter(s => {
      const key = (s.code && s.code.trim()) ? s.code : (s.name || '');
      const stored = key ? loadSubjectData(key) : null;
      const st = stored ? stored.status : null;
      return st === 'Aprobada' || st === 'Promocionada';
    }).length;
  }

  function getElectivesForCurrentCareer(){
    return (electivesCache || []).filter(e => e.careerCode === currentCareer);
  }

  function countPassedElectivasForColumn(colIndex){
    let count = 0;
    getElectivesForCurrentCareer().forEach(e => {
      if (e.columnIndex === colIndex){
        const stored = loadSubjectData(e.subjectCode);
        const st = stored ? stored.status : null;
        if (st === 'Aprobada' || st === 'Promocionada') count++;
      }
    });
    return count;
  }

  // Convert a number to Roman numeral (for recursed count display)
  function toRomanNumeral(num) {
    if (num <= 0 || num > 20) return String(num); // fallback for edge cases
    const romanNumerals = [
      { value: 10, numeral: 'X' },
      { value: 9, numeral: 'IX' },
      { value: 5, numeral: 'V' },
      { value: 4, numeral: 'IV' },
      { value: 1, numeral: 'I' }
    ];
    let result = '';
    let remaining = num;
    for (const { value, numeral } of romanNumerals) {
      while (remaining >= value) {
        result += numeral;
        remaining -= value;
      }
    }
    return result;
  }

  // Get a user-friendly description for the status (for displaying below subject cards)
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

  // Check if a subject can be promoted (both parciales >=6 but at least one <8)
  // Heurística de UI (no autoritativa: el status real lo calcula computeStatus()) para
  // mostrar "Puede promocionar" cuando falta un solo parcial por debajo del umbral alto
  // y todavía queda un recuperatorio disponible para intentar alcanzarlo.
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

  // Calculate remaining final attempts for a regularized subject (up to 4 finals total)
  function getRemainingFinalAttempts(stored) {
    if (!stored) return 4;
    const used = Array.isArray(stored.finals)
      ? stored.finals.filter(f => f && f.grade !== null && f.grade !== undefined).length
      : 0;
    return Math.max(0, 4 - used);
  }

  // Apply a very light status background class to a card (except 'Faltan notas')
  function applyCardStatusStyle(card, status){
    if (!card) return;
    // remove previous status classes
    ['card-status-aprobada','card-status-desaprobada','card-status-promocionada','card-status-regularizada'].forEach(c => card.classList.remove(c));
  // allow badge rendering even when status is falsy; but skip applying styling class when status is 'Faltan notas'
  if (status === 'Faltan notas') status = null; // treat as no final styling but still render badge
    const mapping = {
      'Aprobada': 'card-status-aprobada',
      'Desaprobada': 'card-status-desaprobada',
      'Promocionada': 'card-status-promocionada',
      'Regularizada': 'card-status-regularizada'
    };
    const cls = mapping[status];
    if (cls) card.classList.add(cls);
    // --- badge rendering ---
    try{
      // badge container inside card (created in createCard)
      let bc = card.querySelector('.card-badge-container');
      if (!bc){
        // create and append to top-right if missing
        const right = card.querySelector('.text-end');
        bc = document.createElement('div');
        bc.className = 'card-badge-container';
        if (right) right.appendChild(bc);
        else {
          const header = card.querySelector('.card-body');
          if (header) header.appendChild(bc);
        }
      }
      // determine weekHours (fallback 6)
      const weekHours = Number.isFinite(Number(card.dataset.weekHours)) ? Number(card.dataset.weekHours) : 6;
      // determine stored values to show final grade when approved
      const code = card.dataset && card.dataset.code ? card.dataset.code : null;
      const stored = code ? loadSubjectData(code) : null;
      // clear
      bc.innerHTML = '';
      // Approved (Aprobada) => badge shows the final exam value where it was approved (first final >=6 in order)
      if (status === 'Aprobada'){
        let grade = null;
        try{
          if (stored && Array.isArray(stored.finals)){
            const sorted = [...stored.finals].sort((a,b) => a.attemptNumber - b.attemptNumber);
            for (const f of sorted){
              if (f && f.grade !== null && f.grade !== undefined && f.grade >= 6){ grade = f.grade; break; }
            }
          }
        }catch(e){/* ignore */}
        if (grade !== null && !Number.isNaN(grade)){
          const span = document.createElement('span');
          span.className = 'badge bg-success';
          span.style.fontSize = '0.8rem';
          span.textContent = String(grade);
          bc.appendChild(span);
        }
      } else if (status === 'Promocionada'){
        // Promocionada => promedio del último intento cargado de cada parcial, redondeado
        let sum = 0, count = 0;
        try{
          if (stored && stored.partials && stored.schemeConfig){
            const n = stored.schemeConfig.partials ?? 2;
            for (let p = 1; p <= n; p++){
              const attempts = stored.partials[p] || {};
              let eff = null;
              for (let a = 3; a >= 1; a--){
                if (attempts[a] !== null && attempts[a] !== undefined){ eff = attempts[a]; break; }
              }
              if (eff !== null){ sum += eff; count++; }
            }
          }
        }catch(e){/* ignore */}
        if (count > 0){
          const avg = Math.round(sum / count);
          const span = document.createElement('span');
          span.className = 'badge bg-success';
          span.style.fontSize = '0.8rem';
          span.textContent = String(avg);
          bc.appendChild(span);
        }
      } else if (status === 'Regularizada'){
        // Do not show any badge for Regularizada subjects (user requested no badge)
        // Intentionally left blank: no badge appended for this status.
      } else {
        // not approved -> show weekHours badge (blue) with C/A indicator
        const span = document.createElement('span');
        span.className = 'badge bg-primary';
        span.style.fontSize = '0.8rem';
        // Get duration from card dataset (cuatrimestral or anual)
        const duration = card.dataset.duration || 'anual';
        const durationIndicator = duration === 'cuatrimestral' ? 'C' : 'A';
        span.textContent = `${weekHours} hs - ${durationIndicator}`;
        bc.appendChild(span);
      }
    }catch(e){/* ignore badge errors */}
  }

  // "Recursar"/"Dar de baja" ahora se maneja desde el panel de configuración de la materia
  // (botón de engranaje en el modal, ver bindSubjectSettingsPanel() más abajo), que llama a
  // activeStore.recursar()/dropEnrollment() en vez de manipular localStorage/Firestore acá.

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
      const status = stored ? stored.status : null;
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

  // Resuelve el nombre de una materia por código, buscando en las materias del plan
  // actualmente mostradas y en la lista de electivas (con fallback al código mismo).
  function getSubjectNameByCode(code){
    if (!code) return code;
    const fromDisplayed = (displayedSubjects || []).find(s => s.code === code);
    if (fromDisplayed) return fromDisplayed.name || code;
    const fromElectivas = (electivasList || []).find(s => s.code === code);
    if (fromElectivas) return fromElectivas.name || code;
    return code;
  }

  // Nombres de las materias de 'cursar' que le faltan a una card para dejar de estar bloqueada.
  function getMissingRequirementNames(card){
    if (!card) return [];
    const reqObj = card.dataset.requirements ? JSON.parse(card.dataset.requirements) : { cursar: [] };
    const cursar = reqObj.cursar || [];
    const missing = [];
    cursar.forEach(r => {
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      if (!id) return;
      const stored = loadSubjectData(id);
      const status = stored ? stored.status : null;
      const type = (typeof r === 'object' && r.type) ? r.type : 'aprobada';
      const met = type === 'regularizada'
        ? ['Regularizada','Aprobada','Promocionada'].includes(status)
        : ['Aprobada','Promocionada'].includes(status);
      if (!met) missing.push(getSubjectNameByCode(id));
    });
    return missing;
  }

  // Formatea una lista al estilo español: "A", "A y B", "A, B y C".
  function formatSpanishList(items){
    if (!items || items.length === 0) return '';
    if (items.length === 1) return items[0];
    return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;
  }

  // Toast (mobile) con las materias que faltan para poder cursar.
  function showMissingRequirementsToast(card){
    const bodyEl = document.getElementById('requirements-toast-body');
    const toastEl = document.getElementById('requirements-toast');
    if (!bodyEl || !toastEl) return;
    const missing = getMissingRequirementNames(card);
    bodyEl.textContent = missing.length
      ? `Faltan ${formatSpanishList(missing)}.`
      : 'Todavía no cumplís los requisitos para cursar esta materia.';
    const toast = bootstrap.Toast.getOrCreateInstance(toastEl);
    toast.show();
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

    // Para cada módulo separamos: materias normales (nunca incluyen onlyForIntermediate,
    // ej. Seminario Integrador), cuáles de esas son parte del título intermedio
    // (requiredForIntermediateTitle), y los "extras" onlyForIntermediate propios del módulo.
    // Con el toggle de título intermedio prendido, el tablero se reduce a SOLO ese
    // recorrido (materias requeridas + extras), ocultando el resto de la carrera —
    // incluidos módulos enteros (ej. niveles 4/5, electivas) que no aporten nada ahí.
    const moduleViews = visibleModules
      .map(module => {
        const allSubjects = Array.isArray(module.subjects) ? module.subjects : [];
        const normalSubjects = allSubjects.filter(s => !s.onlyForIntermediate);
        const intermediateRequired = normalSubjects.filter(s => s.requiredForIntermediateTitle);
        const intermediateExtras = allSubjects.filter(s => s.onlyForIntermediate);
        return { module, normalSubjects, intermediateRequired, intermediateExtras };
      })
      .filter(v => !showIntermediateTitleEnabled || v.intermediateRequired.length > 0 || v.intermediateExtras.length > 0);

    if (moduleViews.length === 0) {
      columnsContainer.innerHTML = '<div class="alert alert-info">Esta carrera no tiene materias definidas para el título intermedio.</div>';
      displayedSubjects = [];
      try{ computeStats(displayedSubjects); }catch(e){}
      return;
    }

    // Use number of visible modules as columns (limit to max 8 for layout sanity)
    columns = Math.min(Math.max(moduleViews.length, 1), 8);
    columnsContainer.innerHTML = '';

    // Dynamically adjust the grid columns based on the number of visible modules
    columnsContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;

    // assign consecutive data-index values for visible columns
    moduleViews.forEach(({ module, normalSubjects, intermediateRequired, intermediateExtras }, visIdx) => {
      const col = document.createElement('div');
      col.className = 'column-col';
      col.dataset.index = visIdx;

      // Column header with module name (no color in new format)
      const header = document.createElement('div');
      header.className = 'mb-2';
      const countBaseSubjects = showIntermediateTitleEnabled ? intermediateRequired : normalSubjects;
      // Las electivas no son parte del título intermedio (el título intermedio nunca las
      // pidió históricamente), así que se ocultan por completo con el toggle prendido.
      const electivasCount = showIntermediateTitleEnabled ? 0 : (Number.isFinite(Number(module.electivas)) ? Number(module.electivas) : 0);
      const modulePassed = countPassedSubjects(countBaseSubjects) + (showIntermediateTitleEnabled ? 0 : countPassedElectivasForColumn(visIdx));
      header.innerHTML = `<strong>${escapeHtml(module.name)}</strong> <span class="text-muted small">${modulePassed}/${countBaseSubjects.length + electivasCount}</span>`;
      col.appendChild(header);

      // Render all subjects per module
      const renderedSubjects = showIntermediateTitleEnabled ? [...intermediateRequired, ...intermediateExtras] : normalSubjects;
      renderedSubjects.forEach(subj => col.appendChild(createCard(subj, module)));

      // Insert electiva placeholders according to module.electivas (if present)
      for (let i = 0; i < electivasCount; i++){
        col.appendChild(createAddElectivaPlaceholder(visIdx));
      }

      columnsContainer.appendChild(col);
    });

    // Las estadísticas / barra de progreso siempre se calculan sobre el total completo de
    // la carrera (sin importar el toggle), para que ambos tramos del progreso se puedan
    // mostrar aunque el tablero esté mostrando solo el recorrido del título intermedio.
    displayedSubjects = [];
    visibleModules.forEach(m => {
      const allSubjects = Array.isArray(m.subjects) ? m.subjects : [];
      displayedSubjects.push(...allSubjects.filter(s => !s.onlyForIntermediate));
    });

    // Setup overlay SVG and interactivity for correlativas
    setupOverlayAndInteractions();
    // restore any previously added electivas from localStorage (will replace placeholders).
    // Se saltea con el toggle prendido: los índices de columna no corresponden a la vista
    // filtrada y las electivas no son parte del título intermedio de todos modos.
    if (!showIntermediateTitleEnabled){
      try{ restoreElectivesFromStorage(); }catch(e){/* ignore */}
    }
    // Compute stats after cursar state is updated (so .card-available classes are present)
    computeStats(displayedSubjects);
  }

  function createCard(subject, group = null){
    const card = document.createElement('div');
    card.className = 'card card-subject';
    // attach metadata for interactions
    if (subject.code) card.dataset.code = subject.code;
    // store weekHours for badge display (default to 6 when not provided)
    card.dataset.weekHours = typeof subject.weekHours === 'number' ? String(subject.weekHours) : '6';
    // store duration for badge display (cuatrimestral or anual, default to anual)
    card.dataset.duration = subject.duration || 'anual';
    // store requirements object (cursar/aprobar)
    const reqsObj = subject.requirements || { cursar: [], aprobar: [] };
    card.dataset.requirements = JSON.stringify(reqsObj);
    if (group && group.color) card.dataset.groupColor = group.color;
    
    // Get status for this subject if showStatusEnabled
    const stored = loadSubjectData(subject.code);
    const status = stored ? stored.status : null;
    const statusDesc = getStatusDescription(status);
    const promotable = (status === 'Regularizada' || status === 'No regularizada') && canPromote(stored);
    let statusLabel = '';
    if (showStatusEnabled && statusDesc) {
      // Calculate remaining final attempts for regularized subjects
      const remainingAttempts = status === 'Regularizada' ? getRemainingFinalAttempts(stored) : null;
      
      if (status === 'Regularizada' && remainingAttempts !== null) {
        // For regularized subjects, show status on left and attempts on right
        const statusText = promotable ? `${escapeHtml(statusDesc)} • Puede promocionar` : escapeHtml(statusDesc);
        statusLabel = `<div class="d-flex justify-content-between align-items-center status-label"><small class="text-muted">${statusText}</small><small class="text-muted">${remainingAttempts}/4</small></div>`;
      } else {
        // For other statuses, show normally
        statusLabel = promotable ? `<small class="text-muted status-label">${escapeHtml(statusDesc)} • Puede promocionar</small>` : `<small class="text-muted status-label">${escapeHtml(statusDesc)}</small>`;
      }
    }
    
    // Get recursed count for Roman numeral display - only show on cards when recursedCount > 0 (II, III, etc.)
    // Recursar/dar de baja borran la inscripción activa, así que para una materia sin
    // inscripción (disponible de nuevo) el conteo sale de retakesCache, no de `stored`.
    const recursedCount = (stored && typeof stored.recursedCount === 'number')
      ? stored.recursedCount
      : (retakesCache[subject.code] || 0);
    let romanNumeralHtml = '';
    if (recursedCount > 0) {
      const cursadaNumber = recursedCount + 1; // 1 recurse = Cursada II, 2 recurses = Cursada III, etc.
      const cursadaNumeral = toRomanNumeral(cursadaNumber);
      romanNumeralHtml = `<span class="recursed-numeral" title="Cursada ${cursadaNumeral}">${cursadaNumeral}</span>`;
    }

    card.innerHTML = `
      <div class="card-body p-1">
        <div class="d-flex justify-content-between align-items-start">
          <div>
            <h6 class="card-title mb-0">${escapeHtml(subject.name)}${romanNumeralHtml}</h6>
            <small class="text-muted d-block">${escapeHtml(subject.code)}</small>
            ${statusLabel}
          </div>
          <div class="text-end">
            <div class="card-badge-container" aria-hidden="true"></div>
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
  let currentEnrollment = null; // enrollment hidratado de la materia con el modal abierto (o null si no está inscripta)

  // Badge "Cursada I/II/..." del header del modal. Es solo texto (no clickeable);
  // para editarlo está el campo "Número de cursada" en el panel de configuración
  // (⚙) — no borra notas, a diferencia de "Recursar". Extraída de onCardClick para
  // poder refrescarla también después de editar el número sin cerrar el modal.
  function updateRecursedBadge(code){
    const titleEl = document.getElementById('subjectModalLabel');
    if (!titleEl) return;
    const existingRecursedBadge = document.getElementById('subject-recursed-badge');
    if (existingRecursedBadge) existingRecursedBadge.remove();
    const currentRecursedCount = (currentEnrollment && typeof currentEnrollment.recursedCount === 'number')
      ? currentEnrollment.recursedCount
      : (retakesCache[code] || 0);
    const cursadaNumber = currentRecursedCount + 1;
    const cursadaNumeral = toRomanNumeral(cursadaNumber);
    const badge = document.createElement('span');
    badge.id = 'subject-recursed-badge';
    badge.className = 'badge bg-secondary ms-2';
    badge.style.fontSize = '0.75rem';
    badge.style.fontWeight = 'normal';
    badge.style.verticalAlign = 'middle';
    badge.textContent = `Cursada ${cursadaNumeral}`;
    badge.title = currentRecursedCount > 0
      ? `Has recursado esta materia ${currentRecursedCount} vez${currentRecursedCount !== 1 ? 'es' : ''}`
      : '';
    titleEl.parentNode.insertBefore(badge, titleEl.nextSibling);
  }

  async function onCardClick(e){
    // open modal and populate minimal info
    currentCard = e.currentTarget;
    // If card is disabled (doesn't meet cursar requirements) show the missing requirements
    // instead of opening modal. En mobile usamos un toast (no hay hover ni tiene sentido el
    // scroll con una sola columna); en desktop mantenemos el scroll+flash de siempre.
    if (currentCard.classList && currentCard.classList.contains('card-disabled')){
      if (isMobile()){
        try{ showMissingRequirementsToast(currentCard); }catch(err){/* ignore */}
      } else {
        try{ highlightMissingRequirements(currentCard); }catch(err){/* ignore */}
      }
      return;
    }
    const code = currentCard.dataset.code || '';
    const titleEl = document.getElementById('subjectModalLabel');
    // Get the subject name from the card title, excluding any Roman numeral span
    const cardTitleEl = currentCard.querySelector('.card-title');
    let name = code;
    if (cardTitleEl) {
      // Clone the element and remove the recursed-numeral span to get clean text
      const clone = cardTitleEl.cloneNode(true);
      const numeralSpan = clone.querySelector('.recursed-numeral');
      if (numeralSpan) numeralSpan.remove();
      name = clone.textContent.trim() || code;
    }
    titleEl.textContent = `${name} ${code ? '(' + code + ')' : ''}`;

    currentEnrollment = loadSubjectData(code);
    updateRecursedBadge(code);

    const modalEl = document.getElementById('subjectModal');
    if (!modalEl) return;

    const formEl = document.getElementById('subject-form');
    const statusEl = document.getElementById('subject-status');
    const modalFooter = modalEl.querySelector('.modal-footer');
    const settingsPanel = document.getElementById('subject-settings-panel');
    const settingsToggleBtn = document.getElementById('subject-settings-toggle');
    const aprobarWarn = document.getElementById('subject-aprobar-warning');
    if (formEl) formEl.classList.remove('d-none');
    if (statusEl) statusEl.classList.remove('d-none');
    if (modalFooter) modalFooter.style.display = '';
    if (settingsPanel) settingsPanel.classList.add('d-none');
    if (settingsToggleBtn) settingsToggleBtn.classList.remove('d-none');
    if (aprobarWarn) { aprobarWarn.classList.add('d-none'); aprobarWarn.textContent = ''; }
    const prevStartWrap = document.getElementById('subject-start-wrap');
    if (prevStartWrap) prevStartWrap.remove();

    const bsModal = new bootstrap.Modal(modalEl);
    bsModal.show();

    if (!currentEnrollment){
      await renderStartFlow(code);
      return;
    }
    await renderEnrolledSubject(code);
  }

  // Flujo para una materia todavía no inscripta: elegir esquema (si hay más de uno
  // disponible) y crear la inscripción al apretar "Empezar".
  async function renderStartFlow(code){
    const modalEl = document.getElementById('subjectModal');
    const formEl = document.getElementById('subject-form');
    const statusEl = document.getElementById('subject-status');
    const modalFooter = modalEl.querySelector('.modal-footer');
    const settingsToggleBtn = document.getElementById('subject-settings-toggle');
    if (formEl) formEl.classList.add('d-none');
    if (statusEl) statusEl.classList.add('d-none');
    if (modalFooter) modalFooter.style.display = 'none';
    if (settingsToggleBtn) settingsToggleBtn.classList.add('d-none');

    const schemes = schemesCache.length ? schemesCache : await getEvaluationSchemes();
    const wrap = document.createElement('div');
    wrap.id = 'subject-start-wrap';
    wrap.className = 'd-flex flex-column justify-content-center align-items-center';
    wrap.style.minHeight = '180px';
    wrap.style.gap = '12px';

    if (schemes.length > 1){
      const pickerWrap = document.createElement('div');
      pickerWrap.className = 'mb-2';
      pickerWrap.style.minWidth = '240px';
      pickerWrap.innerHTML = `
        <label class="form-label small" for="subject-start-scheme">Esquema de evaluación</label>
        <select id="subject-start-scheme" class="form-select form-select-sm">
          ${schemes.map(s => `<option value="${escapeHtml(s.code)}">${escapeHtml(s.name)}</option>`).join('')}
        </select>`;
      wrap.appendChild(pickerWrap);
    }

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'subject-start';
    btn.className = 'btn btn-success btn-lg';
    btn.style.padding = '0.75rem 2rem';
    btn.textContent = 'Empezar';
    wrap.appendChild(btn);

    btn.addEventListener('click', async () => {
      let prevAvailable = [];
      try{ prevAvailable = getAvailableSubjectCodes(); }catch(e){}
      const select = document.getElementById('subject-start-scheme');
      const defaultScheme = schemes.find(s => s.code === '2-partials') || schemes[0];
      const schemeCode = select ? select.value : (defaultScheme ? defaultScheme.code : null);
      if (!schemeCode){ alert('No hay esquemas de evaluación configurados.'); return; }
      btn.disabled = true;
      let hydrated;
      try{
        hydrated = await activeStore.createEnrollment(code, schemeCode);
      }catch(err){
        console.error('Error creando inscripción', err);
        alert('No se pudo anotar a la materia: ' + (err && err.message ? err.message : err));
        btn.disabled = false;
        return;
      }
      putSubjectDataInCache(code, hydrated);
      currentEnrollment = hydrated;

      // Si el modal se abrió para colocar una electiva pendiente, insertarla en el tablero
      try{
        if (currentCard && currentCard._electivaMeta && currentCard._insertTarget){
          const meta = currentCard._electivaMeta;
          const target = currentCard._insertTarget;
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
              setupOverlayAndInteractions();
              try{ computeStats(displayedSubjects); }catch(e){}
              currentCard = codeMap[meta.code] || newCard;
            }
          } else {
            try{ if (target && target.placeholderEl && target.placeholderEl.parentNode) target.placeholderEl.remove(); }catch(e){}
          }
          electivaInsertTarget = null;
          if (currentCard && currentCard._insertTarget) delete currentCard._insertTarget;
        }
      }catch(e){ console.error('Error inserting electiva into column', e); }

      wrap.remove();
      if (formEl) formEl.classList.remove('d-none');
      if (statusEl) statusEl.classList.remove('d-none');
      if (modalFooter) modalFooter.style.display = '';
      if (settingsToggleBtn) settingsToggleBtn.classList.remove('d-none');
      applyCardStatusStyle(currentCard, hydrated.status);
      updateAllCardCursarState();
      try{ const nowAvailable = getAvailableSubjectCodes(); animateNewlyUnlocked(prevAvailable, nowAvailable); }catch(e){}
      try{ computeStats(displayedSubjects); }catch(e){}
      await renderEnrolledSubject(code);
    });

    const modalBody = modalEl.querySelector('.modal-body');
    if (modalBody) modalBody.appendChild(wrap);
  }

  // Flujo para una materia ya inscripta: genera el formulario dinámico según su
  // schemeConfig, lo puebla con los datos guardados y calcula el status en vivo.
  async function renderEnrolledSubject(code){
    const stored = currentEnrollment || loadSubjectData(code);
    if (!stored) return;
    const schemeConfig = stored.schemeConfig || {};

    renderDynamicFields(schemeConfig);
    populateDynamicFields(schemeConfig, stored);
    bindLiveInputs(schemeConfig);
    bindSubjectSettingsPanel(code, stored);

    const liveStatus = updateSubjectStatusLive(schemeConfig);
    setStatusBanner(stored.statusOverride || liveStatus);

    wireSaveButton(code, schemeConfig);
    updateAprobarWarning();
  }

  // When a disabled card is clicked, highlight the missing 'cursar' requirements
  function highlightMissingRequirements(card){
    if (!card) return;
    const reqObj = card.dataset.requirements ? JSON.parse(card.dataset.requirements) : { cursar: [] };
    const cursar = reqObj.cursar || [];
    if (!cursar || cursar.length === 0) return;
    // For each requirement, check if it's already met; only animate the missing ones
    let firstMissingScrolled = false;
    cursar.forEach((r) => {
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      if (!id) return;
      const target = codeMap[id];
      if (!target) return;
      // determine if this single requirement is met according to its type
      const stored = loadSubjectData(id);
      const status = stored ? stored.status : null;
      const type = (typeof r === 'object' && r.type) ? r.type : 'aprobada';
      let met = false;
      if (type === 'regularizada'){
        met = ['Regularizada','Aprobada','Promocionada'].includes(status);
      } else {
        met = ['Aprobada','Promocionada'].includes(status);
      }
      // only animate and mark the requirement if it is NOT met
      if (!met){
        target.classList.add('req-highlight');
        // scroll the first missing into view
        if (!firstMissingScrolled){
          try{ target.scrollIntoView({ behavior: 'smooth', block: 'center' }); }catch(e){}
          firstMissingScrolled = true;
        }
        // remove after animation
        setTimeout(() => {
          try{ target.classList.remove('req-highlight'); }catch(e){}
        }, 800);
      }
    });
  }

  // Aviso (no bloqueante) de que faltan cumplir requisitos "para aprobar" (rendir el final)
  // de otra materia, según requirements.aprobar del plan JSON.
  function updateAprobarWarning(){
    const warnEl = document.getElementById('subject-aprobar-warning');
    if (!warnEl || !currentCard) return;
    const reqObj = currentCard.dataset.requirements ? JSON.parse(currentCard.dataset.requirements) : { cursar: [], aprobar: [] };
    const aprobar = reqObj.aprobar || [];
    if (!aprobar.length){ warnEl.classList.add('d-none'); warnEl.textContent = ''; return; }
    const missing = [];
    aprobar.forEach(r => {
      const id = (typeof r === 'string') ? r : (r.id || r.code);
      if (!id) return;
      const reqStored = loadSubjectData(id);
      const status = reqStored ? reqStored.status : null;
      const type = (typeof r === 'object' && r.type) ? r.type : 'aprobada';
      const met = type === 'regularizada'
        ? ['Regularizada','Aprobada','Promocionada'].includes(status)
        : ['Aprobada','Promocionada'].includes(status);
      if (!met) missing.push(id);
    });
    if (missing.length){
      warnEl.textContent = `Para rendir el final necesitás tener regularizada/aprobada: ${missing.join(', ')}.`;
      warnEl.classList.remove('d-none');
    } else {
      warnEl.classList.add('d-none');
      warnEl.textContent = '';
    }
  }

  // Helpers for status calculation and UI updates
  function parseNum(v){
    if (v === null || v === undefined || v === '') return NaN;
    const n = parseFloat(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : NaN;
  }

  function setStatusBanner(status){
    const statusContainer = document.getElementById('subject-status');
    if (!statusContainer) return;
    // Build alert element as DOM with Bootstrap dropdown inside
    statusContainer.innerHTML = '';
    let cls = 'alert-secondary';
    let btnCls = 'btn-secondary';
    switch(status){
      case 'Aprobada': cls = 'alert-success'; btnCls = 'btn-success'; break;
      case 'Desaprobada': cls = 'alert-danger'; btnCls = 'btn-danger'; break;
      case 'Promocionada': cls = 'alert-info text-dark'; btnCls = 'btn-info'; break;
      case 'Regularizada': cls = 'alert-warning text-dark'; btnCls = 'btn-warning'; break;
      case 'Faltan notas': cls = 'alert-warning text-dark'; btnCls = 'btn-warning'; break;
      case 'No regularizada': cls = 'alert-warning text-dark'; btnCls = 'btn-warning'; break;
      default: cls = 'alert-secondary'; btnCls = 'btn-secondary'; break;
    }
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${cls} py-1 px-2 mb-0 d-flex justify-content-between align-items-center`;
    alertDiv.setAttribute('role','status');
    const left = document.createElement('div');
    left.id = 'subject-status-text';
    left.textContent = status || '';
    alertDiv.appendChild(left);

    // Add Bootstrap dropdown for override actions
    const dropdownDiv = document.createElement('div');
    dropdownDiv.className = 'dropdown';
    dropdownDiv.innerHTML = `
      <button class="btn ${btnCls} dropdown-toggle btn-sm" type="button" data-bs-toggle="dropdown" aria-expanded="false"></button>
      <ul class="dropdown-menu dropdown-menu-end">
        <li><a class="dropdown-item" href="#" data-override="computed">Usar calculado</a></li>
        <li><a class="dropdown-item" href="#" data-override="Aprobada">Aprobada</a></li>
        <li><a class="dropdown-item" href="#" data-override="Promocionada">Promocionada</a></li>
        <li><a class="dropdown-item" href="#" data-override="Regularizada">Regularizada</a></li>
        <li><a class="dropdown-item" href="#" data-override="No regularizada">No regularizada</a></li>
        <li><a class="dropdown-item" href="#" data-override="Desaprobada">Desaprobada</a></li>
        <li><a class="dropdown-item" href="#" data-override="Faltan notas">Faltan notas</a></li>
      </ul>
    `;
    const rightWrap = document.createElement('div');
    rightWrap.className = 'd-flex align-items-center gap-2';

    if (status === 'Desaprobada'){
      const recursarBtn = document.createElement('button');
      recursarBtn.type = 'button';
      recursarBtn.className = 'btn btn-sm btn-outline-danger';
      recursarBtn.textContent = 'Recursar';
      recursarBtn.addEventListener('click', async () => {
        const effectiveCode = currentCard && currentCard.dataset && currentCard.dataset.code ? currentCard.dataset.code : '';
        if (!effectiveCode) return;
        recursarBtn.disabled = true;
        try{ await doRecursar(effectiveCode); }finally{ recursarBtn.disabled = false; }
      });
      rightWrap.appendChild(recursarBtn);
    }

    rightWrap.appendChild(dropdownDiv);
    alertDiv.appendChild(rightWrap);

    statusContainer.appendChild(alertDiv);

    // Bind click handlers for dropdown items
    const dropdownItems = dropdownDiv.querySelectorAll('.dropdown-item');
    dropdownItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const overrideValue = item.dataset.override;
        handleOverrideSelection(overrideValue);
      });
    });
  }

  // Handle override selection from the dropdown
  async function handleOverrideSelection(overrideValue){
    const effectiveCode = currentCard && currentCard.dataset && currentCard.dataset.code ? currentCard.dataset.code : '';
    if (!effectiveCode) return;

    let prev = [];
    try{ prev = getAvailableSubjectCodes(); }catch(e){}

    const status = overrideValue === 'computed' ? null : overrideValue;
    let hydrated;
    try{
      hydrated = await activeStore.setOverride(effectiveCode, status);
    }catch(err){
      console.error('Error aplicando override', err);
      alert('No se pudo actualizar el estado: ' + (err && err.message ? err.message : err));
      return;
    }
    putSubjectDataInCache(effectiveCode, hydrated);
    currentEnrollment = hydrated;

    setStatusBanner(hydrated.status);
    applyCardStatusStyle(currentCard, hydrated.status);
    try{ computeStats(displayedSubjects); }catch(e){}
    try{ updateAllCardCursarState(); const now = getAvailableSubjectCodes(); animateNewlyUnlocked(prev, now); }catch(e){}
    try{
      const modalEl = document.getElementById('subjectModal');
      if (modalEl){
        const inst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        inst.hide();
      }
    }catch(err){ console.error('Error closing modal after override selection', err); }
  }

  // --- Generación y lectura del formulario dinámico (parciales/finales/checklist) ---
  // La cantidad de parciales, TPs y laboratorios sale del `schemeConfig` de la inscripción
  // activa (ver evaluation_schemes.config en el backend); los intentos por parcial siguen
  // siendo 3 (constante de la app, igual que antes).

  function renderDynamicFields(schemeConfig){
    const container = document.getElementById('subject-dynamic-fields');
    if (!container) return;
    container.innerHTML = '';
    const partials = schemeConfig?.partials ?? 2;
    const tp = schemeConfig?.tp ?? 0;
    const labs = schemeConfig?.labs ?? 0;

    for (let p = 1; p <= partials; p++){
      const group = document.createElement('div');
      group.className = 'mb-2';
      group.id = `partial-group-${p}`;
      group.innerHTML = `
        <label class="form-label small">Parcial ${p}</label>
        <div class="d-flex gap-1">
          <input type="number" min="1" max="10" step="1" class="form-control form-control-sm" id="p_${p}_1" placeholder="Nota">
          <input type="number" min="1" max="10" step="1" class="form-control form-control-sm d-none" id="p_${p}_2" placeholder="Debe Recuperar">
          <input type="number" min="1" max="10" step="1" class="form-control form-control-sm d-none" id="p_${p}_3" placeholder="Debe Recuperar">
        </div>`;
      container.appendChild(group);
    }

    if (tp > 0){
      const group = document.createElement('div');
      group.className = 'mb-2';
      let inner = '<label class="form-label small">Trabajos prácticos</label><div class="d-flex flex-column gap-1">';
      for (let i = 1; i <= tp; i++){
        inner += `<div class="form-check"><input class="form-check-input" type="checkbox" id="chk_tp_${i}"><label class="form-check-label" for="chk_tp_${i}">TP ${i}</label></div>`;
      }
      group.innerHTML = inner + '</div>';
      container.appendChild(group);
    }

    if (labs > 0){
      const group = document.createElement('div');
      group.className = 'mb-2';
      let inner = '<label class="form-label small">Laboratorios</label><div class="d-flex flex-column gap-1">';
      for (let i = 1; i <= labs; i++){
        inner += `<div class="form-check"><input class="form-check-input" type="checkbox" id="chk_lab_${i}"><label class="form-check-label" for="chk_lab_${i}">Laboratorio ${i}</label></div>`;
      }
      group.innerHTML = inner + '</div>';
      container.appendChild(group);
    }

    const finalsWrap = document.createElement('div');
    finalsWrap.id = 'finals-container';
    finalsWrap.className = 'mb-2 d-none';
    finalsWrap.innerHTML = '<label class="form-label small">Final</label>';
    const finalsBody = document.createElement('div');
    finalsBody.className = 'd-flex flex-column gap-1';
    for (let i = 1; i <= 4; i++){
      const row = document.createElement('div');
      row.className = 'd-flex gap-1 final-row d-none';
      row.id = `final-row-${i}`;
      row.innerHTML = `
        <input type="number" min="1" max="10" step="1" class="form-control form-control-sm" id="final_${i}" placeholder="Nota final ${i}">
        <input type="date" class="form-control form-control-sm" id="final_${i}_date" title="Fecha del final">`;
      finalsBody.appendChild(row);
    }
    finalsWrap.appendChild(finalsBody);
    container.appendChild(finalsWrap);
  }

  function populateDynamicFields(schemeConfig, stored){
    const n = schemeConfig?.partials ?? 2;
    for (let p = 1; p <= n; p++){
      const attempts = (stored.partials && stored.partials[p]) || {};
      let maxA = 1;
      for (let a = 1; a <= 3; a++){
        const el = document.getElementById(`p_${p}_${a}`);
        const v = attempts[a];
        if (el && v !== null && v !== undefined){ el.value = v; maxA = Math.max(maxA, a); }
      }
      showPartialAttemptsUpTo(p, maxA);
    }
    let maxFinal = 0;
    (stored.finals || []).forEach(f => {
      if (!f) return;
      const gEl = document.getElementById(`final_${f.attemptNumber}`);
      const dEl = document.getElementById(`final_${f.attemptNumber}_date`);
      if (gEl && f.grade !== null && f.grade !== undefined){ gEl.value = f.grade; maxFinal = Math.max(maxFinal, f.attemptNumber); }
      if (dEl && f.examDate) dEl.value = f.examDate;
    });
    showFinalsUpTo(maxFinal);
    const checklist = stored.checklist || {};
    ['tp', 'lab'].forEach(type => {
      const items = checklist[type] || {};
      Object.keys(items).forEach(num => {
        const el = document.getElementById(`chk_${type}_${num}`);
        if (el) el.checked = !!items[num];
      });
    });
  }

  function readDynamicPartials(schemeConfig){
    const partials = {};
    const n = schemeConfig?.partials ?? 2;
    for (let p = 1; p <= n; p++){
      partials[p] = {};
      for (let a = 1; a <= 3; a++){
        const el = document.getElementById(`p_${p}_${a}`);
        const v = el ? parseNum(el.value) : NaN;
        partials[p][a] = Number.isNaN(v) ? null : v;
      }
    }
    return partials;
  }

  function readDynamicFinals(){
    const finals = {};
    for (let i = 1; i <= 4; i++){
      const gradeEl = document.getElementById(`final_${i}`);
      const dateEl = document.getElementById(`final_${i}_date`);
      const grade = gradeEl ? parseNum(gradeEl.value) : NaN;
      const date = dateEl && dateEl.value ? dateEl.value : null;
      if (!Number.isNaN(grade) || date){
        finals[i] = { grade: Number.isNaN(grade) ? null : grade, examDate: date };
      }
    }
    return finals;
  }

  function readDynamicChecklist(schemeConfig){
    const checklist = {};
    const tp = schemeConfig?.tp ?? 0;
    const labs = schemeConfig?.labs ?? 0;
    if (tp > 0){
      checklist.tp = {};
      for (let i = 1; i <= tp; i++){
        const el = document.getElementById(`chk_tp_${i}`);
        checklist.tp[i] = !!(el && el.checked);
      }
    }
    if (labs > 0){
      checklist.lab = {};
      for (let i = 1; i <= labs; i++){
        const el = document.getElementById(`chk_lab_${i}`);
        checklist.lab[i] = !!(el && el.checked);
      }
    }
    return checklist;
  }

  function showFinalsUpTo(n){
    for (let i = 1; i <= 4; i++){
      const row = document.getElementById(`final-row-${i}`);
      if (row){ if (i <= n) row.classList.remove('d-none'); else row.classList.add('d-none'); }
    }
    const wrap = document.getElementById('finals-container');
    if (wrap){ if (n > 0) wrap.classList.remove('d-none'); else wrap.classList.add('d-none'); }
  }

  function showPartialAttemptsUpTo(partialIndex, n){
    const ids = [1,2,3].map(i => document.getElementById(`p_${partialIndex}_${i}`)).filter(Boolean);
    ids.forEach((el, idx) => {
      if (idx < n) el.classList.remove('d-none'); else el.classList.add('d-none');
    });
  }

  // Reveal progresivo de recuperatorios/finales (igual espíritu que antes, generalizado a N
  // parciales) + cálculo del status en vivo vía statusEngine.js (mismo algoritmo que el backend).
  function updateSubjectStatusLive(schemeConfig){
    const n = schemeConfig?.partials ?? 2;
    const highNote = schemeConfig?.promotion?.high_note ?? 8;
    for (let p = 1; p <= n; p++) showPartialAttemptsUpTo(p, 1);

    const partials = readDynamicPartials(schemeConfig);
    for (let p = 1; p <= n; p++){
      const a1 = partials[p][1];
      const a2 = partials[p][2];
      if (a1 !== null && a1 < 6){
        showPartialAttemptsUpTo(p, 2);
        if (a2 !== null && a2 < 6) showPartialAttemptsUpTo(p, 3);
      } else if (a1 !== null && a1 < highNote){
        // regularizado pero por debajo del umbral de promoción: dejar intentar un recuperatorio
        showPartialAttemptsUpTo(p, 2);
      }
    }

    const finalsRaw = readDynamicFinals();
    const finalsArr = Object.keys(finalsRaw).map(k => ({ attemptNumber: Number(k), ...finalsRaw[k] }));
    const checklist = readDynamicChecklist(schemeConfig);

    const status = computeStatus(schemeConfig, partials, finalsArr, checklist, null);

    // Esquema "libre" (n === 0): no hay cursada que regularizar, el final está
    // disponible directamente. Para el resto, sigue esperando a Regularizada/Aprobada.
    if (n === 0 || status === 'Regularizada' || status === 'Aprobada'){
      let attemptsToShow = 1;
      for (let i = 1; i <= 4; i++){
        const f = finalsRaw[i];
        if (!f || f.grade === null || f.grade === undefined) break;
        if (f.grade < 6) attemptsToShow = i + 1; else { attemptsToShow = i; break; }
      }
      showFinalsUpTo(Math.min(attemptsToShow, 4));
    } else {
      showFinalsUpTo(0);
    }

    setStatusBanner(status);
    return status;
  }

  function bindLiveInputs(schemeConfig){
    const n = schemeConfig?.partials ?? 2;
    const ids = [];
    for (let p = 1; p <= n; p++) for (let a = 1; a <= 3; a++) ids.push(`p_${p}_${a}`);
    for (let i = 1; i <= 4; i++){ ids.push(`final_${i}`); ids.push(`final_${i}_date`); }
    const tp = schemeConfig?.tp ?? 0;
    const labs = schemeConfig?.labs ?? 0;
    for (let i = 1; i <= tp; i++) ids.push(`chk_tp_${i}`);
    for (let i = 1; i <= labs; i++) ids.push(`chk_lab_${i}`);

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const evt = el.type === 'checkbox' ? 'change' : 'input';
      el.addEventListener(evt, () => updateSubjectStatusLive(schemeConfig));
    });
  }

  function wireSaveButton(code, schemeConfig){
    const saveBtn = document.getElementById('subject-save');
    if (!saveBtn) return;
    const newSave = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSave, saveBtn);
    newSave.addEventListener('click', async () => {
      let prevAvailable = [];
      try{ prevAvailable = getAvailableSubjectCodes(); }catch(e){}
      const partials = readDynamicPartials(schemeConfig);
      const finals = readDynamicFinals();
      const checklist = readDynamicChecklist(schemeConfig);
      newSave.disabled = true;
      try{
        const hydrated = await activeStore.saveResults(code, { partials, finals, checklist, clearOverride: true });
        putSubjectDataInCache(code, hydrated);
        currentEnrollment = hydrated;
        applyCardStatusStyle(currentCard, hydrated.status);
        updateAllCardCursarState();
        try{ const nowAvailable = getAvailableSubjectCodes(); animateNewlyUnlocked(prevAvailable, nowAvailable); }catch(e){}
        try{ computeStats(displayedSubjects); }catch(e){}
        try{ if (planData) renderGroups(planData); }catch(e){}
        const modalEl = document.getElementById('subjectModal');
        if (modalEl){ const inst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl); inst.hide(); }
      }catch(err){
        console.error('Error guardando notas', err);
        alert('No se pudieron guardar las notas: ' + (err && err.message ? err.message : err));
      }finally{
        newSave.disabled = false;
      }
    });
  }

  // Panel de configuración de la materia (⚙): cambiar esquema/año/número de cursada,
  // recursar, o darse de baja.
  function bindSubjectSettingsPanel(code, stored){
    const toggleBtn = document.getElementById('subject-settings-toggle');
    const panel = document.getElementById('subject-settings-panel');
    const schemeSelect = document.getElementById('subject-scheme-select');
    const yearInput = document.getElementById('subject-year-input');
    const cursadaInput = document.getElementById('subject-cursada-input');
    const applyBtn = document.getElementById('subject-settings-apply');
    const recursarBtn = document.getElementById('subject-recursar-action');
    const unenrollBtn = document.getElementById('subject-unenroll-action');
    if (!toggleBtn || !panel) return;

    panel.classList.add('d-none');
    const newToggle = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newToggle, toggleBtn);
    newToggle.addEventListener('click', () => panel.classList.toggle('d-none'));

    const schemes = schemesCache.length ? schemesCache : [];
    if (schemeSelect){
      schemeSelect.innerHTML = schemes.map(s => `<option value="${escapeHtml(s.code)}">${escapeHtml(s.name)}</option>`).join('');
      schemeSelect.value = stored.schemeCode || '';
    }
    if (yearInput) yearInput.value = stored.enrollmentYear || new Date().getFullYear();
    // "Cursada I" == recursedCount 0: se muestra/edita en base 1 para que coincida
    // con el numeral romano del badge del modal, no con el recursedCount crudo.
    const currentCursadaNumber = (typeof stored.recursedCount === 'number' ? stored.recursedCount : 0) + 1;
    if (cursadaInput) cursadaInput.value = currentCursadaNumber;

    if (applyBtn){
      const newApply = applyBtn.cloneNode(true);
      applyBtn.parentNode.replaceChild(newApply, applyBtn);
      newApply.addEventListener('click', async () => {
        const newSchemeCode = schemeSelect ? schemeSelect.value : stored.schemeCode;
        const newYear = yearInput ? parseInt(yearInput.value, 10) : stored.enrollmentYear;
        const newCursadaNumber = cursadaInput ? parseInt(cursadaInput.value, 10) : currentCursadaNumber;
        const schemeChanged = newSchemeCode && newSchemeCode !== stored.schemeCode;
        const cursadaChanged = Number.isFinite(newCursadaNumber) && newCursadaNumber !== currentCursadaNumber;
        if (schemeChanged){
          const proceed = window.confirm('Cambiar el esquema de evaluación puede borrar las notas ya cargadas para esta materia. ¿Continuar?');
          if (!proceed) return;
        }
        newApply.disabled = true;
        try{
          if (cursadaChanged){
            // Endpoint separado: el conteo de recursadas vive independiente de la
            // inscripción (sobrevive a recursar/dar de baja), no es un "ajuste" más.
            retakesCache[code] = Math.max(0, newCursadaNumber - 1);
            await activeStore.setRecursedCount(code, retakesCache[code]);
          }
          const hydrated = await activeStore.updateEnrollmentSettings(code, {
            schemeCode: schemeChanged ? newSchemeCode : undefined,
            enrollmentYear: Number.isFinite(newYear) ? newYear : undefined,
          });
          putSubjectDataInCache(code, hydrated);
          currentEnrollment = hydrated;
          panel.classList.add('d-none');
          updateRecursedBadge(code);
          applyCardStatusStyle(currentCard, hydrated.status);
          try{ computeStats(displayedSubjects); }catch(e){}
          // Reactivar ANTES de re-renderizar: renderEnrolledSubject vuelve a llamar
          // bindSubjectSettingsPanel, que clona este mismo botón (cloneNode copia el
          // atributo disabled) — si lo reactivamos recién en el finally, ya es tarde:
          // el clon que quedó en el DOM nace deshabilitado y este 'newApply' es un
          // nodo viejo, desconectado, sobre el que ya no se puede hacer nada.
          newApply.disabled = false;
          await renderEnrolledSubject(code);
        }catch(err){
          console.error('Error actualizando configuración de la materia', err);
          alert('No se pudo actualizar la configuración: ' + (err && err.message ? err.message : err));
          newApply.disabled = false;
        }
      });
    }

    if (recursarBtn){
      const newRecursar = recursarBtn.cloneNode(true);
      recursarBtn.parentNode.replaceChild(newRecursar, recursarBtn);
      newRecursar.addEventListener('click', async () => {
        newRecursar.disabled = true;
        try{ await doRecursar(code); }finally{ newRecursar.disabled = false; }
      });
    }

    if (unenrollBtn){
      const newUnenroll = unenrollBtn.cloneNode(true);
      unenrollBtn.parentNode.replaceChild(newUnenroll, unenrollBtn);
      newUnenroll.addEventListener('click', async () => {
        newUnenroll.disabled = true;
        try{ await doUnenroll(code); }finally{ newUnenroll.disabled = false; }
      });
    }
  }

  // Acción de "recursar": confirma, llama al backend, refresca tarjeta/stats/tablero
  // y cierra el modal. Compartida por el botón del panel de ajustes y por el botón
  // que aparece directamente en el banner de estado cuando la materia está Desaprobada.
  // Recursar borra la inscripción entera (la materia vuelve a verse disponible para
  // "Empezar", igual que una no iniciada) pero el conteo de recursadas persiste y
  // sube en 1 — por eso la tarjeta va a mostrar el numeral (ej. "II") aunque ya no
  // haya una inscripción activa.
  async function doRecursar(code){
    const proceed = window.confirm('¿Marcar esta materia como recursada? Se van a borrar las notas cargadas y la materia va a quedar disponible para volver a cursar, sumando una cursada.');
    if (!proceed) return;
    let prevAvailable = [];
    try{ prevAvailable = getAvailableSubjectCodes(); }catch(e){}
    try{
      const result = await activeStore.recursar(code);
      retakesCache[code] = (result && typeof result.recursedCount === 'number') ? result.recursedCount : (retakesCache[code] || 0) + 1;
      putSubjectDataInCache(code, null);
      currentEnrollment = null;
      applyCardStatusStyle(currentCard, null);
      updateAllCardCursarState();
      try{ const nowAvailable = getAvailableSubjectCodes(); animateNewlyUnlocked(prevAvailable, nowAvailable); }catch(e){}
      try{ computeStats(displayedSubjects); }catch(e){}
      try{ if (planData) renderGroups(planData); }catch(e){}
      const modalEl = document.getElementById('subjectModal');
      if (modalEl){ const inst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl); inst.hide(); }
    }catch(err){
      console.error('Error al recursar', err);
      alert('No se pudo recursar la materia: ' + (err && err.message ? err.message : err));
    }
  }

  // Baja completa (distinto de recursar): borra la inscripción entera, la materia
  // vuelve a verse "no iniciada" (borde punteado), sin sumar una cursada.
  async function doUnenroll(code){
    const proceed = window.confirm('¿Dar de baja esta materia? Se va a borrar toda la inscripción (notas incluidas) y la materia va a volver a verse como no iniciada.');
    if (!proceed) return;
    let prevAvailable = [];
    try{ prevAvailable = getAvailableSubjectCodes(); }catch(e){}
    try{
      await activeStore.dropEnrollment(code);
      putSubjectDataInCache(code, null);
      currentEnrollment = null;
      applyCardStatusStyle(currentCard, null);
      updateAllCardCursarState();
      try{ const nowAvailable = getAvailableSubjectCodes(); animateNewlyUnlocked(prevAvailable, nowAvailable); }catch(e){}
      try{ computeStats(displayedSubjects); }catch(e){}
      try{ if (planData) renderGroups(planData); }catch(e){}
      const modalEl = document.getElementById('subjectModal');
      if (modalEl){ const inst = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl); inst.hide(); }
    }catch(err){
      console.error('Error al dar de baja', err);
      alert('No se pudo dar de baja la materia: ' + (err && err.message ? err.message : err));
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
          // Skip electiva placeholder cards (they have no subject code and shouldn't be counted)
          if (c.classList.contains('card-electiva-add')) return;
          
          const meets = cursarRequirementsMetForCard(c);
          // disabled when requirements NOT met
          if (!meets){
            c.classList.add('card-disabled');
            c.setAttribute('aria-disabled','true');
          } else {
            c.classList.remove('card-disabled');
            c.removeAttribute('aria-disabled');
          }
          // available (dashed border) when requirements met but subject not started (no actual progress)
          try{
            const code = c.dataset && c.dataset.code ? c.dataset.code : null;
            if (meets && !hasSubjectProgress(code)){
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
          if (meets && !hasSubjectProgress(code)) codes.push(code);
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

    // Apply saved styles / badges for each card based on persisted status (or default badge)
    Object.keys(codeMap).forEach(code => {
      try{
        const stored = loadSubjectData(code);
        const effectiveStatus = stored ? stored.status : null;
        applyCardStatusStyle(codeMap[code], effectiveStatus);
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
    const card = e.currentTarget;
    // If hovering a placeholder for adding electivas, just highlight that placeholder
    // and do NOT dim the rest of the board. Placeholders have class 'card-electiva-add'.
    try{
      if (card && card.classList && card.classList.contains('card-electiva-add')){
        clearOverlay();
        // add a lightweight hover class to the placeholder and return early
        card.classList.add('card-electiva-hover');
        return;
      }
    }catch(err){/* ignore */}
    // Respect the user's toggle preference for correlativas for normal cards, and skip
    // entirely on mobile (una sola columna, sin hover real en touch).
    if (!correlativasEnabled || isMobile()) return;
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
      // remove electiva placeholder hover class if present
      c.classList.remove('card-electiva-hover');
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

  // Barra de progreso dividida en dos segmentos de color: el primero mide el avance
  // hasta el título intermedio (materias requiredForIntermediateTitle), el segundo el
  // resto de la carrera. Cada segmento ocupa, dentro del ancho total de la barra, la
  // proporción de materias que representa; dentro de eso, se llena según lo aprobado/
  // regularizado. Las electivas y las materias comunes (sin requiredForIntermediateTitle)
  // caen siempre en el segundo segmento. Las materias "onlyForIntermediate" (Seminario
  // Integrador) nunca entran en ningún total — `list` ya viene sin ellas (ver renderGroups).
  function computeStats(list){
    const baseTotal = Array.isArray(list) ? list.length : 0;
    let approved = 0, regularized = 0;
    let intermediateTotal = 0, intermediateApproved = 0, intermediateRegularized = 0;
    for (const subj of (list || [])){
      const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
      const stored = key ? loadSubjectData(key) : null;
      const status = stored ? stored.status : null;
      const isIntermediate = !!subj.requiredForIntermediateTitle;
      if (isIntermediate) intermediateTotal++;
      if (status === 'Aprobada' || status === 'Promocionada') {
        approved++;
        if (isIntermediate) intermediateApproved++;
      } else if (status === 'Regularizada') {
        regularized++;
        if (isIntermediate) intermediateRegularized++;
      }
    }

    // Add required electivas per visible module to the total (even if not yet added to tablero)
    // Las electivas nunca son parte del título intermedio (ver comentario arriba).
    let electivasRequired = 0;
    try{
      if (planData && Array.isArray(planData.modules)){
        const visibleModules = planData.modules.filter(m => m && m.render !== false);
        visibleModules.forEach(m => {
          const n = Number.isFinite(Number(m.electivas)) ? Number(m.electivas) : 0;
          electivasRequired += n;
        });
      }
    }catch(e){ electivasRequired = 0; }

    // Count electivas that are placed on the board and have saved statuses
    try{
      getElectivesForCurrentCareer().forEach(entry => {
        const stored = loadSubjectData(entry.subjectCode);
        const status = stored ? stored.status : null;
        if (status === 'Aprobada' || status === 'Promocionada') approved++;
        else if (status === 'Regularizada') regularized++;
      });
    }catch(e){}

    const total = baseTotal + electivasRequired;
    const restoTotal = total - intermediateTotal;
    const restoApproved = approved - intermediateApproved;
    const restoRegularized = regularized - intermediateRegularized;

    // Tramo 1: hasta el título intermedio — 0-100% de ESE subconjunto nada más, para
    // que quede claro cuánto falta puntualmente para el título intermedio.
    let intermediatePct = 0;
    if (intermediateTotal > 0){
      intermediatePct = ((intermediateApproved + intermediateRegularized / 2) / intermediateTotal) * 100;
      if (!Number.isFinite(intermediatePct)) intermediatePct = 0;
    }
    const intermediatePctRounded = Math.round(intermediatePct);

    // Tramo 2: resto de la carrera (todo lo que no es requisito del título intermedio) —
    // 0-100% de ese resto.
    let restoPct = 0;
    if (restoTotal > 0){
      restoPct = ((restoApproved + restoRegularized / 2) / restoTotal) * 100;
      if (!Number.isFinite(restoPct)) restoPct = 0;
    }
    const restoPctRounded = Math.round(restoPct);

    // Progreso global de la carrera (todas las materias, incluidas las del título
    // intermedio) — es el número que se muestra junto a "final de la carrera",
    // aunque la barra en sí solo pinte en ese tramo lo específico del resto.
    let globalPct = 0;
    if (total > 0){
      globalPct = ((approved + regularized / 2) / total) * 100;
      if (!Number.isFinite(globalPct)) globalPct = 0;
    }
    const globalPctRounded = Math.round(globalPct);

    const hasIntermediate = intermediateTotal > 0;
    const intermediateWrap = document.getElementById('progress-intermediate-wrap');
    if (intermediateWrap) intermediateWrap.classList.toggle('d-none', !hasIntermediate);

    // Ancho de cada segmento de la barra única: proporción que representa ese
    // tramo sobre el total de la carrera.
    const segmentIntermediate = document.getElementById('progress-segment-intermediate');
    const segmentFinal = document.getElementById('progress-segment-final');
    const intermediateShare = total > 0 ? (intermediateTotal / total) * 100 : 0;
    const restoShare = total > 0 ? 100 - intermediateShare : 100;
    if (segmentIntermediate){
      segmentIntermediate.classList.toggle('d-none', !hasIntermediate);
      segmentIntermediate.style.width = `${intermediateShare}%`;
    }
    if (segmentFinal) segmentFinal.style.width = `${hasIntermediate ? restoShare : 100}%`;

    if (progressBarIntermediate){
      progressBarIntermediate.style.width = `${intermediatePctRounded}%`;
      progressBarIntermediate.setAttribute('aria-valuenow', intermediatePctRounded);
    }
    const progressLabelIntermediate = document.getElementById('progress-label-intermediate');
    if (progressLabelIntermediate) progressLabelIntermediate.textContent = hasIntermediate ? `${intermediatePctRounded}%` : '—';

    if (progressBarFinal){
      progressBarFinal.style.width = `${restoPctRounded}%`;
      progressBarFinal.setAttribute('aria-valuenow', restoPctRounded);
    }
    progressLabel.textContent = total > 0 ? `${globalPctRounded}%` : '—';

    // Render dynamic stats row cards
    try{ renderStatsRowCards(); }catch(e){ console.error('Error rendering stats row', e); }
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

  // Insert electiva into a given column index and persist via activeStore (electivesCache)
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
      const key = subj.code || subj.name;
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
        removeBtn.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          removeBtn.disabled = true;
          try{
            await activeStore.removeElective(currentCareer, key);
            await activeStore.dropEnrollment(key);
            electivesCache = electivesCache.filter(e => !(e.careerCode === currentCareer && e.subjectCode === key));
            putSubjectDataInCache(key, null);
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
          }catch(err){
            console.error('Error eliminando electiva', err);
            alert('No se pudo eliminar la electiva: ' + (err && err.message ? err.message : err));
            removeBtn.disabled = false;
          }
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
      (async () => {
        try{
          await activeStore.setElective(currentCareer, key, colIndex);
          const idx = electivesCache.findIndex(e => e.careerCode === currentCareer && e.subjectCode === key);
          const entry = { careerCode: currentCareer, subjectCode: key, columnIndex: colIndex };
          if (idx >= 0) electivesCache[idx] = entry; else electivesCache.push(entry);
        }catch(e){
          console.error('Error guardando electiva', e);
          showElectivasAlert('danger', 'No se pudo guardar la electiva.');
        }
      })();
      // refresh overlays and stats
      setupOverlayAndInteractions();
      try{ computeStats(displayedSubjects); }catch(e){}
      showElectivasAlert('success', 'Electiva agregada al tablero.');
    }catch(e){ console.error('Error agregando electiva', e); showElectivasAlert('danger','Error al agregar electiva.'); }
  }

  // Restore electivas ya colocadas (electivesCache, poblado al bootear) dentro del tablero.
  // Usa electivasList (cargado del curriculum de la carrera activa) para resolver nombre/horas de cada electiva.
  // NOTE: Si una electiva ya no existe en el plan actual, no se muestra.
  function restoreElectivesFromStorage(){
    const entries = getElectivesForCurrentCareer();
    if (!entries.length) return;
    const list = Array.isArray(electivasList) ? electivasList : [];
    const byCode = {};
    const byName = {};
    list.forEach(s => { if (s.code) byCode[s.code] = s; if (s.name) byName[s.name] = s; });
    entries.forEach(entry => {
      try{
        const colIndex = entry.columnIndex;
        let subjMeta = byCode[entry.subjectCode] || byName[entry.subjectCode] || null;
        if (!subjMeta) {
          console.log('Elective not found in current plan, skipping:', entry.subjectCode);
          return;
        }
        const colEl = columnsContainer.querySelector(`.column-col[data-index="${colIndex}"]`);
        let placeholderEl = null;
        if (colEl) placeholderEl = colEl.querySelector('.card-electiva-add');
        performAddElectiveToColumn(subjMeta, colIndex, placeholderEl, true);
      }catch(e){ console.error('Error restaurando electiva', entry.subjectCode, e); }
    });
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

  // =====================================================
  // STATS MODULE: All available stats and dynamic infoboxes
  // =====================================================
  
  // Configuration constants
  const STATS_CONFIG = {
    MAX_STATS: 5,                    // Maximum number of stat cards to display
    DEFAULT_WEEK_HOURS: 6,           // Default weekly hours when not specified
    MIN_YEAR_STARTED: 1990,          // Minimum year for "year started" input
    MAX_YEAR_STARTED: 2099,          // Maximum year for "year started" input
    // Fórmula de peso académico:
    //   P = 11·MAp_total − 7·FAd_total − 19·FAu_ciclo − 17·MAb_ciclo + 5·MR_ciclo
    // MAp_total: materias aprobadas/promocionadas en total.
    // FAd_total: finales adeudados (materias regularizadas, sin importar el año).
    // MR_ciclo: materias regularizadas cuyo año de inscripción es el año actual.
    // FAu_ciclo (finales ausentes en el ciclo) y MAb_ciclo (materias abandonadas en el
    // ciclo) se saltean por completo: hoy no hay forma de determinarlos con los datos
    // que guardamos, así que sus coeficientes no están implementados (a propósito).
    PESO_COEF_APROBADAS: 11,
    PESO_COEF_FINALES_ADEUDADOS: 7,
    PESO_COEF_REGULARIZADAS_CICLO: 5
  };
  
  // All available stats definitions
  const ALL_STATS = [
    { id: 'horasSemanales', name: 'Horas semanales', compute: computeHorasSemanales },
    { id: 'promedio', name: 'Promedio', compute: computePromedio },
    { id: 'materiasAprobadas', name: 'Materias aprobadas', compute: computeMateriasAprobadas },
    { id: 'finalesPendientes', name: 'Finales pendientes', compute: computeFinalesPendientes },
    { id: 'materiasCursables', name: 'Materias que pueden cursarse', compute: computeMateriasCursables },
    { id: 'puedePromocionar', name: 'Materias en condición de promoción', compute: computePuedePromocionar },
    { id: 'debeRecuperar', name: 'Materias a recuperar', compute: computeDebeRecuperar },
    { id: 'desaprobadas', name: 'Cantidad de materias desaprobadas', compute: computeDesaprobadas },
    { id: 'aniosAntiguedad', name: 'Años de antigüedad', compute: computeAniosAntiguedad },
    { id: 'pesoAcademico', name: 'Peso académico', compute: computePesoAcademico }
  ];
  
  // Default selected stats (keys)
  const DEFAULT_SELECTED_STATS = ['horasSemanales', 'promedio', 'materiasAprobadas', 'finalesPendientes', 'materiasCursables'];
  
  // Load selected stats from localStorage or use defaults
  function getSelectedStats(){
    try{
      const raw = localStorage.getItem('selectedStats');
      if (raw){
        const arr = JSON.parse(raw);
        if (Array.isArray(arr) && arr.length > 0) return arr.slice(0, STATS_CONFIG.MAX_STATS);
      }
    }catch(e){}
    return DEFAULT_SELECTED_STATS.slice();
  }
  
  function saveSelectedStats(arr){
    const statsToSave = arr.slice(0, STATS_CONFIG.MAX_STATS);
    try{ localStorage.setItem('selectedStats', JSON.stringify(statsToSave)); }catch(e){}
    if (activeStore === apiStore) {
      activeStore.updatePreferences({ selectedStats: statsToSave }).catch(e => console.error('Error sincronizando selectedStats', e));
    }
  }

  // Load year started from localStorage
  function getYearStarted(){
    try{
      const v = localStorage.getItem('yearStarted');
      if (v) return parseInt(v, 10);
    }catch(e){}
    return null;
  }

  function saveYearStarted(year){
    try{ localStorage.setItem('yearStarted', String(year)); }catch(e){}
    if (activeStore === apiStore) {
      activeStore.updatePreferences({ yearStarted: year }).catch(e => console.error('Error sincronizando yearStarted', e));
    }
  }
  
  // Initialize year started input in profile modal
  function initYearStartedInput(){
    const input = document.getElementById('profile-year-started');
    if (!input) return;
    const saved = getYearStarted();
    if (saved) input.value = saved;
    input.addEventListener('change', () => {
      const val = parseInt(input.value, 10);
      if (!Number.isNaN(val) && val >= 1990 && val <= 2099){
        saveYearStarted(val);
        // Refresh stats
        try{ renderStatsRowCards(); populateStatsModalTable(); }catch(e){}
      }
    });
  }
  
  // =====================================================
  // Stats computation functions
  // =====================================================
  
  function computeHorasSemanales(){
    // Sum weekly hours for subjects in course (same logic as statsTotalPeso)
    let inCourseHours = 0;
    try{
      for (const subj of (displayedSubjects || [])){
        const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
        const stored = key ? loadSubjectData(key) : null;
        const status = stored ? stored.status : null;
        const terminal = ['Aprobada','Promocionada','Regularizada','Desaprobada'];
        if (stored && !terminal.includes(status)){
          const wh = Number.isFinite(Number(subj.weekHours)) ? Number(subj.weekHours) : STATS_CONFIG.DEFAULT_WEEK_HOURS;
          inCourseHours += wh;
        }
      }
      // Also include electivas in course
      const electList = Array.isArray(electivasList) ? electivasList : [];
      const byCode = {};
      const byName = {};
      electList.forEach(e => { if (e.code) byCode[e.code] = e; if (e.name) byName[e.name] = e; });
      getElectivesForCurrentCareer().forEach(entry => {
        try{
          const stored = loadSubjectData(entry.subjectCode);
          const status = stored ? stored.status : null;
          const terminal = ['Aprobada','Promocionada','Regularizada','Desaprobada'];
          if (stored && !terminal.includes(status)){
            const meta = byCode[entry.subjectCode] || byName[entry.subjectCode] || null;
            const wh = meta && Number.isFinite(Number(meta.weekHours)) ? Number(meta.weekHours) : STATS_CONFIG.DEFAULT_WEEK_HOURS;
            inCourseHours += wh;
          }
        }catch(e){}
      });
    }catch(e){ inCourseHours = 0; }
    return inCourseHours > 0 ? (String(inCourseHours) + ' hs') : '—';
  }
  
  function computePromedio(){
    let approvedGradeSum = 0;
    let approvedGradeCount = 0;
    try{
      for (const subj of (displayedSubjects || [])){
        const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
        const stored = key ? loadSubjectData(key) : null;
        const status = stored ? stored.status : null;
        if (status === 'Aprobada' || status === 'Promocionada'){
          let grade = NaN;
          try{
            if (status === 'Aprobada' && stored && Array.isArray(stored.finals)){
              const sorted = [...stored.finals].sort((a,b) => a.attemptNumber - b.attemptNumber);
              for (const f of sorted){
                if (f && f.grade !== null && f.grade !== undefined && f.grade >= 6){ grade = f.grade; break; }
              }
            } else if (status === 'Promocionada' && stored && stored.partials && stored.schemeConfig){
              let sum = 0, count = 0;
              const n = stored.schemeConfig.partials ?? 2;
              for (let p = 1; p <= n; p++){
                const attempts = stored.partials[p] || {};
                let eff = null;
                for (let a = 3; a >= 1; a--){ if (attempts[a] !== null && attempts[a] !== undefined){ eff = attempts[a]; break; } }
                if (eff !== null){ sum += eff; count++; }
              }
              if (count > 0) grade = Math.round(sum / count);
            }
          }catch(e){}
          if (!Number.isNaN(grade)){
            approvedGradeSum += Number(grade);
            approvedGradeCount += 1;
          }
        }
      }
    }catch(e){}
    if (approvedGradeCount > 0){
      const avg = approvedGradeSum / approvedGradeCount;
      return String(avg.toFixed(2)).replace('.', ',');
    }
    return '—';
  }
  
  function computeMateriasAprobadas(){
    const baseTotal = Array.isArray(displayedSubjects) ? displayedSubjects.length : 0;
    let approved = 0;
    for (const subj of (displayedSubjects || [])){
      const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
      const stored = key ? loadSubjectData(key) : null;
      const status = stored ? stored.status : null;
      if (status === 'Aprobada' || status === 'Promocionada') approved++;
    }
    // Count electivas approved
    try{
      getElectivesForCurrentCareer().forEach(entry => {
        const stored = loadSubjectData(entry.subjectCode);
        const status = stored ? stored.status : null;
        if (status === 'Aprobada' || status === 'Promocionada') approved++;
      });
    }catch(e){}
    // Compute total including electivas required
    let electivasRequired = 0;
    try{
      if (planData && Array.isArray(planData.modules)){
        const visibleModules = planData.modules.filter(m => m && m.render !== false);
        visibleModules.forEach(m => {
          const n = Number.isFinite(Number(m.electivas)) ? Number(m.electivas) : 0;
          electivasRequired += n;
        });
      }
    }catch(e){}
    const total = baseTotal + electivasRequired;
    return approved + ' / ' + total;
  }
  
  function computeFinalesPendientes(){
    let regularized = 0;
    for (const subj of (displayedSubjects || [])){
      const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
      const stored = key ? loadSubjectData(key) : null;
      const status = stored ? stored.status : null;
      if (status === 'Regularizada') regularized++;
    }
    // Count electivas regularized
    try{
      getElectivesForCurrentCareer().forEach(entry => {
        const stored = loadSubjectData(entry.subjectCode);
        const status = stored ? stored.status : null;
        if (status === 'Regularizada') regularized++;
      });
    }catch(e){}
    return String(regularized);
  }
  
  function computeMateriasCursables(){
    let disponibles = 0;
    try {
      if (columnsContainer) {
        const availableCards = columnsContainer.querySelectorAll('.card-subject.card-available:not(.card-electiva-add)');
        disponibles = availableCards.length;
      }
    } catch (e) { disponibles = 0; }
    return String(disponibles);
  }
  
  function computePuedePromocionar(){
    // Count subjects where status is Regularizada or No regularizada AND canPromote() returns true
    let count = 0;
    for (const subj of (displayedSubjects || [])){
      const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
      const stored = key ? loadSubjectData(key) : null;
      const status = stored ? stored.status : null;
      if ((status === 'Regularizada' || status === 'No regularizada') && canPromote(stored)){
        count++;
      }
    }
    // Also count electivas
    try{
      getElectivesForCurrentCareer().forEach(entry => {
        const stored = loadSubjectData(entry.subjectCode);
        const status = stored ? stored.status : null;
        if ((status === 'Regularizada' || status === 'No regularizada') && canPromote(stored)){
          count++;
        }
      });
    }catch(e){}
    return count > 0 ? String(count) : '—';
  }

  function computeDebeRecuperar(){
    // Count subjects where status is "No regularizada" (must recover to regularize)
    let count = 0;
    for (const subj of (displayedSubjects || [])){
      const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
      const stored = key ? loadSubjectData(key) : null;
      const status = stored ? stored.status : null;
      if (status === 'No regularizada'){
        count++;
      }
    }
    // Also count electivas
    try{
      getElectivesForCurrentCareer().forEach(entry => {
        const stored = loadSubjectData(entry.subjectCode);
        const status = stored ? stored.status : null;
        if (status === 'No regularizada') count++;
      });
    }catch(e){}
    return count > 0 ? String(count) : '—';
  }

  function computeDesaprobadas(){
    // Sum all recursedCount values for subjects in the current plan
    let totalRecursed = 0;
    for (const subj of (displayedSubjects || [])){
      const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
      const stored = key ? loadSubjectData(key) : null;
      if (stored && typeof stored.recursedCount === 'number'){
        totalRecursed += stored.recursedCount;
      }
    }
    // Also count electivas
    try{
      getElectivesForCurrentCareer().forEach(entry => {
        const stored = loadSubjectData(entry.subjectCode);
        if (stored && typeof stored.recursedCount === 'number') totalRecursed += stored.recursedCount;
      });
    }catch(e){}
    return String(totalRecursed);
  }
  
  function computeAniosAntiguedad(){
    const yearStarted = getYearStarted();
    if (!yearStarted) return '—';
    const currentYear = new Date().getFullYear();
    const years = currentYear - yearStarted;
    return years >= 0 ? String(years) : '—';
  }
  
  // Cuenta, en una sola pasada por todas las materias (plan + electivas), lo que necesita
  // la fórmula de peso académico: aprobadas/promocionadas en total, regularizadas en total
  // (= finales adeudados) y regularizadas cuyo año de inscripción es el ciclo actual.
  function getPesoAcademicoCounts(){
    let aprobadas = 0;
    let regularizadasTotal = 0;
    let regularizadasCiclo = 0;
    const currentYear = new Date().getFullYear();

    function tally(stored){
      if (!stored) return;
      if (stored.status === 'Aprobada' || stored.status === 'Promocionada') {
        aprobadas++;
      } else if (stored.status === 'Regularizada') {
        regularizadasTotal++;
        if (stored.enrollmentYear === currentYear) regularizadasCiclo++;
      }
    }

    for (const subj of (displayedSubjects || [])){
      const key = (subj.code && subj.code.trim()) ? subj.code : (subj.name || '');
      tally(key ? loadSubjectData(key) : null);
    }
    try{
      getElectivesForCurrentCareer().forEach(entry => tally(loadSubjectData(entry.subjectCode)));
    }catch(e){}

    return { aprobadas, regularizadasTotal, regularizadasCiclo };
  }

  function computePesoAcademico(){
    // P = 11·MAp_total − 7·FAd_total + 5·MR_ciclo (FAu_ciclo y MAb_ciclo no implementados, ver STATS_CONFIG)
    const { aprobadas, regularizadasTotal, regularizadasCiclo } = getPesoAcademicoCounts();
    const peso = STATS_CONFIG.PESO_COEF_APROBADAS * aprobadas
               - STATS_CONFIG.PESO_COEF_FINALES_ADEUDADOS * regularizadasTotal
               + STATS_CONFIG.PESO_COEF_REGULARIZADAS_CICLO * regularizadasCiclo;
    return String(peso);
  }
  
  // =====================================================
  // Render stats row cards
  // =====================================================
  
  function renderStatsRowCards(){
    const container = document.getElementById('stats-row-container');
    if (!container) return;
    container.innerHTML = '';
    const selected = getSelectedStats();
    if (selected.length === 0) return;
    
    // Adjust flex based on number of cards
    const cardCount = selected.length;
    
    selected.forEach(statId => {
      const statDef = ALL_STATS.find(s => s.id === statId);
      if (!statDef) return;
      const value = statDef.compute();
      const card = document.createElement('div');
      card.className = 'card stat-card p-2';
      card.dataset.statId = statId;
      // Adjust card sizing based on count
      if (cardCount <= 3){
        card.style.flex = '1 1 200px';
      } else if (cardCount === 4){
        card.style.flex = '1 1 180px';
      } else {
        card.style.flex = '1 1 160px';
      }
      card.innerHTML = `
        <div class="small text-muted">${escapeHtml(statDef.name)}</div>
        <div class="h5 mb-0">${escapeHtml(value)}</div>
      `;
      if (statId === 'pesoAcademico'){
        card.style.cursor = 'pointer';
        card.title = 'Ver composición del peso académico';
        card.addEventListener('click', openPesoAcademicoModal);
      }
      container.appendChild(card);
    });
  }

  // Detalle de la fórmula de peso académico, incluyendo los componentes salteados
  // (FAu_ciclo/MAb_ciclo) como filas meramente visuales, sin afectar el total.
  function openPesoAcademicoModal(){
    const tbody = document.getElementById('peso-academico-table-body');
    const totalEl = document.getElementById('peso-academico-total');
    if (!tbody || !totalEl) return;

    const { aprobadas, regularizadasTotal, regularizadasCiclo } = getPesoAcademicoCounts();
    const aporteAprobadas = STATS_CONFIG.PESO_COEF_APROBADAS * aprobadas;
    const aporteFinalesAdeudados = -STATS_CONFIG.PESO_COEF_FINALES_ADEUDADOS * regularizadasTotal;
    const aporteRegularizadasCiclo = STATS_CONFIG.PESO_COEF_REGULARIZADAS_CICLO * regularizadasCiclo;
    const total = aporteAprobadas + aporteFinalesAdeudados + aporteRegularizadasCiclo;

    const rows = [
      { name: 'Materias aprobadas / promocionadas (MAp_total)', coef: '+11', value: String(aprobadas), aporte: aporteAprobadas },
      { name: 'Finales adeudados (FAd_total)', coef: '−7', value: String(regularizadasTotal), aporte: aporteFinalesAdeudados },
      { name: 'Finales ausentes en el ciclo (FAu_ciclo)', coef: '−19', value: 'No disponible', aporte: null },
      { name: 'Materias abandonadas en el ciclo (MAb_ciclo)', coef: '−17', value: 'No disponible', aporte: null },
      { name: 'Materias regularizadas en el ciclo (MR_ciclo)', coef: '+5', value: String(regularizadasCiclo), aporte: aporteRegularizadasCiclo },
    ];

    tbody.innerHTML = rows.map(r => {
      const disabled = r.aporte === null;
      const aporteText = disabled ? '—' : (r.aporte >= 0 ? `+${r.aporte}` : String(r.aporte));
      return `
        <tr class="${disabled ? 'text-muted' : ''}">
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.coef)}</td>
          <td>${escapeHtml(r.value)}</td>
          <td class="text-end">${escapeHtml(aporteText)}</td>
        </tr>
      `;
    }).join('');

    totalEl.textContent = (total >= 0 ? `+${total}` : String(total));

    const modalEl = document.getElementById('pesoAcademicoModal');
    if (modalEl){
      const inst = bootstrap.Modal.getOrCreateInstance(modalEl);
      inst.show();
    }
  }
  
  // =====================================================
  // Populate stats modal table
  // =====================================================
  
  function populateStatsModalTable(){
    const tbody = document.getElementById('stats-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const selected = getSelectedStats();
    const atMax = selected.length >= STATS_CONFIG.MAX_STATS;
    
    ALL_STATS.forEach(statDef => {
      const isSelected = selected.includes(statDef.id);
      const value = statDef.compute();
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(statDef.name)}</td>
        <td><strong>${escapeHtml(value)}</strong></td>
        <td class="text-center"></td>
      `;
      const actionCell = tr.querySelector('td:last-child');
      if (isSelected){
        // Show X (remove) button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-danger btn-sm btn-remove-stat';
        btn.innerHTML = '✕';
        btn.title = 'Quitar del panel';
        btn.addEventListener('click', () => {
          const newSelected = selected.filter(id => id !== statDef.id);
          saveSelectedStats(newSelected);
          renderStatsRowCards();
          populateStatsModalTable();
        });
        actionCell.appendChild(btn);
      } else {
        // Show + (add) button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-outline-success btn-sm btn-add-stat';
        btn.innerHTML = '+';
        btn.title = 'Agregar al panel';
        if (atMax){
          btn.disabled = true;
          btn.title = 'Ya tenés 5 estadísticas en el panel';
        }
        btn.addEventListener('click', () => {
          if (atMax) return;
          const newSelected = [...selected, statDef.id];
          saveSelectedStats(newSelected);
          renderStatsRowCards();
          populateStatsModalTable();
        });
        actionCell.appendChild(btn);
      }
      tbody.appendChild(tr);
    });
  }
  
  // Initialize stats modal event: populate table when shown
  const statsModalEl = document.getElementById('statsModal');
  if (statsModalEl){
    statsModalEl.addEventListener('show.bs.modal', () => {
      populateStatsModalTable();
    });
  }

  // =====================================================
  // Mis carreras (perfil): anotarse / darse de baja. Darse de baja NO borra
  // enrollments/electivas — solo saca la carrera del dropdown (ver careerCode
  // notes en apiStore.js/localGuestStore.js: los resultados están linkeados a la
  // materia, no a la carrera).
  // =====================================================

  async function populateCareersModalTable(){
    const tbody = document.getElementById('careers-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="2" class="text-muted small">Cargando…</td></tr>';
    const catalog = await getCareers();
    tbody.innerHTML = '';
    catalog.forEach(career => {
      const isEnrolled = userCareers.some(c => c.code === career.code);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(career.name)}</td>
        <td class="text-center"></td>
      `;
      const actionCell = tr.querySelector('td:last-child');
      const btn = document.createElement('button');
      btn.type = 'button';
      if (isEnrolled){
        btn.className = 'btn btn-outline-danger btn-sm';
        btn.innerHTML = '✕';
        btn.title = 'Darme de baja';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try{
            await activeStore.unenrollCareer(career.code);
            userCareers = await activeStore.getUserCareers();
            populateProgramSelect();
            if (currentCareer === career.code){
              currentCareer = pickInitialCareer();
              syncIntermediateTitleState();
              loadPlanData();
            }
            await populateCareersModalTable();
          }catch(e){
            console.error('Error dándose de baja de la carrera', e);
            alert('No se pudo dar de baja de la carrera.');
            btn.disabled = false;
          }
        });
      } else {
        btn.className = 'btn btn-outline-success btn-sm';
        btn.innerHTML = '+';
        btn.title = 'Anotarme';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try{
            await enrollInCareer(career.code);
            await populateCareersModalTable();
          }catch(e){
            console.error('Error anotándose a la carrera', e);
            alert('No se pudo anotar a la carrera.');
            btn.disabled = false;
          }
        });
      }
      actionCell.appendChild(btn);
      tbody.appendChild(tr);
    });
  }

  const profileModalEl = document.getElementById('profileModal');
  if (profileModalEl){
    profileModalEl.addEventListener('show.bs.modal', () => {
      populateCareersModalTable();
    });
  }

  // Initialize year started input
  initYearStartedInput();

  // --- "Compartir públicamente" toggle: ligado a user_preferences.isPublic/shareToken ---
  function initShareToggleUI(){
    const toggle = document.getElementById('settings-share-toggle');
    if (!toggle) return { applyState(){} };
    const linkWrap = document.getElementById('settings-share-link-wrap');
    const linkEl = document.getElementById('settings-share-link');
    const noteEl = document.getElementById('settings-share-note');

    function applyState(prefs){
      const isPublic = !!(prefs && prefs.isPublic);
      toggle.checked = isPublic;
      toggle.disabled = activeStore !== apiStore;
      if (isPublic && prefs.shareToken){
        const shareUrl = `${window.location.origin}${window.location.pathname.replace(/index\.html$/, '')}share.html?uid=${prefs.shareToken}`;
        if (linkEl) { linkEl.href = shareUrl; linkEl.textContent = shareUrl; }
        if (linkWrap) linkWrap.style.display = '';
        if (noteEl) noteEl.textContent = 'Tu tablero es público.';
      } else {
        if (linkWrap) linkWrap.style.display = 'none';
        if (noteEl) noteEl.textContent = activeStore === apiStore
          ? 'Activá para compartir tu tablero públicamente.'
          : 'Activá para compartir tu tablero públicamente. Requiere iniciar sesión.';
      }
    }

    toggle.addEventListener('change', async () => {
      if (activeStore !== apiStore){
        toggle.checked = false;
        alert('Debés iniciar sesión para compartir tu tablero.');
        return;
      }
      const isChecked = toggle.checked;
      toggle.disabled = true;
      try{
        const prefs = await activeStore.updatePreferences({ isPublic: isChecked });
        applyState(prefs);
      }catch(err){
        console.error('Error actualizando configuración de compartir', err);
        toggle.checked = !isChecked;
        alert('Error al actualizar la configuración de compartir.');
      }finally{
        toggle.disabled = false;
      }
    });

    return { applyState };
  }

  // --- Inicialización de la app: esquemas, sesión, caches, y wiring de auth (GIS) ---
  // NOTA: no llamar a esta función "bootstrap" — colisiona con el objeto global `bootstrap`
  // de Bootstrap JS (window.bootstrap.Modal, etc.) usado en todo este archivo.
  async function initApp(){
    try{ schemesCache = await getEvaluationSchemes(); }catch(e){ console.error('Error cargando esquemas de evaluación', e); }

    const shareToggleCtl = initShareToggleUI();

    let initialUser = null;
    try{
      const me = await api.get('/auth/me');
      if (me && me.authenticated) initialUser = me.user;
    }catch(e){
      // Sin conexión o error de red: degradar a modo invitado sin bloquear la app.
      console.warn('No se pudo verificar la sesión, se usa modo invitado', e);
    }
    if (initialUser) activeStore = apiStore;

    await Promise.all([refreshEnrollmentCache(), refreshElectivesCache(), refreshRetakesCache()]);

    userCareers = await activeStore.getUserCareers();
    populateProgramSelect();

    let preferences = null;
    try{ preferences = await activeStore.getPreferences(); }catch(e){ console.error('Error cargando preferencias', e); }

    if (preferences && preferences.activeCareerCode && userCareers.some(c => c.code === preferences.activeCareerCode)){
      localStorage.setItem('career', preferences.activeCareerCode);
    }
    currentCareer = pickInitialCareer();
    if (programSelect && currentCareer) programSelect.value = currentCareer;
    syncIntermediateTitleState();

    if (activeStore === apiStore && preferences){
      if (typeof preferences.yearStarted === 'number'){
        localStorage.setItem('yearStarted', String(preferences.yearStarted));
      }
      if (Array.isArray(preferences.selectedStats) && preferences.selectedStats.length){
        localStorage.setItem('selectedStats', JSON.stringify(preferences.selectedStats));
      }
      if (typeof preferences.showCorrelativas === 'boolean'){
        localStorage.setItem('mostrarCorrelativas', preferences.showCorrelativas ? '1' : '0');
        correlativasEnabled = preferences.showCorrelativas;
        if (correlativasToggle) correlativasToggle.checked = correlativasEnabled;
      }
      if (typeof preferences.showStatus === 'boolean'){
        localStorage.setItem('mostrarEstado', preferences.showStatus ? '1' : '0');
        showStatusEnabled = preferences.showStatus;
        if (showStatusToggle) showStatusToggle.checked = showStatusEnabled;
      }
    }
    shareToggleCtl.applyState(preferences);

    initAuth({
      initialUser,
      onLoginSuccess: async () => {
        await switchStoreAndReload(apiStore);
        try{ shareToggleCtl.applyState(await activeStore.getPreferences()); }catch(e){ console.error(e); }
      },
      onLogout: async () => {
        await switchStoreAndReload(localGuestStore);
        try{ shareToggleCtl.applyState(await activeStore.getPreferences()); }catch(e){ console.error(e); }
      },
    });

    // Carga el curriculum de la carrera activa y renderiza el tablero.
    loadPlanData();
  }

  initApp();
});
