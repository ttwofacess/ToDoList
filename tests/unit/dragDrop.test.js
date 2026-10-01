// ============================================================
// Tests unitarios — js/dragDrop.js
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { attachDragListeners, initDragDrop } from '../../js/dragDrop.js';
import { initRenderer, createTaskElement } from '../../js/taskRenderer.js';
import { readTasks } from '../../js/storage.js';

describe('dragDrop', () => {
  let container;

  /** jsdom no hace layout: hay que simular getBoundingClientRect. */
  const stubLayout = (elements, height = 50) => {
    elements.forEach((el, i) => {
      el.getBoundingClientRect = () => ({
        top: i * height, height, bottom: i * height + height, left: 0, right: 100,
      });
    });
  };

  // Replica lo que hace taskManager.buildTaskElement(): crear + adjuntar drag.
  // createTaskElement() por sí solo NO adjunta los listeners de drag.
  const addTask = (text) => {
    const el = createTaskElement(text, '15/06/2025', 'low', [], 'none', null, null, () => {});
    attachDragListeners(el, container);
    container.appendChild(el);
    return el;
  };

  const dragOver = (clientY) => {
    const ev = new window.Event('dragover', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'clientY', { value: clientY });
    container.dispatchEvent(ev);
  };

  beforeEach(() => {
    mountAppDom();
    container = document.getElementById('tasksContainer');
    initRenderer(container);
    initDragDrop(container);
    localStorage.clear();
  });

  describe('attachDragListeners()', () => {
    it('dragstart añade la clase .dragging', () => {
      const task = addTask('A');
      task.dispatchEvent(new window.Event('dragstart'));
      expect(task.classList.contains('dragging')).toBe(true);
    });

    it('dragend quita la clase .dragging', () => {
      const task = addTask('A');
      task.dispatchEvent(new window.Event('dragstart'));
      task.dispatchEvent(new window.Event('dragend'));
      expect(task.classList.contains('dragging')).toBe(false);
    });

    it('dragend persiste el nuevo orden', () => {
      const a = addTask('A');
      addTask('B');
      const c = addTask('C');
      // Reordena como lo haría el dragover y luego "suelta"
      container.prepend(c);
      a.dispatchEvent(new window.Event('dragend'));
      expect(readTasks().map(t => t.text)).toEqual(['C', 'A', 'B']);
    });

    it('no persiste si sólo se arrastra sin soltar', () => {
      addTask('A');
      const task = container.querySelector('.task-wrapper');
      task.dispatchEvent(new window.Event('dragstart'));
      expect(readTasks()).toEqual([]);
    });

    it('con búsqueda activa cancela el dragstart y no añade .dragging', () => {
      const task = addTask('A');
      container.classList.add('search-active');
      const ev = new window.Event('dragstart', { cancelable: true });

      task.dispatchEvent(ev);

      expect(ev.defaultPrevented).toBe(true);
      expect(task.classList.contains('dragging')).toBe(false);
    });
  });

  describe('initDragDrop() — dragover', () => {
    it('hace preventDefault para permitir el drop', () => {
      addTask('A');
      const task = container.querySelector('.task-wrapper');
      task.classList.add('dragging');
      const ev = new window.Event('dragover', { bubbles: true, cancelable: true });
      Object.defineProperty(ev, 'clientY', { value: 0 });
      container.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(true);
    });

    it('inserta antes del elemento cuyo punto medio está por debajo del cursor', () => {
      const a = addTask('A');
      const b = addTask('B');
      const c = addTask('C');
      stubLayout([a, b, c]);  // A:0-50, B:50-100, C:100-150

      a.classList.add('dragging');
      dragOver(120);         // cursor en el tercio de C → A debe quedar antes de C

      const order = [...container.querySelectorAll('.task-text')].map(e => e.textContent);
      expect(order).toEqual(['B', 'A', 'C']);
    });

    it('mueve al final si el cursor está por debajo de todas las cajas', () => {
      const a = addTask('A');
      const b = addTask('B');
      stubLayout([a, b]);

      a.classList.add('dragging');
      dragOver(9999);

      const order = [...container.querySelectorAll('.task-text')].map(e => e.textContent);
      expect(order).toEqual(['B', 'A']);
    });

    it('no hace nada si no hay ningún elemento arrastrándose', () => {
      const a = addTask('A');
      const b = addTask('B');
      stubLayout([a, b]);

      dragOver(120); // sin .dragging en el DOM

      const order = [...container.querySelectorAll('.task-text')].map(e => e.textContent);
      expect(order).toEqual(['A', 'B']);
    });

    it('ignora el propio elemento arrastrado al calcular la posición', () => {
      const a = addTask('A');
      const b = addTask('B');
      const c = addTask('C');
      stubLayout([a, b, c]);

      a.classList.add('dragging');
      // Cursor muy arriba: si el propio A contara, se insertaría antes de sí mismo
      dragOver(-100);

      const order = [...container.querySelectorAll('.task-text')].map(e => e.textContent);
      expect(order).toEqual(['A', 'B', 'C']);
    });

    it('no duplica elementos al reordenar repetidamente', () => {
      const a = addTask('A');
      const b = addTask('B');
      const c = addTask('C');
      stubLayout([a, b, c]);

      a.classList.add('dragging');
      dragOver(10);
      dragOver(200);
      dragOver(10);

      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(3);
    });

    it('permite hacer dragover con la lista vacía sin fallar', () => {
      expect(() => dragOver(100)).not.toThrow();
    });
  });
});
