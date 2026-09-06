// Autenticación con Google Identity Services (GIS), reemplazo del SDK de Firebase Auth.
// La sesión real la maneja el backend por cookie (ver apiClient.js); acá solo obtenemos
// el id_token de Google y se lo mandamos una vez a POST /api/auth/google.

import { api, ApiError } from './apiClient.js';
import { localGuestStore } from './localGuestStore.js';

// TODO(usuario): completar con el Client ID real de Google Cloud Console
// (APIs & Services -> Credentials -> OAuth 2.0 Client IDs -> tipo "Web application").
// Sin esto el botón de Google no va a funcionar.
export const GOOGLE_CLIENT_ID = '791264678302-rfpc1qgq84g80eqlij67vt8ifjkdqf8u.apps.googleusercontent.com';

let wired = false;
let currentUser = null;

function waitForGoogleIdentity(timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (window.google && window.google.accounts && window.google.accounts.id) {
        resolve(window.google.accounts.id);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error('google_identity_services_not_loaded'));
        return;
      }
      setTimeout(poll, 100);
    })();
  });
}

function showSigninSection() {
  const signin = document.getElementById('profile-signin');
  const user = document.getElementById('profile-user');
  if (signin) signin.classList.remove('d-none');
  if (user) user.classList.add('d-none');
}

function showUserSection(user) {
  const signin = document.getElementById('profile-signin');
  const userSection = document.getElementById('profile-user');
  const nameEl = document.getElementById('profile-user-name');
  const emailEl = document.getElementById('profile-user-email');
  if (nameEl) nameEl.textContent = (user && user.name) || 'Usuario';
  if (emailEl) emailEl.textContent = (user && user.email) || '';
  if (userSection) userSection.classList.remove('d-none');
  if (signin) signin.classList.add('d-none');
  const shareToggle = document.getElementById('settings-share-toggle');
  if (shareToggle) shareToggle.disabled = false;
}

async function buildGuestSnapshot() {
  try {
    return await localGuestStore.getEnrollments();
  } catch (e) {
    console.error('Error leyendo datos locales de invitado para importar', e);
    return [];
  }
}

// Inicializa el flujo de auth. Debe llamarse una sola vez al cargar la página.
// `initialUser`: usuario ya detectado por index.js vía GET /auth/me (o null).
// `onLoginSuccess(user)`: index.js debe cambiar el store activo a apiStore y re-renderizar.
// `onLogout()`: index.js debe cambiar el store activo a localGuestStore y re-renderizar.
export function initAuth({ initialUser = null, mockAuthEnabled = false, onLoginSuccess, onLogout } = {}) {
  currentUser = initialUser || null;

  if (currentUser) {
    showUserSection(currentUser);
  } else {
    showSigninSection();
    const shareToggle = document.getElementById('settings-share-toggle');
    if (shareToggle) shareToggle.disabled = true;
  }

  // Cola común a cualquier flujo de login exitoso (Google o mock): importa
  // progreso de invitado si había, y avisa a index.js para que recargue con apiStore.
  async function finishLogin(user) {
    currentUser = user || null;

    const snapshot = await buildGuestSnapshot();
    if (snapshot.length > 0) {
      try {
        await api.post('/auth/import-local', { enrollments: snapshot });
      } catch (e) {
        console.error('Error importando datos locales al backend', e);
      }
    }

    showUserSection(currentUser);
    if (typeof onLoginSuccess === 'function') await onLoginSuccess(currentUser);
  }

  async function handleCredentialResponse(response) {
    try {
      const idToken = response && response.credential;
      if (!idToken) throw new Error('missing_credential');
      const result = await api.post('/auth/google', { id_token: idToken });
      await finishLogin(result && result.user ? result.user : null);
    } catch (err) {
      console.error('Google sign-in error', err);
      alert('Error al iniciar sesión con Google: ' + (err && err.message ? err.message : err));
    }
  }

  async function handleMockLogin() {
    try {
      const result = await api.post('/auth/mock-login');
      await finishLogin(result && result.user ? result.user : null);
    } catch (err) {
      console.error('Mock sign-in error', err);
      alert('Error al iniciar sesión con el usuario de prueba: ' + (err && err.message ? err.message : err));
    }
  }

  if (!wired) {
    wired = true;

    // Render del botón oficial de Google dentro del contenedor (reemplaza el botón custom).
    waitForGoogleIdentity()
      .then((gsi) => {
        if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'PENDIENTE_CONFIGURAR') {
          console.warn('GOOGLE_CLIENT_ID no configurado todavía (ver assets/js/auth.js). El login con Google no va a funcionar hasta completarlo.');
        }
        gsi.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });
        const container = document.getElementById('google-signin-btn');
        if (container) {
          gsi.renderButton(container, { theme: 'outline', size: 'large', text: 'continue_with', width: 280 });
        }
      })
      .catch((err) => {
        console.error('No se pudo inicializar Google Identity Services', err);
      });

    const mockSigninBtn = document.getElementById('mock-signin-btn');
    if (mockSigninBtn) {
      if (mockAuthEnabled) {
        mockSigninBtn.classList.remove('d-none');
        mockSigninBtn.addEventListener('click', handleMockLogin);
      } else {
        mockSigninBtn.classList.add('d-none');
      }
    }

    const signoutBtn = document.getElementById('profile-signout-btn');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', async () => {
        try {
          await api.post('/auth/logout');
        } catch (e) {
          if (!(e instanceof ApiError)) console.error('Error cerrando sesión', e);
        }
        currentUser = null;
        showSigninSection();
        const shareToggle = document.getElementById('settings-share-toggle');
        if (shareToggle) { shareToggle.checked = false; shareToggle.disabled = true; }
        if (typeof onLogout === 'function') await onLogout();
      });
    }

    const syncBtn = document.getElementById('profile-sync-btn');
    if (syncBtn) {
      syncBtn.addEventListener('click', async () => {
        if (!currentUser) return;
        try {
          if (typeof onLoginSuccess === 'function') await onLoginSuccess(currentUser);
        } catch (e) {
          console.error('Error sincronizando', e);
        }
      });
    }
  }

  return {
    getCurrentUser: () => currentUser,
  };
}
