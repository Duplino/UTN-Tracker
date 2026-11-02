// Tema claro / oscuro / automático (sigue al sistema). El tema inicial lo aplica un
// <script> inline en el <head> antes del primer pintado; este módulo solo maneja el
// selector de Configuración y los cambios del sistema en modo automático.

const KEY = 'utn.theme';
const ICONS = { light: 'bi-sun', dark: 'bi-moon-stars', auto: 'bi-circle-half' };
const media = window.matchMedia('(prefers-color-scheme: dark)');

function storedTheme() {
  try { return localStorage.getItem(KEY) || 'auto'; } catch (e) { return 'auto'; }
}

function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'auto' && media.matches);
  document.documentElement.setAttribute('data-bs-theme', dark ? 'dark' : 'light');
  // Barra del navegador / de la app instalada con el mismo fondo que la página.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#16191d' : '#f8f9fa';

  document.querySelectorAll('[data-theme-value]').forEach((btn) => {
    const active = btn.dataset.themeValue === theme;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  const icon = document.getElementById('theme-icon');
  if (icon) icon.className = `bi ${ICONS[theme] || ICONS.auto}`;
}

export function initThemeToggle() {
  applyTheme(storedTheme());
  document.querySelectorAll('[data-theme-value]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const theme = btn.dataset.themeValue;
      try { localStorage.setItem(KEY, theme); } catch (e) { /* ignore */ }
      applyTheme(theme);
    });
  });
  media.addEventListener('change', () => {
    if (storedTheme() === 'auto') applyTheme('auto');
  });
}
