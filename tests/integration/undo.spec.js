// ============================================================
// Tests de integración — deshacer el borrado de una tarea
// ============================================================

import { test, expect } from '@playwright/test';
import { taskTexts, readStorage, captureDialogs, todayISO } from '../helpers/e2e.js';

const UNDO_MS = 5000;

/**
 * Espera a que la app esté estable.
 * OJO: al instalarse, el Service Worker dispara location.reload() desde
 * 'controllerchange' (js/updateNotifier.js). Ese reload puede abortar la
 * navegación en curso o el click siguiente, así que esperamos a que el SW ya
 * tenga el control de la página antes de interactuar.
 */
const waitForApp = async (page) => {
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null,
    { timeout: 15000 }).catch(() => {});
};

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForApp(page);
});

/**
 * Crea una tarea por el flujo real de la UI.
 * Espera activa a que el modal esté listo y reintenta si la página se recarga
 * justo después del click (el modal se cerraría y el `fill` fallaría).
 */
const addTask = async (page, { text, priority, date } = {}) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.click('#openNewTaskModal');
    const input = page.locator('#newTaskForm input[name="taskText"]');
    const visible = await input.waitFor({ state: 'visible', timeout: 5000 })
      .then(() => true, () => false);
    if (!visible) continue;

    // La fecha se calcula en el navegador: playwright.config.js fija
    // timezoneId: 'UTC' y el runner puede estar en otra zona horaria.
    const value = date ?? await todayISO(page);

    await page.fill('#newTaskForm input[name="taskText"]', text ?? '');
    if (priority) await page.selectOption('#taskPriority', priority);
    await page.fill('#taskDate', value);
    await page.click('#newTaskForm button[type="submit"]');
    await expect(page.locator('#newTaskModal')).toBeHidden();
    return;
  }

  throw new Error(`No se pudo abrir el modal de nueva tarea para "${text}"`);
};

/** Abre el modal de acciones de la tarea cuyo texto coincide. */
const openActions = async (page, text) => {
  await page.locator('.task-wrapper', { hasText: text }).locator('.task').click();
  await expect(page.locator('#taskActionModal')).toBeVisible();
};

/** Flujo completo: abrir acciones → 🗑️ Eliminar. */
const deleteTask = async (page, text) => {
  await openActions(page, text);
  await page.click('#actionDelete');
  await expect(page.locator('#taskActionModal')).toBeHidden();
};

/**
 * Congela los temporizadores de la página.
 *
 * El aviso de deshacer dura 5 s (UNDO_TIMEOUT_MS) y en WebKit el setup de
 * estos tests tarda más que eso, así que sin congelar el reloj el aviso
 * expira antes de llegar al click y #undoButton llega invisible.
 *
 * install() por sí solo no congela: el reloj sigue corriendo con el tiempo
 * real. Hay que pausarlo con pauseAt(). El +1 s es de margen, porque
 * pauseAt(Date.now()) falla a veces con "Cannot fast-forward to the past"
 * (el reloj fake ya ha avanzado respecto al Date.now() de Node). Adelantar
 * 1 s es inofensivo: en este punto todavía no hay ningún temporizador de
 * 5 s pendiente.
 *
 * El temporizador en sí lo prueba el describe 'El aviso expira a los 5
 * segundos', que conduce este mismo reloj con fastForward().
 */
const freezeClock = async (page) => {
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 1000);
};

/** El toast de deshacer, con su estado de visibilidad. */
const undoToast = (page) => page.locator('#undoToast');

test.describe('Eliminar una tarea', () => {
  test('muestra el aviso de deshacer y persiste el borrado', async ({ page }) => {
    await addTask(page, { text: 'Se va' });

    await deleteTask(page, 'Se va');

    await expect(undoToast(page)).toBeVisible();
    await expect(undoToast(page)).toHaveClass(/toast--visible/);
    await expect(page.locator('#undoToastMessage')).toHaveText('Tarea eliminada.');
    await expect(page.locator('#undoButton')).toHaveText('Deshacer');
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
    expect(await readStorage(page)).toEqual([]);
  });

  test('el modal se cierra y la tarea desaparece de la lista', async ({ page }) => {
    await addTask(page, { text: 'Se va' });
    await addTask(page, { text: 'Se queda' });

    await deleteTask(page, 'Se va');

    expect(await taskTexts(page)).toEqual(['Se queda']);
    expect((await readStorage(page)).map(t => t.text)).toEqual(['Se queda']);
  });

  test('la barra de progreso del aviso se anima', async ({ page }) => {
    await addTask(page, { text: 'Se va' });
    await deleteTask(page, 'Se va');

    await expect(page.locator('#undoToast .toast-progress')).toHaveClass(/is-running/);
  });
});

test.describe('Deshacer', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClock(page);
  });

  test('el botón restaura la tarea y la vuelve a persistir', async ({ page }) => {
    await addTask(page, { text: 'Vuelve' });

    await deleteTask(page, 'Vuelve');
    expect(await readStorage(page)).toEqual([]);

    await page.click('#undoButton');

    await expect(undoToast(page)).toBeHidden();
    expect(await taskTexts(page)).toEqual(['Vuelve']);
    expect((await readStorage(page)).map(t => t.text)).toEqual(['Vuelve']);
  });

  test('la tarea vuelve a su posición original', async ({ page }) => {
    await addTask(page, { text: 'Primera' });
    await addTask(page, { text: 'Segunda' });
    await addTask(page, { text: 'Tercera' });
    // addTask prepende: el orden en pantalla es Tercera, Segunda, Primera
    expect(await taskTexts(page)).toEqual(['Tercera', 'Segunda', 'Primera']);

    await deleteTask(page, 'Segunda');
    await page.click('#undoButton');

    expect(await taskTexts(page)).toEqual(['Tercera', 'Segunda', 'Primera']);
    expect((await readStorage(page)).map(t => t.text))
      .toEqual(['Tercera', 'Segunda', 'Primera']);
  });

  test('deshacer una tarea con subtareas las conserva', async ({ page }) => {
    await addTask(page, { text: 'Madre' });

    await openActions(page, 'Madre');
    await page.click('#actionSubtask');
    await page.fill('#actionSubtasksContainer .subtask-input', 'Sub 1');
    await page.click('#actionSubtasksContainer .subtask-input-wrapper button >> nth=0');
    await page.click('#actionSubtask');
    await page.fill('#actionSubtasksContainer .subtask-input', 'Sub 2');
    await page.click('#actionSubtasksContainer .subtask-input-wrapper button >> nth=0');
    expect((await readStorage(page))[0].subtasks).toHaveLength(2);

    await page.click('#actionDelete');
    await page.click('#undoButton');

    // Al reabrir el modal, las subtareas siguen dentro de la tarea
    await openActions(page, 'Madre');
    await expect(page.locator('#actionSubtasksContainer .subtask-item')).toHaveCount(2);
    await expect(page.locator('#actionSubtasksContainer .subtask-text').first())
      .toHaveText('Sub 1');
    expect((await readStorage(page))[0].subtasks.map(s => s.text))
      .toEqual(['Sub 1', 'Sub 2']);
  });

  test('deshacer una tarea completada mantiene su estado', async ({ page }) => {
    // Por la UI para evitar el seedStorage + reload (ver nota del test del badge).
    await addTask(page, { text: 'Hecha', priority: 'high' });
    await openActions(page, 'Hecha');
    await page.click('#actionDone');             // marcar como hecha
    await page.click('#closeActionModal');
    await expect(page.locator('.task').first()).toHaveClass(/done/);

    await deleteTask(page, 'Hecha');
    await page.click('#undoButton');

    await expect(page.locator('.task').first()).toHaveClass(/done/);
    await expect(page.locator('.task').first()).toHaveClass(/priority-high/);
    expect((await readStorage(page))[0].done).toBe(true);
  });

  test('deshacer una tarea recurrente conserva el badge', async ({ page }) => {
    // Se crea por la UI (y no con seedStorage + reload) porque una recarga
    // puede ser abortada por el location.reload() del Service Worker.
    await addTask(page, { text: 'Recurrente' });
    await openActions(page, 'Recurrente');
    await page.click('#actionRecurrence');        // → daily
    await page.click('#closeActionModal');

    await deleteTask(page, 'Recurrente');
    await page.click('#undoButton');

    await expect(page.locator('.recurrence-badge')).toHaveText('Diaria');
    expect((await readStorage(page))[0].recurrence).toBe('daily');
  });

  test('un segundo click en Deshacer no duplica la tarea', async ({ page }) => {
    await addTask(page, { text: 'Una sola' });

    await deleteTask(page, 'Una sola');
    await page.click('#undoButton');
    // Doble click rápido: el 2º click llega cuando el toast ya está oculto,
    // así que se despacha directamente sobre el botón.
    await page.dispatchEvent('#undoButton', 'click');

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    expect((await readStorage(page)).length).toBe(1);
  });
});

test.describe('Varios borrados seguidos', () => {
  test.beforeEach(async ({ page }) => {
    await freezeClock(page);
  });

  test('el aviso sólo deshace el último borrado', async ({ page }) => {
    await addTask(page, { text: 'A' });
    await addTask(page, { text: 'B' });

    await deleteTask(page, 'A');
    await deleteTask(page, 'B');

    await page.click('#undoButton');

    // B vuelve; A queda definitiva
    expect(await taskTexts(page)).toEqual(['B']);
    expect((await readStorage(page)).map(t => t.text)).toEqual(['B']);
  });

  test('borrar A, añadir una nueva y deshacer A la devuelve a su sitio', async ({ page }) => {
    await addTask(page, { text: 'A' });
    await addTask(page, { text: 'B' });   // addTask prepende → orden: B, A

    await deleteTask(page, 'A');          // queda sólo B
    await addTask(page, { text: 'C' });   // addTask prepende
    expect(await taskTexts(page)).toEqual(['C', 'B']);

    await page.click('#undoButton');

    // A era la última (nextSibling === null), así que vuelve al final
    expect(await taskTexts(page)).toEqual(['C', 'B', 'A']);
  });

  test('borrar la del medio, añadir una nueva y deshacer la deja junto a su vecina', async ({ page }) => {
    await addTask(page, { text: 'A' });
    await addTask(page, { text: 'B' });
    await addTask(page, { text: 'C' });   // orden: C, B, A

    await deleteTask(page, 'B');          // era la del medio, nextSibling = A
    await addTask(page, { text: 'D' });   // orden: D, C, A
    expect(await taskTexts(page)).toEqual(['D', 'C', 'A']);

    await page.click('#undoButton');

    // B vuelve justo antes de su vecina original A, no al principio
    expect(await taskTexts(page)).toEqual(['D', 'C', 'B', 'A']);
  });
});

test.describe('El aviso expira a los 5 segundos', () => {
  // page.clock sustituye los timers del navegador para no esperar 5 s reales.
  test('sin tocar nada, el aviso desaparece y el borrado queda firme', async ({ page }) => {
    await page.clock.install();
    await addTask(page, { text: 'Se va' });
    await deleteTask(page, 'Se va');

    await expect(undoToast(page)).toBeVisible();

    await page.clock.fastForward(UNDO_MS - 1);
    await expect(undoToast(page)).toBeVisible();   // a los 4999 ms sigue abierto

    await page.clock.fastForward(1);
    await expect(undoToast(page)).toBeHidden();
    await expect(page.locator('.task-wrapper')).toHaveCount(0);

    // Tras recargar, el borrado sigue vigente
    await page.reload();
    await waitForApp(page);
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
    expect(await readStorage(page)).toEqual([]);
  });

  test('deshacer antes de que expire cancela el temporizador', async ({ page }) => {
    await page.clock.install();
    await addTask(page, { text: 'Vuelve' });
    await deleteTask(page, 'Vuelve');

    await page.clock.fastForward(3000);
    await page.click('#undoButton');
    expect(await taskTexts(page)).toEqual(['Vuelve']);

    // Pasados los 5 s no debe pasar nada más
    await page.clock.fastForward(UNDO_MS);
    expect(await taskTexts(page)).toEqual(['Vuelve']);
    await expect(undoToast(page)).toBeHidden();
  });

  test('un borrado nuevo reinicia la cuenta atrás', async ({ page }) => {
    await page.clock.install();
    await addTask(page, { text: 'A' });
    await addTask(page, { text: 'B' });

    await deleteTask(page, 'A');
    await page.clock.fastForward(4000);
    await deleteTask(page, 'B');

    await page.clock.fastForward(4000);   // 8000 ms desde el primero
    await expect(undoToast(page)).toBeVisible();

    await page.clock.fastForward(1000);   // 5000 ms desde el segundo
    await expect(undoToast(page)).toBeHidden();
  });
});

test.describe('Importar con un aviso pendiente', () => {
  test('el aviso se cancela y la tarea vieja no reaparece', async ({ page }) => {
    captureDialogs(page);
    await addTask(page, { text: 'Se va' });
    await deleteTask(page, 'Se va');
    await expect(undoToast(page)).toBeVisible();

    await page.setInputFiles('#importInput', {
      name: 'backup.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { text: 'Importada', done: false, date: '01/01/2030', priority: 'low',
          subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '1' },
      ])),
    });

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    await expect(undoToast(page)).toBeHidden();

    // Ni ahora ni más tarde vuelve la tarea eliminada
    await page.waitForTimeout(UNDO_MS + 500);
    expect(await taskTexts(page)).toEqual(['Importada']);
    expect((await readStorage(page)).map(t => t.text)).toEqual(['Importada']);
  });

  test('si se cancela la confirmación, el aviso sigue su curso', async ({ page }) => {
    page.on('dialog', d => d.dismiss());
    await addTask(page, { text: 'Se va' });
    await deleteTask(page, 'Se va');

    await page.setInputFiles('#importInput', {
      name: 'backup.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { text: 'No entra', done: false, date: '01/01/2030', priority: 'low',
          subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '1' },
      ])),
    });

    await page.waitForTimeout(300);
    await expect(undoToast(page)).toBeVisible();
    await page.click('#undoButton');
    expect(await taskTexts(page)).toEqual(['Se va']);
  });
});

test.describe('Otros idiomas', () => {
  /** Abre la app en un contexto con otro locale y storage limpio. */
  const openInLocale = async (browser, locale) => {
    const ctx = await browser.newContext({ locale });
    const page = await ctx.newPage();
    // addInitScript limpia el storage antes de que corra main.js: evita el
    // goto + reload, que el Service Worker puede abortar con su reload().
    await page.addInitScript(() => localStorage.clear());
    await page.goto('/index.html');
    await waitForApp(page);
    return { ctx, page };
  };

  for (const [locale, message, button] of [
    ['en-US', 'Task deleted.', 'Undo'],
    ['pt-BR', 'Tarefa excluída.', 'Desfazer'],
  ]) {
    test(`en ${locale} el aviso dice "${message}" / "${button}"`, async ({ browser }) => {
      const { ctx, page } = await openInLocale(browser, locale);

      await addTask(page, { text: 'Se va' });
      await deleteTask(page, 'Se va');

      await expect(page.locator('#undoToastMessage')).toHaveText(message);
      await expect(page.locator('#undoButton')).toHaveText(button);
      await ctx.close();
    });
  }
});

test.describe('Robustez', () => {
  test('el flujo completo no produce errores de consola', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await addTask(page, { text: 'A' });
    await addTask(page, { text: 'B' });

    await deleteTask(page, 'A');
    await page.click('#undoButton');
    await deleteTask(page, 'B');
    await page.waitForTimeout(UNDO_MS + 300);
    await page.reload();
    await waitForApp(page);

    expect(errors).toEqual([]);
    expect(await taskTexts(page)).toEqual(['A']);
  });

  test('el aviso es accesible: role status y botón enfocable', async ({ page }) => {
    await addTask(page, { text: 'Se va' });
    await deleteTask(page, 'Se va');

    await expect(undoToast(page)).toHaveAttribute('role', 'status');
    await expect(undoToast(page)).toHaveAttribute('aria-live', 'polite');

    // Teclado: Tab alcanza el botón y Enter activa el deshacer
    await page.locator('#undoButton').focus();
    await expect(page.locator('#undoButton')).toBeFocused();
    await page.keyboard.press('Enter');

    expect(await taskTexts(page)).toEqual(['Se va']);
  });
});
