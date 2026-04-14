// ============================================================
// taskRenderer.js — Responsabilidad: Construir elementos DOM
//                   para tareas y subtareas
// ============================================================

import { t } from './i18n.js';
import { formatDisplayDate, getTaskEmojis } from './dateUtils.js';
import { persistFromDOM } from './storage.js';

export const VALID_RECURRENCES = ['none', 'daily', 'weekly', 'monthly'];
export const VALID_PRIORITIES  = ['high', 'medium', 'low'];

let tasksContainer = null;
export const initRenderer = (container) => { tasksContainer = container; };

// ─── Subtareas ─────────────────────────────────────────────

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
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        item.remove();
        persistFromDOM(tasksContainer);
    });

    item.append(checkbox, label, deleteBtn);
    return item;
};

export const showSubtaskInput = (targetContainer) => {
    if (targetContainer.querySelector('.subtask-input-wrapper')) return;

    const wrapper = document.createElement('div');
    wrapper.classList.add('subtask-input-wrapper');

    const input = document.createElement('input');
    input.type        = 'text';
    input.placeholder = t('subtaskPlaceholder');
    input.classList.add('subtask-input');

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '✅';
    saveBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) {
            targetContainer.appendChild(createSubtaskElement(text, false));
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
    targetContainer.appendChild(wrapper);
    input.focus();
};

// ─── Recurrencia ───────────────────────────────────────────

export const toggleRecurrence = (wrapper) => {
    const badge = wrapper.querySelector('.recurrence-badge');
    const actionBtn = document.getElementById('actionRecurrence');
    const currentRec = wrapper.getAttribute('data-recurrence') || 'none';
    const nextIndex  = (VALID_RECURRENCES.indexOf(currentRec) + 1) % VALID_RECURRENCES.length;
    const nextRec    = VALID_RECURRENCES[nextIndex];

    wrapper.setAttribute('data-recurrence', nextRec);

    // Update action button classes if it exists (modal open)
    if (actionBtn) {
        actionBtn.classList.remove('recurrence-daily', 'recurrence-weekly', 'recurrence-monthly');
        if (nextRec !== 'none') {
            actionBtn.classList.add(`recurrence-${nextRec}`);
        }
    }

    if (nextRec === 'none') {
        badge.textContent = '';
        badge.removeAttribute('data-recurrence-value');
    } else {
        const key = `recurrence${nextRec.charAt(0).toUpperCase() + nextRec.slice(1)}`;
        badge.textContent = t(key);
        badge.setAttribute('data-recurrence-value', nextRec);
    }

    persistFromDOM(tasksContainer);
};

// ─── Tarea completa ────────────────────────────────────────

export const createTaskElement = (
    text,
    date,
    priority,
    subtasksData   = [],
    recurrence     = 'none',
    lastCompleted  = null,
    createdAt      = null,
    onOpenActions,
) => {
    const todayStr = formatDisplayDate(new Date());
    const creationTime = createdAt ? Number(createdAt) : Date.now();
    const emojis = getTaskEmojis(new Date(creationTime));

    const taskWrapper = document.createElement('div');
    taskWrapper.classList.add('task-wrapper');
    taskWrapper.draggable = true;
    taskWrapper.setAttribute('data-recurrence', recurrence);
    taskWrapper.setAttribute('data-created-at', creationTime);
    if (lastCompleted) taskWrapper.setAttribute('data-last-completed', lastCompleted);

    const task = document.createElement('div');
    task.classList.add('task', 'roundBorder', `priority-${priority}`);
    if (date === todayStr) task.classList.add('due-today');
    
    task.addEventListener('click', () => onOpenActions(taskWrapper));

    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('task-content-wrapper');

    const taskTextWrapper = document.createElement('div');
    taskTextWrapper.classList.add('task-text-wrapper');
    taskTextWrapper.style.display = 'flex';
    taskTextWrapper.style.alignItems = 'center';
    taskTextWrapper.style.justifyContent = 'center';
    taskTextWrapper.style.position = 'relative';

    const taskEmojis = document.createElement('span');
    taskEmojis.classList.add('task-emojis');
    taskEmojis.textContent = emojis;

    const taskText = document.createElement('span');
    taskText.classList.add('task-text');
    taskText.textContent = DOMPurify.sanitize(text);

    taskTextWrapper.append(taskEmojis, taskText);

    const badge = document.createElement('span');
    badge.classList.add('recurrence-badge');
    if (recurrence !== 'none') {
        const key = `recurrence${recurrence.charAt(0).toUpperCase() + recurrence.slice(1)}`;
        badge.textContent = t(key);
        badge.setAttribute('data-recurrence-value', recurrence);
    }

    const taskDateEl = document.createElement('span');
    taskDateEl.classList.add('task-date');
    taskDateEl.textContent = date;

    contentWrapper.append(taskTextWrapper, badge, taskDateEl);
    task.append(contentWrapper);

    const subtasksContainer = document.createElement('div');
    subtasksContainer.classList.add('subtasks-container');
    subtasksContainer.style.display = 'none'; // Oculto en la card principal
    subtasksData.forEach(sub => subtasksContainer.appendChild(createSubtaskElement(sub.text, sub.done)));

    taskWrapper.append(task, subtasksContainer);
    return taskWrapper;
};
