// Tests del conteo de escrituras de assets/js/apiClient.js, que syncFromServer()
// usa para no aplicar una respuesta de /bootstrap que salió antes de un guardado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { api, writeState, whenWritesIdle } from '../../public_html/assets/js/apiClient.js';

function stubFetch() {
  const pending = [];
  globalThis.fetch = (url, opts) => new Promise((resolve) => {
    pending.push(() => resolve(new Response(JSON.stringify({ ok: true, url, method: opts.method }), { status: 200 })));
  });
  return () => pending.shift()();
}

test('los GET no cuentan como escritura', async () => {
  const release = stubFetch();
  const start = writeState().started;
  const p = api.get('/bootstrap');
  assert.equal(writeState().pending, 0);
  release();
  await p;
  assert.equal(writeState().started, start);
});

test('una escritura se cuenta mientras está en vuelo y whenWritesIdle espera a que termine', async () => {
  const release = stubFetch();
  const start = writeState().started;
  const put = api.put('/enrollments/AM1/results', { partials: {} });
  assert.deepEqual(writeState(), { pending: 1, started: start + 1 });

  let idle = false;
  const waiting = whenWritesIdle().then(() => { idle = true; });
  await Promise.resolve();
  assert.equal(idle, false);

  release();
  await put;
  await waiting;
  assert.equal(idle, true);
  assert.equal(writeState().pending, 0);
});

test('una escritura que falla también libera el contador', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
  await assert.rejects(api.patch('/preferences', {}), (err) => err.status === 401);
  assert.equal(writeState().pending, 0);
  await whenWritesIdle();
});
