import { test, expect } from '@playwright/test';
import { gotoApp, addTask } from '../helpers/e2e.js';

test.describe('Tamaño de los chips', () => {
  test('el chip del modal de acciones usa el tamaño de icono', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Tarea con acciones' });
    await page.locator('#tasksContainer .task-wrapper').first().locator('.task').click();

    await expect(page.locator('#taskActionModal')).toBeVisible();
    await expect(page.locator('.action-chip').first()).toHaveCSS('font-size', '20px');
  });

  test('el chip del toast de deshacer usa el tamaño de icono', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Tarea para borrar' });
    await page.locator('#tasksContainer .task-wrapper').first().locator('.task').click();
    await page.click('#actionDelete');

    const toastIcon = page.locator('#undoToast .toast-icon');
    await expect(toastIcon).toBeVisible();
    await expect(toastIcon).toHaveCSS('font-size', '20px');
  });
});
