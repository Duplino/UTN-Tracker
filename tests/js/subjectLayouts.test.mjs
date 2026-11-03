// Tests del orden de materias del tablero (assets/js/subjectLayouts.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyPlanLayout, applySubjectLayout, layoutOptions, layoutPrefFor, withLayoutPref,
} from '../../public_html/assets/js/subjectLayouts.js';

const curriculum = {
  metadata: { baseLayoutName: 'Plan oficial' },
  modules: [
    { id: 'g1', name: 'Primer Nivel', electivas: 0, subjects: [{ code: 'A' }, { code: 'B' }, { code: 'IyS' }] },
    { id: 'g2', name: 'Segundo Nivel', electivas: 1, subjects: [{ code: 'C' }, { code: 'InglesI', requiredForIntermediateTitle: true }] },
    { id: 'electives', name: 'Electivas', render: false, subjects: [{ code: 'E1' }, { code: 'E2' }] },
  ],
  layouts: [
    {
      id: 'franja-morada', name: 'Franja Morada', description: 'Plan sugerido',
      placements: {
        A: { module: 'g1', order: 1 }, InglesI: { module: 'g1', order: 2 }, B: { module: 'g1', order: 3 },
        C: { module: 'g2', order: 4 }, IyS: { module: 'g2', order: 5 },
      },
    },
  ],
};
const codesByModule = c => Object.fromEntries(c.modules.map(m => [m.id, m.subjects.map(s => s.code)]));

test('el selector ofrece el base, los de la carrera y "Mi plan"', () => {
  assert.deepEqual(layoutOptions(curriculum).map(o => o.id), ['oficial', 'franja-morada', 'propio']);
  assert.deepEqual(layoutOptions(curriculum, { withPlan: false }).map(o => o.id), ['oficial', 'franja-morada']);
  // Una carrera con un solo plan cargado lo muestra con su nombre.
  const mecanica = { metadata: { baseLayoutName: 'Franja Morada' }, modules: [], layouts: [] };
  assert.deepEqual(layoutOptions(mecanica).map(o => o.name), ['Franja Morada', 'Mi plan']);
});

test('con el plan base el curriculum no cambia', () => {
  assert.equal(applySubjectLayout(curriculum, { selected: 'oficial' }), curriculum);
});

test('un orden de la carrera mueve las materias y respeta su posición', () => {
  const out = applySubjectLayout(curriculum, { selected: 'franja-morada' });
  assert.deepEqual(codesByModule(out), {
    g1: ['A', 'InglesI', 'B'],
    g2: ['C', 'IyS'],
    electives: ['E1', 'E2'],
  });
  // Los cupos de electivas y los flags de cada materia no cambian.
  assert.equal(out.modules[1].electivas, 1);
  assert.equal(out.modules[0].subjects[1].requiredForIntermediateTitle, true);
  // No modifica el curriculum original (se cachea y se comparte).
  assert.deepEqual(codesByModule(curriculum).g1, ['A', 'B', 'IyS']);
});

test('"Mi plan" arma una columna por año: planificado, después cursado, después sin planificar', () => {
  const plan = {
    terms: [
      { year: 2028, half: 1, subjects: ['InglesI', 'E2'] },
      { year: 2027, half: 2, subjects: ['C'] },
      { year: 2027, half: 1, subjects: ['B'] },
    ],
  };
  const enrollments = { A: { enrollmentYear: 2026 }, B: { enrollmentYear: 2026 } };
  const out = applyPlanLayout(curriculum, { plan, getEnrollment: c => enrollments[c] || null, electiveCodes: ['E1'] });
  assert.equal(out.planView, true);
  // B está cursada en 2026 pero se volvió a planificar en 2027 (ej. la recursa): gana el plan.
  assert.deepEqual(codesByModule(out), {
    'plan-2026': ['A'],
    'plan-2027': ['B', 'C'],
    'plan-2028': ['InglesI', 'E2'],
    'plan-none': ['IyS', 'E1'],
    electives: ['E1', 'E2'],
  });
  assert.deepEqual(out.modules.map(m => m.name), ['2026', '2027', '2028', 'Sin planificar', 'Electivas']);
  assert.ok(out.modules.filter(m => m.render !== false).every(m => m.electivas === 0));
});

test('"Mi plan" sin planificador ni inscripciones deja todo en "Sin planificar"', () => {
  const out = applySubjectLayout(curriculum, { selected: 'propio' }, { plan: null, getEnrollment: () => null });
  assert.deepEqual(codesByModule(out), { 'plan-none': ['A', 'B', 'IyS', 'C', 'InglesI'], electives: ['E1', 'E2'] });
  // Sin contexto (ej. perfil público) se queda con el base.
  assert.equal(applySubjectLayout(curriculum, { selected: 'propio' }), curriculum);
});

test('la preferencia se normaliza por carrera', () => {
  assert.deepEqual(layoutPrefFor({}, 'sistemas', curriculum), { selected: 'oficial' });
  assert.equal(layoutPrefFor({ sistemas: { selected: 'ya-no-existe' } }, 'sistemas', curriculum).selected, 'oficial');
  assert.equal(layoutPrefFor({ sistemas: { selected: 'propio' } }, 'sistemas', curriculum, { withPlan: false }).selected, 'oficial');
  const map = withLayoutPref({ S23: { selected: 'propio' } }, 'sistemas', { selected: 'franja-morada' });
  assert.deepEqual(Object.keys(map).sort(), ['S23', 'sistemas']);
  assert.equal(layoutPrefFor(map, 'sistemas', curriculum).selected, 'franja-morada');
});
