// ============================================================
// main.js — Responsabilidad: Punto de entrada.
// ============================================================

import { detectLanguage }                          from './i18n.js';
import { renderHeaderDate }                        from './dateUtils.js';
import { initTaskManager, addNewTask, loadTasks,
         renderOrderedTasks, highlightDueTasks,
         toggleFilterToday }                       from './taskManager.js';
import { initDragDrop }                            from './dragDrop.js';
import { initModals, openActionModal, initModalManager } from './modalManager.js';
import { initImportExport, exportTasks,
         importTasks }                             from './importExport.js';

document.addEventListener('DOMContentLoaded', () => {
    const tasksContainer = document.getElementById('tasksContainer');

    // ── 1. Inicializar módulos con sus dependencias ──────────
    initTaskManager(tasksContainer, openActionModal);
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
    document.getElementById('newTaskForm').addEventListener('submit', addNewTask);

    document.querySelector('.orderButton')
        .addEventListener('click', renderOrderedTasks);

    document.querySelector('.filterButton')
        .addEventListener('click', toggleFilterToday);

    document.querySelector('[data-action="export"]')
        ?.addEventListener('click', exportTasks);

    document.getElementById('importInput')
        ?.addEventListener('change', importTasks);
});
