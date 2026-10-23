// ============================================================
// daySummary.js — Responsabilidad: contador del día en el header
//                 (pendientes · vencen hoy). Sólo lectura del DOM.
// ============================================================

import { t } from './i18n.js';
import { formatDisplayDate } from './dateUtils.js';

const SUMMARY_ID = 'daySummary';

let tasksContainer = null;
let summaryEl = null;
let observer = null;

// ─── Funciones puras ───────────────────────────────────────

/**
 * Resumen del día a partir del DOM de tareas.
 * - total: todas las tarjetas (excluye las que están saliendo).
 * - pending: las que no tienen .done.
 * - dueToday: pendientes cuya fecha visible es hoy. No se lee .due-today,
 *   que puede quedar desactualizado tras editar la fecha.
 * Los filtros visuales (.search-hidden, Modo Enfoque) no alteran el conteo:
 * es un resumen del día, no de lo visible.
 * @param {HTMLElement} container
 * @returns {{ total: number, pending: number, dueToday: number }}
 */
export const computeDaySummary = (container) => {
    const summary = { total: 0, pending: 0, dueToday: 0 };
    if (!container) return summary;

    const today = formatDisplayDate(new Date());

    container.querySelectorAll('.task-wrapper:not(.leaving)').forEach((wrapper) => {
        summary.total += 1;

        const task = wrapper.querySelector('.task');
        if (!task || task.classList.contains('done')) return;
        summary.pending += 1;

        const dateEl = wrapper.querySelector('.task-date');
        if (dateEl && dateEl.textContent === today) summary.dueToday += 1;
    });

    return summary;
};

/** "Pendientes: 5 · Vencen hoy: 2" en el idioma activo. */
export const formatDaySummary = ({ pending, dueToday }) =>
    t('daySummary')
        .replace('{pending}', pending)
        .replace('{due}', dueToday);

// ─── Render ────────────────────────────────────────────────

const getSummaryEl = () => summaryEl ?? document.getElementById(SUMMARY_ID);

/**
 * Escribe el resumen en #daySummary. Con la lista vacía se oculta: el
 * estado vacío ya comunica que no hay nada.
 * @param {HTMLElement} [container]
 */
export const renderDaySummary = (container = tasksContainer) => {
    const el = getSummaryEl();
    if (!el || !container) return;

    const summary = computeDaySummary(container);
    if (summary.total === 0) {
        el.hidden = true;
        return;
    }

    el.textContent = formatDaySummary(summary);
    el.hidden = false;
};

// ─── Inicialización ────────────────────────────────────────

/**
 * Guarda referencias y mantiene el contador al día ante cualquier mutación
 * de la lista (alta, done, borrado, undo, edición, import, drag).
 *
 * El span vive FUERA de #tasksContainer (en el header), así que escribir en
 * él no vuelve a disparar el observer. Si algún día se mueve dentro del
 * contenedor observado, se crearía un bucle de mutaciones.
 * @param {HTMLElement} container
 */
export const initDaySummary = (container) => {
    tasksContainer = container;
    summaryEl = document.getElementById(SUMMARY_ID);
    if (!container) return;

    observer?.disconnect();
    observer = new MutationObserver(() => { renderDaySummary(); });
    observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class'],
    });

    renderDaySummary();
};
