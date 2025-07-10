// Obtiene los elementos del DOM para mostrar la fecha.
const dateNumber = document.getElementById('dateNumber');
const dateText = document.getElementById('dateText');
const dateMonth = document.getElementById('dateMonth');
const dateYear = document.getElementById('dateYear');

// Obtiene el contenedor de tareas del DOM.
const tasksContainer = document.getElementById('tasksContainer');

/**
 * Establece la fecha actual en los elementos del DOM correspondientes.
 * Utiliza el objeto `Date` para obtener la fecha y la formatea en español.
 */
const setDate = () => {
    const date = new Date();
    dateNumber.textContent = date.toLocaleString('es', { day: 'numeric' });
    dateText.textContent = date.toLocaleString('es', { weekday: 'long' });
    dateMonth.textContent = date.toLocaleString('es', { month: 'short' });
    dateYear.textContent = date.toLocaleString('es', { year: 'numeric' });
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
                const date = task.date || new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
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

    if(!value) return;

    // Validaciones para la longitud del texto y el número de tareas.
    if (value.length > 500) {
        alert('El texto de la tarea es demasiado largo. Máximo 500 caracteres permitidos.');
        return;
    }
    
    if (tasksContainer.childNodes.length >= 100) {
        alert('Número máximo de tareas alcanzado.');
        return;
    }

    const date = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });

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
        alert('La tarea no puede estar vacía.');
        return;
    }

    if (newText.length > 500) {
        alert('El texto de la tarea es demasiado largo. Máximo 500 caracteres permitidos.');
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
const renderOrderedTasks = () => {
    order().forEach(el => tasksContainer.appendChild(el));
    saveTasks(); // Guarda el nuevo orden en localStorage.
};

// Agrega un event listener al botón de ordenar para que llame a renderOrderedTasks.
document.querySelector('.orderButton').addEventListener('click', renderOrderedTasks);

// Llama a setDate y loadTasks al cargar el script para inicializar la aplicación.
setDate();
loadTasks();