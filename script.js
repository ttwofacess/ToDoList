// Diccionario de traducciones para los textos de la interfaz.
const translations = {
    en: {
        pageTitle: 'To-Do List',
        taskPlaceholder: 'New task',
        priorityLabel: 'Priority:',
        dateLabel: 'Date:',
        /* datePlaceholder: 'Date',
        dateTitle: 'mm-dd-yyyy', */
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
    },
    es: {
        pageTitle: 'Lista de Tareas',
        taskPlaceholder: 'Nueva tarea',
        priorityLabel: 'Prioridad:',
        dateLabel: 'Fecha:',
        /* datePlaceholder: 'Fecha',
        dateTitle: 'dd-mm-aaaa', */
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
    }
};

// Array de prioridades válidas para validación.
const VALID_PRIORITIES = ['high', 'medium', 'low'];
// Array de recurrencias válidas para validación.
const VALID_RECURRENCES = ['none', 'daily', 'weekly', 'monthly'];

// Variable para almacenar el idioma actual. Por defecto es inglés.
let currentLang = 'en'; // Default language

/**
 * Cambia el idioma de la interfaz y actualiza los textos.
 * @param {string} lang - Código de idioma ('en' o 'es').
 */
const setLanguage = (lang) => {
    currentLang = lang;
    document.querySelectorAll('[data-i18n-key]').forEach(element => {
        const key = element.getAttribute('data-i18n-key');
        let translation = translations[lang][key];
        
        if (element.tagName === 'INPUT') {
            if (element.type === 'date') {
                element.title = translations[lang]['dateTitle'];
            }
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else {
            if (element.hasAttribute('title')) {
                element.title = translation;
            }
            
            // Manejo especial para la etiqueta de recurrencia que es dinámica
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
    setDate(); // Update date format
};

/**
 * Detecta el idioma del navegador y ajusta la interfaz en consecuencia.
 */
const detectLanguage = () => {
    const browserLang = navigator.language.split('-')[0];
    if (browserLang === 'es') {
        setLanguage('es');
    } else {
        setLanguage('en');
    }
};

// Obtiene los elementos del DOM para mostrar la fecha.
const dateNumber = document.getElementById('dateNumber');
const dateText = document.getElementById('dateText');
const dateMonth = document.getElementById('dateMonth');
const dateYear = document.getElementById('dateYear');

// Obtiene el contenedor de tareas del DOM.
const tasksContainer = document.getElementById('tasksContainer');

/**
 * Establece la fecha actual en los elementos del DOM correspondientes.
 * Utiliza el objeto `Date` para obtener la fecha y la formatea en el idioma actual.
 */
const setDate = () => {
    const date = new Date();
    dateNumber.textContent = date.toLocaleString(currentLang, { day: 'numeric' });
    dateText.textContent = date.toLocaleString(currentLang, { weekday: 'long' });
    dateMonth.textContent = date.toLocaleString(currentLang, { month: 'short' });
    dateYear.textContent = date.toLocaleString(currentLang, { year: 'numeric' });
};

/**
 * Guarda las tareas actuales en el almacenamiento local (localStorage).
 * Recorre los elementos de tarea en el contenedor, extrae la información
 * (texto, estado "done" y fecha) y la guarda como un array de objetos JSON.
 */
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

/**
 * Carga las tareas desde el almacenamiento local al iniciar la página.
 * Obtiene las tareas guardadas, las parsea desde JSON y crea los elementos
 * de tarea correspondientes en el DOM.
 */
const loadTasks = () => {
    try {
        const tasksData = localStorage.getItem('tasks');
        if (!tasksData) return;
        
        const tasks = JSON.parse(tasksData);
        if (!Array.isArray(tasks)) return;

        const now = new Date().getTime();

        tasks.forEach(task => {
            if (typeof task.text === 'string' && typeof task.done === 'boolean') {
                const date = task.date || new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
                const priority = task.priority || 'medium';
                const subtasks = task.subtasks || [];
                const recurrence = task.recurrence || 'none';
                let lastCompleted = task.lastCompleted ? parseInt(task.lastCompleted) : null;
                let done = task.done;

                // Lógica de auto-reinicio para tareas recurrentes
                if (done && recurrence !== 'none' && lastCompleted) {
                    const lastDate = new Date(lastCompleted);
                    const currentDate = new Date();
                    
                    let shouldReset = false;
                    if (recurrence === 'daily') {
                        // Reset si es un día diferente
                        shouldReset = lastDate.getDate() !== currentDate.getDate() || 
                                     lastDate.getMonth() !== currentDate.getMonth() || 
                                     lastDate.getFullYear() !== currentDate.getFullYear();
                    } else if (recurrence === 'weekly') {
                        // Reset si han pasado más de 7 días o es una semana diferente
                        const diffTime = Math.abs(currentDate - lastDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        shouldReset = diffDays >= 7;
                    } else if (recurrence === 'monthly') {
                        // Reset si es un mes diferente
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
        localStorage.removeItem('tasks'); // Limpia datos corruptos si los hay.
    }
}

/**
 * Crea un nuevo elemento de tarea en el DOM.
 * @param {string} text - El texto de la tarea.
 * @param {string} date - La fecha de creación de la tarea.
 * @param {string} priority - La prioridad de la tarea.
 * @param {Array} subtasksData - Lista de subtareas (opcional).
 * @param {string} recurrence - Tipo de recurrencia (opcional).
 * @param {number} lastCompleted - Timestamp de la última vez que se completó (opcional).
 * @returns {HTMLElement} El elemento de tarea (`div.task-wrapper`) creado.
 */
const createTaskElement = (text, date, priority, subtasksData = [], recurrence = 'none', lastCompleted = null) => {
    const taskWrapper = document.createElement('div');
    taskWrapper.classList.add('task-wrapper');
    taskWrapper.draggable = true; // Habilitar arrastre
    taskWrapper.setAttribute('data-recurrence', recurrence);
    if (lastCompleted) {
        taskWrapper.setAttribute('data-last-completed', lastCompleted);
    }

    taskWrapper.addEventListener('dragstart', () => {
        taskWrapper.classList.add('dragging');
    });

    taskWrapper.addEventListener('dragend', () => {
        taskWrapper.classList.remove('dragging');
        saveTasks(); // Guardar el nuevo orden al terminar de arrastrar
    });

    const mainRow = document.createElement('div');
    mainRow.classList.add('task-main-row');

    const task = document.createElement('div');
    task.classList.add('task', 'roundBorder', `priority-${priority}`);
    
    // Comprobar si la tarea es para hoy
    const todayStr = new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    if (date === todayStr) {
        task.classList.add('due-today');
    }

    task.addEventListener('click', changeTaskState);

    const taskContentWrapper = document.createElement('div');
    taskContentWrapper.classList.add('task-content-wrapper');

    const taskText = document.createElement('span');
    taskText.classList.add('task-text');
    // Sanitiza el texto para prevenir ataques XSS.
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
    editButton.addEventListener('click', editTask);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '❌';
    deleteButton.classList.add('delete-button');
    deleteButton.addEventListener('click', deleteTask);

    mainRow.appendChild(task);
    mainRow.appendChild(recurrenceButton);
    mainRow.appendChild(subtaskButton);
    mainRow.appendChild(editButton);
    mainRow.appendChild(deleteButton);

    const subtasksContainer = document.createElement('div');
    subtasksContainer.classList.add('subtasks-container');
    
    subtasksData.forEach(sub => {
        subtasksContainer.appendChild(createSubtaskElement(sub.text, sub.done));
    });

    taskWrapper.appendChild(mainRow);
    taskWrapper.appendChild(subtasksContainer);
    
    return taskWrapper;
};

/**
 * Cicla entre los tipos de recurrencia para una tarea.
 * @param {Event} event - El evento de clic en el botón de recurrencia.
 */
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

/**
 * Crea un elemento DOM para una subtarea.
 * @param {string} text - El texto de la subtarea.
 * @param {boolean} done - Si la subtarea está completada.
 * @returns {HTMLElement} El elemento de la subtarea.
 */
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

/**
 * Muestra el input para añadir una nueva subtarea.
 * @param {Event} event - El evento de clic.
 */
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

/**
 * Maneja el evento de agregar una nueva tarea.
 * Previene el comportamiento por defecto del formulario, valida la entrada,
 * crea la nueva tarea y la agrega al principio del contenedor.
 * @param {Event} event - El evento del formulario.
 */
const addNewTask = event => {
    event.preventDefault();

    const { value } = event.target.taskText;
    const priority = event.target.taskPriority.value;

    if (!VALID_PRIORITIES.includes(priority)) {
        alert(translations[currentLang].alertInvalidPriority);
        return;
    }
    // El input `taskDate` (type="date") devuelve una cadena en formato
    // 'YYYY-MM-DD'. Aquí la leemos para validarla y compararla con la fecha actual.
    const dateValue = event.target.taskDate.value;

    if (dateValue) {
        const [year, month, day] = dateValue.split('-').map(Number);
        const selectedDate = new Date(year, month - 1, day);

        const todayNormalized = new Date();
        todayNormalized.setHours(0, 0, 0, 0);

        if (selectedDate < todayNormalized) {
            alert(translations[currentLang].alertPastDate);
            return;
        }
    }

    if (!value.trim()) {
        alert(translations[currentLang].alertEmptyTask);
        return;
    }

    // Validaciones para la longitud del texto y el número de tareas.
    if (value.length > 500) {
        alert(translations[currentLang].alertTaskTooLong);
        return;
    }
    
    if (tasksContainer.childNodes.length >= 100) {
        alert(translations[currentLang].alertMaxTasks);
        return;
    }

    let date;
    if (dateValue) {
        const [year, month, day] = dateValue.split('-');
        date = new Date(year, month - 1, day).toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    } else {
        date = new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    const task = createTaskElement(value, date, priority, [], 'none', null);
    tasksContainer.prepend(task);
    event.target.reset();
    saveTasks();
};

/**
 * Cambia el estado de una tarea (completada/pendiente) al hacer clic en ella.
 * @param {Event} event - El evento de clic.
 */
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
    
    saveTasks(); // Guarda el nuevo estado en localStorage.
};

/**
 * Elimina una tarea del DOM y actualiza el almacenamiento local.
 * @param {Event} event - El evento de clic en el botón de eliminar.
 */
const deleteTask = event => {
    const taskWrapper = event.target.closest('.task-wrapper');
    taskWrapper.remove();
    saveTasks();
}

/**
 * Cancela la edición de una tarea y restaura su texto original.
 * @param {Event} event - El evento que dispara la cancelación.
 * @param {string} originalText - El texto original de la tarea a restaurar.
 */
const cancelEdit = (event, originalText) => {
    const taskWrapper = event.target.closest('.task-wrapper');
    const input = taskWrapper.querySelector('.edit-input');

    const originalTaskTextElement = document.createElement('span');
    originalTaskTextElement.classList.add('task-text');
    originalTaskTextElement.textContent = originalText; // Texto original, no necesita sanitización.
    
    if(input) {
        input.replaceWith(originalTaskTextElement);
    }

    const editButton = taskWrapper.querySelector('.edit-button');
    editButton.textContent = '✏️';
    editButton.onclick = editTask; // Se restaura el evento original.

    const cancelButton = taskWrapper.querySelector('.cancel-button');
    if (cancelButton) {
        cancelButton.remove();
    }
};


/**
 * Maneja el evento de editar una tarea, permitiendo al usuario modificar el texto.
 * @param {Event} event - El evento de clic en el botón de editar.
 */
const editTask = event => {
    const taskWrapper = event.target.closest('.task-wrapper');
    const taskTextElement = taskWrapper.querySelector('.task .task-text');
    const originalText = taskTextElement.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = originalText;
    input.classList.add('edit-input');

    taskTextElement.replaceWith(input);
    input.focus();

    const editButton = taskWrapper.querySelector('.edit-button');
    editButton.textContent = '💾'; // Cambia a ícono de guardar
    // Pasa el texto original a las funciones de guardar y cancelar.
    editButton.onclick = (e) => saveEditedTask(e, originalText);

    const cancelButton = document.createElement('button');
    cancelButton.textContent = '↩️'; // Ícono de cancelar/deshacer
    cancelButton.classList.add('cancel-button');
    cancelButton.onclick = (e) => cancelEdit(e, originalText);
    
    editButton.after(cancelButton); // Añade el botón de cancelar junto al de guardar.
};

/**
 * Guarda el texto modificado de una tarea.
 * @param {Event} event - El evento de clic en el botón de guardar.
 * @param {string} originalText - El texto original, para restaurar si la validación falla.
 */
const saveEditedTask = (event, originalText) => {
    const taskWrapper = event.target.closest('.task-wrapper');
    const input = taskWrapper.querySelector('.edit-input');
    const newText = input.value.trim(); // Usa trim() para eliminar espacios al inicio y final.

    // Validación para no permitir tareas vacías.
    if (!newText) {
        alert(translations[currentLang].alertEmptyTask);
        cancelEdit(event, originalText); // Restaura el estado original.
        return;
    }

    if (newText.length > 500) {
        alert(translations[currentLang].alertTaskTooLong);
        return;
    }

    const newTaskTextElement = document.createElement('span');
    newTaskTextElement.classList.add('task-text');
    // Sanitiza el nuevo texto antes de insertarlo en el DOM para prevenir XSS.
    newTaskTextElement.textContent = DOMPurify.sanitize(newText);

    input.replaceWith(newTaskTextElement);

    const editButton = taskWrapper.querySelector('.edit-button');
    editButton.textContent = '✏️';
    editButton.onclick = editTask; // Restaura el manejador de evento para editar.

    const cancelButton = taskWrapper.querySelector('.cancel-button');
    if (cancelButton) {
        cancelButton.remove();
    }

    saveTasks();
};

/**
 * Ordena las tareas, separando las completadas de las pendientes.
 * @returns {Array<HTMLElement>} Un array con los elementos de tarea ordenados.
 */
const order = () => {
    const done = [];
    const toDo = [];
    tasksContainer.childNodes.forEach(el => {
        if (el.classList.contains('task-wrapper')) {
            const taskEl = el.querySelector('.task');
            taskEl.classList.contains('done') ? done.push(el) : toDo.push(el);
        }
    });
    return [...toDo, ...done];
};

/**
 * Renderiza las tareas en el contenedor en el orden correcto (pendientes primero).
 */
const renderOrderedTasks = () => {
    order().forEach(el => tasksContainer.appendChild(el));
    saveTasks(); // Guarda el nuevo orden en localStorage.
};

/**
 * Resalta las tareas que vencen en el día actual.
 */
const highlightDueTasks = () => {
    const today = new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    const tasks = tasksContainer.querySelectorAll('.task-wrapper');

    tasks.forEach(taskWrapper => {
        const taskDateElement = taskWrapper.querySelector('.task-date');
        if (taskDateElement && taskDateElement.textContent === today) {
            taskWrapper.querySelector('.task').classList.add('due-today');
        } else {
            taskWrapper.querySelector('.task').classList.remove('due-today');
        }
    });
};

/**
 * Alterna el filtro de "Solo Hoy" en el contenedor de tareas.
 * @param {Event} event - El evento de clic del botón de filtro.
 */
const toggleFilterToday = (event) => {
    const button = event.target;
    const isActive = tasksContainer.classList.toggle('filter-today-active');
    
    if (isActive) {
        button.textContent = translations[currentLang].filterButtonAll;
        button.classList.add('filter-active');
    } else {
        button.textContent = translations[currentLang].filterButtonToday;
        button.classList.remove('filter-active');
    }
};

/**
 * Exporta las tareas actuales a un archivo JSON.
 */
const exportTasks = () => {
    const tasksData = localStorage.getItem('tasks');
    if (!tasksData) return;

    const blob = new Blob([tasksData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    const date = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `todolist_backup_${date}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Importa tareas desde un archivo JSON seleccionado por el usuario.
 * @param {Event} event - El evento de cambio del input de archivo.
 */
const importTasks = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const tasks = JSON.parse(e.target.result);
            if (!Array.isArray(tasks)) throw new Error('Invalid format');

            if (confirm(translations[currentLang].confirmImport)) {
                localStorage.setItem('tasks', JSON.stringify(tasks));
                tasksContainer.innerHTML = ''; // Limpiar contenedor actual
                loadTasks(); // Cargar nuevas tareas
                highlightDueTasks();
            }
        } catch (error) {
            alert(translations[currentLang].alertImportError);
            console.error('Import error:', error);
        }
        event.target.value = ''; // Resetear input
    };
    reader.readAsText(file);
};

/**
 * Determina qué elemento está inmediatamente después de la posición del cursor durante el arrastre.
 * @param {HTMLElement} container - El contenedor de las tareas.
 * @param {number} y - La posición vertical del cursor.
 * @returns {HTMLElement} El elemento después del cual se debe insertar el elemento arrastrado.
 */
const getDragAfterElement = (container, y) => {
    const draggableElements = [...container.querySelectorAll('.task-wrapper:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
};

// Inicializa la aplicación al cargar el documento: detecta idioma y carga tareas.
document.addEventListener('DOMContentLoaded', () => {
    detectLanguage();
    loadTasks();
    highlightDueTasks();

    // Configuración del área de soltar (Drop Zone)
    tasksContainer.addEventListener('dragover', e => {
        e.preventDefault(); // Permitir el drop
        const afterElement = getDragAfterElement(tasksContainer, e.clientY);
        const draggable = document.querySelector('.dragging');
        if (draggable) {
            if (afterElement == null) {
                tasksContainer.appendChild(draggable);
            } else {
                tasksContainer.insertBefore(draggable, afterElement);
            }
        }
    });

    // Event listener para el botón de ordenar
    document.querySelector('.orderButton').addEventListener('click', renderOrderedTasks);

    // Establece el valor mínimo del input de fecha al día actual
    const taskDateInput = document.getElementById('taskDate');
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    taskDateInput.min = `${yyyy}-${mm}-${dd}`;

    const donateButton = document.getElementById('donateButton');
    const modal = document.getElementById('donateModal');
    const closeButton = document.querySelector('.close-button');

    donateButton.onclick = () => {
        modal.style.display = 'block';
    }

    closeButton.onclick = () => {
        modal.style.display = 'none';
    }

    window.onclick = (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }

    const copyButtons = document.querySelectorAll('.copy-button');
    copyButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const input = event.target.previousElementSibling.querySelector('input');
            input.select();
            document.execCommand('copy');
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        });
    });
});
