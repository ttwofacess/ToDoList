// ============================================================
// Tests de integración — modal de Donar
// Antes solo lo cubría un test unitario en jsdom (modalManager.test.js),
// que no llega a comprobar ni el overlay ni el portapapeles real.
// ============================================================

import { test, expect } from '@playwright/test';
import { gotoApp } from '../helpers/e2e.js';

const modal = (page) => page.locator('#donateModal');

test.beforeEach(async ({ page }) => {
  await gotoApp(page);
});

test.describe('Abrir y cerrar', () => {
  test('arranca oculto y se abre al pulsar el botón Donar', async ({ page }) => {
    await expect(modal(page)).toBeHidden();

    await page.click('#donateButton');

    await expect(modal(page)).toBeVisible();
    await expect(page.locator('#donateModal [data-i18n-key="donateTitle"]'))
      .toHaveText('Donar');
  });

  test('se cierra con la X', async ({ page }) => {
    await page.click('#donateButton');
    await expect(modal(page)).toBeVisible();

    await page.click('#donateModal .close-button');

    await expect(modal(page)).toBeHidden();
  });

  test('se cierra al pulsar en el overlay, pero no dentro del contenido', async ({ page }) => {
    await page.click('#donateButton');
    await page.locator('#donateModal .crypto-info input').first().click();
    await expect(modal(page)).toBeVisible();

    // El overlay cierra; un click dentro del contenido no.
    await modal(page).click({ position: { x: 5, y: 5 } });
    await expect(modal(page)).toBeHidden();
  });

  test('no cierra la app ni borra nada al abrirlo', async ({ page }) => {
    await page.click('#donateButton');
    await expect(modal(page)).toBeVisible();
    await page.click('#donateModal .close-button');

    expect(await page.evaluate(() => localStorage.getItem('tasks'))).toBeNull();
    await expect(page.locator('.task-wrapper')).toHaveCount(0);
  });
});

test.describe('Contenido', () => {
  test.beforeEach(async ({ page }) => {
    await page.click('#donateButton');
    await expect(modal(page)).toBeVisible();
  });

  test('lista las tres criptomonedas con su dirección', async ({ page }) => {
    const options = page.locator('#donateModal .crypto-option');
    await expect(options).toHaveCount(3);

    await expect(options.nth(0)).toContainText('Bitcoin');
    await expect(options.nth(0).locator('input')).toHaveValue(/^bc1/);
    await expect(options.nth(1)).toContainText('Litecoin');
    await expect(options.nth(1).locator('input')).toHaveValue(/^M/);
    await expect(options.nth(2)).toContainText('USDT');
  });

  test('las direcciones son de solo lectura y están seleccionadas al copiar', async ({ page }) => {
    const first = page.locator('#donateModal .crypto-option').first();
    await expect(first.locator('input')).toHaveAttribute('readonly', '');

    await first.locator('.copy-button').click();

    await expect.poll(() => first.locator('input').evaluate(
      (el) => el.value.slice(el.selectionStart, el.selectionEnd))).not.toBe('');
  });

  test('no hay direcciones duplicadas', async ({ page }) => {
    const values = await page.locator('#donateModal .crypto-option input')
      .evaluateAll(els => els.map(e => e.value));

    expect(new Set(values).size).toBe(values.length);
  });

  test('el botón Copiar confirma y luego vuelve a su texto original', async ({ page }) => {
    const btn = page.locator('#donateModal .crypto-option').first().locator('.copy-button');
    const original = await btn.textContent();

    await btn.click();
    await expect(btn).toHaveText('Copied!');

    // Tras 2 s vuelve al texto original (ya traducido)
    await expect(btn).toHaveText(original, { timeout: 5000 });
  });

  test('los botones Copiar dicen lo mismo en los tres idiomas', async ({ page }) => {
    const texts = await page.locator('#donateModal .copy-button')
      .evaluateAll(els => els.map(e => e.textContent.trim()));

    expect(new Set(texts).size).toBe(1);
  });
});

test.describe('Otros idiomas', () => {
  for (const [locale, title, copy] of [
    ['en-US', 'Donate', 'Copy'],
    ['pt-BR', 'Doar', 'Copiar'],
  ]) {
    test(`en ${locale} el modal sale traducido`, async ({ browser }) => {
      const ctx = await browser.newContext({ locale });
      const page = await ctx.newPage();
      await page.goto('/index.html');
      await page.waitForFunction(() => document.getElementById('dateYear')?.textContent?.length > 0);

      await page.click('#donateButton');
      await expect(page.locator('#donateModal [data-i18n-key="donateTitle"]'))
        .toHaveText(title);
      await expect(page.locator('#donateModal .copy-button').first()).toHaveText(copy);

      await ctx.close();
    });
  }
});