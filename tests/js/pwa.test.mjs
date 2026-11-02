// Tests de la detección para el aviso de instalar la app (assets/js/pwa.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isIOS, recentlyDismissed } from '../../public_html/assets/js/pwa.js';

test('isIOS reconoce iPhone, iPad viejo y iPadOS (que se presenta como Mac)', () => {
  assert.equal(isIOS('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 'iPhone', 5), true);
  assert.equal(isIOS('Mozilla/5.0 (iPad; CPU OS 12_0 like Mac OS X)', 'iPad', 5), true);
  assert.equal(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 'MacIntel', 5), true);
});

test('isIOS descarta Android y Mac de escritorio', () => {
  assert.equal(isIOS('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130.0', 'Linux armv8l', 5), false);
  assert.equal(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 'MacIntel', 0), false);
});

test('recentlyDismissed: el aviso vuelve recién a los 30 días', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 10, 2);
  assert.equal(recentlyDismissed(null, now), false);
  assert.equal(recentlyDismissed('basura', now), false);
  assert.equal(recentlyDismissed(String(now - 29 * day), now), true);
  assert.equal(recentlyDismissed(String(now - 31 * day), now), false);
});
