// ============================================================
// taskManager.js — Responsabilidad: Lógica CRUD y estado
// ============================================================

import { t }                               from './i18n.js';
import { formatDisplayDate, isoStringToDate,
         isDateTimeInPast, isValidTime,
         shouldResetRecurringTask }         from './dateUtils.js';
import { readTasks, persistFromDOM }        from './storage.js';
import { createTaskElement, initRenderer }  from './taskRenderer.js';
import { attachDragListeners }              from './dragDrop.js';

export const VALID_PRIORITIES = ['high', 'medium', 'low'];

/** Límite de tareas simultáneas (aplica también al deshacer de un borrado). */
export const MAX_TASKS = 100;

let tasksContainer = null;
let onOpenActionModal = null;
let onCloseNewTaskModal = null; // Inyectado para evitar ciclos

export const initTaskManager = (container, actionCallback, closeNewTaskCallback) => {
    tasksContainer = container;
    onOpenActionModal = actionCallback;
    onCloseNewTaskModal = closeNewTaskCallback;
    initRenderer(container);
};

// ─── Helpers internos ──────────────────────────────────────

const buildTaskElement = (text, date, priority, subtasks, recurrence, lastCompleted, createdAt, time) => {
    const taskEl = createTaskElement(
        text, date, priority, subtasks, recurrence, lastCompleted, createdAt,
        (wrapper) => onOpenActionModal?.(wrapper),
        time,
    );
    attachDragListeners(taskEl, tasksContainer);
    return taskEl;
};

// ─── API pública ───────────────────────────────────────────

export const addNewTask = (event) => {
    event.preventDefault();
    const { value }    = event.target.taskText;
    const priority     = event.target.taskPriority.value;
    const dateValue    = event.target.taskDate.value;
    // Opcional: si el input de hora no está, la tarea vence sólo por fecha.
    const timeValue    = event.target.taskTime?.value ?? '';

    if (!value.trim())                    { alert(t('alertEmptyTask'));    return; }
    if (value.length > 500)               { alert(t('alertTaskTooLong')); return; }
    if (tasksContainer.childNodes.length >= MAX_TASKS) { alert(t('alertMaxTasks')); return; }

    const hasTime = isValidTime(timeValue);

    if (dateValue && isDateTimeInPast(dateValue, timeValue)) {
        alert(t(hasTime ? 'alertPastTime' : 'alertPastDate'));
        return;
    }

    const date = dateValue
        ? formatDisplayDate(isoStringToDate(dateValue))
        : formatDisplayDate(new Date());

    const taskEl = buildTaskElement(value.trim(), date, priority, [], 'none', null, Date.now(), hasTime ? timeValue : '');
    tasksContainer.prepend(taskEl);
    event.target.reset();
    persistFromDOM(tasksContainer);
    
    // Llamamos al callback inyectado
    if (onCloseNewTaskModal) onCloseNewTaskModal();
};

export const loadTasks = () => {
    const tasks = readTasks();
    tasksContainer.innerHTML = '';
    let changed = false;

    tasks.forEach(task => {
        if (typeof task.text !== 'string' || typeof task.done !== 'boolean') return;

        let date      = task.date ?? formatDisplayDate(new Date());
        const priority  = task.priority ?? 'medium';
        const subtasks  = task.subtasks ?? [];
        const recurrence = task.recurrence ?? 'none';
        let lastCompleted = task.lastCompleted ? parseInt(task.lastCompleted) : null;
        let done          = task.done;
        // Una hora inválida (JSON editado a mano o importado) se descarta en
        // lugar de renderizar basura. Las tareas viejas sin time dan ''.
        const time = isValidTime(task.time) ? task.time : '';

        if (done && recurrence !== 'none' && lastCompleted) {
            if (shouldResetRecurringTask(recurrence, lastCompleted)) {
                done = false;
                lastCompleted = null;
                // Update date to today for recurring tasks that are being reset
                date = formatDisplayDate(new Date());
                task.date = date;
                // Also reset subtasks for recurring tasks
                if (Array.isArray(task.subtasks)) {
                    task.subtasks.forEach(sub => sub.done = false);
                }
                changed = true;
            }
        }

        const taskEl = buildTaskElement(task.text, date, priority, subtasks, recurrence, lastCompleted, task.createdAt, time);
        if (done) taskEl.querySelector('.task').classList.add('done');
        tasksContainer.appendChild(taskEl);
    });

    if (changed) persistFromDOM(tasksContainer);
};

export const renderOrderedTasks = () => {
    const done  = [];
    const toDo  = [];

    tasksContainer.querySelectorAll('.task-wrapper').forEach(el => {
        el.querySelector('.task').classList.contains('done') ? done.push(el) : toDo.push(el);
    });

    [...toDo, ...done].forEach(el => tasksContainer.appendChild(el));
    persistFromDOM(tasksContainer);
};

export const highlightDueTasks = () => {
    const today = formatDisplayDate(new Date());
    tasksContainer.querySelectorAll('.task-wrapper').forEach(wrapper => {
        const dateEl = wrapper.querySelector('.task-date');
        const taskEl = wrapper.querySelector('.task');
        if (dateEl) taskEl.classList.toggle('due-today', dateEl.textContent === today);
    });
};

export const toggleFilterToday = (event) => {
    const button   = event.target;
    const isActive = tasksContainer.classList.toggle('filter-today-active');
    button.textContent = isActive ? t('filterButtonAll') : t('filterButtonToday');
    button.classList.toggle('filter-active', isActive);
};
