// Tests de las sugerencias de fechas de final de Guaraní (assets/js/guaraniExamDates.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestionsFor, suggestionsHtml, chipTitle } from '../../public_html/assets/js/guaraniExamDates.js';

const today = new Date(2026, 10, 27); // 27/11/2026

const list = [
  { subjectCode: 'AECH', date: '2026-12-14', startTime: '19:00', inscriptionType: 'Regular', location: 'Sede Campus' },
  { subjectCode: 'AECH', date: '2026-12-03', startTime: '19:00', inscriptionType: 'Regular', location: 'Sede Campus' },
  { subjectCode: 'AECH', date: '2026-12-14', startTime: '19:00', inscriptionType: 'Libre', location: 'Sede Campus' },
  { subjectCode: 'AECH', date: '2026-11-20', startTime: '19:00', inscriptionType: 'Regular', location: 'Sede Campus' },
  { subjectCode: 'AyED', date: '2026-12-05', startTime: '09:00', inscriptionType: 'Regular', location: 'Sede Medrano' },
];

test('solo la materia pedida, de hoy en adelante, ordenadas y una por fecha', () => {
  const s = suggestionsFor(list, 'AECH', today);
  assert.deepEqual(s.map(x => x.date), ['2026-12-03', '2026-12-14']);
  assert.deepEqual(s[1].types, ['Regular', 'Libre']);
  assert.deepEqual(suggestionsFor(list, 'XX', today), []);
  assert.deepEqual(suggestionsFor(null, 'AECH', today), []);
});

test('la fecha de hoy todavía se sugiere', () => {
  assert.equal(suggestionsFor([{ subjectCode: 'A', date: '2026-11-27' }], 'A', today).length, 1);
});

test('detalle de la mesa en el title', () => {
  assert.equal(chipTitle(suggestionsFor(list, 'AECH', today)[1]), '19:00 h · Regular / Libre · Sede Campus');
});

test('las fechas ya cargadas quedan deshabilitadas', () => {
  const html = suggestionsHtml(suggestionsFor(list, 'AECH', today), ['2026-12-03']);
  assert.match(html, /data-date="2026-12-03"[^>]*disabled/);
  assert.doesNotMatch(html, /data-date="2026-12-14"[^>]*disabled/);
  assert.equal(suggestionsHtml([]), '');
});
