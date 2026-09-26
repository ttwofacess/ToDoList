// ============================================================
// Tests de integración — CRUD de tareas sobre la app real
// (Playwright + servidor estático, DOM real, localStorage real)
// ============================================================

import { test, expect } from '@playwright/test';
import {
  gotoApp, addTask, taskTexts, readStorage, seedStorage,
  captureDialogs, todayISO,
} from '../helpers/e2e.js';

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
});

test.describe('Carga inicial', () => {
  test('la app arranca sin errores de consola', async ({ page }) => {
    const errors = [];
    page.on('console', m => m.type() === 'error' && errors.push(m.text()));
    page.on('pageerror', e => errors.push(String(e)));

    await gotoApp(page);
    await page.waitForTimeout(500);

    expect(errors).toEqual([]);
  });

  test('renderiza la fecha actual en el header', async ({ page }) => {
    await gotoApp(page);
    const year = await page.textContent('#dateYear');
    expect(year).toBe(String(new Date().getFullYear()));
    expect(await page.textContent('#dateNumber')).toMatch(/^\d{1,2}$/);
  });

  test('el contenedor de tareas está vacío al empezar', async ({ page }) => {
    await gotoApp(page);
    expect(await page.locator('.task-wrapper').count()).toBe(0);
  });

  test('establece la fecha mínima de los date pickers en hoy', async ({ page }) => {
    await gotoApp(page);
    const today = await todayISO(page);
    expect(await page.getAttribute('#taskDate', 'min')).toBe(today);
    expect(await page.getAttribute('#editTaskDate', 'min')).toBe(today);
  });

  test('el botón Instalar arranca oculto en escritorio', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('#installButton')).toBeHidden();
  });
});

test.describe('Crear tareas', () => {
  test('crea una tarea y la muestra en la lista', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Comprar pan' });

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    expect(await taskTexts(page)).toEqual(['Comprar pan']);
  });

  test('la nueva tarea aparece arriba', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Primera' });
    await addTask(page, { text: 'Segunda' });
    expect(await taskTexts(page)).toEqual(['Segunda', 'Primera']);
  });

  test('persiste en localStorage', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Persistida', priority: 'high' });

    const stored = await readStorage(page);
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('Persistida');
    expect(stored[0].priority).toBe('high');
    expect(stored[0].done).toBe(false);
    expect(stored[0].recurrence).toBe('none');
  });

  test('sobrevive a un recargado de página', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Sobrevive al reload' });
    await page.reload();
    await page.waitForSelector('.task-wrapper');

    expect(await taskTexts(page)).toEqual(['Sobrevive al reload']);
  });

  test('cierra el modal tras crear la tarea', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'T' });
    await expect(page.locator('#newTaskModal')).toBeHidden();
  });

  test('asigna la clase de prioridad correcta', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Urgente', priority: 'high' });
    await expect(page.locator('.task').first()).toHaveClass(/priority-high/);
  });

  test('muestra la fecha de hoy por defecto y la marca due-today', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Hoy' });
    await expect(page.locator('.task').first()).toHaveClass(/due-today/);
  });

  test('acepta una fecha futura', async ({ page }) => {
    await gotoApp(page);
    const future = await page.evaluate(() => {
      const d = new Date(); d.setMonth(d.getMonth() + 2);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    });
    await addTask(page, { text: 'Futura', date: future });
    await expect(page.locator('.task-wrapper')).toHaveCount(1);
  });

  test('la tarea se muestra con 2 emojis generados', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Con emojis' });
    const emojis = await page.textContent('.task-emojis');
    expect([...emojis]).toHaveLength(2);
  });
});

test.describe('Validaciones al crear', () => {
  test('rechaza una tarea vacía y avisa', async ({ page }) => {
    const dialogs = captureDialogs(page);
    await gotoApp(page);
    await addTask(page, { text: '   ' });

    expect(dialogs).toHaveLength(1);
    expect(dialogs[0].message).toBe('La tarea no puede estar vacía.');
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
  });

  test('rechaza texto de más de 500 caracteres', async ({ page }) => {
    const dialogs = captureDialogs(page);
    await gotoApp(page);
    await addTask(page, { text: 'a'.repeat(501) });

    expect(dialogs[0].message).toContain('500 caracteres');
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
  });

  test('acepta exactamente 500 caracteres', async ({ page }) => {
    captureDialogs(page);
    await gotoApp(page);
    await addTask(page, { text: 'a'.repeat(500) });
    await expect(page.locator('.task-wrapper')).toHaveCount(1);
  });

  test('la validación de taskManager también bloquea fechas pasadas', async ({ page }) => {
    const dialogs = captureDialogs(page);
    await gotoApp(page);
    // El input date no permite elegir fechas pasadas, pero la validación
    // de taskManager también debe<dyn> dispararse: la forzamos por JS.
    await page.click('#openNewTaskModal');
    await page.fill('#newTaskForm input[name="taskText"]', 'Pasada');
    await page.evaluate(() => {
      const input = document.getElementById('taskDate');
      input.removeAttribute('min');
      input.value = '2020-01-01';
    });
    await page.click('#newTaskForm button[type="submit"]');

    expect(dialogs[0].message).toContain('no puede ser anterior');
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
  });

  test('bloquea la creación a partir de 100 tareas', async ({ page }) => {
    const dialogs = captureDialogs(page);
    await gotoApp(page);
    await seedStorage(page, Array.from({ length: 100 }, (_, i) => ({
      text: `Tarea ${i}`, done: false, date: '01/01/2030',
      priority: 'low', subtasks: [], recurrence: 'none',
      lastCompleted: null, createdAt: String(Date.now()),
    })));
    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await expect(page.locator('.task-wrapper')).toHaveCount(100);

    await addTask(page, { text: 'Una más' });
    expect(dialogs[0].message).toBe('Número máximo de tareas alcanzado.');
    await expect(page.locator('.task-wrapper')).toHaveCount(100);
  });
});

test.describe('Completar / editar / eliminar', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Tarea de prueba' });
  });

  test('abre el modal de acciones al hacer click en la tarea', async ({ page }) => {
    await page.click('.task');
    await expect(page.locator('#taskActionModal')).toBeVisible();
    await expect(page.locator('#actionModalText')).toHaveText('Tarea de prueba');
  });

  test('marca la tarea como hecha y persiste', async ({ page }) => {
    await page.click('.task');
    await page.click('#actionDone');

    await expect(page.locator('.task').first()).toHaveClass(/done/);
    expect((await readStorage(page))[0].done).toBe(true);
  });

  test('desmarca una tarea ya hecha', async ({ page }) => {
    await page.click('.task');
    await page.click('#actionDone');
    await page.click('#actionDone');
    expect((await readStorage(page))[0].done).toBe(false);
  });

  test('el estado hecho sobrevive al reload', async ({ page }) => {
    await page.click('.task');
    await page.click('#actionDone');
    await page.reload();
    await page.waitForSelector('.task-wrapper');
    await expect(page.locator('.task').first()).toHaveClass(/done/);
  });

  test('elimina la tarea', async ({ page }) => {
    await page.click('.task');
    await page.click('#actionDelete');

    await expect(page.locator('.task-wrapper')).toHaveCount(0);
    expect(await readStorage(page)).toEqual([]);
    await expect(page.locator('#taskActionModal')).toBeHidden();
  });

  test('edita el texto, la prioridad y la fecha', async ({ page }) => {
    await page.click('.task');
    await page.click('#actionEdit');
    await expect(page.locator('#editModal')).toBeVisible();

    await page.fill('#editTaskText', 'Texto editado');
    await page.selectOption('#editTaskPriority', 'high');
    await page.fill('#editTaskDate', '2030-06-15');
    await page.click('#editTaskForm button[type="submit"]');

    await expect(page.locator('.task-text')).toHaveText('Texto editado');
    await expect(page.locator('.task').first()).toHaveClass(/priority-high/);

    const stored = await readStorage(page);
    expect(stored[0].text).toBe('Texto editado');
    expect(stored[0].priority).toBe('high');
  });

  test('el modal de edición precarga los valores actuales', async ({ page }) => {
    await page.click('.task');
    await page.click('#actionEdit');
    await expect(page.locator('#editTaskText')).toHaveValue('Tarea de prueba');
    await expect(page.locator('#editTaskPriority')).toHaveValue('medium');
  });

  test('cancelar la edición no guarda cambios', async ({ page }) => {
    await page.click('.task');
    await page.click('#actionEdit');
    await page.fill('#editTaskText', 'No debe guardarse');
    await page.click('#cancelEditButton');

    await expect(page.locator('.task-text')).toHaveText('Tarea de prueba');
    expect((await readStorage(page))[0].text).toBe('Tarea de prueba');
  });

  test('rechaza guardar un texto vacío', async ({ page }) => {
    const dialogs = captureDialogs(page);
    await page.click('.task');
    await page.click('#actionEdit');
    await page.fill('#editTaskText', '  ');
    await page.click('#editTaskForm button[type="submit"]');

    expect(dialogs[0].message).toBe('La tarea no puede estar vacía.');
    await expect(page.locator('#editModal')).toBeVisible();
  });

  test('el modal de acciones se cierra con la X y con el overlay', async ({ page }) => {
    await page.click('.task');
    await page.click('#closeActionModal');
    await expect(page.locator('#taskActionModal')).toBeHidden();

    await page.click('.task');
    await page.locator('#taskActionModal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#taskActionModal')).toBeHidden();
  });
});

test.describe('Ordenar', () => {
  // addTask hace prepend, así que tras crear A, B, C el orden es C, B, A.
  test('mueve las completadas al final', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'A' });
    await addTask(page, { text: 'B' });
    await addTask(page, { text: 'C' });
    expect(await taskTexts(page)).toEqual(['C', 'B', 'A']);

    // Completar B (la del medio) para que el ordenado realmente reordene
    await page.locator('.task-wrapper', { hasText: 'B' }).locator('.task').click();
    await page.click('#actionDone');
    // #actionDone deja el modal abierto: hay que cerrarlo o bloquea el header
    await page.click('#closeActionModal');
    await expect(page.locator('.task-wrapper', { hasText: 'B' }).locator('.task'))
      .toHaveClass(/done/);

    await page.click('.orderButton');
    expect(await taskTexts(page)).toEqual(['C', 'A', 'B']);
  });

  test('el orden se persiste y sobrevive al reload', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'A' });
    await addTask(page, { text: 'B' });
    await addTask(page, { text: 'C' });

    await page.locator('.task-wrapper', { hasText: 'B' }).locator('.task').click();
    await page.click('#actionDone');
    await page.click('#closeActionModal');
    await page.click('.orderButton');

    expect((await readStorage(page)).map(t => t.text)).toEqual(['C', 'A', 'B']);

    await page.reload();
    await page.waitForSelector('.task-wrapper');
    expect(await taskTexts(page)).toEqual(['C', 'A', 'B']);
  });

  test('el botón Ordenar es idempotente', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'A' });
    await addTask(page, { text: 'B' });

    await page.click('.orderButton');
    await page.click('.orderButton');
    expect(await taskTexts(page)).toEqual(['B', 'A']);
  });
});

test.describe('Modo enfoque (filtro)', () => {
  test('alterna la clase del contenedor y el texto del botón', async ({ page }) => {
    await gotoApp(page);
    // OJO: la clase .filterButton la comparten los 3 botones de cancelar,
    // así que hay que concretizar el selector.
    const filter = page.locator('[data-i18n-key="filterButtonToday"]');

    await expect(filter).toHaveText('Modo Enfoque');
    await filter.click();
    await expect(filter).toHaveText('Ver Todo');
    await expect(page.locator('#tasksContainer')).toHaveClass(/filter-today-active/);

    await filter.click();
    await expect(filter).toHaveText('Modo Enfoque');
    await expect(page.locator('#tasksContainer')).not.toHaveClass(/filter-today-active/);
  });
});

test.describe('Robustez y seguridad', () => {
  test('un texto con <script> no se ejecuta ni se inyecta en el DOM', async ({ page }) => {
    await gotoApp(page);
    const alerted = [];
    page.on('dialog', async d => { alerted.push(d.message()); await d.dismiss(); });

    await addTask(page, { text: '<script>window.__xss=true</script>Alerta' });
    await expect(page.locator('.task-text')).toHaveText('Alerta');

    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(alerted).toEqual([]);

    const html = await page.locator('.task-text').innerHTML();
    expect(html).not.toContain('<script>');
  });

  test('un texto con onerror no inyecta atributos', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: '<img src=x onerror=alert(1)>' });
    const html = await page.locator('.task-text').innerHTML();
    expect(html).not.toContain('onerror');
  });

  test('sobrevive a localStorage con JSON corrupto', async ({ page }) => {
    await page.goto('/index.html');
    await page.evaluate(() => localStorage.setItem('tasks', '{{{corrupto'));
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.reload();
    await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('descarta las tareas con el esquema inválido sin romper', async ({ page }) => {
    await page.goto('/index.html');
    await seedStorage(page, [
      { text: 'Válida', done: false },
      { text: 'Sin done' },
      { done: false },
      { text: 42, done: false },
    ]);
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));

    await page.reload();
    await page.waitForSelector('.task-wrapper');
    expect(await taskTexts(page)).toEqual(['Válida']);
    expect(errors).toEqual([]);
  });
});
