// ============================================================
// Tests unitarios — js/storage.js
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readTasks, writeTasks, clearTasks, persistFromDOM } from '../../js/storage.js';
import { setLanguage } from '../../js/i18n.js';
import { initRenderer, createTaskElement } from '../../js/taskRenderer.js';

const KEY = 'tasks';

describe('storage', () => {
  beforeEach(() => {
    localStorage.clear();
    setLanguage('es');
  });

  describe('readTasks()', () => {
    it('devuelve [] si no hay nada guardado', () => {
      expect(readTasks()).toEqual([]);
    });

    it('lee y parsea el array guardado', () => {
      const tasks = [{ text: 'Comprar pan', done: false, priority: 'high' }];
      localStorage.setItem(KEY, JSON.stringify(tasks));
      expect(readTasks()).toEqual(tasks);
    });

    it('devuelve [] si el JSON es inválido', () => {
      localStorage.setItem(KEY, '{esto-no-es-json');
      expect(readTasks()).toEqual([]);
    });

    it('devuelve [] si el JSON es válido pero no es un array', () => {
      localStorage.setItem(KEY, JSON.stringify({ text: 'objeto' }));
      expect(readTasks()).toEqual([]);
      localStorage.setItem(KEY, JSON.stringify('string'));
      expect(readTasks()).toEqual([]);
      localStorage.setItem(KEY, JSON.stringify(null));
      expect(readTasks()).toEqual([]);
    });

    it('devuelve [] si el valor es un string vacío', () => {
      localStorage.setItem(KEY, '');
      expect(readTasks()).toEqual([]);
    });

    it('no lanza si localStorage.getItem falla (modo privado)', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });
      expect(() => readTasks()).not.toThrow();
      expect(readTasks()).toEqual([]);
    });

    it('preserva campos extra sin filtrarlos', () => {
      const tasks = [{ text: 'x', done: true, customField: 42 }];
      localStorage.setItem(KEY, JSON.stringify(tasks));
      expect(readTasks()[0].customField).toBe(42);
    });
  });

  describe('writeTasks()', () => {
    it('serializa el array en la clave "tasks"', () => {
      const tasks = [{ text: 'A', done: false }];
      writeTasks(tasks);
      expect(JSON.parse(localStorage.getItem(KEY))).toEqual(tasks);
    });

    it('sobrescribe el contenido anterior', () => {
      writeTasks([{ text: 'viejo', done: false }]);
      writeTasks([{ text: 'nuevo', done: true }]);
      const raw = readTasks();
      expect(raw).toHaveLength(1);
      expect(raw[0].text).toBe('nuevo');
    });

    it('guarda un array vacío (no lo borra)', () => {
      writeTasks([{ text: 'x', done: false }]);
      writeTasks([]);
      expect(localStorage.getItem(KEY)).toBe('[]');
      expect(readTasks()).toEqual([]);
    });

    it('captura el error si localStorage.setItem lanza (cuota excedida)', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });
      expect(() => writeTasks([{ text: 'x' }])).not.toThrow();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('clearTasks()', () => {
    it('elimina la clave', () => {
      writeTasks([{ text: 'x', done: false }]);
      clearTasks();
      expect(localStorage.getItem(KEY)).toBeNull();
      expect(readTasks()).toEqual([]);
    });
  });

  describe('persistFromDOM()', () => {
    let container;

    beforeEach(() => {
      mountAppDom();
      container = document.getElementById('tasksContainer');
      initRenderer(container);
    });

    const addTaskToDom = (text, { done = false, priority = 'low', date = '15/06/2025',
                                   recurrence = 'none', lastCompleted = null,
                                   createdAt = '1700000000000', subtasks = [],
                                   time = '' } = {}) => {
      const el = createTaskElement(text, date, priority, subtasks, recurrence,
                                   lastCompleted, createdAt, () => {}, time);
      if (done) el.querySelector('.task').classList.add('done');
      container.appendChild(el);
      return el;
    };

    it('serializa el DOM vacío a un array vacío', () => {
      persistFromDOM(container);
      expect(readTasks()).toEqual([]);
    });

    it('extrae el texto, done, fecha, prioridad y recurrencia', () => {
      addTaskToDom('Hacer ejercicio', { done: true, priority: 'high', date: '20/06/2025' });
      persistFromDOM(container);

      const [task] = readTasks();
      expect(task.text).toBe('Hacer ejercicio');
      expect(task.done).toBe(true);
      expect(task.date).toBe('20/06/2025');
      expect(task.priority).toBe('high');
      expect(task.recurrence).toBe('none');
      expect(task.createdAt).toBe('1700000000000');
      expect(task.lastCompleted).toBeNull();
    });

    it('detecta las tres prioridades por sus clases', () => {
      container.innerHTML = '';
      addTaskToDom('A', { priority: 'high' });
      addTaskToDom('B', { priority: 'medium' });
      addTaskToDom('C', { priority: 'low' });
      persistFromDOM(container);
      expect(readTasks().map(t => t.priority)).toEqual(['high', 'medium', 'low']);
    });

    it('conserva el orden del DOM', () => {
      addTaskToDom('primera');
      addTaskToDom('segunda');
      addTaskToDom('tercera');
      persistFromDOM(container);
      expect(readTasks().map(t => t.text)).toEqual(['primera', 'segunda', 'tercera']);
    });

    it('serializa las subtareas con su estado done', () => {
      addTaskToDom('Tarea con subs', {
        subtasks: [{ text: 'sub 1', done: true }, { text: 'sub 2', done: false }],
      });
      persistFromDOM(container);
      expect(readTasks()[0].subtasks).toEqual([
        { text: 'sub 1', done: true },
        { text: 'sub 2', done: false },
      ]);
    });

    it('persiste lastCompleted y la recurrencia', () => {
      addTaskToDom('Recurrente', { recurrence: 'weekly', lastCompleted: '1750000000000' });
      persistFromDOM(container);
      const [task] = readTasks();
      expect(task.recurrence).toBe('weekly');
      expect(task.lastCompleted).toBe('1750000000000');
    });

    describe('hora de vencimiento', () => {
      it('guarda la hora del atributo data-time', () => {
        addTaskToDom('Con hora', { time: '14:30' });
        persistFromDOM(container);
        expect(readTasks()[0].time).toBe('14:30');
      });

      it('guarda string vacío si la tarea no tiene hora', () => {
        addTaskToDom('Sin hora');
        persistFromDOM(container);
        expect(readTasks()[0].time).toBe('');
      });

      it('la hora no se guarda dentro de date', () => {
        addTaskToDom('Con hora', { date: '20/06/2025', time: '09:05' });
        persistFromDOM(container);
        const [task] = readTasks();
        expect(task.date).toBe('20/06/2025');
        expect(task.time).toBe('09:05');
      });

      it('sobrevive al round-trip DOM → storage → DOM', () => {
        addTaskToDom('Con hora', { time: '23:59' });
        persistFromDOM(container);

        container.innerHTML = '';
        readTasks().forEach(t => {
          container.appendChild(createTaskElement(t.text, t.date, t.priority, t.subtasks,
            t.recurrence, t.lastCompleted, t.createdAt, () => {}, t.time));
        });
        persistFromDOM(container);
        expect(readTasks()[0].time).toBe('23:59');
      });
    });

    it('lee las subtareas desde el modal cuando data-active-modal="true"', () => {
      const el = addTaskToDom('Tarea abierta en modal');
      // Simula openActionModal(): mueve el contenedor de subtareas al modal
      el.setAttribute('data-active-modal', 'true');
      const subContainer = el.querySelector('.subtasks-container');
      subContainer.style.display = 'flex';
      document.getElementById('actionSubtasksContainer').appendChild(subContainer);

      const sub = document.createElement('div');
      sub.classList.add('subtask-item');
      sub.innerHTML = '<input type="checkbox" class="subtask-checkbox" checked>' +
                      '<span class="subtask-text">subtask en modal</span>';
      subContainer.appendChild(sub);

      persistFromDOM(container);
      expect(readTasks()[0].subtasks).toEqual([
        { text: 'subtask en modal', done: true },
      ]);
    });

    it('conserva el texto escapado tal cual se leyó del DOM', () => {
      addTaskToDom('Tarea con <b>html</b>');
      persistFromDOM(container);
      // DOMPurify permite etiquetas de formato inline, así que el texto
      // original se recupera intacto desde el textContent.
      expect(readTasks()[0].text).toBe('Tarea con <b>html</b>');
    });

    it('nunca persiste HTML ejecutable: <script> queda neutralizado', () => {
      addTaskToDom('Malo <script>alert(1)</script> <img src=x onerror=alert(2)>');
      persistFromDOM(container);
      const stored = readTasks()[0].text;
      expect(stored).not.toContain('<script>');
      expect(stored).not.toContain('onerror');
      expect(stored).not.toContain('</script>');
    });

    it('hace round-trip: DOM → storage → DOM sin perder datos', () => {
      addTaskToDom('Round trip', {
        done: true, priority: 'high', date: '01/01/2026',
        recurrence: 'daily', lastCompleted: '1767225600000',
        subtasks: [{ text: 'a', done: true }],
      });
      persistFromDOM(container);
      const fromStorage = readTasks();

      container.innerHTML = '';
      fromStorage.forEach(t => {
        const el = createTaskElement(t.text, t.date, t.priority, t.subtasks,
                                     t.recurrence, t.lastCompleted, t.createdAt, () => {});
        if (t.done) el.querySelector('.task').classList.add('done');
        container.appendChild(el);
      });
      persistFromDOM(container);
      expect(readTasks()).toEqual(fromStorage);
    });
  });
});
