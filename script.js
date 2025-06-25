// Info date
const dateNumber = document.getElementById('dateNumber');
const dateText = document.getElementById('dateText');
const dateMonth = document.getElementById('dateMonth');
const dateYear = document.getElementById('dateYear');


// Tasks Container
const tasksContainer = document.getElementById('tasksContainer');

const setDate = () => {
    const date = new Date();
    dateNumber.textContent = date.toLocaleString('es', { day: 'numeric' });
    dateText.textContent = date.toLocaleString('es', { weekday: 'long' });
    dateMonth.textContent = date.toLocaleString('es', { month: 'short' });
    dateYear.textContent = date.toLocaleString('es', { year: 'numeric' });
};

//save tasks in local storage
const saveTasks = () => {    
    try {
        const tasks = [];
        tasksContainer.childNodes.forEach(el => {
            if (el.classList.contains('task-wrapper')) {
                const taskEl = el.querySelector('.task');
                tasks.push({
                    text: taskEl.textContent,
                    done: taskEl.classList.contains('done')
                });
            }
        });
        localStorage.setItem('tasks', JSON.stringify(tasks));
    } catch (error) {
        console.error('Error saving tasks:', error);
    }
};

//load tasks from local storage
const loadTasks = () => {
    try {
        const tasksData = localStorage.getItem('tasks');
        if (!tasksData) return;
        
        const tasks = JSON.parse(tasksData);
        if (!Array.isArray(tasks)) return;

        tasks.forEach(task => {
            if (typeof task.text === 'string' && typeof task.done === 'boolean') {
                const taskElement = createTaskElement(task.text);
                if (task.done) {
                    taskElement.querySelector('.task').classList.add('done');
                }
                tasksContainer.appendChild(taskElement);
            }
        });
    } catch (error) {
        console.error('Error loading tasks:', error);
        localStorage.removeItem('tasks'); // Limpiar datos corruptos
        }
}

//create tasks elements from here
const createTaskElement = (text) => {
    const taskWrapper = document.createElement('div');
    taskWrapper.classList.add('task-wrapper');

    const task = document.createElement('div');
    task.classList.add('task', 'roundBorder');
    // task.textContent = text;
    task.textContent = DOMPurify.sanitize(text);
    task.addEventListener('click', changeTaskState);

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '❌';
    deleteButton.classList.add('delete-button');
    deleteButton.addEventListener('click', deleteTask);
    taskWrapper.appendChild(task);
    taskWrapper.appendChild(deleteButton);
    return taskWrapper;
};

const addNewTask = event => {
    event.preventDefault();

    const { value } = event.target.taskText;
    if(!value) return;

    // Agregar validaciones
    if (value.length > 500) { // Limitar longitud de la tarea
        alert('El texto de la tarea es demasiado largo. Máximo 500 caracteres permitidos.');
        return;
    }
    
    if (tasksContainer.childNodes.length >= 100) { // Limitar número de tareas
        alert('Número máximo de tareas alcanzado.');
        return;
    }

    const task = createTaskElement(value);
    tasksContainer.prepend(task);
    event.target.reset();
    saveTasks();
};

const changeTaskState = event => {
    event.target.closest('.task').classList.toggle('done');
    saveTasks();  //call saveTasks after a change is made
};

//delete the task and update local storage
const deleteTask = event => {
    const taskWrapper = event.target.closest('.task-wrapper');
    taskWrapper.remove();
    saveTasks();
}

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

const renderOrderedTasks = () => {
    order().forEach(el => tasksContainer.appendChild(el));
    saveTasks();  //call saveTasks after reordering tasks
};

document.querySelector('.orderButton').addEventListener('click', renderOrderedTasks);

setDate();
loadTasks();
