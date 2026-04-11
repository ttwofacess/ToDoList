// ============================================================
// storage.js — Responsabilidad: Persistencia en localStorage
// ============================================================

const STORAGE_KEY = 'tasks';

/**
 * Lee y parsea el array de tareas desde localStorage.
 * Devuelve [] si no hay datos o si el JSON es inválido.
 * @returns {Array<Object>}
 */
export const readTasks = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/**
 * Serializa y guarda el array de tareas en localStorage.
 * @param {Array<Object>} tasks
 */
export const writeTasks = (tasks) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
};

/**
 * Elimina todas las tareas del localStorage.
 */
export const clearTasks = () => localStorage.removeItem(STORAGE_KEY);

/**
 * Serializa el estado actual del DOM al formato de datos
 * y lo persiste. Requiere el contenedor de tareas.
 * @param {HTMLElement} tasksContainer
 */
export const persistFromDOM = (tasksContainer) => {
    const tasks = [];

    tasksContainer.querySelectorAll('.task-wrapper').forEach(el => {
        const taskEl = el.querySelector('.task');

        const priority = taskEl.classList.contains('priority-high') ? 'high'
            : taskEl.classList.contains('priority-medium') ? 'medium'
            : 'low';

        const subtasks = [...el.querySelectorAll('.subtask-item')].map(subEl => ({
            text: subEl.querySelector('.subtask-text').textContent,
            done: subEl.querySelector('.subtask-checkbox').checked,
        }));

        tasks.push({
            text: taskEl.querySelector('.task-text').textContent,
            done: taskEl.classList.contains('done'),
            date: taskEl.querySelector('.task-date').textContent,
            priority,
            subtasks,
            recurrence: el.getAttribute('data-recurrence') || 'none',
            lastCompleted: el.getAttribute('data-last-completed') || null,
        });
    });

    writeTasks(tasks);
};
