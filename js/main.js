// ============================================================
// main.js — Responsabilidad: Punto de entrada.
// ============================================================

import { detectLanguage }                          from './i18n.js';
import { renderHeaderDate }                        from './dateUtils.js';
import { initTaskManager, addNewTask, loadTasks,
         renderOrderedTasks, highlightDueTasks,
         toggleFilterToday }                       from './taskManager.js';
import { initDragDrop }                            from './dragDrop.js';
import { initModals, openActionModal, initModalManager, closeNewTaskModal } from './modalManager.js';
import { initImportExport, exportTasks,
         importTasks }                             from './importExport.js';
import { initPWA }                                 from './pwa.js';
import { initUpdateNotifier }                       from './updateNotifier.js';
import { initUndoManager }                          from './undoManager.js';
import { initSearch, applySearch }                  from './search.js';
import { initTheme }                                from './themeManager.js';
import { initDaySummary, renderDaySummary }          from './daySummary.js';

document.addEventListener('DOMContentLoaded', () => {
    const tasksContainer = document.getElementById('tasksContainer');

    // ── 1. Inicializar módulos con sus dependencias ──────────
    initTaskManager(tasksContainer, openActionModal, closeNewTaskModal);
    initModalManager(tasksContainer);
    initUndoManager(tasksContainer);
    initImportExport(tasksContainer);
    initDragDrop(tasksContainer);
    initModals();

    // ── 2. Detectar idioma (renderiza fecha y resumen tras aplicarlo) ──
    // El resumen corre antes de initDaySummary: renderDaySummary tolera que
    // el observer todavía no exista y sólo escribe si #daySummary está.
    detectLanguage(() => {
        renderHeaderDate();
        renderDaySummary(tasksContainer);
    });

    // ── 2-bis. Toggle de tema (tras detectLanguage para el aria-label) ──
    initTheme(document.getElementById('themeToggleButton'));

    // ── 3. Cargar y decorar tareas ───────────────────────────
    loadTasks();
    highlightDueTasks();

    // ── 3-ter. Resumen del día (con la lista ya cargada) ─────
    initDaySummary(tasksContainer);

    // ── 3-bis. Búsqueda (después de detectLanguage para t() correcto) ──
    initSearch(tasksContainer);

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
        // Alternar el Modo Enfoque sólo cambia clases: el MutationObserver de
        // search.js no lo ve, así que hay que recalcular los estados vacíos a mano.
        .addEventListener('click', (event) => { toggleFilterToday(event); applySearch(); });

    document.querySelector('[data-action="export"]')
        ?.addEventListener('click', exportTasks);

    document.getElementById('importInput')
        ?.addEventListener('change', importTasks);

    // ── 6. PWA: Service Worker + botón Instalar ──────────────
    initPWA();

    // ── 7. Aviso de nueva versión del Service Worker ─────────
    initUpdateNotifier();
});
