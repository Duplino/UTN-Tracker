// Corre con: node --test tests/js/
// Usa los mismos casos que tests/Unit/StatusCalculatorTest.php: si las dos
// implementaciones del cálculo de estado (PHP y JS) se desincronizan, falla una.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeStatus } from '../../public_html/assets/js/statusEngine.js';

const cases = JSON.parse(readFileSync(new URL('../fixtures/status-cases.json', import.meta.url), 'utf8'));

for (const c of cases) {
  test(`${c.scheme}: ${c.name}`, () => {
    assert.equal(computeStatus(c.config, c.partials, c.finals, c.checklist, c.override), c.expected);
  });
}
