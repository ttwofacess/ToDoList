// ============================================================
// Setup global de los tests unitarios (jsdom)
// - Carga el DOMPurify vendorizado real (el mismo que usa la PWA)
// - Expone helpers compartidos
// ============================================================

import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, vi } from 'vitest';

const ROOT     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PURIFY   = path.join(ROOT, 'assets/vendor/purify.min.js');
const INDEX_HTML = path.join(ROOT, 'index.html');

// ── DOMPurify real, ejecutado dentro del contexto de la ventana jsdom ──
function installDOMPurify() {
  const code = fs.readFileSync(PURIFY, 'utf8');
  const fn   = new Function('window', 'document', `${code}\nreturn window.DOMPurify;`);
  const purify = fn(window, window.document);
  if (!purify) throw new Error('No se pudo cargar DOMPurify desde assets/vendor');
  window.DOMPurify = purify;
  globalThis.DOMPurify = purify;
}

installDOMPurify();

// ── Helper: monta el markup real de index.html en el body ──
globalThis.mountAppDom = () => {
  const html = fs.readFileSync(INDEX_HTML, 'utf8');
  const doc  = new window.DOMParser().parseFromString(html, 'text/html');

  // Sólo el <body>: los tests no necesitan <head>
  document.body.innerHTML = doc.body.innerHTML;

  // El main.js real engancha listeners en DOMContentLoaded; en unit tests
  // inicializamos los módulos a mano, así que lo evitamos.
  return document.body;
};

beforeEach(() => {
  document.body.innerHTML = '';
  document.head.innerHTML = '';
  window.localStorage.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
