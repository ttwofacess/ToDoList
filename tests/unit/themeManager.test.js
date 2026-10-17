// ============================================================
// Tests unitarios — js/themeManager.js
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// El módulo guarda estado (el flag de idempotencia de initTheme y el botón
// cacheado), así que cada test carga una instancia fresca con resetModules.
// i18n se importa dinámicamente en el mismo reset: si no, existirían dos
// instancias de i18n.js con idiomas independientes.
let themeManager;
let i18n;

const loadModule = async () => {
    vi.resetModules();
    themeManager = await import('../../js/themeManager.js');
    i18n = await import('../../js/i18n.js');
};

/**
 * Mockea window.matchMedia para simular el esquema del sistema y
 * espiar los listeners "change" que registra initTheme.
 */
const mockMatchMedia = (dark) => {
    const listeners = new Set();
    const query = {
        matches: dark,
        addEventListener: (_type, fn) => listeners.add(fn),
        removeEventListener: (_type, fn) => listeners.delete(fn),
    };
    window.matchMedia = vi.fn().mockReturnValue(query);
    return {
        listeners,
        emitChange(newMatches) {
            query.matches = newMatches;
            listeners.forEach(fn => fn({ matches: newMatches }));
        },
    };
};

const getButton = () => document.getElementById('themeToggleButton');

describe('themeManager', () => {
    beforeEach(async () => {
        localStorage.clear();
        document.documentElement.dataset.theme = '';
        await loadModule();
        i18n.setLanguage('en');
        mountAppDom();
    });

    describe('getStoredTheme()', () => {
        it('devuelve auto si no hay nada guardado', () => {
            expect(themeManager.getStoredTheme()).toBe('auto');
        });

        it('devuelve el valor guardado si es válido', () => {
            for (const valid of ['light', 'dark', 'auto']) {
                localStorage.setItem('theme', valid);
                expect(themeManager.getStoredTheme()).toBe(valid);
            }
        });

        it('devuelve auto si el valor guardado es inválido', () => {
            localStorage.setItem('theme', 'neon');
            expect(themeManager.getStoredTheme()).toBe('auto');
        });

        it('no lanza si localStorage.getItem falla (modo privado)', () => {
            vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
                throw new Error('SecurityError');
            });
            expect(() => themeManager.getStoredTheme()).not.toThrow();
            expect(themeManager.getStoredTheme()).toBe('auto');
        });
    });

    describe('setStoredTheme()', () => {
        it('persiste el valor', () => {
            themeManager.setStoredTheme('dark');
            expect(localStorage.getItem('theme')).toBe('dark');
        });

        it('ignora los valores inválidos', () => {
            themeManager.setStoredTheme('neon');
            expect(localStorage.getItem('theme')).toBeNull();
        });

        it('no lanza si localStorage.setItem falla (cuota)', () => {
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new Error('QuotaExceededError');
            });
            expect(() => themeManager.setStoredTheme('dark')).not.toThrow();
        });
    });

    describe('getSystemTheme()', () => {
        it('devuelve dark con prefers-color-scheme: dark', () => {
            mockMatchMedia(true);
            expect(themeManager.getSystemTheme()).toBe('dark');
        });

        it('devuelve light con prefers-color-scheme: light', () => {
            mockMatchMedia(false);
            expect(themeManager.getSystemTheme()).toBe('light');
        });

        it('devuelve light si matchMedia no existe', () => {
            delete window.matchMedia;
            expect(themeManager.getSystemTheme()).toBe('light');
        });
    });

    describe('resolveTheme()', () => {
        it('devuelve tal cual light y dark', () => {
            mockMatchMedia(true);
            expect(themeManager.resolveTheme('light')).toBe('light');
            expect(themeManager.resolveTheme('dark')).toBe('dark');
        });

        it('resuelve auto según el tema del sistema (mock de matchMedia)', () => {
            mockMatchMedia(true);
            expect(themeManager.resolveTheme('auto')).toBe('dark');

            mockMatchMedia(false);
            expect(themeManager.resolveTheme('auto')).toBe('light');
        });
    });

    describe('nextTheme()', () => {
        it('recorre el ciclo light → dark → auto → light', () => {
            expect(themeManager.nextTheme('light')).toBe('dark');
            expect(themeManager.nextTheme('dark')).toBe('auto');
            expect(themeManager.nextTheme('auto')).toBe('light');
        });
    });

    describe('applyTheme()', () => {
        it('setea data-theme="dark" en <html>', () => {
            themeManager.applyTheme('dark');
            expect(document.documentElement.dataset.theme).toBe('dark');
        });

        it('setea data-theme="light" en <html>', () => {
            mockMatchMedia(false);
            themeManager.applyTheme('light');
            expect(document.documentElement.dataset.theme).toBe('light');
        });

        it('resuelve auto: data-theme queda en el tema resuelto, nunca "auto"', () => {
            mockMatchMedia(true);
            themeManager.applyTheme('auto');
            expect(document.documentElement.dataset.theme).toBe('dark');
        });
    });

    describe('initTheme(button)', () => {
        it('no lanza si falta el botón', () => {
            document.documentElement.dataset.theme = '';
            expect(() => themeManager.initTheme(null)).not.toThrow();
        });

        it('aplica el tema guardado al arrancar', () => {
            mockMatchMedia(false);
            localStorage.setItem('theme', 'dark');
            themeManager.initTheme(getButton());
            expect(document.documentElement.dataset.theme).toBe('dark');
        });

        it('el primer click cambia el estado y persiste (auto → light)', () => {
            mockMatchMedia(false);
            themeManager.initTheme(getButton());

            getButton().click();

            expect(localStorage.getItem('theme')).toBe('light');
            expect(themeManager.getStoredTheme()).toBe('light');
        });

        it('recorre el ciclo completo con tres clicks', () => {
            mockMatchMedia(false);
            themeManager.initTheme(getButton());
            const button = getButton();

            // Partiendo de auto: auto → light → dark → auto
            button.click();
            expect(themeManager.getStoredTheme()).toBe('light');
            expect(localStorage.getItem('theme')).toBe('light');
            expect(document.documentElement.dataset.theme).toBe('light');

            button.click();
            expect(themeManager.getStoredTheme()).toBe('dark');
            expect(document.documentElement.dataset.theme).toBe('dark');

            button.click();
            expect(themeManager.getStoredTheme()).toBe('auto');
            // Vuelve a seguir al sistema (false en este test)
            expect(document.documentElement.dataset.theme).toBe('light');
        });

        it('es idempotente: dos inicializaciones no duplican los listeners', () => {
            mockMatchMedia(false);
            themeManager.initTheme(getButton());
            const button = getButton();
            themeManager.initTheme(button);

            button.click(); // auto → light
            button.click(); // light → dark

            // Si la segunda inicialización hubiese registrado un segundo
            // listener de click, cada click saltearía dos estados y acá
            // estaríamos en "light", no en "dark".
            expect(themeManager.getStoredTheme()).toBe('dark');
            expect(localStorage.getItem('theme')).toBe('dark');
        });

        it('actualiza el aria-label y el icono según el estado', () => {
            mockMatchMedia(false);
            themeManager.initTheme(getButton());

            const button = getButton();
            const svgLight = button.querySelector('[data-theme-icon="light"]');
            const svgDark  = button.querySelector('[data-theme-icon="dark"]');
            const svgAuto  = button.querySelector('[data-theme-icon="auto"]');

            // Estado inicial: auto
            expect(button.getAttribute('aria-label')).toBe('Switch to system theme');
            expect(svgAuto.hasAttribute('hidden')).toBe(false);

            button.click(); // light
            expect(button.getAttribute('aria-label')).toBe('Switch to light theme');
            expect(svgLight.hasAttribute('hidden')).toBe(false);
            expect(svgAuto.hasAttribute('hidden')).toBe(true);

            button.click(); // dark
            expect(button.getAttribute('aria-label')).toBe('Switch to dark theme');
            expect(svgDark.hasAttribute('hidden')).toBe(false);
            expect(svgLight.hasAttribute('hidden')).toBe(true);
        });

        it('traduce el aria-label al idioma activo', () => {
            i18n.setLanguage('es');
            mockMatchMedia(false);
            themeManager.initTheme(getButton());

            expect(getButton().getAttribute('aria-label')).toBe('Cambiar al tema del sistema');
        });

        it('el listener de matchMedia re-aplica sólo si el tema es auto', () => {
            const system = mockMatchMedia(false);
            themeManager.initTheme(getButton());

            // Estado auto: el cambio del sistema se re-aplica
            system.emitChange(true);
            expect(document.documentElement.dataset.theme).toBe('dark');

            // Estado forzado light: el cambio del sistema no toca nada
            const button = getButton();
            button.click(); // auto → light
            expect(document.documentElement.dataset.theme).toBe('light');

            system.emitChange(false);
            expect(document.documentElement.dataset.theme).toBe('light');
            system.emitChange(true);
            expect(document.documentElement.dataset.theme).toBe('light');
        });
    });
});
