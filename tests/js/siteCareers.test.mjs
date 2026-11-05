// Generador de las páginas de carreras de la landing (tools/site/build-careers.mjs).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { slugify, splitName, buildModel } from '../../tools/site/build-careers.mjs';

const load = (code) => JSON.parse(readFileSync(new URL(`../../tools/site/data/${code}.json`, import.meta.url), 'utf8'));

test('slugify saca tildes y símbolos', () => {
	assert.equal(slugify('Ingeniería en Sistemas de Información K23'), 'ingenieria-en-sistemas-de-informacion-k23');
});

test('splitName separa el plan del nombre', () => {
	assert.deepEqual(splitName('Ingeniería Mecánica - S23'), { title: 'Ingeniería Mecánica', plan: 'S23' });
	assert.deepEqual(splitName('Otra carrera'), { title: 'Otra carrera', plan: '' });
});

test('"Es correlativa de" es la inversa de las correlativas para cursar', () => {
	const m = buildModel({ code: 'sistemas', name: 'Ingeniería en Sistemas de Información - K23', curriculum: load('sistemas') });
	assert.equal(m.slug, 'ingenieria-en-sistemas-de-informacion-k23');
	for (const s of m.levels.flatMap(l => l.subjects)) {
		for (const r of s.requirements.cursar) {
			assert.ok(m.unlocks.get(r.id).includes(s.code), `${r.id} debería habilitar ${s.code}`);
		}
	}
	// Las electivas no se listan como "habilitadas" por cada materia.
	assert.ok(!m.unlocks.get('ASI').some(c => m.electives.some(e => e.code === c)));
});
