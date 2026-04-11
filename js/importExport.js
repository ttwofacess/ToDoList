// ============================================================
// importExport.js — Responsabilidad: Exportar e importar
//                   tareas en formato JSON
// ============================================================

import { t }                         from './i18n.js';
import { readTasks, writeTasks }     from './storage.js';
import { loadTasks, highlightDueTasks } from './taskManager.js';

let tasksContainer = null;

export const initImportExport = (container) => { tasksContainer = container; };

/**
 * Descarga las tareas actuales como un archivo .json.
 */
export const exportTasks = () => {
    const raw = localStorage.getItem('tasks');
    if (!raw) return;

    const blob = new Blob([raw], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `todolist_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * Lee el archivo JSON seleccionado por el usuario y reemplaza las tareas.
 * @param {Event} event — change del <input type="file">
 */
export const importTasks = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const tasks = JSON.parse(e.target.result);
            if (!confirm(t('confirmImport'))) return;

            writeTasks(tasks);
            tasksContainer.innerHTML = '';
            loadTasks();
            highlightDueTasks();
        } catch {
            alert(t('alertImportError'));
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
};
