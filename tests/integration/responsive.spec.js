// ============================================================
// Tests de integración — layout responsive
//
// Estos tests fijan el viewport a mano para que se comporten igual en el
// proyecto `chromium` (escritorio) y en `mobile-chrome`. Así el nombre del
// proyecto no importa y cualquier ancho se puede comprobar en cualquier sitio.
// ============================================================

import { test, expect } from '@playwright/test';
import { gotoApp, addTask } from '../helpers/e2e.js';

// 360 = móvil pequeño Android · 412 = Pixel 7 · 768 = tablet · 1280 = escritorio
const WIDTHS = [
  { name: 'móvil pequeño (360)', width: 360, height: 640 },
  { name: 'móvil (412)', width: 412, height: 823 },
  { name: 'tablet (768)', width: 768, height: 1024 },
  { name: 'escritorio (1280)', width: 1280, height: 800 },
];

/** Texto largo para forzar el wrap en el contenedor más estrecho. */
const LONG = 'Comprar pan para la cena del domingo con la familia y los amigos';

/** Todo lo que se sale por la derecha del viewport. */
const overflowingElements = (page) => page.evaluate(() =>
  [...document.querySelectorAll('body *')]
    .filter((el) => {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return false;
      return r.right > window.innerWidth + 1;
    })
    .map((el) => `${el.tagName.toLowerCase()}#${el.id || '-'}.${[...el.classList].join('.')}`));

/** ¿Cabe la página en horizontal? */
const hasHorizontalScroll = (page) => page.evaluate(() => {
  const d = document.documentElement;
  return d.scrollWidth > d.clientWidth + 1 || document.body.scrollWidth > d.clientWidth + 1;
});

/**
 * Espera a que un elemento termine su animación de entrada.
 *
 * Importa medir: los modals entran con una transición de opacidad/transform, y
 * si se lee el boundingBox a mitad de camino sale un rectángulo desplazado que
 * hace fallar las aserciones de "cabe en el ancho" solo bajo carga (con varios
 * workers en paralelo). Medimos la geometría ya asentada.
 */
const settle = (page, selector) => page.waitForFunction((sel) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const running = (el.getAnimations?.() ?? []).some((a) => a.playState === 'running');
  return !running;
}, selector, { timeout: 5000 });

for (const { name, width, height } of WIDTHS) {
  test.describe(`Layout a ${name}`, () => {
    test.use({ viewport: { width, height } });

    test.beforeEach(async ({ page }) => {
      await gotoApp(page);
      await addTask(page, { text: LONG });
      await addTask(page, { text: 'Corta' });
      await page.waitForSelector('.task-wrapper');
    });

    test('no aparece scroll horizontal', async ({ page }) => {
      expect(await overflowingElements(page)).toEqual([]);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });

    test('los controles principales caben en el ancho', async ({ page }) => {
      for (const sel of [
        '#openNewTaskModal',
        '[data-i18n-key="orderButton"]',
        '#donateButton',
        '#taskSearch',
      ]) {
        const box = await page.locator(sel).first().boundingBox();
        expect(box, `${sel} no se renderiza`).not.toBeNull();
        expect(box.x, `${sel} se sale por la izquierda`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${sel} se sale por la derecha`).toBeLessThanOrEqual(width + 1);
      }
    });

    test('el texto largo de una tarea envuelve sin desbordar', async ({ page }) => {
      const box = await page.locator('.task-text').first().boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      // Si no envolviera, el <p> se quedaría en una sola línea muy larga.
      expect(box.height).toBeGreaterThan(0);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });

    test('el modal de nueva tarea cabe en el ancho y se puede usar', async ({ page }) => {
      await page.click('#openNewTaskModal');
      const content = page.locator('#newTaskModal .modal-content');
      await expect(content).toBeVisible();
      await settle(page, '#newTaskModal .modal-content');

      const box = await content.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      // Alto máximo: si no cabe en pantalla, debe poder desplazarse.
      expect(box.height).toBeLessThanOrEqual(height + 1);

      // Los campos clave son alcanzables y utilizables
      await page.fill('#newTaskForm input[name="taskText"]', 'Desde móvil');
      await expect(page.locator('#newTaskForm input[name="taskText"]'))
        .toHaveValue('Desde móvil');
      await page.click('#cancelNewTaskButton');
      await expect(page.locator('#newTaskModal')).toBeHidden();
    });

    test('el modal de acciones de una tarea cabe en el ancho', async ({ page }) => {
      await page.click('.task-wrapper .task');
      const content = page.locator('#taskActionModal .modal-content');
      await expect(content).toBeVisible();
      await settle(page, '#taskActionModal .modal-content');

      const box = await content.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);

      // Los botones de acción no se salen
      for (const sel of ['#actionDone', '#actionEdit', '#actionDelete']) {
        const b = await page.locator(sel).boundingBox();
        expect(b, `${sel} no se renderiza`).not.toBeNull();
        expect(b.x + b.width, `${sel} se sale por la derecha`).toBeLessThanOrEqual(width + 1);
      }
    });

    test('el aviso de deshacer cabe en el ancho', async ({ page }) => {
      await page.click('.task-wrapper .task');
      await page.click('#actionDelete');

      const toast = page.locator('#undoToast');
      await expect(toast).toBeVisible();
      await settle(page, '#undoToast');
      const box = await toast.boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    });

    test('el buscador sigue funcionando a este ancho', async ({ page }) => {
      // OJO: con la búsqueda activa las tareas que no coinciden siguen en el
      // DOM, ocultas por CSS (ver la nota de tests/integration/search.spec.js).
      // Para lo que ve el usuario hay que usar el pseudo-clase :visible.
      await page.fill('#taskSearch', 'pan');
      await expect(page.locator('.task-wrapper:visible')).toHaveCount(1);
      await expect(page.locator('.task-wrapper:visible .task-text')).toHaveText(LONG);

      await page.fill('#taskSearch', 'nada-de-esto');
      await expect(page.locator('.task-wrapper:visible')).toHaveCount(0);
      await expect(page.locator('#searchEmpty')).toBeVisible();

      await page.click('#taskSearchClear');
      await expect(page.locator('.task-wrapper:visible')).toHaveCount(2);
    });

    test('el flujo crear → completar → deshacer funciona a este ancho', async ({ page }) => {
      await addTask(page, { text: 'Flujo móvil' });
      await expect(page.locator('.task-wrapper')).toHaveCount(3);

      await page.locator('.task-wrapper', { hasText: 'Flujo móvil' }).locator('.task').click();
      await page.click('#actionDone');
      await page.click('#closeActionModal');
      await expect(page.locator('.task-wrapper', { hasText: 'Flujo móvil' }).locator('.task'))
        .toHaveClass(/done/);

      await page.locator('.task-wrapper', { hasText: 'Flujo móvil' }).locator('.task').click();
      await page.click('#actionDelete');
      await expect(page.locator('.task-wrapper')).toHaveCount(2);

      await page.click('#undoButton');
      await expect(page.locator('.task-wrapper')).toHaveCount(3);
    });
  });
}

test.describe('Objetivos táctiles', () => {
  // Mínimo razonable para un dedo. Por debajo de esto es fácil fallar el tap.
  const MIN = 36;

  test.use({ viewport: { width: 360, height: 640 } });

  test('los botones principales tienen un alto pulsable', async ({ page }) => {
    await gotoApp(page);

    for (const sel of [
      '#openNewTaskModal',
      '[data-i18n-key="orderButton"]',
      '#donateButton',
    ]) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box, `${sel} no se renderiza`).not.toBeNull();
      expect(box.height, `${sel} es demasiado bajo para tocarlo (${box.height}px)`)
        .toBeGreaterThanOrEqual(MIN);
    }
  });

  test('el buscador y sus botones son alcanzables con el dedo', async ({ page }) => {
    await gotoApp(page);
    await page.fill('#taskSearch', 'x');

    const box = await page.locator('#taskSearch').boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(MIN);
    await expect(page.locator('#taskSearchClear')).toBeVisible();
  });
});