#!/usr/bin/env node
// Genera las páginas estáticas de cada carrera en site/carreras/ (plan de estudios y
// correlativas, indexables por Google) y el site/sitemap.xml.
//
// Lee el catálogo de tools/site/data/*.json, que es la respuesta tal cual de la API:
//   GET /api/careers                      -> careers.json
//   GET /api/careers/{code}/curriculum    -> {code}.json
//
// Uso:
//   node tools/site/build-careers.mjs                       # con los JSON guardados
//   node tools/site/build-careers.mjs --fetch https://app.utntracker.com.ar
//                                                           # baja el catálogo de nuevo y regenera
//
// Correrlo cada vez que cambien los seeds de carreras (database/migrations/) y commitear
// tanto los JSON como las páginas generadas. No hay build en Cloudflare Pages.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = join(ROOT, 'tools', 'site', 'data');
const SITE_DIR = join(ROOT, 'site');
const ORIGIN = 'https://utntracker.com.ar';
const APP_URL = 'https://app.utntracker.com.ar';

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

async function fetchCatalog(base) {
	const get = async (path) => {
		const res = await fetch(base.replace(/\/$/, '') + path);
		if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
		return res.json();
	};
	const list = await get('/api/careers');
	mkdirSync(DATA_DIR, { recursive: true });
	writeFileSync(join(DATA_DIR, 'careers.json'), JSON.stringify(list, null, 4) + '\n');
	for (const c of list.careers) {
		const cur = await get(`/api/careers/${encodeURIComponent(c.code)}/curriculum`);
		writeFileSync(join(DATA_DIR, `${c.code}.json`), JSON.stringify(cur, null, 4) + '\n');
	}
	console.log(`catálogo descargado de ${base}: ${list.careers.map(c => c.code).join(', ')}`);
}

function loadCatalog() {
	const list = JSON.parse(readFileSync(join(DATA_DIR, 'careers.json'), 'utf8')).careers;
	return list.map(c => ({ ...c, curriculum: JSON.parse(readFileSync(join(DATA_DIR, `${c.code}.json`), 'utf8')) }));
}

export function slugify(text) {
	return text
		.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// "Ingeniería en Sistemas de Información - K23" -> { title: "Ingeniería en Sistemas de Información", plan: "K23" }
export function splitName(name) {
	const m = name.match(/^(.*?)\s*-\s*([A-Z]\d{2})$/);
	return m ? { title: m[1], plan: m[2] } : { title: name, plan: '' };
}

// Nombre corto para títulos y búsquedas ("Ingeniería en Sistemas de Información" -> "Ingeniería en Sistemas").
function shortTitle(title) {
	return title.replace(/ de Información$/, '');
}

const KIND_LABEL = { pps: 'Práctica Profesional Supervisada', proyecto_final: 'Proyecto Final' };

export function buildModel(career) {
	const { title, plan } = splitName(career.name);
	const cur = career.curriculum;
	const levels = cur.modules.filter(m => m.render !== false && m.id !== 'electives');
	const electives = (cur.modules.find(m => m.id === 'electives') || { subjects: [] }).subjects;
	const all = [...levels.flatMap(m => m.subjects), ...electives];
	const byCode = new Map(all.map(s => [s.code, s]));

	// "Qué te habilita": la inversa de las correlativas para cursar.
	const unlocks = new Map(all.map(s => [s.code, []]));
	for (const s of all) {
		for (const r of s.requirements?.cursar || []) {
			if (unlocks.has(r.id) && !electives.includes(s)) unlocks.get(r.id).push(s.code);
		}
	}

	const electiveSlots = levels.reduce((n, m) => n + (m.electivas || 0), 0);
	const subjectCount = levels.reduce((n, m) => n + m.subjects.length, 0);
	const intermediate = cur.metadata.hasIntermediateTitle
		? levels.flatMap(m => m.subjects).filter(s => s.requiredForIntermediateTitle).map(s => s.code)
		: [];

	return {
		code: career.code, title, plan, short: shortTitle(title),
		slug: slugify(`${title} ${plan}`),
		intermediateTitle: cur.metadata.hasIntermediateTitle ? cur.metadata.intermediateTitle : null,
		levels, electives, byCode, unlocks, electiveSlots, subjectCount, intermediate,
	};
}

// ---------------------------------------------------------------------------
// HTML
// ---------------------------------------------------------------------------

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const anchor = (code) => 'm-' + slugify(code);
const jsonLd = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, '\t').replace(/</g, '\\u003c')}\n\t\t</script>`;

function listJoin(items) {
	if (items.length <= 1) return items.join('');
	return items.slice(0, -1).join(', ') + ' y ' + items[items.length - 1];
}

function head({ title, description, path, ogTitle, ldBlocks }) {
	return `<!doctype html>
<html lang="es-AR">
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<title>${esc(title)}</title>
		<meta name="description" content="${esc(description)}">
		<link rel="canonical" href="${ORIGIN}${path}">
		<meta name="color-scheme" content="light dark">
		<meta name="theme-color" content="#f8f9fa" media="(prefers-color-scheme: light)">
		<meta name="theme-color" content="#16191d" media="(prefers-color-scheme: dark)">
		<meta name="application-name" content="UTN Tracker">
		<meta property="og:type" content="website">
		<meta property="og:site_name" content="UTN Tracker">
		<meta property="og:locale" content="es_AR">
		<meta property="og:url" content="${ORIGIN}${path}">
		<meta property="og:title" content="${esc(ogTitle || title)}">
		<meta property="og:description" content="${esc(description)}">
		<meta property="og:image" content="${ORIGIN}/assets/img/og.png">
		<meta property="og:image:width" content="1200">
		<meta property="og:image:height" content="630">
		<meta name="twitter:card" content="summary_large_image">
		<script>
			(function(){var m=window.matchMedia('(prefers-color-scheme: dark)');function a(){document.documentElement.setAttribute('data-bs-theme',m.matches?'dark':'light');}a();try{m.addEventListener('change',a);}catch(e){}})();
		</script>
		<link href="/assets/lib/bootstrap/bootstrap.min.css" rel="stylesheet">
		<link href="/assets/lib/bootstrap-icons/bootstrap-icons.min.css" rel="stylesheet">
		<link href="/assets/css/site.css" rel="stylesheet">
		<link rel="icon" href="/favicon-32.png" type="image/png" sizes="32x32">
		<link rel="apple-touch-icon" href="/apple-touch-icon.png">
		<link rel="manifest" href="/site.webmanifest">
		${ldBlocks.map(jsonLd).join('\n\t\t')}
	</head>`;
}

function nav() {
	return `
		<header class="container site-nav d-flex align-items-center justify-content-between gap-3">
			<a class="app-brand d-flex align-items-center gap-2 text-decoration-none" href="/">
				<img src="/assets/img/logo.png" alt="" width="32" height="32">
				<span class="fw-semibold fs-5">UTN Tracker</span>
			</a>
			<nav class="d-flex align-items-center gap-1" aria-label="Secciones">
				<a class="btn btn-link link-secondary text-decoration-none d-none d-md-inline-block" href="/#funciones">Funciones</a>
				<a class="btn btn-link link-secondary text-decoration-none d-none d-md-inline-block" href="/carreras/">Carreras</a>
				<a class="btn btn-outline-primary" href="${APP_URL}">Entrar</a>
			</nav>
		</header>`;
}

function footer(models) {
	return `
		<footer class="site-footer">
			<div class="container d-grid gap-3 small text-body-secondary">
				<nav class="d-flex flex-wrap gap-3" aria-label="Planes de estudio">
					${models.map(m => `<a class="link-secondary" href="/carreras/${m.slug}/">Correlativas de ${esc(m.short)} (${esc(m.plan)})</a>`).join('\n\t\t\t\t\t')}
				</nav>
				<div class="d-flex flex-wrap justify-content-between gap-2">
					<span>UTN Tracker es un proyecto independiente, sin relación oficial con la Universidad Tecnológica Nacional.</span>
					<a class="link-secondary" href="https://github.com/Duplino/UTN-Tracker">Código en GitHub</a>
				</div>
			</div>
		</footer>
	</body>
</html>
`;
}

function breadcrumbs(items) {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: ORIGIN + path })),
	};
}

function breadcrumbNav(items) {
	return `<nav aria-label="Ruta" class="mb-3"><ol class="breadcrumb small mb-0">${items.map(([name, path], i) =>
		i === items.length - 1
			? `<li class="breadcrumb-item active" aria-current="page">${esc(name)}</li>`
			: `<li class="breadcrumb-item"><a href="${path}">${esc(name)}</a></li>`).join('')}</ol></nav>`;
}

function subjectLink(model, code) {
	const s = model.byCode.get(code);
	if (!s) return esc(code);
	return `<a href="#${anchor(code)}">${esc(s.name)}</a>`;
}

function requirementLine(model, s) {
	const reqs = s.requirements?.cursar || [];
	const reg = reqs.filter(r => r.type === 'regularizada').map(r => subjectLink(model, r.id));
	const apr = reqs.filter(r => r.type === 'aprobada').map(r => subjectLink(model, r.id));
	if (!reg.length && !apr.length) return '<p class="mb-0 text-body-secondary">Sin correlativas: se puede cursar desde el principio.</p>';
	const parts = [];
	if (reg.length) parts.push(`<dt>Regularizadas</dt><dd>${listJoin(reg)}</dd>`);
	if (apr.length) parts.push(`<dt>Aprobadas</dt><dd>${listJoin(apr)}</dd>`);
	return `<dl class="reqs mb-0">${parts.join('')}</dl>`;
}

function subjectCard(model, s, { elective = false } = {}) {
	const unlocks = elective ? [] : model.unlocks.get(s.code) || [];
	const kind = KIND_LABEL[s.kind];
	const badges = [
		s.weekHours ? `<span class="badge text-bg-secondary">${s.weekHours} hs semanales</span>` : '',
		`<span class="badge border text-body-secondary">${s.duration === 'anual' ? 'Anual' : 'Cuatrimestral'}</span>`,
		model.intermediate.includes(s.code) ? `<span class="badge bg-primary-subtle text-primary-emphasis border border-primary-subtle">Título intermedio</span>` : '',
	].filter(Boolean).join(' ');
	return `
							<article class="card subject-card" id="${anchor(s.code)}">
								<div class="card-body d-grid gap-2">
									<div class="d-flex flex-wrap align-items-baseline justify-content-between gap-2">
										<h4 class="h6 fw-semibold mb-0">${esc(s.name)}${kind && kind !== s.name ? ` <small class="text-body-secondary">(${esc(kind)})</small>` : ''}</h4>
										<span class="code">${esc(/^\d+$/.test(s.code) ? '' : s.code)}</span>
									</div>
									<div class="d-flex flex-wrap align-items-center gap-1">${badges}</div>
									<div><div class="small fw-semibold mb-1">Para cursarla necesitás</div>${requirementLine(model, s)}</div>
									${unlocks.length ? `<div class="small text-body-secondary"><i class="bi bi-unlock me-1" aria-hidden="true"></i>Es correlativa de ${listJoin(unlocks.map(c => subjectLink(model, c)))}</div>` : ''}
								</div>
							</article>`;
}

function careerPage(model, models) {
	const path = `/carreras/${model.slug}/`;
	const name = `${model.title} (Plan ${model.plan})`;
	const title = `Correlativas de ${model.short} ${model.plan} UTN · Plan de estudios | UTN Tracker`;
	const description = `Plan de estudios ${model.plan} de ${model.title} de la UTN: las ${model.subjectCount} materias por nivel, correlativas para cursar (regularizadas y aprobadas), horas semanales${model.intermediateTitle ? ' y materias del título intermedio' : ''}.`;
	const crumbs = [['Inicio', '/'], ['Carreras', '/carreras/'], [`${model.short} ${model.plan}`, path]];

	const faqs = [
		[`¿Cuántas materias tiene ${model.title} ${model.plan} en la UTN?`,
			`El plan ${model.plan} tiene ${model.subjectCount} materias y actividades obligatorias repartidas en ${model.levels.length} niveles${model.electiveSlots ? `, más ${model.electiveSlots} electivas` : ''}.`],
		...(model.intermediateTitle ? [[`¿Qué necesito para el título intermedio de ${model.intermediateTitle}?`,
			`Tener aprobadas ${model.intermediate.length} materias del plan: ${listJoin(model.intermediate.map(c => model.byCode.get(c)?.name || c))}.`]] : []),
		[`¿Cómo funcionan las correlativas en la UTN?`,
			`Para cursar una materia necesitás tener otras regularizadas (cursada aprobada, con el final pendiente) o aprobadas (con el final rendido). En esta página figura, para cada materia, cuáles necesitás de cada tipo.`],
		...(model.electives.length ? [[`¿Qué electivas hay en ${model.short} ${model.plan}?`,
			`Hay ${model.electives.length} electivas: ${listJoin(model.electives.map(s => s.name))}.`]] : []),
	];

	const ld = [
		breadcrumbs(crumbs),
		{
			'@context': 'https://schema.org',
			'@type': 'EducationalOccupationalProgram',
			name,
			url: ORIGIN + path,
			educationalCredentialAwarded: model.title,
			provider: { '@type': 'CollegeOrUniversity', name: 'Universidad Tecnológica Nacional', alternateName: 'UTN', url: 'https://www.utn.edu.ar' },
			hasCourse: model.levels.flatMap(m => m.subjects).filter(s => s.kind === 'materia').map(s => ({
				'@type': 'Course', name: s.name, ...(/^\d+$/.test(s.code) ? {} : { courseCode: s.code }), url: `${ORIGIN}${path}#${anchor(s.code)}`,
			})),
		},
		{
			'@context': 'https://schema.org',
			'@type': 'FAQPage',
			mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
		},
	];

	const levelsHtml = model.levels.map(m => `
					<section class="level" id="${slugify(m.name)}" aria-labelledby="${slugify(m.name)}-t">
						<div class="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
							<h3 class="h4 fw-bold mb-0" id="${slugify(m.name)}-t">${esc(m.name)}</h3>
							<span class="small text-body-secondary">${m.subjects.length} materias${m.electivas ? ` · ${m.electivas} electiva${m.electivas > 1 ? 's' : ''}` : ''}</span>
						</div>
						<div class="subject-grid">${m.subjects.map(s => subjectCard(model, s)).join('')}
						</div>
					</section>`).join('');

	const electivesHtml = model.electives.length ? `
					<section class="level" id="electivas" aria-labelledby="electivas-t">
						<div class="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-3">
							<h3 class="h4 fw-bold mb-0" id="electivas-t">Electivas</h3>
							<span class="small text-body-secondary">${model.electives.length} opciones · hay que hacer ${model.electiveSlots}</span>
						</div>
						<div class="subject-grid">${model.electives.map(s => subjectCard(model, s, { elective: true })).join('')}
						</div>
					</section>` : '';

	return `${head({ title, description, path, ogTitle: `Correlativas de ${model.title} ${model.plan} · UTN Tracker`, ldBlocks: ld })}
	<body>${nav()}

		<main class="container pb-5">
			${breadcrumbNav(crumbs)}
			<div class="row g-4 align-items-end mb-4">
				<div class="col-lg-8 d-grid gap-3">
					<span class="eyebrow">Plan de estudios ${esc(model.plan)} · UTN</span>
					<h1 class="page-title">Correlativas de ${esc(model.title)} (${esc(model.plan)})</h1>
					<p class="lead text-body-secondary mb-0">Todas las materias del plan ${esc(model.plan)} por nivel, con lo que necesitás tener regularizado o aprobado para cursar cada una, y qué materias te habilita.</p>
				</div>
				<div class="col-lg-4">
					<div class="card cta-card"><div class="card-body d-grid gap-2">
						<p class="mb-0 fw-semibold">¿Qué podés cursar el próximo cuatrimestre?</p>
						<p class="small text-body-secondary mb-0">Cargá tus notas y UTN Tracker te marca qué materias tenés habilitadas.</p>
						<a class="btn btn-primary" href="${APP_URL}"><i class="bi bi-google me-2" aria-hidden="true"></i>Entrar con Google</a>
					</div></div>
				</div>
			</div>

			<div class="facts mb-4">
				<div class="card"><div class="card-body"><div class="small text-body-secondary">Materias</div><div class="h5 mb-0">${model.subjectCount}</div></div></div>
				<div class="card"><div class="card-body"><div class="small text-body-secondary">Niveles</div><div class="h5 mb-0">${model.levels.length}</div></div></div>
				<div class="card"><div class="card-body"><div class="small text-body-secondary">Electivas</div><div class="h5 mb-0">${model.electiveSlots}</div></div></div>
				${model.intermediateTitle ? `<div class="card"><div class="card-body"><div class="small text-body-secondary">Título intermedio</div><div class="fw-semibold">${esc(model.intermediateTitle)}</div></div></div>` : ''}
			</div>

			<nav class="level-nav mb-4" aria-label="Niveles">
				${model.levels.map(m => `<a class="btn btn-sm btn-outline-secondary" href="#${slugify(m.name)}">${esc(m.name)}</a>`).join('\n\t\t\t\t')}
				${model.electives.length ? '<a class="btn btn-sm btn-outline-secondary" href="#electivas">Electivas</a>' : ''}
			</nav>

			<div class="d-grid gap-5">${levelsHtml}${electivesHtml}

				<section aria-labelledby="faq-t">
					<h2 class="h4 fw-bold mb-3" id="faq-t">Preguntas frecuentes</h2>
					<div class="faq">
						${faqs.map(([q, a], i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n\t\t\t\t\t\t')}
					</div>
				</section>

				<p class="small text-body-secondary mb-0">Correlativas según el plan cargado en UTN Tracker. Ante cualquier duda, consultá el plan oficial de tu facultad regional.</p>
			</div>
		</main>
${footer(models)}`;
}

function careersIndex(models) {
	const path = '/carreras/';
	const title = 'Planes de estudio y correlativas de la UTN | UTN Tracker';
	const description = `Correlativas y plan de estudios de las carreras de la UTN: ${listJoin(models.map(m => `${m.title} (${m.plan})`))}.`;
	const crumbs = [['Inicio', '/'], ['Carreras', path]];
	return `${head({ title, description, path, ldBlocks: [breadcrumbs(crumbs), {
		'@context': 'https://schema.org', '@type': 'ItemList',
		itemListElement: models.map((m, i) => ({ '@type': 'ListItem', position: i + 1, name: `${m.title} (${m.plan})`, url: `${ORIGIN}/carreras/${m.slug}/` })),
	}] })}
	<body>${nav()}

		<main class="container pb-5">
			${breadcrumbNav(crumbs)}
			<div class="d-grid gap-3 mb-4" style="max-width: 44rem">
				<span class="eyebrow">Carreras</span>
				<h1 class="page-title">Planes de estudio y correlativas de la UTN</h1>
				<p class="lead text-body-secondary mb-0">Elegí tu carrera para ver todas las materias por nivel y qué necesitás regularizado o aprobado para cursar cada una.</p>
			</div>
			<div class="row g-3">
				${models.map(m => `<div class="col-md-6">
					<a class="card career-card h-100 text-decoration-none" href="/carreras/${m.slug}/"><div class="card-body d-grid gap-2 align-content-start">
						<span><span class="badge text-bg-primary">${esc(m.plan)}</span></span>
						<h2 class="h5 fw-semibold mb-0 text-body">${esc(m.title)}</h2>
						<p class="text-body-secondary mb-0">${m.subjectCount} materias en ${m.levels.length} niveles${m.electiveSlots ? `, ${m.electiveSlots} electivas` : ''}${m.intermediateTitle ? `. Título intermedio: ${esc(m.intermediateTitle)}` : ''}.</p>
						<span class="small fw-semibold">Ver correlativas <i class="bi bi-arrow-right" aria-hidden="true"></i></span>
					</div></a>
				</div>`).join('\n\t\t\t\t')}
			</div>
		</main>
${footer(models)}`;
}

function sitemap(models) {
	const today = new Date().toISOString().slice(0, 10);
	const urls = ['/', '/carreras/', ...models.map(m => `/carreras/${m.slug}/`)];
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `	<url>\n		<loc>${ORIGIN}${u}</loc>\n		<lastmod>${today}</lastmod>\n	</url>`).join('\n')}
</urlset>
`;
}

// ---------------------------------------------------------------------------

async function main() {
	const i = process.argv.indexOf('--fetch');
	if (i !== -1) await fetchCatalog(process.argv[i + 1] || APP_URL);

	const models = loadCatalog().map(buildModel);
	const outDir = join(SITE_DIR, 'carreras');
	if (existsSync(outDir)) {
		for (const d of readdirSync(outDir)) rmSync(join(outDir, d), { recursive: true, force: true });
	}
	mkdirSync(outDir, { recursive: true });
	writeFileSync(join(outDir, 'index.html'), careersIndex(models));
	for (const m of models) {
		mkdirSync(join(outDir, m.slug), { recursive: true });
		writeFileSync(join(outDir, m.slug, 'index.html'), careerPage(m, models));
		console.log(`site/carreras/${m.slug}/index.html`);
	}
	writeFileSync(join(SITE_DIR, 'sitemap.xml'), sitemap(models));
	console.log('site/sitemap.xml');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch(e => { console.error(e); process.exit(1); });
}
