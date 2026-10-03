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
                     recurrence = 'none', subtasks = [], time = '' } = {}) => {
    wrapper = createTaskElement(text, date, priority, subtasks, recurrence, null,
                                '1700000000000', openActionModal, time);
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

  describe('botones para vaciar la hora', () => {
    it('el del formulario de nueva tarea vacía su input', () => {
      $('taskTime').value = '14:30';
      $('clearTaskTime').click();
      expect($('taskTime').value).toBe('');
    });

    it('el del formulario de edición vacía su input', () => {
      $('editTaskTime').value = '09:05';
      $('clearEditTaskTime').click();
      expect($('editTaskTime').value).toBe('');
    });

    it('no toca el input del otro formulario', () => {
      $('taskTime').value = '14:30';
      $('editTaskTime').value = '09:05';
      $('clearTaskTime').click();
      expect($('editTaskTime').value).toBe('09:05');
    });

    it('no envía el formulario al pulsarlos', () => {
      const submit = vi.fn();
      $('newTaskForm').addEventListener('submit', submit);
      $('taskTime').value = '14:30';
      $('clearTaskTime').click();
      expect(submit).not.toHaveBeenCalled();
      expect($('taskTime').value).toBe('');
    });

    it('tienen nombre accesible y título traducidos', () => {
      for (const id of ['clearTaskTime', 'clearEditTaskTime']) {
        expect($(id).getAttribute('aria-label')).toBe('Borrar la hora');
        expect($(id).title).toBe('Borrar la hora');
        expect($(id).textContent).toBe('×');
      }
      // setLanguage los retraduce: initModals corre antes de detectar el idioma
      setLanguage('en');
      expect($('clearTaskTime').getAttribute('aria-label')).toBe('Clear time');
      expect($('clearTaskTime').title).toBe('Clear time');
      expect($('clearTaskTime').textContent).toBe('×');
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

    describe('hora de vencimiento', () => {
      it('rellena el input con la hora guardada', () => {
        addTask({ time: '14:30' });
        openEditModal(wrapper);
        expect($('editTaskTime').value).toBe('14:30');
      });

      it('deja vacío el input si la tarea no tiene hora', () => {
        addTask();
        openEditModal(wrapper);
        expect($('editTaskTime').value).toBe('');
      });
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

    // El reloj del beforeEach está en 15/06/2025 10:00
    describe('hora de vencimiento', () => {
      it('añade la hora a una tarea que no la tenía', () => {
        openForEdit();
        $('editTaskDate').value = '2025-06-15';
        $('editTaskTime').value = '14:30';
        saveModalChanges(submitEvent());

        expect(wrapper.getAttribute('data-time')).toBe('14:30');
        expect(wrapper.querySelector('.task-time').textContent).toBe('14:30');
        expect(readTasks()[0].time).toBe('14:30');
        expect(isOpen($('editModal'))).toBe(false);
      });

      it('cambia la hora de una tarea que ya tenía', () => {
        openForEdit({ date: '01/07/2025', time: '09:00' });
        $('editTaskTime').value = '18:45';
        saveModalChanges(submitEvent());

        expect(wrapper.getAttribute('data-time')).toBe('18:45');
        expect(wrapper.querySelector('.task-time').textContent).toBe('18:45');
        expect(readTasks()[0].time).toBe('18:45');
      });

      it('quita la hora si el input queda vacío', () => {
        openForEdit({ date: '01/07/2025', time: '09:00' });
        $('editTaskTime').value = '';
        saveModalChanges(submitEvent());

        expect(wrapper.hasAttribute('data-time')).toBe(false);
        expect(wrapper.querySelector('.task-time').textContent).toBe('');
        expect(readTasks()[0].time).toBe('');
      });

      it('el botón × quita la hora y se guarda', () => {
        openForEdit({ date: '01/07/2025', time: '09:00' });
        $('clearEditTaskTime').click();
        saveModalChanges(submitEvent());
        expect(readTasks()[0].time).toBe('');
      });

      it('rechaza una hora que ya pasó hoy', () => {
        openForEdit();
        $('editTaskDate').value = '2025-06-15';
        $('editTaskTime').value = '09:00';
        saveModalChanges(submitEvent());

        expect(window.alert).toHaveBeenCalledWith(
          'La fecha y la hora de la tarea no pueden ser anteriores al momento actual.');
        expect(isOpen($('editModal'))).toBe(true);
        expect(wrapper.hasAttribute('data-time')).toBe(false);
      });

      it('acepta una hora que todavía no llega hoy', () => {
        openForEdit();
        $('editTaskDate').value = '2025-06-15';
        $('editTaskTime').value = '11:00';
        saveModalChanges(submitEvent());
        expect(window.alert).not.toHaveBeenCalled();
        expect(wrapper.getAttribute('data-time')).toBe('11:00');
      });

      it('sin hora sigue avisando sólo con la fecha', () => {
        openForEdit();
        $('editTaskDate').value = '2020-01-01';
        $('editTaskTime').value = '';
        saveModalChanges(submitEvent());
        expect(window.alert).toHaveBeenCalledWith(
          'La fecha de la tarea no puede ser anterior a la fecha actual.');
      });

      it('una hora inválida se ignora y se guarda como sin hora', () => {
        openForEdit({ date: '01/07/2025', time: '09:00' });
        $('editTaskTime').value = 'basura';
        saveModalChanges(submitEvent());
        expect(wrapper.hasAttribute('data-time')).toBe(false);
        expect(readTasks()[0].time).toBe('');
      });

      it('cambiar la fecha a una pasada sigue bloqueando el guardado', () => {
        openForEdit({ date: '01/07/2025', time: '09:00' });
        $('editTaskDate').value = '2020-01-01';
        saveModalChanges(submitEvent());
        expect(window.alert).toHaveBeenCalledWith(
          'La fecha y la hora de la tarea no pueden ser anteriores al momento actual.');
        expect(isOpen($('editModal'))).toBe(true);
        expect(wrapper.querySelector('.task-date').textContent).toBe('01/07/2025');
      });

      // El pasado sólo se valida si la fecha o la hora cambian, para que una
      // tarea vencida se pueda renombrar sin tener que arreglarla antes.
      it('permite editar el texto de una tarea cuya hora de hoy ya pasó', () => {
        openForEdit({ date: '15/06/2025', time: '09:00' });
        $('editTaskText').value = 'Renombrada';
        saveModalChanges(submitEvent());

        expect(window.alert).not.toHaveBeenCalled();
        expect(isOpen($('editModal'))).toBe(false);
        expect(wrapper.querySelector('.task-text').textContent).toBe('Renombrada');
        expect(wrapper.getAttribute('data-time')).toBe('09:00');
      });

      it('permite editar el texto de una tarea con fecha en el pasado', () => {
        openForEdit({ date: '01/01/2020' });
        $('editTaskText').value = 'Archivada';
        saveModalChanges(submitEvent());

        expect(window.alert).not.toHaveBeenCalled();
        expect(wrapper.querySelector('.task-text').textContent).toBe('Archivada');
      });

      it('quitarle la hora a una tarea vencida no dispara la validación', () => {
        openForEdit({ date: '15/06/2025', time: '09:00' });
        $('editTaskTime').value = '';
        saveModalChanges(submitEvent());

        expect(window.alert).not.toHaveBeenCalled();
        expect(wrapper.hasAttribute('data-time')).toBe(false);
      });
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
