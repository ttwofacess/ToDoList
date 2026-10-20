// ============================================================
// modalManager.js — Responsabilidad: Control de modales
// ============================================================

import { t }                               from './i18n.js';
import { formatDisplayDate, isoStringToDate,
         formatDisplayTime, isDateTimeInPast, isValidTime,
         displayDateToIso }                  from './dateUtils.js';
import { persistFromDOM }                  from './storage.js';
import { changeTaskState, deleteTask }     from './taskActions.js';
import { toggleRecurrence, showSubtaskInput } from './taskRenderer.js';
import { showUndoToast }                     from './undoManager.js';

let tasksContainer         = null;
let currentEditingWrapper  = null;
let currentActionWrapper   = null;

export const initModalManager = (container) => { tasksContainer = container; };

// ─── Animaciones de entrada y salida ───────────────────────

const ENTER_CLASS = 'modal-enter';
const LEAVE_CLASS = 'modal-leave';
const LEAVE_MS    = 200;

// Limpieza de la salida en curso, por id de modal: quita el listener y el
// temporizador, y deja el modal sin clases de animación.
const leaveCleanups = new Map();

/** ¿El usuario pidió menos movimiento? Entonces no hay animaciones. */
const prefersReducedMotion = () =>
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

/**
 * Reproduce la animación de entrada del modal.
 *
 * Hay que quitar la clase, forzar un reflow y volver a ponerla: si no, el
 * navegador no reinicia la animación y el modal aparece de golpe. El reflow
 * sólo sirve con el modal visible, por eso se llama después de poner
 * `display: flex`.
 */
const playEnter = (modal) => {
    cancelLeave(modal);   // una salida en curso se cancela: el modal vuelve a entrar
    const content = modal.querySelector('.modal-content');
    if (!content) return;
    content.classList.remove(ENTER_CLASS);
    void content.offsetWidth; // force reflow
    content.classList.add(ENTER_CLASS);
};

/** Quita la clase de entrada para que la próxima apertura vuelva a animarse. */
const clearEnter = (modal) => {
    modal.querySelector('.modal-content')?.classList.remove(ENTER_CLASS);
};

/**
 * Cancela una salida en curso: borra el temporizador y el listener, y limpia
 * la clase, así el modal queda en un estado limpio (nada de timers colgados).
 */
const cancelLeave = (modal) => {
    const cleanup = leaveCleanups.get(modal.id);
    if (cleanup) {
        cleanup();
        leaveCleanups.delete(modal.id);
    }
    modal.classList.remove(LEAVE_CLASS);
    modal.querySelector('.modal-content')?.classList.remove(LEAVE_CLASS);
};

/**
 * Cierra el modal con un fade-out de 200 ms: el overlay se desvanece con la
 * tarjeta y deja de capturar clics, así la página de atrás sigue respondiendo
 * mientras el modal se va.
 *
 * El cierre real lo dispara el `animationend`; el temporizador es sólo la red
 * de seguridad por si la animación no corre (pestaña en segundo plano,
 * animaciones desactivadas). Con el reloj congelado en los tests el timer no
 * llega a dispararse, pero la animación sí termina.
 *
 * @param {HTMLElement} modal
 * @param {Object}   [opts]
 * @param {boolean}  [opts.immediate]      cierra sin animación (encadenados)
 * @param {HTMLElement} [opts.restoreFocus] a dónde vuelve el foco al cerrar
 */

const closeWithAnimation = (modal, { immediate = false, restoreFocus = null } = {}) => {
    const content = modal.querySelector('.modal-content');
    cancelLeave(modal);

    let onEnd = null;

    const hide = () => {
        cancelLeave(modal);
        modal.style.display = 'none';
        // El foco sólo se devuelve si el usuario no se movió a otro lado.
        if (restoreFocus && modal.contains(document.activeElement)) restoreFocus.focus();
    };

    if (immediate || prefersReducedMotion() || !content) {
        clearEnter(modal);
        hide();
        return;
    }

    clearEnter(modal);
    content.classList.add(LEAVE_CLASS);
    modal.classList.add(LEAVE_CLASS);

    onEnd = (e) => {
        // Sólo el fade-out del modal: pueden venir animaciones de hijos.
        if (e.target !== content || e.animationName !== 'modal-out') return;
        hide();
    };
    content.addEventListener('animationend', onEnd);

    const timer = setTimeout(hide, LEAVE_MS);
    leaveCleanups.set(modal.id, () => {
        clearTimeout(timer);
        content.removeEventListener('animationend', onEnd);
    });
};

// ─── Modal de Acciones de Tarea ────────────────────────────

export const openActionModal = (wrapper) => {
    currentActionWrapper = wrapper;
    currentActionWrapper.setAttribute('data-active-modal', 'true');
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

    document.getElementById('taskActionModal').style.display = 'flex';
    playEnter(document.getElementById('taskActionModal'));
    setTimeout(() => document.getElementById('actionDone')?.focus(), 10);
};

export const closeActionModal = (options = {}) => {
    // Las subtareas vuelven al wrapper antes de animar: es un cambio de DOM
    // que no puede esperar a que termine el fade-out.
    if (currentActionWrapper) {
        currentActionWrapper.removeAttribute('data-active-modal');
        const modalSubContainer = document.getElementById('actionSubtasksContainer');
        const subContainer = modalSubContainer.querySelector('.subtasks-container');
        if (subContainer) {
            subContainer.style.display = 'none';
            currentActionWrapper.appendChild(subContainer);
        }
    }
    closeWithAnimation(document.getElementById('taskActionModal'), options);
    currentActionWrapper = null;
};

// ─── Modal de nueva tarea ──────────────────────────────────

export const openNewTaskModal = () => {
    const modal = document.getElementById('newTaskModal');
    modal.style.display = 'flex';
    playEnter(modal);
    setTimeout(() => {
        const input = document.querySelector('#newTaskForm input[name="taskText"]');
        if (input) input.focus();
    }, 10);
};

export const closeNewTaskModal = (options = {}) => {
    closeWithAnimation(document.getElementById('newTaskModal'), {
        restoreFocus: document.getElementById('openNewTaskModal'),
        ...options,
    });
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
    document.getElementById('editTaskTime').value     = wrapper.getAttribute('data-time') || '';

    document.getElementById('editModal').style.display = 'flex';
    playEnter(document.getElementById('editModal'));
    setTimeout(() => document.getElementById('editTaskText')?.focus(), 10);
};

export const closeEditModal = (options = {}) => {
    closeWithAnimation(document.getElementById('editModal'), options);
    currentEditingWrapper = null;
};

export const saveModalChanges = (event) => {
    event.preventDefault();
    if (!currentEditingWrapper) return;

    const newText      = document.getElementById('editTaskText').value.trim();
    const newPriority  = document.getElementById('editTaskPriority').value;
    const newDateValue = document.getElementById('editTaskDate').value;
    const newTimeValue = document.getElementById('editTaskTime').value;
    const hasTime      = isValidTime(newTimeValue);

    if (!newText)           { alert(t('alertEmptyTask'));    return; }
    if (newText.length > 500) { alert(t('alertTaskTooLong')); return; }

    // El pasado sólo se comprueba si la fecha o la hora cambian: si no, una
    // tarea ya vencida no se podría ni renombrar. Por eso se compara con lo
    // que había guardado, no con "ahora".
    const savedDate  = displayDateToIso(currentEditingWrapper.querySelector('.task-date').textContent);
    const savedTime  = currentEditingWrapper.getAttribute('data-time') || '';
    const dueChanged = newDateValue !== savedDate || (hasTime ? newTimeValue : '') !== savedTime;

    if (newDateValue && dueChanged && isDateTimeInPast(newDateValue, newTimeValue)) {
        alert(t(hasTime ? 'alertPastTime' : 'alertPastDate'));
        return;
    }

    const taskEl     = currentEditingWrapper.querySelector('.task');
    const textEl     = taskEl.querySelector('.task-text');
    const dateEl     = taskEl.querySelector('.task-date');
    const timeEl     = taskEl.querySelector('.task-time');

    textEl.textContent = DOMPurify.sanitize(newText);
    taskEl.classList.remove('priority-high', 'priority-medium', 'priority-low');
    taskEl.classList.add(`priority-${newPriority}`);

    const formattedDate = formatDisplayDate(isoStringToDate(newDateValue));
    dateEl.textContent = formattedDate;

    if (hasTime) {
        currentEditingWrapper.setAttribute('data-time', newTimeValue);
        timeEl.textContent = formatDisplayTime(newTimeValue);
    } else {
        currentEditingWrapper.removeAttribute('data-time');
        timeEl.textContent = '';
    }

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

    const openDonateModal = () => {
        donateModal.style.display = 'flex';
        playEnter(donateModal);
        setTimeout(() => donateModal.querySelector('.close-button')?.focus(), 10);
    };
    const closeDonateModal = (options = {}) => {
        closeWithAnimation(donateModal, {
            restoreFocus: document.getElementById('donateButton'),
            ...options,
        });
    };

    document.getElementById('donateButton').onclick = openDonateModal;
    donateModal.querySelector('.close-button').onclick = closeDonateModal;

    document.getElementById('closeEditModal').onclick = closeEditModal;
    document.getElementById('cancelEditButton').onclick = closeEditModal;
    document.getElementById('editTaskForm').onsubmit = saveModalChanges;

    // Vaciar la hora: una vez escrito un <input type="time"> no hay forma
    // obvia de dejarlo vacío, y en los formularios la hora es opcional.
    // El nombre accesible lo pone setLanguage() vía data-i18n-label, porque
    // initModals() corre antes de detectar el idioma.
    [['clearTaskTime', 'taskTime'], ['clearEditTaskTime', 'editTaskTime']].forEach(
        ([buttonId, inputId]) => {
            document.getElementById(buttonId).onclick = () => {
                document.getElementById(inputId).value = '';
            };
        }
    );

    document.getElementById('closeActionModal').onclick = closeActionModal;

    document.getElementById('actionDone').onclick = () => {
        if (currentActionWrapper) changeTaskState(currentActionWrapper, tasksContainer);
    };

    document.getElementById('actionEdit').onclick = () => {
        if (currentActionWrapper) {
            const wrapper = currentActionWrapper;
            // Cierre sin animación: si no, el modal que se va se superpone
            // con el que entra y se ve un parpadeo.
            closeActionModal({ immediate: true });
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
            const wrapper = currentActionWrapper;   // capturar antes de cerrar (luego queda en null)
            closeActionModal({ immediate: true });   // 1) devuelve las subtareas al wrapper
            const snapshot = deleteTask(wrapper, tasksContainer); // 2) borra y persiste
            showUndoToast(snapshot);                // 3) toast + temporizador de 5 s
        }
    };

    window.addEventListener('click', (e) => {
        if (e.target === donateModal)     closeDonateModal();
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
