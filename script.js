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
    const tasks = [];
    tasksContainer.childNodes.forEach(el => {
        /* if (el.classList.contains('task')) { */
        if (el.classList.contains('task-wrapper')) {
            const taskEl = el.querySelector('.task');
            tasks.push({
                /* text: el.textContent, */
                /* text: el.querySelector('.task-text').textContent, */
                text: taskEl.textContent,
                /* done: el.classList.contains('done') */
                done: taskEl.classList.contains('done')
            });
        }
        
    });
    localStorage.setItem('tasks', JSON.stringify(tasks));
};

//load tasks from local storage
const loadTasks = () => {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    tasks.forEach(task => {
        const taskElement = createTaskElement(task.text);
        if (task.done) {
            /* taskElement.classList.add('done'); */
            taskElement.querySelector('.task').classList.add('done');
        }
        tasksContainer.appendChild(taskElement);
    });
};

//create tasks elements from here
const createTaskElement = (text) => {
    const taskWrapper = document.createElement('div');
    taskWrapper.classList.add('task-wrapper');

    const task = document.createElement('div');
    task.classList.add('task', 'roundBorder');
    task.textContent = text;
    task.addEventListener('click', changeTaskState);

    /* const taskText = document.createElement('span');
    taskText.classList.add('task-text');
    task.textContent = text; */
    /* task.addEventListener('click', changeTaskState); */
    /* taskText.addEventListener('click', changeTaskState); */

    const deleteButton = document.createElement('button');
    deleteButton.textContent = '❌';
    deleteButton.classList.add('delete-button');
    deleteButton.addEventListener('click', deleteTask);

    /* task.appendChild(taskText); */
    taskWrapper.appendChild(task);
    /* task.appendChild(deleteButton); */
    taskWrapper.appendChild(deleteButton);
    
    /* return task; */
    return taskWrapper;
};

const addNewTask = event => {
    event.preventDefault();
    const { value } = event.target.taskText;
    if(!value) return;
    /* const task = document.createElement('div'); */
    const task = createTaskElement(value);
    /* task.classList.add('task', 'roundBorder');
    task.addEventListener('click', changeTaskState)
    task.textContent = value; */
    tasksContainer.prepend(task);
    event.target.reset();
    saveTasks();
};

const changeTaskState = event => {
    /* event.target.classList.toggle('done'); */
    event.target.closest('.task').classList.toggle('done');
    saveTasks();  //call saveTasks after a change is made
};

//delete the task and update local storage
const deleteTask = event => {
    /* const task = event.target.closest('.task'); */
    const taskWrapper = event.target.closest('.task-wrapper');
    /* task.remove(); */
    taskWrapper.remove();
    saveTasks();
}

const order = () => {
    const done = [];
    const toDo = [];
    tasksContainer.childNodes.forEach(el => {
        /* if (el.classList.contains('task')) { */
        if (el.classList.contains('task-wrapper')) {
            /* el.classList.contains('done') ? done.push(el) : toDo.push(el); */
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
