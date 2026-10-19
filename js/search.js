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

// ─── Highlight de coincidencias ─────────────────────────────

/**
 * Estado del highlight por elemento .task-text:
 * { text: texto original sin marcar, tokens: firma de los tokens aplicados }.
 * WeakMap para no retener elementos que ya no están en el DOM.
 */
const highlightState = new WeakMap();

/**
 * Texto normalizado del original (minúsculas y sin tildes, igual que
 * normalize()) con un mapa de índices: cada code unit del normalizado
 * apunta al code point del original del que salió.
 * Hace falta porque los índices del texto normalizado NO coinciden con los
 * del original ("canción" → "cancion": el acento ocupa un lugar aparte).
 */
const buildNormalizedMap = (raw) => {
    const chars = [...raw];               // code points del original

    const rawUnit = [];                   // offset en code units de cada code point
    let units = 0;
    for (const ch of chars) {
        rawUnit.push(units);
        units += ch.length;
    }
    rawUnit.push(units);                  // longitud total del original

    let norm = '';
    const unitToChar = [];                // code unit del normalizado -> code point del original
    chars.forEach((ch, i) => {
        const out = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        norm += out;
        for (let k = 0; k < out.length; k++) unitToChar.push(i);
    });

    return { norm, unitToChar, rawUnit };
};

/** Rangos [inicio, fin) del texto ORIGINAL donde aparece el token. */
const findTokenRanges = (raw, token) => {
    if (!token) return [];
    const { norm, unitToChar, rawUnit } = buildNormalizedMap(raw);
    const ranges = [];
    let from = 0;

    while (from <= norm.length - token.length) {
        const idx = norm.indexOf(token, from);
        if (idx === -1) break;
        const startChar = unitToChar[idx];
        const endChar   = unitToChar[idx + token.length - 1] + 1;
        ranges.push([rawUnit[startChar], rawUnit[endChar]]);
        from = idx + token.length;
    }
    return ranges;
};

/**
 * Nodos del texto con las coincidencias envueltas en <mark>.
 * Los tokens tienen que venir normalizados (los de parseQuery()): así el
 * texto original se busca con las mismas reglas que usa el filtro.
 * Se arma con la API del DOM (createElement + createTextNode): nunca
 * innerHTML, así el riesgo de XSS es estructuralmente nulo.
 */
export const highlightText = (rawText, tokens) => {
    const raw = String(rawText ?? '');
    const list = (tokens ?? []).filter(Boolean);
    if (!raw || !list.length) return [document.createTextNode(raw)];

    const ranges = list
        .flatMap(tok => findTokenRanges(raw, tok))
        .sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    // Fusiona rangos solapados o contiguos ("pan" dentro de "panadería")
    const merged = [];
    for (const range of ranges) {
        const last = merged[merged.length - 1];
        if (last && range[0] <= last[1]) {
            last[1] = Math.max(last[1], range[1]);
        } else {
            merged.push([range[0], range[1]]);
        }
    }

    const nodes = [];
    let pos = 0;
    for (const [start, end] of merged) {
        if (start > pos) nodes.push(document.createTextNode(raw.slice(pos, start)));
        const mark = document.createElement('mark');
        mark.className = 'search-mark';
        mark.textContent = raw.slice(start, end);
        nodes.push(mark);
        pos = end;
    }
    if (pos < raw.length) nodes.push(document.createTextNode(raw.slice(pos)));
    return nodes;
};

/**
 * Marca las coincidencias del título de una tarea.
 * Si el texto fue editado, los <mark> desaparecieron: el texto que hay
 * pasa a ser el original nuevo.
 */
const applyHighlight = (el, tokens) => {
    const state    = highlightState.get(el);
    const hasMarks = !!el.querySelector('mark');
    const original = hasMarks ? (state?.text ?? el.textContent) : el.textContent;
    const signature = tokens.join('\u0000');

    if (hasMarks && state && state.tokens === signature && state.text === original) return;

    const nodes = highlightText(original, tokens);
    if (!nodes.some(n => n.nodeName === 'MARK')) {
        // El título no coincide (la tarea pudo coincidir por una subtarea)
        if (hasMarks) el.textContent = original;
        highlightState.delete(el);
        return;
    }

    el.replaceChildren(...nodes);
    highlightState.set(el, { text: original, tokens: signature });
};

/** Devuelve el título a su texto original, sin marcas. */
const revertHighlight = (el) => {
    const state = highlightState.get(el);
    if (!state) return;
    if (el.querySelector('mark')) el.textContent = state.text;
    highlightState.delete(el);
};

// ─── Aplicación del filtro ─────────────────────────────────

const OBSERVER_OPTIONS = { childList: true, subtree: true, characterData: true };

export const applySearch = () => {
    if (!tasksContainer) return;

    // El highlight reescribe el texto de los títulos (mutación de childList):
    // con el observer conectado eso dispararía applySearch() otra vez y el
    // ciclo no terminaría. Se pausa mientras se aplica el filtro y se
    // reconecta al final (disconnect() también vacía los registros
    // pendientes: el estado se recalcula entero de todos modos).
    observer?.disconnect();
    try {
        applyFilter();
    } finally {
        if (observer) observer.observe(tasksContainer, OBSERVER_OPTIONS);
    }
};

const applyFilter = () => {
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

        // Resaltar las coincidencias del título (sólo del título: la pista
        // data-search-hint ya señala por qué coincide una subtarea).
        const taskTextEl = wrapper.querySelector('.task-text');
        if (taskTextEl) {
            if (active && keep) applyHighlight(taskTextEl, tokens);
            else revertHighlight(taskTextEl);
        }

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
    observer.observe(container, OBSERVER_OPTIONS);

    applySearch();
};
