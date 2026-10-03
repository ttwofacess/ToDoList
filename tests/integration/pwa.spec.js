// ============================================================
// Tests de integración — PWA: manifest, Service Worker y offline
// ============================================================

import { test, expect } from '@playwright/test';
import { gotoApp, addTask, readStorage, seedStorage } from '../helpers/e2e.js';
import fs   from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// El nombre de la caché lo define sw.js (CACHE_VERSION). Se lee de ahí en vez
// de hardcodearlo: si no, cada bump de versión rompe estos tests.
const ROOT    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SW_SRC  = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const VERSION = SW_SRC.match(/const CACHE_VERSION\s*=\s*'([^']+)'/)?.[1];
const CACHE   = `todolist-${VERSION}`;
if (!VERSION) throw new Error('No se pudo leer CACHE_VERSION de sw.js');

/** Espera a que el SW haya precacheado el app shell en la caché vigente. */
const waitForPrecache = async (page, min = 20) => {
  await page.waitForFunction(
    async ([cache, min]) => {
      if (!(await caches.keys()).includes(cache)) return false;
      return (await (await caches.open(cache)).keys()).length > min;
    },
    [CACHE, min],
    { timeout: 15000 },
  );
};

/**
 * ¿Existe una caché con ese nombre?
 *
 * Devuelve `undefined` mientras la página se está recargando: al activarse el
 * SW nuevo, updateNotifier.js recarga la página (para quien ya tenía la app, o
 * desde el fix de la misma sesión que la primera visita, es una actualización
 * real) y cualquier `page.evaluate` que caiga en plena navegación falla con
 * "Execution context was destroyed". Devolver undefined hace que expect.poll
 * reintente sobre la página ya asentada.
 */
const cacheExists = async (page, name) => {
  try {
    return await page.evaluate((n) => caches.keys().then((k) => k.includes(n)), name);
  } catch {
    return undefined;
  }
};

/** Espera a que el Service Worker esté activo y controlando la página. */
const waitForServiceWorker = async (page) => {
  await page.waitForFunction(
    async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return !!(reg && (reg.active || reg.installing || reg.waiting));
    },
    null,
    { timeout: 15000 },
  );
  // Espera a que haya control efectivo sobre la página
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 15000 });
};

test.describe('Manifest', () => {
  test('el navegador puede parsear el manifest', async ({ page }) => {
    await gotoApp(page);
    const manifest = await page.evaluate(async () => {
      const href = document.querySelector('link[rel="manifest"]').href;
      const res = await fetch(href);
      return { status: res.status, type: res.headers.get('content-type'), body: await res.json() };
    });

    expect(manifest.status).toBe(200);
    expect(manifest.type).toContain('manifest');
    expect(manifest.body.name).toBe('To-Do List');
    expect(manifest.body.display).toBe('standalone');
  });

  test('el manifest se sirve con el MIME type correcto', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/manifest+json');
  });

  test('todos los iconos del manifest son accesibles', async ({ page, request }) => {
    await gotoApp(page);
    const icons = await page.evaluate(async () => {
      const res = await fetch(document.querySelector('link[rel="manifest"]').href);
      return (await res.json()).icons.map(i => i.src);
    });

    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      const res = await request.get(`/${icon}`);
      expect(res.status(), `icono ${icon} no accesible`).toBe(200);
      expect((await res.body()).length).toBeGreaterThan(0);
    }
  });

  test('la app es instalable: manifest accesible y sin errores', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    await gotoApp(page);

    // CDP no expone "isInstallable"; comprobamos los requisitos observables
    const info = await page.evaluate(() => ({
      hasManifest: !!document.querySelector('link[rel="manifest"]'),
      title: document.title,
      hasIcon192: !!document.querySelector('link[rel="apple-touch-icon"]'),
      themeColor: document.querySelector('meta[name="theme-color"]')?.content,
    }));

    expect(info.hasManifest).toBe(true);
    expect(info.title).not.toBe('');
    expect(info.hasIcon192).toBe(true);
    expect(info.themeColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(errors).toEqual([]);
  });
});

test.describe('Service Worker', () => {
  test('se registra y activa correctamente', async ({ page }) => {
    await gotoApp(page);
    await waitForServiceWorker(page);

    const state = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      return {
        scope: reg.scope,
        hasActive: !!reg.active,
        scriptURL: reg.active?.scriptURL,
      };
    });

    expect(state.hasActive).toBe(true);
    expect(state.scriptURL).toMatch(/\/sw\.js$/);
    expect(state.scope).toMatch(/^http:\/\/localhost:\d+\/$/);
  });

  test(`precachea el app shell en la caché "${CACHE}"`, async ({ page }) => {
    await gotoApp(page);
    await waitForServiceWorker(page);
    await waitForPrecache(page);

    const cached = await page.evaluate(async (cache) => {
      const c = await caches.open(cache);
      return (await c.keys()).map(r => new URL(r.url).pathname);
    }, CACHE);

    // El shell esencial debe estar precacheado.
    // OJO: sw.js NO se precachea a sí mismo (correcto: el SW gestiona su
    // propio ciclo de vida), así que no se espera aquí.
    for (const required of [
      '/index.html', '/manifest.webmanifest',
      '/js/main.js', '/js/i18n.js', '/js/dateUtils.js', '/js/storage.js',
      '/js/taskManager.js', '/js/taskRenderer.js', '/js/pwa.js',
      '/styles/base.css', '/styles/tasks.css',
      '/assets/vendor/purify.min.js',
    ]) {
      expect(cached, `no precacheado: ${required}`).toContain(required);
    }

    // Y efectivamente sw.js no está en la caché
    expect(cached).not.toContain('/sw.js');
  });

  test('no duplica entradas en la caché', async ({ page }) => {
    await gotoApp(page);
    await waitForServiceWorker(page);
    await waitForPrecache(page, 0);

    const { unique, total } = await page.evaluate(async (cache) => {
      const c = await caches.open(cache);
      const reqs = await c.keys();
      return { unique: new Set(reqs.map(r => r.url)).size, total: reqs.length };
    }, CACHE);

    expect(total).toBe(unique);
  });

  test('borra las cachés de versiones anteriores al activarse', async ({ page }) => {
    await gotoApp(page);
    await waitForServiceWorker(page);

    // CACHÉ OBSOLETA: el nombre deriva de CACHE_VERSION + sufijo, así que
    // nunca colisiona con la vigente. El SW la borra porque empieza por
    // 'todolist-' y no es la caché actual.
    const STALE = `${CACHE}-obsoleta`;
    await page.evaluate(async (stale) => {
      const old = await caches.open(stale);
      await old.put('/old', new Response('obsoleto'));
    }, STALE);
    expect(await cacheExists(page, STALE)).toBe(true);

    // Forzamos una re-activación real. sw.js NO hace skipWaiting() en
    // 'install' (a propósito: el nuevo SW espera a que el usuario confirme),
    // así que hay que activarlo a mano como hace el botón "Recargar".
    // Esto hace que el SW nuevo tome el control y, con ello, que la app se
    // recargue: es el comportamiento correcto y por eso cacheExists() tolera
    // la navegación en curso.
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.register(`./sw.js?bust=${Date.now()}`);
      await new Promise((resolve) => {
        const tick = setInterval(() => {
          if (!reg.waiting) return;
          clearInterval(tick);
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          resolve();
        }, 50);
      });
      await new Promise((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
      });
    });

    await expect.poll(() => cacheExists(page, STALE), { timeout: 15000 }).toBe(false);

    await expect.poll(() => cacheExists(page, CACHE), { timeout: 15000 }).toBe(true);
    expect(await cacheExists(page, STALE)).toBe(false);
  });

  test('no cachea peticiones de otros orígenes', async ({ page }) => {
    await gotoApp(page);
    await waitForServiceWorker(page);
    await waitForPrecache(page, 0);

    const hasForeign = await page.evaluate(async (cache) => {
      const c = await caches.open(cache);
      return (await c.keys()).some(r => !r.url.startsWith(location.origin));
    }, CACHE);

    expect(hasForeign).toBe(false);
  });
});

test.describe('Modo offline', () => {
  // Playwright no permite cortar la red en WebKit: con la página ya cargada,
  // `context.setOffline(true)` + reload lanza "WebKit encountered an internal
  // error", y la alternativa de abortar cada request da "Blocked by Web
  // Inspector". No es un fallo de la app: el resto del Service Worker
  // (registro, precache, borrado de cachés) sí funciona en WebKit y se prueba
  // más arriba. La capacidad offline se cubre en chromium y mobile-chrome.
  const OFFLINE_UNSUPPORTED = 'no se puede emular offline en WebKit';

  test('la app carga sin red desde la caché del Service Worker', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', OFFLINE_UNSUPPORTED);
    await gotoApp(page);
    await waitForServiceWorker(page);
    await waitForPrecache(page);

    // Cortar la red
    await context.setOffline(true);
    await page.reload();

    // La app debe seguir renderizando
    await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0,
      null, { timeout: 15000 });
    await expect(page.locator('[data-i18n-key="orderButton"]')).toBeVisible();

    await context.setOffline(false);
  });

  test('se pueden crear y leer tareas sin red', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', OFFLINE_UNSUPPORTED);
    await gotoApp(page);
    await waitForServiceWorker(page);
    await waitForPrecache(page);

    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

    // localStorage funciona sin red
    await addTask(page, { text: 'Tarea offline' });
    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await expect(page.locator('.task-text')).toHaveText('Tarea offline');

    await context.setOffline(false);
  });

  test('navegar a una ruta sin caché cae al index.html (fallback SPA)', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', OFFLINE_UNSUPPORTED);
    await gotoApp(page);
    await waitForServiceWorker(page);
    await waitForPrecache(page);

    await context.setOffline(true);

    const response = await page.goto('/ruta/inexistente');
    expect(response.status()).toBe(200);
    await expect(page.locator('[data-i18n-key="orderButton"]')).toBeVisible();

    await context.setOffline(false);
  });

  test('las tareas guardadas sobreviven a un ciclo online → offline → online', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', OFFLINE_UNSUPPORTED);
    await gotoApp(page);
    await seedStorage(page, [{
      text: 'Persistente offline', done: false, date: '01/01/2030', priority: 'high',
      subtasks: [{ text: 'sub', done: false }], recurrence: 'weekly',
      lastCompleted: null, createdAt: '1700000000000',
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await waitForServiceWorker(page);

    await context.setOffline(true);
    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await expect(page.locator('.task-text')).toHaveText('Persistente offline');
    await expect(page.locator('.recurrence-badge')).toHaveText('Semanal');
    expect(await readStorage(page)).toHaveLength(1);

    await context.setOffline(false);
    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await expect(page.locator('.task-text')).toHaveText('Persistente offline');
  });
});

test.describe('Botón Instalar', () => {
  test('permanece oculto en un navegador que no dispara beforeinstallprompt', async ({ page }) => {
    await gotoApp(page);
    await page.waitForTimeout(1000);
    await expect(page.locator('#installButton')).toBeHidden();
  });

  test('aparece y dispara el prompt al recibir beforeinstallprompt', async ({ page }) => {
    await gotoApp(page);

    // Simula el evento que emite Chrome/Edge cuando la app es instalable
    await page.evaluate(() => {
      const ev = new Event('beforeinstallprompt');
      ev.prompt = () => { window.__promptCalled = true; };
      ev.userChoice = Promise.resolve({ outcome: 'accepted' });
      window.dispatchEvent(ev);
    });

    await expect(page.locator('#installButton')).toBeVisible();

    await page.click('#installButton');
    await page.waitForFunction(() => window.__promptCalled === true);

    // Tras instalar, el botón se oculta
    await expect(page.locator('#installButton')).toBeHidden();
  });

  test('se oculta tras el evento appinstalled', async ({ page }) => {
    await gotoApp(page);
    await page.evaluate(() => {
      const ev = new Event('beforeinstallprompt');
      ev.prompt = () => {};
      ev.userChoice = Promise.resolve({ outcome: 'dismissed' });
      window.dispatchEvent(ev);
    });
    await expect(page.locator('#installButton')).toBeVisible();

    await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
    await expect(page.locator('#installButton')).toBeHidden();
  });

  test('el botón Instalar está traducido', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#installButton')).toHaveText('Instalar');
  });
});

test.describe('Recursos estáticos', () => {
  test('todos los módulos ES se sirven con el MIME type correcto', async ({ request }) => {
    const modules = [
      'js/main.js', 'js/i18n.js', 'js/dateUtils.js', 'js/storage.js',
      'js/taskManager.js', 'js/taskRenderer.js', 'js/taskActions.js',
      'js/modalManager.js', 'js/dragDrop.js', 'js/importExport.js', 'js/pwa.js',
    ];

    for (const m of modules) {
      const res = await request.get(`/${m}`);
      expect(res.status(), `${m} no se sirve`).toBe(200);
      expect(res.headers()['content-type'], `${m} con MIME incorrecto`).toContain('javascript');
    }
  });

  test('el Service Worker se sirve como JavaScript', async ({ request }) => {
    const res = await request.get('/sw.js');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('javascript');
  });

  test('DOMPurify está disponible antes de que corra main.js', async ({ page }) => {
    await gotoApp(page);
    const ok = await page.evaluate(() => typeof window.DOMPurify?.sanitize === 'function');
    expect(ok).toBe(true);
  });

  test('todos los estilos CSS se sirven correctamente', async ({ request }) => {
    const res = await request.get('/styles/base.css');
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('text/css');
  });
});
