// ============================================================
// dateUtils.js — Responsabilidad: Formateo y lógica de fechas
// ============================================================

import { getLang } from './i18n.js';

/**
 * Devuelve la clave de locale para las APIs de Intl.
 * Ej: 'es' → 'es-ES', 'en' → 'en-EN'
 */
export const getLocaleKey = () => {
    const lang = getLang();
    return `${lang}-${lang.toUpperCase()}`;
};

/**
 * Formatea una fecha en formato 'dd/mm/aa' o 'mm/dd/aa' según el idioma activo.
 * @param {Date} date
 * @returns {string}
 */
export const formatDisplayDate = (date) =>
    date.toLocaleDateString(getLocaleKey(), { day: '2-digit', month: '2-digit', year: '2-digit' });

/**
 * Convierte el string ISO de un <input type="date"> ('yyyy-mm-dd')
 * a una Date correcta (evita el offset de zona horaria).
 * @param {string} isoString — Ej: '2025-06-15'
 * @returns {Date}
 */
export const isoStringToDate = (isoString) => {
    const [year, month, day] = isoString.split('-').map(Number);
    return new Date(year, month - 1, day);
};

/**
 * Devuelve true si la fecha dada es anterior a hoy (ignorando la hora).
 * @param {Date} date
 * @returns {boolean}
 */
export const isDateInPast = (date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
};

/**
 * Convierte la fecha en formato display ('dd/mm/aa' o 'mm/dd/aa')
 * de vuelta al string ISO que requiere <input type="date">.
 * @param {string} displayDate
 * @returns {string} — Ej: '2025-06-15'
 */
export const displayDateToIso = (displayDate) => {
    const parts = displayDate.split('/');
    if (parts.length !== 3) return '';
    const year = '20' + parts[2];
    const lang = getLang();
    const [day, month] = lang === 'es'
        ? [parts[0].padStart(2, '0'), parts[1].padStart(2, '0')]
        : [parts[1].padStart(2, '0'), parts[0].padStart(2, '0')];
    return `${year}-${month}-${day}`;
};

/**
 * Rellena el widget de fecha en el header con el día actual.
 */
export const renderHeaderDate = () => {
    const lang = getLang();
    const date = new Date();
    document.getElementById('dateNumber').textContent =
        date.toLocaleString(lang, { day: 'numeric' });
    document.getElementById('dateText').textContent =
        date.toLocaleString(lang, { weekday: 'long' });
    document.getElementById('dateMonth').textContent =
        date.toLocaleString(lang, { month: 'short' });
    document.getElementById('dateYear').textContent =
        date.toLocaleString(lang, { year: 'numeric' });
};

/**
 * Determina si una tarea recurrente debe resetearse según su último completado.
 * @param {'daily'|'weekly'|'monthly'} recurrence
 * @param {number} lastCompleted — timestamp en ms
 * @returns {boolean}
 */
export const shouldResetRecurringTask = (recurrence, lastCompleted) => {
    const lastDate = new Date(lastCompleted);
    const now = new Date();

    if (recurrence === 'daily') {
        return lastDate.getDate() !== now.getDate() ||
               lastDate.getMonth() !== now.getMonth() ||
               lastDate.getFullYear() !== now.getFullYear();
    }
    if (recurrence === 'weekly') {
        const diffMs = Math.abs(now - lastDate);
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24)) >= 7;
    }
    if (recurrence === 'monthly') {
        return lastDate.getMonth() !== now.getMonth() ||
               lastDate.getFullYear() !== now.getFullYear();
    }
    return false;
};
