// ============================================================
// Tests de integración — búsqueda por texto libre
// (Playwright + servidor estático, DOM real, localStorage real)
// ============================================================

import { test, expect } from '@playwright/test';
import {
  gotoApp, addTask, taskTexts, readStorage, seedStorage, captureDialogs,
} from '../helpers/e2e.js';

// OJO al assertar:
// - taskTexts() devuelve TODAS las tareas, incluidas las ocultas por la búsqueda.
// - Un hasText sobre .task-wrapper también matchea subtareas ocultas por CSS.
// → Para "lo que ve el usuario" hay que usar el pseudo-clase :visible.

/** Textos de las tareas que el usuario ve ahora mismo, en orden. */
const visibleTexts = (page) =>
  page.locator('#tasksContainer .task-wrapper:visible .task-text').allTextContents();

/**
 * Espera a que la app haya pintado.
 *
 * Antes esperaba además a `navigator.serviceWorker.controller`, por si el SW
 * recargaba la página al reclamar el control. Ya no hace falta: el claim
 * inicial no recarga (updateNotifier.js ignora el primer `controllerchange`) y
 * estos tests no generan ninguna actualización. Se va porque era un punto de
 * espera que, bajo carga, podía bloquear hasta 15 s y cargar los timeouts.
 */
const waitForApp = async (page) => {
  await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);
};

/** Siembra tareas y recarga para que loadTasks() las renderice. */
const seed = async (page, tasks) => {
  await seedStorage(page, tasks);
  await page.reload();
  await waitForApp(page);
  await expect(page.locator('.task-wrapper')).toHaveCount(tasks.length);
};

/** Tarea de ejemplo con el shape que espera loadTasks(). */
const task = (text, extra = {}) => ({
  text, done: false, date: '01/01/2030', priority: 'low',
  subtasks: [], recurrence: 'none', lastCompleted: null, createdAt: '1',
  ...extra,
});

const PAN = task('Comprar pan', { subtasks: [{ text: 'en la panadería', done: false }] });
const CENA = task('Cocinar cena', { subtasks: [{ text: 'verduras frescas', done: false }] });
const CASA = task('Limpiar casa');

test.beforeEach(async ({ page }) => {
  await page.goto('/index.html');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await waitForApp(page);
});

test.describe('Filtrar por texto', () => {
  test('el buscador filtra por el texto del título', async ({ page }) => {
    await seed(page, [PAN, CENA, CASA]);

    await page.fill('#taskSearch', 'cena');

    expect(await visibleTexts(page)).toEqual(['Cocinar cena']);
    await expect(page.locator('.task-wrapper:visible')).toHaveCount(1);
  });

  test('el buscador filtra por el texto de una subtarea', async ({ page }) => {
    await seed(page, [PAN, CENA, CASA]);

    await page.fill('#taskSearch', 'verduras');

    expect(await visibleTexts(page)).toEqual(['Cocinar cena']);
  });

  test('la coincidencia por subtarea muestra la pista de por qué', async ({ page }) => {
    await seed(page, [CENA]);

    await page.fill('#taskSearch', 'verduras');

    await expect(page.locator('.search-hint')).toHaveText('↳ verduras frescas');
    await expect(page.locator('.search-hint')).toBeVisible();
  });

  test('la pista va debajo de la tarjeta, no encima', async ({ page }) => {
    await seed(page, [CENA, CASA]);

    await page.fill('#taskSearch', 'verduras');

    const hint = page.locator('.search-hint:visible');
    const card = page.locator('.task-wrapper:visible .task');
    const hintBox = await hint.boundingBox();
    const cardBox = await card.boundingBox();

    // Abajo de la tarjeta y dentro de su ancho
    expect(hintBox.y).toBeGreaterThanOrEqual(cardBox.y + cardBox.height - 1);
    expect(hintBox.x).toBeGreaterThanOrEqual(cardBox.x - 1);
    expect(hintBox.x + hintBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
  });

  test('ignora mayúsculas y tildes', async ({ page }) => {
    await seed(page, [task('Canción en el coche')]);

    await page.fill('#taskSearch', 'cancion');
    expect(await visibleTexts(page)).toEqual(['Canción en el coche']);

    await page.fill('#taskSearch', 'CANCIÓN');
    expect(await visibleTexts(page)).toEqual(['Canción en el coche']);
  });

  test('exige todos los términos escritos, aunque estén repartidos', async ({ page }) => {
    await seed(page, [PAN, CENA, CASA]);

    await page.fill('#taskSearch', 'comprar panadería');
    expect(await visibleTexts(page)).toEqual(['Comprar pan']);

    await page.fill('#taskSearch', 'cocinar verduras');
    expect(await visibleTexts(page)).toEqual(['Cocinar cena']);
  });

  test('sin resultados muestra el mensaje y no borra nada', async ({ page }) => {
    await seed(page, [PAN, CASA]);

    await page.fill('#taskSearch', 'zzzz');

    await expect(page.locator('#searchEmpty')).toBeVisible();
    await expect(page.locator('#searchEmpty')).toHaveText('Ninguna tarea coincide con tu búsqueda.');
    expect(await visibleTexts(page)).toEqual([]);
    // Las tareas siguen ahí, sólo ocultas
    expect(await taskTexts(page)).toEqual(['Comprar pan', 'Limpiar casa']);
  });

  test('al borrar la query vuelve la lista completa', async ({ page }) => {
    await seed(page, [PAN, CENA, CASA]);

    await page.fill('#taskSearch', 'cena');
    await page.fill('#taskSearch', '');

    expect(await visibleTexts(page)).toEqual(['Comprar pan', 'Cocinar cena', 'Limpiar casa']);
    await expect(page.locator('#searchEmpty')).toBeHidden();
  });
});

test.describe('Limpiar la búsqueda', () => {
  test('el botón "×" restaura la lista y oculta el mensaje vacío', async ({ page }) => {
    await seed(page, [PAN, CASA]);
    await page.fill('#taskSearch', 'zzzz');
    await expect(page.locator('#taskSearchClear')).toBeVisible();

    await page.click('#taskSearchClear');

    expect(await visibleTexts(page)).toEqual(['Comprar pan', 'Limpiar casa']);
    await expect(page.locator('#taskSearchClear')).toBeHidden();
    await expect(page.locator('#searchEmpty')).toBeHidden();
    await expect(page.locator('#taskSearch')).toHaveValue('');
  });

  test('el botón "×" sólo aparece cuando hay texto', async ({ page }) => {
    await seed(page, [PAN]);
    await expect(page.locator('#taskSearchClear')).toBeHidden();

    await page.fill('#taskSearch', 'p');
    await expect(page.locator('#taskSearchClear')).toBeVisible();

    await page.fill('#taskSearch', '');
    await expect(page.locator('#taskSearchClear')).toBeHidden();
  });

  test('la tecla Escape limpia la búsqueda', async ({ page }) => {
    await seed(page, [PAN, CASA]);

    await page.fill('#taskSearch', 'pan');
    expect(await visibleTexts(page)).toEqual(['Comprar pan']);

    await page.locator('#taskSearch').press('Escape');

    expect(await visibleTexts(page)).toEqual(['Comprar pan', 'Limpiar casa']);
    await expect(page.locator('#taskSearch')).toHaveValue('');
  });
});

test.describe('Combinación con el Modo Enfoque', () => {
  // Modo Enfoque = .filter-today-active, que usa display:flex con :has().
  // search.css usa display:none !important → la combinación es AND.
  test('con ambos activos sólo se ven las que cumplen los dos filtros', async ({ page }) => {
    const today = new Date().toLocaleDateString('es-ES');
    await seed(page, [
      task('Queso hoy',     { date: today, priority: 'high' }),   // Enfoque ✓ y búsqueda ✓
      task('Queso mañana',  { date: '01/01/2030', priority: 'low' }),  // sólo búsqueda ✓
      task('Pan hoy',       { date: today, priority: 'high' }),   // sólo Enfoque ✓
    ]);

    await page.click('.orderButton-wrapper .filterButton');   // Modo Enfoque
    await page.fill('#taskSearch', 'queso');                  // y luego la búsqueda

    expect(await visibleTexts(page)).toEqual(['Queso hoy']);
  });

  test('al quitar la búsqueda el Modo Enfoque sigue aplicando', async ({ page }) => {
    const today = new Date().toLocaleDateString('es-ES');
    await seed(page, [
      task('Con coincidencia', { date: today, priority: 'high' }),
      task('Otra',             { date: '01/01/2030', priority: 'low' }),
    ]);

    await page.click('.orderButton-wrapper .filterButton');
    await page.fill('#taskSearch', 'coincidencia');
    await page.fill('#taskSearch', '');

    expect(await visibleTexts(page)).toEqual(['Con coincidencia']);
  });
});

test.describe('La búsqueda con la lista en movimiento', () => {
  test('una tarea nueva que no coincide sale oculta', async ({ page }) => {
    await seed(page, [PAN]);
    await page.fill('#taskSearch', 'pan');
    expect(await visibleTexts(page)).toEqual(['Comprar pan']);

    await addTask(page, { text: 'Otra cosa' });

    expect(await visibleTexts(page)).toEqual(['Comprar pan']);
    expect(await taskTexts(page)).toHaveLength(2);
  });

  test('una tarea nueva que sí coincide sale visible', async ({ page }) => {
    await seed(page, [PAN]);
    await page.fill('#taskSearch', 'pan');

    await addTask(page, { text: 'Comprar pan y queso' });

    expect(await visibleTexts(page)).toEqual(['Comprar pan y queso', 'Comprar pan']);
  });

  test('editar el texto de una tarea reevalúa el filtro', async ({ page }) => {
    // Sin subtareas: si no, el renombrado seguiría coincidiendo por la subtarea
    await seed(page, [task('Comprar pan'), CASA]);
    await page.fill('#taskSearch', 'pan');
    expect(await visibleTexts(page)).toEqual(['Comprar pan']);

    // .task → modal de acciones → ✏️ Editar
    await page.locator('.task-wrapper:visible .task').click();
    await expect(page.locator('#taskActionModal')).toBeVisible();
    await page.click('#actionEdit');
    await page.fill('#editTaskText', 'Limpiar casa y cristales');
    await page.click('#editTaskForm button[type="submit"]');

    expect(await visibleTexts(page)).toEqual([]);
    await expect(page.locator('#searchEmpty')).toBeVisible();
  });

  test('borrar y deshacer con búsqueda activa respeta el filtro', async ({ page }) => {
    await seed(page, [PAN, CASA]);
    await page.fill('#taskSearch', 'pan');

    // Borrar "Comprar pan" (la única visible)
    await page.locator('.task-wrapper:visible .task').click();
    await page.click('#actionDelete');
    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    await expect(page.locator('#searchEmpty')).toBeVisible();

    await page.click('#undoButton');

    expect(await visibleTexts(page)).toEqual(['Comprar pan']);
    await expect(page.locator('#searchEmpty')).toBeHidden();
  });

  test('importar con búsqueda activa filtra la lista importada', async ({ page }) => {
    await seed(page, [CASA]);
    captureDialogs(page);
    await page.fill('#taskSearch', 'cena');

    await page.setInputFiles('#importInput', {
      name: 'backup.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([
        task('Cocinar cena'), task('Comprar queso'), task('Limpiar casa'),
      ])),
    });

    await expect(page.locator('.task-wrapper')).toHaveCount(3);
    expect(await visibleTexts(page)).toEqual(['Cocinar cena']);
  });
});

// ── Presentaciones cuando la lista no tiene nada que mostrar ──
test.describe('Estados vacíos', () => {
  /** Qué bloque está viendo el usuario ahora mismo. */
  const notices = (page) => page.evaluate(() => ({
    empty:  !document.getElementById('emptyState').hidden,
    search: !document.getElementById('searchEmpty').hidden,
    filter: !document.getElementById('filterEmpty').hidden,
  }));

  test('con la lista vacía aparece el empty state ilustrado y traducido', async ({ page }) => {
    await expect(page.locator('#emptyState')).toBeVisible();
    await expect(page.locator('.empty-state-title')).toHaveText('Tu lista está vacía');
    await expect(page.locator('.empty-state-text')).toHaveText('Añade tu primera tarea para empezar.');
    await expect(page.locator('.empty-state-image')).toBeVisible();
    expect(await notices(page)).toEqual({ empty: true, search: false, filter: false });
  });

  test('el empty state no cuenta como tarea ni se persiste', async ({ page }) => {
    await expect(page.locator('#emptyState')).toBeVisible();
    await expect(page.locator('#tasksContainer .task-wrapper')).toHaveCount(0);
    await expect(page.locator('#tasksContainer > *')).toHaveCount(0);
    expect(await readStorage(page)).toEqual([]);
  });

  test('al crear la primera tarea el empty state desaparece', async ({ page }) => {
    await expect(page.locator('#emptyState')).toBeVisible();

    await addTask(page, { text: 'Comprar pan' });

    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    await expect(page.locator('#emptyState')).toBeHidden();
  });

  test('borrar la última tarea lo devuelve y deshacerlo lo oculta', async ({ page }) => {
    await addTask(page, { text: 'Comprar pan' });
    await expect(page.locator('#emptyState')).toBeHidden();

    await page.locator('.task-wrapper .task').click();
    await page.click('#actionDelete');
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
    await expect(page.locator('#emptyState')).toBeVisible();

    await page.click('#undoButton');
    await expect(page.locator('.task-wrapper')).toHaveCount(1);
    await expect(page.locator('#emptyState')).toBeHidden();
  });

  test('importar una lista vacía muestra el empty state', async ({ page }) => {
    await seed(page, [PAN]);
    await expect(page.locator('#emptyState')).toBeHidden();

    captureDialogs(page);
    await page.setInputFiles('#importInput', {
      name: 'backup.json', mimeType: 'application/json',
      buffer: Buffer.from('[]'),
    });

    await expect(page.locator('.task-wrapper')).toHaveCount(0);
    await expect(page.locator('#emptyState')).toBeVisible();
  });

  test('con tareas guardadas y búsqueda sin coincidencias gana #searchEmpty', async ({ page }) => {
    await seed(page, [PAN, CASA]);
    await page.fill('#taskSearch', 'zzzz');

    await expect(page.locator('#searchEmpty')).toBeVisible();
    await expect(page.locator('#emptyState')).toBeHidden();
    await expect(page.locator('#filterEmpty')).toBeHidden();
  });

  test('con la lista vacía y búsqueda activa tampoco aparece el empty state', async ({ page }) => {
    await page.fill('#taskSearch', 'zzzz');

    expect(await notices(page)).toEqual({ empty: false, search: true, filter: false });
  });

  test('una consulta de sólo espacios no activa la búsqueda', async ({ page }) => {
    await page.fill('#taskSearch', '   ');

    await expect(page.locator('#searchEmpty')).toBeHidden();
    await expect(page.locator('#emptyState')).toBeVisible();
  });

  test('limpiar la búsqueda deja la lista tal cual estaba', async ({ page }) => {
    await seed(page, [PAN, CASA]);
    await page.fill('#taskSearch', 'zzzz');
    await expect(page.locator('#searchEmpty')).toBeVisible();

    await page.click('#taskSearchClear');

    expect(await notices(page)).toEqual({ empty: false, search: false, filter: false });
    expect(await visibleTexts(page)).toEqual(['Comprar pan', 'Limpiar casa']);
  });

  test('el Modo Enfoque sin tareas visibles muestra su propio aviso', async ({ page }) => {
    // Ni vence hoy ni es de prioridad alta: el Modo Enfoque la oculta.
    await seed(page, [task('Para otro día', { priority: 'medium' })]);
    await expect(page.locator('.task-wrapper:visible')).toHaveCount(1);

    await page.click('.orderButton-wrapper .filterButton');

    await expect(page.locator('#filterEmpty')).toBeVisible();
    await expect(page.locator('#filterEmpty'))
      .toHaveText('No hay tareas para mostrar con este filtro.');
    await expect(page.locator('.task-wrapper:visible')).toHaveCount(0);
    expect(await notices(page)).toEqual({ empty: false, search: false, filter: true });

    await page.click('.orderButton-wrapper .filterButton');

    await expect(page.locator('#filterEmpty')).toBeHidden();
    await expect(page.locator('.task-wrapper:visible')).toHaveCount(1);
  });

  test('con Modo Enfoque y una tarea de hoy no hay ningún aviso', async ({ page }) => {
    const today = new Date().toLocaleDateString('es-ES');
    await seed(page, [task('Para hoy', { date: today })]);

    await page.click('.orderButton-wrapper .filterButton');

    await expect(page.locator('.task-wrapper:visible')).toHaveCount(1);
    expect(await notices(page)).toEqual({ empty: false, search: false, filter: false });
  });

  test('la búsqueda activa manda sobre el Modo Enfoque', async ({ page }) => {
    await seed(page, [task('Para otro día', { priority: 'medium' })]);
    await page.click('.orderButton-wrapper .filterButton');
    await expect(page.locator('#filterEmpty')).toBeVisible();

    await page.fill('#taskSearch', 'zzzz');

    await expect(page.locator('#searchEmpty')).toBeVisible();
    expect(await notices(page)).toEqual({ empty: false, search: true, filter: false });
  });

  test('los estados vacíos no añaden nada enfocado al recorrido del teclado', async ({ page }) => {
    // Lista vacía: el empty state está visible, pero no aporta nada enfocable.
    await expect(page.locator('#emptyState')).toBeVisible();
    await expect(page.locator('#emptyState button, #emptyState a, #emptyState input')).toHaveCount(0);

    // Con una tarea que el Modo Enfoque oculta se ven los dos avisos en el DOM
    // (nunca visibles a la vez) y se comprueba el alt decorativo.
    await seed(page, [task('Para otro día', { priority: 'medium' })]);
    await page.click('.orderButton-wrapper .filterButton');
    await expect(page.locator('#filterEmpty')).toBeVisible();

    // La ilustración es decorativa (el título y el texto ya dicen lo mismo) y
    // los dos avisos de texto son los que anuncian por role=status.
    await expect(page.locator('.empty-state-image')).toHaveAttribute('alt', '');
    await expect(page.locator('#searchEmpty')).toHaveAttribute('role', 'status');
    await expect(page.locator('#filterEmpty')).toHaveAttribute('role', 'status');

    // Ni controles nuevos: del buscador se sale por donde se salía antes, a
    // por el siguiente botón (las tarjetas de tarea nunca fueron enfocables).
    await page.locator('#taskSearch').focus();
    await page.keyboard.press('Tab');
    await expect(page.locator('#donateButton')).toBeFocused();
  });
});

test.describe('La tarea abierta en el modal', () => {
  test('si coincide sólo por subtarea, sigue visible mientras el modal está abierto', async ({ page }) => {
    await seed(page, [CENA, CASA]);
    await page.fill('#taskSearch', 'verduras');
    expect(await visibleTexts(page)).toEqual(['Cocinar cena']);

    // Al abrir el modal, las subtareas salen del wrapper (y la búsqueda
    // dejaría de encontrarlas si no se respetara data-active-modal)
    await page.locator('.task-wrapper:visible .task').click();
    await expect(page.locator('#taskActionModal')).toBeVisible();

    expect(await visibleTexts(page)).toEqual(['Cocinar cena']);
    await expect(page.locator('.task-wrapper:visible')).toHaveCount(1);
  });

  test('al borrar la subtarea que coincidía, la tarea no desaparece hasta cerrar', async ({ page }) => {
    await seed(page, [CENA, CASA]);
    await page.fill('#taskSearch', 'verduras');

    await page.locator('.task-wrapper:visible .task').click();
    await expect(page.locator('#taskActionModal')).toBeVisible();

    // Ya no hay coincidencia, pero el modal está abierto: no debe ocultarse
    await page.click('#actionSubtasksContainer .subtask-delete');

    expect(await visibleTexts(page)).toEqual(['Cocinar cena']);
    await expect(page.locator('#taskActionModal')).toBeVisible();

    // Al cerrar el modal, la búsqueda vuelve a aplicarse
    await page.click('#closeActionModal');

    expect(await visibleTexts(page)).toEqual([]);
    await expect(page.locator('#searchEmpty')).toBeVisible();
  });

  test('la subtarea borrada no se pierde al guardar', async ({ page }) => {
    await seed(page, [CENA]);
    await page.fill('#taskSearch', 'verduras');
    await page.locator('.task-wrapper:visible .task').click();
    await page.click('#actionSubtasksContainer .subtask-delete');
    await page.click('#closeActionModal');

    expect((await readStorage(page))[0].subtasks).toEqual([]);
  });
});

test.describe('Con búsqueda activa no se puede arrastrar', () => {
  /** Dispara un dragstart nativo y devuelve si se canceló. */
  const dragStart = (page) => page.evaluate(() => {
    const wrapper = document.querySelector('#tasksContainer .task-wrapper');
    const ev = new DragEvent('dragstart', { bubbles: true, cancelable: true });
    wrapper.dispatchEvent(ev);
    return { prevented: ev.defaultPrevented, dragging: wrapper.classList.contains('dragging') };
  });

  test('sin búsqueda, arrastrar sí reordena', async ({ page }) => {
    await seed(page, [PAN, CASA]);

    await page.locator('.task-wrapper', { hasText: 'Limpiar casa' })
      .dragTo(page.locator('.task-wrapper', { hasText: 'Comprar pan' }));

    await expect.poll(() => readStorage(page).then(t => t.map(x => x.text)))
      .toEqual(['Limpiar casa', 'Comprar pan']);
  });

  test('el dragstart se cancela y la lista no se reordena', async ({ page }) => {
    await seed(page, [PAN, CASA]);
    const before = (await readStorage(page)).map(t => t.text);

    await page.fill('#taskSearch', 'casa');
    expect(await dragStart(page)).toEqual({ prevented: true, dragging: false });

    await page.locator('.task-wrapper:visible').dragTo(
      page.locator('.task-wrapper:visible'), { force: true });

    expect((await readStorage(page)).map(t => t.text)).toEqual(before);
  });

  test('al limpiar la búsqueda el arrastre vuelve a funcionar', async ({ page }) => {
    await seed(page, [PAN, CASA]);

    await page.fill('#taskSearch', 'casa');
    expect(await dragStart(page)).toEqual({ prevented: true, dragging: false });

    await page.click('#taskSearchClear');
    expect(await dragStart(page)).toEqual({ prevented: false, dragging: true });
  });
});

test.describe('La búsqueda es sólo vista', () => {
  test('buscar no modifica localStorage', async ({ page }) => {
    await seed(page, [PAN, CENA, CASA]);
    const before = await readStorage(page);

    await page.fill('#taskSearch', 'verduras');
    expect(await visibleTexts(page)).toEqual(['Cocinar cena']);

    expect(await readStorage(page)).toEqual(before);
  });

  test('exportar sigue exportando TODAS las tareas, no sólo las visibles', async ({ page }) => {
    await seed(page, [PAN, CENA, CASA]);
    await page.fill('#taskSearch', 'cena');
    expect(await visibleTexts(page)).toEqual(['Cocinar cena']);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-action="export"]'),
    ]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));

    expect(parsed).toHaveLength(3);
    expect(parsed.map(t => t.text)).toEqual(['Comprar pan', 'Cocinar cena', 'Limpiar casa']);
  });

  test('la búsqueda no se persiste: al recargar vuelve a estar vacía', async ({ page }) => {
    await seed(page, [PAN, CASA]);
    await page.fill('#taskSearch', 'pan');
    expect(await visibleTexts(page)).toEqual(['Comprar pan']);

    await page.reload();
    await waitForApp(page);

    await expect(page.locator('#taskSearch')).toHaveValue('');
    expect(await visibleTexts(page)).toEqual(['Comprar pan', 'Limpiar casa']);
  });
});

test.describe('Resaltado de coincidencias', () => {
  test('marca la coincidencia en el título', async ({ page }) => {
    await seed(page, [PAN]);

    await page.fill('#taskSearch', 'pan');

    await expect(page.locator('.task-text mark')).toHaveText('pan');
  });

  test('marca el texto original, con su tilde', async ({ page }) => {
    await seed(page, [task('Canción en el coche')]);

    await page.fill('#taskSearch', 'cancion');

    await expect(page.locator('.task-text mark')).toHaveText('Canción');
  });

  test('la tarea que coincide sólo por subtarea no marca el título', async ({ page }) => {
    await seed(page, [CENA]);

    await page.fill('#taskSearch', 'verduras');

    await expect(page.locator('.task-text mark')).toHaveCount(0);
    await expect(page.locator('.search-hint')).toHaveText('↳ verduras frescas');
  });

  test('la pista no rompe el indicador de drop del drag & drop', async ({ page }) => {
    await seed(page, [CENA]);

    await page.fill('#taskSearch', 'verduras');

    // El ::after del wrapper es el puntito del drag & drop: la pista ya no
    // lo pisa (antes lo pisaba y el texto salía flotando arriba de la tarea).
    const after = await page.evaluate(() => {
      const wrapper = document.querySelector('.task-wrapper');
      const cs = getComputedStyle(wrapper, '::after');
      return { content: cs.content, position: cs.position, width: cs.width, height: cs.height };
    });

    expect(after.content).toBe('""');
    expect(after.position).toBe('absolute');
    expect(after.width).toBe('7px');
    expect(after.height).toBe('7px');
  });

  test('al limpiar la búsqueda el título vuelve a su texto exacto', async ({ page }) => {
    await seed(page, [PAN]);

    await page.fill('#taskSearch', 'pan');
    await expect(page.locator('.task-text mark')).toHaveCount(1);

    await page.fill('#taskSearch', '');

    await expect(page.locator('.task-text mark')).toHaveCount(0);
    expect(await taskTexts(page)).toEqual(['Comprar pan']);
  });

  test('resaltar no dispara un bucle de re-render', async ({ page }) => {
    await seed(page, [PAN]);

    await page.fill('#taskSearch', 'pan');
    await page.waitForTimeout(300);

    await expect(page.locator('.task-text mark')).toHaveCount(1);
    expect(await taskTexts(page)).toEqual(['Comprar pan']);
  });

  test('con la búsqueda activa editar y guardar no deja artefactos', async ({ page }) => {
    await seed(page, [task('Comprar pan y queso'), CASA]);
    await page.fill('#taskSearch', 'pan');
    await expect(page.locator('.task-text mark')).toHaveText('pan');

    // El modal de edición tiene que mostrar el texto plano, no el marcado
    await page.locator('.task-wrapper:visible .task').click();
    await page.click('#actionEdit');
    await expect(page.locator('#editTaskText')).toHaveValue('Comprar pan y queso');
    await page.click('#editTaskForm button[type="submit"]');

    // Y lo que se guarda es el texto original
    expect((await readStorage(page))[0].text).toBe('Comprar pan y queso');
  });
});

test.describe('Contador de resultados', () => {
  test('muestra cuántas tareas coinciden de cuántas hay', async ({ page }) => {
    await seed(page, [PAN, CENA, CASA]);

    await page.fill('#taskSearch', 'pan');

    await expect(page.locator('#searchCount')).toBeVisible();
    await expect(page.locator('#searchCount')).toHaveText('1 de 3 tareas coinciden');
  });

  test('con una sola tarea en total usa el singular', async ({ page }) => {
    await seed(page, [PAN]);

    await page.fill('#taskSearch', 'pan');

    await expect(page.locator('#searchCount')).toHaveText('1 de 1 tarea coincide');
  });

  test('sin coincidencias el contador se oculta', async ({ page }) => {
    await seed(page, [PAN]);

    await page.fill('#taskSearch', 'zzzz');

    await expect(page.locator('#searchCount')).toBeHidden();
    await expect(page.locator('#searchEmpty')).toBeVisible();
  });

  test('al limpiar la búsqueda el contador desaparece', async ({ page }) => {
    await seed(page, [PAN, CENA]);

    await page.fill('#taskSearch', 'pan');
    await expect(page.locator('#searchCount')).toBeVisible();

    await page.fill('#taskSearch', '');

    await expect(page.locator('#searchCount')).toBeHidden();
  });
});

test.describe('Atajos de teclado', () => {
  test('"/" enfoca el buscador', async ({ page }) => {
    await seed(page, [PAN]);

    await page.keyboard.press('/');

    await expect(page.locator('#taskSearch')).toBeFocused();
  });

  test('Ctrl+K enfoca el buscador', async ({ page }) => {
    await seed(page, [PAN]);

    await page.keyboard.press('Control+k');

    await expect(page.locator('#taskSearch')).toBeFocused();
  });

  test('Ctrl+K con el buscador enfocado y con texto limpia la búsqueda', async ({ page }) => {
    await seed(page, [PAN, CASA]);
    await page.fill('#taskSearch', 'pan');
    await page.locator('#taskSearch').focus();

    await page.keyboard.press('Control+k');

    await expect(page.locator('#taskSearch')).toHaveValue('');
    expect(await visibleTexts(page)).toEqual(['Comprar pan', 'Limpiar casa']);
  });

  test('"/" no interfiere con lo que se está escribiendo en un modal', async ({ page }) => {
    await seed(page, [PAN]);

    await page.click('#openNewTaskModal');
    await expect(page.locator('#newTaskModal')).toBeVisible();
    await expect(page.locator('#newTaskForm input[name="taskText"]')).toBeFocused();

    await page.keyboard.press('/');

    await expect(page.locator('#newTaskForm input[name="taskText"]')).toHaveValue('/');
    await expect(page.locator('#taskSearch')).not.toBeFocused();
  });
});

test.describe('El botón "×"', () => {
  test('aparece con una animación de entrada al escribir', async ({ page }) => {
    await seed(page, [PAN]);

    await page.fill('#taskSearch', 'pan');

    await expect(page.locator('#taskSearchClear')).toBeVisible();
    const animation = await page.locator('#taskSearchClear')
      .evaluate(el => getComputedStyle(el).animationName);
    expect(animation).toBe('search-clear-in');
  });
});

test.describe('Robustez', () => {
  test('el flujo completo de búsqueda no produce errores de consola', async ({ page }) => {
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await seed(page, [PAN, CENA, CASA]);

    await page.fill('#taskSearch', 'cena');
    await page.fill('#taskSearch', 'verduras');
    await page.fill('#taskSearch', 'zzz');
    await page.locator('#taskSearch').press('Escape');
    await addTask(page, { text: 'Comprar pan y queso' });
    // Con la búsqueda vacía están visibles las 4 tareas
    await page.locator('.task-wrapper:visible .task').first().click();
    await page.click('#actionSubtask');
    await page.fill('#actionSubtasksContainer .subtask-input', 'harina');
    await page.click('#actionSubtasksContainer .subtask-input-wrapper button >> nth=0');
    await page.click('#closeActionModal');
    await expect(page.locator('#taskActionModal')).toBeHidden();
    await page.fill('#taskSearch', 'harina');
    await page.waitForTimeout(300);

    expect(await visibleTexts(page)).toEqual(['Comprar pan y queso']);
    expect(errors).toEqual([]);
  });

  test('el buscador es accesible por teclado y anuncia el mensaje vacío', async ({ page }) => {
    await seed(page, [PAN, CASA]);

    // El label oculto da nombre accesible al input
    await expect(page.locator('label[for="taskSearch"]')).toHaveText('Buscar');
    await expect(page.locator('#taskSearch')).toHaveAttribute('placeholder', 'Buscar en tareas y subtareas…');
    await expect(page.locator('#searchEmpty')).toHaveAttribute('role', 'status');
    await expect(page.locator('#searchEmpty')).toHaveAttribute('aria-live', 'polite');

    // Tab alcanza el input desde el botón de Modo Enfoque.
    // OJO: .filterButton también la usan los modales, así que hay que concretarlo.
    // Recorrido: Exportar → Instalar → #taskSearch
    await page.locator('.orderButton-wrapper .filterButton').focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator('#taskSearch')).toBeFocused();

    // Se puede escribir y limpiar sin ratón
    await page.keyboard.type('pan');
    expect(await visibleTexts(page)).toEqual(['Comprar pan']);
    await page.keyboard.press('Escape');
    expect(await visibleTexts(page)).toEqual(['Comprar pan', 'Limpiar casa']);

    // El botón "×" tiene nombre accesible (viene de t(), no de data-i18n-key)
    await page.fill('#taskSearch', 'p');
    await expect(page.locator('#taskSearchClear')).toHaveAttribute('aria-label', 'Borrar búsqueda');
  });
});
