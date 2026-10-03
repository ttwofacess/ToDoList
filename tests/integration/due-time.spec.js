// ============================================================
// Tests de integración — hora opcional en la fecha de vencimiento
// (Playwright + servidor estático, DOM real, localStorage real)
//
// La hora se guarda SIEMPRE como 'HH:mm' (independiente del idioma) y se
// formatea al pintarla, así que casi todo se comprueba contra data-time; el
// texto de .task-time sólo se mira donde el formato importa (24 h vs 12 h).
// ============================================================

import { test, expect } from '@playwright/test';
import {
  gotoApp, addTask, readStorage, seedStorage, captureDialogs, waitForDialog,
} from '../helpers/e2e.js';

// 2030 para no depender del reloj: #taskDate tiene min=hoy y una fecha de hoy
// con hora ya pasada sería rechazada.
const FECHA = '2030-06-15';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
});

test.describe('Crear una tarea con hora', () => {
  test('la guarda y la muestra junto a la fecha', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Con hora', date: FECHA, time: '14:30' });

    const wrapper = page.locator('.task-wrapper').first();
    await expect(wrapper).toHaveAttribute('data-time', '14:30');
    await expect(page.locator('.task-time')).toHaveText('14:30');
    expect((await readStorage(page))[0].time).toBe('14:30');
  });

  test('la hora no se cuela en el texto de la fecha', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Con hora', date: FECHA, time: '14:30' });
    // .task-date se usa como clave en highlightDueTasks: si mezcláramos la
    // hora aquí, la tarea dejaría de marcarse como due-today.
    await expect(page.locator('.task-date')).toHaveText('15/06/2030');
  });

  test('la hora sobrevive a un recargado', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Con hora', date: FECHA, time: '09:05' });

    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await expect(page.locator('.task-wrapper').first()).toHaveAttribute('data-time', '09:05');
    await expect(page.locator('.task-time')).toHaveText('09:05');
  });

  test('una tarea sin hora no muestra nada en .task-time', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Sin hora', date: FECHA });

    const wrapper = page.locator('.task-wrapper').first();
    await expect(page.locator('.task-time')).toHaveText('');
    expect(await wrapper.getAttribute('data-time')).toBeNull();
    expect((await readStorage(page))[0].time).toBe('');
  });

  test('el formulario se queda vacío tras crear', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Con hora', date: FECHA, time: '14:30' });
    await expect(page.locator('#taskTime')).toHaveValue('');
  });

  test('el botón × vacía la hora antes de crear', async ({ page }) => {
    await gotoApp(page);
    await page.click('#openNewTaskModal');
    await page.fill('#newTaskForm input[name="taskText"]', 'Sin hora al final');
    await page.fill('#taskDate', FECHA);
    await page.fill('#taskTime', '14:30');
    await page.click('#clearTaskTime');
    await expect(page.locator('#taskTime')).toHaveValue('');
    await page.click('#newTaskForm button[type="submit"]');

    await expect(page.locator('.task-time')).toHaveText('');
    expect((await readStorage(page))[0].time).toBe('');
  });

  // Congela el reloj de la página y devuelve el ISO de hoy más una hora ya
  // pasada y otra por llegar. Las horas se calculan DESDE el reloj de la
  // página y no en Node, porque playwright.config.js fija timezoneId: 'UTC' y
  // la zona de Node no es la del navegador. El margen es de 3 h y se recorta a
  // las 00:00 / 23:59 para no cruzar de día en el peor caso.
  const clockHours = async (page) => {
    await page.clock.setFixedTime(new Date('2025-06-15T12:00:00Z'));
    return page.evaluate(() => {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const hhmm = (mins) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
      const minutes = now.getHours() * 60 + now.getMinutes();
      const clamp = (m) => Math.min(Math.max(m, 0), 1439);
      return {
        iso: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
        pasado: hhmm(clamp(minutes - 180)),
        futuro: hhmm(clamp(minutes + 180)),
      };
    });
  };

  test('rechaza una hora que ya pasó hoy', async ({ page }) => {
    const { iso, pasado } = await clockHours(page);
    const dialogs = captureDialogs(page);
    await gotoApp(page);
    await page.click('#openNewTaskModal');
    await page.fill('#newTaskForm input[name="taskText"]', 'Pasada');
    await page.fill('#taskDate', iso);
    await page.fill('#taskTime', pasado);

    await page.click('#newTaskForm button[type="submit"]');

    const dialog = await waitForDialog(dialogs);
    expect(dialog.message).toBe(
      'La fecha y la hora de la tarea no pueden ser anteriores al momento actual.');
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
  });

  test('acepta una hora posterior a la actual de hoy', async ({ page }) => {
    const { iso, futuro } = await clockHours(page);
    captureDialogs(page);
    await gotoApp(page);
    await page.click('#openNewTaskModal');
    await page.fill('#newTaskForm input[name="taskText"]', 'De hoy');
    await page.fill('#taskDate', iso);
    await page.fill('#taskTime', futuro);
    await page.click('#newTaskForm button[type="submit"]');

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    expect((await readStorage(page))[0].time).toBe(futuro);
  });

  test('sin hora una tarea de hoy no se rechaza', async ({ page }) => {
    const { iso } = await clockHours(page);
    captureDialogs(page);
    await gotoApp(page);
    await page.click('#openNewTaskModal');
    await page.fill('#newTaskForm input[name="taskText"]', 'De hoy sin hora');
    await page.fill('#taskDate', iso);
    await page.click('#newTaskForm button[type="submit"]');

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    await expect(page.locator('.task-time')).toHaveText('');
  });
});

test.describe('Editar la hora', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Editable', date: FECHA, time: '14:30' });
    await page.locator('.task-wrapper').first().locator('.task').click();
    await page.click('#actionEdit');
    await expect(page.locator('#editModal')).toBeVisible();
  });

  test('el modal precarga la hora actual', async ({ page }) => {
    await expect(page.locator('#editTaskTime')).toHaveValue('14:30');
  });

  test('cambia la hora y la persiste', async ({ page }) => {
    await page.fill('#editTaskTime', '18:45');
    await page.click('#editTaskForm button[type="submit"]');

    await expect(page.locator('.task-time')).toHaveText('18:45');
    await expect(page.locator('.task-wrapper').first()).toHaveAttribute('data-time', '18:45');
    expect((await readStorage(page))[0].time).toBe('18:45');
  });

  test('el botón × quita la hora y se guarda sin ella', async ({ page }) => {
    await page.click('#clearEditTaskTime');
    await expect(page.locator('#editTaskTime')).toHaveValue('');
    await page.click('#editTaskForm button[type="submit"]');

    await expect(page.locator('.task-time')).toHaveText('');
    await expect(page.locator('.task-wrapper').first()).not.toHaveAttribute('data-time', /.*/);
    expect((await readStorage(page))[0].time).toBe('');
  });

  test('renombrar una tarea sin tocar la hora no dispara la validación', async ({ page }) => {
    await page.fill('#editTaskText', 'Renombrada');
    await page.click('#editTaskForm button[type="submit"]');

    await expect(page.locator('.task-text')).toHaveText('Renombrada');
    await expect(page.locator('.task-time')).toHaveText('14:30');
  });
});

test.describe('Formato según el idioma', () => {
  for (const [locale, pattern] of [['es-ES', /^14:30$/], ['en-US', /^\d{1,2}:30\s?PM$/]]) {
    test(`con locale ${locale} la hora se muestra formateada`, async ({ browser }) => {
      const ctx = await browser.newContext({ locale });
      const page = await ctx.newPage();
      await page.goto('/index.html');
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

      await addTask(page, { text: 'Con hora', date: FECHA, time: '14:30' });

      // En el storage sigue el 'HH:mm' crudo: el idioma no lo toca.
      await expect(page.locator('.task-wrapper').first()).toHaveAttribute('data-time', '14:30');
      await expect(page.locator('.task-time')).toHaveText(pattern);
      await ctx.close();
    });
  }
});

test.describe('Datos sucios', () => {
  test('una hora inválida guardada se ignora al cargar', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));

    await gotoApp(page);
    await seedStorage(page, [
      { text: 'Corrupta', done: false, date: '15/06/2025', priority: 'low',
        subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '1',
        time: '99:99' },
    ]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    await expect(page.locator('.task-wrapper').first()).not.toHaveAttribute('data-time', /.*/);
    await expect(page.locator('.task-time')).toHaveText('');
    expect(errors).toEqual([]);
  });

  test('una tarea vieja sin time sigue cargando', async ({ page }) => {
    await gotoApp(page);
    await seedStorage(page, [
      { text: 'Backup antiguo', done: false, date: '15/06/2025', priority: 'low',
        subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '1' },
    ]);
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    await expect(page.locator('.task-text')).toHaveText('Backup antiguo');
    await expect(page.locator('.task-time')).toHaveText('');
  });
});

test.describe('Exportar e importar', () => {
  test('el round-trip conserva la hora', async ({ page }) => {
    captureDialogs(page);
    await gotoApp(page);
    await addTask(page, { text: 'Con hora', date: FECHA, time: '14:30' });
    const original = await readStorage(page);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="export"]'),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const backup = Buffer.concat(chunks);
    expect(JSON.parse(backup.toString('utf8'))[0].time).toBe('14:30');

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator('.task-wrapper')).toHaveCount(0);

    await page.setInputFiles('#importInput', {
      name: 'backup.json', mimeType: 'application/json', buffer: backup,
    });

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    await expect(page.locator('.task-wrapper').first()).toHaveAttribute('data-time', '14:30');
    await expect(page.locator('.task-time')).toHaveText('14:30');
    expect(await readStorage(page)).toEqual(original);
  });

  test('importar un backup antiguo sin time no rompe nada', async ({ page }) => {
    captureDialogs(page);
    await gotoApp(page);
    await page.setInputFiles('#importInput', {
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        { text: 'Backup antiguo', done: false, date: '01/01/2030', priority: 'low',
          subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '1' },
      ])),
    });

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    await expect(page.locator('.task-text')).toHaveText('Backup antiguo');
    await expect(page.locator('.task-time')).toHaveText('');
  });
});