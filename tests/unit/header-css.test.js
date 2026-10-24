// ============================================================
// Tests unitarios — styles/header.css
//
// La date card, las cifras tabulares y el resumen del día no se pueden
// comprobar desde jsdom (no aplica CSS): se verifican sobre el archivo.
// ============================================================

import { describe, it, expect } from 'vitest';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CSS  = fs.readFileSync(path.join(ROOT, 'styles/header.css'), 'utf8');

/** Contenido del bloque que empieza en la llave abierta `open`. */
const blockContent = (text, open) => {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return text.slice(open + 1, i);
    }
  }
  return '';
};

/** Contenido de la regla que empieza con `selector`, o null si no existe. */
const ruleBody = (selector) => {
  const start = CSS.indexOf(selector);
  if (start === -1) return null;
  const open = CSS.indexOf('{', start);
  return blockContent(CSS, open);
};

describe('styles/header.css', () => {
  describe('tokens de la date card', () => {
    it('define el fondo y el borde en el tema claro', () => {
      const root = ruleBody(':root {');
      expect(root).not.toBeNull();
      expect(root).toMatch(/--date-card-bg:\s*#F6F7F9/);
      expect(root).toMatch(/--date-card-border:\s*rgba\(15,\s*23,\s*42,\s*0?\.04\)/);
      expect(root).toMatch(/--date-card-ink:\s*var\(--gray-600\)/);
    });

    it('los redefine en el tema oscuro', () => {
      const dark = ruleBody(':root[data-theme="dark"] {');
      expect(dark).not.toBeNull();
      expect(dark).toMatch(/--date-card-bg:\s*#242233/);
      expect(dark).toMatch(/--date-card-border:\s*rgba\(255,\s*255,\s*255,\s*0?\.06\)/);
      expect(dark).toMatch(/--date-card-ink:\s*var\(--gray-400\)/);
    });
  });

  describe('.date como card', () => {
    it('usa los tokens, el radio y el padding de la card', () => {
      const date = ruleBody('.date {');
      expect(date).not.toBeNull();
      expect(date).toMatch(/background-color:\s*var\(--date-card-bg\)/);
      expect(date).toMatch(/border:\s*1px solid var\(--date-card-border\)/);
      expect(date).toMatch(/border-radius:\s*16px/);
      expect(date).toMatch(/padding:\s*14px 16px/);
      expect(date).toMatch(/flex-wrap:\s*wrap/);
    });
  });

  describe('tipografía editorial', () => {
    it('#dateNumber usa cifras tabulares y ancho estable', () => {
      const number = ruleBody('#dateNumber {');
      expect(number).not.toBeNull();
      expect(number).toMatch(/font-feature-settings:\s*"tnum"/);
      expect(number).toMatch(/font-variant-numeric:\s*tabular-nums/);
      expect(number).toMatch(/min-width:\s*2ch/);
    });

    it('#dateText queda en mayúsculas pequeñas con tracking abierto', () => {
      const text = ruleBody('#dateText {');
      expect(text).not.toBeNull();
      expect(text).toMatch(/font-size:\s*0\.8rem/);
      expect(text).toMatch(/letter-spacing:\s*0\.14em/);
      expect(text).toMatch(/font-weight:\s*600/);
      expect(text).toMatch(/color:\s*var\(--date-card-ink\)/);
      expect(text).toMatch(/text-transform:\s*uppercase/);
    });
  });

  describe('.day-summary', () => {
    it('ocupa la fila completa debajo de la fecha', () => {
      const summary = ruleBody('.day-summary {');
      expect(summary).not.toBeNull();
      expect(summary).toMatch(/flex:\s*0 0 100%/);
      expect(summary).toMatch(/margin-top:\s*10px/);
      expect(summary).toMatch(/font-size:\s*var\(--text-sm\)/);
      expect(summary).toMatch(/color:\s*var\(--date-card-ink\)/);
      expect(summary).toMatch(/font-variant-numeric:\s*tabular-nums/);
    });
  });

  describe('responsive', () => {
    it('en 480px achica el padding y el resumen', () => {
      const mediaStart = CSS.indexOf('@media (max-width: 480px)');
      expect(mediaStart).not.toBe(-1);
      const media = blockContent(CSS, CSS.indexOf('{', mediaStart));
      expect(media).toMatch(/\.date\s*\{[^}]*padding:\s*12px/);
      expect(media).toMatch(/#dateText\s*\{[^}]*font-size:\s*0\.75rem/);
      expect(media).toMatch(/\.day-summary\s*\{[^}]*font-size:\s*var\(--text-xs\)/);
    });
  });
});
