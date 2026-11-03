// Orden de materias del tablero. Hay tres tipos:
//  - el base: los módulos (niveles) del curriculum, casi siempre el plan oficial;
//  - los alternativos que trae la carrera (curriculum.layouts, ej. Franja Morada),
//    que reubican materias en otros niveles;
//  - "Mi plan": una columna por año según el planificador de cuatrimestres (lo
//    planificado va al año en que se planificó, lo ya cursado al año en que se
//    cursó, y el resto a "Sin planificar").
// Es solo visual: cada materia conserva sus correlativas y sus flags de título
// intermedio, y las estadísticas siguen saliendo del curriculum original.
//
// La preferencia se guarda por carrera en `subjectLayouts`:
//   { codigoCarrera: { selected: 'oficial' | <id de layout> | 'propio' } }

export const OFFICIAL_LAYOUT = 'oficial';
export const PLAN_LAYOUT = 'propio';
export const UNPLANNED_COLUMN = 'plan-none';

function visibleModules(curriculum) {
  const modules = Array.isArray(curriculum && curriculum.modules) ? curriculum.modules : [];
  return modules.filter(m => m && m.render !== false);
}

function electiveModule(curriculum) {
  const modules = Array.isArray(curriculum && curriculum.modules) ? curriculum.modules : [];
  return modules.find(m => m && m.id === 'electives') || modules.find(m => m && m.render === false && Array.isArray(m.subjects)) || null;
}

function curriculumLayouts(curriculum) {
  const layouts = Array.isArray(curriculum && curriculum.layouts) ? curriculum.layouts : [];
  return layouts.filter(l => l && l.id && l.id !== OFFICIAL_LAYOUT && l.id !== PLAN_LAYOUT);
}

// Opciones del selector para una carrera: el base, los que la carrera tenga
// cargados y "Mi plan" (salvo withPlan: false, ej. en el perfil público, que no
// ve el planificador). El base viene con el nombre del plan cargado: en una
// carrera donde solo hay otro (ej. Mecánica, con el de Franja Morada), ese.
export function layoutOptions(curriculum, { withPlan = true } = {}) {
  const baseName = (curriculum && curriculum.metadata && curriculum.metadata.baseLayoutName) || 'Plan oficial';
  const options = [
    { id: OFFICIAL_LAYOUT, name: baseName },
    ...curriculumLayouts(curriculum).map(l => ({ id: l.id, name: l.name || l.id, description: l.description || '' })),
  ];
  if (withPlan) options.push({ id: PLAN_LAYOUT, name: 'Mi plan', description: 'Una columna por año, según el planificador' });
  return options;
}

// Preferencia de una carrera, normalizada. Si el orden elegido no existe (ej. se
// sacó de la base, o es "Mi plan" donde no está disponible), vuelve al base.
export function layoutPrefFor(prefsMap, careerCode, curriculum = null, options = {}) {
  const raw = (prefsMap && careerCode && prefsMap[careerCode]) || {};
  let selected = typeof raw.selected === 'string' && raw.selected ? raw.selected : OFFICIAL_LAYOUT;
  if (curriculum && !layoutOptions(curriculum, options).some(o => o.id === selected)) selected = OFFICIAL_LAYOUT;
  return { selected };
}

export function withLayoutPref(prefsMap, careerCode, pref) {
  return { ...(prefsMap || {}), [careerCode]: { selected: pref.selected } };
}

// Reubica materias en los niveles de un orden alternativo de la carrera.
function applyCareerLayout(curriculum, layout) {
  const modules = Array.isArray(curriculum.modules) ? curriculum.modules : [];
  const visible = visibleModules(curriculum);
  if (visible.length === 0 || !layout) return curriculum;
  const moduleIds = new Set(visible.map(m => m.id));
  const placements = (layout && layout.placements) || {};

  // Posición oficial global (nivel, lugar en la columna): ordena y desempata las
  // materias que el layout no ubica (quedan en su nivel oficial, al final).
  const byModule = new Map(visible.map(m => [m.id, []]));
  visible.forEach((m, mIdx) => {
    (m.subjects || []).forEach((s, sIdx) => {
      const p = placements[s.code];
      const target = p && moduleIds.has(p.module) ? p.module : m.id;
      const placed = p && moduleIds.has(p.module) && Number.isFinite(Number(p.order));
      byModule.get(target).push({ subject: s, key: placed ? [0, Number(p.order), 0] : [1, 0, mIdx * 1000 + sIdx] });
    });
  });
  byModule.forEach(list => list.sort((a, b) => a.key[0] - b.key[0] || a.key[1] - b.key[1] || a.key[2] - b.key[2]));

  return {
    ...curriculum,
    modules: modules.map(m => (m && m.render !== false && byModule.has(m.id))
      ? { ...m, subjects: byModule.get(m.id).map(e => e.subject) }
      : m),
  };
}

// "Mi plan": una columna por año. Cada materia va, en este orden de prioridad:
//  1. al año del primer cuatrimestre donde está en el planificador;
//  2. al año en que se cursó (enrollmentYear de su inscripción);
//  3. a "Sin planificar".
// Las electivas entran como una materia más si están elegidas en el tablero
// (electiveCodes) o planificadas. Las columnas no tienen cupos de electivas.
export function applyPlanLayout(curriculum, { plan = null, getEnrollment = () => null, electiveCodes = [] } = {}) {
  const visible = visibleModules(curriculum);
  if (!curriculum || visible.length === 0) return curriculum;
  const electives = electiveModule(curriculum);

  const plannedYear = {};
  const terms = Array.isArray(plan && plan.terms) ? plan.terms : [];
  terms
    .filter(t => t && Number.isInteger(t.year) && (t.half === 1 || t.half === 2) && Array.isArray(t.subjects))
    .slice()
    .sort((a, b) => (a.year * 2 + a.half) - (b.year * 2 + b.half))
    .forEach(t => t.subjects.forEach(code => {
      if (typeof code === 'string' && !(code in plannedYear)) plannedYear[code] = t.year;
    }));

  const entries = [];
  visible.forEach((m, mIdx) => {
    (m.subjects || []).forEach((s, sIdx) => entries.push({ subject: s, rank: mIdx * 1000 + sIdx }));
  });
  const wanted = new Set([...electiveCodes, ...Object.keys(plannedYear)]);
  ((electives && electives.subjects) || []).forEach((s, sIdx) => {
    if (s && wanted.has(s.code)) entries.push({ subject: s, rank: 900000 + sIdx });
  });

  const byYear = new Map();
  const unplanned = [];
  entries.forEach(e => {
    const code = e.subject.code;
    let year = plannedYear[code];
    if (!Number.isInteger(year)) {
      const enrollment = getEnrollment(code);
      const y = enrollment && Number(enrollment.enrollmentYear);
      year = Number.isInteger(y) && y > 0 ? y : null;
    }
    if (year === null || year === undefined) unplanned.push(e);
    else {
      if (!byYear.has(year)) byYear.set(year, []);
      byYear.get(year).push(e);
    }
  });

  const sortByRank = list => list.slice().sort((a, b) => a.rank - b.rank).map(e => e.subject);
  const columns = [...byYear.keys()].sort((a, b) => a - b).map(year => ({
    id: `plan-${year}`, name: String(year), electivas: 0, subjects: sortByRank(byYear.get(year)),
  }));
  if (unplanned.length) {
    columns.push({ id: UNPLANNED_COLUMN, name: 'Sin planificar', electivas: 0, subjects: sortByRank(unplanned) });
  }

  return {
    ...curriculum,
    planView: true,
    modules: electives ? [...columns, electives] : columns,
  };
}

// Devuelve el curriculum con el orden elegido aplicado. Con el base (o algo
// desconocido) devuelve el mismo objeto. "Mi plan" necesita planContext
// ({ plan, getEnrollment, electiveCodes }, ver applyPlanLayout).
export function applySubjectLayout(curriculum, pref, planContext = null) {
  if (!curriculum || !pref || !pref.selected || pref.selected === OFFICIAL_LAYOUT) return curriculum;
  if (pref.selected === PLAN_LAYOUT) return planContext ? applyPlanLayout(curriculum, planContext) : curriculum;
  const layout = curriculumLayouts(curriculum).find(l => l.id === pref.selected);
  return layout ? applyCareerLayout(curriculum, layout) : curriculum;
}
