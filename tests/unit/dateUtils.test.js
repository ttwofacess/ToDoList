// ============================================================
// Tests unitarios — js/dateUtils.js
// ============================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getLocaleKey,
  formatDisplayDate,
  isoStringToDate,
  isDateInPast,
  displayDateToIso,
  renderHeaderDate,
  shouldResetRecurringTask,
  getTaskEmojis,
} from '../../js/dateUtils.js';
import { setLanguage, getLang } from '../../js/i18n.js';

describe('dateUtils', () => {
  beforeEach(() => {
    setLanguage('en');
    // Reloj fijo para que los tests sean deterministas
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 5, 15, 10, 30, 0)); // 15/06/2025 10:30 local
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getLocaleKey()', () => {
    it.each([
      ['en', 'en-US'],
      ['es', 'es-ES'],
      ['pt', 'pt-BR'],
    ])('mapea el idioma %s al locale %s', (lang, expected) => {
      setLanguage(lang);
      expect(getLocaleKey()).toBe(expected);
    });

    it('cae a en-US si el idioma no está en el mapa', async () => {
      // getLocaleKey() sólo es alcanzable con un lang fuera del mapa si se
      // fuerza el estado interno de i18n, así que se mockea la dependencia.
      vi.resetModules();
      vi.doMock('../../js/i18n.js', () => ({ getLang: () => 'fr' }));
      const { getLocaleKey: fallback } = await import('../../js/dateUtils.js');
      expect(fallback()).toBe('en-US');
      vi.doUnmock('../../js/i18n.js');
      vi.resetModules();
    });
  });

  describe('formatDisplayDate()', () => {
    const date = new Date(2025, 5, 15); // 15 de junio de 2025

    it('formatea dd/mm/aaaa en español', () => {
      setLanguage('es');
      expect(formatDisplayDate(date)).toBe('15/06/2025');
    });

    it('formatea mm/dd/aaaa en inglés', () => {
      setLanguage('en');
      expect(formatDisplayDate(date)).toBe('06/15/2025');
    });

    it('formatea dd/mm/aaaa en portugués', () => {
      setLanguage('pt');
      expect(formatDisplayDate(date)).toBe('15/06/2025');
    });

    it('respeta el cambio de idioma en caliente', () => {
      setLanguage('es');
      const es = formatDisplayDate(date);
      setLanguage('en');
      const en = formatDisplayDate(date);
      expect(es).not.toBe(en);
    });
  });

  describe('isoStringToDate()', () => {
    it('convierte "2025-06-15" a la fecha local correcta', () => {
      const d = isoStringToDate('2025-06-15');
      expect(d.getFullYear()).toBe(2025);
      expect(d.getMonth()).toBe(5);
      expect(d.getDate()).toBe(15);
    });

    it('no sufre el offset de zona horaria (medianoche local, no UTC)', () => {
      const d = isoStringToDate('2025-01-01');
      expect(d.getHours()).toBe(0);
      expect(d.getDate()).toBe(1);
      expect(d.getMonth()).toBe(0);
    });

    it('maneja el año 2024 (bisiesto)', () => {
      expect(isoStringToDate('2024-02-29').getDate()).toBe(29);
    });

    it('produce una fecha round-trippable con formatDisplayDate en es', () => {
      setLanguage('es');
      expect(formatDisplayDate(isoStringToDate('2025-12-31'))).toBe('31/12/2025');
    });
  });

  describe('isDateInPast()', () => {
    it('devuelve true para ayer', () => {
      expect(isDateInPast(new Date(2025, 5, 14))).toBe(true);
    });

    it('devuelve false para hoy', () => {
      expect(isDateInPast(new Date(2025, 5, 15))).toBe(false);
    });

    it('devuelve false para mañana', () => {
      expect(isDateInPast(new Date(2025, 5, 16))).toBe(false);
    });

    it('hoy a las 23:59 sigue sin estar en el pasado (ignora la hora)', () => {
      expect(isDateInPast(new Date(2025, 5, 15, 23, 59, 59))).toBe(false);
    });

    it('hoy a las 00:00 tampoco cuenta como pasado', () => {
      expect(isDateInPast(new Date(2025, 5, 15, 0, 0, 0))).toBe(false);
    });
  });

  describe('displayDateToIso()', () => {
    it('convierte dd/mm/aaaa → ISO en español', () => {
      setLanguage('es');
      expect(displayDateToIso('15/06/2025')).toBe('2025-06-15');
    });

    it('convierte mm/dd/aaaa → ISO en inglés', () => {
      setLanguage('en');
      expect(displayDateToIso('06/15/2025')).toBe('2025-06-15');
    });

    it('convierte dd/mm/aaaa → ISO en portugués', () => {
      setLanguage('pt');
      expect(displayDateToIso('31/12/2025')).toBe('2025-12-31');
    });

    it('rellena con ceros los días de un dígito', () => {
      setLanguage('es');
      expect(displayDateToIso('5/6/2025')).toBe('2025-06-05');
    });

    it('devuelve string vacío si no hay 3 partes', () => {
      setLanguage('es');
      expect(displayDateToIso('')).toBe('');
      expect(displayDateToIso('15/06')).toBe('');
      expect(displayDateToIso('basura')).toBe('');
    });

    it('es el inverso de formatDisplayDate (round-trip)', () => {
      const original = '2025-03-07';

      setLanguage('es');
      expect(displayDateToIso(formatDisplayDate(isoStringToDate(original)))).toBe(original);

      setLanguage('en');
      expect(displayDateToIso(formatDisplayDate(isoStringToDate(original)))).toBe(original);

      setLanguage('pt');
      expect(displayDateToIso(formatDisplayDate(isoStringToDate(original)))).toBe(original);
    });
  });

  describe('renderHeaderDate()', () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="dateNumber"></div><div id="dateText"></div>
        <div id="dateMonth"></div><div id="dateYear"></div>`;
    });

    it('rellena los 4 elementos del header con la fecha actual', () => {
      renderHeaderDate();
      expect(document.getElementById('dateNumber').textContent).toBe('15');
      expect(document.getElementById('dateYear').textContent).toBe('2025');
      expect(document.getElementById('dateMonth').textContent).toBeTruthy();
      expect(document.getElementById('dateText').textContent).toBeTruthy();
    });

    it('el texto del día de la semana cambia con el idioma', () => {
      setLanguage('es');
      renderHeaderDate();
      const es = document.getElementById('dateText').textContent;
      setLanguage('en');
      renderHeaderDate();
      const en = document.getElementById('dateText').textContent;
      expect(es.toLowerCase()).not.toBe(en.toLowerCase());
    });
  });

  describe('shouldResetRecurringTask()', () => {
    const DAY = 86400000;
    // OJO: debe leerse DENTRO de los tests, cuando el reloj fake está activo
    // (Date.now() en el cuerpo del describe usaría el reloj real).
    const now = () => Date.now();

    describe('daily', () => {
      it('no resetea si se completó hoy', () => {
        expect(shouldResetRecurringTask('daily', now())).toBe(false);
      });

      it('no resetea si se completó hace 2 horas', () => {
        expect(shouldResetRecurringTask('daily', now() - 2 * 3600000)).toBe(false);
      });

      it('resetea si se completó ayer', () => {
        expect(shouldResetRecurringTask('daily', now() - DAY)).toBe(true);
      });

      it('resetea aunque se haya completado a última hora del día anterior', () => {
        const ayerTarde = new Date(2025, 5, 14, 23, 0, 0).getTime();
        expect(shouldResetRecurringTask('daily', ayerTarde)).toBe(true);
      });
    });

    describe('weekly', () => {
      it('no resetea dentro de la misma semana', () => {
        expect(shouldResetRecurringTask('weekly', now() - 3 * DAY)).toBe(false);
      });

      it('no resetea a los 6 días', () => {
        expect(shouldResetRecurringTask('weekly', now() - 6 * DAY)).toBe(false);
      });

      it('resetea a los 7 días exactos', () => {
        expect(shouldResetRecurringTask('weekly', now() - 7 * DAY)).toBe(true);
      });

      it('resetea a los 10 días', () => {
        expect(shouldResetRecurringTask('weekly', now() - 10 * DAY)).toBe(true);
      });
    });

    describe('monthly', () => {
      it('no resetea en el mismo mes', () => {
        expect(shouldResetRecurringTask('monthly', now() - 10 * DAY)).toBe(false);
      });

      it('no resetea el día 1 del mismo mes', () => {
        expect(shouldResetRecurringTask('monthly', new Date(2025, 5, 1).getTime())).toBe(false);
      });

      it('resetea en el mes siguiente', () => {
        expect(shouldResetRecurringTask('monthly', new Date(2025, 4, 20).getTime())).toBe(true);
      });
    });

    it('nunca resetea si la recurrencia es "none" o desconocida', () => {
      expect(shouldResetRecurringTask('none', 0)).toBe(false);
      expect(shouldResetRecurringTask('undefined', 0)).toBe(false);
      expect(shouldResetRecurringTask('', 0)).toBe(false);
    });

    it('con un timestamp inválido no lanza, pero fuerza el reset', () => {
      // new Date('no-es-un-numero') → NaN → las comparaciones de fecha fallan
      // y la tarea recurrente se resetea. Documenta el comportamiento actual.
      expect(() => shouldResetRecurringTask('daily', 'no-es-un-numero')).not.toThrow();
      expect(shouldResetRecurringTask('daily', 'no-es-un-numero')).toBe(true);
    });
  });

  describe('getTaskEmojis()', () => {
    it('devuelve exactamente 2 emojis', () => {
      const emojis = getTaskEmojis(new Date(2025, 5, 15, 10, 30, 0));
      expect([...emojis]).toHaveLength(2);
    });

    it('todos los code points caen en el rango U+1F600–U+1F637', () => {
      const date = new Date(2025, 5, 15, 10, 30, 0);
      for (let i = 0; i < 500; i++) {
        const emojis = getTaskEmojis(date);
        for (const ch of emojis) {
          const cp = ch.codePointAt(0);
          expect(cp).toBeGreaterThanOrEqual(0x1F600);
          expect(cp).toBeLessThanOrEqual(0x1F637);
        }
        // avanzar 7 minutos por iteración para variar la semilla
        date.setMinutes(date.getMinutes() + 7);
      }
    });

    it('es determinista: misma fecha → mismos emojis', () => {
      const d1 = new Date(2025, 5, 15, 10, 30, 0);
      const d2 = new Date(2025, 5, 15, 10, 30, 0);
      expect(getTaskEmojis(d1)).toBe(getTaskEmojis(d2));
    });

    it('fechas distintas producen emojis distintos', () => {
      const a = getTaskEmojis(new Date(2025, 5, 15, 10, 30, 0));
      const b = getTaskEmojis(new Date(2025, 5, 16, 10, 30, 0));
      expect(a).not.toBe(b);
    });

    it('los dos emojis son individuales (no un range de surrogate pairs roto)', () => {
      const emojis = getTaskEmojis(new Date(2025, 5, 15, 10, 30, 0));
      expect(emojis.length).toBe(4); // 2 code points de 2 unidades UTF-16
    });
  });
});
