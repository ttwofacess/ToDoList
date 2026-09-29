// ============================================================
// Tests unitarios — js/undoManager.js
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initUndoManager, showUndoToast, dismissUndo, undoLastDelete, UNDO_TIMEOUT_MS,
} from '../../js/undoManager.js';
import { deleteTask } from '../../js/taskActions.js';
import { createTaskElement, initRenderer } from '../../js/taskRenderer.js';
import { setLanguage } from '../../js/i18n.js';
import { readTasks } from '../../js/storage.js';

describe('undoManager', () => {
  let container;
  let toast;
  let button;
  let bar;

  const mount = (text = 'Tarea') => {
    const el = createTaskElement(text, '15/06/2025', 'low', [], 'none', null, null, () => {});
    container.appendChild(el);
    return el;
  };

  const texts = () =>
    [...container.querySelectorAll('.task-text')].map(el => el.textContent);

  beforeEach(() => {
    vi.useFakeTimers();
    mountAppDom();
    container = document.getElementById('tasksContainer');
    toast  = document.getElementById('undoToast');
    button = document.getElementById('undoButton');
    bar    = document.querySelector('#undoToast .toast-progress');

    initRenderer(container);
    initUndoManager(container);
    setLanguage('es');
    localStorage.clear();
  });

  afterEach(() => {
    dismissUndo();
    vi.useRealTimers();
  });

  describe('constantes', () => {
    it('el temporizador dura 5 segundos', () => {
      expect(UNDO_TIMEOUT_MS).toBe(5000);
    });
  });

  describe('showUndoToast()', () => {
    it('muestra el toast quitando hidden y activando .toast--visible', () => {
      showUndoToast(deleteTask(mount(), container));
      expect(toast.hidden).toBe(false);
      expect(toast.classList.contains('toast--visible')).toBe(true);
    });

    it('arranca la animación de la barra de progreso', () => {
      showUndoToast(deleteTask(mount(), container));
      expect(bar.classList.contains('is-running')).toBe(true);
    });

    it('expone la duración como variable CSS', () => {
      showUndoToast(deleteTask(mount(), container));
      expect(toast.style.getPropertyValue('--undo-duration')).toBe(`${UNDO_TIMEOUT_MS}ms`);
    });

    it('muestra el mensaje y el botón traducidos al idioma activo', () => {
      showUndoToast(deleteTask(mount(), container));
      expect(document.getElementById('undoToastMessage').textContent).toBe('Tarea eliminada.');
      expect(button.textContent).toBe('Deshacer');
    });

    it('el borrado ya está persistido al mostrar el toast', () => {
      const wrapper = mount();
      const other = mount('Otra');
      showUndoToast(deleteTask(wrapper, container));

      expect(readTasks().map(t => t.text)).toEqual(['Otra']);
      expect(other.isConnected).toBe(true);
    });
  });

  describe('temporizador', () => {
    it('a los 4999 ms el toast sigue visible', () => {
      showUndoToast(deleteTask(mount(), container));
      vi.advanceTimersByTime(UNDO_TIMEOUT_MS - 1);

      expect(toast.hidden).toBe(false);
      expect(toast.classList.contains('toast--visible')).toBe(true);
    });

    it('a los 5000 ms el toast se oculta', () => {
      showUndoToast(deleteTask(mount(), container));
      vi.advanceTimersByTime(UNDO_TIMEOUT_MS);

      expect(toast.hidden).toBe(true);
      expect(toast.classList.contains('toast--visible')).toBe(false);
    });

    it('tras expirar, el borrado queda definitivo', () => {
      showUndoToast(deleteTask(mount(), container));
      vi.advanceTimersByTime(UNDO_TIMEOUT_MS);
      undoLastDelete();

      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
      expect(readTasks()).toEqual([]);
    });

    it('detiene la animación de la barra al expirar', () => {
      showUndoToast(deleteTask(mount(), container));
      vi.advanceTimersByTime(UNDO_TIMEOUT_MS);
      expect(bar.classList.contains('is-running')).toBe(false);
    });

    it('un segundo borrado reinicia el temporizador', () => {
      const a = mount('A');
      showUndoToast(deleteTask(a, container));
      vi.advanceTimersByTime(4000);

      showUndoToast(deleteTask(mount('B'), container));
      vi.advanceTimersByTime(4000);   // 8000 ms desde el primero, 4000 desde el segundo
      expect(toast.hidden).toBe(false);

      vi.advanceTimersByTime(1000);
      expect(toast.hidden).toBe(true);
    });

    it('un segundo borrado reemplaza al anterior: sólo se restaura el segundo', () => {
      const a = mount('A');
      const b = mount('B');
      showUndoToast(deleteTask(a, container));
      showUndoToast(deleteTask(b, container));

      button.click();
      // B vuelve a su posición; A queda definitiva
      expect(texts()).toEqual(['B']);
      expect(container.querySelector('.task-wrapper')).toBe(b);
      expect(a.isConnected).toBe(false);
      expect(readTasks().map(t => t.text)).toEqual(['B']);
    });
  });

  describe('undoLastDelete()', () => {
    it('restaura la tarea en su posición original', () => {
      const a = mount('A');
      const b = mount('B');
      const c = mount('C');
      const snapshot = deleteTask(b, container);
      showUndoToast(snapshot);
      vi.advanceTimersByTime(1000);

      button.click();
      expect(texts()).toEqual(['A', 'B', 'C']);
      expect([...container.children]).toEqual([a, b, c]);
    });

    it('vuelve a persistir la tarea restaurada', () => {
      const a = mount('A');
      showUndoToast(deleteTask(a, container));
      expect(readTasks()).toEqual([]);

      button.click();
      expect(readTasks().map(t => t.text)).toEqual(['A']);
    });

    it('oculta el toast', () => {
      showUndoToast(deleteTask(mount(), container));
      button.click();

      expect(toast.hidden).toBe(true);
      expect(toast.classList.contains('toast--visible')).toBe(false);
    });

    it('cancela el temporizador (avanzar 5 s no vuelve a tocar nada)', () => {
      showUndoToast(deleteTask(mount(), container));
      button.click();
      vi.advanceTimersByTime(UNDO_TIMEOUT_MS * 2);

      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(1);
      expect(toast.hidden).toBe(true);
    });

    it('un segundo click no hace nada (no duplica la tarea)', () => {
      showUndoToast(deleteTask(mount(), container));
      button.click();
      button.click();

      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(1);
    });

    it('no hace nada si no hay borrado pendiente', () => {
      const a = mount('A');
      expect(() => undoLastDelete()).not.toThrow();
      expect(texts()).toEqual(['A']);
    });

    it('no hace nada si no se inicializó el gestor', () => {
      dismissUndo();
      showUndoToast(deleteTask(mount(), container));
      initUndoManager(null);
      expect(() => undoLastDelete()).not.toThrow();
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
    });
  });

  describe('dismissUndo()', () => {
    it('limpia el estado: luego undoLastDelete() no restaura', () => {
      showUndoToast(deleteTask(mount(), container));
      dismissUndo();

      expect(toast.hidden).toBe(true);
      undoLastDelete();
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
    });

    it('es idempotente', () => {
      expect(() => { dismissUndo(); dismissUndo(); }).not.toThrow();
    });

    it('cancela el temporizador pendiente', () => {
      showUndoToast(deleteTask(mount(), container));
      dismissUndo();
      vi.advanceTimersByTime(UNDO_TIMEOUT_MS);
      expect(toast.hidden).toBe(true);
    });
  });

  describe('límite de tareas', () => {
    it('con 100 tareas no restaura y avisa', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const wrapper = mount('Se va');
      const snapshot = deleteTask(wrapper, container);

      for (let i = 0; i < 100; i++) mount(`T${i}`);
      showUndoToast(snapshot);
      button.click();

      expect(alertSpy).toHaveBeenCalledWith('Número máximo de tareas alcanzado.');
      expect(texts()).not.toContain('Se va');
      expect(readTasks().map(t => t.text)).not.toContain('Se va');
    });

    it('con el toast cerrado tras el aviso no queda nada pendiente', () => {
      vi.spyOn(window, 'alert').mockImplementation(() => {});
      const snapshot = deleteTask(mount('Se va'), container);
      for (let i = 0; i < 100; i++) mount(`T${i}`);
      showUndoToast(snapshot);
      button.click();

      expect(toast.hidden).toBe(true);
      // ni siquiera con el límite liberado vuelve a aparecer
      container.querySelectorAll('.task-wrapper').forEach(el => el.remove());
      undoLastDelete();
      expect(texts()).toEqual([]);
    });

    it('con 99 tareas sí restaura (límite no alcanzado)', () => {
      const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
      const snapshot = deleteTask(mount('Se va'), container);
      for (let i = 0; i < 99; i++) mount(`T${i}`);
      showUndoToast(snapshot);
      button.click();

      expect(alertSpy).not.toHaveBeenCalled();
      expect(texts()).toContain('Se va');
    });
  });
});
