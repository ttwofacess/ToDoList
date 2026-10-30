// ============================================================
// Tests unitarios — styles/animations.css
//
// El bloque global de movimiento reducido, el anillo estático del pulso y la
// ausencia de excepciones en el toast no se ven en una captura: se comprueban
// sobre el CSS, igual que en tests/unit/modals-css.test.js.
// ============================================================

import { describe, it, expect } from 'vitest';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT      = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CSS       = fs.readFileSync(path.join(ROOT, 'styles/animations.css'), 'utf8');
const TOAST_CSS = fs.readFileSync(path.join(ROOT, 'styles/toast.css'), 'utf8');

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

/** Todos los bloques que empiezan con `marker`, en orden de aparición. */
const allBlocksAfter = (text, marker) => {
  const blocks = [];
  let from = 0;
  while (true) {
    const start = text.indexOf(marker, from);
    if (start === -1) break;
    const open = text.indexOf('{', start);
    const body = blockContent(text, open);
    blocks.push({ start, end: open + body.length + 2, body });
    from = open + body.length + 2;
  }
  return blocks;
};

const REDUCED_BLOCKS = allBlocksAfter(CSS, '@media (prefers-reduced-motion: reduce)');
const GLOBAL_REDUCE  = REDUCED_BLOCKS.find((b) => b.body.includes('*::before'));

describe('styles/animations.css', () => {
  describe('bloque global de movimiento reducido', () => {
    it('existe un bloque reduce con selectores globales', () => {
      expect(GLOBAL_REDUCE).toBeDefined();
      expect(GLOBAL_REDUCE.body).toMatch(/\*/);
      expect(GLOBAL_REDUCE.body).toContain('*::before');
      expect(GLOBAL_REDUCE.body).toContain('*::after');
    });

    it('apaga animation y transition con !important', () => {
      // Sin !important un selector * (especificidad 0,0,0) pierde contra las
      // clases donde vive el motion real (.task-wrapper.just-added,
      // .modal-content.modal-enter, ...) y no apagaría nada.
      expect(GLOBAL_REDUCE.body).toMatch(/animation:\s*none\s*!important/);
      expect(GLOBAL_REDUCE.body).toMatch(/transition:\s*none\s*!important/);
    });
  });

  describe('fallback estático del pulso', () => {
    it('el bloque reduce de due-today conserva el anillo fijo', () => {
      // El blanket sólo anula animation/transition: no puede pintar el anillo
      // que reemplaza al pulso, por eso este bloque por componente se queda.
      const pulse = REDUCED_BLOCKS.find((b) => b.body.includes('.task.due-today'));
      expect(pulse).toBeDefined();
      expect(pulse.body).toMatch(/box-shadow:\s*0 0 0 2px/);
    });
  });

  describe('red de seguridad', () => {
    it('el blanket cubre a todos los CSS que declaran motion', () => {
      // Protege contra que alguien mueva o borre el bloque global: los
      // archivos con animaciones/transiciones (incluidos los que no tienen su
      // propio bloque reduce) dependen de esta red.
      const dir = path.join(ROOT, 'styles');
      const withMotion = fs.readdirSync(dir)
        .filter((file) => file.endsWith('.css'))
        .filter((file) => {
          const src = fs.readFileSync(path.join(dir, file), 'utf8');
          return /\banimation\s*:|\btransition\s*:/.test(src);
        });

      expect(withMotion).toContain('tasks.css');
      expect(withMotion).toContain('forms.css');
      expect(GLOBAL_REDUCE).toBeDefined();
    });
  });
});

describe('styles/toast.css — cuenta regresiva', () => {
  it('la barra no tiene una excepción con !important', () => {
    // Decisión 2.3 = A: el blanket también apaga la barra; el borrado lo
    // garantiza el timer JS. Si alguien reintroduce la excepción, esto falla.
    expect(TOAST_CSS).not.toMatch(/\.toast-progress\.is-running[^{]*\{[^}]*!important/);
  });

  it('ningún bloque reduce re-declara la animación de la barra', () => {
    const blocks = allBlocksAfter(TOAST_CSS, '@media (prefers-reduced-motion: reduce)');
    for (const block of blocks) {
      expect(block.body).not.toContain('.toast-progress.is-running');
      expect(block.body).not.toContain('toast-countdown');
    }
  });

  it('la animación de la barra sigue declarada fuera del bloque reduce', () => {
    expect(TOAST_CSS).toMatch(/\.toast-progress\.is-running\s*\{[^}]*toast-countdown/);
  });
});
