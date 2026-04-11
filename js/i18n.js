// ============================================================
// i18n.js — Responsabilidad: Traducciones e idioma de la UI
// ============================================================

export const translations = {
    en: {
        pageTitle: 'To-Do List',
        taskPlaceholder: 'New task',
        priorityLabel: 'Priority:',
        dateLabel: 'Date:',
        priorityHigh: 'High',
        priorityMedium: 'Medium',
        priorityLow: 'Low',
        orderButton: 'Order',
        alertTaskTooLong: 'Task text is too long. Maximum 500 characters allowed.',
        alertMaxTasks: 'Maximum number of tasks reached.',
        alertEmptyTask: 'Task cannot be empty.',
        donateButton: 'Donate',
        donateTitle: 'Donate',
        copyButton: 'Copy',
        alertPastDate: 'Task date cannot be in the past.',
        alertInvalidPriority: 'Invalid priority value submitted.',
        filterButtonToday: 'Focus Mode',
        filterButtonAll: 'Show All',
        exportButton: 'Export',
        importButton: 'Import',
        confirmImport: 'Are you sure? This will replace your current tasks.',
        alertImportError: 'Error importing file. Make sure it is a valid JSON.',
        addSubtask: 'Add Subtask',
        subtaskPlaceholder: 'New subtask...',
        recurrenceNone: 'No repeat',
        recurrenceDaily: 'Daily',
        recurrenceWeekly: 'Weekly',
        recurrenceMonthly: 'Monthly',
        repeatButtonTitle: 'Set recurrence',
        editTaskTitle: 'Edit Task',
        saveButton: 'Save',
        cancelButton: 'Cancel',
    },
    es: {
        pageTitle: 'Lista de Tareas',
        taskPlaceholder: 'Nueva tarea',
        priorityLabel: 'Prioridad:',
        dateLabel: 'Fecha:',
        priorityHigh: 'Alta',
        priorityMedium: 'Media',
        priorityLow: 'Baja',
        orderButton: 'Ordenar',
        alertTaskTooLong: 'El texto de la tarea es demasiado largo. Máximo 500 caracteres permitidos.',
        alertMaxTasks: 'Número máximo de tareas alcanzado.',
        alertEmptyTask: 'La tarea no puede estar vacía.',
        donateButton: 'Donar',
        donateTitle: 'Donar',
        copyButton: 'Copiar',
        alertPastDate: 'La fecha de la tarea no puede ser anterior a la fecha actual.',
        alertInvalidPriority: 'Valor de prioridad inválido.',
        filterButtonToday: 'Modo Enfoque',
        filterButtonAll: 'Ver Todo',
        exportButton: 'Exportar',
        importButton: 'Importar',
        confirmImport: '¿Estás seguro? Esto reemplazará tus tareas actuales.',
        alertImportError: 'Error al importar el archivo. Asegúrate de que sea un JSON válido.',
        addSubtask: 'Añadir subtarea',
        subtaskPlaceholder: 'Nueva subtarea...',
        recurrenceNone: 'Sin repetición',
        recurrenceDaily: 'Diaria',
        recurrenceWeekly: 'Semanal',
        recurrenceMonthly: 'Mensual',
        repeatButtonTitle: 'Establecer repetición',
        editTaskTitle: 'Editar Tarea',
        saveButton: 'Guardar',
        cancelButton: 'Cancelar',
    }
};

let currentLang = 'en';

export const getLang = () => currentLang;

export const t = (key) => translations[currentLang][key] ?? key;

/**
 * Aplica las traducciones a todos los elementos [data-i18n-key] del DOM.
 * Llama a `onAfterSet` una vez terminado (útil para re-renderizar la fecha).
 */
export const setLanguage = (lang, onAfterSet = null) => {
    currentLang = lang;

    document.querySelectorAll('[data-i18n-key]').forEach(el => {
        const key = el.getAttribute('data-i18n-key');
        const translation = translations[lang][key];
        if (!translation) return;

        if (el.tagName === 'INPUT') {
            if (el.placeholder) el.placeholder = translation;
        } else {
            if (el.hasAttribute('title')) el.title = translation;

            if (key === 'recurrenceBadge' && el.hasAttribute('data-recurrence-value')) {
                const recVal = el.getAttribute('data-recurrence-value');
                const recKey = `recurrence${recVal.charAt(0).toUpperCase() + recVal.slice(1)}`;
                el.textContent = translations[lang][recKey];
            } else if (el.childNodes.length <= 1) {
                el.textContent = translation;
            }
        }
    });

    document.title = translations[lang].pageTitle;
    onAfterSet?.();
};

/**
 * Detecta el idioma del navegador y aplica el más cercano disponible.
 */
export const detectLanguage = (onAfterSet = null) => {
    const browserLang = navigator.language.split('-')[0];
    setLanguage(browserLang === 'es' ? 'es' : 'en', onAfterSet);
};
