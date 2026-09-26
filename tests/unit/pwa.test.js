// ============================================================
// Tests unitarios — js/pwa.js (lógica del botón Instalar y SW)
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initPWA } from '../../js/pwa.js';
import { setLanguage } from '../../js/i18n.js';

describe('pwa', () => {
  let installButton;
  let addEventListenerSpy;
  let listeners;

  const setUserAgent = (ua, maxTouchPoints = 0) => {
    Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true });
    Object.defineProperty(window.navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true });
  };

  const setStandalone = (matches) => {
    window.matchMedia = vi.fn().mockReturnValue({ matches });
  };

  /** Dispara un listener de window registrado por el módulo. */
  const fire = (type, event = {}) => {
    listeners.filter(l => l.type === type).forEach(l => l.handler(event));
  };

  beforeEach(() => {
    mountAppDom();
    installButton = document.getElementById('installButton');
    setLanguage('es');
    localStorage.clear();

    listeners = [];
    addEventListenerSpy = vi.spyOn(window, 'addEventListener')
      .mockImplementation((type, handler) => { listeners.push({ type, handler }); });

    setStandalone(false);
    setUserAgent('Mozilla/5.0 (X11; Linux x86_64) Chrome/120');
    // Resetear flags de iOS que pisen tests anteriores
    Object.defineProperty(window.navigator, 'standalone', { value: false, configurable: true });
    vi.spyOn(window, 'alert').mockImplementation(() => {});

    // Por defecto: sin soporte de Service Worker (jsdom no lo trae)
    // ni beforeinstallprompt.
    delete window.navigator.serviceWorker;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('el botón Instalar existe y arranca oculto', () => {
    expect(installButton).not.toBeNull();
    expect(installButton.hidden).toBe(true);
  });

  // ── Registro del Service Worker ────────────────────────────
  describe('registro del Service Worker', () => {
    it('no registra nada si el navegador no soporta serviceWorker', () => {
      initPWA();
      expect(listeners.filter(l => l.type === 'load')).toHaveLength(0);
    });

    it('registra ./sw.js en el evento load', () => {
      const register = vi.fn().mockResolvedValue({});
      Object.defineProperty(window.navigator, 'serviceWorker', {
        value: { register }, configurable: true,
      });

      initPWA();
      expect(listeners.filter(l => l.type === 'load')).toHaveLength(1);

      fire('load');
      expect(register).toHaveBeenCalledWith('./sw.js');
    });

    it('captura el error si el registro falla', () => {
      const register = vi.fn().mockRejectedValue(new Error('SecurityError'));
      Object.defineProperty(window.navigator, 'serviceWorker', {
        value: { register }, configurable: true,
      });

      initPWA();
      expect(() => fire('load')).not.toThrow();
    });
  });

  // ── Visibilidad del botón ──────────────────────────────────
  describe('visibilidad del botón Instalar', () => {
    it('lo mantiene oculto en modo standalone (ya instalada)', () => {
      setStandalone(true);
      initPWA();
      expect(installButton.hidden).toBe(true);
      // No debe registrar los handlers de prompt si ya está instalada
      expect(listeners.filter(l => l.type === 'beforeinstallprompt')).toHaveLength(0);
    });

    it('lo mantiene oculto si navigator.standalone es true (iOS instalada)', () => {
      setStandalone(false);
      Object.defineProperty(window.navigator, 'standalone', { value: true, configurable: true });
      initPWA();
      expect(installButton.hidden).toBe(true);
    });

    it('lo muestra en iOS aunque no exista beforeinstallprompt', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
      initPWA();
      expect(installButton.hidden).toBe(false);
    });

    it('lo muestra en iPadOS (Macintosh + touch points)', () => {
      setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5);
      initPWA();
      expect(installButton.hidden).toBe(false);
    });

    it('lo mantiene oculto en escritorio sin beforeinstallprompt', () => {
      initPWA();
      expect(installButton.hidden).toBe(true);
    });

    it('lo muestra cuando llega beforeinstallprompt', () => {
      initPWA();
      const ev = { preventDefault: vi.fn() };
      fire('beforeinstallprompt', ev);
      expect(ev.preventDefault).toHaveBeenCalled();
      expect(installButton.hidden).toBe(false);
    });

    it('lo oculta de nuevo al disparar appinstalled', () => {
      initPWA();
      fire('beforeinstallprompt', { preventDefault: vi.fn() });
      expect(installButton.hidden).toBe(false);

      fire('appinstalled');
      expect(installButton.hidden).toBe(true);
    });
  });

  // ── Click en el botón ──────────────────────────────────────
  describe('click en Instalar', () => {
    it('dispara el prompt guardado y lo oculta', async () => {
      initPWA();
      const prompt = vi.fn();
      fire('beforeinstallprompt', { preventDefault: vi.fn() });
      // Re-disparo con el evento real que guarda el módulo
      const ev = { preventDefault: vi.fn(), prompt, userChoice: Promise.resolve({ outcome: 'accepted' }) };
      fire('beforeinstallprompt', ev);

      installButton.click();
      await Promise.resolve();
      expect(prompt).toHaveBeenCalledTimes(1);
      expect(installButton.hidden).toBe(true);
    });

    it('el prompt sólo se puede usar una vez', async () => {
      initPWA();
      const prompt = vi.fn();
      const ev = { preventDefault: vi.fn(), prompt, userChoice: Promise.resolve({ outcome: 'dismissed' }) };
      fire('beforeinstallprompt', ev);

      installButton.click();
      await Promise.resolve();
      expect(prompt).toHaveBeenCalledTimes(1);

      // Segundo click: ya no hay prompt guardado
      installButton.click();
      await Promise.resolve();
      expect(prompt).toHaveBeenCalledTimes(1);
    });

    it('en iOS sin prompt muestra las instrucciones de instalación', () => {
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
      initPWA();
      installButton.click();
      expect(window.alert).toHaveBeenCalledWith(
        'Para instalar: tocá el botón Compartir y luego "Añadir a pantalla de inicio".');
    });

    it('en escritorio sin prompt no avisa nada', () => {
      initPWA();
      installButton.click();
      expect(window.alert).not.toHaveBeenCalled();
    });

    it('el aviso de iOS está traducido', () => {
      setLanguage('en');
      setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
      initPWA();
      installButton.click();
      expect(window.alert).toHaveBeenCalledWith(
        'To install: tap the Share button, then "Add to Home Screen".');
    });
  });

  // ── Robustez ───────────────────────────────────────────────
  describe('robustez', () => {
    it('no lanza si falta el botón en el DOM', () => {
      installButton.remove();
      expect(() => initPWA()).not.toThrow();
    });

    it('no registra handlers de prompt si ya está instalada', () => {
      const register = vi.fn().mockResolvedValue({});
      Object.defineProperty(window.navigator, 'serviceWorker', {
        value: { register }, configurable: true,
      });
      setStandalone(true);
      initPWA();
      // initInstallButton() hace early-return, pero el SW sí se registra
      expect(listeners.filter(l => l.type === 'beforeinstallprompt')).toHaveLength(0);
      expect(listeners.filter(l => l.type === 'load')).toHaveLength(1);
    });

    it('puede inicializarse dos veces sin romper', () => {
      expect(() => { initPWA(); initPWA(); }).not.toThrow();
    });
  });
});
