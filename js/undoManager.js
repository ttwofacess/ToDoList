// ============================================================
// undoManager.js — Responsabilidad: toast "Deshacer" con temporizador
// para recuperar la última tarea eliminada.
// ============================================================

import { t }                          from './i18n.js';
import { restoreTask }                from './taskActions.js';
import { MAX_TASKS }                  from './taskManager.js';

/** Tiempo que el usuario tiene para revertir un borrado. */
export const UNDO_TIMEOUT_MS = 5000;

let tasksContainer = null;
let pending        = null;  // snapshot de la última tarea borrada
let timerId        = null;

const getEls = () => ({
    toast:  document.getElementById('undoToast'),
    button: document.getElementById('undoButton'),
    bar:    document.querySelector('#undoToast .toast-progress'),
});

/** ¿El usuario pidió menos movimiento? Entonces no hay háptica. */
const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/** Vibra en plataformas que lo soportan (Android). En iOS es no-op. */
const vibrateFeedback = (pattern) => {
    if (prefersReducedMotion()) return;
    navigator.vibrate?.(pattern);
};

const hideToast = (byTimeout = false) => {
    const { toast, bar } = getEls();
    if (!toast) return;
    toast.classList.remove('toast--visible');
    bar?.classList.remove('is-running');
    toast.hidden = true;
    if (byTimeout) vibrateFeedback([10, 40, 10]);
};

/** Cierra el toast y hace definitivo el borrado pendiente. */
export const dismissUndo = () => {
    clearTimeout(timerId);
    timerId = null;
    pending = null;
    hideToast();
};

const expireUndo = () => {
    timerId = null;
    pending = null;
    hideToast(true);
};

/** Muestra el toast y arranca la cuenta regresiva de 5 s. */
export const showUndoToast = (snapshot) => {
    clearTimeout(timerId);           // un borrado nuevo reemplaza al anterior
    pending = snapshot;

    const { toast, bar } = getEls();
    if (!toast) return;

    toast.style.setProperty('--undo-duration', `${UNDO_TIMEOUT_MS}ms`);
    toast.hidden = false;
    toast.classList.add('toast--visible');

    vibrateFeedback(10);

    // Reiniciar la animación de la barra
    bar?.classList.remove('is-running');
    void bar?.offsetWidth;
    bar?.classList.add('is-running');

    timerId = setTimeout(expireUndo, UNDO_TIMEOUT_MS);
};

/** Restaura la tarea pendiente y cierra el toast. */
export const undoLastDelete = () => {
    if (!pending || !tasksContainer) return;

    const count = tasksContainer.querySelectorAll('.task-wrapper').length;
    if (count >= MAX_TASKS) {
        alert(t('alertMaxTasks'));
        dismissUndo();
        return;
    }

    restoreTask(pending, tasksContainer);
    dismissUndo();
};

export const initUndoManager = (container) => {
    tasksContainer = container;
    getEls().button?.addEventListener('click', undoLastDelete);
};
