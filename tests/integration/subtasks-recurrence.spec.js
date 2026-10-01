// ============================================================
// Tests de integración — subtareas y recurrencia
// ============================================================

import { test, expect } from '@playwright/test';
import { gotoApp, addTask, readStorage, seedStorage, todayISO } from '../helpers/e2e.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
});

/** Abre el modal de acciones de la tarea cuyo texto coincide. */
const openActions = async (page, text) => {
  await page.locator('.task-wrapper', { hasText: text }).locator('.task').click();
  await expect(page.locator('#taskActionModal')).toBeVisible();
};

test.describe('Subtareas', () => {
  test('añade una subtarea desde el modal de acciones', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Tarea madre' });
    await openActions(page, 'Tarea madre');

    await page.click('#actionSubtask');
    await page.fill('#actionSubtasksContainer .subtask-input', 'Primera sub');
    await page.click('#actionSubtasksContainer .subtask-input-wrapper button >> nth=0');

    await expect(page.locator('#actionSubtasksContainer .subtask-item')).toHaveCount(1);
    expect(await readStorage(page)).toEqual([
      expect.objectContaining({
        text: 'Tarea madre',
        subtasks: [{ text: 'Primera sub', done: false }],
      }),
    ]);
  });

  test('añade varias subtareas', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Madre' });
    await openActions(page, 'Madre');

    for (const sub of ['Sub 1', 'Sub 2', 'Sub 3']) {
      await page.click('#actionSubtask');
      await page.fill('#actionSubtasksContainer .subtask-input', sub);
      await page.click('#actionSubtasksContainer .subtask-input-wrapper button >> nth=0');
    }
    await expect(page.locator('#actionSubtasksContainer .subtask-item')).toHaveCount(3);
    expect((await readStorage(page))[0].subtasks.map(s => s.text))
      .toEqual(['Sub 1', 'Sub 2', 'Sub 3']);
  });

  test('no crea la subtarea si el texto está vacío', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Madre' });
    await openActions(page, 'Madre');

    await page.click('#actionSubtask');
    await page.fill('#actionSubtasksContainer .subtask-input', '   ');
    await page.click('#actionSubtasksContainer .subtask-input-wrapper button >> nth=0');

    await expect(page.locator('#actionSubtasksContainer .subtask-item')).toHaveCount(0);
    expect((await readStorage(page))[0].subtasks).toEqual([]);
  });

  test('Enter confirma y Escape cancela', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Madre' });
    await openActions(page, 'Madre');

    await page.click('#actionSubtask');
    await page.press('#actionSubtasksContainer .subtask-input', 'Escape');
    await expect(page.locator('#actionSubtasksContainer .subtask-input-wrapper')).toHaveCount(0);

    await page.click('#actionSubtask');
    await page.fill('#actionSubtasksContainer .subtask-input', 'Con Enter');
    await page.press('#actionSubtasksContainer .subtask-input', 'Enter');
    await expect(page.locator('#actionSubtasksContainer .subtask-item')).toHaveCount(1);
  });

  test('marcar una subtarea la persiste', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Madre' });
    await openActions(page, 'Madre');
    await page.click('#actionSubtask');
    await page.fill('#actionSubtasksContainer .subtask-input', 'Sub');
    await page.click('#actionSubtasksContainer .subtask-input-wrapper button >> nth=0');

    await page.check('#actionSubtasksContainer .subtask-checkbox');
    await expect(page.locator('#actionSubtasksContainer .subtask-text'))
      .toHaveClass(/subtask-done/);
    expect((await readStorage(page))[0].subtasks[0].done).toBe(true);
  });

  test('eliminar una subtarea la quita y la persiste', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Madre' });
    await openActions(page, 'Madre');
    await page.click('#actionSubtask');
    await page.fill('#actionSubtasksContainer .subtask-input', 'Temporal');
    await page.click('#actionSubtasksContainer .subtask-input-wrapper button >> nth=0');

    await page.click('#actionSubtasksContainer .subtask-delete');
    await expect(page.locator('#actionSubtasksContainer .subtask-item')).toHaveCount(0);
    expect((await readStorage(page))[0].subtasks).toEqual([]);
  });

  test('las subtareas se muestran ocultas en la lista y visibles en el modal', async ({ page }) => {
    await seedStorage(page, [{
      text: 'Con subs', done: false, date: '01/01/2030', priority: 'medium',
      subtasks: [{ text: 'visible', done: false }], recurrence: 'none',
      lastCompleted: null, createdAt: String(Date.now()),
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    await expect(page.locator('.subtasks-container')).toBeHidden();

    await openActions(page, 'Con subs');
    await expect(page.locator('#actionSubtasksContainer .subtask-item')).toBeVisible();
  });

  test('al reabrir el modal las subtareas siguen ahí', async ({ page }) => {
    await seedStorage(page, [{
      text: 'Persistente', done: false, date: '01/01/2030', priority: 'low',
      subtasks: [{ text: 's1', done: false }, { text: 's2', done: true }],
      recurrence: 'none', lastCompleted: null, createdAt: String(Date.now()),
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    for (let i = 0; i < 3; i++) {
      await openActions(page, 'Persistente');
      await expect(page.locator('#actionSubtasksContainer .subtask-item')).toHaveCount(2);
      await page.click('#closeActionModal');
    }
  });

  test('el estado de las subtareas sobrevive al reload', async ({ page }) => {
    await seedStorage(page, [{
      text: 'Con subs', done: false, date: '01/01/2030', priority: 'low',
      subtasks: [{ text: 's1', done: true }], recurrence: 'none',
      lastCompleted: null, createdAt: String(Date.now()),
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await openActions(page, 'Con subs');

    await expect(page.locator('#actionSubtasksContainer .subtask-checkbox')).toBeChecked();
  });
});

test.describe('Recurrencia', () => {
  test('cicla por todas las recurrencias y las muestra en el badge', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Recurrente' });
    await openActions(page, 'Recurrente');

    const expected = [['Diaria', 'daily'], ['Semanal', 'weekly'], ['Mensual', 'monthly']];
    for (const [label, value] of expected) {
      await page.click('#actionRecurrence');
      await expect(page.locator('#actionRecurrence')).toHaveClass(new RegExp(`recurrence-${value}`));
      expect((await readStorage(page))[0].recurrence).toBe(value);
    }

    // Vuelve a "none"
    await page.click('#actionRecurrence');
    expect((await readStorage(page))[0].recurrence).toBe('none');
  });

  test('el badge de la tarea muestra la recurrencia y se oculta al volver a none', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Con badge' });

    // Sin recurrencia el badge arranca vacío
    await expect(page.locator('.recurrence-badge')).toHaveText('');

    // none → daily
    await openActions(page, 'Con badge');
    await page.click('#actionRecurrence');
    await page.click('#closeActionModal');
    await expect(page.locator('.recurrence-badge')).toHaveText('Diaria');

    // daily → weekly → monthly → none
    for (const label of ['Semanal', 'Mensual', '']) {
      await openActions(page, 'Con badge');
      await page.click('#actionRecurrence');
      await page.click('#closeActionModal');
      await expect(page.locator('.recurrence-badge')).toHaveText(label);
    }

    expect((await readStorage(page))[0].recurrence).toBe('none');
  });

  test('la recurrencia persiste tras el reload', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Persistente' });
    await openActions(page, 'Persistente');
    await page.click('#actionRecurrence');
    await page.click('#actionRecurrence'); // → weekly
    expect((await readStorage(page))[0].recurrence).toBe('weekly');

    await page.reload();
    await page.waitForSelector('.task-wrapper');
    expect((await readStorage(page))[0].recurrence).toBe('weekly');
    await expect(page.locator('.recurrence-badge')).toHaveText('Semanal');
  });
});

test.describe('Reset de tareas recurrentes', () => {
  const DAY = 86400000;

  /**
   * Timestamp del día 1 del mes actual a las 12:00 UTC.
   * Necesario para decir "completada ESTE mes" sin depender del día del mes:
   * con `Date.now() - 2 * DAY` el 1 y el 2 de cada mes la fecha cae en el mes
   * anterior y la mensual sí que toca resetear.
   * Se construye en UTC porque playwright.config.js fija timezoneId: 'UTC'.
   */
  const firstOfThisMonth = () => {
    const now = new Date();
    return String(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12));
  };

  test('una diaria completada ayer se resetea al cargar', async ({ page }) => {
    const lastCompleted = String(Date.now() - DAY);
    await seedStorage(page, [{
      text: 'Diaria vencida', done: true, date: '01/01/2020', priority: 'high',
      subtasks: [], recurrence: 'daily', lastCompleted, createdAt: String(Date.now() - 10 * DAY),
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    await expect(page.locator('.task').first()).not.toHaveClass(/done/);
    // La fecha se actualiza a hoy
    const todayDisplay = await page.evaluate(() =>
      new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    await expect(page.locator('.task-date').first()).toHaveText(todayDisplay);
    // Y se persiste el reset
    const stored = await readStorage(page);
    expect(stored[0].done).toBe(false);
    expect(stored[0].lastCompleted).toBeNull();
  });

  test('una diaria completada hoy NO se resetea', async ({ page }) => {
    await seedStorage(page, [{
      text: 'Diaria de hoy', done: true, date: '01/01/2020', priority: 'high',
      subtasks: [], recurrence: 'daily', lastCompleted: String(Date.now()),
      createdAt: String(Date.now() - 10 * DAY),
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    await expect(page.locator('.task').first()).toHaveClass(/done/);
  });

  test('una semanal completada hace 8 días se resetea', async ({ page }) => {
    await seedStorage(page, [{
      text: 'Semanal vencida', done: true, date: '01/01/2020', priority: 'high',
      subtasks: [], recurrence: 'weekly', lastCompleted: String(Date.now() - 8 * DAY),
      createdAt: String(Date.now() - 20 * DAY),
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await expect(page.locator('.task').first()).not.toHaveClass(/done/);
  });

  test('una mensual completada este mes NO se resetea', async ({ page }) => {
    await seedStorage(page, [{
      text: 'Mensual al día', done: true, date: '01/01/2020', priority: 'high',
      subtasks: [], recurrence: 'monthly', lastCompleted: firstOfThisMonth(),
      createdAt: String(Date.now() - 20 * DAY),
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await expect(page.locator('.task').first()).toHaveClass(/done/);
  });

  test('el reset también desmarca las subtareas', async ({ page }) => {
    await seedStorage(page, [{
      text: 'Con subs', done: true, date: '01/01/2020', priority: 'high',
      subtasks: [{ text: 's1', done: true }, { text: 's2', done: true }],
      recurrence: 'daily', lastCompleted: String(Date.now() - DAY),
      createdAt: String(Date.now() - 10 * DAY),
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    await page.locator('.task-wrapper').first().locator('.task').click();
    await expect(page.locator('#actionSubtasksContainer .subtask-checkbox').first())
      .not.toBeChecked();
  });

  test('una tarea NO recurrente antigua no se resetea nunca', async ({ page }) => {
    await seedStorage(page, [{
      text: 'Normal antigua', done: true, date: '01/01/2020', priority: 'high',
      subtasks: [], recurrence: 'none', lastCompleted: String(Date.now() - 400 * DAY),
      createdAt: String(Date.now() - 500 * DAY),
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await expect(page.locator('.task').first()).toHaveClass(/done/);
  });

  test('completar una recurrente fija la fecha de hoy al reactivarla', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Reactivable' });
    await openActions(page, 'Reactivable');
    await page.click('#actionRecurrence'); // daily
    await page.click('#actionDone');        // hecha
    await page.click('#actionDone');        // pendiente de nuevo → fecha = hoy
    await page.click('#closeActionModal');

    const todayDisplay = await page.evaluate(() =>
      new Date().toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }));
    await expect(page.locator('.task-date').first()).toHaveText(todayDisplay);
    void todayISO;
  });
});
