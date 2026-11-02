// Tests de la importación de la historia académica del SIU (assets/js/siuImport.js)
// y del lector de PDF (assets/js/pdfText.js). El PDF de prueba se arma acá mismo con
// la misma estructura que genera el SIU Guaraní (una celda por `x y Td (texto) Tj`,
// fuente Courier WinAnsi, contenido comprimido con FlateDecode), con datos inventados.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { extractPdfTextItems, textItemsFromContent } from '../../public_html/assets/js/pdfText.js';
import {
  applySubject, buildResults, matchSubjects, normalizeText, parseHistoriaAcademica,
  pickElectiveColumn, schemeFor, summarizeSubjects,
} from '../../public_html/assets/js/siuImport.js';

const COLS = [20.945, 359.109, 479.113, 605.177, 688.821];

function pdfString(str) {
  const bytes = Buffer.from(str, 'latin1');
  return '(' + bytes.toString('latin1').replace(/([()\\])/g, '\\$1') + ')';
}

function pageContent(rows, page, pages) {
  const lines = [];
  const cell = (x, y, text) => lines.push(`BT ${x.toFixed(3)} ${y.toFixed(3)} Td /F1 10.0 Tf  ${pdfString(text)} Tj ET`);
  cell(152, 541.45, 'HISTORIA ACADÉMICA');
  cell(282.945, 520.35, 'Propuesta: Ingeniería en Sistemas de Información');
  cell(321.945, 499.25, 'Alumno: ALUMNO DE PRUEBA');
  cell(384, 22, `${page} de ${pages}`);
  ['Actividad', 'Fecha', 'Tipo', 'Nota', 'Resultado'].forEach((h, i) => cell(COLS[i], 462.73, h));
  rows.forEach((r, idx) => {
    const y = 445.68 - idx * 14.55;
    r.forEach((v, i) => { if (v !== '') cell(COLS[i], y, v); });
  });
  return lines.join('\n');
}

// PDF 1.3 con una página por cada grupo de filas.
function buildPdf(rowsPerPage) {
  const objs = [];
  const add = (body) => { objs.push(body); return objs.length; };
  const catalog = add(null);
  const pagesObj = add(null);
  const font = add(Buffer.from('<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>', 'latin1'));
  const pageNums = [];
  rowsPerPage.forEach((rows, i) => {
    const data = deflateSync(Buffer.from(pageContent(rows, i + 1, rowsPerPage.length), 'latin1'));
    const content = add(Buffer.concat([
      Buffer.from(`<< /Filter /FlateDecode /Length ${data.length} >>\nstream\n`, 'latin1'), data, Buffer.from('\nendstream', 'latin1'),
    ]));
    pageNums.push(add(Buffer.from(`<< /Type /Page /Parent ${pagesObj} 0 R /Contents [${content} 0 R] >>`, 'latin1')));
  });
  objs[catalog - 1] = Buffer.from(`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`, 'latin1');
  objs[pagesObj - 1] = Buffer.from(`<< /Type /Pages /Kids [${pageNums.map(n => `${n} 0 R`).join(' ')}] /Count ${pageNums.length} /Resources << /Font << /F1 ${font} 0 R >> >> >>`, 'latin1');
  const parts = [Buffer.from('%PDF-1.3\n', 'latin1')];
  objs.forEach((body, i) => parts.push(Buffer.from(`${i + 1} 0 obj\n`, 'latin1'), body, Buffer.from('\nendobj\n', 'latin1')));
  parts.push(Buffer.from(`trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\n%%EOF\n`, 'latin1'));
  return new Uint8Array(Buffer.concat(parts));
}

const ROWS = [
  ['Álgebra y Geometría Analítica (950701)', '01/12/2025', 'Promocion', '8', 'Promocionado'],
  ['Álgebra y Geometría Analítica (950701)', '28/11/2025', 'Regularidad', '8', 'Aprobado'],
  ['Análisis de Sistemas de Información (232020)', '25/03/2026', 'En curso', '', ''],
  ['Análisis Matemático I (950702)', '29/07/2026', 'Examen', '6', 'Aprobado'],
  ['Análisis Matemático I (950702)', '20/02/2026', 'Examen', '2', 'Reprobado'],
  ['Análisis Matemático I (950702)', '28/11/2025', 'Regularidad', '6', 'Aprobado'],
  ['Física I (950605)', '05/08/2026', 'En curso', '', ''],
  ['Física I (950605)', '28/11/2025', 'Regularidad', '4', 'Reprobado'],
  ['Inglés Técnico Nivel II (951603)', '14/07/2026', 'Examen', '8', 'Aprobado'],
  ['Lógica y Estructuras Discretas (232010)', '28/11/2025', 'Regularidad', '7', 'Aprobado'],
  ['Química (950600)', '28/11/2024', 'Regularidad', '3', 'Reprobado'],
  ['Química (950600)', '28/11/2025', 'Regularidad', '', 'Ausente'],
];
const ROWS_PAGE_2 = [
  ['Sistemas y Procesos de Negocio (232011)', '28/11/2025', 'Promocion', '9', 'Promocionado'],
];

const SCHEME_2P = { partials: 2, tp: 0, labs: 0, promotion: { high_note: 8, high_count: 2, max_recovery: 1 }, regularization: { min_note: 6 }, approve: { min_note: 6 } };
const SCHEME_LIBRE = { partials: 0, approve: { min_note: 6 } };

async function parsedSample() {
  const items = await extractPdfTextItems(buildPdf([ROWS, ROWS_PAGE_2]));
  return parseHistoriaAcademica(items);
}

test('el lector de PDF saca el texto con su posición, con acentos y paréntesis escapados', async () => {
  const items = await extractPdfTextItems(buildPdf([ROWS, ROWS_PAGE_2]));
  const aga = items.find(i => i.str.startsWith('Álgebra'));
  assert.equal(aga.str, 'Álgebra y Geometría Analítica (950701)');
  assert.equal(aga.page, 1);
  assert.equal(aga.x, 20.95);
  assert.ok(items.some(i => i.page === 2 && i.str === 'Sistemas y Procesos de Negocio (232011)'));
});

test('interpreta TJ, T* y strings hex/octales', () => {
  const items = textItemsFromContent('BT 10 TL 5 100 Td [(Hola) -200 ( mundo)] TJ T* <4D61> Tj (\\341rbol) Tj ET');
  assert.deepEqual(items.map(i => [i.str, i.y]), [['Hola mundo', 100], ['Ma', 90], ['árbol', 90]]);
});

test('rechaza archivos que no son PDF o no son la historia académica', async () => {
  await assert.rejects(extractPdfTextItems(new TextEncoder().encode('hola')), /not_a_pdf/);
  assert.throws(() => parseHistoriaAcademica([{ page: 1, x: 0, y: 0, str: 'Otra cosa' }]), /not_historia_academica/);
});

test('arma las filas de la tabla en todas las páginas', async () => {
  const parsed = await parsedSample();
  assert.equal(parsed.career, 'Ingeniería en Sistemas de Información');
  assert.equal(parsed.student, 'ALUMNO DE PRUEBA');
  assert.equal(parsed.rows.length, ROWS.length + ROWS_PAGE_2.length);
  assert.deepEqual(
    { ...parsed.rows[0], page: undefined },
    { page: undefined, name: 'Álgebra y Geometría Analítica', siuCode: 950701, date: '2025-12-01', type: 'Promocion', grade: 8, gradeText: '8', result: 'Promocionado' },
  );
  const enCurso = parsed.rows.find(r => r.siuCode === 232020);
  assert.equal(enCurso.type, 'En curso');
  assert.equal(enCurso.grade, null);
  // el pie "1 de 2" no se confunde con una fila
  assert.ok(parsed.rows.every(r => r.siuCode));
});

test('resume cada materia según Regularidad / Examen / Promoción', async () => {
  const subjects = summarizeSubjects((await parsedSample()).rows);
  const by = Object.fromEntries(subjects.map(s => [s.siuCode, s]));

  // Promoción: aprobada por promoción con esa nota
  assert.equal(by[950701].status, 'Promocionada');
  assert.equal(by[950701].grade, 8);
  assert.equal(by[950701].enrollmentYear, 2025);

  // Examen aprobado: aprobada por final, la nota es la del examen; el aplazo queda como intento
  assert.equal(by[950702].status, 'Aprobada');
  assert.equal(by[950702].grade, 6);
  assert.equal(by[950702].regularGrade, 6);
  assert.deepEqual(by[950702].finals, [{ grade: 2, examDate: '2026-02-20' }, { grade: 6, examDate: '2026-07-29' }]);

  // Regularidad reprobada = una recursada; la vuelve a cursar ahora
  assert.equal(by[950605].status, 'En curso');
  assert.equal(by[950605].retakes, 1);
  assert.equal(by[950605].enrollmentYear, 2026);

  // Solo final (sin cursada): aprobada igual
  assert.equal(by[951603].status, 'Aprobada');
  assert.equal(by[951603].regularGrade, null);

  // Regularizada sin final
  assert.equal(by[232010].status, 'Regularizada');
  assert.equal(by[232010].regularGrade, 7);

  // Solo cursadas no aprobadas: no queda inscripta, suma recursadas
  assert.equal(by[950600].status, null);
  assert.equal(by[950600].retakes, 2);

  assert.equal(by[232020].status, 'En curso');
  assert.equal(by[232011].status, 'Promocionada');
});

test('las notas cargadas reproducen el estado del SIU (con override solo si hace falta)', () => {
  const promo = buildResults({ status: 'Promocionada', grade: 9, regularGrade: 9, finals: [] }, SCHEME_2P);
  assert.deepEqual(promo.partials, { 1: { 1: 9, 2: null, 3: null }, 2: { 1: 9, 2: null, 3: null } });
  assert.equal(promo.override, null);

  const aprobada = buildResults({ status: 'Aprobada', grade: 6, regularGrade: 6, finals: [{ grade: 2, examDate: '2026-02-20' }, { grade: 6, examDate: '2026-07-29' }] }, SCHEME_2P);
  assert.deepEqual(aprobada.finals, { 1: { grade: 2, examDate: '2026-02-20' }, 2: { grade: 6, examDate: '2026-07-29' } });
  assert.equal(aprobada.override, null);

  // cursada con 8 + final: el esquema la daría por promocionada, el SIU dice aprobada por final
  assert.equal(buildResults({ status: 'Aprobada', grade: 7, regularGrade: 8, finals: [{ grade: 7, examDate: '2026-07-01' }] }, SCHEME_2P).override, 'Aprobada');
  // regularizada con 9: el esquema promocionaría
  assert.equal(buildResults({ status: 'Regularizada', grade: null, regularGrade: 9, finals: [] }, SCHEME_2P).override, 'Regularizada');
  assert.equal(buildResults({ status: 'Regularizada', grade: null, regularGrade: 7, finals: [] }, SCHEME_2P).override, null);
  // solo final, con esquema libre: sale sola
  assert.equal(buildResults({ status: 'Aprobada', grade: 8, regularGrade: null, finals: [{ grade: 8, examDate: '2026-07-14' }] }, SCHEME_LIBRE).override, null);
  // TP/labs se marcan como hechos
  assert.deepEqual(buildResults({ status: 'Regularizada', regularGrade: 7, finals: [] }, { ...SCHEME_2P, labs: 2, labs_required_for: ['regularization'] }).checklist, { lab: { 1: true, 2: true } });

  assert.equal(buildResults({ status: 'En curso' }, SCHEME_2P), null);
});

test('elige el esquema: libre si solo hay final', () => {
  const schemes = [{ code: '2-partials' }, { code: 'libre' }];
  assert.equal(schemeFor({ status: 'Aprobada', regularGrade: null }, schemes), 'libre');
  assert.equal(schemeFor({ status: 'Aprobada', regularGrade: 6 }, schemes), '2-partials');
  assert.equal(schemeFor({ status: 'En curso', regularGrade: null }, schemes), '2-partials');
});

const curriculum = {
  modules: [
    { id: 'g1', name: 'Primer Nivel', electivas: 0, subjects: [
      { code: 'AGA', siuCode: 950701, name: 'Álgebra y Geometría Analítica' },
      { code: 'AM1', name: 'Análisis Matemático I' }, // copia vieja del curriculum, sin siuCode
    ] },
    { id: 'g3', name: 'Tercer Nivel', electivas: 1, subjects: [] },
    { id: 'g4', name: 'Cuarto Nivel', electivas: 2, subjects: [] },
    { id: 'electives', name: 'Electivas', render: false, subjects: [{ code: 'ELEC', siuCode: 123456, name: 'Una Electiva' }] },
  ],
};

test('reconoce las materias por código del SIU o por nombre', () => {
  const { matched, unmatched } = matchSubjects([
    { siuCode: 950701, name: 'Algebra (otro nombre)' },
    { siuCode: 999, name: 'ANALISIS MATEMATICO I' },
    { siuCode: 123456, name: 'Una Electiva' },
    { siuCode: 1, name: 'Química' },
  ], curriculum);
  assert.deepEqual(matched.map(m => [m.code, m.isElective]), [['AGA', false], ['AM1', false], ['ELEC', true]]);
  assert.deepEqual(unmatched.map(u => u.name), ['Química']);
  assert.equal(normalizeText('  Análisis   Matemático-I '), 'analisis matematico i');
});

test('coloca las electivas en la primera columna con lugar libre', () => {
  assert.equal(pickElectiveColumn(curriculum, []), 1);
  assert.equal(pickElectiveColumn(curriculum, [1]), 2);
  assert.equal(pickElectiveColumn(curriculum, [1, 2]), 2);
  assert.equal(pickElectiveColumn(curriculum, [1, 2, 2]), 2);
});

function fakeStore(configs = { '2-partials': SCHEME_2P, libre: SCHEME_LIBRE }) {
  const calls = [];
  const enrollments = {};
  return {
    calls,
    enrollments,
    async createEnrollment(code, scheme) { calls.push(['create', code, scheme]); enrollments[code] = { subjectCode: code, schemeConfig: configs[scheme] }; return enrollments[code]; },
    async updateEnrollmentSettings(code, s) { calls.push(['settings', code, s]); return enrollments[code]; },
    async saveResults(code, r) { calls.push(['results', code, r]); return enrollments[code]; },
    async setOverride(code, st) { calls.push(['override', code, st]); return enrollments[code]; },
    async setRecursedCount(code, n) { calls.push(['retakes', code, n]); },
  };
}
const SCHEMES = [{ code: '2-partials' }, { code: 'libre' }];

test('aplica una materia con el store: inscripción, año, notas y override', async () => {
  const store = fakeStore();
  await applySubject(store, { code: 'AM1', status: 'Aprobada', grade: 7, regularGrade: 8, enrollmentYear: 2025, retakes: 0, finals: [{ grade: 7, examDate: '2026-07-01' }] }, { schemes: SCHEMES });
  assert.deepEqual(store.calls.map(c => c[0]), ['create', 'settings', 'results', 'override']);
  assert.deepEqual(store.calls[1][2], { enrollmentYear: 2025 });
  assert.equal(store.calls[3][2], 'Aprobada');
});

test('en curso con recursadas: se inscribe sin notas y actualiza el contador', async () => {
  const store = fakeStore();
  await applySubject(store, { code: 'F1', status: 'En curso', enrollmentYear: 2026, retakes: 1, finals: [] }, { schemes: SCHEMES });
  assert.deepEqual(store.calls.map(c => c[0]), ['create', 'settings', 'retakes']);
  assert.deepEqual(store.calls[2], ['retakes', 'F1', 1]);
});

test('solo recursadas: no se inscribe, y no baja un contador más alto', async () => {
  const store = fakeStore();
  await applySubject(store, { code: 'QUI', status: null, retakes: 2, finals: [] }, { schemes: SCHEMES });
  assert.deepEqual(store.calls, [['retakes', 'QUI', 2]]);
  const store2 = fakeStore();
  await applySubject(store2, { code: 'QUI', status: null, retakes: 2, finals: [] }, { schemes: SCHEMES, currentRetakes: 3 });
  assert.deepEqual(store2.calls, []);
});

test('si ya estaba cargada, reusa la inscripción y pisa las notas', async () => {
  const store = fakeStore();
  const existing = { subjectCode: 'AGA', schemeConfig: SCHEME_2P };
  store.enrollments.AGA = existing;
  await applySubject(store, { code: 'AGA', status: 'Promocionada', grade: 8, regularGrade: 8, enrollmentYear: 2025, retakes: 0, finals: [] }, { existing, schemes: SCHEMES });
  assert.deepEqual(store.calls.map(c => c[0]), ['settings', 'results']);
});
