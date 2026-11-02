// Tests de "¿Qué podemos cursar juntos?" (assets/js/together.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareTogether, parseShareToken } from '../../public_html/assets/js/together.js';

const req = (id, type = 'regularizada') => ({ id, type });
const subject = (code, name, cursar = []) => ({ code, name, requirements: { cursar, aprobar: [] } });
const curriculum = {
  modules: [
    { id: 'g1', name: 'Primer Nivel', electivas: 0, subjects: [subject('AM1', 'Análisis I'), subject('F1', 'Física I')] },
    { id: 'g2', name: 'Segundo Nivel', electivas: 1, subjects: [
      subject('AM2', 'Análisis II', [req('AM1')]),
      subject('F2', 'Física II', [req('F1')]),
      subject('PyE', 'Probabilidad', [req('AM1', 'aprobada')]),
      subject('ECO', 'Economía'),
    ] },
    { id: 'electives', name: 'Electivas', render: false, subjects: [subject('EL1', 'Electiva 1', [req('AM1')])] },
  ],
};
const enrollments = map => code => (map[code] ? { status: map[code] } : null);

test('separa lo que pueden cursar los dos, solo vos y solo el compañero', () => {
  const r = compareTogether({
    curriculum,
    mine: enrollments({ AM1: 'Aprobada', F1: 'Faltan notas' }),
    theirs: enrollments({ AM1: 'Regularizada', F1: 'Aprobada', ECO: 'Faltan notas' }),
    start: 2027 * 2,
  });
  // AM2 y F2: los dos (F1 en curso cuenta como regularizada). ECO: el compañero ya la cursa.
  assert.deepEqual(r.both.map(i => i.subject.code), ['AM2', 'F2', 'EL1']);
  // PyE pide AM1 aprobada: solo vos.
  assert.deepEqual(r.onlyMe.map(i => i.subject.code), ['PyE']);
  assert.deepEqual(r.onlyMe[0].missing, [{ code: 'AM1', need: 'aprobada' }]);
  assert.deepEqual(r.onlyThem, []);
  assert.deepEqual(r.counts, { me: { approved: 1, inProgress: 1 }, them: { approved: 1, inProgress: 1 } });
});

test('lo que te falta a vos y lo que cursan juntos ahora', () => {
  const r = compareTogether({
    curriculum,
    mine: enrollments({ ECO: 'Faltan notas' }),
    theirs: enrollments({ AM1: 'Aprobada', ECO: 'Faltan notas' }),
    start: 2027 * 2,
  });
  assert.deepEqual(r.onlyThem.map(i => i.subject.code), ['AM2', 'PyE']);
  assert.deepEqual(r.onlyThem[0].missing, [{ code: 'AM1', need: 'regularizada' }]);
  assert.deepEqual(r.both.map(i => i.subject.code), ['F1']);
  assert.deepEqual(r.together.map(s => s.code), ['ECO']);
});

test('lee el token del link de compartir o suelto', () => {
  assert.equal(parseShareToken('https://utntracker.com.ar/share.html?uid=9f3a1c7e00'), '9f3a1c7e00');
  assert.equal(parseShareToken('  9f3a1c7e00 '), '9f3a1c7e00');
  assert.equal(parseShareToken('https://utntracker.com.ar/'), null);
  assert.equal(parseShareToken('no es; un token'), null);
});
