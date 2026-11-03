// Rutas con hash para los modales grandes (agenda, horario, planificador, etc.).
//
// La app sigue siendo una sola página: cada vista grande es un modal de Bootstrap.
// Este módulo solo sincroniza esos modales con la URL:
//   - Abrir el modal agrega `#agenda` (o la ruta que sea) al historial.
//   - El botón atrás (navegador, Android, PWA instalada) cierra el modal en vez de
//     salir de la app.
//   - Entrar a `/#horario` abre el horario directo, así los links se pueden compartir.
//   - Cerrar el modal con la X o Escape saca el hash (volviendo una entrada en el
//     historial si la agregamos nosotros, para no dejar entradas repetidas).
//
// Los modales chicos (perfil, configuración, confirmaciones, la materia) no tienen
// ruta y siguen igual.

export const ROUTES = {
  agenda: 'agendaModal',
  horario: 'scheduleModal',
  planificador: 'plannerModal',
  juntos: 'togetherModal',
  estadisticas: 'statsModal',
};

const MODAL_TO_ROUTE = Object.fromEntries(Object.entries(ROUTES).map(([route, id]) => [id, route]));

// '#agenda' -> 'agenda'; cualquier otra cosa (vacío, '#', rutas desconocidas) -> null.
export function routeFromHash(hash) {
  const name = decodeURIComponent(String(hash || '').replace(/^#\/?/, '')).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ROUTES, name) ? name : null;
}

export function routeForModal(id) {
  return MODAL_TO_ROUTE[id] || null;
}

// Arranca el router. Devuelve openFromUrl(), que abre el modal de un link directo:
// se llama cuando la app ya dibujó el tablero, así abre con los datos cargados.
export function initRouter() {
  if (!window.bootstrap || !window.history || !history.pushState) return { openFromUrl() {} };

  let current = null;      // ruta del modal abierto (o null)
  let pushed = false;      // si la entrada del historial de `current` la agregamos nosotros
  let pendingBack = false; // history.back() en curso (al cerrar con la X)
  let queuedPush = null;   // ruta a agregar cuando termine ese back()

  const urlWithout = () => location.pathname + location.search;
  const modalEl = route => document.getElementById(ROUTES[route]);
  const instance = el => bootstrap.Modal.getOrCreateInstance(el);

  function push(route) {
    history.pushState({ utnModal: route }, '', '#' + route);
    pushed = true;
  }

  document.addEventListener('show.bs.modal', (e) => {
    const route = routeForModal(e.target.id);
    if (!route) return;
    current = route;
    if (routeFromHash(location.hash) === route) {
      // Abierto desde la URL: si la entrada es nuestra (adelante/atrás), hay a dónde
      // volver; si es un link directo, no.
      pushed = !!(history.state && history.state.utnModal === route);
      return;
    }
    if (pendingBack) { queuedPush = route; return; }
    // Si se pasa de una vista a otra sin cerrar (ej. onboarding -> horario), se
    // reemplaza la entrada en vez de apilar una nueva.
    if (routeFromHash(location.hash)) {
      history.replaceState({ utnModal: route }, '', '#' + route);
    } else {
      push(route);
    }
  });

  document.addEventListener('hidden.bs.modal', (e) => {
    const route = routeForModal(e.target.id);
    if (!route || route !== current) return;
    current = null;
    if (queuedPush === route) queuedPush = null;
    // Si el hash ya no es el del modal, lo cerró el botón atrás: no hay nada que hacer.
    if (routeFromHash(location.hash) !== route) return;
    if (pushed) {
      pushed = false;
      pendingBack = true;
      history.back();
    } else {
      // Entró por un link directo: no hay a dónde volver dentro de la app.
      history.replaceState(null, '', urlWithout());
    }
  });

  window.addEventListener('popstate', () => {
    if (pendingBack) {
      pendingBack = false;
      if (queuedPush && queuedPush === current) push(queuedPush);
      queuedPush = null;
      return;
    }
    const target = routeFromHash(location.hash);
    if (current && current !== target) {
      // Atrás con un modal abierto: se cierra todo lo que haya encima (una
      // confirmación cuenta como "Cancelar").
      document.querySelectorAll('.modal.show').forEach(el => {
        const inst = bootstrap.Modal.getInstance(el);
        if (inst) inst.hide();
      });
    }
    if (target && target !== current) {
      const el = modalEl(target);
      if (el) instance(el).show();
    }
  });

  return {
    // Link directo (`/#agenda`).
    openFromUrl() {
      const initial = routeFromHash(location.hash);
      if (!initial || current) return;
      const el = modalEl(initial);
      if (el) instance(el).show();
    },
  };
}
