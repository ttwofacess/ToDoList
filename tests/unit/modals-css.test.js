// ============================================================
// Tests unitarios — styles/modals.css
//
// El fallback del backdrop y el bloque de movimiento reducido son cosas que
// no se ven en una captura: se comprueban sobre el CSS.
// ============================================================

import { describe, it, expect } from 'vitest';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CSS  = fs.readFileSync(path.join(ROOT, 'styles/modals.css'), 'utf8');

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

/** La regla que empieza con `selector`, como { inicio, fin, cuerpo, condicion }. */
const rule = (selector) => {
  const start = CSS.indexOf(selector);
  if (start === -1) return null;
  const open = CSS.indexOf('{', start);
  const body = blockContent(CSS, open);
  return {
    start,
    end: open + body.length + 2,
    body,
    // Lo que va entre el selector y la llave: la condición del @supports.
    condition: CSS.slice(start + selector.length, open),
  };
};

describe('styles/modals.css', () => {
  describe('backdrop del overlay', () => {
    it('la regla base de .modal tiene un color de fallback', () => {
      const modal = rule('.modal {');
      expect(modal).not.toBeNull();
      expect(modal.body).toMatch(/background-color:\s*rgba\(0,\s*0,\s*0,\s*0?\.45\)/);
    });

    it('el color de fallback está FUERA del @supports', () => {
      // Si el color base estuviera dentro del @supports, los navegadores sin
      // soporte se quedarían sin fondo: el overlay no taparía la página.
      const supports = rule('@supports');
      expect(supports).not.toBeNull();
      expect(supports.body).toMatch(/backdrop-filter:\s*blur\(8px\)/);

      const modal = rule('.modal {');
      const colorAt = CSS.indexOf('background-color', modal.start);
      expect(colorAt).toBeGreaterThan(modal.start);
      expect(colorAt).toBeLessThan(modal.end);
      expect(colorAt < supports.start || colorAt > supports.end).toBe(true);
    });

    it('el @supports declara el blur con y sin el prefijo -webkit-', () => {
      const supports = rule('@supports');
      expect(supports.body).toMatch(/-webkit-backdrop-filter:\s*blur\(8px\)/);
      expect(supports.body).toMatch(/(?<!-)backdrop-filter:\s*blur\(8px\)/);
    });

    it('el @supports sólo exige soporte de backdrop-filter', () => {
      const supports = rule('@supports');
      expect(supports.condition).toContain('(backdrop-filter: blur(8px))');
      expect(supports.condition).toContain('(-webkit-backdrop-filter: blur(8px))');
    });
  });

  describe('animaciones', () => {
    it('define la entrada (modal-in) y la salida (modal-out)', () => {
      expect(CSS).toContain('@keyframes modal-in');
      expect(CSS).toContain('@keyframes modal-out');
    });

    it('la entrada dura 220 ms y la salida 200 ms', () => {
      expect(CSS).toMatch(/\.modal-content\.modal-enter\s*\{[^}]*modal-in 0\.22s/);
      expect(CSS).toMatch(/\.modal-content\.modal-leave\s*\{[^}]*modal-out 0\.2s/);
    });

    it('la entrada combina opacidad, escala y desplazamiento', () => {
      const keyframes = blockContent(CSS, CSS.indexOf('{', CSS.indexOf('@keyframes modal-in')));
      expect(keyframes).toMatch(/opacity:\s*0/);
      expect(keyframes).toMatch(/scale\(0\.96\)/);
      expect(keyframes).toMatch(/translateY\(12px\)/);
    });

    it('el tornado queda como fallback, sin aplicarse por defecto', () => {
      // La regla sigue existiendo, pero ningún JS la tiene que agregar.
      expect(CSS).toContain('@keyframes tornado-in');
      expect(CSS).toMatch(/\.modal-content\.tornado-animate\s*\{/);
    });

    it('respeta prefers-reduced-motion', () => {
      const reduced = rule('@media (prefers-reduced-motion: reduce)');
      expect(reduced).not.toBeNull();
      expect(reduced.body).toMatch(/\.modal-content\.modal-enter/);
      expect(reduced.body).toMatch(/\.modal-content\.modal-leave/);
      expect(reduced.body).toMatch(/animation:\s*none/);
    });
  });
});
