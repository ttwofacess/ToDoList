// ============================================================
// Tests unitarios — js/taskActions.js
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { changeTaskState, deleteTask } from '../../js/taskActions.js';
import { initRenderer, createTaskElement } from '../../js/taskRenderer.js';
import { setLanguage } from '../../js/i18n.js';
import { formatDisplayDate } from '../../js/dateUtils.js';
import { readTasks } from '../../js/storage.js';

describe('taskActions', () => {
  let container;
  let wrapper;

  const mount = ({ recurrence = 'none', done = false, date } = {}) => {
    wrapper = createTaskElement('Tarea', date ?? formatDisplayDate(new Date()),
                                'low', [], recurrence, null, '1700000000000', () => {});
    if (done) wrapper.querySelector('.task').classList.add('done');
    container.appendChild(wrapper);
    return wrapper;
  };

  beforeEach(() => {
    mountAppDom();
    container = document.getElementById('tasksContainer');
    initRenderer(container);
    setLanguage('es');
    localStorage.clear();
  });

  describe('changeTaskState()', () => {
    it('marca la tarea como hecha y persiste', () => {
      mount();
      changeTaskState(wrapper, container);
      expect(wrapper.querySelector('.task').classList.contains('done')).toBe(true);
      expect(readTasks()[0].done).toBe(true);
    });

    it('desmarca una tarea hecha y persiste', () => {
      mount({ done: true });
      changeTaskState(wrapper, container);
      expect(wrapper.querySelector('.task').classList.contains('done')).toBe(false);
      expect(readTasks()[0].done).toBe(false);
    });

    it('al completar guarda data-last-completed con un timestamp', () => {
      vi.setSystemTime(new Date(2025, 5, 15, 12, 0, 0));
      mount();
      changeTaskState(wrapper, container);
      const ts = wrapper.getAttribute('data-last-completed');
      expect(ts).toBe(String(new Date(2025, 5, 15, 12, 0, 0).getTime()));
      expect(readTasks()[0].lastCompleted).toBe(String(new Date(2025, 5, 15, 12, 0, 0).getTime()));
      vi.useRealTimers();
    });

    it('al volver a pendiente quita data-last-completed', () => {
      vi.setSystemTime(new Date(2025, 5, 15, 12, 0, 0));
      mount();
      changeTaskState(wrapper, container);
      changeTaskState(wrapper, container);
      expect(wrapper.hasAttribute('data-last-completed')).toBe(false);
      expect(readTasks()[0].lastCompleted).toBeNull();
      vi.useRealTimers();
    });

    it('es un toggle: dos llamadas vuelven al estado inicial', () => {
      mount();
      changeTaskState(wrapper, container);
      changeTaskState(wrapper, container);
      expect(wrapper.querySelector('.task').classList.contains('done')).toBe(false);
    });

    it('no cambia la fecha al completar una tarea NO recurrente', () => {
      const yesterday = '14/06/2025';
      mount({ recurrence: 'none', date: yesterday });
      changeTaskState(wrapper, container);
      expect(wrapper.querySelector('.task-date').textContent).toBe(yesterday);
    });

    it('actualiza la fecha a hoy al reactivar una tarea RECURRENTE', () => {
      const yesterday = '14/06/2025';
      mount({ recurrence: 'daily', done: true, date: yesterday });
      changeTaskState(wrapper, container);
      expect(wrapper.querySelector('.task-date').textContent)
        .toBe(formatDisplayDate(new Date()));
    });

    it('no actualiza la fecha al reactivar una recurrente si no estaba hecha', () => {
      const old = '01/01/2020';
      mount({ recurrence: 'weekly', done: false, date: old });
      changeTaskState(wrapper, container); // la marca como hecha
      changeTaskState(wrapper, container); // la desmarca → aquí sí toca actualizar
      expect(wrapper.querySelector('.task-date').textContent)
        .toBe(formatDisplayDate(new Date()));
    });

    it('persiste la fecha actualizada de la recurrente', () => {
      mount({ recurrence: 'monthly', done: true, date: '14/06/2025' });
      changeTaskState(wrapper, container);
      expect(readTasks()[0].date).toBe(formatDisplayDate(new Date()));
    });

    it('no toca las demás tareas del contenedor', () => {
      mount();
      const other = createTaskElement('Otra', '15/06/2025', 'high', [], 'none', null, null, () => {});
      container.appendChild(other);

      changeTaskState(wrapper, container);
      expect(other.querySelector('.task').classList.contains('done')).toBe(false);
      expect(readTasks().map(t => t.done)).toEqual([true, false]);
    });
  });

  describe('deleteTask()', () => {
    it('elimina la tarea del DOM', () => {
      mount();
      deleteTask(wrapper, container);
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
    });

    it('persiste la lista sin la tarea eliminada', () => {
      mount();
      const other = createTaskElement('Otra', '15/06/2025', 'low', [], 'none', null, null, () => {});
      container.appendChild(other);

      deleteTask(wrapper, container);
      const tasks = readTasks();
      expect(tasks).toHaveLength(1);
      expect(tasks[0].text).toBe('Otra');
    });

    it('elimina sólo la tarea indicada', () => {
      mount();
      const other = createTaskElement('Otra', '15/06/2025', 'low', [], 'none', null, null, () => {});
      container.appendChild(other);

      deleteTask(other, container);
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(1);
      expect(container.querySelector('.task-text').textContent).toBe('Tarea');
    });

    it('persiste un array vacío si era la última tarea', () => {
      mount();
      deleteTask(wrapper, container);
      expect(readTasks()).toEqual([]);
    });

    it('no lanza si el contenedor ya no la contiene', () => {
      mount();
      wrapper.remove();
      expect(() => deleteTask(wrapper, container)).not.toThrow();
    });
  });
});
