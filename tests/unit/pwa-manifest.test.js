// ============================================================
// Tests de contrato PWA — manifest.webmanifest + sw.js + index.html
//
// Verifican que los metadatos y el app shell precacheado sean coherentes
// con los archivos que realmente existen en el repositorio. Son la clase
// de tests que más rápido detecta una PWA rota en producción.
// ============================================================

import { describe, it, expect } from 'vitest';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rel  = (p) => path.relative(ROOT, path.resolve(ROOT, p));
const exists = (p) => fs.existsSync(path.resolve(ROOT, p));

const manifest  = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const swSource  = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

/** Extrae el array APP_SHELL declarado en sw.js. */
const parseAppShell = () => {
  const match = swSource.match(/const APP_SHELL\s*=\s*\[([\s\S]*?)\];/);
  if (!match) throw new Error('No se encontró APP_SHELL en sw.js');
  return [...match[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
};

/** Extrae los href/src de <link>/<script>/<img> locales de index.html. */
const parseLocalAssets = () => {
  const found = new Set();
  for (const m of indexHtml.matchAll(/(?:href|src)="(\.\/[^"]+|\.\.\/[^"]+)"/g)) {
    found.add('./' + m[1].replace(/^\.\//, ''));
  }
  return [...found];
};

describe('manifest.webmanifest', () => {
  it('es JSON válido', () => {
    expect(() => JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8')))
      .not.toThrow();
  });

  it.each(['name', 'short_name', 'start_url', 'display', 'icons'])(
    'incluye el campo obligatorio "%s"', (field) => {
      expect(manifest[field]).toBeDefined();
    });

  it('es una PWA instalable (display standalone)', () => {
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
  });

  it('name es más largo o igual que short_name', () => {
    expect(manifest.name.length).toBeGreaterThanOrEqual(manifest.short_name.length);
  });

  it('short_name no supera los 12 caracteres recomendados', () => {
    expect(manifest.short_name.length).toBeLessThanOrEqual(12);
  });

  it('start_url y scope son relativos (sirven en cualquier subruta)', () => {
    expect(manifest.start_url.startsWith('./')).toBe(true);
    expect(manifest.scope.startsWith('./')).toBe(true);
  });

  it('el start_url está dentro del scope', () => {
    const scope = manifest.scope.replace('./', '');
    const start = manifest.start_url.replace('./', '');
    expect(start.startsWith(scope)).toBe(true);
  });

  it('declara un id', () => {
    expect(manifest.id).toBeDefined();
  });

  it('los colores de tema son hexadecimales válidos', () => {
    expect(manifest.theme_color).toMatch(/^#[0-9a-fA-F]{6}$/);
    expect(manifest.background_color).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('el theme-color del manifest coincide con el <meta> de index.html', () => {
    const meta = indexHtml.match(/<meta name="theme-color" content="([^"]+)"/);
    expect(meta).not.toBeNull();
    expect(meta[1]).toBe(manifest.theme_color);
  });

  it('declara categorías de la lista permitida', () => {
    const valid = ['productivity', 'utilities', 'lifestyle', 'social', 'health',
                   'finance', 'entertainment', 'games', 'education', 'sports', 'other'];
    for (const cat of manifest.categories) expect(valid).toContain(cat);
  });

  describe('iconos', () => {
    it('tiene al menos un icono de 192px y uno de 512px', () => {
      const sizes = manifest.icons.map(i => i.sizes);
      expect(sizes).toContain('192x192');
      expect(sizes).toContain('512x512');
    });

    it('todos los archivos de icono existen en el repo', () => {
      for (const icon of manifest.icons) {
        expect(exists(icon.src), `falta ${icon.src}`).toBe(true);
      }
    });

    it('todos los iconos PNG están declarados como image/png', () => {
      for (const icon of manifest.icons) {
        if (icon.src.endsWith('.png')) expect(icon.type).toBe('image/png');
      }
    });

    it('tiene al menos un icono maskable (requisito de Android)', () => {
      expect(manifest.icons.some(i => i.purpose === 'maskable')).toBe(true);
    });

    it('los tamaños declarados coinciden con los del nombre del archivo', () => {
      for (const icon of manifest.icons) {
        const m = icon.src.match(/(\d+)\.png$/);
        if (m) expect(icon.sizes).toBe(`${m[1]}x${m[1]}`);
      }
    });
  });

  it('index.html lo referencia con <link rel="manifest">', () => {
    expect(indexHtml).toMatch(/<link rel="manifest" href="manifest\.webmanifest">/);
  });
});

describe('index.html — metadatos PWA', () => {
  it('tiene viewport con viewport-fit=cover (notch / safe areas)', () => {
    expect(indexHtml).toContain('viewport-fit=cover');
  });

  it('es capaz de instalarse en iOS standalone', () => {
    expect(indexHtml).toContain('apple-mobile-web-app-capable" content="yes"');
  });

  it('declara apple-touch-icon', () => {
    const m = indexHtml.match(/rel="apple-touch-icon" href="([^"]+)"/);
    expect(m).not.toBeNull();
    expect(exists(m[1])).toBe(true);
  });

  it('carga el DOMPurify vendorizado de forma local (sin CDN)', () => {
    expect(indexHtml).toContain('src="./assets/vendor/purify.min.js"');
    expect(indexHtml).not.toMatch(/https?:\/\/.*cdn.*purify/i);
  });

  it('carga main.js como módulo ES', () => {
    expect(indexHtml).toMatch(/<script src="\.\/js\/main\.js" type="module">/);
  });

  it('el DOMPurify vendorizado existe en el repo', () => {
    expect(exists('assets/vendor/purify.min.js')).toBe(true);
  });

  it('todos los assets locales referenciados existen', () => {
    for (const asset of parseLocalAssets()) {
      expect(exists(rel(asset)), `404: ${asset} referenciado en index.html`).toBe(true);
    }
  });

  it('no usa CDNs externas para CSS o JS', () => {
    const external = [...indexHtml.matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g)].map(m => m[1]);
    expect(external).toEqual([]);
  });
});

describe('sw.js — app shell y ciclo de vida', () => {
  const appShell = parseAppShell();

  it('expone un APP_SHELL no vacío', () => {
    expect(appShell.length).toBeGreaterThan(0);
  });

  it('todos los archivos del APP_SHELL existen en el repo', () => {
    for (const entry of appShell) {
      if (entry === './') continue;
      expect(exists(rel(entry)), `precachea un archivo inexistente: ${entry}`).toBe(true);
    }
  });

  it('precachea el documento raíz, index.html y el manifest', () => {
    expect(appShell).toContain('./');
    expect(appShell).toContain('./index.html');
    expect(appShell).toContain('./manifest.webmanifest');
  });

  it('precachea TODOS los scripts de js/', () => {
    const scripts = fs.readdirSync(path.join(ROOT, 'js'))
      .filter(f => f.endsWith('.js'))
      .map(f => `./js/${f}`);
    for (const s of scripts) {
      expect(appShell, `falta precachear ${s}`).toContain(s);
    }
  });

  it('precachea TODOS los estilos de styles/', () => {
    const styles = fs.readdirSync(path.join(ROOT, 'styles'))
      .filter(f => f.endsWith('.css'))
      .map(f => `./styles/${f}`);
    for (const s of styles) {
      expect(appShell, `falta precachear ${s}`).toContain(s);
    }
  });

  it('precachea las fuentes que el CSS referencia', () => {
    const used = new Set();
    for (const f of fs.readdirSync(path.join(ROOT, 'styles'))) {
      const css = fs.readFileSync(path.join(ROOT, 'styles', f), 'utf8');
      // ../assets/fonts/x.woff2 (relativo a styles/) → ./assets/fonts/x.woff2
      for (const m of css.matchAll(/url\(['"]?\.\.\/([^'")]+)['"]?\)/g)) {
        used.add(`./${m[1]}`);
      }
    }
    expect(used.size).toBeGreaterThan(0);
    for (const font of used) {
      expect(appShell, `falta precachear la fuente ${font}`).toContain(font);
    }
  });

  it('no tiene entradas duplicadas en el APP_SHELL', () => {
    expect(new Set(appShell).size).toBe(appShell.length);
  });

  it('todas las entradas son rutas relativas (funciona en subdirectorios)', () => {
    for (const entry of appShell) {
      expect(entry.startsWith('./'), `${entry} no es relativa`).toBe(true);
    }
  });

  it('usa una versión de caché con nombre versionado', () => {
    expect(swSource).toMatch(/const CACHE_VERSION\s*=\s*'v\d+'/);
    expect(swSource).toMatch(/const CACHE_NAME\s*=\s*`todolist-\$\{CACHE_VERSION\}`/);
  });

  it('instala con addAll y skipWaiting (actualización inmediata)', () => {
    expect(swSource).toContain('cache.addAll(APP_SHELL)');
    expect(swSource).toContain('self.skipWaiting()');
  });

  it('en activate borra sólo las cachés viejas de la app', () => {
    expect(swSource).toMatch(/k\.startsWith\('todolist-'\)/);
    expect(swSource).toMatch(/k !== CACHE_NAME/);
    expect(swSource).toContain('self.clients.claim()');
  });

  it('en fetch responde cache-first y revalida en segundo plano', () => {
    expect(swSource).toContain('caches.match(request, { ignoreSearch: true })');
    expect(swSource).toContain('response.clone()');
  });

  it('ignora las peticiones que no son GET', () => {
    expect(swSource).toMatch(/request\.method !== 'GET'\)\s*return/);
  });

  it('ignora las peticiones cross-origin (no intercepta CDNs)', () => {
    expect(swSource).toContain("new URL(request.url).origin !== self.location.origin");
  });

  it('tiene fallback a index.html para navegación offline', () => {
    expect(swSource).toContain("caches.match('./index.html')");
  });

  it('registra listeners de install, activate y fetch', () => {
    expect(swSource).toContain("self.addEventListener('install'");
    expect(swSource).toContain("self.addEventListener('activate'");
    expect(swSource).toContain("self.addEventListener('fetch'");
  });
});
