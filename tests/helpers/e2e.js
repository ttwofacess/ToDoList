// ============================================================
// Helpers compartidos para los tests de integración
// ============================================================

/** Captura los diálogos nativos (alert/confirm) y los registra. */
export const captureDialogs = (page) => {
  const dialogs = [];
  page.on('dialog', async (dialog) => {
    dialogs.push({ type: dialog.type(), message: dialog.message() });
    await dialog.accept();
  });
  return dialogs;
};

/** Abre la app y espera a que main.js haya renderizado la fecha del header. */
export const gotoApp = async (page) => {
  await page.goto('/index.html');
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
  return page;
};

/** Fecha de hoy en ISO (yyyy-mm-dd) tal como la calcula el navegador. */
export const todayISO = async (page) =>
  page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

/**
 * Crea una tarea por el flujo real de la UI.
 * OJO: #taskDate es `required` en index.html, así que sin fecha el navegador
 * bloquea el submit por validación nativa. Por defecto usamos hoy.
 */
export const addTask = async (page, { text, priority, date } = {}) => {
  await page.click('#openNewTaskModal');
  await page.fill('#newTaskForm input[name="taskText"]', text ?? '');
  if (priority) await page.selectOption('#taskPriority', priority);
  await page.fill('#taskDate', date ?? (await todayISO(page)));
  await page.click('#newTaskForm button[type="submit"]');
};

/** Envía el formulario saltándose la validación nativa de `required`. */
export const submitFormBypassingValidation = async (page, { text, priority, date } = {}) => {
  await page.click('#openNewTaskModal');
  if (text !== undefined) await page.fill('#newTaskForm input[name="taskText"]', text);
  if (priority) await page.selectOption('#taskPriority', priority);
  if (date) await page.fill('#taskDate', date);
  await page.click('#newTaskForm button[type="submit"]');
  // Si la validación nativa bloqueó, forzamos el submit del form
  await page.evaluate(() => document.getElementById('newTaskForm')
    .dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })));
};

/** Fecha de hoy en el formato de display de la app según el idioma activo. */
export const todayDisplay = async (page) =>
  page.evaluate(() => new Date().toLocaleDateString(
    document.documentElement.lang === 'es' ? 'es-ES' : 'en-US',
    { day: '2-digit', month: '2-digit', year: 'numeric' }));

/** Lista los textos de las tareas visibles, en orden. */
export const taskTexts = (page) =>
  page.$$eval('#tasksContainer .task-text', (els) => els.map(e => e.textContent));

/** Lee el array de tareas persistido en localStorage. */
export const readStorage = (page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem('tasks') || '[]'));

/** Escribe tareas directamente en localStorage (para sembrar estado). */
export const seedStorage = (page, tasks) =>
  page.evaluate((t) => localStorage.setItem('tasks', JSON.stringify(t)), tasks);
