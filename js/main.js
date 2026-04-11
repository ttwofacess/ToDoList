// ============================================================
// main.js — Responsabilidad: Punto de entrada.
//           Inicializa módulos y registra event listeners globales.
// ============================================================

import { detectLanguage }                          from './i18n.js';
import { renderHeaderDate }                        from './dateUtils.js';
import { initTaskManager, addNewTask, loadTasks,
         renderOrderedTasks, highlightDueTasks,
         toggleFilterToday }                       from './taskManager.js';
import { initDragDrop }                            from './dragDrop.js';
import { initModals, openEditModal }               from './modalManager.js';
import { initModalManager }                        from './modalManager.js';
import { initImportExport, exportTasks,
         importTasks }                             from './importExport.js';

document.addEventListener('DOMContentLoaded', () => {
    const tasksContainer = document.getElementById('tasksContainer');

    // ── 1. Inicializar módulos con sus dependencias ──────────
    initTaskManager(tasksContainer, openEditModal);
    initModalManager(tasksContainer);
    initImportExport(tasksContainer);
    initDragDrop(tasksContainer);
    initModals();

    // ── 2. Detectar idioma (renderiza fecha tras aplicarlo) ──
    detectLanguage(renderHeaderDate);

    // ── 3. Cargar y decorar tareas ───────────────────────────
    loadTasks();
    highlightDueTasks();

    // ── 4. Establecer fecha mínima en los date pickers ───────
    const minDate = new Date().toISOString().split('T')[0];
    const dateInput     = document.getElementById('taskDate');
    const editDateInput = document.getElementById('editTaskDate');
    if (dateInput)     dateInput.min     = minDate;
    if (editDateInput) editDateInput.min = minDate;

    // ── 5. Event listeners del formulario y botones globales ─
    document.querySelector('form').addEventListener('submit', addNewTask);

    document.querySelector('.orderButton')
        .addEventListener('click', renderOrderedTasks);

    document.querySelector('.filterButton')
        .addEventListener('click', toggleFilterToday);

    document.querySelector('[data-action="export"]')
        ?.addEventListener('click', exportTasks);

    document.getElementById('importInput')
        ?.addEventListener('change', importTasks);

    // Nota: exportButton e importInput pueden también quedar con
    // sus atributos onclick en el HTML si se prefiere no usar
    // data-action. Ambos enfoques son válidos.
});
