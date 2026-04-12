// ============================================================
// taskRenderer.js — Responsabilidad: Construir elementos DOM
//                   para tareas y subtareas
// ============================================================

import { t, getLang } from './i18n.js';
import { formatDisplayDate, getTaskEmojis } from './dateUtils.js';
import { persistFromDOM } from './storage.js';

export const VALID_RECURRENCES = ['none', 'daily', 'weekly', 'monthly'];
export const VALID_PRIORITIES  = ['high', 'medium', 'low'];

// Referencia al contenedor principal, inyectada en init()
let tasksContainer = null;

export const initRenderer = (container) => { tasksContainer = container; };

// ─── Subtareas ─────────────────────────────────────────────

/**
 * Crea el elemento DOM de una subtarea.
 * @param {string}  text
 * @param {boolean} done
 * @returns {HTMLElement}
 */
export const createSubtaskElement = (text, done) => {
    const item = document.createElement('div');
    item.classList.add('subtask-item');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('subtask-checkbox');
    checkbox.checked = done;

    const label = document.createElement('span');
    label.classList.add('subtask-text');
    label.textContent = DOMPurify.sanitize(text);
    if (done) label.classList.add('subtask-done');

    checkbox.addEventListener('change', () => {
        label.classList.toggle('subtask-done', checkbox.checked);
        persistFromDOM(tasksContainer);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.classList.add('subtask-delete');
    deleteBtn.addEventListener('click', () => {
        item.remove();
        persistFromDOM(tasksContainer);
    });

    item.append(checkbox, label, deleteBtn);
    return item;
};

/**
 * Muestra el input inline para agregar una subtarea.
 * @param {Event} event — click en el botón ➕
 */
export const showSubtaskInput = (event) => {
    const taskWrapper = event.target.closest('.task-wrapper');
    const container   = taskWrapper.querySelector('.subtasks-container');
    if (container.querySelector('.subtask-input-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.classList.add('subtask-input-wrapper');

    const input = document.createElement('input');
    input.type        = 'text';
    input.placeholder = t('subtaskPlaceholder');
    input.classList.add('subtask-input');
    input.setAttribute('data-i18n-key', 'subtaskPlaceholder');

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '✅';
    saveBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) {
            container.appendChild(createSubtaskElement(text, false));
            wrapper.remove();
            persistFromDOM(tasksContainer);
        }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '❌';
    cancelBtn.addEventListener('click', () => wrapper.remove());

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter')  saveBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
    });

    wrapper.append(input, saveBtn, cancelBtn);
    container.appendChild(wrapper);
    input.focus();
};

// ─── Recurrencia ───────────────────────────────────────────

/**
 * Cicla el atributo data-recurrence del wrapper al hacer click en 🔁.
 * @param {Event} event
 */
export const toggleRecurrence = (event) => {
    const taskWrapper = event.target.closest('.task-wrapper');
    const badge       = taskWrapper.querySelector('.recurrence-badge');
    const button      = event.target;

    const currentRec = taskWrapper.getAttribute('data-recurrence') || 'none';
    const nextIndex  = (VALID_RECURRENCES.indexOf(currentRec) + 1) % VALID_RECURRENCES.length;
    const nextRec    = VALID_RECURRENCES[nextIndex];

    taskWrapper.setAttribute('data-recurrence', nextRec);

    if (nextRec === 'none') {
        badge.textContent = '';
        badge.removeAttribute('data-recurrence-value');
        button.classList.remove('active');
    } else {
        const key = `recurrence${nextRec.charAt(0).toUpperCase() + nextRec.slice(1)}`;
        badge.textContent = t(key);
        badge.setAttribute('data-recurrence-value', nextRec);
        button.classList.add('active');
    }

    persistFromDOM(tasksContainer);
};

// ─── Tarea completa ────────────────────────────────────────

/**
 * Construye el wrapper DOM completo de una tarea.
 *
 * @param {string}   text
 * @param {string}   date            — fecha en formato display
 * @param {string}   priority        — 'high' | 'medium' | 'low'
 * @param {Array}    subtasksData    — [{ text, done }]
 * @param {string}   recurrence      — 'none' | 'daily' | 'weekly' | 'monthly'
 * @param {number|null} lastCompleted — timestamp ms o null
 * @param {number|null} createdAt     — timestamp ms de creación
 * @param {Function} onToggleDone    — callback(event) al hacer click en la tarea
 * @param {Function} onDelete        — callback(event) al borrar
 * @param {Function} onEdit          — callback(event) al editar
 * @returns {HTMLElement}
 */
export const createTaskElement = (
    text,
    date,
    priority,
    subtasksData   = [],
    recurrence     = 'none',
    lastCompleted  = null,
    createdAt      = null,
    onToggleDone,
    onDelete,
    onEdit,
) => {
    const todayStr = formatDisplayDate(new Date());
    const creationTime = createdAt || Date.now();
    const emojis = getTaskEmojis(new Date(creationTime));

    // ── Wrapper ──
    const taskWrapper = document.createElement('div');
    taskWrapper.classList.add('task-wrapper');
    taskWrapper.draggable = true;
    taskWrapper.setAttribute('data-recurrence', recurrence);
    taskWrapper.setAttribute('data-created-at', creationTime);
    if (lastCompleted) taskWrapper.setAttribute('data-last-completed', lastCompleted);

    // ── Fila principal ──
    const mainRow = document.createElement('div');
    mainRow.classList.add('task-main-row');

    // ── Tarea ──
    const task = document.createElement('div');
    task.classList.add('task', 'roundBorder', `priority-${priority}`);
    if (date === todayStr) task.classList.add('due-today');
    task.addEventListener('click', onToggleDone);

    // Contenido de texto
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('task-content-wrapper');

    const taskTextWrapper = document.createElement('div');
    taskTextWrapper.style.display = 'flex';
    taskTextWrapper.style.alignItems = 'center';
    taskTextWrapper.style.gap = '8px';

    const taskEmojis = document.createElement('span');
    taskEmojis.classList.add('task-emojis');
    taskEmojis.textContent = emojis;

    const taskText = document.createElement('span');
    taskText.classList.add('task-text');
    taskText.textContent = DOMPurify.sanitize(text);

    taskTextWrapper.append(taskEmojis, taskText);

    const badge = document.createElement('span');
    badge.classList.add('recurrence-badge');
    badge.setAttribute('data-i18n-key', 'recurrenceBadge');
    if (recurrence !== 'none') {
        const key = `recurrence${recurrence.charAt(0).toUpperCase() + recurrence.slice(1)}`;
        badge.textContent = t(key);
        badge.setAttribute('data-recurrence-value', recurrence);
    }

    contentWrapper.append(taskTextWrapper, badge);

    const taskDateEl = document.createElement('span');
    taskDateEl.classList.add('task-date');
    taskDateEl.textContent = date;

    task.append(contentWrapper, taskDateEl);

    // ── Botones de acción ──
    const recurrenceBtn = document.createElement('button');
    recurrenceBtn.textContent = '🔁';
    recurrenceBtn.classList.add('recurrence-button');
    recurrenceBtn.setAttribute('data-i18n-key', 'repeatButtonTitle');
    recurrenceBtn.title = t('repeatButtonTitle');
    if (recurrence !== 'none') recurrenceBtn.classList.add('active');
    recurrenceBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleRecurrence(e); });

    const subtaskBtn = document.createElement('button');
    subtaskBtn.textContent = '➕';
    subtaskBtn.classList.add('subtask-button');
    subtaskBtn.setAttribute('data-i18n-key', 'addSubtask');
    subtaskBtn.title = t('addSubtask');
    subtaskBtn.addEventListener('click', (e) => { e.stopPropagation(); showSubtaskInput(e); });

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️';
    editBtn.classList.add('edit-button');
    editBtn.addEventListener('click', (e) => { e.stopPropagation(); onEdit(e); });

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '❌';
    deleteBtn.classList.add('delete-button');
    deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); onDelete(e); });

    mainRow.append(task, recurrenceBtn, subtaskBtn, editBtn, deleteBtn);

    // ── Subtareas ──
    const subtasksContainer = document.createElement('div');
    subtasksContainer.classList.add('subtasks-container');
    subtasksData.forEach(sub => subtasksContainer.appendChild(createSubtaskElement(sub.text, sub.done)));

    taskWrapper.append(mainRow, subtasksContainer);
    return taskWrapper;
};
