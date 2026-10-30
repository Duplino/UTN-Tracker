// Tests de la simulación del planificador de cuatrimestres (assets/js/planner.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curriculumUniverse, normalizePlan, paceEstimate, simulate, termNumber } from '../../public_html/assets/js/planner.js';

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

test('el ritmo cuenta solo años lectivos completos', () => {
  const enr = {
    A: { status: 'Aprobada', enrollmentYear: 2025 },
    B: { status: 'Aprobada', enrollmentYear: 2025 },
    C: { status: 'Aprobada', enrollmentYear: 2026 },
  };
  const est = paceEstimate({ universe, getEnrollment: c => enr[c] || null, yearStarted: 2025, now: new Date(2026, 9, 30) });
  // 2 aprobadas en 2025 (1 año completo) → 2 por año. Faltan D y E, más C que
  // se aprobó en 2026: (2 + 1) / 2 = 1,5 años desde marzo de 2026, o sea al
  // terminar el primer cuatrimestre de 2027.
  assert.equal(est.years, 1);
  assert.equal(est.pace, 2);
  assert.equal(est.term, termNumber(2027, 1));
});

test('en el primer año no se estima el ritmo', () => {
  const enr = { A: { status: 'Aprobada', enrollmentYear: 2026 } };
  const est = paceEstimate({ universe, getEnrollment: c => enr[c] || null, yearStarted: 2026, now: new Date(2026, 9, 30) });
  assert.equal(est.reason, 'first-year');
});
