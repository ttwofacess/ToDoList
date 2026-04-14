// ============================================================
// taskManager.js — Responsabilidad: Lógica CRUD y estado
// ============================================================

import { t }                               from './i18n.js';
import { formatDisplayDate, isoStringToDate,
         isDateInPast, shouldResetRecurringTask } from './dateUtils.js';
import { readTasks, persistFromDOM }        from './storage.js';
import { createTaskElement, initRenderer }  from './taskRenderer.js';
import { attachDragListeners }              from './dragDrop.js';

export const VALID_PRIORITIES = ['high', 'medium', 'low'];

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

const buildTaskElement = (text, date, priority, subtasks, recurrence, lastCompleted, createdAt) => {
    const taskEl = createTaskElement(
        text, date, priority, subtasks, recurrence, lastCompleted, createdAt,
        (wrapper) => onOpenActionModal?.(wrapper)
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

    const taskEl = buildTaskElement(value.trim(), date, priority, [], 'none', null, Date.now());
    tasksContainer.prepend(taskEl);
    event.target.reset();
    persistFromDOM(tasksContainer);
    
    // Llamamos al callback inyectado
    if (onCloseNewTaskModal) onCloseNewTaskModal();
};

export const loadTasks = () => {
    const tasks = readTasks();
    tasksContainer.innerHTML = '';

    tasks.forEach(task => {
        if (typeof task.text !== 'string' || typeof task.done !== 'boolean') return;

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
                // Update date to today for recurring tasks that are being reset
                task.date = formatDisplayDate(new Date());
            }
        }

        const taskEl = buildTaskElement(task.text, date, priority, subtasks, recurrence, lastCompleted, task.createdAt);
        if (done) taskEl.querySelector('.task').classList.add('done');
        tasksContainer.appendChild(taskEl);
    });
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
