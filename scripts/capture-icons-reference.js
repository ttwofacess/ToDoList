// ============================================================
// capture-icons-reference.js — Línea base visual de la iconografía
//
// Paso 0 del plan de Icons.md: deja una foto del estado ACTUAL de todos
// los puntos del inventario (chips del action modal, toast de deshacer,
// botones de subtarea, Order/Focus, Donate, × de cierre y + del CTA) en
// claro/oscuro y en 320 px/escritorio. Después de los pasos 1–8 se vuelve
// a ejecutar con otra etiqueta y se compara 1:1.
//
// Uso:  node scripts/capture-icons-reference.js [etiqueta]
//        (por defecto la etiqueta es "before"; ej. "after")
// ============================================================

import { chromium } from '@playwright/test';
import fs   from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LABEL   = process.argv[2] || 'before';
const OUT_DIR = path.join(ROOT, 'reference', 'icons', LABEL);
const BASE    = process.env.APP_URL || 'http://localhost:4173';

const VIEWPORTS = [
  { name: 'mobile-320', viewport: { width: 320, height: 900 }, isMobile: true, hasTouch: true },
  { name: 'desktop',    viewport: { width: 1280, height: 900 } },
];

const THEMES = ['light', 'dark'];

const LONG_TEXT =
  'Revisar el informe trimestral de ventas y preparar las conclusiones ' +
  'para la reunión del viernes por la mañana';

const ICON_SELECTORS = [
  '.plus-icon',
  '.orderButton-wrapper .orderButton',
  '.orderButton-wrapper .filterButton',
  '.action-chip',
  '.crypto-icon',
  '.toast-icon',
  '.close-button',
  '.clear-time',
  '.search-clear',
  '.subtask-delete',
  '.subtask-input-wrapper button',
];

const log = (...args) => console.log('[icons]', ...args);

const seedTasks = (page) =>
  page.evaluate(async (longText) => {
    const { formatDisplayDate } = await import('./js/dateUtils.js');
    const today    = formatDisplayDate(new Date());
    const tomorrow = formatDisplayDate(new Date(Date.now() + 86400000));
    const tasks = [
      {
        text: longText,
        done: false,
        date: today,
        priority: 'high',
        subtasks: [
          { text: 'Revisar números de Q1', done: true },
          { text: 'Preparar gráficos comparativos', done: false },
          { text: 'Escribir conclusiones', done: false },
        ],
        recurrence: 'weekly',
        lastCompleted: null,
        createdAt: Date.now(),
        time: '18:30',
      },
      {
        text: 'Comprar pan y leche',
        done: false,
        date: tomorrow,
        priority: 'low',
        subtasks: [],
        recurrence: 'none',
        lastCompleted: null,
        createdAt: Date.now(),
        time: '',
      },
      {
        text: 'Tarea ya completada de ejemplo',
        done: true,
        date: today,
        priority: 'medium',
        subtasks: [],
        recurrence: 'none',
        lastCompleted: null,
        createdAt: Date.now(),
        time: '',
      },
    ];
    localStorage.setItem('tasks', JSON.stringify(tasks));
  }, LONG_TEXT);

/** Medidas de los iconos presentes en el DOM, para comparar números. */
const measureIcons = (page) =>
  page.evaluate((selectors) => {
    const pick = (el) => {
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        text: el.textContent.trim(),
        fontSize: s.fontSize,
        width: Math.round(r.width * 100) / 100,
        height: Math.round(r.height * 100) / 100,
        borderRadius: s.borderRadius,
        backgroundColor: s.backgroundColor,
        display: s.display,
        lineHeight: s.lineHeight,
      };
    };
    const out = {};
    for (const sel of selectors) {
      const els = [...document.querySelectorAll(sel)];
      if (els.length) out[sel] = els.map(pick);
    }
    return out;
  }, ICON_SELECTORS);

const captureCombo = async (browser, { vp, theme }) => {
  const dir = path.join(OUT_DIR, `${vp.name}-${theme}`);
  await fs.mkdir(dir, { recursive: true });

  const context = await browser.newContext({
    viewport: vp.viewport,
    isMobile: vp.isMobile ?? false,
    hasTouch: vp.hasTouch ?? false,
    colorScheme: theme,
    locale: 'es-ES',
    timezoneId: 'UTC',
    reducedMotion: 'no-preference',
    // Captura determinista: el SW puede recargar la página al tomar control.
    serviceWorkers: 'block',
  });

  await context.addInitScript((t) => {
    try { localStorage.setItem('theme', t); } catch { /* storage bloqueado */ }
  }, theme);

  const page = await context.newPage();
  const report = { viewport: vp.name, theme, icons: {} };

  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
  await seedTasks(page);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(350);

  const shot = async (name, target) => {
    const file = path.join(dir, `${name}.png`);
    if (target) {
      await page.locator(target).first().screenshot({ path: file });
    } else {
      await page.screenshot({ path: file });
    }
    log('captura', path.relative(ROOT, file));
  };

  const openActions = async () => {
    await page.locator('#tasksContainer .task-wrapper').first().locator('.task').click();
    await page.waitForTimeout(450);
  };

  const closeActionModal = async () => {
    await page.click('#closeActionModal');
    await page.waitForTimeout(350);
  };

  // ── Lista con tareas · iconos Order/Focus y + del CTA ──
  await shot('00-list');
  await shot('01-order-focus', '.orderButton-wrapper');

  // ── Modal de nueva tarea ───────────────────────────────
  await page.click('#openNewTaskModal');
  await page.waitForTimeout(500);
  report.icons.newTask = await measureIcons(page);
  await shot('02-new-task');
  await page.click('#cancelNewTaskButton');
  await page.waitForTimeout(350);

  // ── Modal de edición (acciones → Editar) ───────────────
  await openActions();
  await page.click('#actionEdit');
  await page.waitForTimeout(450);
  report.icons.edit = await measureIcons(page);
  await shot('03-edit');
  await page.click('#cancelEditButton');
  await page.waitForTimeout(350);

  // ── Modal de acciones ──────────────────────────────────
  await openActions();
  report.icons.actions = await measureIcons(page);
  await shot('04-actions');

  // ── Input de subtarea abierto ──────────────────────────
  await page.click('#actionSubtask');
  await page.waitForTimeout(250);
  report.icons.subtaskInput = await measureIcons(page);
  await shot('05-actions-subtask-input');
  await closeActionModal();

  // ── Toast de deshacer (borrar la segunda tarea) ────────
  await page.locator('#tasksContainer .task-wrapper').nth(1).locator('.task').click();
  await page.waitForTimeout(450);
  await page.click('#actionDelete');
  await page.waitForTimeout(600);
  report.icons.undoToast = await measureIcons(page);
  await shot('06-undo-toast');
  await page.click('#undoButton');
  await page.waitForTimeout(250);

  // ── Modal de donaciones ────────────────────────────────
  await page.click('#donateButton');
  await page.waitForTimeout(450);
  report.icons.donate = await measureIcons(page);
  await shot('07-donate');
  await page.click('#donateModal .close-button');
  await page.waitForTimeout(300);

  await context.close();
  return report;
};

const main = async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const reports = [];

  for (const vp of VIEWPORTS) {
    for (const theme of THEMES) {
      log('combo', vp.name, theme);
      reports.push(await captureCombo(browser, { vp, theme }));
    }
  }

  await browser.close();

  const reportFile = path.join(OUT_DIR, 'report.json');
  await fs.writeFile(reportFile, JSON.stringify(reports, null, 2));
  log('informe', path.relative(ROOT, reportFile));
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
