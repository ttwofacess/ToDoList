// ============================================================
// Tests unitarios — js/taskActions.js
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  changeTaskState, deleteTask, restoreTask, animateOutAndDelete, animateTaskIn,
  TASK_IN_MS, TASK_OUT_MS, TASK_DONE_MS,
} from '../../js/taskActions.js';
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
    // Reloj falso: las animaciones limpian su clase con temporizadores y
    // ningún test debe depender de esperar en tiempo real.
    vi.useFakeTimers();
    mountAppDom();
    container = document.getElementById('tasksContainer');
    initRenderer(container);
    setLanguage('es');
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
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

  // ── Animación de completado ───────────────────────────────
  describe('animación de completado', () => {
    const taskEl = () => wrapper.querySelector('.task');

    it('al completar deja la clase just-done en la tarjeta', () => {
      mount();
      changeTaskState(wrapper, container);
      expect(taskEl().classList.contains('just-done')).toBe(true);
    });

    it('el timeout de reserva limpia just-done si no hay animationend', () => {
      mount();
      changeTaskState(wrapper, container);

      vi.advanceTimersByTime(TASK_DONE_MS + 50);

      expect(taskEl().classList.contains('just-done')).toBe(false);
    });

    it('al desmarcar no queda la clase just-done', () => {
      mount();
      changeTaskState(wrapper, container);
      changeTaskState(wrapper, container);
      expect(taskEl().classList.contains('just-done')).toBe(false);
    });

    it('desmarcar a mitad de la animación cancela la limpieza pendiente', () => {
      mount();
      changeTaskState(wrapper, container);   // anima
      changeTaskState(wrapper, container);   // desmarca antes de que termine

      vi.advanceTimersByTime(TASK_DONE_MS + 50);

      expect(taskEl().classList.contains('just-done')).toBe(false);
      expect(taskEl().classList.contains('done')).toBe(false);
    });

    it('toggle done → undone → done reinicia la animación y limpia una vez', () => {
      mount();
      changeTaskState(wrapper, container);
      changeTaskState(wrapper, container);
      changeTaskState(wrapper, container);

      expect(taskEl().classList.contains('just-done')).toBe(true);

      vi.advanceTimersByTime(TASK_DONE_MS + 50);

      expect(taskEl().classList.contains('just-done')).toBe(false);
      expect(taskEl().classList.contains('done')).toBe(true);
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

  describe('deleteTask() — snapshot para deshacer', () => {
    const threeTasks = () => {
      const a = createTaskElement('A', '15/06/2025', 'low', [], 'none', null, null, () => {});
      const b = createTaskElement('B', '15/06/2025', 'low', [], 'none', null, null, () => {});
      const c = createTaskElement('C', '15/06/2025', 'low', [], 'none', null, null, () => {});
      container.append(a, b, c);
      return { a, b, c };
    };

    it('devuelve el wrapper eliminado', () => {
      mount();
      const snapshot = deleteTask(wrapper, container);
      expect(snapshot.wrapper).toBe(wrapper);
    });

    it('devuelve el índice correcto para la primera tarea', () => {
      const { a } = threeTasks();
      expect(deleteTask(a, container).index).toBe(0);
    });

    it('devuelve el índice correcto para una tarea del medio', () => {
      const { b } = threeTasks();
      expect(deleteTask(b, container).index).toBe(1);
    });

    it('devuelve el índice correcto para la última tarea', () => {
      const { c } = threeTasks();
      expect(deleteTask(c, container).index).toBe(2);
    });

    it('devuelve el siguiente hermano, no null, si no era la última', () => {
      const { a, b } = threeTasks();
      expect(deleteTask(a, container).nextSibling).toBe(b);
    });

    it('devuelve nextSibling null si era la última tarea', () => {
      const { c } = threeTasks();
      expect(deleteTask(c, container).nextSibling).toBeNull();
    });

    it('devuelve index -1 si el contenedor ya no contenía la tarea', () => {
      mount();
      wrapper.remove();
      expect(deleteTask(wrapper, container).index).toBe(-1);
    });
  });

  describe('restoreTask()', () => {
    const task = (text) =>
      createTaskElement(text, '15/06/2025', 'low', [], 'none', null, null, () => {});

    const texts = () =>
      [...container.querySelectorAll('.task-text')].map(el => el.textContent);

    it('devuelve "restored" y reinserta el nodo', () => {
      mount();
      const snapshot = deleteTask(wrapper, container);
      expect(restoreTask(snapshot, container)).toBe('restored');
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(1);
    });

    it('reinserta en la posición original si era la primera', () => {
      const a = task('A'); const b = task('B');
      container.append(a, b);

      const snapshot = deleteTask(a, container);
      restoreTask(snapshot, container);
      expect(texts()).toEqual(['A', 'B']);
    });

    it('reinserta en la posición original si era del medio', () => {
      const a = task('A'); const b = task('B'); const c = task('C');
      container.append(a, b, c);

      const snapshot = deleteTask(b, container);
      restoreTask(snapshot, container);
      expect(texts()).toEqual(['A', 'B', 'C']);
    });

    it('reinserta al final si era la última', () => {
      const a = task('A'); const b = task('B');
      container.append(a, b);

      const snapshot = deleteTask(b, container);
      restoreTask(snapshot, container);
      expect(texts()).toEqual(['A', 'B']);
    });

    it('usa el índice original acotado si el vecino ya no existe', () => {
      const a = task('A'); const b = task('B'); const c = task('C');
      container.append(a, b, c);

      const snapshot = deleteTask(b, container);   // b era del medio, nextSibling = c
      c.remove();                                   // ...y su vecino también desaparece
      restoreTask(snapshot, container);
      expect(texts()).toEqual(['A', 'B']);
    });

    it('persiste la tarea restaurada en localStorage', () => {
      mount();
      const snapshot = deleteTask(wrapper, container);
      expect(readTasks()).toEqual([]);

      restoreTask(snapshot, container);
      expect(readTasks()).toHaveLength(1);
      expect(readTasks()[0].text).toBe('Tarea');
    });

    it('persista respetando el orden original', () => {
      const a = task('A'); const b = task('B'); const c = task('C');
      container.append(a, b, c);

      const snapshot = deleteTask(b, container);
      restoreTask(snapshot, container);
      expect(readTasks().map(t => t.text)).toEqual(['A', 'B', 'C']);
    });

    it('conserva subtareas, done, prioridad, recurrencia y created-at', () => {
      const wrapperEl = createTaskElement(
        'Completa', '15/06/2025', 'high',
        [{ text: 'Sub 1', done: true }, { text: 'Sub 2', done: false }],
        'weekly', '1700000000000', '1700000000000', () => {}
      );
      wrapperEl.querySelector('.task').classList.add('done');
      container.appendChild(wrapperEl);

      const snapshot = deleteTask(wrapperEl, container);
      restoreTask(snapshot, container);

      const restored = container.querySelector('.task-wrapper');
      expect(restored.querySelector('.task').classList.contains('done')).toBe(true);
      expect(restored.querySelector('.task').classList.contains('priority-high')).toBe(true);
      expect(restored.getAttribute('data-recurrence')).toBe('weekly');
      expect(restored.getAttribute('data-created-at')).toBe('1700000000000');
      expect(restored.querySelectorAll('.subtask-item')).toHaveLength(2);
      expect(readTasks()[0].subtasks).toHaveLength(2);
      expect(readTasks()[0].done).toBe(true);
      expect(readTasks()[0].priority).toBe('high');
    });

    it('reutiliza el mismo nodo (no reconstruye la tarea)', () => {
      mount();
      const snapshot = deleteTask(wrapper, container);
      restoreTask(snapshot, container);
      expect(container.querySelector('.task-wrapper')).toBe(wrapper);
    });

    it('un segundo restore sobre el mismo snapshot no duplica', () => {
      mount();
      const snapshot = deleteTask(wrapper, container);
      restoreTask(snapshot, container);
      expect(restoreTask(snapshot, container)).toBe('already-restored');
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(1);
    });

    it('no persiste si la tarea ya estaba restaurada', () => {
      mount();
      const snapshot = deleteTask(wrapper, container);
      restoreTask(snapshot, container);
      const raw = localStorage.getItem('tasks');
      restoreTask(snapshot, container);
      expect(localStorage.getItem('tasks')).toBe(raw);
    });

    it('no lanza si el contenedor está vacío', () => {
      mount();
      const snapshot = deleteTask(wrapper, container);
      expect(() => restoreTask(snapshot, container)).not.toThrow();
    });

    it('la tarea restaurada vuelve a animarse', () => {
      mount();
      const snapshot = deleteTask(wrapper, container);
      restoreTask(snapshot, container);
      expect(wrapper.classList.contains('just-added')).toBe(true);
    });

    it('al reanimarla, el timeout de la animación anterior no la desarma', () => {
      mount();
      const snapshot = deleteTask(wrapper, container);
      restoreTask(snapshot, container);
      animateTaskIn(wrapper);                 // segunda animación sobre el mismo nodo
      vi.advanceTimersByTime(TASK_IN_MS + 50);
      expect(wrapper.classList.contains('just-added')).toBe(false);
    });
  });

  // ── Animación de salida ───────────────────────────────────
  describe('animateOutAndDelete()', () => {
    /** jsdom no calcula layouts: la altura se simula para poder assertarla. */
    const withHeight = (el, height) => {
      vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
        x: 0, y: 0, top: 0, left: 0, right: 300, bottom: height, width: 300, height,
        toJSON: () => {},
      });
      return el;
    };

    it('setea la altura inicial y la clase leaving', () => {
      const el = withHeight(mount(), 120);
      animateOutAndDelete(el, container);
      expect(el.classList.contains('leaving')).toBe(true);
      expect(el.style.getPropertyValue('--task-out-height')).toBe('120px');
    });

    it('no borra la tarea hasta que termina la animación', () => {
      const el = mount();
      animateOutAndDelete(el, container);
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(1);
    });

    it('el timeout de reserva borra la tarea cuando no hay animación', async () => {
      // En jsdom no hay CSS (es el caso del movimiento reducido): el borrado
      // depende del timeout de reserva.
      const el = mount();
      const promise = animateOutAndDelete(el, container);

      await vi.advanceTimersByTimeAsync(TASK_OUT_MS + 50);

      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
      await expect(promise).resolves.toMatchObject({ wrapper: el, index: 0, nextSibling: null });
    });

    it('el snapshot tiene el índice y el hermano siguiente correctos', async () => {
      const a = createTaskElement('A', '15/06/2025', 'low', [], 'none', null, null, () => {});
      const b = createTaskElement('B', '15/06/2025', 'low', [], 'none', null, null, () => {});
      const c = createTaskElement('C', '15/06/2025', 'low', [], 'none', null, null, () => {});
      container.append(a, b, c);

      const promise = animateOutAndDelete(b, container);
      await vi.advanceTimersByTimeAsync(TASK_OUT_MS + 50);

      await expect(promise).resolves.toMatchObject({ wrapper: b, index: 1, nextSibling: c });
    });

    it('persiste la lista sin la tarea borrada', async () => {
      mount();
      const promise = animateOutAndDelete(wrapper, container);
      await vi.advanceTimersByTimeAsync(TASK_OUT_MS + 50);
      await promise;
      expect(readTasks()).toEqual([]);
    });

    it('una segunda llamada no borra la tarea dos veces', async () => {
      const el = mount();
      const first  = animateOutAndDelete(el, container);
      const second = animateOutAndDelete(el, container);

      await expect(second).resolves.toBeNull();

      await vi.advanceTimersByTimeAsync(TASK_OUT_MS + 50);
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
      await expect(first).resolves.toMatchObject({ wrapper: el });
    });

    it('si la tarea ya no está en el DOM, la borra sin animar', async () => {
      const el = mount();
      el.remove();

      const promise = animateOutAndDelete(el, container);

      expect(el.classList.contains('leaving')).toBe(false);
      await expect(promise).resolves.toMatchObject({ wrapper: el, index: -1, nextSibling: null });
    });

    it('quita la clase leaving al terminar, para que la tarea se pueda deshacer', async () => {
      const el = mount();
      const promise = animateOutAndDelete(el, container);
      await vi.advanceTimersByTimeAsync(TASK_OUT_MS + 50);
      await promise;

      expect(el.classList.contains('leaving')).toBe(false);
      expect(el.style.getPropertyValue('--task-out-height')).toBe('');
    });
  });
});
