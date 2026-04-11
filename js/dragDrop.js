// ============================================================
// dragDrop.js — Responsabilidad: Comportamiento de drag & drop
// ============================================================

import { persistFromDOM } from './storage.js';

/**
 * Encuentra el elemento `.task-wrapper` más cercano al punto Y del cursor,
 * para saber dónde insertar el elemento arrastrado.
 *
 * @param {HTMLElement} container
 * @param {number}      y — clientY del evento dragover
 * @returns {HTMLElement|undefined}
 */
const getDragAfterElement = (container, y) => {
    const draggables = [...container.querySelectorAll('.task-wrapper:not(.dragging)')];

    return draggables.reduce((closest, child) => {
        const box    = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset, element: child };
        return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
};

/**
 * Registra los listeners de drag en un task-wrapper recién creado.
 * Debe llamarse desde taskRenderer al construir cada tarea.
 *
 * @param {HTMLElement} taskWrapper
 * @param {HTMLElement} tasksContainer
 */
export const attachDragListeners = (taskWrapper, tasksContainer) => {
    taskWrapper.addEventListener('dragstart', () => taskWrapper.classList.add('dragging'));
    taskWrapper.addEventListener('dragend', () => {
        taskWrapper.classList.remove('dragging');
        persistFromDOM(tasksContainer);
    });
};

/**
 * Inicializa el listener `dragover` en el contenedor de tareas.
 * @param {HTMLElement} tasksContainer
 */
export const initDragDrop = (tasksContainer) => {
    tasksContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggable    = document.querySelector('.dragging');
        const afterElement = getDragAfterElement(tasksContainer, e.clientY);

        if (!draggable) return;
        if (afterElement == null) tasksContainer.appendChild(draggable);
        else                      tasksContainer.insertBefore(draggable, afterElement);
    });
};
