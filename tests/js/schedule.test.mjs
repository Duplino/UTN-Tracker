// Tests de los helpers del horario semanal (assets/js/schedule.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BLOCKS, ROWS, blockRange, endOptions, findOverlap, groupBySubject, matchSubject, parseComprobante,
  parseScheduleText, rowsFor, shortName, validateRows, visibleShifts,
} from '../../public_html/assets/js/schedule.js';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/comprobante-cursada.json', import.meta.url)));

test('bloques de 45 minutos con el corte de 15 entre el 2 y el 3', () => {
  const ids = id => BLOCKS.find(b => b.id === id);
  assert.deepEqual([ids('M0').start, ids('M2').end, ids('M3').start, ids('M6').end], ['07:45', '10:00', '10:15', '13:15']);
  assert.deepEqual([ids('T0').start, ids('T1').start, ids('T3').start, ids('T6').end], ['13:30', '14:15', '16:00', '19:00']);
  assert.deepEqual([ids('N0').start, ids('N3').start, ids('N5').end], ['18:15', '20:45', '23:00']);
});

test('el T6 y el N0 comparten fila', () => {
  const row = ROWS.find(r => r.start === '18:15');
  assert.deepEqual(row.ids, ['T6', 'N0']);
  assert.equal(ROWS.length, BLOCKS.length - 1);
});

test('rango de bloques, también cruzando de turno', () => {
  assert.equal(blockRange('08:30', '12:30'), 'M1 a M5');
  assert.equal(blockRange('14:15', '19:00'), 'T1 a T6');
  assert.equal(blockRange('12:30', '15:45'), 'M6 a T2');
  assert.equal(blockRange('18:15', '21:30'), 'N0 a N3');
  assert.equal(blockRange('08:30', '09:15'), 'M1');
  assert.equal(rowsFor('08:30', '12:30').length, 5);
});

test('"Hasta" solo ofrece horas después de "Desde"', () => {
  const ends = endOptions('14:15').map(o => o.value);
  assert.equal(ends[0], '15:00');
  assert.ok(!ends.includes('14:15'));
});

test('turnos visibles según lo cargado', () => {
  assert.deepEqual(visibleShifts([]), ['M', 'T', 'N']);
  assert.deepEqual(visibleShifts([{ weekday: 0, start: '08:30', end: '12:30' }]), ['M']);
  assert.deepEqual(visibleShifts([{ weekday: 0, start: '12:30', end: '14:15' }]), ['M', 'T']);
  assert.deepEqual(visibleShifts([{ weekday: 1, start: '14:15', end: '19:00' }]), ['T']);
  assert.deepEqual(visibleShifts([{ weekday: 1, start: '19:00', end: '22:15' }]), ['N']);
});

test('lee los días y horas del comprobante, aunque el PDF corte el segundo día', () => {
  assert.deepEqual(parseScheduleText('Lun 14:15 a 18:15 - Mie 14:15 a'), [
    { weekday: 0, start: '14:15', end: '18:15' },
    { weekday: 2, start: '14:15', end: null },
  ]);
  assert.deepEqual(parseScheduleText('Sab 8:30 a 11:45'), [{ weekday: 5, start: '08:30', end: '11:45' }]);
});

test('arma las materias del comprobante de inscripción', () => {
  const { legajo, entries } = parseComprobante(fixture);
  assert.equal(legajo, '123.456-7');
  assert.equal(entries.length, 7);
  assert.deepEqual(entries[0], {
    code: '232020', name: 'Análisis de Sistemas de Información', period: 'Anual 2026',
    commission: 'K2005', campus: 'Medrano', sessions: [{ weekday: 4, start: '08:30', end: '13:15' }],
  });
  const fisica = entries.find(e => e.code === '950605');
  assert.equal(fisica.name, 'Física I');
  assert.equal(fisica.period, '2do Cuat 2026');
  assert.deepEqual(fisica.sessions, [{ weekday: 0, start: '14:15', end: '18:15' }, { weekday: 2, start: '14:15', end: null }]);
  assert.deepEqual(entries.find(e => e.code === '082026').sessions, [{ weekday: 3, start: '09:15', end: '12:30' }]);
  assert.equal(parseComprobante([{ str: 'otra cosa', x: 0, y: 0 }]), null);
});

test('reconoce la materia por código o por nombre', () => {
  const subjects = [{ code: 'ASI', name: 'Análisis de Sistemas de Información' }, { code: '082122', name: 'Electiva X' }];
  assert.equal(matchSubject({ code: '232020', name: 'Analisis de  Sistemas de Informacion' }, subjects), 'ASI');
  assert.equal(matchSubject({ code: '082122', name: 'Otro nombre' }, subjects), '082122');
  assert.equal(matchSubject({ code: '999999', name: 'No existe' }, subjects), null);
});

test('superposición con otras materias y validación del formulario', () => {
  const sessions = [{ subjectCode: 'AM2', weekday: 0, start: '08:30', end: '12:30' }];
  assert.equal(findOverlap(sessions, 'F1', [{ weekday: 0, start: '12:30', end: '14:15' }]), null);
  assert.equal(findOverlap(sessions, 'F1', [{ weekday: 0, start: '11:45', end: '13:15' }]).session.subjectCode, 'AM2');
  assert.equal(findOverlap(sessions, 'AM2', [{ weekday: 0, start: '08:30', end: '10:00' }]), null);
  assert.equal(validateRows([]), 'Agregá al menos un día.');
  assert.equal(validateRows([{ weekday: 0, start: '', end: '' }]), 'Elegí desde y hasta.');
  assert.match(validateRows([{ weekday: 1, start: '08:30', end: '10:00' }, { weekday: 1, start: '09:15', end: '11:00' }]), /se pisan el Mar/);
  assert.equal(validateRows([{ weekday: 1, start: '08:30', end: '10:00' }, { weekday: 3, start: '08:30', end: '10:00' }]), null);
});

test('agrupa por materia y abrevia las electivas', () => {
  const groups = groupBySubject([
    { subjectCode: 'F1', weekday: 0, start: '14:15', end: '18:15', commission: 'Z1643', campus: 'Campus' },
    { subjectCode: 'F1', weekday: 2, start: '14:15', end: '16:45', commission: 'Z1643', campus: 'Campus' },
  ]);
  assert.equal(groups.get('F1').sessions.length, 2);
  assert.equal(groups.get('F1').commission, 'Z1643');
  assert.equal(shortName('AM2', 'Análisis Matemático II'), 'AM2');
  assert.equal(shortName('082122', 'Gestión de la Mejora de Procesos'), 'GMP');
});
