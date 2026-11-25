// Tests de la versión de la app (assets/js/version.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePrNumber, sameCommit, formatVersion, compareVersions } from '../../public_html/assets/js/version.js';

test('parsePrNumber lee merges y squashes', () => {
  assert.equal(parsePrNumber('Merge pull request #81 from Duplino/claude/x\n\nNotas'), 81);
  assert.equal(parsePrNumber('Planificador: ofrecer solo las electivas elegidas (#77)'), 77);
  assert.equal(parsePrNumber('Arreglo directo en main'), null);
  assert.equal(parsePrNumber(''), null);
});

test('sameCommit acepta hashes cortos y largos', () => {
  assert.equal(sameCommit('c2f62ed842d3', 'c2f62ed842d30cc4459baf90fc1d782a1335ff77'), true);
  assert.equal(sameCommit('c2f62ed842d30cc4459baf90fc1d782a1335ff77', 'c2f62ed'), true);
  assert.equal(sameCommit('abc', 'c2f62ed'), false);
  assert.equal(sameCommit('', 'c2f62ed'), false);
});

test('formatVersion', () => {
  assert.equal(formatVersion({ version: '81', commit: 'c2f62ed842d3' }), 'Versión 81 (c2f62ed)');
  assert.equal(formatVersion({ version: 'dev', commit: '' }), 'Versión de desarrollo');
});

test('compareVersions distingue pestaña vieja, deploy pendiente y al día', () => {
  const v81 = { version: '81', commit: 'aaa111' };
  const v82 = { version: '82', commit: 'bbb222' };
  assert.equal(compareVersions(v81, v81, { sha: 'aaa111ffff', pr: 81 }).ok, true);
  assert.match(compareVersions(v81, v82, { sha: 'bbb222ffff', pr: 82 }).message, /recargá/);
  assert.match(compareVersions(v81, v81, { sha: 'bbb222ffff', pr: 82 }).message, /deploy/);
  assert.equal(compareVersions(v81, v81, null).ok, null);
  assert.equal(compareVersions(v81, null, null).ok, false);
});
