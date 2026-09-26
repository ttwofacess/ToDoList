// ============================================================
// Tests unitarios — js/taskRenderer.js
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  VALID_RECURRENCES,
  VALID_PRIORITIES,
  initRenderer,
  createSubtaskElement,
  createTaskElement,
  showSubtaskInput,
  toggleRecurrence,
} from '../../js/taskRenderer.js';
import { setLanguage } from '../../js/i18n.js';
import { formatDisplayDate } from '../../js/dateUtils.js';
import { readTasks } from '../../js/storage.js';

describe('taskRenderer', () => {
  let container;

  beforeEach(() => {
    mountAppDom();
    container = document.getElementById('tasksContainer');
    initRenderer(container);
    setLanguage('es');
  });

  describe('constantes exportadas', () => {
    it('VALID_RECURRENCES es la lista canónica', () => {
      expect(VALID_RECURRENCES).toEqual(['none', 'daily', 'weekly', 'monthly']);
    });

    it('VALID_PRIORITIES es la lista canónica', () => {
      expect(VALID_PRIORITIES).toEqual(['high', 'medium', 'low']);
    });
  });

  describe('createTaskElement()', () => {
    const build = (overrides = {}) => createTaskElement(
      overrides.text ?? 'Tarea',
      overrides.date ?? '15/06/2025',
      overrides.priority ?? 'medium',
      overrides.subtasks ?? [],
      overrides.recurrence ?? 'none',
      overrides.lastCompleted ?? null,
      overrides.createdAt ?? '1700000000000',
      overrides.onOpenActions ?? (() => {}),
    );

    it('devuelve un .task-wrapper con la estructura esperada', () => {
      const el = build();
      expect(el.tagName).toBe('DIV');
      expect(el.classList.contains('task-wrapper')).toBe(true);
      expect(el.querySelector('.task')).not.toBeNull();
      expect(el.querySelector('.task-text')).not.toBeNull();
      expect(el.querySelector('.task-date')).not.toBeNull();
      expect(el.querySelector('.recurrence-badge')).not.toBeNull();
      expect(el.querySelector('.subtasks-container')).not.toBeNull();
      expect(el.querySelector('.task-emojis')).not.toBeNull();
    });

    it('establece el texto de la tarea', () => {
      expect(build({ text: 'Comprar leche' }).querySelector('.task-text').textContent)
        .toBe('Comprar leche');
    });

    it('aplica la clase de prioridad', () => {
      expect(build({ priority: 'high' }).querySelector('.task').classList.contains('priority-high'))
        .toBe(true);
    });

    it('establece la fecha mostrada', () => {
      expect(build({ date: '01/01/2026' }).querySelector('.task-date').textContent)
        .toBe('01/01/2026');
    });

    it('marca la tarea como due-today si la fecha es hoy', () => {
      const today = formatDisplayDate(new Date());
      expect(build({ date: today }).querySelector('.task').classList.contains('due-today'))
        .toBe(true);
    });

    it('no marca due-today si la fecha es otra', () => {
      expect(build({ date: '01/01/2020' }).querySelector('.task').classList.contains('due-today'))
        .toBe(false);
    });

    it('es draggable', () => {
      expect(build().draggable).toBe(true);
    });

    it('guarda data-recurrence y data-created-at', () => {
      const el = build({ recurrence: 'weekly', createdAt: '1700000000000' });
      expect(el.getAttribute('data-recurrence')).toBe('weekly');
      expect(el.getAttribute('data-created-at')).toBe('1700000000000');
    });

    it('no pone data-last-completed si es null', () => {
      expect(build().hasAttribute('data-last-completed')).toBe(false);
    });

    it('pone data-last-completed si se proporciona', () => {
      expect(build({ lastCompleted: '1750000000000' })
        .getAttribute('data-last-completed')).toBe('1750000000000');
    });

    it('genera 2 emojis derivados de createdAt', () => {
      const el = build({ createdAt: '1700000000000' });
      const emojis = el.querySelector('.task-emojis').textContent;
      expect([...emojis]).toHaveLength(2);
    });

    it('los emojis son estables para el mismo createdAt', () => {
      const a = build({ createdAt: '1700000000000' }).querySelector('.task-emojis').textContent;
      const b = build({ createdAt: '1700000000000' }).querySelector('.task-emojis').textContent;
      expect(a).toBe(b);
    });

    it('el contenedor de subtareas arranca oculto', () => {
      expect(build().querySelector('.subtasks-container').style.display).toBe('none');
    });

    it('renderiza las subtareas iniciales', () => {
      const el = build({ subtasks: [{ text: 'sub A', done: true }, { text: 'sub B', done: false }] });
      const subs = el.querySelectorAll('.subtask-item');
      expect(subs).toHaveLength(2);
      expect(subs[0].querySelector('.subtask-text').textContent).toBe('sub A');
      expect(subs[0].querySelector('.subtask-checkbox').checked).toBe(true);
      expect(subs[0].querySelector('.subtask-text').classList.contains('subtask-done')).toBe(true);
      expect(subs[1].querySelector('.subtask-text').classList.contains('subtask-done')).toBe(false);
    });

    it('el badge de recurrencia está vacío si es "none"', () => {
      const badge = build({ recurrence: 'none' }).querySelector('.recurrence-badge');
      expect(badge.textContent).toBe('');
      expect(badge.hasAttribute('data-recurrence-value')).toBe(false);
    });

    it.each([
      ['daily', 'Diaria'],
      ['weekly', 'Semanal'],
      ['monthly', 'Mensual'],
    ])('el badge de recurrencia %s muestra la traducción', (rec, label) => {
      const badge = build({ recurrence: rec }).querySelector('.recurrence-badge');
      expect(badge.textContent).toBe(label);
      expect(badge.getAttribute('data-recurrence-value')).toBe(rec);
    });

    it('el badge refleja el idioma activo', () => {
      setLanguage('en');
      expect(build({ recurrence: 'daily' }).querySelector('.recurrence-badge').textContent)
        .toBe('Daily');
    });

    it('onOpenActions se dispara al hacer click en la tarea', () => {
      const cb = vi.fn();
      const el = build({ onOpenActions: cb });
      el.querySelector('.task').click();
      expect(cb).toHaveBeenCalledTimes(1);
      expect(cb).toHaveBeenCalledWith(el);
    });

    // ── Seguridad ──
    it('sanitiza HTML ejecutable en el texto', () => {
      const el = build({ text: '<script>alert(1)</script>Hola' });
      // DOMPurify elimina la etiqueta <script> y su contenido
      expect(el.querySelector('.task-text').textContent).toBe('Hola');
      expect(el.querySelector('.task-text').innerHTML).not.toContain('<script>');
    });

    it('elimina atributos on* (XSS)', () => {
      const el = build({ text: '<img src=x onerror="alert(1)">' });
      expect(el.querySelector('.task-text').innerHTML).not.toContain('onerror');
    });

    it('no ejecuta scripts inyectados', () => {
      const spy = vi.fn();
      window.alert = spy;
      build({ text: '<img src=x onerror=window.alert(1)>' });
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('createSubtaskElement()', () => {
    it('crea la estructura de subtarea', () => {
      const item = createSubtaskElement('Hacer algo', false);
      expect(item.classList.contains('subtask-item')).toBe(true);
      expect(item.querySelector('.subtask-checkbox').type).toBe('checkbox');
      expect(item.querySelector('.subtask-text').textContent).toBe('Hacer algo');      expect(item.querySelector('.subtask-delete')).not.toBeNull();
    });

    it('refleja el estado done inicial', () => {
      const item = createSubtaskElement('x', true);
      expect(item.querySelector('.subtask-checkbox').checked).toBe(true);
      expect(item.querySelector('.subtask-text').classList.contains('subtask-done')).toBe(true);
    });

    it('al marcar el checkbox se aplica subtask-done y se persiste', () => {
      const item = createSubtaskElement('x', false);
      const wrapper = createTaskElement('T', '15/06/2025', 'low', [], 'none', null, null, () => {});
      wrapper.appendChild(item);
      container.appendChild(wrapper);

      const checkbox = item.querySelector('.subtask-checkbox');
      checkbox.checked = true;
      checkbox.dispatchEvent(new window.Event('change'));

      expect(item.querySelector('.subtask-text').classList.contains('subtask-done')).toBe(true);
      expect(readTasks()[0].subtasks[0].done).toBe(true);
    });

    it('al desmarcar se quita subtask-done y se persiste', () => {
      const item = createSubtaskElement('x', true);
      const wrapper = createTaskElement('T', '15/06/2025', 'low', [], 'none', null, null, () => {});
      wrapper.appendChild(item);
      container.appendChild(wrapper);

      const checkbox = item.querySelector('.subtask-checkbox');
      checkbox.checked = false;
      checkbox.dispatchEvent(new window.Event('change'));

      expect(item.querySelector('.subtask-text').classList.contains('subtask-done')).toBe(false);
      expect(readTasks()[0].subtasks[0].done).toBe(false);
    });

    it('el botón delete quita la subtarea y persiste', () => {
      const item = createSubtaskElement('x', false);
      const wrapper = createTaskElement('T', '15/06/2025', 'low',
        [{ text: 'x', done: false }], 'none', null, null, () => {});
      container.appendChild(wrapper);
      const real = wrapper.querySelector('.subtask-delete');
      real.click();

      expect(wrapper.querySelectorAll('.subtask-item')).toHaveLength(0);
      expect(readTasks()[0].subtasks).toEqual([]);
    });

    it('el click en delete no propaga al click de la tarea', () => {
      const onOpen = vi.fn();
      const wrapper = createTaskElement('T', '15/06/2025', 'low',
        [{ text: 'sub', done: false }], 'none', null, null, onOpen);
      container.appendChild(wrapper);
      wrapper.querySelector('.subtask-delete').click();
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('sanitiza el texto de la subtarea', () => {
      const item = createSubtaskElement('<script>alert(1)</script>z', false);
      expect(item.querySelector('.subtask-text').innerHTML).not.toContain('<script>');
    });
  });

  describe('showSubtaskInput()', () => {
    it('añade el input al contenedor', () => {
      showSubtaskInput(container);
      expect(container.querySelector('.subtask-input-wrapper')).not.toBeNull();
      expect(container.querySelector('.subtask-input').placeholder).toBe('Nueva subtarea...');
    });

    it('no crea un segundo input si ya existe', () => {
      showSubtaskInput(container);
      showSubtaskInput(container);
      expect(container.querySelectorAll('.subtask-input-wrapper')).toHaveLength(1);
    });

    it('guarda la subtarea y quita el input al confirmar', () => {
      const wrapper = createTaskElement('T', '15/06/2025', 'low', [], 'none', null, null, () => {});
      const subContainer = wrapper.querySelector('.subtasks-container');
      wrapper.appendChild(subContainer);
      container.appendChild(wrapper);

      showSubtaskInput(subContainer);
      const input = subContainer.querySelector('.subtask-input');
      input.value = '  Nueva sub  ';
      subContainer.querySelectorAll('button')[0].click();

      const subs = wrapper.querySelectorAll('.subtask-item');
      expect(subs).toHaveLength(1);
      expect(subs[0].querySelector('.subtask-text').textContent).toBe('Nueva sub');
      expect(subContainer.querySelector('.subtask-input-wrapper')).toBeNull();
    });

    it('no crea subtarea si el texto está vacío', () => {
      showSubtaskInput(container);
      container.querySelector('.subtask-input').value = '   ';
      container.querySelectorAll('.subtask-input-wrapper button')[0].click();
      expect(container.querySelectorAll('.subtask-item')).toHaveLength(0);
    });

    it('Enter guarda la subtarea', () => {
      showSubtaskInput(container);
      const input = container.querySelector('.subtask-input');
      input.value = 'Con Enter';
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(container.querySelector('.subtask-text').textContent).toBe('Con Enter');
    });

    it('Escape cancela y quita el input', () => {
      showSubtaskInput(container);
      const input = container.querySelector('.subtask-input');
      input.value = 'No se guarda';
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(container.querySelector('.subtask-input-wrapper')).toBeNull();
      expect(container.querySelectorAll('.subtask-item')).toHaveLength(0);
    });

    it('el botón cancelar quita el input', () => {
      showSubtaskInput(container);
      container.querySelectorAll('.subtask-input-wrapper button')[1].click();
      expect(container.querySelector('.subtask-input-wrapper')).toBeNull();
    });
  });

  describe('toggleRecurrence()', () => {
    let wrapper;

    beforeEach(() => {
      wrapper = createTaskElement('Tarea', '15/06/2025', 'low', [], 'none', null, null, () => {});
      container.appendChild(wrapper);
    });

    it('cicla none → daily → weekly → monthly → none', () => {
      const expected = ['daily', 'weekly', 'monthly', 'none'];
      for (const rec of expected) {
        toggleRecurrence(wrapper);
        expect(wrapper.getAttribute('data-recurrence')).toBe(rec);
      }
    });

    it('actualiza el texto del badge en cada paso', () => {
      const badge = wrapper.querySelector('.recurrence-badge');
      toggleRecurrence(wrapper);
      expect(badge.textContent).toBe('Diaria');
      toggleRecurrence(wrapper);
      expect(badge.textContent).toBe('Semanal');
      toggleRecurrence(wrapper);
      expect(badge.textContent).toBe('Mensual');
      toggleRecurrence(wrapper);
      expect(badge.textContent).toBe('');
    });

    it('quita data-recurrence-value al volver a none', () => {
      toggleRecurrence(wrapper);
      toggleRecurrence(wrapper);
      toggleRecurrence(wrapper);
      toggleRecurrence(wrapper);
      expect(wrapper.querySelector('.recurrence-badge').hasAttribute('data-recurrence-value'))
        .toBe(false);
    });

    it('persiste el cambio', () => {
      toggleRecurrence(wrapper);
      expect(readTasks()[0].recurrence).toBe('daily');
      toggleRecurrence(wrapper);
      expect(readTasks()[0].recurrence).toBe('weekly');
    });

    it('sincroniza las clases del botón del modal si está abierto', () => {
      toggleRecurrence(wrapper);
      const btn = document.getElementById('actionRecurrence');
      expect(btn.classList.contains('recurrence-daily')).toBe(true);
      toggleRecurrence(wrapper);
      expect(btn.classList.contains('recurrence-daily')).toBe(false);
      expect(btn.classList.contains('recurrence-weekly')).toBe(true);
    });

    it('al volver a none quita todas las clases de recurrencia del botón', () => {
      const btn = document.getElementById('actionRecurrence');
      toggleRecurrence(wrapper);
      toggleRecurrence(wrapper);
      toggleRecurrence(wrapper);
      toggleRecurrence(wrapper);
      expect(btn.classList.contains('recurrence-daily')).toBe(false);
      expect(btn.classList.contains('recurrence-weekly')).toBe(false);
      expect(btn.classList.contains('recurrence-monthly')).toBe(false);
    });

    it('el badge usa el idioma activo', () => {
      setLanguage('en');
      toggleRecurrence(wrapper);
      expect(wrapper.querySelector('.recurrence-badge').textContent).toBe('Daily');
    });
  });
});
