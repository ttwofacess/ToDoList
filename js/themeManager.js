// ============================================================
// themeManager.js — Responsabilidad: Tema manual (light/dark/auto)
// ============================================================

import { t } from './i18n.js';

export const THEME_KEY = 'theme';
export const VALID_THEMES = ['light', 'dark', 'auto'];
export const DEFAULT_THEME = 'auto';

let initialized = false;
let button = null;

/**
 * Lee el tema guardado en localStorage y lo valida.
 * Devuelve "auto" si falta, es inválido o localStorage no está disponible.
 * @returns {'light' | 'dark' | 'auto'}
 */
export const getStoredTheme = () => {
    try {
        const raw = localStorage.getItem(THEME_KEY);
        return VALID_THEMES.includes(raw) ? raw : DEFAULT_THEME;
    } catch {
        return DEFAULT_THEME;
    }
};

/**
 * Guarda el tema en localStorage. Ignora valores inválidos
 * y captura errores de cuota / modo privado.
 * @param {'light' | 'dark' | 'auto'} theme
 */
export const setStoredTheme = (theme) => {
    if (!VALID_THEMES.includes(theme)) return;
    try {
        localStorage.setItem(THEME_KEY, theme);
    } catch (error) {
        console.error('Error saving theme:', error);
    }
};

/**
 * Devuelve el tema del sistema. Toma "light" como fallback
 * si matchMedia no está disponible (tests / navegadores viejos).
 * @returns {'light' | 'dark'}
 */
export const getSystemTheme = () => {
    if (typeof window === 'undefined' || !window.matchMedia) return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
};

/**
 * Resuelve el tema efectivo: light/dark se devuelven tal cual,
 * auto se resuelve consultando al sistema.
 * @param {'light' | 'dark' | 'auto'} theme
 * @returns {'light' | 'dark'}
 */
export const resolveTheme = (theme) =>
    theme === 'light' || theme === 'dark'
        ? theme
        : getSystemTheme();

/**
 * Aplica el tema al documento y actualiza el icono y el aria-label
 * del botón según el tema crudo elegido. El atributo siempre guarda
 * el tema ya resuelto (light/dark): el CSS no tiene media queries de
 * color, así que "auto" se resuelve acá y no queda nunca en el DOM.
 * @param {'light' | 'dark' | 'auto'} theme
 */
export const applyTheme = (theme) => {
    document.documentElement.dataset.theme = resolveTheme(theme);

    if (button) {
        setToggleUi(button, theme);
    }
};

/**
 * Siguiente tema del ciclo: light → dark → auto → light.
 * @param {'light' | 'dark' | 'auto'} theme
 * @returns {'light' | 'dark' | 'auto'}
 */
export const nextTheme = (theme) => {
    const index = VALID_THEMES.indexOf(theme);
    const fallback = index === -1 ? VALID_THEMES.indexOf(DEFAULT_THEME) : index;
    return VALID_THEMES[(fallback + 1) % VALID_THEMES.length];
};

/**
 * Actualiza el icono visible y el aria-label del botón según el tema crudo.
 * @param {HTMLElement} btn
 * @param {'light' | 'dark' | 'auto'} theme
 */
const setToggleUi = (btn, theme) => {
    btn.setAttribute('aria-label', t(`themeToggle${capitalize(theme)}`));

    btn.querySelectorAll('[data-theme-icon]').forEach((icon) => {
        const iconTheme = icon.getAttribute('data-theme-icon');
        icon.toggleAttribute('hidden', iconTheme !== theme);
    });
};

const capitalize = ([first, ...rest]) => first.toUpperCase() + rest.join('');

/**
 * Inicializa el toggle de tema: aplica el tema guardado, engancha
 * el click del botón y escucha los cambios del sistema para
 * re-aplicar sólo si el tema guardado es "auto".
 * Es idempotente y no rompe si falta el botón.
 * @param {HTMLElement} [themeButton]
 */
export const initTheme = (themeButton) => {
    if (!themeButton || initialized) return;
    initialized = true;
    button = themeButton;

    button.addEventListener('click', () => {
        const next = nextTheme(getStoredTheme());
        setStoredTheme(next);
        applyTheme(next);
    });

    const systemQuery = getSystemQuery();
    systemQuery?.addEventListener?.('change', () => {
        if (getStoredTheme() === 'auto') {
            applyTheme('auto');
        }
    });

    applyTheme(getStoredTheme());
};

const getSystemQuery = () =>
    typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: dark)')
        : null;
