// Tests de los helpers de la agenda de parciales y finales (assets/js/agenda.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daysUntil, examLabel, gradeFor, nextInstance, relativeLabel, splitAgenda, subjectOptions } from '../../public_html/assets/js/agenda.js';

const today = new Date(2026, 9, 30); // 30/10/2026

test('cuenta los días en fecha local, sin correrse por el huso horario', () => {
  assert.equal(daysUntil('2026-10-30', today), 0);
  assert.equal(daysUntil('2026-10-31', today), 1);
  assert.equal(daysUntil('2026-11-30', today), 31);
  assert.equal(daysUntil('2026-10-20', today), -10);
  assert.equal(daysUntil('no-es-fecha', today), null);
});

test('etiquetas relativas', () => {
  assert.equal(relativeLabel(0), 'Hoy');
  assert.equal(relativeLabel(1), 'Mañana');
  assert.equal(relativeLabel(5), 'En 5 días');
  assert.equal(relativeLabel(21), 'En 3 semanas');
  assert.equal(relativeLabel(-3), 'Hace 3 días');
});

test('nombre del examen', () => {
  assert.equal(examLabel({ kind: 'parcial', partialNumber: 2, attemptNumber: 1 }), 'Parcial 2 · Primera fecha');
  assert.equal(examLabel({ kind: 'parcial', partialNumber: 1, attemptNumber: 3 }), 'Parcial 1 · 2do recuperatorio');
  assert.equal(examLabel({ kind: 'final', partialNumber: null, attemptNumber: null }), 'Final');
});

test('separa próximas (la más cercana primero) de pasadas (la más reciente primero)', () => {
  const entries = [
    { id: 1, kind: 'parcial', partialNumber: 1, attemptNumber: 2, date: '2026-11-20' },
    { id: 2, kind: 'parcial', partialNumber: 1, attemptNumber: 1, date: '2026-10-01' },
    { id: 3, kind: 'final', date: '2026-10-30' },
    { id: 4, kind: 'parcial', partialNumber: 2, attemptNumber: 1, date: '2026-10-15' },
  ];
  const { upcoming, past } = splitAgenda(entries, today);
  assert.deepEqual(upcoming.map(e => e.id), [3, 1]);
  assert.deepEqual(past.map(e => e.id), [4, 2]);
});

test('muestra la nota de la instancia si ya está cargada', () => {
  const enrollment = { partials: { 1: { 1: 4, 2: 7 } }, finals: [{ attemptNumber: 1, grade: 9, examDate: '2026-12-10' }] };
  assert.equal(gradeFor({ kind: 'parcial', partialNumber: 1, attemptNumber: 2 }, enrollment), 7);
  assert.equal(gradeFor({ kind: 'parcial', partialNumber: 1, attemptNumber: 3 }, enrollment), null);
  assert.equal(gradeFor({ kind: 'final', date: '2026-12-10' }, enrollment), 9);
  assert.equal(gradeFor({ kind: 'final', date: '2026-12-17' }, enrollment), null);
});

test('ofrece las materias sin aprobar, con la cantidad de parciales de su esquema', () => {
  const opts = subjectOptions([
    { subjectCode: 'AM2', status: 'Faltan notas', schemeConfig: { partials: 2 } },
    { subjectCode: 'PDP', status: 'Regularizada', schemeConfig: { partials: 3 } },
    { subjectCode: 'AM1', status: 'Aprobada', schemeConfig: { partials: 2 } },
    { subjectCode: 'TPF', status: 'Faltan notas', schemeConfig: { partials: 0 } },
  ], c => ({ AM2: 'Análisis II', PDP: 'Paradigmas', TPF: 'Proyecto Final' }[c]));
  assert.deepEqual(opts.map(o => [o.code, o.partials]), [['AM2', 2], ['PDP', 3], ['TPF', 0]]);
});

test('después de agregar una fecha pasa a la instancia siguiente', () => {
  assert.deepEqual(nextInstance(1, 1, 2), { partialNumber: 1, attemptNumber: 2 });
  assert.deepEqual(nextInstance(1, 3, 2), { partialNumber: 2, attemptNumber: 1 });
  assert.deepEqual(nextInstance(2, 3, 2), { partialNumber: 2, attemptNumber: 3 });
});
