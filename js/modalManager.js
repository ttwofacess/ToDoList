// ============================================================
// modalManager.js — Responsabilidad: Control de modales
// ============================================================

import { t }                               from './i18n.js';
import { formatDisplayDate, isoStringToDate,
         isDateInPast, displayDateToIso }  from './dateUtils.js';
import { persistFromDOM }                  from './storage.js';
import { changeTaskState, deleteTask }     from './taskActions.js';
import { toggleRecurrence, showSubtaskInput } from './taskRenderer.js';

let tasksContainer         = null;
let currentEditingWrapper  = null;
let currentActionWrapper   = null;

export const initModalManager = (container) => { tasksContainer = container; };

// ─── Modal de Acciones de Tarea ────────────────────────────

export const openActionModal = (wrapper) => {
    currentActionWrapper = wrapper;
    const taskText = wrapper.querySelector('.task-text').textContent;
    const taskEmojis = wrapper.querySelector('.task-emojis').textContent;
    const recurrence = wrapper.getAttribute('data-recurrence') || 'none';

    document.getElementById('actionModalText').textContent = taskText;
    document.getElementById('actionModalEmojis').textContent = taskEmojis;

    const actionRecurrenceBtn = document.getElementById('actionRecurrence');
    actionRecurrenceBtn.classList.remove('recurrence-daily', 'recurrence-weekly', 'recurrence-monthly');
    if (recurrence !== 'none') {
        actionRecurrenceBtn.classList.add(`recurrence-${recurrence}`);
    }

    const modalSubContainer = document.getElementById('actionSubtasksContainer');
    modalSubContainer.innerHTML = '';
    const subContainer = wrapper.querySelector('.subtasks-container');
    if (subContainer) {
        subContainer.style.display = 'flex';
        modalSubContainer.appendChild(subContainer);
    }
    
    document.getElementById('taskActionModal').style.display = 'block';
};

export const closeActionModal = () => {
    if (currentActionWrapper) {
        const modalSubContainer = document.getElementById('actionSubtasksContainer');
        const subContainer = modalSubContainer.querySelector('.subtasks-container');
        if (subContainer) {
            subContainer.style.display = 'none';
            currentActionWrapper.appendChild(subContainer);
        }
    }
    document.getElementById('taskActionModal').style.display = 'none';
    currentActionWrapper = null;
};

// ─── Modal de nueva tarea ──────────────────────────────────

export const openNewTaskModal = () => {
    const modal = document.getElementById('newTaskModal');
    const content = modal.querySelector('.modal-content');
    modal.style.display = 'block';
    content.classList.remove('tornado-animate');
    void content.offsetWidth; // force reflow
    content.classList.add('tornado-animate');
    setTimeout(() => {
        const input = document.querySelector('#newTaskForm input[name="taskText"]');
        if (input) input.focus();
    }, 10);
};

export const closeNewTaskModal = () => {
    const modal = document.getElementById('newTaskModal');
    const content = modal.querySelector('.modal-content');
    content.classList.remove('tornado-animate');
    modal.style.display = 'none';
};

// ─── Modal de edición ──────────────────────────────────────

export const openEditModal = (wrapper) => {
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

    persistFromDOM(tasksContainer);
    closeEditModal();
};

// ─── Inicialización de Modales ─────────────────────────────

export const initModals = () => {
    const donateModal = document.getElementById('donateModal');
    const editModal = document.getElementById('editModal');
    const newTaskModal = document.getElementById('newTaskModal');
    const taskActionModal = document.getElementById('taskActionModal');

    document.getElementById('openNewTaskModal').onclick    = openNewTaskModal;
    document.getElementById('closeNewTaskModal').onclick   = closeNewTaskModal;
    document.getElementById('cancelNewTaskButton').onclick = closeNewTaskModal;

    document.getElementById('donateButton').onclick = () => donateModal.style.display = 'block';
    donateModal.querySelector('.close-button').onclick = () => donateModal.style.display = 'none';

    document.getElementById('closeEditModal').onclick = closeEditModal;
    document.getElementById('cancelEditButton').onclick = closeEditModal;
    document.getElementById('editTaskForm').onsubmit = saveModalChanges;

    document.getElementById('closeActionModal').onclick = closeActionModal;
    
    document.getElementById('actionDone').onclick = () => {
        if (currentActionWrapper) changeTaskState(currentActionWrapper, tasksContainer);
    };
    
    document.getElementById('actionEdit').onclick = () => {
        if (currentActionWrapper) {
            const wrapper = currentActionWrapper;
            closeActionModal();
            openEditModal(wrapper);
        }
    };
    
    document.getElementById('actionSubtask').onclick = () => {
        if (currentActionWrapper) {
            const modalSubContainer = document.getElementById('actionSubtasksContainer');
            const subContainer = modalSubContainer.querySelector('.subtasks-container');
            showSubtaskInput(subContainer);
        }
    };
    
    document.getElementById('actionRecurrence').onclick = () => {
        if (currentActionWrapper) toggleRecurrence(currentActionWrapper);
    };
    
    document.getElementById('actionDelete').onclick = () => {
        if (currentActionWrapper) {
            deleteTask(currentActionWrapper, tasksContainer);
            closeActionModal();
        }
    };

    window.addEventListener('click', (e) => {
        if (e.target === donateModal)     donateModal.style.display = 'none';
        if (e.target === editModal)       closeEditModal();
        if (e.target === newTaskModal)    closeNewTaskModal();
        if (e.target === taskActionModal) closeActionModal();
    });

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
