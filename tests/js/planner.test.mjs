// Tests de la simulación del planificador de cuatrimestres (assets/js/planner.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curriculumUniverse, homePlanView, normalizePlan, paceEstimate, simulate, termNumber } from '../../public_html/assets/js/planner.js';

const curriculum = {
  modules: [
    {
      id: 'g1', name: 'Primer Nivel', electivas: 0, subjects: [
        { code: 'A', name: 'A', duration: 'cuatrimestral', requirements: { cursar: [] } },
        { code: 'B', name: 'B', duration: 'anual', requirements: { cursar: [] } },
      ],
    },
    {
      id: 'g2', name: 'Segundo Nivel', electivas: 0, subjects: [
        { code: 'C', name: 'C', duration: 'cuatrimestral', requirements: { cursar: [{ id: 'A', type: 'regularizada' }] } },
        { code: 'D', name: 'D', duration: 'cuatrimestral', requirements: { cursar: [{ id: 'A', type: 'aprobada' }] } },
        { code: 'E', name: 'E', duration: 'cuatrimestral', requirements: { cursar: [{ id: 'B', type: 'regularizada' }] } },
      ],
    },
  ],
};
const universe = curriculumUniverse(curriculum);
const start = termNumber(2027, 1);
const cursable = (plan, enrollments, t = start) => simulate({
  universe, plan: normalizePlan(plan), getEnrollment: c => enrollments[c] || null, start,
}).candidatesAt(t).map(c => c.subject.code).sort();

test('lo que se cursa ahora cuenta como regularizado por defecto', () => {
  assert.deepEqual(cursable({}, { A: { status: 'Faltan notas' } }), ['B', 'C']);
});

test('suponer aprobada una materia en curso destraba las que la piden aprobada', () => {
  assert.deepEqual(cursable({ current: { A: 'approved' } }, { A: { status: 'Faltan notas' } }), ['B', 'C', 'D']);
});

test('suponer desaprobada una materia en curso la vuelve a dejar para cursar', () => {
  assert.deepEqual(cursable({ current: { A: 'failed' } }, { A: { status: 'Faltan notas' } }), ['A', 'B']);
});

test('una regularizada se aprueba según cuándo se rinde el final', () => {
  const enr = { A: { status: 'Faltan notas' } };
  assert.ok(!cursable({ lag: 1 }, enr).includes('D'));
  assert.ok(cursable({ lag: 1 }, enr, start + 1).includes('D'));
  assert.ok(cursable({ lag: 0 }, enr).includes('D'));
});

test('una anual planificada habilita recién dos cuatrimestres después', () => {
  const plan = { terms: [{ year: 2027, half: 1, subjects: ['B'] }] };
  assert.ok(!cursable(plan, {}, start + 1).includes('E'));
  assert.ok(cursable(plan, {}, start + 2).includes('E'));
});

test('normalizePlan descarta resultados inválidos y el valor por defecto', () => {
  assert.deepEqual(normalizePlan({ current: { A: 'approved', B: 'regular', C: 'x' } }).current, { A: 'approved' });
});

test('el ritmo cuenta el año en curso como entero', () => {
  const enr = {
    A: { status: 'Aprobada', enrollmentYear: 2025 },
    B: { status: 'Aprobada', enrollmentYear: 2025 },
    C: { status: 'Aprobada', enrollmentYear: 2026 },
  };
  const est = paceEstimate({ universe, getEnrollment: c => enr[c] || null, yearStarted: 2025, now: new Date(2026, 9, 30) });
  // 3 aprobadas en 2 años lectivos (2025 y 2026) → 1,5 por año. Faltan D y E:
  // 2 / 1,5 ≈ 1,33 años desde marzo de 2027 → 1C 2028.
  assert.equal(est.years, 2);
  assert.equal(est.pace, 1.5);
  assert.equal(est.term, termNumber(2028, 1));
});

test('enero y febrero cuentan como parte del año lectivo anterior', () => {
  const enr = { A: { status: 'Aprobada', enrollmentYear: 2025 } };
  const est = paceEstimate({ universe, getEnrollment: c => enr[c] || null, yearStarted: 2025, now: new Date(2026, 1, 15) });
  assert.equal(est.years, 1);
});

test('"Mostrar en el inicio" se guarda solo si es true', () => {
  assert.equal(normalizePlan({ showOnHome: true }).showOnHome, true);
  assert.equal(normalizePlan({ showOnHome: 'si' }).showOnHome, false);
  assert.equal(normalizePlan(null).showOnHome, false);
});

test('el inicio muestra los próximos cuatrimestres con materias, con las anuales que siguen', () => {
  const plan = normalizePlan({
    showOnHome: true,
    terms: [
      { year: 2026, half: 2, subjects: ['A'] },
      { year: 2027, half: 1, subjects: ['B', 'A'] },
      { year: 2027, half: 2, subjects: ['D'] },
      { year: 2028, half: 1, subjects: ['E'] },
    ],
  });
  const view = homePlanView({ universe, plan, getEnrollment: () => null, start });
  assert.deepEqual(view.terms.map(t => t.label), ['1C 2027', '2C 2027']);
  assert.equal(view.more, 1);
  // B es anual: en 2C 2027 aparece como que sigue, antes que D.
  assert.deepEqual(view.terms[1].subjects.map(s => [s.code, s.kind]), [['B', 'carried'], ['D', 'planned']]);
  // A ya está planificada en 2C 2026 (pasado): no se repite en 1C 2027.
  assert.deepEqual(view.terms[0].subjects.map(s => s.code), ['B']);
});

test('el inicio marca las materias a las que les faltan correlativas o que ya se aprobaron', () => {
  const plan = normalizePlan({ showOnHome: true, terms: [{ year: 2027, half: 1, subjects: ['A', 'D'] }] });
  const view = homePlanView({ universe, plan, getEnrollment: c => (c === 'A' ? { status: 'Aprobada' } : null), start });
  const kinds = Object.fromEntries(view.terms[0].subjects.map(s => [s.code, s.kind]));
  assert.deepEqual(kinds, { A: 'done', D: 'planned' });
  const view2 = homePlanView({ universe, plan: normalizePlan({ terms: [{ year: 2027, half: 1, subjects: ['D'] }] }), getEnrollment: () => null, start });
  assert.equal(view2.terms[0].subjects[0].kind, 'warning');
  assert.equal(view2.graduationTerm, null);
});
