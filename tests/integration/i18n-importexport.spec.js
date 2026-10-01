// ============================================================
// Tests de integración — i18n, exportar e importar
// ============================================================

import { test, expect } from '@playwright/test';
import {
  gotoApp, addTask, taskTexts, readStorage, seedStorage, captureDialogs,
} from '../helpers/e2e.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
});

test.describe('i18n — detección de idioma', () => {
  test('con locale es-ES la UI se muestra en español', async ({ page }) => {
    await gotoApp(page);
    await expect(page).toHaveTitle('Lista de Tareas');
    await expect(page.locator('[data-i18n-key="orderButton"]')).toHaveText('Ordenar');
    await expect(page.locator('[data-i18n-key="exportButton"]')).toHaveText('Exportar');
    await expect(page.locator('[data-i18n-key="addButton"]')).toHaveText('Añadir');
  });

  test('con locale en-US la UI se muestra en inglés', async ({ browser }) => {
    const ctx = await browser.newContext({ locale: 'en-US' });
    const page = await ctx.newPage();
    await page.goto('/index.html');
    await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

    await expect(page).toHaveTitle('To-Do List');
    await expect(page.locator('[data-i18n-key="orderButton"]')).toHaveText('Order');
    await expect(page.locator('[data-i18n-key="addButton"]')).toHaveText('Add');
    await ctx.close();
  });

  test('con locale pt-BR la UI se muestra en portugués', async ({ browser }) => {
    const ctx = await browser.newContext({ locale: 'pt-BR' });
    const page = await ctx.newPage();
    await page.goto('/index.html');
    await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

    await expect(page).toHaveTitle('Lista de Tarefas');
    await expect(page.locator('[data-i18n-key="orderButton"]')).toHaveText('Ordenar');
    await expect(page.locator('[data-i18n-key="addButton"]')).toHaveText('Adicionar');
    await ctx.close();
  });

  test('un idioma no soportado cae a inglés sin romperse', async ({ browser }) => {
    const ctx = await browser.newContext({ locale: 'de-DE' });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.goto('/index.html');
    await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

    await expect(page).toHaveTitle('To-Do List');
    expect(errors).toEqual([]);
    await ctx.close();
  });
});

test.describe('i18n — coherencia con el resto de la app', () => {
  test('el placeholder del input sigue al idioma', async ({ browser }) => {
    for (const [locale, expected] of [['es-ES', 'Nueva tarea'], ['en-US', 'New task']]) {
      const ctx = await browser.newContext({ locale });
      const page = await ctx.newPage();
      await page.goto('/index.html');
      await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
      await expect(page.locator('#newTaskForm input[name="taskText"]'))
        .toHaveAttribute('placeholder', expected);
      await ctx.close();
    }
  });

  test('las alertas de validación están traducidas', async ({ browser }) => {
    for (const [locale, expected] of [
      ['es-ES', 'La tarea no puede estar vacía.'],
      ['en-US', 'Task cannot be empty.'],
      ['pt-BR', 'A tarefa não pode estar vazia.'],
    ]) {
      const ctx = await browser.newContext({ locale });
      const page = await ctx.newPage();
      const dialogs = captureDialogs(page);
      await page.goto('/index.html');
      await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

      await addTask(page, { text: '  ' });
      expect(dialogs[0].message, `locale ${locale}`).toBe(expected);
      await ctx.close();
    }
  });

  test('el badge de recurrencia se muestra en el idioma activo', async ({ browser }) => {
    for (const [locale, expected] of [
      ['es-ES', 'Diaria'], ['en-US', 'Daily'], ['pt-BR', 'Diária'],
    ]) {
      const ctx = await browser.newContext({ locale });
      const page = await ctx.newPage();
      await page.goto('/index.html');
      await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

      await addTask(page, { text: 'Recurrente' });
      await page.locator('.task-wrapper').first().locator('.task').click();
      await page.click('#actionRecurrence');
      await page.click('#closeActionModal');

      await expect(page.locator('.recurrence-badge')).toHaveText(expected);
      await ctx.close();
    }
  });

  test('el formato de fecha de la tarea se aplica al crear, según el idioma', async ({ browser }) => {
    // OJO: la app guarda la fecha YA formateada. Al leer de localStorage la
    // muestra tal cual; el formateo por idioma sólo ocurre al crear/editar.
    // Usamos 2030-06-15 porque #taskDate tiene min=hoy y el navegador
    // bloquearía el submit con una fecha pasada.
    for (const [locale, expected] of [
      ['es-ES', '15/06/2030'], ['en-US', '06/15/2030'],
    ]) {
      const ctx = await browser.newContext({ locale });
      const page = await ctx.newPage();
      await page.goto('/index.html');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

      await addTask(page, { text: 'Con fecha', date: '2030-06-15' });
      // Con expect() y no textContent(): el render ocurre en el submit, pero
      // leer el DOM en el acto es una carrera que falla bajo carga (al correr
      // también el proyecto mobile-chrome hay el doble de tests en paralelo).
      await expect(page.locator('.task-date'), `locale ${locale}`).toHaveText(expected);
      await ctx.close();
    }
  });

  test('una fecha guardada en otro idioma se muestra tal cual (sin reformatear)', async ({ browser }) => {
    const ctx = await browser.newContext({ locale: 'en-US' });
    const page = await ctx.newPage();
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.clear());
    await seedStorage(page, [{
      text: 'Importada de ES', done: false, date: '15/06/2025', priority: 'low',
      subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '1',
    }]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    // El storage guarda el string ya formateado: no se toca al cargar
    expect(await page.textContent('.task-date')).toBe('15/06/2025');
    await ctx.close();
  });
});

test.describe('Exportar', () => {
  test('descarga un JSON con las tareas actuales', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Exportable', priority: 'high' });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="export"]'),
    ]);

    expect(download.suggestedFilename()).toMatch(/^todolist_backup_\d{4}-\d{2}-\d{2}\.json$/);

    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].text).toBe('Exportable');
    expect(parsed[0].priority).toBe('high');
  });

  test('exporta un archivo vacío si no hay tareas', async ({ page }) => {
    await gotoApp(page);
    await seedStorage(page, []);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="export"]'),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toEqual([]);
  });
});

test.describe('Importar', () => {
  // OJO: Playwright descarta los diálogos por defecto, así que el confirm de
  // importTasks() devolvería false. Cada test registra SU propio handler con
  // captureDialogs() (no acumular varios listeners de 'dialog').

  /** Escribe un archivo temporal y lo sube al input #importInput. */
  const uploadBackup = async (page, tasks) => {
    await page.setInputFiles('#importInput', {
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(tasks)),
    });
  };

  test('importa un backup y reemplaza las tareas actuales', async ({ page }) => {
    captureDialogs(page);
    await gotoApp(page);
    await addTask(page, { text: 'Original' });

    await uploadBackup(page, [
      { text: 'Importada 1', done: false, date: '01/01/2030', priority: 'high',
        subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '1' },
      { text: 'Importada 2', done: true, date: '02/01/2030', priority: 'low',
        subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '2' },
    ]);

    await expect(page.locator('.task-wrapper')).toHaveCount(2);
    expect(await taskTexts(page)).toEqual(['Importada 1', 'Importada 2']);
    expect((await readStorage(page)).length).toBe(2);
  });

  test('pide confirmación antes de reemplazar', async ({ page }) => {
    const dialogs = captureDialogs(page);
    await gotoApp(page);
    await addTask(page, { text: 'Original' });

    await uploadBackup(page, [{ text: 'Nueva', done: false, date: '01/01/2030',
      priority: 'low', subtasks: [], recurrence: 'none',
      lastCompleted: null, createdAt: '1' }]);

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    expect(dialogs[0].type).toBe('confirm');
    expect(dialogs[0].message).toContain('reemplazará');
  });

  test('si se cancela la confirmación no se importa nada', async ({ page }) => {
    page.on('dialog', d => d.dismiss());
    await gotoApp(page);
    await addTask(page, { text: 'Se queda' });

    await uploadBackup(page, [{ text: 'No entra', done: false, date: '01/01/2030',
      priority: 'low', subtasks: [], recurrence: 'none',
      lastCompleted: null, createdAt: '1' }]);

    await page.waitForTimeout(500);
    expect(await taskTexts(page)).toEqual(['Se queda']);
  });

  test('un JSON inválido muestra una alerta y conserva las tareas', async ({ page }) => {
    const dialogs = captureDialogs(page);
    await gotoApp(page);
    await addTask(page, { text: 'Intacta' });

    await page.setInputFiles('#importInput', {
      name: 'roto.json', mimeType: 'application/json',
      buffer: Buffer.from('{esto no es json'),
    });

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    expect(await taskTexts(page)).toEqual(['Intacta']);
    expect(dialogs.some(d => d.message.includes('Error al importar'))).toBe(true);
  });

  test('importar un array vacío deja la lista vacía', async ({ page }) => {
    captureDialogs(page);
    await gotoApp(page);
    await addTask(page, { text: 'Se va' });

    await uploadBackup(page, []);
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
    expect(await readStorage(page)).toEqual([]);
  });

  test('el estado done de lo importado se respeta', async ({ page }) => {
    captureDialogs(page);
    await gotoApp(page);
    await uploadBackup(page, [
      { text: 'Hecha', done: true, date: '01/01/2030', priority: 'low',
        subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '1' },
    ]);
    await expect(page.locator('.task').first()).toHaveClass(/done/);
  });

  test('round-trip: exportar → limpiar → importar conserva las tareas', async ({ page }) => {
    captureDialogs(page);
    await gotoApp(page);
    await addTask(page, { text: 'Con subs', priority: 'high' });
    // Añadimos una subtarea
    await page.locator('.task-wrapper').first().locator('.task').click();
    await page.click('#actionSubtask');
    await page.fill('#actionSubtasksContainer .subtask-input', 'Mi subtarea');
    await page.click('#actionSubtasksContainer .subtask-input-wrapper button >> nth=0');
    await page.click('#closeActionModal');

    const original = await readStorage(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="export"]'),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const backup = Buffer.concat(chunks);

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
    await expect(page.locator('.task-wrapper')).toHaveCount(0);

    await page.setInputFiles('#importInput', {
      name: 'backup.json', mimeType: 'application/json', buffer: backup,
    });

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    expect(await readStorage(page)).toEqual(original);
  });
});
