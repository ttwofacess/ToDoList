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
    const locales = {
        en: 'en-US',
        es: 'es-ES',
        pt: 'pt-BR'
    };
    return locales[lang] || 'en-US';
};

/**
 * Formatea una fecha en formato 'dd/mm/aa' o 'mm/dd/aa' según el idioma activo.
 * @param {Date} date
 * @returns {string}
 */
export const formatDisplayDate = (date) =>
    date.toLocaleDateString(getLocaleKey(), { day: '2-digit', month: '2-digit', year: 'numeric' });

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

// Regex de una hora canónica de 24 h tal como la entrega <input type="time">: 'HH:mm'.
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Indica si el string es una hora válida de 24 h ('HH:mm').
 * El string vacío no es una hora válida (significa "sin hora").
 * @param {*} s
 * @returns {boolean}
 */
export const isValidTime = (s) => typeof s === 'string' && TIME_RE.test(s);

/**
 * Convierte una hora 'HH:mm' en minutos desde medianoche.
 * @param {string} timeStr — Ej: '14:30'
 * @returns {number} — Ej: 870
 */
export const timeToMinutes = (timeStr) => {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
};

/**
 * Formatea una hora 'HH:mm' según el idioma activo (12 h en inglés,
 * 24 h en español/portugués). Devuelve '' si no hay hora válida.
 * @param {string} timeStr — Ej: '14:30'
 * @returns {string} — Ej: '14:30' (es/pt) | '02:30 PM' (en)
 */
export const formatDisplayTime = (timeStr) => {
    if (!isValidTime(timeStr)) return '';
    return new Date(2000, 0, 1, ...timeStr.split(':').map(Number))
        .toLocaleTimeString(getLocaleKey(), { hour: '2-digit', minute: '2-digit' });
};

/**
 * Combina la fecha ISO de un <input type="date"> con la hora 'HH:mm' de un
 * <input type="time"> en una única Date local.
 * Sin hora válida devuelve medianoche del día indicado.
 * @param {string} isoDate — Ej: '2025-06-15'
 * @param {string} [timeStr] — Ej: '14:30'
 * @returns {Date}
 */
export const isoStringToDateTime = (isoDate, timeStr = '') => {
    const date = isoStringToDate(isoDate);
    if (isValidTime(timeStr)) {
        const [h, m] = timeStr.split(':').map(Number);
        date.setHours(h, m, 0, 0);
    }
    return date;
};

/**
 * Devuelve true si la fecha/hora de vencimiento ya pasó.
 * Sin hora válida aplica la regla habitual: anterior a hoy (ignora la hora).
 * @param {string} isoDate — Fecha ISO del <input type="date"> ('2025-06-15')
 * @param {string} [timeStr] — Hora 'HH:mm' del <input type="time">, o '' si no hay
 * @returns {boolean}
 */
export const isDateTimeInPast = (isoDate, timeStr = '') =>
    isValidTime(timeStr)
        ? isoStringToDateTime(isoDate, timeStr) < new Date()
        : isDateInPast(isoStringToDate(isoDate));

/**
 * Convierte la fecha en formato display ('dd/mm/aa' o 'mm/dd/aa')
 * de vuelta al string ISO que requiere <input type="date">.
 * @param {string} displayDate
 * @returns {string} — Ej: '2025-06-15'
 */
export const displayDateToIso = (displayDate) => {
    const parts = displayDate.split('/');
    if (parts.length !== 3) return '';
    const year = parts[2];
    const lang = getLang();
    const [day, month] = (lang === 'es' || lang === 'pt')
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

/**
 * Genera dos emojis basados en una fecha (semilla).
 * Rango: U+1F600 a U+1F637 (emoticonos).
 * @param {Date} date
 * @returns {string} - Cadena con dos emojis.
 */
export const getTaskEmojis = (date) => {
    const h = date.getHours() + 1;
    const m = date.getMinutes() + 1;
    const s = date.getSeconds() + 1;
    const d = date.getDate() + 1;
    
    // Semilla según fórmula del usuario
    const seed = h * m * s * d;
    
    // Rango U+1F600 (128512) a U+1F637 (128567) -> 56 emojis
    const start = 0x1F600;
    const count = 56;
    
    const idx1 = seed % count;
    // Para el segundo emoji, alteramos la semilla ligeramente para que sea distinto
    const idx2 = (seed + h + m + s + d) % count;
    
    const emoji1 = String.fromCodePoint(start + idx1);
    const emoji2 = String.fromCodePoint(start + idx2);
    
    return `${emoji1}${emoji2}`;
};
