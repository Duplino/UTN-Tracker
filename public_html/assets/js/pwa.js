// App instalable (PWA): registra el service worker (/sw.js) y ofrece instalarla.
//
// - Android / Chrome / Edge: el navegador avisa con `beforeinstallprompt` que se puede
//   instalar. Guardamos ese evento y lo disparamos desde nuestro botón "Instalar".
// - iPhone / iPad: Safari no tiene ese evento; solo se instala a mano desde el menú
//   Compartir → "Agregar a inicio", así que mostramos esas instrucciones.
//
// El aviso (#pwa-install-banner) sale solo en celular/tablet, desde la segunda visita
// (la primera ya tiene el onboarding), nunca encima de un modal, y si lo cierran no
// vuelve por 30 días. En Configuración queda siempre el botón para instalarla.

const DISMISS_KEY = 'utn.pwa.installDismissedAt';
const VISITS_KEY = 'utn.pwa.visits';
const DISMISS_DAYS = 30;
const SHOW_DELAY_MS = 4000;

let deferredPrompt = null;
let bannerScheduled = false;

export function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

export function isIOS(ua = navigator.userAgent, platform = navigator.platform, touchPoints = navigator.maxTouchPoints) {
  // iPadOS se presenta como Mac de escritorio; lo delata la pantalla táctil.
  return /iphone|ipad|ipod/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
}

function isTouchDevice() {
  return window.matchMedia('(pointer: coarse)').matches;
}

function read(key) {
  try { return localStorage.getItem(key); } catch (e) { return null; }
}

function write(key, value) {
  try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
}

export function recentlyDismissed(dismissedAt, now = Date.now()) {
  const t = Number(dismissedAt);
  return Number.isFinite(t) && t > 0 && now - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  // Solo en HTTPS (o localhost): en otro origen el navegador lo rechaza igual.
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((e) => console.warn('No se pudo registrar el service worker', e));
  });
}

// ---- UI ----

function el(id) {
  return document.getElementById(id);
}

function setMode(mode) {
  // mode: 'prompt' (botón Instalar) o 'ios' (instrucciones manuales).
  document.querySelectorAll('[data-pwa-mode]').forEach((node) => {
    node.classList.toggle('d-none', node.dataset.pwaMode !== mode);
  });
}

function hideBanner() {
  el('pwa-install-banner')?.classList.add('d-none');
}

function showBanner(mode) {
  const banner = el('pwa-install-banner');
  if (!banner) return;
  setMode(mode);
  banner.classList.remove('d-none');
}

function syncSettings() {
  const wrap = el('settings-install-wrap');
  if (!wrap) return;
  const ios = isIOS() && !isStandalone();
  wrap.classList.toggle('d-none', !(deferredPrompt || ios));
  el('settings-install-btn')?.classList.toggle('d-none', !deferredPrompt);
  el('settings-install-ios')?.classList.toggle('d-none', !ios || !!deferredPrompt);
}

function dismiss() {
  write(DISMISS_KEY, String(Date.now()));
  hideBanner();
}

async function promptInstall() {
  if (!deferredPrompt) return;
  const evt = deferredPrompt;
  deferredPrompt = null; // el evento se puede usar una sola vez
  hideBanner();
  evt.prompt();
  const { outcome } = await evt.userChoice;
  if (outcome === 'dismissed') write(DISMISS_KEY, String(Date.now()));
  syncSettings();
}

// Espera a que no haya ningún modal abierto (onboarding, importar, etc.).
function whenNoModal(fn) {
  if (!document.querySelector('.modal.show')) { fn(); return; }
  document.addEventListener('hidden.bs.modal', () => setTimeout(() => whenNoModal(fn), 800), { once: true });
}

function scheduleBanner(mode) {
  if (bannerScheduled) return;
  if (!isTouchDevice() || isStandalone()) return;
  if (recentlyDismissed(read(DISMISS_KEY))) return;
  if (Number(read(VISITS_KEY)) < 2) return;
  bannerScheduled = true;
  setTimeout(() => whenNoModal(() => {
    if (mode === 'prompt' && !deferredPrompt) return; // se instaló o se usó mientras tanto
    showBanner(mode);
  }), SHOW_DELAY_MS);
}

export function initPwa() {
  registerServiceWorker();
  if (isStandalone()) return; // ya está instalada: nada que ofrecer

  write(VISITS_KEY, String(Number(read(VISITS_KEY) || 0) + 1));

  document.querySelectorAll('[data-pwa-install]').forEach((b) => b.addEventListener('click', promptInstall));
  document.querySelectorAll('[data-pwa-dismiss]').forEach((b) => b.addEventListener('click', dismiss));
  el('settings-install-btn')?.addEventListener('click', () => {
    // Cierra Configuración para que el diálogo del navegador no quede detrás.
    const modal = el('settingsModal');
    if (modal && window.bootstrap) window.bootstrap.Modal.getInstance(modal)?.hide();
    promptInstall();
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // en vez de la mini barra de Chrome, usamos nuestro aviso
    deferredPrompt = e;
    syncSettings();
    scheduleBanner('prompt');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideBanner();
    syncSettings();
  });

  if (isIOS()) scheduleBanner('ios');
  syncSettings();
}
