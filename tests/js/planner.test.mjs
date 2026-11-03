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

test('una regularizada se aprueba en el cuatrimestre elegido y destraba ese mismo cuatrimestre', () => {
  const enr = { A: { status: 'Faltan notas' } };
  // Por defecto se supone aprobada un cuatrimestre después del primero posible.
  assert.ok(!cursable({}, enr).includes('D'));
  assert.ok(cursable({}, enr, start + 1).includes('D'));
  // Si se elige aprobarla en 1C 2027, D ya se puede cursar en 1C 2027.
  assert.ok(cursable({ finals: { A: start } }, enr).includes('D'));
});

test('una regularizada real usa el cuatrimestre elegido', () => {
  const enr = { A: { status: 'Regularizada' } };
  assert.ok(cursable({ finals: { A: start } }, enr).includes('D'));
  assert.ok(!cursable({ finals: { A: start + 2 } }, enr, start + 1).includes('D'));
  assert.ok(cursable({ finals: { A: start + 2 } }, enr, start + 2).includes('D'));
});

test('no se puede aprobar antes de terminar de cursarla', () => {
  // A planificada en 1C 2027 queda regularizada para 2C 2027: elegir 1C 2027 no cuenta.
  const plan = { terms: [{ year: 2027, half: 1, subjects: ['A'] }], finals: { A: start } };
  const sim = simulate({ universe, plan: normalizePlan(plan), getEnrollment: () => null, start });
  assert.equal(sim.aprobAt.A, start + 1);
  assert.equal(sim.finalMin.A, start + 1);
});

test('una anual planificada habilita recién dos cuatrimestres después', () => {
  const plan = { terms: [{ year: 2027, half: 1, subjects: ['B'] }] };
  assert.ok(!cursable(plan, {}, start + 1).includes('E'));
  assert.ok(cursable(plan, {}, start + 2).includes('E'));
});

test('normalizePlan descarta resultados inválidos y el valor por defecto', () => {
  assert.deepEqual(normalizePlan({ current: { A: 'approved', B: 'regular', C: 'x' } }).current, { A: 'approved' });
});

test('normalizePlan descarta cuatrimestres de aprobación inválidos', () => {
  assert.deepEqual(normalizePlan({ finals: { A: start, B: 'x', C: 1.5 } }).finals, { A: start });
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
