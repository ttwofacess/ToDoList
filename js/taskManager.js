// ============================================================
// taskManager.js — Responsabilidad: Lógica CRUD y estado
//                  de las tareas (sin tocar el DOM directamente)
// ============================================================

import { t, getLang }                       from './i18n.js';
import { formatDisplayDate, isoStringToDate,
         isDateInPast, shouldResetRecurringTask } from './dateUtils.js';
import { readTasks, persistFromDOM }        from './storage.js';
import { createTaskElement, initRenderer }  from './taskRenderer.js';
import { closeNewTaskModal }                from './modalManager.js';

export const VALID_PRIORITIES = ['high', 'medium', 'low'];

let tasksContainer = null;
let onEditRequest  = null; // callback inyectado desde modalManager

/**
 * Inyecta las dependencias externas que taskManager necesita.
 * @param {HTMLElement} container
 * @param {Function}    editCallback — fn(event) que abre el modal de edición
 */
export const initTaskManager = (container, editCallback) => {
    tasksContainer = container;
    onEditRequest  = editCallback;
    initRenderer(container);
};

// ─── Helpers internos ──────────────────────────────────────

const buildTaskElement = (text, date, priority, subtasks, recurrence, lastCompleted) =>
    createTaskElement(
        text, date, priority, subtasks, recurrence, lastCompleted,
        changeTaskState,
        deleteTask,
        (e) => onEditRequest?.(e),
    );

// ─── Handlers de estado ────────────────────────────────────

const changeTaskState = (event) => {
    const taskEl     = event.target.closest('.task');
    if (!taskEl) return;
    const taskWrapper = taskEl.closest('.task-wrapper');
    const isDone      = taskEl.classList.toggle('done');

    if (isDone) taskWrapper.setAttribute('data-last-completed', Date.now());
    else        taskWrapper.removeAttribute('data-last-completed');

    persistFromDOM(tasksContainer);
};

const deleteTask = (event) => {
    event.target.closest('.task-wrapper').remove();
    persistFromDOM(tasksContainer);
};

// ─── API pública ───────────────────────────────────────────

/**
 * Valida y agrega una tarea nueva desde el formulario principal.
 * @param {Event} event — submit del <form>
 */
export const addNewTask = (event) => {
    event.preventDefault();
    const { value }    = event.target.taskText;
    const priority     = event.target.taskPriority.value;
    const dateValue    = event.target.taskDate.value;

    if (!value.trim())                    { alert(t('alertEmptyTask'));    return; }
    if (value.length > 500)               { alert(t('alertTaskTooLong')); return; }
    if (tasksContainer.childNodes.length >= 100) { alert(t('alertMaxTasks')); return; }

    if (dateValue && isDateInPast(isoStringToDate(dateValue))) {
        alert(t('alertPastDate'));
        return;
    }

    const date = dateValue
        ? formatDisplayDate(isoStringToDate(dateValue))
        : formatDisplayDate(new Date());

    tasksContainer.prepend(buildTaskElement(value.trim(), date, priority, [], 'none', null));
    event.target.reset();
    persistFromDOM(tasksContainer);
    closeNewTaskModal();
};

/**
 * Carga las tareas desde localStorage y las renderiza.
 */
export const loadTasks = () => {
    const tasks = readTasks();

    tasks.forEach(task => {
        if (typeof task.text !== 'string' || typeof task.done !== 'boolean') return;

        const lang      = getLang();
        const date      = task.date ?? formatDisplayDate(new Date());
        const priority  = task.priority ?? 'medium';
        const subtasks  = task.subtasks ?? [];
        const recurrence = task.recurrence ?? 'none';
        let lastCompleted = task.lastCompleted ? parseInt(task.lastCompleted) : null;
        let done          = task.done;

        if (done && recurrence !== 'none' && lastCompleted) {
            if (shouldResetRecurringTask(recurrence, lastCompleted)) {
                done = false;
                lastCompleted = null;
            }
        }

        const taskEl = buildTaskElement(task.text, date, priority, subtasks, recurrence, lastCompleted);
        if (done) taskEl.querySelector('.task').classList.add('done');
        tasksContainer.appendChild(taskEl);
    });
};

/**
 * Reordena el DOM: tareas pendientes primero, completadas al final.
 */
export const renderOrderedTasks = () => {
    const done  = [];
    const toDo  = [];

    tasksContainer.querySelectorAll('.task-wrapper').forEach(el => {
        el.querySelector('.task').classList.contains('done')
            ? done.push(el)
            : toDo.push(el);
    });

    [...toDo, ...done].forEach(el => tasksContainer.appendChild(el));
    persistFromDOM(tasksContainer);
};

/**
 * Agrega/quita la clase `due-today` a las tareas con fecha de hoy.
 */
export const highlightDueTasks = () => {
    const today = formatDisplayDate(new Date());

    tasksContainer.querySelectorAll('.task-wrapper').forEach(wrapper => {
        const dateEl = wrapper.querySelector('.task-date');
        const taskEl = wrapper.querySelector('.task');
        if (dateEl) {
            taskEl.classList.toggle('due-today', dateEl.textContent === today);
        }
    });
};

/**
 * Activa/desactiva el filtro "Focus Mode" (tareas de hoy + prioridad alta).
 * @param {Event} event — click en el botón filtro
 */
export const toggleFilterToday = (event) => {
    const button   = event.target;
    const isActive = tasksContainer.classList.toggle('filter-today-active');
    button.textContent = isActive ? t('filterButtonAll') : t('filterButtonToday');
    button.classList.toggle('filter-active', isActive);
};
