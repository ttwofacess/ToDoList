// ============================================================
// Tests de integración — presentación de los modales
//
// El backdrop (blur + color de fallback) y las animaciones de entrada y
// salida, comprobados sobre el navegador real.
// ============================================================

import { test, expect } from '@playwright/test';
import { gotoApp } from '../helpers/e2e.js';

const modal = (page, id) => page.locator(`#${id}`);

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
});

test.describe('El overlay del modal', () => {
  test('difumina el fondo y conserva el color de fallback', async ({ page }) => {
    await page.click('#openNewTaskModal');

    const overlay = await page.evaluate(() => {
      const s = getComputedStyle(document.getElementById('newTaskModal'));
      return { bg: s.backgroundColor, blur: s.backdropFilter };
    });

    // El blur difumina el fondo...
    expect(overlay.blur).toContain('blur(8px)');
    // ...y el color base sigue puesto: es el fallback para los navegadores
    // que no lo soportan, y además oscurece lo que hay detrás.
    expect(overlay.bg).toBe('rgba(0, 0, 0, 0.45)');
  });

  test('el color base sigue puesto aunque el navegador no difumine', async ({ page }) => {
    // Se anula el blur como si el navegador no lo soportara: el overlay tiene
    // que seguir tapando la página con el color sólido.
    await page.addStyleTag({ content: '.modal { backdrop-filter: none !important; }' });
    await page.click('#openNewTaskModal');

    const overlay = await page.evaluate(() => {
      const s = getComputedStyle(document.getElementById('newTaskModal'));
      return { bg: s.backgroundColor, blur: s.backdropFilter };
    });

    expect(overlay.blur).toBe('none');
    expect(overlay.bg).toBe('rgba(0, 0, 0, 0.45)');
  });

  test('los cuatro modales comparten el mismo overlay', async ({ page }) => {
    const ids = ['newTaskModal', 'taskActionModal', 'editModal', 'donateModal'];
    for (const id of ids) {
      const overlay = await page.evaluate((modalId) => {
        const s = getComputedStyle(document.getElementById(modalId));
        return { bg: s.backgroundColor, blur: s.backdropFilter };
      }, id);
      expect(overlay.bg).toBe('rgba(0, 0, 0, 0.45)');
      expect(overlay.blur).toContain('blur(8px)');
    }
  });
});

test.describe('Las animaciones', () => {
  test('la entrada dura 220 ms', async ({ page }) => {
    await page.click('#openNewTaskModal');

    const enter = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('#newTaskModal .modal-content'));
      return { name: s.animationName, duration: s.animationDuration };
    });

    expect(enter.name).toBe('modal-in');
    expect(enter.duration).toBe('0.22s');
  });

  test('la salida dura 200 ms', async ({ page }) => {
    await page.click('#openNewTaskModal');
    await page.click('#cancelNewTaskButton');

    const leave = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('#newTaskModal .modal-content'));
      return { name: s.animationName, duration: s.animationDuration };
    });

    expect(leave.name).toBe('modal-out');
    expect(leave.duration).toBe('0.2s');
  });

  test('con movimiento reducido no hay animación y el cierre es inmediato', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.click('#openNewTaskModal');

    const enter = await page.evaluate(() => {
      const s = getComputedStyle(document.querySelector('#newTaskModal .modal-content'));
      return { name: s.animationName, duration: s.animationDuration };
    });
    expect(enter.name).toBe('none');

    await page.click('#cancelNewTaskButton');

    const display = await page.evaluate(() =>
      document.getElementById('newTaskModal').style.display);
    expect(display).toBe('none');
  });

  test('el tornado no se aplica por defecto', async ({ page }) => {
    await page.click('#openNewTaskModal');

    const classes = await page.evaluate(() =>
      [...document.querySelector('#newTaskModal .modal-content').classList]);
    expect(classes).toContain('modal-enter');
    expect(classes).not.toContain('tornado-animate');
  });
});
