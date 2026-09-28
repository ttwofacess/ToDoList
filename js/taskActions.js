// ============================================================
// taskActions.js — Responsabilidad: Acciones de estado de tareas
// ============================================================

import { formatDisplayDate } from './dateUtils.js';
import { persistFromDOM } from './storage.js';

/**
 * Cambia el estado (completado/pendiente) de una tarea.
 * @param {HTMLElement} wrapper
 * @param {HTMLElement} tasksContainer
 */
export const changeTaskState = (wrapper, tasksContainer) => {
    const taskEl = wrapper.querySelector('.task');
    const isDone = taskEl.classList.toggle('done');

    if (isDone) {
        wrapper.setAttribute('data-last-completed', Date.now());
    } else {
        // When reactivating a recurring task, update the date to today
        const recurrence = wrapper.getAttribute('data-recurrence') || 'none';
        if (recurrence !== 'none') {
            const dateEl = wrapper.querySelector('.task-date');
            const todayStr = formatDisplayDate(new Date());
            if (dateEl) {
                dateEl.textContent = todayStr;
            }
        }
        wrapper.removeAttribute('data-last-completed');
    }

    persistFromDOM(tasksContainer);
};

/**
 * @typedef {Object} DeleteSnapshot
 * @property {HTMLElement} wrapper       Nodo eliminado (se reinserta tal cual).
 * @property {number} index              Posición que tenía entre los hijos del contenedor (-1 si no estaba).
 * @property {HTMLElement|null} nextSibling Vecino siguiente en el momento del borrado (null si era la última).
 */

/**
 * Elimina una tarea y devuelve un snapshot para poder deshacerla.
 * @param {HTMLElement} wrapper
 * @param {HTMLElement} tasksContainer
 * @returns {DeleteSnapshot}
 */
export const deleteTask = (wrapper, tasksContainer) => {
    const index = [...tasksContainer.children].indexOf(wrapper); // -1 si no estaba
    const nextSibling = wrapper.nextElementSibling;             // null si era la última
    wrapper.remove();
    persistFromDOM(tasksContainer);
    return { wrapper, index, nextSibling };
};

/**
 * Reinserta una tarea borrada en su posición original y persiste.
 * @param {DeleteSnapshot} snapshot
 * @param {HTMLElement} tasksContainer
 * @returns {'restored'|'already-restored'}
 */
export const restoreTask = ({ wrapper, index, nextSibling }, tasksContainer) => {
    if (wrapper.isConnected) return 'already-restored';

    if (nextSibling && nextSibling.parentNode === tasksContainer) {
        tasksContainer.insertBefore(wrapper, nextSibling);       // caso normal
    } else if (nextSibling === null) {
        tasksContainer.appendChild(wrapper);                     // era la última
    } else {
        // el vecino ya no existe: usar el índice original acotado
        const ref = tasksContainer.children[index] ?? null;
        tasksContainer.insertBefore(wrapper, ref);
    }

    persistFromDOM(tasksContainer);
    return 'restored';
};
