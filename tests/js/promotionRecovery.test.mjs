// Corre con: node --test tests/js/
// Cuándo se ofrece el recuperatorio opcional "Puede promocionar" al ir cargando notas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { promotionRecoveryCandidates } from '../../public_html/assets/js/statusEngine.js';

const cases = JSON.parse(readFileSync(new URL('../fixtures/status-cases.json', import.meta.url), 'utf8'));
const configOf = (scheme) => cases.find((c) => c.scheme === scheme).config;
const twoPartials = configOf('2-partials');
const paradigmas = configOf('paradigmas');

test('un 6 con el otro parcial sin cargar no sugiere recuperatorio', () => {
  assert.deepEqual(promotionRecoveryCandidates(twoPartials, { 1: { 1: 6 } }), []);
});

test('6 y 8: ofrece recuperar el 6 para promocionar', () => {
  assert.deepEqual(promotionRecoveryCandidates(twoPartials, { 1: { 1: 6 }, 2: { 1: 8 } }), [1]);
});

test('6 y 7: no hay promoción posible (un solo recuperatorio)', () => {
  assert.deepEqual(promotionRecoveryCandidates(twoPartials, { 1: { 1: 6 }, 2: { 1: 7 } }), []);
});

test('4 y 8: el recuperatorio obligatorio también puede promocionar', () => {
  assert.deepEqual(promotionRecoveryCandidates(twoPartials, { 1: { 1: 4 }, 2: { 1: 8 } }), [1]);
});

test('el otro parcial llegó a 8 recuperando: ya no queda recuperatorio para promocionar', () => {
  assert.deepEqual(promotionRecoveryCandidates(twoPartials, { 1: { 1: 6 }, 2: { 1: 5, 2: 8 } }), []);
});

test('recuperatorio ya cargado: no se vuelve a ofrecer', () => {
  assert.deepEqual(promotionRecoveryCandidates(twoPartials, { 1: { 1: 6, 2: 7 }, 2: { 1: 8 } }), []);
});

test('8 y 8: ya promociona, no sugiere nada', () => {
  assert.deepEqual(promotionRecoveryCandidates(twoPartials, { 1: { 1: 8 }, 2: { 1: 9 } }), []);
});

test('paradigmas 8 7 7: cualquiera de los dos 7 puede promocionar', () => {
  assert.deepEqual(promotionRecoveryCandidates(paradigmas, { 1: { 1: 8 }, 2: { 1: 7 }, 3: { 1: 7 } }), [2, 3]);
});

test('paradigmas 7 7 7: harían falta dos recuperatorios', () => {
  assert.deepEqual(promotionRecoveryCandidates(paradigmas, { 1: { 1: 7 }, 2: { 1: 7 }, 3: { 1: 7 } }), []);
});

test('TP para promoción sin entregar todavía: igual se ofrece', () => {
  const tpPromo = configOf('2-partials-tp-promotion-only');
  assert.deepEqual(promotionRecoveryCandidates(tpPromo, { 1: { 1: 6 }, 2: { 1: 8 } }), [1]);
});
