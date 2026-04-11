// Diccionario de traducciones para los textos de la interfaz.
const translations = {
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

const VALID_PRIORITIES = ['high', 'medium', 'low'];
const VALID_RECURRENCES = ['none', 'daily', 'weekly', 'monthly'];

let currentLang = 'en'; 
let currentEditingTaskWrapper = null;

/**
 * Cambia el idioma de la interfaz y actualiza los textos.
 */
const setLanguage = (lang) => {
    currentLang = lang;
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        let translation = translations[lang][key];
        
        if (element.tagName === 'INPUT') {
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else {
            if (element.hasAttribute('title')) {
                element.title = translation;
            }
            
            if (key === 'recurrenceBadge' && element.hasAttribute('data-recurrence-value')) {
                const recurrenceValue = element.getAttribute('data-recurrence-value');
                const recurrenceKey = `recurrence${recurrenceValue.charAt(0).toUpperCase() + recurrenceValue.slice(1)}`;
                element.textContent = translations[lang][recurrenceKey];
            } else if (element.childNodes.length <= 1) {
                element.textContent = translation;
            }
        }
    });
    document.title = translations[lang].pageTitle;
    setDate(); 
};

const detectLanguage = () => {
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'es') {
        setLanguage('es');
    } else {
        setLanguage('en');
    }
};

const dateNumber = document.getElementById('dateNumber');
const dateText = document.getElementById('dateText');
const dateMonth = document.getElementById('dateMonth');
const dateYear = document.getElementById('dateYear');
const tasksContainer = document.getElementById('tasksContainer');

const setDate = () => {
    const date = new Date();
    dateNumber.textContent = date.toLocaleString(currentLang, { day: 'numeric' });
    dateText.textContent = date.toLocaleString(currentLang, { weekday: 'long' });
    dateMonth.textContent = date.toLocaleString(currentLang, { month: 'short' });
    dateYear.textContent = date.toLocaleString(currentLang, { year: 'numeric' });
};

const saveTasks = () => {
    try {
        const tasks = [];
        tasksContainer.querySelectorAll('.task-wrapper').forEach(el => {
            const taskEl = el.querySelector('.task');
            const taskText = taskEl.querySelector('.task-text').textContent;
            const taskDate = taskEl.querySelector('.task-date').textContent;
            const priority = taskEl.classList.contains('priority-high') ? 'high' : taskEl.classList.contains('priority-medium') ? 'medium' : 'low';
            
            const recurrence = el.getAttribute('data-recurrence') || 'none';
            const lastCompleted = el.getAttribute('data-last-completed') || null;

            const subtasks = [];
            el.querySelectorAll('.subtask-item').forEach(subEl => {
                subtasks.push({
                    text: subEl.querySelector('.subtask-text').textContent,
                    done: subEl.querySelector('.subtask-checkbox').checked
                });
            });

            tasks.push({
                text: taskText,
                done: taskEl.classList.contains('done'),
                date: taskDate,
                priority: priority,
                subtasks: subtasks,
                recurrence: recurrence,
                lastCompleted: lastCompleted
            });
        });
        localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
};

const loadTasks = () => {
    try {
        const tasksData = localStorage.getItem('tasks');
        if (!tasksData) return;
        
        const tasks = JSON.parse(tasksData);
        if (!Array.isArray(tasks)) return;

        tasks.forEach(task => {
            if (typeof task.text === 'string' && typeof task.done === 'boolean') {
                const date = task.date || new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
                const priority = task.priority || 'medium';
                const subtasks = task.subtasks || [];
                const recurrence = task.recurrence || 'none';
                let lastCompleted = task.lastCompleted ? parseInt(task.lastCompleted) : null;
                let done = task.done;

                if (done && recurrence !== 'none' && lastCompleted) {
                    const lastDate = new Date(lastCompleted);
                    const currentDate = new Date();
                    
                    let shouldReset = false;
                    if (recurrence === 'daily') {
                        shouldReset = lastDate.getDate() !== currentDate.getDate() || 
                                     lastDate.getMonth() !== currentDate.getMonth() || 
                                     lastDate.getFullYear() !== currentDate.getFullYear();
                    } else if (recurrence === 'weekly') {
                        const diffTime = Math.abs(currentDate - lastDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        shouldReset = diffDays >= 7;
                    } else if (recurrence === 'monthly') {
                        shouldReset = lastDate.getMonth() !== currentDate.getMonth() || 
                                     lastDate.getFullYear() !== currentDate.getFullYear();
                    }

                    if (shouldReset) {
                        done = false;
                        lastCompleted = null;
                    }
                }

                const taskElement = createTaskElement(task.text, date, priority, subtasks, recurrence, lastCompleted);
                if (done) {
                    taskElement.querySelector('.task').classList.add('done');
                }
                tasksContainer.appendChild(taskElement);
            }
        });
    } catch (error) {
        console.error('Error loading tasks:', error);
        localStorage.removeItem('tasks');
    }
}

const createTaskElement = (text, date, priority, subtasksData = [], recurrence = 'none', lastCompleted = null) => {
    const taskWrapper = document.createElement('div');
    taskWrapper.classList.add('task-wrapper');
    taskWrapper.draggable = true;
    taskWrapper.setAttribute('data-recurrence', recurrence);
    if (lastCompleted) {
        taskWrapper.setAttribute('data-last-completed', lastCompleted);
    }

    taskWrapper.addEventListener('dragstart', () => taskWrapper.classList.add('dragging'));
    taskWrapper.addEventListener('dragend', () => {
        taskWrapper.classList.remove('dragging');
        saveTasks();
    });

    const mainRow = document.createElement('div');
    mainRow.classList.add('task-main-row');

    const task = document.createElement('div');
    task.classList.add('task', 'roundBorder', `priority-${priority}`);
    
    const todayStr = new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    if (date === todayStr) {
        task.classList.add('due-today');
    }

    task.addEventListener('click', changeTaskState);

    const taskContentWrapper = document.createElement('div');
    taskContentWrapper.classList.add('task-content-wrapper');

    const taskText = document.createElement('span');
    taskText.classList.add('task-text');
    taskText.textContent = DOMPurify.sanitize(text);

    const recurrenceBadge = document.createElement('span');
    recurrenceBadge.classList.add('recurrence-badge');
    recurrenceBadge.setAttribute('data-i18n-key', 'recurrenceBadge');
    if (recurrence !== 'none') {
        const recurrenceKey = `recurrence${recurrence.charAt(0).toUpperCase() + recurrence.slice(1)}`;
        recurrenceBadge.textContent = translations[currentLang][recurrenceKey];
        recurrenceBadge.setAttribute('data-recurrence-value', recurrence);
    }

    taskContentWrapper.appendChild(taskText);
    taskContentWrapper.appendChild(recurrenceBadge);

    const taskDate = document.createElement('span');
    taskDate.classList.add('task-date');
    taskDate.textContent = date;

    task.appendChild(taskContentWrapper);
    task.appendChild(taskDate);

    const recurrenceButton = document.createElement('button');
    recurrenceButton.textContent = '🔁';
    recurrenceButton.classList.add('recurrence-button');
    if (recurrence !== 'none') recurrenceButton.classList.add('active');
    recurrenceButton.setAttribute('data-i18n-key', 'repeatButtonTitle');
    recurrenceButton.title = translations[currentLang].repeatButtonTitle;
    recurrenceButton.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleRecurrence(e);
    });

    const subtaskButton = document.createElement('button');
    subtaskButton.textContent = '➕';
    subtaskButton.classList.add('subtask-button');
    subtaskButton.setAttribute('data-i18n-key', 'addSubtask');
    subtaskButton.title = translations[currentLang].addSubtask;
    subtaskButton.addEventListener('click', (e) => {
        e.stopPropagation();
        showSubtaskInput(e);
    });

    const editButton = document.createElement('button');
    editButton.textContent = '✏️';
    editButton.classList.add('edit-button');
    editButton.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(e);
    });

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '❌';
    deleteButton.classList.add('delete-button');
    deleteButton.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTask(e);
    });

    mainRow.appendChild(task);
    mainRow.appendChild(recurrenceButton);
    mainRow.appendChild(subtaskButton);
    mainRow.appendChild(editButton);
    mainRow.appendChild(deleteButton);

    const subtasksContainer = document.createElement('div');
    subtasksContainer.classList.add('subtasks-container');
    subtasksData.forEach(sub => subtasksContainer.appendChild(createSubtaskElement(sub.text, sub.done)));

    taskWrapper.appendChild(mainRow);
    taskWrapper.appendChild(subtasksContainer);
    
    return taskWrapper;
};

const openEditModal = (event) => {
    const taskWrapper = event.target.closest('.task-wrapper');
    currentEditingTaskWrapper = taskWrapper;

    const taskText = taskWrapper.querySelector('.task-text').textContent;
    const taskDate = taskWrapper.querySelector('.task-date').textContent;
    const taskEl = taskWrapper.querySelector('.task');
    
    let priority = 'medium';
    if (taskEl.classList.contains('priority-high')) priority = 'high';
    if (taskEl.classList.contains('priority-low')) priority = 'low';

    document.getElementById('editTaskText').value = taskText;
    document.getElementById('editTaskPriority').value = priority;
    
    const dateParts = taskDate.split('/');
    if (dateParts.length === 3) {
        let year = '20' + dateParts[2];
        let day, month;
        if (currentLang === 'es') {
            day = dateParts[0].padStart(2, '0');
            month = dateParts[1].padStart(2, '0');
        } else {
            month = dateParts[0].padStart(2, '0');
            day = dateParts[1].padStart(2, '0');
        }
        document.getElementById('editTaskDate').value = `${year}-${month}-${day}`;
    }

    document.getElementById('editModal').style.display = 'block';
};

const closeEditModal = () => {
    document.getElementById('editModal').style.display = 'none';
    currentEditingTaskWrapper = null;
};

const saveModalChanges = (event) => {
    event.preventDefault();
    if (!currentEditingTaskWrapper) return;

    const newText = document.getElementById('editTaskText').value.trim();
    const newPriority = document.getElementById('editTaskPriority').value;
    const newDateValue = document.getElementById('editTaskDate').value;

    if (!newText) {
        alert(translations[currentLang].alertEmptyTask);
        return;
    }

    if (newText.length > 500) {
        alert(translations[currentLang].alertTaskTooLong);
        return;
    }

    if (newDateValue) {
        const [year, month, day] = newDateValue.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const todayNormalized = new Date();
        todayNormalized.setHours(0, 0, 0, 0);

        if (selectedDate < todayNormalized) {
            alert(translations[currentLang].alertPastDate);
            return;
        }
    }

    const taskEl = currentEditingTaskWrapper.querySelector('.task');
    const taskTextEl = taskEl.querySelector('.task-text');
    const taskDateEl = taskEl.querySelector('.task-date');

    taskTextEl.textContent = DOMPurify.sanitize(newText);
    taskEl.classList.remove('priority-high', 'priority-medium', 'priority-low');
    taskEl.classList.add(`priority-${newPriority}`);

    const [year, month, day] = newDateValue.split('-');
    const formattedDate = new Date(year, month - 1, day).toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    taskDateEl.textContent = formattedDate;

    const todayStr = new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    if (formattedDate === todayStr) {
        taskEl.classList.add('due-today');
    } else {
        taskEl.classList.remove('due-today');
    }

    saveTasks();
    closeEditModal();
};

const toggleRecurrence = (event) => {
    const taskWrapper = event.target.closest('.task-wrapper');
    const badge = taskWrapper.querySelector('.recurrence-badge');
    const button = event.target;
    
    let currentRec = taskWrapper.getAttribute('data-recurrence') || 'none';
    let nextIndex = (VALID_RECURRENCES.indexOf(currentRec) + 1) % VALID_RECURRENCES.length;
    let nextRec = VALID_RECURRENCES[nextIndex];

    taskWrapper.setAttribute('data-recurrence', nextRec);
    
    if (nextRec === 'none') {
        badge.textContent = '';
        badge.removeAttribute('data-recurrence-value');
        button.classList.remove('active');
    } else {
        const recurrenceKey = `recurrence${nextRec.charAt(0).toUpperCase() + nextRec.slice(1)}`;
        badge.textContent = translations[currentLang][recurrenceKey];
        badge.setAttribute('data-recurrence-value', nextRec);
        button.classList.add('active');
    }
    saveTasks();
};

const createSubtaskElement = (text, done) => {
    const subtaskItem = document.createElement('div');
    subtaskItem.classList.add('subtask-item');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.classList.add('subtask-checkbox');
    checkbox.checked = done;
    checkbox.addEventListener('change', () => {
        subtaskText.classList.toggle('subtask-done', checkbox.checked);
        saveTasks();
    });

    const subtaskText = document.createElement('span');
    subtaskText.classList.add('subtask-text');
    subtaskText.textContent = DOMPurify.sanitize(text);
    if (done) subtaskText.classList.add('subtask-done');

    const deleteSubButton = document.createElement('button');
    deleteSubButton.textContent = '×';
    deleteSubButton.classList.add('subtask-delete');
    deleteSubButton.addEventListener('click', () => {
        subtaskItem.remove();
        saveTasks();
    });

    subtaskItem.appendChild(checkbox);
    subtaskItem.appendChild(subtaskText);
    subtaskItem.appendChild(deleteSubButton);
    return subtaskItem;
};

const showSubtaskInput = (event) => {
    const taskWrapper = event.target.closest('.task-wrapper');
    const container = taskWrapper.querySelector('.subtasks-container');
    if (container.querySelector('.subtask-input-wrapper')) return;

    const inputWrapper = document.createElement('div');
    inputWrapper.classList.add('subtask-input-wrapper');

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = translations[currentLang].subtaskPlaceholder;
    input.classList.add('subtask-input');
    input.setAttribute('data-i18n-key', 'subtaskPlaceholder');

    const saveBtn = document.createElement('button');
    saveBtn.textContent = '✅';
    saveBtn.addEventListener('click', () => {
        const text = input.value.trim();
        if (text) {
            container.appendChild(createSubtaskElement(text, false));
            inputWrapper.remove();
            saveTasks();
        }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '❌';
    cancelBtn.addEventListener('click', () => inputWrapper.remove());

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveBtn.click();
        if (e.key === 'Escape') cancelBtn.click();
    });

    inputWrapper.appendChild(input);
    inputWrapper.appendChild(saveBtn);
    inputWrapper.appendChild(cancelBtn);
    container.appendChild(inputWrapper);
    input.focus();
};

const addNewTask = event => {
    event.preventDefault();
    const { value } = event.target.taskText;
    const priority = event.target.taskPriority.value;
    const dateValue = event.target.taskDate.value;

    if (!value.trim()) { alert(translations[currentLang].alertEmptyTask); return; }
    if (value.length > 500) { alert(translations[currentLang].alertTaskTooLong); return; }
    if (tasksContainer.childNodes.length >= 100) { alert(translations[currentLang].alertMaxTasks); return; }

    if (dateValue) {
        const [year, month, day] = dateValue.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);
        const todayNormalized = new Date();
        todayNormalized.setHours(0, 0, 0, 0);
        if (selectedDate < todayNormalized) { alert(translations[currentLang].alertPastDate); return; }
    }

    let date;
    if (dateValue) {
        const [year, month, day] = dateValue.split('-');
        date = new Date(year, month - 1, day).toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    } else {
        date = new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    const task = createTaskElement(value, date, priority);
    tasksContainer.prepend(task);
    event.target.reset();
    saveTasks();
};

const changeTaskState = event => {
    const taskElement = event.target.closest('.task');
    if (!taskElement) return;
    const taskWrapper = taskElement.closest('.task-wrapper');
    const isDone = taskElement.classList.toggle('done');
    if (isDone) {
        taskWrapper.setAttribute('data-last-completed', new Date().getTime());
    } else {
        taskWrapper.removeAttribute('data-last-completed');
    }
    saveTasks();
};

const deleteTask = event => {
    const taskWrapper = event.target.closest('.task-wrapper');
    taskWrapper.remove();
    saveTasks();
}

const renderOrderedTasks = () => {
    const done = [];
    const toDo = [];
    tasksContainer.childNodes.forEach(el => {
        if (el.classList.contains('task-wrapper')) {
            el.querySelector('.task').classList.contains('done') ? done.push(el) : toDo.push(el);
        }
    });
    [...toDo, ...done].forEach(el => tasksContainer.appendChild(el));
    saveTasks();
};

const highlightDueTasks = () => {
    const today = new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    tasksContainer.querySelectorAll('.task-wrapper').forEach(taskWrapper => {
        const taskDateElement = taskWrapper.querySelector('.task-date');
        if (taskDateElement && taskDateElement.textContent === today) {
            taskWrapper.querySelector('.task').classList.add('due-today');
        } else {
            taskWrapper.querySelector('.task').classList.remove('due-today');
        }
    });
};

const toggleFilterToday = (event) => {
    const button = event.target;
    const isActive = tasksContainer.classList.toggle('filter-today-active');
    button.textContent = isActive ? translations[currentLang].filterButtonAll : translations[currentLang].filterButtonToday;
    button.classList.toggle('filter-active', isActive);
};

const exportTasks = () => {
    const tasksData = localStorage.getItem('tasks');
    if (!tasksData) return;
    const blob = new Blob([tasksData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `todolist_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

const importTasks = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const tasks = JSON.parse(e.target.result);
            if (confirm(translations[currentLang].confirmImport)) {
                localStorage.setItem('tasks', JSON.stringify(tasks));
                tasksContainer.innerHTML = '';
                loadTasks();
                highlightDueTasks();
            }
        } catch (error) { alert(translations[currentLang].alertImportError); }
        event.target.value = '';
    };
    reader.readAsText(file);
};

const getDragAfterElement = (container, y) => {
    const draggableElements = [...container.querySelectorAll('.task-wrapper:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) return { offset: offset, element: child };
        else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
};

document.addEventListener('DOMContentLoaded', () => {
    detectLanguage();
    loadTasks();
    highlightDueTasks();

    tasksContainer.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(tasksContainer, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (draggable) {
            if (afterElement == null) tasksContainer.appendChild(draggable);
            else tasksContainer.insertBefore(draggable, afterElement);
        }
    });

    const minDate = new Date().toISOString().split('T')[0];
    if (document.getElementById('taskDate')) document.getElementById('taskDate').min = minDate;
    if (document.getElementById('editTaskDate')) document.getElementById('editTaskDate').min = minDate;

    // Donate Modal
    const donateModal = document.getElementById('donateModal');
    document.getElementById('donateButton').onclick = () => donateModal.style.display = 'block';
    donateModal.querySelector('.close-button').onclick = () => donateModal.style.display = 'none';

    // Edit Modal
    const editModal = document.getElementById('editModal');
    document.getElementById('closeEditModal').onclick = closeEditModal;
    document.getElementById('cancelEditButton').onclick = closeEditModal;
    document.getElementById('editTaskForm').onsubmit = saveModalChanges;

    window.onclick = (event) => {
        if (event.target == donateModal) donateModal.style.display = 'none';
        if (event.target == editModal) closeEditModal();
    }

    document.querySelectorAll('.copy-button').forEach(button => {
        button.addEventListener('click', (event) => {
            const input = event.target.previousElementSibling.querySelector('input');
            input.select();
            document.execCommand('copy');
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => button.textContent = originalText, 2000);
        });
    });
});