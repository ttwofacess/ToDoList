// ============================================================
// capture-modal-reference.js — Capturas de referencia de los modales
//
// Paso 1 del plan de Modal.md: deja una foto del estado ACTUAL de los cuatro
// modales (nueva tarea, acciones, edición, donaciones) en claro/oscuro y
// móvil/escritorio, más un informe con las medidas y los flujos de teclado
// observados. Después de los pasos 2–5 se vuelve a ejecutar y se compara.
//
// Uso:  node scripts/capture-modal-reference.js [etiqueta]
//        (por defecto la etiqueta es "baseline"; ej. "v2" tras los cambios)
// ============================================================

import { chromium } from '@playwright/test';
import fs   from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LABEL   = process.argv[2] || 'baseline';
const OUT_DIR = path.join(ROOT, 'reference', 'modal', LABEL);
const BASE    = process.env.APP_URL || 'http://localhost:4173';

const VIEWPORTS = [
  { name: 'desktop', viewport: { width: 1280, height: 900 } },
  { name: 'mobile',  viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
];

const THEMES = ['light', 'dark'];

const LONG_TEXT =
  'Revisar el informe trimestral de ventas con detenimiento y preparar las ' +
  'conclusiones finales para la reunión del equipo del viernes por la mañana';

// ─── Utilidades ────────────────────────────────────────────

const log = (...args) => console.log('[capture]', ...args);

/**
 * Congela la animación de entrada en un instante concreto (ms desde el
 * inicio). Para que el frame sea determinista, la animación se reinicia en
 * cada iteración (se quita la clase, se fuerza el reflow y se vuelve a
 * poner) y después se congela con `animation-delay` negativo +
 * `animation-play-state: paused`.
 */
const captureAnimationFrames = async (page, contentSelector, times, prefix, capture) => {
  for (const t of times) {
    await page.evaluate(({ sel, delay }) => {
      const el = document.querySelector(sel);
      if (!el) return;
      el.classList.remove('modal-enter');
      void el.offsetWidth;
      el.classList.add('modal-enter');
      el.style.animationDelay = `-${delay}ms`;
      el.style.animationPlayState = 'paused';
    }, { sel: contentSelector, delay: t });
    await page.waitForTimeout(60);
    await capture(`${prefix}-frame-${String(t).padStart(3, '0')}ms`);
  }
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.style.animationDelay = '';
    el.style.animationPlayState = '';
  }, contentSelector);
};

const modalOpen = (page, id) =>
  page.evaluate((modalId) =>
    document.getElementById(modalId)?.style.display === 'flex', id);

/** Estado de los cuatro modales (para detectar fugas de estado). */
const modalStates = (page) =>
  page.evaluate(() =>
    ['newTaskModal', 'taskActionModal', 'editModal', 'donateModal']
      .map((id) => ({ id, display: document.getElementById(id)?.style.display || 'none' })));

/** Medidas y estilos calculados del overlay y de la tarjeta de un modal. */
const measure = (page, id) =>
  page.evaluate((modalId) => {
    const modal  = document.getElementById(modalId);
    const content = modal?.querySelector('.modal-content');
    if (!modal || !content) return null;
    const overlay = getComputedStyle(modal);
    const card    = getComputedStyle(content);
    const rect    = content.getBoundingClientRect();
    const anims   = content.getAnimations().map(a => ({
      name: a.animationName ?? null,
      duration: a.effect?.getTiming?.().duration ?? null,
      easing: a.effect?.getTiming?.().easing ?? null,
      playState: a.playState,
    }));
    return {
      display: modal.style.display,
      overlayBackground: overlay.backgroundColor,
      backdropFilter: overlay.backdropFilter ?? overlay.webkitBackdropFilter ?? null,
      supportsBackdropFilter: CSS.supports('backdrop-filter', 'blur(8px)'),
      contentBackground: card.backgroundColor,
      contentRadius: card.borderRadius,
      contentMaxHeight: card.maxHeight,
      contentAnimationName: card.animationName,
      contentAnimationDuration: card.animationDuration,
      contentClasses: [...content.classList],
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      runningAnimations: anims,
    };
  }, id);

// ─── Siembra de datos ──────────────────────────────────────

/**
 * Siembra tareas variadas (subtareas, recurrencia, hora, texto largo, hecha)
 * usando el formato real de la app: la fecha se guarda en formato display.
 */
const seedTasks = (page) =>
  page.evaluate(async (longText) => {
    const { formatDisplayDate } = await import('./js/dateUtils.js');
    const today     = formatDisplayDate(new Date());
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

// ─── Flujo por tema/viewport ───────────────────────────────

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
  });

  // El tema se fija antes de que corra el script anti-FOUC de index.html.
  await context.addInitScript((t) => {
    try { localStorage.setItem('theme', t); } catch { /* storage bloqueado */ }
  }, theme);

  const page = await context.newPage();
  const report = { viewport: vp.name, theme, modals: {}, keyboard: {}, states: {} };

  await page.goto(`${BASE}/index.html`);
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

  // Sembrar y recargar para que la app renderice las tareas sembradas.
  await seedTasks(page);
  await page.reload();
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
  await page.waitForTimeout(300);

  const inDir = async (name) => {
    const file = path.join(dir, `${name}.png`);
    await page.screenshot({ path: file });
    log('captura', path.relative(ROOT, file));
  };

  // Frames de la animación de entrada de un modal (instantes de la línea de
  // tiempo, congelados con animation-delay negativo).
  const frames = (id, prefix) =>
    captureAnimationFrames(page, `#${id} .modal-content`, [0, 60, 120, 220], prefix, inDir);

  await inDir('00-list');

  // ── 1. Modal de nueva tarea ──────────────────────────────
  await page.click('#openNewTaskModal');
  await page.waitForTimeout(30);
  report.modals.newTask = await measure(page, 'newTaskModal');
  report.modals.newTask.focusAfterOpen = await page.evaluate(() =>
    document.activeElement?.getAttribute('name') ?? document.activeElement?.id ?? document.activeElement?.tagName);
  await frames('newTaskModal', '01-new-task');
  await page.waitForTimeout(700);
  await inDir('01-new-task-final');
  report.states.afterNewTaskClose = await (async () => {
    await page.click('#cancelNewTaskButton');
    return modalStates(page);
  })();

  // ── Salida: el modal sigue visible durante el fade-out ─────
  report.exit = await (async () => {
    await page.click('#openNewTaskModal');
    await page.waitForTimeout(350);
    await page.click('#cancelNewTaskButton');
    const during = await page.evaluate(() => ({
      visible: document.getElementById('newTaskModal').style.display === 'flex',
      hasLeaveClass: document
        .querySelector('#newTaskModal .modal-content')
        .classList.contains('modal-leave'),
      overlayBlocksClicks: getComputedStyle(document.getElementById('newTaskModal')).pointerEvents,
    }));
    await page.waitForTimeout(400);
    const after = await modalOpen(page, 'newTaskModal');
    return { during, hiddenAfterFade: !after };
  })();

  // ── 2. Modal de acciones (con subtareas movidas adentro) ─
  await page.click('#tasksContainer .task-wrapper:first-child .task');
  await page.waitForTimeout(300);
  report.modals.actions = await measure(page, 'taskActionModal');
  await frames('taskActionModal', '02-actions');
  await page.waitForTimeout(400);
  await inDir('02-actions');

  // Subtarea: input abierto y comportamiento de Escape dentro de él.
  await page.click('#actionSubtask');
  await page.waitForTimeout(150);
  report.keyboard.escapeEnSubtaskInput = await (async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    return {
      subtaskInputStillPresent: await page.evaluate(() =>
        !!document.querySelector('#actionSubtasksContainer .subtask-input-wrapper')),
      actionModalStillOpen: await modalOpen(page, 'taskActionModal'),
    };
  })();
  await inDir('02-actions-subtask-input');

  // Escape con el modal de acciones abierto (comportamiento actual).
  report.keyboard.escapeWithActionModalOpen = await (async () => {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    return { actionModalStillOpen: await modalOpen(page, 'taskActionModal') };
  })();

  // "/" con el modal abierto.
  report.keyboard.slashWithModalOpen = await (async () => {
    await page.keyboard.press('/');
    await page.waitForTimeout(100);
    return {
      searchFocused: await page.evaluate(() => document.activeElement?.id === 'taskSearch'),
    };
  })();

  // Clic en el backdrop: ¿cierra?
  report.keyboard.backdropClickCloses = await (async () => {
    await page.mouse.click(5, 5);
    await page.waitForTimeout(150);
    return { actionModalStillOpen: await modalOpen(page, 'taskActionModal') };
  })();

  // Reabrir para capturar el modal de edición (encadenado acciones → edición).
  await page.click('#tasksContainer .task-wrapper:first-child .task');
  await page.waitForTimeout(250);
  await page.click('#actionEdit');
  await page.waitForTimeout(300);
  report.modals.edit = await measure(page, 'editModal');
  report.states.afterActionEditChain = await modalStates(page);
  await frames('editModal', '03-edit');
  await page.waitForTimeout(400);
  await inDir('03-edit');

  // ¿Las subtareas volvieron al wrapper al cerrar el modal de acciones?
  report.states.subtasksBackInWrapper = await page.evaluate(() =>
    document.querySelectorAll('#tasksContainer .task-wrapper:first-child .subtasks-container .subtask-item').length);

  await page.click('#cancelEditButton');
  await page.waitForTimeout(200);
  report.states.afterEditClose = await modalStates(page);

  // ── 3. Modal de donaciones ───────────────────────────────
  await page.click('#donateButton');
  await page.waitForTimeout(250);
  report.modals.donate = await measure(page, 'donateModal');
  await frames('donateModal', '04-donate');
  await page.waitForTimeout(400);
  await inDir('04-donate');
  await page.click('#donateModal .close-button');
  await page.waitForTimeout(200);
  report.states.afterDonateClose = await modalStates(page);

  // ── 4. Preferencia de movimiento reducido ─────────────────
  const reduced = await context.newPage();
  await reduced.emulateMedia({ reducedMotion: 'reduce' });
  await reduced.goto(`${BASE}/index.html`);
  await reduced.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
  await reduced.click('#openNewTaskModal');
  await reduced.waitForTimeout(120);
  report.reducedMotion = await reduced.evaluate(() => {
    const content = document.querySelector('#newTaskModal .modal-content');
    const style = getComputedStyle(content);
    return { animationName: style.animationName, animationDuration: style.animationDuration };
  });
  await reduced.close();

  await context.close();
  return report;
};

// ─── Main ──────────────────────────────────────────────────

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
