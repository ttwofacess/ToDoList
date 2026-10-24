// ============================================================
// Tests unitarios — js/daySummary.js
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeDaySummary,
  formatDaySummary,
  renderDaySummary,
  initDaySummary,
} from '../../js/daySummary.js';
import { createTaskElement } from '../../js/taskRenderer.js';
import { setLanguage } from '../../js/i18n.js';
import { formatDisplayDate } from '../../js/dateUtils.js';

const today = () => formatDisplayDate(new Date());

const otherDay = () => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDisplayDate(date);
};

/** Deja correr la cola de microtareas del MutationObserver de jsdom. */
const flushObservers = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('daySummary', () => {
  let container;
  let summaryEl;

  const addTask = ({ done = false, date = today(), leaving = false } = {}) => {
    const wrapper = createTaskElement(
      'Tarea', date, 'low', [], 'none', null, '1700000000000', () => {},
    );
    if (done) wrapper.querySelector('.task').classList.add('done');
    if (leaving) wrapper.classList.add('leaving');
    container.appendChild(wrapper);
    return wrapper;
  };

  beforeEach(() => {
    mountAppDom();
    container = document.getElementById('tasksContainer');
    summaryEl = document.getElementById('daySummary');
    setLanguage('es');
  });

  // ── computeDaySummary() ───────────────────────────────────
  describe('computeDaySummary()', () => {
    it('con la lista vacía devuelve todo en cero', () => {
      expect(computeDaySummary(container)).toEqual({ total: 0, pending: 0, dueToday: 0 });
    });

    it('sin contenedor devuelve todo en cero', () => {
      expect(computeDaySummary(null)).toEqual({ total: 0, pending: 0, dueToday: 0 });
    });

    it('cuenta total, pendientes y vencen hoy', () => {
      addTask({ date: today() });
      addTask({ date: today() });
      addTask({ date: otherDay() });
      addTask({ date: otherDay(), done: true });

      expect(computeDaySummary(container)).toEqual({ total: 4, pending: 3, dueToday: 2 });
    });

    it('excluye las tareas que están saliendo (.leaving)', () => {
      addTask({ date: today() });
      addTask({ date: today(), leaving: true });

      expect(computeDaySummary(container)).toEqual({ total: 1, pending: 1, dueToday: 1 });
    });

    it('cuenta due-today sólo entre las pendientes', () => {
      addTask({ date: today(), done: true });
      addTask({ date: today() });

      expect(computeDaySummary(container)).toEqual({ total: 2, pending: 1, dueToday: 1 });
    });

    it('no cuenta tareas de otra fecha en dueToday', () => {
      addTask({ date: otherDay() });

      expect(computeDaySummary(container)).toEqual({ total: 1, pending: 1, dueToday: 0 });
    });

    it('ignora .search-hidden y el Modo Enfoque: son filtros visuales', () => {
      const hidden = addTask({ date: today() });
      hidden.classList.add('search-hidden');
      container.classList.add('filter-today-active');

      expect(computeDaySummary(container)).toEqual({ total: 1, pending: 1, dueToday: 1 });
    });
  });

  // ── formatDaySummary() ────────────────────────────────────
  describe('formatDaySummary()', () => {
    it('usa el texto y los placeholders en español', () => {
      setLanguage('es');
      expect(formatDaySummary({ pending: 5, dueToday: 2 }))
        .toBe('Pendientes: 5 · Vencen hoy: 2');
    });

    it('usa el texto y los placeholders en inglés', () => {
      setLanguage('en');
      expect(formatDaySummary({ pending: 5, dueToday: 2 }))
        .toBe('Pending: 5 · Due today: 2');
    });

    it('usa el texto y los placeholders en portugués', () => {
      setLanguage('pt');
      expect(formatDaySummary({ pending: 5, dueToday: 2 }))
        .toBe('Pendentes: 5 · Vencem hoje: 2');
    });

    it('reemplaza los ceros', () => {
      setLanguage('es');
      expect(formatDaySummary({ pending: 0, dueToday: 0 }))
        .toBe('Pendientes: 0 · Vencen hoy: 0');
    });
  });

  // ── renderDaySummary() ────────────────────────────────────
  describe('renderDaySummary()', () => {
    it('oculta el span con la lista vacía', () => {
      renderDaySummary(container);
      expect(summaryEl.hidden).toBe(true);
    });

    it('muestra el texto con tareas', () => {
      addTask({ date: today() });
      addTask({ date: otherDay() });

      renderDaySummary(container);

      expect(summaryEl.hidden).toBe(false);
      expect(summaryEl.textContent).toBe('Pendientes: 2 · Vencen hoy: 1');
    });

    it('vuelve a ocultarse si se quedó sin tareas', () => {
      const wrapper = addTask();
      renderDaySummary(container);
      expect(summaryEl.hidden).toBe(false);

      wrapper.remove();
      renderDaySummary(container);
      expect(summaryEl.hidden).toBe(true);
    });

    it('no lanza si #daySummary no existe', () => {
      summaryEl.remove();
      expect(() => renderDaySummary(container)).not.toThrow();
    });
  });

  // ── initDaySummary() ──────────────────────────────────────
  describe('initDaySummary()', () => {
    it('hace el render inicial con las tareas ya cargadas', () => {
      addTask({ date: today() });
      initDaySummary(container);

      expect(summaryEl.hidden).toBe(false);
      expect(summaryEl.textContent).toBe('Pendientes: 1 · Vencen hoy: 1');
    });

    it('re-renderiza al agregar una tarea', async () => {
      initDaySummary(container);
      expect(summaryEl.hidden).toBe(true);

      addTask({ date: today() });
      await flushObservers();

      expect(summaryEl.hidden).toBe(false);
      expect(summaryEl.textContent).toBe('Pendientes: 1 · Vencen hoy: 1');
    });

    it('re-renderiza al borrar una tarea', async () => {
      const wrapper = addTask({ date: today() });
      initDaySummary(container);

      wrapper.remove();
      await flushObservers();

      expect(summaryEl.hidden).toBe(true);
    });

    it('re-renderiza al alternar .done', async () => {
      const wrapper = addTask({ date: today() });
      initDaySummary(container);
      expect(summaryEl.textContent).toBe('Pendientes: 1 · Vencen hoy: 1');

      wrapper.querySelector('.task').classList.add('done');
      await flushObservers();

      expect(summaryEl.hidden).toBe(false);
      expect(summaryEl.textContent).toBe('Pendientes: 0 · Vencen hoy: 0');
    });
  });
});
