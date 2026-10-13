// ============================================================
// Tests unitarios — js/search.js
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  normalize,
  parseQuery,
  matchesQuery,
  getSearchableText,
  applySearch,
  clearSearch,
  initSearch,
} from '../../js/search.js';
import { initTaskManager, loadTasks } from '../../js/taskManager.js';
import { openActionModal } from '../../js/modalManager.js';
import { setLanguage } from '../../js/i18n.js';
import { writeTasks, readTasks } from '../../js/storage.js';
import { deleteTask, restoreTask } from '../../js/taskActions.js';
import { formatDisplayDate } from '../../js/dateUtils.js';

describe('search', () => {
  let container;
  let input;
  let clearBtn;
  let emptyEl;
  let emptyStateEl;
  let filterEmptyEl;

  /** Escribe tareas, las renderiza y las deja listas para buscar. */
  const seed = (tasks) => {
    writeTasks(tasks);
    loadTasks();
  };

  /** Escribe en el input y dispara el evento que dispara el filtro real. */
  const type = (value) => {
    input.value = value;
    input.dispatchEvent(new window.Event('input'));
  };

  /** Los wrappers visibles, en orden. */
  const visible = () =>
    [...container.querySelectorAll('.task-wrapper')]
      .filter(w => !w.classList.contains('search-hidden'))
      .map(w => w.querySelector('.task-text').textContent);

  beforeEach(() => {
    mountAppDom();
    container = document.getElementById('tasksContainer');
    input    = document.getElementById('taskSearch');
    clearBtn = document.getElementById('taskSearchClear');
    emptyEl  = document.getElementById('searchEmpty');
    emptyStateEl  = document.getElementById('emptyState');
    filterEmptyEl = document.getElementById('filterEmpty');

    initTaskManager(container, vi.fn(), vi.fn());
    setLanguage('es');
    localStorage.clear();
    initSearch(container);
  });

  // ── normalize() ───────────────────────────────────────────
  describe('normalize()', () => {
    it('pasa a minúsculas', () => {
      expect(normalize('COMPRAR PAN')).toBe('comprar pan');
    });

    it('quita tildes y diacríticos', () => {
      expect(normalize('Canción')).toBe('cancion');
      expect(normalize('ÁÉÍÓÚ')).toBe('aeiou');
    });

    it('hace trim de los extremos', () => {
      expect(normalize('   Espaciado   ')).toBe('espaciado');
    });

    it('normaliza mayúsculas, tildes y espacios a la vez', () => {
      expect(normalize('  CanCIÓN ')).toBe('cancion');
    });

    it('no rompe con null/undefined', () => {
      expect(normalize(null)).toBe('');
      expect(normalize(undefined)).toBe('');
    });
  });

  // ── parseQuery() ──────────────────────────────────────────
  describe('parseQuery()', () => {
    it('devuelve [] con la query vacía', () => {
      expect(parseQuery('')).toEqual([]);
      expect(parseQuery('    ')).toEqual([]);
    });

    it('divide por espacios y quita los sobrantes', () => {
      expect(parseQuery('  Comprar  LECHE ')).toEqual(['comprar', 'leche']);
    });

    it('normaliza cada término', () => {
      expect(parseQuery('Canción Árbol')).toEqual(['cancion', 'arbol']);
    });
  });

  // ── matchesQuery() ────────────────────────────────────────
  describe('matchesQuery()', () => {
    it('exige TODOS los términos (AND)', () => {
      expect(matchesQuery('comprar leche', ['comprar', 'leche'])).toBe(true);
      expect(matchesQuery('comprar pan', ['comprar', 'leche'])).toBe(false);
    });

    it('con la lista vacía devuelve true', () => {
      expect(matchesQuery('cualquier cosa', [])).toBe(true);
    });
  });

  // ── getSearchableText() ───────────────────────────────────
  describe('getSearchableText()', () => {
    it('incluye el título de la tarea', () => {
      seed([{ text: 'Comprar pan', done: false }]);
      expect(getSearchableText(container.querySelector('.task-wrapper')))
        .toBe('comprar pan');
    });

    it('incluye también el texto de las subtareas', () => {
      seed([{ text: 'Cocinar', done: false, subtasks: [{ text: 'Comprar leche', done: false }] }]);
      expect(getSearchableText(container.querySelector('.task-wrapper')))
        .toBe('cocinar\ncomprar leche');
    });

    it('normaliza el resultado', () => {
      seed([{ text: 'Canción', done: false, subtasks: [{ text: 'ÁLBUM', done: false }] }]);
      expect(getSearchableText(container.querySelector('.task-wrapper')))
        .toBe('cancion\nalbum');
    });

    it('con data-active-modal lee las subtareas de #actionSubtasksContainer', () => {
      seed([{ text: 'Cocinar', done: false, subtasks: [{ text: 'Comprar leche', done: false }] }]);
      const wrapper = container.querySelector('.task-wrapper');

      // openActionModal mueve el .subtasks-container al modal y marca el wrapper
      openActionModal(wrapper);
      expect(wrapper.querySelector('.subtask-text')).toBeNull();
      expect(getSearchableText(wrapper)).toBe('cocinar\ncomprar leche');
    });
  });

  // ── initSearch() ──────────────────────────────────────────
  describe('initSearch()', () => {
    it('no lanza si el input no existe en el DOM', () => {
      mountAppDom();
      document.getElementById('taskSearch').remove();
      expect(() => initSearch(document.getElementById('tasksContainer'))).not.toThrow();
    });

    it('traduce el aria-label y el title del botón "×" al idioma activo', () => {
      expect(clearBtn.getAttribute('aria-label')).toBe('Borrar búsqueda');
      expect(clearBtn.title).toBe('Borrar búsqueda');

      setLanguage('en');
      mountAppDom();
      initSearch(document.getElementById('tasksContainer'));
      expect(document.getElementById('taskSearchClear').getAttribute('aria-label'))
        .toBe('Clear search');
    });

    it('empieza con el botón "×" y el mensaje vacío ocultos', () => {
      expect(clearBtn.hidden).toBe(true);
      expect(emptyEl.hidden).toBe(true);
      expect(container.classList.contains('search-active')).toBe(false);
    });
  });

  // ── applySearch() ─────────────────────────────────────────
  describe('applySearch()', () => {
    beforeEach(() => {
      seed([
        { text: 'Comprar pan', done: false, subtasks: [{ text: 'en la panadería', done: false }] },
        { text: 'Cocinar cena', done: false, subtasks: [{ text: 'verduras', done: false }] },
        { text: 'Limpiar casa', done: false },
      ]);
    });

    it('con la query vacía no oculta nada', () => {
      type('');
      expect(visible()).toEqual(['Comprar pan', 'Cocinar cena', 'Limpiar casa']);
      expect(emptyEl.hidden).toBe(true);
    });

    it('filtra por el texto del título', () => {
      type('pan');
      expect(visible()).toEqual(['Comprar pan']);
    });

    it('filtra por el texto de una subtarea', () => {
      type('verduras');
      expect(visible()).toEqual(['Cocinar cena']);
    });

    it('ignora mayúsculas y tildes', () => {
      seed([{ text: 'Canción en el coche', done: false }]);
      type('cancion');
      expect(visible()).toEqual(['Canción en el coche']);
    });

    it('exige todos los términos, aunque estén repartidos', () => {
      type('comprar panadería');
      expect(visible()).toEqual(['Comprar pan']);
    });

    it('exige todos los términos también entre título y subtarea', () => {
      type('cocinar verduras');
      expect(visible()).toEqual(['Cocinar cena']);
    });

    it('sin resultados muestra el mensaje vacío', () => {
      type('zzzz');
      expect(visible()).toEqual([]);
      expect(emptyEl.hidden).toBe(false);
      expect(emptyEl.textContent).toBe('Ninguna tarea coincide con tu búsqueda.');
    });

    it('vuelve a ocultar el mensaje vacío si hay resultados', () => {
      type('zzzz');
      type('pan');
      expect(emptyEl.hidden).toBe(true);
    });

    it('muestra y quita .search-active en el contenedor', () => {
      type('pan');
      expect(container.classList.contains('search-active')).toBe(true);
      type('');
      expect(container.classList.contains('search-active')).toBe(false);
    });

    it('muestra y oculta el botón "×" según la query', () => {
      type('p');
      expect(clearBtn.hidden).toBe(false);
      type('');
      expect(clearBtn.hidden).toBe(true);
    });

    it('sólo con espacios la búsqueda sigue inactiva', () => {
      type('   ');
      expect(container.classList.contains('search-active')).toBe(false);
      expect(visible()).toHaveLength(3);
    });

    it('nunca oculta la tarea abierta en el modal', () => {
      type('verduras');
      const wrapper = container.querySelectorAll('.task-wrapper')[1];  // Cocinar cena
      openActionModal(wrapper);

      applySearch();

      // Misma query: normalmente ocultaría a "Cocinar cena" y a "Limpiar casa"
      expect(wrapper.classList.contains('search-hidden')).toBe(false);
      expect(visible()).toContain('Cocinar cena');
    });

    it('no lanza con el contenedor vacío', () => {
      seed([]);
      expect(() => applySearch()).not.toThrow();
    });

    it('no lanza si no se inicializó el contenedor', () => {
      initSearch(null);
      expect(() => applySearch()).not.toThrow();
    });
  });

  // ── applySearch() — pista de subtarea ─────────────────────
  describe('applySearch() — data-search-hint', () => {
    it('no pone pista si la coincidencia está en el título', () => {
      seed([{ text: 'Comprar pan', done: false, subtasks: [{ text: 'panadería', done: false }] }]);
      type('comprar');
      expect(container.querySelector('.task-wrapper').dataset.searchHint).toBeUndefined();
    });

    it('pone la pista con la subtarea que coincidió', () => {
      seed([{ text: 'Cocinar cena', done: false, subtasks: [{ text: 'verduras frescas', done: false }] }]);
      type('verduras');
      expect(container.querySelector('.task-wrapper').dataset.searchHint)
        .toBe('↳ verduras frescas');
    });

    it('borra la pista cuando la búsqueda se limpia', () => {
      seed([{ text: 'Cocinar cena', done: false, subtasks: [{ text: 'verduras', done: false }] }]);
      const wrapper = container.querySelector('.task-wrapper');
      type('verduras');
      expect(wrapper.dataset.searchHint).toBeDefined();

      type('');
      expect(wrapper.dataset.searchHint).toBeUndefined();
    });

    it('no pone pista en la tarea abierta en el modal', () => {
      seed([{ text: 'Cocinar cena', done: false, subtasks: [{ text: 'verduras', done: false }] }]);
      const wrapper = container.querySelector('.task-wrapper');
      openActionModal(wrapper);
      type('verduras');
      expect(wrapper.dataset.searchHint).toBeUndefined();
    });
  });

  // ── clearSearch() + atajos ────────────────────────────────
  describe('clearSearch()', () => {
    beforeEach(() => {
      seed([{ text: 'Comprar pan', done: false }, { text: 'Limpiar casa', done: false }]);
      type('pan');
    });

    it('vacia el input y restaura la lista', () => {
      clearSearch();
      expect(input.value).toBe('');
      expect(visible()).toEqual(['Comprar pan', 'Limpiar casa']);
    });

    it('oculta el botón "×" y el mensaje vacío', () => {
      clearSearch();
      expect(clearBtn.hidden).toBe(true);
      expect(emptyEl.hidden).toBe(true);
    });

    it('el botón "×" limpia y devuelve el foco al input', () => {
      clearBtn.click();
      expect(input.value).toBe('');
      expect(document.activeElement).toBe(input);
    });

    it('la tecla Escape limpia la búsqueda', () => {
      input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(input.value).toBe('');
      expect(visible()).toEqual(['Comprar pan', 'Limpiar casa']);
    });

    it('Escape con el input vacío no hace nada', () => {
      clearSearch();
      const ev = new window.KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
      input.dispatchEvent(ev);
      expect(ev.defaultPrevented).toBe(false);
    });
  });

  // ── MutationObserver ──────────────────────────────────────
  describe('reaplica el filtro cuando cambia el DOM', () => {
    // Los callbacks del MutationObserver se encolan como microtareas.
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    it('filtra una tarea añadida con la búsqueda ya activa', async () => {
      seed([{ text: 'Comprar pan', done: false }]);
      type('pan');
      expect(visible()).toEqual(['Comprar pan']);

      writeTasks([
        { text: 'Comprar pan', done: false },
        { text: 'Otra cosa', done: false },
      ]);
      loadTasks();
      await flush();

      expect(visible()).toEqual(['Comprar pan']);
    });

    it('hace visible una tarea nueva que sí coincide', async () => {
      seed([{ text: 'Comprar pan', done: false }]);
      type('pan');

      writeTasks([
        { text: 'Comprar pan', done: false },
        { text: 'Comprar pan y queso', done: false },
      ]);
      loadTasks();
      await flush();

      expect(visible()).toEqual(['Comprar pan', 'Comprar pan y queso']);
    });

    it('reevalúa cuando cambia el texto de una tarea', async () => {
      seed([{ text: 'Comprar pan', done: false }, { text: 'Limpiar casa', done: false }]);
      type('pan');
      expect(visible()).toEqual(['Comprar pan']);

      // saveModalChanges escribe con textContent (mutación de characterData)
      container.querySelectorAll('.task-text')[1].textContent = 'Comprar pan y queso';
      await flush();

      expect(visible()).toEqual(['Comprar pan', 'Comprar pan y queso']);
    });

    it('no filtra si la búsqueda está vacía', async () => {
      seed([{ text: 'A', done: false }]);
      writeTasks([{ text: 'A', done: false }, { text: 'B', done: false }]);
      loadTasks();
      await flush();
      expect(container.querySelectorAll('.search-hidden')).toHaveLength(0);
    });

    it('no entra en bucle al alternar clases', async () => {
      seed([{ text: 'Comprar pan', done: false }, { text: 'Limpiar casa', done: false }]);
      type('pan');
      await flush();
      await flush();
      expect(visible()).toEqual(['Comprar pan']);
      expect(container.querySelectorAll('.task-wrapper')).toHaveLength(2);
    });
  });

  // ── La búsqueda es sólo vista ─────────────────────────────
  describe('no afecta a la persistencia', () => {
    it('buscar no cambia lo que hay en localStorage', () => {
      seed([
        { text: 'Comprar pan', done: false, subtasks: [{ text: 'panadería', done: false }] },
        { text: 'Limpiar casa', done: false },
      ]);
      const before = readTasks();

      type('panadería');
      expect(visible()).toEqual(['Comprar pan']);

      expect(readTasks()).toEqual(before);
      expect(readTasks()).toHaveLength(2);
    });

    it('la búsqueda no se persiste entre recargas', () => {
      seed([{ text: 'Comprar pan', done: false }]);
      type('pan');
      // Simula una recarga: loadTasks() reconstruye el DOM desde el storage
      loadTasks();
      expect(container.querySelector('#taskSearch')).toBeNull();   // el input vive en index.html
      expect(input.value).toBe('pan');                              // el estado no se guarda
      expect(localStorage.getItem('search')).toBeNull();
    });
  });

  // ── Estados vacíos ─────────────────────────────────────────
  // Matriz: consulta inactiva y 0 tareas → #emptyState; consulta activa y
  // 0 coincidencias → #searchEmpty; enfoque activo sin tareas visibles
  // → #filterEmpty. Nunca se ven dos a la vez.
  describe('estados vacíos', () => {
    const today = () => formatDisplayDate(new Date());

    // Los callbacks del MutationObserver se encolan como microtareas.
    const flush = () => new Promise(resolve => setTimeout(resolve, 0));

    /** Qué bloque está visible ahora mismo. */
    const notices = () => ({
      empty:  !emptyStateEl.hidden,
      search: !emptyEl.hidden,
      filter: !filterEmptyEl.hidden,
    });

    it('los nodos de estado viven fuera de #tasksContainer', () => {
      seed([{ text: 'Comprar pan', done: false }]);
      expect(container.contains(emptyStateEl)).toBe(false);
      expect(container.contains(filterEmptyEl)).toBe(false);
      expect(container.children).toHaveLength(1);          // sólo el wrapper
    });

    it('con cero tareas y consulta vacía sólo aparece #emptyState', () => {
      seed([]);
      applySearch();
      expect(notices()).toEqual({ empty: true, search: false, filter: false });
    });

    it('la primera tarea oculta #emptyState', async () => {
      seed([]);
      applySearch();
      expect(notices().empty).toBe(true);

      seed([{ text: 'Comprar pan', done: false }]);
      await flush();                       // el MutationObserver recalcula solo
      expect(notices()).toEqual({ empty: false, search: false, filter: false });
    });

    it('borrar la última tarea vuelve a mostrar #emptyState', async () => {
      seed([{ text: 'Comprar pan', done: false }]);
      applySearch();
      expect(notices().empty).toBe(false);

      deleteTask(container.querySelector('.task-wrapper'), container);
      await flush();
      expect(notices().empty).toBe(true);
    });

    it('deshacer el borrado de la última tarea lo oculta', async () => {
      seed([
        { text: 'Comprar pan', done: false },
        { text: 'Limpiar casa', done: false },
      ]);
      const [first, second] = [...container.querySelectorAll('.task-wrapper')];

      const snapshot = deleteTask(second, container);
      await flush();
      expect(notices().empty).toBe(false);      // todavía queda una

      deleteTask(first, container);
      await flush();
      expect(notices().empty).toBe(true);

      restoreTask(snapshot, container);
      await flush();
      expect(notices().empty).toBe(false);
    });

    it('una importación vacía vuelve a mostrar #emptyState', async () => {
      seed([{ text: 'Comprar pan', done: false }]);
      applySearch();
      expect(notices().empty).toBe(false);

      writeTasks([]);
      loadTasks();
      await flush();
      expect(notices().empty).toBe(true);
    });

    it('la consulta activa manda: con cero tareas se ve #searchEmpty', () => {
      seed([]);
      type('zzz');
      expect(notices()).toEqual({ empty: false, search: true, filter: false });
    });

    it('una consulta de sólo espacios no cuenta como activa', () => {
      seed([]);
      type('   ');
      expect(notices()).toEqual({ empty: true, search: false, filter: false });
    });

    it('con coincidencias no se ve ningún estado vacío', () => {
      seed([{ text: 'Comprar pan', done: false }]);
      type('pan');
      expect(notices()).toEqual({ empty: false, search: false, filter: false });
    });

    it('limpiar la búsqueda con cero tareas deja #emptyState', () => {
      seed([]);
      type('zzz');
      clearSearch();
      expect(notices()).toEqual({ empty: true, search: false, filter: false });
    });

    describe('Modo Enfoque sin tareas visibles', () => {
      // El filtro real sólo cambia clases: quien recalcula es el módulo, así
      // que aquí se alterna la clase y se llama a applySearch() como hace
      // el click del botón (main.js encadena toggleFilterToday + applySearch).
      const focusOn  = () => {
        container.classList.add('filter-today-active');
        applySearch();
      };
      const focusOff = () => {
        container.classList.remove('filter-today-active');
        applySearch();
      };

      it('muestra #filterEmpty cuando el Modo Enfoque oculta todas', () => {
        seed([{ text: 'Para otro día', done: false, date: '01/01/2030', priority: 'low' }]);
        focusOn();
        expect(notices()).toEqual({ empty: false, search: false, filter: true });
      });

      it('no muestra nada si una tarea vence hoy', () => {
        seed([
          { text: 'Para hoy', done: false, date: today(), priority: 'low' },
          { text: 'Para otro día', done: false, date: '01/01/2030', priority: 'low' },
        ]);
        focusOn();
        expect(notices().filter).toBe(false);
      });

      it('no muestra nada si hay una tarea de prioridad alta sin completar', () => {
        seed([{ text: 'Urgente', done: false, date: '01/01/2030', priority: 'high' }]);
        focusOn();
        expect(notices().filter).toBe(false);
      });

      it('una tarea alta ya completada no pasa el filtro', () => {
        seed([{ text: 'Urgente hecha', done: true, date: '01/01/2030', priority: 'high' }]);
        focusOn();
        expect(notices().filter).toBe(true);
      });

      it('con cero tareas manda #emptyState, no el aviso del filtro', () => {
        seed([]);
        focusOn();
        expect(notices()).toEqual({ empty: true, search: false, filter: false });
      });

      it('con consulta activa manda #searchEmpty', () => {
        seed([{ text: 'Para otro día', done: false, date: '01/01/2030', priority: 'low' }]);
        focusOn();
        type('zzz');
        expect(notices()).toEqual({ empty: false, search: true, filter: false });
      });

      it('al desactivar el Modo Enfoque el aviso desaparece', () => {
        seed([{ text: 'Para otro día', done: false, date: '01/01/2030', priority: 'low' }]);
        focusOn();
        expect(notices().filter).toBe(true);

        focusOff();
        expect(notices()).toEqual({ empty: false, search: false, filter: false });
      });
    });
  });
});
