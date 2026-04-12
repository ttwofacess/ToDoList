// ============================================================
// taskActions.js — Responsabilidad: Acciones de estado de tareas
// ============================================================

import { persistFromDOM } from './storage.js';

/**
 * Cambia el estado (completado/pendiente) de una tarea.
 * @param {HTMLElement} wrapper
 * @param {HTMLElement} tasksContainer
 */
export const changeTaskState = (wrapper, tasksContainer) => {
    const taskEl = wrapper.querySelector('.task');
    const isDone = taskEl.classList.toggle('done');

    if (isDone) wrapper.setAttribute('data-last-completed', Date.now());
    else        wrapper.removeAttribute('data-last-completed');

    persistFromDOM(tasksContainer);
};

/**
 * Elimina una tarea.
 * @param {HTMLElement} wrapper
 * @param {HTMLElement} tasksContainer
 */
export const deleteTask = (wrapper, tasksContainer) => {
    wrapper.remove();
    persistFromDOM(tasksContainer);
};
