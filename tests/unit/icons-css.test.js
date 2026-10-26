import { describe, it, expect } from 'vitest';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CSS  = fs.readFileSync(path.join(ROOT, 'styles/icons.css'), 'utf8');

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

const ruleBody = (selector) => {
  const start = CSS.indexOf(selector);
  if (start === -1) return null;
  const open = CSS.indexOf('{', start);
  return blockContent(CSS, open);
};

describe('styles/icons.css', () => {
  it('define los tokens base de tamaño y geometría', () => {
    const root = ruleBody(':root {');
    expect(root).not.toBeNull();
    expect(root).toMatch(/--icon-size:\s*1\.25rem/);
    expect(root).toMatch(/--icon-size-lg:\s*1\.7rem/);
    expect(root).toMatch(/--icon-chip-size:\s*40px/);
    expect(root).toMatch(/--icon-chip-radius:\s*12px/);
    expect(root).toMatch(/--icon-chip-size-sm:\s*28px/);
    expect(root).toMatch(/--icon-chip-radius-sm:\s*8px/);
  });

  it('comparte la geometría entre .icon-chip y .action-chip', () => {
    expect(CSS).toMatch(/\.icon-chip,\s*\.action-chip\s*\{/);

    const base = ruleBody('.icon-chip,');
    expect(base).not.toBeNull();
    expect(base).toMatch(/display:\s*inline-grid/);
    expect(base).toMatch(/place-items:\s*center/);
    expect(base).toMatch(/width:\s*var\(--icon-chip-size\)/);
    expect(base).toMatch(/height:\s*var\(--icon-chip-size\)/);
    expect(base).toMatch(/border-radius:\s*var\(--icon-chip-radius\)/);
    expect(base).toMatch(/font-size:\s*var\(--icon-size\)/);
    expect(base).toMatch(/background-color:\s*var\(--chip-bg,\s*var\(--icon-chip-fallback\)\)/);
  });

  it('los modificadores sólo definen --chip-bg', () => {
    for (const variant of ['primary', 'danger', 'success', 'warning', 'neutral']) {
      const body = ruleBody(`.icon-chip--${variant}`);
      expect(body, variant).not.toBeNull();
      expect(body, variant).toMatch(
        new RegExp(`^\\s*--chip-bg:\\s*var\\(--icon-chip-${variant}\\);\\s*$`),
      );
      expect(body, variant).not.toMatch(/background-color/);
    }
  });

  it('el bloque oscuro redefine los tintes', () => {
    const dark = ruleBody(':root[data-theme="dark"] {');
    expect(dark).not.toBeNull();
    for (const token of ['fallback', 'primary', 'danger', 'success', 'warning', 'neutral']) {
      expect(dark, token).toMatch(new RegExp(`--icon-chip-${token}:\\s*rgba\\(`));
    }
  });

  it('.icon-chip--sm cambia tamaño y radio', () => {
    const small = ruleBody('.icon-chip--sm {');
    expect(small).not.toBeNull();
    expect(small).toMatch(/width:\s*var\(--icon-chip-size-sm\)/);
    expect(small).toMatch(/height:\s*var\(--icon-chip-size-sm\)/);
    expect(small).toMatch(/border-radius:\s*var\(--icon-chip-radius-sm\)/);
  });

  it('desactiva la transición con movimiento reducido', () => {
    const reduced = ruleBody('@media (prefers-reduced-motion: reduce)');
    expect(reduced).not.toBeNull();
    expect(reduced).toMatch(/\.icon-chip/);
    expect(reduced).toMatch(/\.action-chip/);
    expect(reduced).toMatch(/transition:\s*none/);
  });
});
