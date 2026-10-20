// ============================================================
// Tests de integración — teclado en los modales
//
// Escape cierra el modal abierto, pero no pisa los Escape que ya tenían
// otro significado: el del input de subtarea (cancela la subtarea) y el del
// buscador (limpia la búsqueda).
// ============================================================

import { test, expect } from '@playwright/test';
import { gotoApp, addTask, seedStorage } from '../helpers/e2e.js';

const modal = (page, id) => page.locator(`#${id}`);

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
});

test.describe('Escape cierra el modal abierto', () => {
  test('el modal de nueva tarea', async ({ page }) => {
    await page.click('#openNewTaskModal');
    await expect(modal(page, 'newTaskModal')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(modal(page, 'newTaskModal')).toBeHidden();
  });

  test('el modal de acciones', async ({ page }) => {
    await addTask(page, { text: 'Con Escape' });
    await page.click('#tasksContainer .task-wrapper:first-child .task');
    await expect(modal(page, 'taskActionModal')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(modal(page, 'taskActionModal')).toBeHidden();
  });

  test('el modal de edición', async ({ page }) => {
    await addTask(page, { text: 'Editar' });
    await page.click('#tasksContainer .task-wrapper:first-child .task');
    await page.click('#actionEdit');
    await expect(modal(page, 'editModal')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(modal(page, 'editModal')).toBeHidden();
    await expect(modal(page, 'taskActionModal')).toBeHidden();
  });

  test('el modal de donaciones', async ({ page }) => {
    await page.click('#donateButton');
    await expect(modal(page, 'donateModal')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(modal(page, 'donateModal')).toBeHidden();
  });

  test('no hace nada si no hay ningún modal abierto', async ({ page }) => {
    await addTask(page, { text: 'Se queda' });

    await page.keyboard.press('Escape');

    await expect(modal(page, 'newTaskModal')).toBeHidden();
    await expect(modal(page, 'taskActionModal')).toBeHidden();
    await expect(modal(page, 'editModal')).toBeHidden();
    await expect(modal(page, 'donateModal')).toBeHidden();
    await expect(page.locator('.task-wrapper')).toHaveCount(1);
  });
});

test.describe('Escape no pisa los otros Escape', () => {
  test('en el input de subtarea cancela la subtarea y no cierra el modal', async ({ page }) => {
    await seedStorage(page, [{
      text: 'Con subs', done: false, date: '01/01/2030', priority: 'medium',
      subtasks: [{ text: 's1', done: false }], recurrence: 'none',
      lastCompleted: null, createdAt: String(Date.now()),
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    await page.click('#tasksContainer .task-wrapper:first-child .task');
    await page.click('#actionSubtask');

    const input = page.locator('#actionSubtasksContainer .subtask-input');
    await expect(input).toBeVisible();
    await input.press('Escape');

    // La subtarea se cancela...
    await expect(input).toBeHidden();
    // ...pero el modal de acciones sigue abierto.
    await expect(modal(page, 'taskActionModal')).toBeVisible();

    // Un segundo Escape ya cierra el modal: el input ya no está.
    await page.keyboard.press('Escape');
    await expect(modal(page, 'taskActionModal')).toBeHidden();
  });

  test('en el buscador limpia la búsqueda y no cierra el modal', async ({ page }) => {
    await page.click('#openNewTaskModal');
    await expect(modal(page, 'newTaskModal')).toBeVisible();

    // El buscador es un campo editable de fuera del modal: su Escape es suyo.
    await page.locator('#taskSearch').focus();
    await page.locator('#taskSearch').fill('algo');
    await page.keyboard.press('Escape');

    await expect(page.locator('#taskSearch')).toHaveValue('');
    await expect(modal(page, 'newTaskModal')).toBeVisible();
  });

  test('la búsqueda se sigue limpiando con Escape sin ningún modal abierto', async ({ page }) => {
    await addTask(page, { text: 'Buscar' });
    await page.locator('#taskSearch').fill('Buscar');
    await expect(page.locator('#searchCount')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.locator('#taskSearch')).toHaveValue('');
  });
});

test.describe('Los atajos de búsqueda no都与 los modales', () => {
  test('"/" no enfoca el buscador con un modal abierto', async ({ page }) => {
    await page.click('#openNewTaskModal');
    await expect(modal(page, 'newTaskModal')).toBeVisible();

    await page.keyboard.press('/');

    await expect(page.locator('#taskSearch')).not.toBeFocused();
    await expect(modal(page, 'newTaskModal')).toBeVisible();
  });
});
