// ============================================================
// search.js — Responsabilidad: filtrar la lista por texto libre
//             (título de tarea + texto de subtareas)
// ============================================================

import { t } from './i18n.js';
import { isVisibleInFocusMode } from './taskManager.js';

let tasksContainer = null;
let input    = null;
let clearBtn = null;
let emptyEl  = null;
let emptyStateEl  = null;
let filterEmptyEl = null;
let countEl  = null;
let observer = null;
let keyHandler = null;

// ─── Funciones puras ───────────────────────────────────────

/** minúsculas + sin tildes/diacríticos + trim */
export const normalize = (str) =>
    String(str ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

/** "  Comprar  LECHE " → ['comprar', 'leche'] */
export const parseQuery = (raw) => normalize(raw).split(/\s+/).filter(Boolean);

/** ¿Están todos los términos en el texto? (AND) */
export const matchesQuery = (haystack, tokens) =>
    tokens.every((tok) => haystack.includes(tok));

const isModalActive = (wrapper) =>
    wrapper.getAttribute('data-active-modal') === 'true';

/**
 * Texto del contador: "3 de 12 tareas coinciden".
 * El singular se usa sólo con una única tarea en total ("1 de 1 tarea
 * coincide"): en los demás idiomas el verbo concuerda con el sustantivo
 * plural, así que "1 de 3 tareas coinciden" es lo correcto.
 */
export const formatSearchCount = (shown, total) => {
    const key = total === 1 ? 'searchCountOne' : 'searchCount';
    return t(key).replace('{shown}', shown).replace('{total}', total);
};

/**
 * Texto buscable de una tarea: título + subtareas, normalizado.
 * Si la tarea está abierta en el modal, sus subtareas están en
 * #actionSubtasksContainer (mismo criterio que persistFromDOM).
 */
export const getSearchableText = (wrapper) => {
    const title = wrapper.querySelector('.task-text')?.textContent ?? '';
    const root  = isModalActive(wrapper)
        ? document.getElementById('actionSubtasksContainer')
        : wrapper;
    const subs = [...(root?.querySelectorAll('.subtask-text') ?? [])]
        .map((el) => el.textContent);
    return normalize([title, ...subs].join('\n'));
};

// ─── Atajos de teclado ──────────────────────────────────────

/** ¿El foco está en un campo editable? */
const isEditableTarget = (el) =>
    !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);

/**
 * ¿Hay algún modal abierto? Los modales se abren y cierran únicamente con
 * style.display inline ('flex' / 'none'), así que alcanza con mirarlo.
 */
const isAnyModalOpen = () =>
    [...document.querySelectorAll('.modal')].some(m => m.style.display === 'flex');

/**
 * "/" enfoca el buscador; Ctrl/Cmd+K también, y si el buscador ya estaba
 * enfocado con texto, limpia la búsqueda.
 */
const onSearchShortcut = (e) => {
    if (!input || e.altKey) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (isAnyModalOpen()) return;
        e.preventDefault();
        if (document.activeElement === input && input.value) clearSearch();
        input.focus();
        input.select();
        return;
    }

    if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        if (isEditableTarget(e.target) || isAnyModalOpen()) return;
        e.preventDefault();
        input.focus();
        input.select();
    }
};

// ─── Aplicación del filtro ─────────────────────────────────

export const applySearch = () => {
    if (!tasksContainer) return;

    const raw      = input?.value ?? '';
    const tokens   = parseQuery(raw);
    const active   = tokens.length > 0;
    const wrappers = tasksContainer.querySelectorAll('.task-wrapper');
    const total    = wrappers.length;
    const focus    = tasksContainer.classList.contains('filter-today-active');
    let   matches  = 0;
    let   onFocus  = 0;

    wrappers.forEach((wrapper) => {
        // Nunca ocultar una tarea que el usuario tiene abierta en el modal
        const keep = !active
            || isModalActive(wrapper)
            || matchesQuery(getSearchableText(wrapper), tokens);
        wrapper.classList.toggle('search-hidden', !keep);
        if (keep) matches++;
        if (isVisibleInFocusMode(wrapper)) onFocus++;

        // Pista: si el título NO contiene todos los términos, mostrar la primera subtarea que coincida
        delete wrapper.dataset.searchHint;
        if (active && keep && !isModalActive(wrapper)) {
            const title = normalize(wrapper.querySelector('.task-text')?.textContent);
            if (!matchesQuery(title, tokens)) {
                const hit = [...wrapper.querySelectorAll('.subtask-text')]
                    .find((el) => tokens.some((tok) => normalize(el.textContent).includes(tok)));
                if (hit) wrapper.dataset.searchHint = `↳ ${hit.textContent}`;
            }
        }
    });

    tasksContainer.classList.toggle('search-active', active);

    // Estados vacíos, mutuamente excluyentes: la consulta activa manda (con
    // ella sólo se ve #searchEmpty) y sin consulta se ve #emptyState si no hay
    // ninguna tarea, o #filterEmpty si el Modo Enfoque las oculta todas.
    const showSearchEmpty = active && matches === 0;
    const showEmptyState  = !active && total === 0;
    const showFilterEmpty = !active && total > 0 && focus && onFocus === 0;

    if (emptyEl)       emptyEl.hidden       = !showSearchEmpty;
    if (emptyStateEl)  emptyStateEl.hidden  = !showEmptyState;
    if (filterEmptyEl) filterEmptyEl.hidden = !showFilterEmpty;
    if (clearBtn)      clearBtn.hidden      = raw === '';

    // Contador de resultados: complementario a #searchEmpty (que ya anuncia
    // el "no hay coincidencias"). Con 0 coincidencias se oculta, para no
    // repetir el cero.
    const showCount = active && matches > 0;
    if (countEl) {
        countEl.hidden = !showCount;
        if (showCount) countEl.textContent = formatSearchCount(matches, total);
    }
};

export const clearSearch = () => {
    if (input) input.value = '';
    applySearch();
};

// ─── Inicialización ────────────────────────────────────────

export const initSearch = (container) => {
    tasksContainer = container;
    input    = document.getElementById('taskSearch');
    clearBtn = document.getElementById('taskSearchClear');
    emptyEl  = document.getElementById('searchEmpty');
    emptyStateEl  = document.getElementById('emptyState');
    filterEmptyEl = document.getElementById('filterEmpty');
    countEl  = document.getElementById('searchCount');
    if (!input || !container) return;

    // Debe llamarse DESPUÉS de detectLanguage() para que t() ya use el idioma correcto
    if (clearBtn) {
        clearBtn.setAttribute('aria-label', t('searchClear'));
        clearBtn.title = t('searchClear');
        clearBtn.addEventListener('click', () => { clearSearch(); input.focus(); });
    }

    input.addEventListener('input', applySearch);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && input.value) {
            e.preventDefault();
            clearSearch();
        }
    });

    // Atajos de teclado. Se re-registra en cada initSearch() para no dejar
    // listeners duplicados (los tests reinicializan el módulo).
    if (keyHandler) document.removeEventListener('keydown', keyHandler);
    keyHandler = onSearchShortcut;
    document.addEventListener('keydown', keyHandler);

    // Reaplicar el filtro cuando el DOM de tareas cambie (alta, edición,
    // borrado, deshacer, importar, subtareas movidas al/desde el modal...).
    // Se recalcula siempre, también con la consulta vacía: los estados
    // vacíos dependen del total de tareas, no de la consulta.
    // Alternar clases = mutación de atributos → NO se observa → sin bucles.
    observer?.disconnect();
    observer = new MutationObserver(() => { applySearch(); });
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    applySearch();
};
