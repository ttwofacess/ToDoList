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
    }
};

// Array de prioridades válidas para validación.
const VALID_PRIORITIES = ['high', 'medium', 'low'];

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
        const translation = translations[lang][key];
        if (element.tagName === 'INPUT') {
            if (element.type === 'date') {
                element.title = translations[lang]['dateTitle'];
            }
            if (element.placeholder) {
                element.placeholder = translation;
            }
        } else {
            element.textContent = translation;
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
        tasksContainer.childNodes.forEach(el => {
            if (el.classList.contains('task-wrapper')) {
                const taskEl = el.querySelector('.task');
                const taskText = taskEl.querySelector('.task-text').textContent;
                const taskDate = taskEl.querySelector('.task-date').textContent;
                const priority = taskEl.classList.contains('priority-high') ? 'high' : taskEl.classList.contains('priority-medium') ? 'medium' : 'low';
                tasks.push({
                    text: taskText,
                    done: taskEl.classList.contains('done'),
                    date: taskDate,
                    priority: priority
                });
            }
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

        tasks.forEach(task => {
            if (typeof task.text === 'string' && typeof task.done === 'boolean') {
                const date = task.date || new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
                const priority = task.priority || 'medium';
                const taskElement = createTaskElement(task.text, date, priority);
                if (task.done) {
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
 * @returns {HTMLElement} El elemento de tarea (`div.task-wrapper`) creado.
 */
const createTaskElement = (text, date, priority) => {
    const taskWrapper = document.createElement('div');
    taskWrapper.classList.add('task-wrapper');
    taskWrapper.draggable = true; // Habilitar arrastre

    taskWrapper.addEventListener('dragstart', () => {
        taskWrapper.classList.add('dragging');
    });

    taskWrapper.addEventListener('dragend', () => {
        taskWrapper.classList.remove('dragging');
        saveTasks(); // Guardar el nuevo orden al terminar de arrastrar
    });

    const task = document.createElement('div');
    task.classList.add('task', 'roundBorder', `priority-${priority}`);
    
    // Comprobar si la tarea es para hoy
    const todayStr = new Date().toLocaleDateString(`${currentLang}-${currentLang.toUpperCase()}`, { day: '2-digit', month: '2-digit', year: '2-digit' });
    if (date === todayStr) {
        task.classList.add('due-today');
    }

    task.addEventListener('click', changeTaskState);

    const taskText = document.createElement('span');
    taskText.classList.add('task-text');
    // Sanitiza el texto para prevenir ataques XSS.
    taskText.textContent = DOMPurify.sanitize(text);

    const taskDate = document.createElement('span');
    taskDate.classList.add('task-date');
    taskDate.textContent = date;

    task.appendChild(taskText);
    task.appendChild(taskDate);

    const editButton = document.createElement('button');
    editButton.textContent = '✏️';
    editButton.classList.add('edit-button');
    editButton.addEventListener('click', editTask);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '❌';
    deleteButton.classList.add('delete-button');
    deleteButton.addEventListener('click', deleteTask);

    taskWrapper.appendChild(task);
    taskWrapper.appendChild(editButton);
    taskWrapper.appendChild(deleteButton);
    
    return taskWrapper;
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

    const task = createTaskElement(value, date, priority);
    tasksContainer.prepend(task);
    event.target.reset();
    saveTasks();
};

/**
 * Cambia el estado de una tarea (completada/pendiente) al hacer clic en ella.
 * @param {Event} event - El evento de clic.
 */
const changeTaskState = event => {
    event.target.closest('.task').classList.toggle('done');
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
    const taskTextElement = taskWrapper.querySelector('.task-text');
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
 * Inicia el reconocimiento de voz para agregar texto al input de la tarea.
 */
const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        alert(translations[currentLang].voiceNotSupported);
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = currentLang === 'es' ? 'es-ES' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    const voiceBtn = document.querySelector('.voiceButton');
    voiceBtn.classList.add('voice-active');

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;
        const input = document.querySelector('input[name="taskText"]');
        input.value = text;
        voiceBtn.classList.remove('voice-active');
    };

    recognition.onerror = () => {
        alert(translations[currentLang].voiceError);
        voiceBtn.classList.remove('voice-active');
    };

    recognition.onend = () => {
        voiceBtn.classList.remove('voice-active');
    };

    recognition.start();
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
