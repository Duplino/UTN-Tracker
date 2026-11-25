// Versión de la app: el número del último PR mergeado a main (más el commit exacto).
//
// - bin/deploy.sh la calcula con git en el VPS y la pasa al build de Docker;
//   docker/version-assets.php la escribe en <meta name="app-version"> de index.html y
//   en /version.json. En desarrollo (sin build) queda "dev".
// - La página abierta sabe con qué versión cargó (la meta); /version.json dice qué
//   tiene el servidor ahora (no lo cachea ni Apache ni el service worker). Si
//   difieren, esta pestaña (o la PWA instalada) quedó vieja y hay que recargar.
//
// Desde la consola del navegador:
//   APP_VERSION            versión con la que cargó esta pestaña
//   await utnVersion()     compara pestaña, servidor y el último commit de main en GitHub

export const REPO = 'Duplino/UTN-Tracker';

export function readLoadedVersion(doc = document) {
  const meta = doc.querySelector('meta[name="app-version"]');
  return {
    version: meta?.getAttribute('content') || 'dev',
    commit: meta?.getAttribute('data-commit') || '',
  };
}

// "Merge pull request #81 from ..." (merge) o "Título (#77)" (squash) -> 81 / 77.
export function parsePrNumber(message) {
  const first = String(message || '').split('\n', 1)[0];
  const m = first.match(/^Merge pull request #(\d+)/) || first.match(/\(#(\d+)\)\s*$/);
  return m ? Number(m[1]) : null;
}

export function sameCommit(a, b) {
  if (!a || !b) return false;
  return a.length <= b.length ? b.startsWith(a) : a.startsWith(b);
}

export function formatVersion({ version, commit }) {
  if (!version || version === 'dev') return 'Versión de desarrollo';
  return `Versión ${version}` + (commit ? ` (${commit.slice(0, 7)})` : '');
}

// loaded/server: { version, commit } | null. main: { sha, pr } | null.
export function compareVersions(loaded, server, main) {
  if (!server) return { ok: false, message: 'No se pudo leer /version.json del servidor.' };
  if (!server.commit) return { ok: false, message: 'El servidor corre una versión de desarrollo (sin commit).' };
  if (loaded && !sameCommit(loaded.commit, server.commit)) {
    return { ok: false, message: `Esta pestaña cargó la versión ${loaded.version} pero el servidor ya tiene la ${server.version}: recargá la página.` };
  }
  if (!main) return { ok: null, message: `Servidor y pestaña en la versión ${server.version}. No se pudo consultar GitHub para compararla con main.` };
  if (!sameCommit(server.commit, main.sha)) {
    return { ok: false, message: `El servidor tiene la versión ${server.version} pero main ya va por ${main.pr ?? main.sha.slice(0, 7)}: el deploy está pendiente o falló (ver Actions > Deploy).` };
  }
  return { ok: true, message: `Al día: versión ${server.version}, el último commit de main.` };
}

export async function fetchServerVersion() {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

export async function fetchMainHead() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/commits/main`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const data = await res.json();
    return { sha: data.sha, pr: parsePrNumber(data.commit?.message) };
  } catch (e) {
    return null;
  }
}

// Para la consola: `await utnVersion()`.
export async function checkVersion() {
  const loaded = readLoadedVersion();
  const [server, main] = await Promise.all([fetchServerVersion(), fetchMainHead()]);
  const result = compareVersions(loaded, server, main);
  console.table({
    'Esta pestaña': { version: loaded.version, commit: loaded.commit || '-' },
    'Servidor (/version.json)': { version: server?.version ?? '?', commit: server?.commit || '-' },
    'GitHub (main)': { version: main?.pr ?? '?', commit: main?.sha?.slice(0, 12) ?? '?' },
  });
  (result.ok ? console.info : console.warn)(result.message);
  return { ...result, loaded, server, main };
}

export function initVersion() {
  const loaded = readLoadedVersion();
  window.APP_VERSION = loaded.version;
  window.utnVersion = checkVersion;

  const label = document.getElementById('settings-version');
  const reload = document.getElementById('settings-version-reload');
  if (label) label.textContent = formatVersion(loaded);
  reload?.addEventListener('click', () => location.reload());

  // Al abrir Configuración, si el servidor ya tiene otra versión, ofrece recargar.
  document.getElementById('settingsModal')?.addEventListener('show.bs.modal', async () => {
    if (!loaded.commit || !reload) return;
    const server = await fetchServerVersion();
    reload.classList.toggle('d-none', !server?.commit || sameCommit(loaded.commit, server.commit));
  });
}
