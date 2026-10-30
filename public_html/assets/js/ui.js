// Feedback de UI compartido: toasts (en vez de alert()), diálogo de confirmación
// (en vez de window.confirm()), mensajes de error legibles y estado "ocupado" de
// botones. Depende de window.bootstrap (bootstrap.bundle.min.js, cargado antes).

import { ApiError } from './apiClient.js';

function escapeText(value) {
  const div = document.createElement('div');
  div.textContent = value == null ? '' : String(value);
  return div.innerHTML;
}

function toastContainer() {
  let el = document.getElementById('app-toasts');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toasts';
    el.className = 'toast-container app-toasts position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(el);
  }
  return el;
}

const TOAST_ICONS = {
  danger: 'bi-exclamation-triangle-fill',
  success: 'bi-check-circle-fill',
  info: 'bi-info-circle-fill',
  warning: 'bi-wifi-off',
};

// variant: 'danger' | 'success' | 'info' | 'warning'
export function toast(message, { variant = 'danger', delay } = {}) {
  const el = document.createElement('div');
  el.className = `toast align-items-center border-0 app-toast app-toast-${variant}`;
  el.setAttribute('role', variant === 'danger' ? 'alert' : 'status');
  el.setAttribute('aria-live', variant === 'danger' ? 'assertive' : 'polite');
  el.setAttribute('aria-atomic', 'true');
  el.innerHTML = `
    <div class="d-flex align-items-start gap-2 p-2">
      <i class="bi ${TOAST_ICONS[variant] || TOAST_ICONS.info} app-toast-icon" aria-hidden="true"></i>
      <div class="toast-body p-0 flex-grow-1">${escapeText(message)}</div>
      <button type="button" class="btn-close ms-1" data-bs-dismiss="toast" aria-label="Cerrar"></button>
    </div>`;
  toastContainer().appendChild(el);
  const instance = new bootstrap.Toast(el, { delay: delay ?? (variant === 'danger' ? 7000 : 3500) });
  el.addEventListener('hidden.bs.toast', () => el.remove());
  instance.show();
  return instance;
}

// Traduce un error de fetch/ApiError a algo que el usuario pueda entender. Los
// códigos del backend (ej. "unauthenticated") no se muestran crudos.
export function errorMessage(err) {
  if (err instanceof ApiError) {
    if (err.status === 401) return 'Tu sesión expiró. Volvé a iniciar sesión desde el menú de usuario.';
    if (err.status === 403) return 'No tenés permiso para hacer esto.';
    if (err.status === 404) return 'No se encontró lo que buscabas. Recargá la página e intentá de nuevo.';
    if (err.status === 409) return 'Ya existe. Recargá la página para ver el estado actual.';
    if (err.status >= 500) return 'El servidor tuvo un problema. Intentá de nuevo en un rato.';
    return 'El servidor rechazó el cambio. Recargá la página e intentá de nuevo.';
  }
  if (err instanceof TypeError || !navigator.onLine) {
    return 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.';
  }
  return 'Ocurrió un error inesperado. Intentá de nuevo.';
}

// Toast de error estándar: "<qué falló>. <por qué / qué hacer>".
export function toastError(what, err) {
  toast(err ? `${what}. ${errorMessage(err)}` : what, { variant: 'danger' });
}

// Pone un spinner en el botón y lo deshabilita mientras `busy` sea true. Guarda el
// contenido original en una propiedad JS (no en un data-attribute) para que los
// cloneNode() que hace index.js sobre estos botones no arrastren el spinner.
export function setBusy(button, busy) {
  if (!button) return;
  if (busy) {
    if (button._busyOriginal === undefined) button._busyOriginal = button.innerHTML;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    button.innerHTML = `<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>${button._busyOriginal}`;
  } else {
    if (button._busyOriginal !== undefined) {
      button.innerHTML = button._busyOriginal;
      delete button._busyOriginal;
    }
    button.disabled = false;
    button.removeAttribute('aria-busy');
  }
}

// Diálogo de confirmación con un modal de Bootstrap. Devuelve una Promise<boolean>.
// Puede abrirse arriba de otro modal (ej. el de la materia): se suspende el focus
// trap del modal de abajo mientras tanto, si no los dos se pelean por el foco.
export function confirmDialog({
  title = '¿Confirmás?',
  message = '',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'modal fade confirm-modal';
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('aria-labelledby', 'confirm-modal-title');
    el.innerHTML = `
      <div class="modal-dialog modal-dialog-centered modal-sm">
        <div class="modal-content">
          <div class="modal-header border-0 pb-0">
            <h5 class="modal-title fs-6 fw-semibold" id="confirm-modal-title">${escapeText(title)}</h5>
          </div>
          <div class="modal-body small text-body-secondary">${escapeText(message)}</div>
          <div class="modal-footer border-0 pt-0">
            <button type="button" class="btn btn-sm btn-outline-secondary" data-action="cancel">${escapeText(cancelText)}</button>
            <button type="button" class="btn btn-sm ${danger ? 'btn-danger' : 'btn-primary'}" data-action="confirm">${escapeText(confirmText)}</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el);

    const suspended = [];
    document.querySelectorAll('.modal.show').forEach((open) => {
      const inst = bootstrap.Modal.getInstance(open);
      if (inst && inst._focustrap) {
        inst._focustrap.deactivate();
        suspended.push(inst);
      }
    });

    let result = false;
    const modal = new bootstrap.Modal(el, { backdrop: 'static' });
    el.querySelector('[data-action="confirm"]').addEventListener('click', () => { result = true; modal.hide(); });
    el.querySelector('[data-action="cancel"]').addEventListener('click', () => { result = false; modal.hide(); });
    el.addEventListener('shown.bs.modal', () => el.querySelector('[data-action="confirm"]').focus());
    el.addEventListener('hidden.bs.modal', () => {
      modal.dispose();
      el.remove();
      // Al cerrarse, Bootstrap saca `modal-open` del body aunque el modal de abajo
      // siga abierto: se restaura para que el fondo no vuelva a scrollear.
      if (document.querySelector('.modal.show')) document.body.classList.add('modal-open');
      suspended.forEach((inst) => { try { inst._focustrap.activate(); } catch (e) { /* ignore */ } });
      resolve(result);
    });
    modal.show();
  });
}
