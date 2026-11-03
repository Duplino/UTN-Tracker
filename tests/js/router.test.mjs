// Tests de las rutas con hash de los modales (assets/js/router.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, routeFromHash, routeForModal } from '../../public_html/assets/js/router.js';

test('lee la ruta del hash', () => {
  assert.equal(routeFromHash('#agenda'), 'agenda');
  assert.equal(routeFromHash('#/horario'), 'horario');
  assert.equal(routeFromHash('#Planificador'), 'planificador');
});

test('ignora hashes vacíos o desconocidos', () => {
  assert.equal(routeFromHash(''), null);
  assert.equal(routeFromHash('#'), null);
  assert.equal(routeFromHash('#perfil'), null);
  assert.equal(routeFromHash('#toString'), null);
  assert.equal(routeFromHash(undefined), null);
});

test('cada modal ruteado vuelve a su ruta', () => {
  for (const [route, id] of Object.entries(ROUTES)) assert.equal(routeForModal(id), route);
  assert.equal(routeForModal('profileModal'), null);
});
