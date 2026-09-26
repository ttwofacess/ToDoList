// ============================================================
// Tests unitarios — js/taskManager.js
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  VALID_PRIORITIES,
  initTaskManager,
  addNewTask,
  loadTasks,
  renderOrderedTasks,
  highlightDueTasks,
  toggleFilterToday,
} from '../../js/taskManager.js';
import { setLanguage } from '../../js/i18n.js';
import { formatDisplayDate } from '../../js/dateUtils.js';
import { readTasks, writeTasks } from '../../js/storage.js';

const TODAY_ISO = '2025-06-15';

describe('taskManager', () => {
  let container;
  let closeNewTaskModal;

  /** Crea un evento de submit falso con los valores del formulario. */
  const submitEvent = ({ text = 'Nueva tarea', priority = 'medium', date = '' }) => ({
    preventDefault: vi.fn(),
    target: {
      taskText:      { value: text },
      taskPriority:  { value: priority },
      taskDate:      { value: date },
      reset:         vi.fn(),
    },
  });

  beforeEach(() => {
    mountAppDom();
    container = document.getElementById('tasksContainer');
    closeNewTaskModal = vi.fn();
    initTaskManager(container, vi.fn(), closeNewTaskModal);
    setLanguage('es');
    localStorage.clear();

    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15, 10, 0, 0));
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exporta las prioridades válidas', () => {
    expect(VALID_PRIORITIES).toEqual(['high', 'medium', 'low']);
  });

  // ── addNewTask ────────────────────────────────────────────
  describe('addNewTask()', () => {
    it('crea la tarea y la prepende al contenedor', () => {
      addNewTask(submitEvent({ text: 'Comprar pan' }));
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(1);
      expect(container.querySelector('.task-text').textContent).toBe('Comprar pan');
    });

    it('llama a preventDefault', () => {
      const ev = submitEvent({});
      addNewTask(ev);
      expect(ev.preventDefault).toHaveBeenCalled();
    });

    it('hace trim al texto', () => {
      addNewTask(submitEvent({ text: '   Espaciado   ' }));
      expect(container.querySelector('.task-text').textContent).toBe('Espaciado');
    });

    it('persiste la tarea nueva', () => {
      addNewTask(submitEvent({ text: 'Persistida' }));
      expect(readTasks()).toHaveLength(1);
      expect(readTasks()[0].text).toBe('Persistida');
    });

    it('la nueva tarea va primero (prepend)', () => {
      addNewTask(submitEvent({ text: 'Primera' }));
      addNewTask(submitEvent({ text: 'Segunda' }));
      expect(container.querySelector('.task-text').textContent).toBe('Segunda');
    });

    it('asigna la prioridad elegida', () => {
      addNewTask(submitEvent({ text: 'Urgente', priority: 'high' }));
      expect(container.querySelector('.task').classList.contains('priority-high')).toBe(true);
    });

    it.each(VALID_PRIORITIES)('acepta la prioridad %s', (priority) => {
      addNewTask(submitEvent({ text: 'T', priority }));
      expect(container.querySelector('.task').classList.contains(`priority-${priority}`)).toBe(true);
    });

    it('usa la fecha indicada cuando se pasa', () => {
      addNewTask(submitEvent({ text: 'T', date: '2025-07-01' }));
      expect(container.querySelector('.task-date').textContent).toBe('01/07/2025');
    });

    it('usa la fecha de hoy si no se indica ninguna', () => {
      addNewTask(submitEvent({ text: 'T', date: '' }));
      expect(container.querySelector('.task-date').textContent)
        .toBe(formatDisplayDate(new Date()));
    });

    it('resetea el formulario y cierra el modal', () => {
      const ev = submitEvent({ text: 'T' });
      addNewTask(ev);
      expect(ev.target.reset).toHaveBeenCalled();
      expect(closeNewTaskModal).toHaveBeenCalled();
    });

    it('establece createdAt y recurrence "none"', () => {
      addNewTask(submitEvent({ text: 'T' }));
      const wrapper = container.querySelector('.task-wrapper');
      expect(wrapper.getAttribute('data-recurrence')).toBe('none');
      expect(wrapper.getAttribute('data-created-at')).toBe(String(Date.now()));
    });

    it('no crea nada y avisa si el texto está vacío', () => {
      addNewTask(submitEvent({ text: '   ' }));
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
      expect(window.alert).toHaveBeenCalledWith('La tarea no puede estar vacía.');
    });

    it('rechaza texto de más de 500 caracteres', () => {
      addNewTask(submitEvent({ text: 'a'.repeat(501) }));
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
      expect(window.alert).toHaveBeenCalledWith(
        'El texto de la tarea es demasiado largo. Máximo 500 caracteres permitidos.');
    });

    it('acepta exactamente 500 caracteres', () => {
      addNewTask(submitEvent({ text: 'a'.repeat(500) }));
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(1);
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('rechaza una fecha en el pasado', () => {
      addNewTask(submitEvent({ text: 'T', date: '2020-01-01' }));
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
      expect(window.alert).toHaveBeenCalledWith(
        'La fecha de la tarea no puede ser anterior a la fecha actual.');
    });

    it('acepta la fecha de hoy', () => {
      addNewTask(submitEvent({ text: 'T', date: TODAY_ISO }));
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(1);
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('acepta una fecha futura', () => {
      addNewTask(submitEvent({ text: 'T', date: '2030-12-31' }));
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('rechaza crear más de 100 tareas', () => {
      for (let i = 0; i < 100; i++) addNewTask(submitEvent({ text: `T${i}` }));
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(100);

      addNewTask(submitEvent({ text: 'T101' }));
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(100);
      expect(window.alert).toHaveBeenCalledWith('Número máximo de tareas alcanzado.');
    });

    it('los mensajes de alerta están traducidos al idioma activo', () => {
      setLanguage('en');
      addNewTask(submitEvent({ text: '' }));
      expect(window.alert).toHaveBeenCalledWith('Task cannot be empty.');
    });

    it('no lanza si no se inyectó callback de cierre', () => {
      initTaskManager(container, vi.fn(), null);
      expect(() => addNewTask(submitEvent({ text: 'T' }))).not.toThrow();
    });
  });

  // ── loadTasks ──────────────────────────────────────────────
  describe('loadTasks()', () => {
    it('no hace nada si no hay tareas guardadas', () => {
      loadTasks();
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
    });

    it('renderiza las tareas guardadas', () => {
      writeTasks([{ text: 'Guardada', done: false }]);
      loadTasks();
      expect(container.querySelector('.task-text').textContent).toBe('Guardada');
    });

    it('respeta el estado done', () => {
      writeTasks([{ text: 'A', done: true }, { text: 'B', done: false }]);
      loadTasks();
      const wrappers = container.querySelectorAll('.task-wrapper');
      expect(wrappers[0].querySelector('.task').classList.contains('done')).toBe(true);
      expect(wrappers[1].querySelector('.task').classList.contains('done')).toBe(false);
    });

    it('descarta tareas sin text string o sin done boolean', () => {
      writeTasks([
        { text: 'Válida', done: false },
        { done: false },
        { text: 'Sin done' },
        { text: 123, done: false },
        { text: 'done no booleano', done: 'sí' },
      ]);
      loadTasks();
      const texts = [...container.querySelectorAll('.task-text')].map(e => e.textContent);
      expect(texts).toEqual(['Válida']);
    });

    it('aplica defaults a los campos faltantes', () => {
      writeTasks([{ text: 'Mínima', done: false }]);
      loadTasks();
      const wrapper = container.querySelector('.task-wrapper');
      expect(wrapper.querySelector('.task').classList.contains('priority-medium')).toBe(true);
      expect(wrapper.getAttribute('data-recurrence')).toBe('none');
      expect(wrapper.querySelectorAll('.subtask-item')).toHaveLength(0);
    });

    it('usa la fecha de hoy si la tarea no tiene date', () => {
      writeTasks([{ text: 'Sin fecha', done: false }]);
      loadTasks();
      expect(container.querySelector('.task-date').textContent)
        .toBe(formatDisplayDate(new Date()));
    });

    it('renderiza las subtareas', () => {
      writeTasks([{ text: 'Con subs', done: false,
                    subtasks: [{ text: 's1', done: true }, { text: 's2', done: false }] }]);
      loadTasks();
      const subs = container.querySelectorAll('.subtask-item');
      expect(subs).toHaveLength(2);
      expect(subs[0].querySelector('.subtask-checkbox').checked).toBe(true);
    });

    it('reemplaza el contenido previo del contenedor', () => {
      writeTasks([{ text: 'A', done: false }]);
      loadTasks();
      loadTasks();
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(1);
    });

    it('lanza si no se inicializó el contenedor', () => {
      initTaskManager(null, vi.fn(), vi.fn());
      expect(() => loadTasks()).toThrow();
      initTaskManager(container, vi.fn(), closeNewTaskModal);
    });
  });

  // ── Recurrencia en loadTasks ───────────────────────────────
  describe('loadTasks() con tareas recurrentes', () => {
    const doneRecurring = (recurrence, lastCompleted) => ({
      text: 'Recurrente', done: true, recurrence, lastCompleted, subtasks: [{ text: 's', done: true }],
    });

    it('no resetea una recurrente completada hoy', () => {
      writeTasks([doneRecurring('daily', String(Date.now()))]);
      loadTasks();
      expect(container.querySelector('.task').classList.contains('done')).toBe(true);
    });

    it('resetea una diaria completada ayer', () => {
      const ayer = new Date(2025, 5, 14, 10, 0, 0).getTime();
      writeTasks([doneRecurring('daily', String(ayer))]);
      loadTasks();
      expect(container.querySelector('.task').classList.contains('done')).toBe(false);
    });

    it('al resetear actualiza la fecha a hoy', () => {
      const ayer = new Date(2025, 5, 14, 10, 0, 0).getTime();
      writeTasks([doneRecurring('daily', String(ayer))]);
      loadTasks();
      expect(container.querySelector('.task-date').textContent)
        .toBe(formatDisplayDate(new Date()));
    });

    it('al resetear desmarca las subtareas', () => {
      const ayer = new Date(2025, 5, 14, 10, 0, 0).getTime();
      writeTasks([doneRecurring('daily', String(ayer))]);
      loadTasks();
      expect(container.querySelector('.subtask-checkbox').checked).toBe(false);
    });

    it('al resetear limpia lastCompleted y lo persiste', () => {
      const ayer = new Date(2025, 5, 14, 10, 0, 0).getTime();
      writeTasks([doneRecurring('daily', String(ayer))]);
      loadTasks();
      expect(container.querySelector('.task-wrapper').hasAttribute('data-last-completed')).toBe(false);
      expect(readTasks()[0].lastCompleted).toBeNull();
    });

    it('resetea una semanal completada hace 8 días', () => {
      const ochoDias = new Date(2025, 5, 7, 10, 0, 0).getTime();
      writeTasks([doneRecurring('weekly', String(ochoDias))]);
      loadTasks();
      expect(container.querySelector('.task').classList.contains('done')).toBe(false);
    });

    it('no resetea una mensual del mismo mes', () => {
      writeTasks([doneRecurring('monthly', String(new Date(2025, 5, 2).getTime()))]);
      loadTasks();
      expect(container.querySelector('.task').classList.contains('done')).toBe(true);
    });

    it('no resetea una tarea no recurrente aunque sea antigua', () => {
      writeTasks([{ text: 'Normal', done: true, recurrence: 'none',
                    lastCompleted: String(new Date(2020, 0, 1).getTime()) }]);
      loadTasks();
      expect(container.querySelector('.task').classList.contains('done')).toBe(true);
    });

    it('no resetea si done es true pero falta lastCompleted', () => {
      writeTasks([{ text: 'Sin lastCompleted', done: true, recurrence: 'daily' }]);
      loadTasks();
      expect(container.querySelector('.task').classList.contains('done')).toBe(true);
    });

    it('no toca las tareas pendientes aunque su recurrencia sea antigua', () => {
      writeTasks([{ text: 'Pendiente', done: false, recurrence: 'daily',
                    lastCompleted: String(new Date(2020, 0, 1).getTime()) }]);
      loadTasks();
      expect(container.querySelector('.task').classList.contains('done')).toBe(false);
    });
  });

  // ── renderOrderedTasks ─────────────────────────────────────
  describe('renderOrderedTasks()', () => {
    const seed = (tasks) => {
      writeTasks(tasks);
      loadTasks();
    };

    it('deja las pendientes antes de las completadas', () => {
      seed([
        { text: 'Hecha1', done: true },
        { text: 'Pendiente1', done: false },
        { text: 'Hecha2', done: true },
        { text: 'Pendiente2', done: false },
      ]);
      renderOrderedTasks();
      const order = [...container.querySelectorAll('.task-text')].map(e => e.textContent);
      expect(order).toEqual(['Pendiente1', 'Pendiente2', 'Hecha1', 'Hecha2']);
    });

    it('conserva el orden relativo dentro de cada grupo', () => {
      seed([
        { text: 'P1', done: false }, { text: 'H1', done: true },
        { text: 'P2', done: false }, { text: 'H2', done: true },
      ]);
      renderOrderedTasks();
      const order = [...container.querySelectorAll('.task-text')].map(e => e.textContent);
      expect(order).toEqual(['P1', 'P2', 'H1', 'H2']);
    });

    it('persiste el nuevo orden', () => {
      seed([{ text: 'H', done: true }, { text: 'P', done: false }]);
      renderOrderedTasks();
      expect(readTasks().map(t => t.text)).toEqual(['P', 'H']);
    });

    it('funciona con todas las tareas pendientes', () => {
      seed([{ text: 'A', done: false }, { text: 'B', done: false }]);
      renderOrderedTasks();
      expect([...container.querySelectorAll('.task-text')].map(e => e.textContent))
        .toEqual(['A', 'B']);
    });

    it('funciona con todas completadas', () => {
      seed([{ text: 'A', done: true }, { text: 'B', done: true }]);
      renderOrderedTasks();
      expect([...container.querySelectorAll('.task-text')].map(e => e.textContent))
        .toEqual(['A', 'B']);
    });

    it('no rompe con el contenedor vacío', () => {
      expect(() => renderOrderedTasks()).not.toThrow();
    });
  });

  // ── highlightDueTasks ──────────────────────────────────────
  describe('highlightDueTasks()', () => {
    // Se calcula dentro de los tests: el cuerpo del describe se evalúa en
    // tiempo de colección, cuando el reloj fake todavía no está activo.
    const today = () => formatDisplayDate(new Date());

    it('marca due-today la tarea con la fecha de hoy', () => {
      writeTasks([{ text: 'Hoy', done: false, date: today() },
                  { text: 'Mañana', done: false, date: '20/06/2025' }]);
      loadTasks();
      highlightDueTasks();

      const wrappers = container.querySelectorAll('.task-wrapper');
      expect(wrappers[0].querySelector('.task').classList.contains('due-today')).toBe(true);
      expect(wrappers[1].querySelector('.task').classList.contains('due-today')).toBe(false);
    });

    it('es idempotente', () => {
      writeTasks([{ text: 'Hoy', done: false, date: today() }]);
      loadTasks();
      highlightDueTasks();
      highlightDueTasks();
      expect(container.querySelector('.task').classList.contains('due-today')).toBe(true);
    });

    it('no lanza con el contenedor vacío', () => {
      expect(() => highlightDueTasks()).not.toThrow();
    });
  });

  // ── toggleFilterToday ──────────────────────────────────────
  describe('toggleFilterToday()', () => {
    it('activa el filtro y cambia el texto del botón', () => {
      const btn = document.querySelector('.filterButton');
      toggleFilterToday({ target: btn });
      expect(container.classList.contains('filter-today-active')).toBe(true);
      expect(btn.textContent).toBe('Ver Todo');
      expect(btn.classList.contains('filter-active')).toBe(true);
    });

    it('lo desactiva al segundo click y restaura el texto', () => {
      const btn = document.querySelector('.filterButton');
      toggleFilterToday({ target: btn });
      toggleFilterToday({ target: btn });
      expect(container.classList.contains('filter-today-active')).toBe(false);
      expect(btn.textContent).toBe('Modo Enfoque');
      expect(btn.classList.contains('filter-active')).toBe(false);
    });

    it('el texto del botón está traducido', () => {
      setLanguage('en');
      const btn = document.querySelector('.filterButton');
      toggleFilterToday({ target: btn });
      expect(btn.textContent).toBe('Show All');
    });
  });
});
