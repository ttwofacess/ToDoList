// Diccionario de traducciones para los textos de la interfaz.
const translations = {
    en: {
        pageTitle: 'To-Do List',
        taskPlaceholder: 'New task',
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
    },
    es: {
        pageTitle: 'Lista de Tareas',
        taskPlaceholder: 'Nueva tarea',
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
    }
};

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
        if (element.tagName === 'INPUT' && element.placeholder) {
            element.placeholder = translation;
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

    const task = document.createElement('div');
    task.classList.add('task', 'roundBorder', `priority-${priority}`);
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
    const dateValue = event.target.taskDate.value;

    if(!value) return;

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
 * Maneja el evento de editar una tarea, permitiendo al usuario modificar el texto.
 * @param {Event} event - El evento de clic en el botón de editar.
 */
const editTask = event => {
    const taskWrapper = event.target.closest('.task-wrapper');
    const taskTextElement = taskWrapper.querySelector('.task-text');
    const currentText = taskTextElement.textContent;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.classList.add('edit-input');

    taskTextElement.replaceWith(input);
    input.focus();

    const editButton = taskWrapper.querySelector('.edit-button');
    editButton.textContent = '💾';
    editButton.removeEventListener('click', editTask);
    editButton.addEventListener('click', saveEditedTask);
};

/**
 * Guarda el texto modificado de una tarea.
 * @param {Event} event - El evento de clic en el botón de guardar.
 */
const saveEditedTask = event => {
    const taskWrapper = event.target.closest('.task-wrapper');
    const input = taskWrapper.querySelector('.edit-input');
    const newText = input.value;

    if (!newText) {
        alert(translations[currentLang].alertEmptyTask);
        return;
    }

    if (newText.length > 500) {
        alert(translations[currentLang].alertTaskTooLong);
        return;
    }

    const newTaskTextElement = document.createElement('span');
    newTaskTextElement.classList.add('task-text');
    newTaskTextElement.textContent = DOMPurify.sanitize(newText);

    input.replaceWith(newTaskTextElement);

    const editButton = taskWrapper.querySelector('.edit-button');
    editButton.textContent = '✏️';
    editButton.removeEventListener('click', saveEditedTask);
    editButton.addEventListener('click', editTask);

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
/**
 * Renderiza las tareas en el contenedor en el orden correcto (pendientes primero).
 */
const renderOrderedTasks = () => {
    order().forEach(el => tasksContainer.appendChild(el));
    saveTasks(); // Guarda el nuevo orden en localStorage.
};

// Agrega un event listener al botón de ordenar para que llame a renderOrderedTasks.

// Agrega un event listener al botón de ordenar para que llame a renderOrderedTasks.
document.querySelector('.orderButton').addEventListener('click', renderOrderedTasks);

// Llama a setDate y loadTasks al cargar el script para inicializar la aplicación.

// Inicializa la aplicación al cargar el documento: detecta idioma y carga tareas.
document.addEventListener('DOMContentLoaded', () => {
    detectLanguage();
    loadTasks();

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
            // Optional: Add some feedback to the user
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            setTimeout(() => {
                button.textContent = originalText;
            }, 2000);
        });
    });
});
