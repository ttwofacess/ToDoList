// ============================================================
// Tests de integración — updateNotifier.js (js/updateNotifier.js)
// Solo tiene sentido con un Service Worker real: por eso NO hay
// tests unitarios (en jsdom no existe el ciclo de vida del SW).
// ============================================================

import { test, expect } from '@playwright/test';
import { gotoApp } from '../helpers/e2e.js';

/**
 * Espera a que el SW esté activo y controlando la página.
 */
const waitForController = (page) =>
  page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });

/** Espera a que la app haya pintado (tras una recarga). */
const waitForAppReady = (page) =>
  page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0,
    null, { timeout: 20000 });

/**
 * Espera a que el SW que controla la página sea la versión con `?bust=`.
 *
 * OJO: `clients.claim()` cambia el controller SIN recargar la página, así que
 * esto solo prueba que el SW nuevo está activo. Para probar que la página se
 * recargó hay que mirar el contador de cargas (waitForLoadCount).
 */
const waitForNewController = (page) =>
  page.waitForFunction(
    () => !!navigator.serviceWorker.controller?.scriptURL.includes('bust='),
    null, { timeout: 20000 },
  );

/**
 * Carga la app como un usuario que YA la tenía instalada.
 *
 * Es imprescindible para(updateNotifier): `wasControlledAtLoad` se calcula una
 * sola vez, al cargar. Si la página no estaba controlada en ese instante (primera
 * visita, el SW se acaba de instalar), el flag queda en false y TODOS los
 * `controllerchange` posteriores se ignoran → la app se actualiza pero la página
 * no se recarga. Ese es justo el caso que no queremos comprobar aquí; el
 * escenario real de un despliegue lo vive un usuario que ya tenía la app.
 */
const gotoAppAsReturningUser = async (page) => {
  await gotoApp(page);            // 1ª visita: instala y activa el SW
  await waitForController(page);
  await page.reload();            // 2ª visita: el SW ya controlaba al cargar
  await waitForAppReady(page);
  await waitForController(page);
};

/** Registra sw.js con una URL distinta para forzar una actualización real. */
const triggerUpdate = (page) =>
  page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register(`./sw.js?bust=${Date.now()}`);
    // sw.js NO hace skipWaiting en 'install': el nuevo worker queda en
    // 'waiting' hasta que el frontend le envíe SKIP_WAITING.
    await new Promise((resolve) => {
      const tick = setInterval(() => {
        if (!reg.waiting) return;
        clearInterval(tick);
        resolve();
      }, 50);
    });
  });

/**
 * Píxeles del aviso que quedan DENTRO de la ventana.
 *
 * OJO con `toBeHidden()`: NO sirve para el toast de actualización.
 * styles/toast.css mantiene `display: flex` en `.toast[hidden]` a propósito,
 * para poder animar la entrada con transform, así que el elemento oculto sigue
 * en el layout. Lo que hay que medir es si el usuario lo PERCIBE.
 */
const toastOnScreenPx = (page) => page.evaluate(() => {
  const el = document.getElementById('updateToast');
  const r = el.getBoundingClientRect();
  return Math.round(Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)));
});

/** `visibility` computada del aviso: lo saca del árbol de accesibilidad. */
const toastVisibility = (page) =>
  page.evaluate(() => getComputedStyle(document.getElementById('updateToast')).visibility);

/**
 * El aviso asoma en pantalla.
 *
 * Sondeo porque el toast entra con una transición de transform de 0.3 s: al
 * medir de golpe se puede coger a mitad de camino, con el toast todavía
 * subiendo desde fuera de la ventana.
 */
const toastVisible = async (page) => {
  await expect.poll(() => toastOnScreenPx(page), { timeout: 5000 }).toBeGreaterThan(0);
};

/**
 * Registra las cargas de la página. sessionStorage sobrevive a los reloads de
 * la misma pestaña, así que distingue "no recargó" de "recargó y repintó igual".
 */
const countLoads = (page) =>
  page.evaluate(() => Number(sessionStorage.getItem('loads') || '0'));

/**
 * Espera a que la página lleve exactamente `expected` cargas.
 *
 * OJO: hay que usar waitForFunction y NO un bucle de page.evaluate. evaluate
 * lanza si cae en mitad de una navegación, que es justo lo que pasa aquí (el
 * reload lo dispara la propia app). waitForFunction se reinyecta solo tras la
 * navegación, así que sobrevive.
 */
const waitForLoadCount = (page, expected) =>
  page.waitForFunction(
    (n) => Number(sessionStorage.getItem('loads') || '0') === n,
    expected, { timeout: 20000 },
  );

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const n = Number(sessionStorage.getItem('loads') || '0') + 1;
    sessionStorage.setItem('loads', String(n));
  });
});

test.describe('Primera visita', () => {
  test('el claim inicial del SW no recarga la página', async ({ page }) => {
    await gotoApp(page);
    await waitForController(page);

    // sw.js hace clients.claim() en 'activate', lo que dispara `controllerchange`
    // nada más entrar. updateNotifier debe ignorarlo: la navegación inicial ya
    // la sirvió la red con los archivos actuales. Recargar ahí wastea una
    // descarga y puede abortar el click que el usuario tenía en curso.
    await page.waitForTimeout(1500);

    expect(await countLoads(page)).toBe(1);
  });

  test('no hay ningún SW en estado "waiting" tras instalar', async ({ page }) => {
    await gotoApp(page);
    await waitForController(page);

    const waiting = await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration())?.waiting ?? null);

    expect(waiting).toBeNull();
  });

  // El aviso debe salir entero de la ventana y dejar de estar en el árbol de
  // accesibilidad. styles/toast.css lo baja un 100% de su altura + los 24px del
  // `bottom`, y le pone `visibility: hidden` mientras tiene el atributo [hidden].
  test('no se ve el aviso de actualización en la primera visita', async ({ page }) => {
    await gotoApp(page);
    await waitForController(page);
    await page.waitForTimeout(1500);

    expect(await toastOnScreenPx(page)).toBe(0);
    expect(await toastVisibility(page)).toBe('hidden');
  });

  test('el aviso oculto no se puede enfocar con el teclado', async ({ page }) => {
    await gotoApp(page);
    await waitForController(page);
    await page.waitForTimeout(1500);

    // `visibility: hidden` saca el botón del recorrido de tabulación. Si el
    // arreglo se deshace, el foco se salta a "Recargar" sin que el usuario
    // haya visto el aviso.
    const focused = await page.evaluate(() => {
      const b = document.getElementById('updateReloadButton');
      b.focus();
      return document.activeElement === b;
    });
    expect(focused).toBe(false);
  });
});

test.describe('Actualización con la app ya instalada', () => {
  test('el aviso aparece cuando un SW nuevo entra en "waiting"', async ({ page }) => {
    await gotoAppAsReturningUser(page);

    await triggerUpdate(page);

    await toastVisible(page);
    await expect(page.locator('#updateReloadButton')).toBeVisible();
  });

  test('el aviso es role=status para que un lector de pantalla lo anuncie', async ({ page }) => {
    await gotoAppAsReturningUser(page);

    await expect(page.locator('#updateToast')).toHaveAttribute('role', 'status');
    await expect(page.locator('#updateToast')).toHaveAttribute('aria-live', 'polite');
  });

  test('el botón Recargar activa el SW nuevo y recarga UNA sola vez', async ({ page }) => {
    await gotoAppAsReturningUser(page);
    await triggerUpdate(page);
    await toastVisible(page);

    const loadsBefore = await countLoads(page);

    await page.click('#updateReloadButton');

    // El aviso manda SKIP_WAITING; el SW salta a 'activated' y toma el control.
    // El claim cambia el controller, así que eso NO demuestra por sí solo que
    // la página se recargó: hay que mirar el contador de cargas.
    await waitForNewController(page);
    await waitForLoadCount(page, loadsBefore + 1);

    // Y no debe haber una segunda recarga más adelante: el guard `refreshing`
    // de updateNotifier evita el bucle.
    await page.waitForTimeout(1500);
    expect(await countLoads(page)).toBe(loadsBefore + 1);
  });

  test('un doble click en Recargar no recarga dos veces', async ({ page }) => {
    await gotoAppAsReturningUser(page);
    await triggerUpdate(page);
    await toastVisible(page);

    const loadsBefore = await countLoads(page);

    await page.evaluate(() => {
      const b = document.getElementById('updateReloadButton');
      b.click();
      b.click();
    });

    await waitForLoadCount(page, loadsBefore + 1);
    // El guard `refreshing` evita que el segundo click dispare otra recarga.
    await page.waitForTimeout(1500);
    expect(await countLoads(page)).toBe(loadsBefore + 1);
  });

  test('las tareas sobreviven al ciclo de actualización', async ({ page }) => {
    await gotoAppAsReturningUser(page);

    await page.evaluate(() => localStorage.setItem('tasks', JSON.stringify([
      { text: 'Antes de actualizar', done: false, date: '01/01/2030', priority: 'high',
        subtasks: [{ text: 'sub', done: false }], recurrence: 'weekly',
        lastCompleted: null, createdAt: '1700000000000' },
    ])));
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    await triggerUpdate(page);
    await page.click('#updateReloadButton');
    await page.waitForFunction(
      () => !!navigator.serviceWorker.controller?.scriptURL.includes('bust='),
      null, { timeout: 20000 },
    );
    await page.waitForSelector('.task-wrapper');

    await expect(page.locator('.task-text')).toHaveText('Antes de actualizar');
    await expect(page.locator('.recurrence-badge')).toHaveText('Semanal');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('tasks')));
    expect(stored).toHaveLength(1);
    expect(stored[0].recurrence).toBe('weekly');
    expect(stored[0].subtasks).toHaveLength(1);
  });

  test('el aviso desaparece tras recargar con la versión nueva', async ({ page }) => {
    await gotoAppAsReturningUser(page);
    await triggerUpdate(page);
    await page.click('#updateReloadButton');
    await waitForAppReady(page);

    expect(await toastOnScreenPx(page)).toBe(0);
    expect(await toastVisibility(page)).toBe('hidden');
    const waiting = await page.evaluate(async () =>
      (await navigator.serviceWorker.getRegistration())?.waiting ?? null);
    expect(waiting).toBeNull();
  });
});

// Este es el grupo que captura la regresión corregida: `wasControlledAtLoad`
// se leía una sola vez, al cargar. Con la app recién instalada ese flag
// quedaba en false para el resto de la sesión, así que una actualización
// posterior (el usuario vuelve a la pestaña, pollForUpdates encuentra un
// sw.js nuevo y pulsa "Recargar") activaba el SW pero NO recargaba la página:
// el botón no hacía nada y el usuario se quedaba con el código viejo.
test.describe('Actualización en la misma sesión que la primera visita', () => {
  test('el botón Recargar sí recarga aunque el SW se acabara de instalar', async ({ page }) => {
    await gotoApp(page);                 // primera visita: el SW se instala aquí
    await waitForController(page);
    expect(await countLoads(page)).toBe(1);

    await triggerUpdate(page);
    await toastVisible(page);

    await page.click('#updateReloadButton');

    await waitForNewController(page);
    await waitForLoadCount(page, 2);    // ← antes se quedaba en 1 y no recargaba
  });

  test('recarga una sola vez, no en bucle', async ({ page }) => {
    await gotoApp(page);
    await waitForController(page);
    await triggerUpdate(page);
    await toastVisible(page);

    await page.click('#updateReloadButton');
    await waitForNewController(page);
    await waitForLoadCount(page, 2);

    await page.waitForTimeout(2000);
    expect(await countLoads(page)).toBe(2);
  });

  test('la primera visita sigue sin recargar por el claim inicial', async ({ page }) => {
    await gotoApp(page);
    await waitForController(page);

    // Este es el claim inicial: es lo que el contador tiene que seguir
    // ignorando. Si se colgara, la app entraría en bucle de recargas.
    await page.waitForTimeout(2500);

    expect(await countLoads(page)).toBe(1);
  });
});
