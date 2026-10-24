// ============================================================
// Tests de integración — toggle de tema (light / dark / auto)
// ============================================================

import { test, expect } from '@playwright/test';
import { gotoApp, addTask } from '../helpers/e2e.js';

const THEME_KEY = 'theme';
const BUTTON = '#themeToggleButton';

test.describe('Toggle de tema', () => {
  test('el botón existe y es visible', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator(BUTTON)).toBeVisible();
  });

  test('el click recorre el ciclo auto → light → dark → auto', async ({ page }) => {
    await gotoApp(page);

    // Estado inicial: auto (sin valor en storage)
    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'light');

    await page.click(BUTTON); // auto → light
    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'light');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('theme')))
      .toBe('light');

    await page.click(BUTTON); // light → dark
    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'dark');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('theme')))
      .toBe('dark');

    await page.click(BUTTON); // dark → auto (resuelto por el sistema)
    await expect.poll(() => page.evaluate(() => localStorage.getItem('theme')))
      .toBe('auto');
  });

  test('el tema forzado persiste tras recargar', async ({ page }) => {
    await gotoApp(page);
    await page.click(BUTTON); // auto → light
    await page.click(BUTTON); // light → dark

    await page.reload();
    await gotoApp(page);

    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'dark');
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('theme')))
      .toBe('dark');
  });

  test('el icono y el aria-label cambian con el estado', async ({ page }) => {
    await gotoApp(page);

    const aria = () => page.getAttribute(BUTTON, 'aria-label');
    const lightIcon = page.locator(`${BUTTON} [data-theme-icon="light"]`);
    const darkIcon  = page.locator(`${BUTTON} [data-theme-icon="dark"]`);
    const autoIcon  = page.locator(`${BUTTON} [data-theme-icon="auto"]`);

    // auto (arranque sin storage, sistema light en los browsers de test)
    await expect(autoIcon).toBeVisible();
    const labelAuto = await aria();

    await page.click(BUTTON); // light
    await expect(lightIcon).toBeVisible();
    await expect(autoIcon).toBeHidden();
    const labelLight = await aria();

    await page.click(BUTTON); // dark
    await expect(darkIcon).toBeVisible();
    await expect(lightIcon).toBeHidden();
    const labelDark = await aria();

    // Los tres estados se anuncian distinto (independiente del idioma)
    expect(labelLight).not.toBe(labelAuto);
    expect(labelDark).not.toBe(labelAuto);
    expect(labelDark).not.toBe(labelLight);
  });

  test('con tema oscuro forzado se aplican los colores dark', async ({ page }) => {
    await page.addInitScript((key) =>
      localStorage.setItem(key, 'dark'), THEME_KEY);
    await gotoApp(page);

    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'dark');

    // Variables base dark de base.css resueltas en estilos computados
    await expect.poll(async () =>
      page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor))
      .toBe('rgb(15, 15, 26)');
    await expect.poll(async () =>
      page.evaluate(() =>
        getComputedStyle(document.body).getPropertyValue('--maintxt').trim()))
      .toBe('#E8E6F0');

    // color-scheme efectivo acorde al tema forzado
    await expect.poll(async () =>
      page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
      .toBe('dark');
  });

  test('con tema claro forzado el color-scheme es light', async ({ page }) => {
    await page.addInitScript((key) =>
      localStorage.setItem(key, 'light'), THEME_KEY);
    await gotoApp(page);

    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'light');
    await expect.poll(async () =>
      page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
      .toBe('light');
  });

  test('con tema auto sigue al sistema y se actualiza sin recargar', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await gotoApp(page);

    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'light');

    // El sistema pasa a dark: el listener de matchMedia re-aplica
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'dark');

    // Vuelta a light sin recargar
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'light');
  });

  test('el tema forzado gana aunque el sistema prefiera otro esquema', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.addInitScript((key) =>
      localStorage.setItem(key, 'light'), THEME_KEY);
    await gotoApp(page);

    await expect(page.locator(':root')).toHaveAttribute('data-theme', 'light');
    await expect.poll(async () =>
      page.evaluate(() => getComputedStyle(document.documentElement).colorScheme))
      .toBe('light');
  });
});

test.describe('Date card — superficie por tema', () => {
  for (const theme of ['light', 'dark']) {
    test(`en tema ${theme} la card se distingue del wrapper`, async ({ page }) => {
      await page.addInitScript(([key, value]) =>
        localStorage.setItem(key, value), [THEME_KEY, theme]);
      await gotoApp(page);

      await expect(page.locator(':root')).toHaveAttribute('data-theme', theme);

      const colors = await page.evaluate(() => ({
        card: getComputedStyle(document.querySelector('.date')).backgroundColor,
        wrapper: getComputedStyle(document.querySelector('.list')).backgroundColor,
      }));

      expect(colors.card).not.toBe(colors.wrapper);
      expect(colors.card).not.toBe('rgba(0, 0, 0, 0)');
    });
  }
});

test.describe('Toggle de tema — layout a 360px', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('el botón y el header caben sin desbordar', async ({ page }) => {
    await gotoApp(page);
    await addTask(page, { text: 'Resumen' });

    const box = await page.locator(BUTTON).boundingBox();
    expect(box).not.toBeNull();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(360 + 1);

    // La card completa (con el resumen abajo) entra en el ancho.
    for (const sel of ['.date', '#daySummary']) {
      const b = await page.locator(sel).boundingBox();
      expect(b, `${sel} no se renderiza`).not.toBeNull();
      expect(b.x, `${sel} se sale por la izquierda`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, `${sel} se sale por la derecha`).toBeLessThanOrEqual(360 + 1);
    }

    await expect(page.locator('#daySummary')).toBeVisible();
    await expect.poll(async () =>
      page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(360 + 1);
  });
});
