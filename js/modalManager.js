// ============================================================
// modalManager.js — Responsabilidad: Control de modales
//                   (donación y edición de tareas)
// ============================================================

import { t }                               from './i18n.js';
import { formatDisplayDate, isoStringToDate,
         isDateInPast, displayDateToIso }  from './dateUtils.js';
import { persistFromDOM }                  from './storage.js';

let tasksContainer         = null;
let currentEditingWrapper  = null;

/**
 * @param {HTMLElement} container — tasksContainer del DOM
 */
export const initModalManager = (container) => { tasksContainer = container; };

// ─── Modal de edición ──────────────────────────────────────

export const openEditModal = (event) => {
    const wrapper = event.target.closest('.task-wrapper');
    currentEditingWrapper = wrapper;

    const taskEl   = wrapper.querySelector('.task');
    const taskText = wrapper.querySelector('.task-text').textContent;
    const taskDate = wrapper.querySelector('.task-date').textContent;

    let priority = 'medium';
    if (taskEl.classList.contains('priority-high')) priority = 'high';
    if (taskEl.classList.contains('priority-low'))  priority = 'low';

    document.getElementById('editTaskText').value     = taskText;
    document.getElementById('editTaskPriority').value = priority;
    document.getElementById('editTaskDate').value     = displayDateToIso(taskDate);

    document.getElementById('editModal').style.display = 'block';
};

export const closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
    currentEditingWrapper = null;
};

export const saveModalChanges = (event) => {
    event.preventDefault();
    if (!currentEditingWrapper) return;

    const newText      = document.getElementById('editTaskText').value.trim();
    const newPriority  = document.getElementById('editTaskPriority').value;
    const newDateValue = document.getElementById('editTaskDate').value;

    if (!newText)           { alert(t('alertEmptyTask'));    return; }
    if (newText.length > 500) { alert(t('alertTaskTooLong')); return; }

    if (newDateValue && isDateInPast(isoStringToDate(newDateValue))) {
        alert(t('alertPastDate'));
        return;
    }

    const taskEl     = currentEditingWrapper.querySelector('.task');
    const textEl     = taskEl.querySelector('.task-text');
    const dateEl     = taskEl.querySelector('.task-date');

    textEl.textContent = DOMPurify.sanitize(newText);

    taskEl.classList.remove('priority-high', 'priority-medium', 'priority-low');
    taskEl.classList.add(`priority-${newPriority}`);

    const formattedDate = formatDisplayDate(isoStringToDate(newDateValue));
    dateEl.textContent = formattedDate;

    const todayStr = formatDisplayDate(new Date());
    taskEl.classList.toggle('due-today', formattedDate === todayStr);

    persistFromDOM(tasksContainer);
    closeEditModal();
};

// ─── Modal de donación ─────────────────────────────────────

/**
 * Registra todos los listeners de los modales (donate + edit)
 * y los botones de copiar cripto.
 */
export const initModals = () => {
    // Donate
    const donateModal = document.getElementById('donateModal');
    document.getElementById('donateButton').onclick          = () => donateModal.style.display = 'block';
    donateModal.querySelector('.close-button').onclick       = () => donateModal.style.display = 'none';

    // Edit
    document.getElementById('closeEditModal').onclick        = closeEditModal;
    document.getElementById('cancelEditButton').onclick      = closeEditModal;
    document.getElementById('editTaskForm').onsubmit         = saveModalChanges;

    // Cerrar al hacer click fuera del modal
    const editModal = document.getElementById('editModal');
    window.addEventListener('click', (e) => {
        if (e.target === donateModal) donateModal.style.display = 'none';
        if (e.target === editModal)   closeEditModal();
    });

    // Botones de copiar cripto
    document.querySelectorAll('.copy-button').forEach(button => {
        button.addEventListener('click', (e) => {
            const input = e.target.previousElementSibling.querySelector('input');
            input.select();
            document.execCommand('copy');
            const original = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => (button.textContent = original), 2000);
        });
    });
};
