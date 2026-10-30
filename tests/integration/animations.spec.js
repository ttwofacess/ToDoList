// ============================================================
// Tests de integración — animaciones de entrada y salida de tareas
//
// Comprueban lo que no se ve en una captura: que la tarjeta entra con
// fade, que al borrarse se colapsa antes de desaparecer y que el aviso
// de deshacer aparece recién cuando la tarjeta terminó de salir.
//
// El estado se captura con un MutationObserver y no después del click: la
// animación es rápida y una evaluación posterior puede llegar tarde (en
// WebKit, por ejemplo, la tarjeta ya fue borrada).
// ============================================================

import { test, expect } from '@playwright/test';
import { addTask, seedStorage, todayISO } from '../helpers/e2e.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
});

/**
 * Anota el estado de la primera tarea que recibe la clase indicada.
 * La observación corre en el mismo microtask del cambio, así que captura
 * el estado real durante la animación.
 */
const captureOnClass = (page, className) => page.evaluate((cls) => {
  window.__captura = null;
  const container = document.getElementById('tasksContainer');
  const observer = new MutationObserver(() => {
    if (window.__captura) return;
    const w = container.querySelector(`.task-wrapper.${cls}`);
    if (!w) return;
    window.__captura = {
      existe: true,
      clases: w.className,
      animation: getComputedStyle(w).animationName,
      alturaInicial: w.style.getPropertyValue('--task-out-height'),
      avisoOculto: document.getElementById('undoToast').hidden,
    };
    observer.disconnect();
  });
  observer.observe(container, {
    attributes: true, subtree: true, childList: true, attributeFilter: ['class'],
  });
}, className);

/** Lo que el observador anotó (null si la clase nunca apareció). */
const readCapture = (page) => page.evaluate(() => window.__captura);

/** Espera a que la tarjeta termine su animación de entrada. */
const esperarEntradaTerminada = (page) =>
  expect(page.locator('#tasksContainer .task-wrapper'))
    .not.toHaveClass(/just-added/, { timeout: 5000 });

/**
 * Anota el `animationName` del ::after de la primera tarjeta que recibe
 * `just-done`. La clase vive en `.task` y la animación en su pseudoelemento.
 */
const captureOnTaskClass = (page, className) => page.evaluate((cls) => {
  window.__capturaCheck = null;
  const container = document.getElementById('tasksContainer');
  const observer = new MutationObserver(() => {
    if (window.__capturaCheck) return;
    const task = container.querySelector(`.task.${cls}`);
    if (!task) return;
    window.__capturaCheck = {
      existe: true,
      animation: getComputedStyle(task.querySelector('.task-text'), '::after').animationName,
    };
    observer.disconnect();
  });
  observer.observe(container, {
    attributes: true, subtree: true, childList: true, attributeFilter: ['class'],
  });
}, className);

/** Lo que anotó el observador del check (null si la clase nunca apareció). */
const readTaskCapture = (page) => page.evaluate(() => window.__capturaCheck);

test.describe('Animaciones de tareas', () => {
  test('crear una tarea la muestra con la animación de entrada', async ({ page }) => {
    await captureOnClass(page, 'just-added');
    await addTask(page, { text: 'Animada' });

    const state = await readCapture(page);
    expect(state).not.toBeNull();
    expect(state.clases).toContain('just-added');
    expect(state.animation).toBe('task-in');
  });

  test('la animación de entrada termina y deja la tarjeta como estaba', async ({ page }) => {
    await addTask(page, { text: 'Animada' });
    await esperarEntradaTerminada(page);

    const opacity = await page.evaluate(() => {
      const w = document.querySelector('#tasksContainer .task-wrapper');
      return getComputedStyle(w).opacity;
    });
    expect(opacity).toBe('1');
  });

  test('recargar la lista no anima nada', async ({ page }) => {
    await addTask(page, { text: 'Animada' });
    await esperarEntradaTerminada(page);

    await page.reload();
    await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

    const state = await page.evaluate(() => {
      const w = document.querySelector('#tasksContainer .task-wrapper');
      return { clases: w.className, animation: getComputedStyle(w).animationName };
    });
    expect(state.clases).not.toContain('just-added');
    expect(state.animation).toBe('none');
  });

  test('borrar una tarea la colapsa y el aviso aparece al terminar', async ({ page }) => {
    await addTask(page, { text: 'Se va' });
    await esperarEntradaTerminada(page);

    await captureOnClass(page, 'leaving');
    await page.click('#tasksContainer .task .task-text');
    await page.click('#actionDelete');

    // Mientras la tarjeta sale: tiene la clase de salida y la altura que se
    // va a colapsar. El aviso todavía no existe.
    const during = await readCapture(page);
    expect(during).not.toBeNull();
    expect(during.clases).toContain('leaving');
    expect(during.alturaInicial).toMatch(/px$/);
    expect(during.avisoOculto).toBe(true);

    // Al terminar: la tarea desaparece y recién ahí aparece el aviso.
    await expect(page.locator('#undoToast')).toBeVisible();
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
  });

  test('deshacer un borrado vuelve a animar la entrada', async ({ page }) => {
    await addTask(page, { text: 'Vuelve' });
    await page.click('#tasksContainer .task .task-text');
    await page.click('#actionDelete');
    await expect(page.locator('#undoToast')).toBeVisible();

    await captureOnClass(page, 'just-added');
    await page.click('#undoButton');

    const state = await readCapture(page);
    expect(state).not.toBeNull();
    expect(state.clases).toContain('just-added');
    expect(state.animation).toBe('task-in');
  });

  test('marcar una tarea como hecha dibuja el check de completado', async ({ page }) => {
    await addTask(page, { text: 'Completar' });
    await esperarEntradaTerminada(page);

    await captureOnTaskClass(page, 'just-done');
    await page.click('#tasksContainer .task .task-text');
    await page.click('#actionDone');

    const state = await readTaskCapture(page);
    expect(state).not.toBeNull();
    expect(state.animation).toBe('task-done-check');

    await expect(page.locator('#tasksContainer .task')).toHaveClass(/done/);
  });

  test('recargar con tareas ya hechas no anima ningún check', async ({ page }) => {
    await seedStorage(page, [{ text: 'Hecha', done: true }]);
    await page.reload();
    await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

    const state = await page.evaluate(() => {
      const task = document.querySelector('#tasksContainer .task.done');
      return {
        justDone: task.classList.contains('just-done'),
        animation: getComputedStyle(task.querySelector('.task-text'), '::after').animationName,
      };
    });
    expect(state.justDone).toBe(false);
    expect(state.animation).toBe('none');
  });

  test('con movimiento reducido la entrada y la salida son instantáneas', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await captureOnClass(page, 'just-added');
    await addTask(page, { text: 'Sin movimiento' });

    const entrada = await readCapture(page);
    expect(entrada).not.toBeNull();
    expect(entrada.animation).toBe('none');

    // El check de completado tampoco corre con movimiento reducido.
    await page.click('#tasksContainer .task .task-text');
    await page.click('#actionDone');

    const completado = await page.evaluate(() => {
      const task = document.querySelector('#tasksContainer .task');
      return {
        done: task.classList.contains('done'),
        animation: getComputedStyle(task.querySelector('.task-text'), '::after').animationName,
      };
    });
    expect(completado.done).toBe(true);
    expect(completado.animation).toBe('none');

    // #actionDone deja el modal abierto: cerrarlo antes de borrar.
    await page.keyboard.press('Escape');

    await page.click('#tasksContainer .task .task-text');
    await page.click('#actionDelete');

    // Sin animación, el borrado es inmediato: la tarjeta ya no está.
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
    await expect(page.locator('#undoToast')).toBeVisible();
  });

  test.describe('Movimiento reducido global', () => {
    test('apaga las transiciones que no tenían bloque propio (tasks y forms)', async ({ page }) => {
      // Éstos eran los huecos: .task y .newTaskMainButton animaban igual con
      // reduce activo. El blanket global tiene que dejarlos en 0s.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await addTask(page, { text: 'Sin transición' });
      await esperarEntradaTerminada(page);

      const durations = await page.evaluate(() => ({
        task: getComputedStyle(document.querySelector('#tasksContainer .task')).transitionDuration,
        primaryButton: getComputedStyle(document.querySelector('.newTaskMainButton')).transitionDuration,
      }));
      expect(durations.task).toBe('0s');
      expect(durations.primaryButton).toBe('0s');
    });

    test('el pulso de due-today queda como anillo fijo sin animación', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await addTask(page, { text: 'Vence hoy', date: await todayISO(page) });
      await esperarEntradaTerminada(page);

      const pulse = await page.evaluate(() => {
        const task = document.querySelector('#tasksContainer .task.due-today');
        const after = getComputedStyle(task, '::after');
        return { animation: after.animationName, boxShadow: after.boxShadow };
      });
      expect(pulse.animation).toBe('none');
      expect(pulse.boxShadow).not.toBe('none');
    });

    test('la barra de cuenta regresiva del toast queda estática', async ({ page }) => {
      // Decisión 2.3 = A: el blanket también congela la barra; el borrado
      // definitivo lo sigue garantizando el timer JS.
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await addTask(page, { text: 'Se va' });
      await esperarEntradaTerminada(page);

      await page.click('#tasksContainer .task .task-text');
      await page.click('#actionDelete');
      await expect(page.locator('#undoToast')).toBeVisible();

      const animation = await page.evaluate(() =>
        getComputedStyle(document.querySelector('#undoToast .toast-progress')).animationName);
      expect(animation).toBe('none');
    });

    test('sin movimiento reducido las transiciones siguen activas (regresión)', async ({ page }) => {
      // Espejo del primer test: el blanket no se tiene que colar en el modo
      // normal.
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await addTask(page, { text: 'Con transición' });
      await esperarEntradaTerminada(page);

      const duration = await page.evaluate(() =>
        getComputedStyle(document.querySelector('#tasksContainer .task')).transitionDuration);
      expect(duration).not.toBe('0s');
    });
  });
});
