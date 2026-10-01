// ============================================================
// search.js — Responsabilidad: filtrar la lista por texto libre
//             (título de tarea + texto de subtareas)
// ============================================================

import { t } from './i18n.js';

let tasksContainer = null;
let input    = null;
let clearBtn = null;
let emptyEl  = null;
let observer = null;

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

// ─── Aplicación del filtro ─────────────────────────────────

export const applySearch = () => {
    if (!tasksContainer) return;

    const raw    = input?.value ?? '';
    const tokens = parseQuery(raw);
    const active = tokens.length > 0;
    let matches  = 0;

    tasksContainer.querySelectorAll('.task-wrapper').forEach((wrapper) => {
        // Nunca ocultar una tarea que el usuario tiene abierta en el modal
        const keep = !active
            || isModalActive(wrapper)
            || matchesQuery(getSearchableText(wrapper), tokens);
        wrapper.classList.toggle('search-hidden', !keep);
        if (keep) matches++;

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
    if (emptyEl)  emptyEl.hidden  = !(active && matches === 0);
    if (clearBtn) clearBtn.hidden = raw === '';
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
    if (!input) return;

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

    // Reaplicar el filtro cuando el DOM de tareas cambie (alta, edición,
    // borrado, deshacer, importar, subtareas movidas al/desde el modal...).
    // Alternar clases = mutación de atributos → NO se observa → sin bucles.
    observer?.disconnect();
    observer = new MutationObserver(() => {
        if (input.value.trim()) applySearch();
    });
    observer.observe(container, { childList: true, subtree: true, characterData: true });

    applySearch();
};
