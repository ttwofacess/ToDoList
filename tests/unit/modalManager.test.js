// ============================================================
// Tests unitarios — js/modalManager.js
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initModalManager,
  initModals,
  openActionModal,
  closeActionModal,
  openNewTaskModal,
  closeNewTaskModal,
  openEditModal,
  closeEditModal,
  saveModalChanges,
} from '../../js/modalManager.js';
import { initRenderer, createTaskElement } from '../../js/taskRenderer.js';
import { setLanguage } from '../../js/i18n.js';
import { formatDisplayDate } from '../../js/dateUtils.js';
import { readTasks } from '../../js/storage.js';

describe('modalManager', () => {
  let container;
  let wrapper;

  const $ = (id) => document.getElementById(id);
  const isOpen = (el) => el.style.display === 'flex';

  const addTask = ({ text = 'Tarea', priority = 'medium', date = '15/06/2025',
                     recurrence = 'none', subtasks = [] } = {}) => {
    wrapper = createTaskElement(text, date, priority, subtasks, recurrence, null,
                                '1700000000000', openActionModal);
    container.appendChild(wrapper);
    return wrapper;
  };

  const submitEvent = () => ({ preventDefault: vi.fn() });

  beforeEach(() => {
    mountAppDom();
    container = $('tasksContainer');
    initRenderer(container);
    initModalManager(container);
    initModals();
    setLanguage('es');
    localStorage.clear();

    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15, 10, 0, 0));
    vi.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Modal de acciones ──────────────────────────────────────
  describe('openActionModal() / closeActionModal()', () => {
    it('abre el modal y muestra el texto y los emojis de la tarea', () => {
      addTask({ text: 'Hacer ejercicio' });
      openActionModal(wrapper);
      expect(isOpen($('taskActionModal'))).toBe(true);
      expect($('actionModalText').textContent).toBe('Hacer ejercicio');
      expect($('actionModalEmojis').textContent)
        .toBe(wrapper.querySelector('.task-emojis').textContent);
    });

    it('marca el wrapper con data-active-modal', () => {
      addTask();
      openActionModal(wrapper);
      expect(wrapper.getAttribute('data-active-modal')).toBe('true');
    });

    it('cierra el modal y limpia data-active-modal', () => {
      addTask();
      openActionModal(wrapper);
      closeActionModal();
      expect(isOpen($('taskActionModal'))).toBe(false);
      expect(wrapper.hasAttribute('data-active-modal')).toBe(false);
    });

    it('mueve el contenedor de subtareas al modal al abrir', () => {
      addTask({ subtasks: [{ text: 's1', done: false }] });
      openActionModal(wrapper);
      expect($('actionSubtasksContainer').querySelector('.subtasks-container')).not.toBeNull();
      expect(wrapper.querySelector('.subtasks-container')).toBeNull();
    });

    it('muestra las subtareas dentro del modal', () => {
      addTask({ subtasks: [{ text: 's1', done: false }, { text: 's2', done: true }] });
      openActionModal(wrapper);
      const subs = $('actionSubtasksContainer').querySelectorAll('.subtask-item');
      expect(subs).toHaveLength(2);
      expect(subs[1].querySelector('.subtask-checkbox').checked).toBe(true);
    });

    it('devuelve las subtareas a la tarea al cerrar', () => {
      addTask({ subtasks: [{ text: 's1', done: false }] });
      openActionModal(wrapper);
      closeActionModal();
      expect(wrapper.querySelector('.subtasks-container')).not.toBeNull();
      expect($('actionSubtasksContainer').querySelector('.subtasks-container')).toBeNull();
    });

    it('oculta las subtareas de nuevo al cerrar', () => {
      addTask({ subtasks: [{ text: 's1', done: false }] });
      openActionModal(wrapper);
      closeActionModal();
      expect(wrapper.querySelector('.subtasks-container').style.display).toBe('none');
    });

    it.each([
      ['daily', 'recurrence-daily'],
      ['weekly', 'recurrence-weekly'],
      ['monthly', 'recurrence-monthly'],
    ])('refleja la recurrencia %s en el botón del modal', (rec, cls) => {
      addTask({ recurrence: rec });
      openActionModal(wrapper);
      expect($('actionRecurrence').classList.contains(cls)).toBe(true);
    });

    it('no deja clases de recurrencia si la tarea es "none"', () => {
      addTask();
      openActionModal(wrapper);
      const cls = $('actionRecurrence').classList;
      expect(cls.contains('recurrence-daily')).toBe(false);
      expect(cls.contains('recurrence-weekly')).toBe(false);
      expect(cls.contains('recurrence-monthly')).toBe(false);
    });

    it('abrir dos veces sin cerrar borra las subtareas del DOM (fragilidad)', () => {
      // Hallazgo: openActionModal() hace `modalSubContainer.innerHTML = ''`
      // y luego busca '.subtasks-container' DENTRO de wrapper. Como en la
      // segunda llamada el contenedor ya no está en wrapper (lo movió la
      // primera), no lo encuentra y las subtareas quedan destruidas.
      // No es alcanzable desde la UI (con el modal abierto no se puede
      // hacer click en la tarea de detrás), pero es una fragilidad real.
      addTask({ subtasks: [{ text: 's1', done: false }] });
      openActionModal(wrapper);
      openActionModal(wrapper);
      expect($('actionSubtasksContainer').querySelectorAll('.subtasks-container')).toHaveLength(0);
      expect($('actionSubtasksContainer').querySelectorAll('.subtask-item')).toHaveLength(0);
    });

    it('no rompe al abrir, cerrar y volver a abrir', () => {
      addTask({ subtasks: [{ text: 's1', done: false }] });
      openActionModal(wrapper);
      closeActionModal();
      openActionModal(wrapper);
      expect($('actionSubtasksContainer').querySelectorAll('.subtask-item')).toHaveLength(1);
      expect(wrapper.querySelectorAll('.subtask-item')).toHaveLength(0);
    });
  });

  // ── Botones del modal de acciones ──────────────────────────
  describe('acciones del modal', () => {
    beforeEach(() => {
      addTask({ subtasks: [{ text: 's1', done: false }] });
      openActionModal(wrapper);
    });

    it('actionDone marca la tarea como hecha y persiste', () => {
      $('actionDone').click();
      expect(wrapper.querySelector('.task').classList.contains('done')).toBe(true);
      expect(readTasks()[0].done).toBe(true);
    });

    it('actionDelete elimina la tarea, cierra el modal y persiste', () => {
      $('actionDelete').click();
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(0);
      expect(isOpen($('taskActionModal'))).toBe(false);
      expect(readTasks()).toEqual([]);
    });

    it('actionEdit cierra el modal de acciones y abre el de edición', () => {
      $('actionEdit').click();
      expect(isOpen($('taskActionModal'))).toBe(false);
      expect(isOpen($('editModal'))).toBe(true);
      expect($('editTaskText').value).toBe('Tarea');
    });

    it('actionSubtask añade el input de subtarea dentro del modal', () => {
      $('actionSubtask').click();
      expect($('actionSubtasksContainer').querySelector('.subtask-input-wrapper')).not.toBeNull();
    });

    it('actionRecurrence cambia la recurrencia y la persiste', () => {
      $('actionRecurrence').click();
      expect(wrapper.getAttribute('data-recurrence')).toBe('daily');
      expect(readTasks()[0].recurrence).toBe('daily');
    });

    it('closeActionModal cierra el modal', () => {
      $('closeActionModal').click();
      expect(isOpen($('taskActionModal'))).toBe(false);
    });
  });

  // ── Modal de nueva tarea ───────────────────────────────────
  describe('openNewTaskModal() / closeNewTaskModal()', () => {
    it('abre el modal y programa el foco en el input', () => {
      openNewTaskModal();
      expect(isOpen($('newTaskModal'))).toBe(true);
      vi.runAllTimers();
      expect(document.activeElement).toBe($('newTaskForm').querySelector('[name="taskText"]'));
    });

    it('añade la animación de entrada', () => {
      openNewTaskModal();
      expect($('newTaskModal').querySelector('.modal-content').classList.contains('tornado-animate'))
        .toBe(true);
    });

    it('cierra el modal y quita la animación', () => {
      openNewTaskModal();
      closeNewTaskModal();
      expect(isOpen($('newTaskModal'))).toBe(false);
      expect($('newTaskModal').querySelector('.modal-content').classList.contains('tornado-animate'))
        .toBe(false);
    });

    it('los botones abrir/cancelar controlan el modal', () => {
      $('openNewTaskModal').click();
      expect(isOpen($('newTaskModal'))).toBe(true);
      $('cancelNewTaskButton').click();
      expect(isOpen($('newTaskModal'))).toBe(false);

      $('openNewTaskModal').click();
      $('closeNewTaskModal').click();
      expect(isOpen($('newTaskModal'))).toBe(false);
    });
  });

  // ── Modal de edición ───────────────────────────────────────
  describe('openEditModal()', () => {
    it('rellena los campos con los datos de la tarea', () => {
      addTask({ text: 'Tarea a editar', priority: 'high', date: '20/07/2025' });
      openEditModal(wrapper);
      expect($('editTaskText').value).toBe('Tarea a editar');
      expect($('editTaskPriority').value).toBe('high');
      expect($('editTaskDate').value).toBe('2025-07-20');
    });

    it('convierte la fecha al formato ISO del input', () => {
      addTask({ date: '31/12/2026' });
      openEditModal(wrapper);
      expect($('editTaskDate').value).toBe('2026-12-31');
    });

    it.each([
      ['high', 'high'], ['medium', 'medium'], ['low', 'low'],
    ])('detecta la prioridad %s', (cls, expected) => {
      addTask({ priority: cls });
      openEditModal(wrapper);
      expect($('editTaskPriority').value).toBe(expected);
    });

    it('el botón X del modal de acciones abre el de edición sólo con una tarea activa', () => {
      // Sin openActionModal() previo no hay tarea en edición: el click es un no-op
      addTask();
      $('actionEdit').click();
      expect(isOpen($('editModal'))).toBe(false);
    });
  });

  describe('saveModalChanges()', () => {
    const openForEdit = (opts) => {
      addTask(opts);
      openEditModal(wrapper);
    };

    it('hace preventDefault', () => {
      openForEdit();
      const ev = submitEvent();
      saveModalChanges(ev);
      expect(ev.preventDefault).toHaveBeenCalled();
    });

    it('actualiza el texto, la prioridad y la fecha', () => {
      openForEdit({ text: 'Viejo', priority: 'low', date: '15/06/2025' });
      $('editTaskText').value = 'Nuevo texto';
      $('editTaskPriority').value = 'high';
      $('editTaskDate').value = '2025-09-01';
      saveModalChanges(submitEvent());

      expect(wrapper.querySelector('.task-text').textContent).toBe('Nuevo texto');
      const taskEl = wrapper.querySelector('.task');
      expect(taskEl.classList.contains('priority-high')).toBe(true);
      expect(taskEl.classList.contains('priority-low')).toBe(false);
      expect(wrapper.querySelector('.task-date').textContent).toBe('01/09/2025');
    });

    it('persiste los cambios', () => {
      openForEdit({ text: 'Viejo' });
      $('editTaskText').value = 'Nuevo';
      saveModalChanges(submitEvent());
      expect(readTasks()[0].text).toBe('Nuevo');
    });

    it('cierra el modal tras guardar', () => {
      openForEdit();
      saveModalChanges(submitEvent());
      expect(isOpen($('editModal'))).toBe(false);
    });

    it('hace trim al texto', () => {
      openForEdit();
      $('editTaskText').value = '   Espaciado   ';
      saveModalChanges(submitEvent());
      expect(wrapper.querySelector('.task-text').textContent).toBe('Espaciado');
    });

    it('rechaza texto vacío y avisa', () => {
      openForEdit();
      $('editTaskText').value = '   ';
      saveModalChanges(submitEvent());
      expect(window.alert).toHaveBeenCalledWith('La tarea no puede estar vacía.');
      expect(isOpen($('editModal'))).toBe(true);
    });

    it('rechaza texto de más de 500 caracteres', () => {
      openForEdit();
      $('editTaskText').value = 'a'.repeat(501);
      saveModalChanges(submitEvent());
      expect(window.alert).toHaveBeenCalledWith(
        'El texto de la tarea es demasiado largo. Máximo 500 caracteres permitidos.');
    });

    it('acepta exactamente 500 caracteres', () => {
      openForEdit();
      $('editTaskText').value = 'a'.repeat(500);
      saveModalChanges(submitEvent());
      expect(isOpen($('editModal'))).toBe(false);
    });

    it('rechaza una fecha en el pasado', () => {
      openForEdit();
      $('editTaskDate').value = '2020-01-01';
      saveModalChanges(submitEvent());
      expect(window.alert).toHaveBeenCalledWith(
        'La fecha de la tarea no puede ser anterior a la fecha actual.');
      expect(isOpen($('editModal'))).toBe(true);
    });

    it('acepta la fecha de hoy', () => {
      openForEdit();
      $('editTaskDate').value = '2025-06-15';
      saveModalChanges(submitEvent());
      expect(isOpen($('editModal'))).toBe(false);
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('no hace nada si no hay tarea en edición', () => {
      closeEditModal();
      expect(() => saveModalChanges(submitEvent())).not.toThrow();
    });

    it('sanitiza el texto editado (XSS)', () => {
      openForEdit();
      $('editTaskText').value = '<script>alert(1)</script>Hola';
      saveModalChanges(submitEvent());
      expect(wrapper.querySelector('.task-text').innerHTML).not.toContain('<script>');
    });

    it('el botón cancelar cierra el modal sin guardar', () => {
      openForEdit({ text: 'Original' });
      $('editTaskText').value = 'No guardado';
      $('cancelEditButton').click();
      expect(isOpen($('editModal'))).toBe(false);
      expect(wrapper.querySelector('.task-text').textContent).toBe('Original');
    });

    it('el botón X cierra el modal sin guardar', () => {
      openForEdit();
      $('closeEditModal').click();
      expect(isOpen($('editModal'))).toBe(false);
    });

    it('enviar el form por Enter guarda los cambios', () => {
      openForEdit({ text: 'Viejo' });
      $('editTaskText').value = 'Guardado con Enter';
      $('editTaskForm').dispatchEvent(new window.Event('submit', { cancelable: true }));
      expect(wrapper.querySelector('.task-text').textContent).toBe('Guardado con Enter');
    });
  });

  // ── Modal de donate ────────────────────────────────────────
  describe('modal de donate', () => {
    it('se abre y se cierra', () => {
      $('donateButton').click();
      expect(isOpen($('donateModal'))).toBe(true);
      $('donateModal').querySelector('.close-button').click();
      expect(isOpen($('donateModal'))).toBe(false);
    });

    it('se cierra al hacer click en el fondo', () => {
      $('donateButton').click();
      $('donateModal').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      expect(isOpen($('donateModal'))).toBe(false);
    });

    it('los botones copiar cambian el texto a "Copied!"', () => {
      vi.useFakeTimers();
      const btn = document.querySelector('.copy-button');
      const input = btn.previousElementSibling.querySelector('input');
      input.select = vi.fn();
      document.execCommand = vi.fn();

      btn.click();
      expect(btn.textContent).toBe('Copied!');
      vi.advanceTimersByTime(2000);
      expect(btn.textContent).toBe('Copiar');
    });
  });

  // ── Click en el fondo de cada modal ────────────────────────
  describe('click en el fondo (overlay)', () => {
    it.each([
      ['taskActionModal', openActionModal, 'taskActionModal'],
      ['editModal',      openEditModal,  'editModal'],
      ['newTaskModal',   openNewTaskModal, 'newTaskModal'],
    ])('cierra %s al hacer click fuera', (_name, opener) => {
      addTask();
      opener(wrapper ?? $('newTaskForm'));
      const modal = $(_name);
      expect(isOpen(modal)).toBe(true);
      modal.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      expect(isOpen(modal)).toBe(false);
    });
  });
});
