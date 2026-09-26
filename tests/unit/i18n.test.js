// ============================================================
// Tests unitarios — js/i18n.js
// ============================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { translations, getLang, t, setLanguage, detectLanguage } from '../../js/i18n.js';

const LANGS = ['en', 'es', 'pt'];

describe('i18n', () => {
  beforeEach(() => {
    setLanguage('en');
    document.body.innerHTML = '';
  });

  describe('translations', () => {
    it('expone los 3 idiomas esperados', () => {
      expect(Object.keys(translations).sort()).toEqual(['en', 'es', 'pt']);
    });

    it.each(LANGS)('%s tiene las mismas claves que en', (lang) => {
      const en = Object.keys(translations.en).sort();
      expect(Object.keys(translations[lang]).sort()).toEqual(en);
    });

    it('ninguna traducción está vacía', () => {
      for (const lang of LANGS) {
        for (const [key, value] of Object.entries(translations[lang])) {
          expect(value, `${lang}.${key} está vacía`).toBeTruthy();
          expect(typeof value).toBe('string');
        }
      }
    });

    it('no tiene claves sin traducir (placeholder igual a la clave)', () => {
      for (const lang of LANGS) {
        for (const [key, value] of Object.entries(translations[lang])) {
          expect(value, `${lang}.${key} parece sin traducir`).not.toBe(key);
        }
      }
    });
  });

  describe('getLang() / setLanguage()', () => {
    it('el idioma por defecto es en', () => {
      expect(getLang()).toBe('en');
    });

    it.each(LANGS)('setLanguage(%s) cambia el idioma activo', (lang) => {
      setLanguage(lang);
      expect(getLang()).toBe(lang);
    });

    it('acepta el callback onAfterSet y lo invoca una vez', () => {
      const cb = vi.fn();
      setLanguage('es', cb);
      expect(cb).toHaveBeenCalledTimes(1);
    });

    it('onAfterSet es opcional', () => {
      expect(() => setLanguage('pt')).not.toThrow();
    });

    it('LANZA TypeError con un idioma no soportado (bug latente)', () => {
      // La app hoy sólo llama a setLanguage desde detectLanguage, que ya
      // valida el idioma, así que no se dispara en producción. Pero si se
      // agrega un selector de idioma sin validar, rompe la app entera.
      expect(() => setLanguage('fr')).toThrow(TypeError);
    });
  });

  describe('t()', () => {
    it('devuelve la traducción del idioma activo', () => {
      setLanguage('es');
      expect(t('addButton')).toBe('Añadir');
      setLanguage('en');
      expect(t('addButton')).toBe('Add');
      setLanguage('pt');
      expect(t('addButton')).toBe('Adicionar');
    });

    it('devuelve la clave si no existe la traducción', () => {
      expect(t('claveInexistente')).toBe('claveInexistente');
    });

    it('cambia al cambiar de idioma', () => {
      setLanguage('en');
      const en = t('donateButton');
      setLanguage('es');
      expect(t('donateButton')).not.toBe(en);
    });
  });

  describe('setLanguage() aplicado al DOM', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <span id="btn" data-i18n-key="addButton">Add</span>
        <span id="withTitle" data-i18n-key="cancelButton" title="Cancel">Cancel</span>
        <input id="inp" data-i18n-key="taskPlaceholder" placeholder="New task">
        <span id="recBadge" data-i18n-key="recurrenceBadge" data-recurrence-value="daily"></span>
        <span id="recBadgeNone" data-i18n-key="recurrenceBadge"></span>
        <span id="conIcono" data-i18n-key="actionDone"><span class="icon">✅</span>Done</span>
        <span id="sinKey"></span>
      `;
    });

    it('traduce elementos por data-i18n-key', () => {
      setLanguage('es');
      expect(document.getElementById('btn').textContent).toBe('Añadir');
      expect(document.title).toBe('Lista de Tareas');
    });

    it('actualiza el título del documento', () => {
      setLanguage('pt');
      expect(document.title).toBe('Lista de Tarefas');
    });

    it('actualiza también el atributo title si existe', () => {
      setLanguage('es');
      expect(document.getElementById('withTitle').title).toBe('Cancelar');
    });

    it('actualiza el placeholder de los inputs', () => {
      setLanguage('pt');
      expect(document.getElementById('inp').placeholder).toBe('Nova tarefa');
    });

    it('el badge de recurrencia NO se traduce por data-i18n-key (código muerto)', () => {
      // Hallazgo: i18n.js:157 tiene una rama especial para 'recurrenceBadge',
      // pero esa clave no existe en translations[lang], así que el guard
      // `if (!translation) return` de i18n.js:150 la vuelve inalcanzable.
      // No rompe nada porque ningún elemento usa data-i18n-key="recurrenceBadge"
      // y taskRenderer pinta el badge directamente con t(key).
      setLanguage('es');
      expect(document.getElementById('recBadge').textContent).toBe('');
    });

    it('deja el badge intacto si no tiene data-recurrence-value', () => {
      setLanguage('es');
      expect(document.getElementById('recBadgeNone').textContent).toBe('');
    });

    it('NO sobrescribe elementos con varios hijos (protege iconos)', () => {
      setLanguage('es');
      const el = document.getElementById('conIcono');
      expect(el.querySelector('.icon')).not.toBeNull();
      expect(el.textContent).toContain('✅');
    });

    it('ignora elementos sin data-i18n-key', () => {
      setLanguage('es');
      expect(document.getElementById('sinKey').textContent).toBe('');
    });

    it('ignora claves inexistentes sin romper', () => {
      document.body.innerHTML = '<span id="x" data-i18n-key="claveFalsa">original</span>';
      expect(() => setLanguage('es')).not.toThrow();
      expect(document.getElementById('x').textContent).toBe('original');
    });

    it('es idempotente: aplicar dos veces da el mismo resultado', () => {
      setLanguage('es');
      setLanguage('es');
      expect(document.getElementById('btn').textContent).toBe('Añadir');
    });
  });

  describe('detectLanguage()', () => {
    const setBrowserLang = (lang) =>
      Object.defineProperty(window.navigator, 'language', { value: lang, configurable: true });

    it.each([
      ['es-ES', 'es'],
      ['es', 'es'],
      ['pt-BR', 'pt'],
      ['en-US', 'en'],
    ])('detecta %s → %s', (browserLang, expected) => {
      setBrowserLang(browserLang);
      detectLanguage();
      expect(getLang()).toBe(expected);
    });

    it.each(['de-DE', 'fr', 'ja-JP', 'zh'])('cae a "en" para el idioma no soportado %s', (lang) => {
      setBrowserLang(lang);
      expect(() => detectLanguage()).not.toThrow();
      expect(getLang()).toBe('en');
    });

    it('pasa el callback onAfterSet (lo usa main.js para renderizar la fecha)', () => {
      setBrowserLang('es-ES');
      const cb = vi.fn();
      detectLanguage(cb);
      expect(cb).toHaveBeenCalledTimes(1);
    });
  });
});
