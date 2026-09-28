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

const hideToast = () => {
    const { toast, bar } = getEls();
    if (!toast) return;
    toast.classList.remove('toast--visible');
    bar?.classList.remove('is-running');
    toast.hidden = true;
};

/** Cierra el toast y hace definitivo el borrado pendiente. */
export const dismissUndo = () => {
    clearTimeout(timerId);
    timerId = null;
    pending = null;
    hideToast();
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

    // Reiniciar la animación de la barra
    bar?.classList.remove('is-running');
    void bar?.offsetWidth;
    bar?.classList.add('is-running');

    timerId = setTimeout(dismissUndo, UNDO_TIMEOUT_MS);
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
