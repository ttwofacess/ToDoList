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
        tasks.push({
            text: el.textContent,
            done: el.classList.contains('done')
        });
    });
    localStorage.setItem('tasks', JSON.stringify(tasks));
};

//load tasks from local storage
const loadTasks = () => {
    const tasks = JSON.parse(localStorage.getItem('tasks')) || [];
    tasks.forEach(task => {
        const taskElement = createTaskElement(task.text);
        if (task.done) {
            taskElement.classList.add('done');
        }
        tasksContainer.appendChild(taskElement);
    });
};

//create tasks elements from here
const createTaskElement = (text) => {
    const task = document.createElement('div');
    task.classList.add('task', 'roundBorder');
    task.addEventListener('click', changeTaskState);
    task.textContent = text;
    return task;
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
    event.target.classList.toggle('done');
    saveTasks();  //call saveTasks after a change is made
};


const order = () => {
    const done = [];
    const toDo = [];
    tasksContainer.childNodes.forEach( el => {
        el.classList.contains('done') ? done.push(el) : toDo.push(el)
    });
    return [...toDo, ...done];
};

const renderOrderedTasks = () => {
    order().forEach(el => tasksContainer.appendChild(el));
    saveTasks();  //call saveTasks after reordering tasks
};


setDate();
loadTasks();
