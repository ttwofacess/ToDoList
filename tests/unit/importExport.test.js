// ============================================================
// Tests unitarios — js/importExport.js
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initImportExport, exportTasks, importTasks } from '../../js/importExport.js';
import { initTaskManager, loadTasks, highlightDueTasks } from '../../js/taskManager.js';
import { initRenderer } from '../../js/taskRenderer.js';
import { setLanguage } from '../../js/i18n.js';
import { writeTasks, readTasks } from '../../js/storage.js';

describe('importExport', () => {
  let container;
  let createObjectURL;
  let revokeObjectURL;
  let clickedAnchors;

  beforeEach(() => {
    mountAppDom();
    container = document.getElementById('tasksContainer');
    initRenderer(container);
    initTaskManager(container, vi.fn(), vi.fn());
    initImportExport(container);
    setLanguage('es');
    localStorage.clear();

    clickedAnchors = [];
    createObjectURL = vi.fn(() => 'blob:mock-url');
    revokeObjectURL = vi.fn();

    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    vi.stubGlobal('Blob', class { constructor(parts, opts) { this.parts = parts; this.type = opts?.type; } });

    // Intercepta el click del <a download> que dispara la descarga
    const realCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = realCreate(tag);
      if (tag === 'a') {
        el.click = () => clickedAnchors.push({ href: el.href, download: el.download });
      }
      return el;
    });

    vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(window, 'confirm').mockImplementation(() => true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── exportTasks ────────────────────────────────────────────
  describe('exportTasks()', () => {
    it('no hace nada si no hay tareas guardadas', () => {
      exportTasks();
      expect(createObjectURL).not.toHaveBeenCalled();
      expect(clickedAnchors).toHaveLength(0);
    });

    it('crea un blob JSON y lo descarga', () => {
      writeTasks([{ text: 'Tarea', done: false }]);
      exportTasks();
      expect(createObjectURL).toHaveBeenCalledTimes(1);
      expect(clickedAnchors).toHaveLength(1);
    });

    it('el nombre del archivo incluye la fecha en ISO', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15, 10, 0, 0));
      writeTasks([{ text: 'T', done: false }]);
      exportTasks();
      expect(clickedAnchors[0].download).toBe('todolist_backup_2025-06-15.json');
      vi.useRealTimers();
    });

    it('el ancla apunta a la objectURL creada', () => {
      writeTasks([{ text: 'T', done: false }]);
      exportTasks();
      expect(clickedAnchors[0].href).toBe('blob:mock-url');
    });

    it('libera la objectURL después de descargar', () => {
      writeTasks([{ text: 'T', done: false }]);
      exportTasks();
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('no borra las tareas al exportar', () => {
      writeTasks([{ text: 'T', done: false }]);
      exportTasks();
      expect(readTasks()).toHaveLength(1);
    });

    it('exporta un array vacío si así está el storage', () => {
      localStorage.setItem('tasks', '[]');
      expect(() => exportTasks()).not.toThrow();
    });
  });

  // ── importTasks ────────────────────────────────────────────
  describe('importTasks()', () => {
    /** Simula el change de un <input type="file"> con el contenido dado. */
    const fileChange = (content, { name = 'backup.json' } = {}) => {
      const file = new window.File([content], name, { type: 'application/json' });
      const input = { files: [file], value: 'C:\\fakepath\\' + name };
      const event = { target: input };
      return event;
    };

    /** Ejecuta el FileReader de forma síncrona para poder asercionar. */
    const runImport = (event) => {
      importTasks(event);
      const reader = window.__lastReader;
      reader.onload({ target: { result: reader.__result } });
    };

    beforeEach(() => {
      // FileReader stub que guarda la instancia para disparar onload a mano
      const realFileReader = window.FileReader;
      class StubFileReader {
        readAsText(file) {
          this.__result = file.__content;
          window.__lastReader = this;
        }
      }
      vi.stubGlobal('FileReader', StubFileReader);
      // Adjunta el contenido al File para que el stub lo devuelva
      const realFile = window.File;
      vi.stubGlobal('File', class extends realFile {
        constructor(parts, name, opts) {
          super(parts, name, opts);
          this.__content = parts.join('');
        }
      });
      window.FileReader = StubFileReader;
      void realFileReader;
    });

    it('no hace nada si no se seleccionó archivo', () => {
      const event = { target: { files: [], value: '' } };
      importTasks(event);
      expect(window.confirm).not.toHaveBeenCalled();
    });

    it('importa las tareas, pide confirmación y las renderiza', () => {
      writeTasks([{ text: 'Vieja', done: false }]);
      loadTasks();

      const json = JSON.stringify([
        { text: 'Importada 1', done: false },
        { text: 'Importada 2', done: true },
      ]);
      runImport(fileChange(json));

      expect(window.confirm).toHaveBeenCalledWith(
        '¿Estás seguro? Esto reemplazará tus tareas actuales.');
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(2);
      expect([...container.querySelectorAll('.task-text')].map(e => e.textContent))
        .toEqual(['Importada 1', 'Importada 2']);
    });

    it('reemplaza las tareas anteriores, no las agrega', () => {
      writeTasks([{ text: 'Vieja', done: false }]);
      loadTasks();

      runImport(fileChange(JSON.stringify([{ text: 'Nueva', done: false }])));
      expect(readTasks()).toHaveLength(1);
      expect(readTasks()[0].text).toBe('Nueva');
    });

    it('respeta el estado done de lo importado', () => {
      runImport(fileChange(JSON.stringify([{ text: 'A', done: true }])));
      expect(container.querySelector('.task').classList.contains('done')).toBe(true);
    });

    it('no importa nada si el usuario cancela la confirmación', () => {
      window.confirm.mockReturnValue(false);
      writeTasks([{ text: 'Original', done: false }]);
      loadTasks();

      runImport(fileChange(JSON.stringify([{ text: 'No importada', done: false }])));
      expect(readTasks()[0].text).toBe('Original');
    });

    it('limpia el valor del input incluso al cancelar', () => {
      window.confirm.mockReturnValue(false);
      const event = fileChange('[]');
      runImport(event);
      expect(event.target.value).toBe('');
    });

    it('muestra una alerta y no rompe con JSON inválido', () => {
      writeTasks([{ text: 'Original', done: false }]);
      loadTasks();

      runImport(fileChange('{esto no es json'));
      expect(window.alert).toHaveBeenCalledWith(
        'Error al importar el archivo. Asegúrate de que sea un JSON válido.');
      expect(readTasks()[0].text).toBe('Original');
    });

    it('acepta un archivo con un array vacío', () => {
      writeTasks([{ text: 'Old', done: false }]);
      loadTasks();
      runImport(fileChange('[]'));
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
      expect(readTasks()).toEqual([]);
    });

    it('el mensaje de error está traducido', () => {
      setLanguage('en');
      runImport(fileChange('nope'));
      expect(window.alert).toHaveBeenCalledWith(
        'Error importing file. Make sure it is a valid JSON.');
    });

    it('la confirmación está traducida', () => {
      setLanguage('en');
      runImport(fileChange('[]'));
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure? This will replace your current tasks.');
    });

    it('hace round-trip: exportar → importar conserva las tareas', () => {
      // Reloj congelado: si no, la tarea recurrente "weekly" se resetearía
      // (lastCompleted de 2025 vs hoy real) y el round-trip no sería idéntico.
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15, 10, 0, 0));

      const original = [
        { text: 'T1', done: true, date: '15/06/2025', priority: 'high',
          subtasks: [{ text: 's1', done: true }], recurrence: 'weekly',
          lastCompleted: String(new Date(2025, 5, 15, 9, 0, 0).getTime()),
          createdAt: '1700000000000' },
        { text: 'T2', done: false, date: '21/06/2025', priority: 'low',
          subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '1700000000001' },
      ];
      writeTasks(original);
      loadTasks();

      // El "export" toma el raw de localStorage
      const raw = localStorage.getItem('tasks');
      runImport(fileChange(raw));

      expect(readTasks()).toEqual(original);
      vi.useRealTimers();
    });
  });
});
