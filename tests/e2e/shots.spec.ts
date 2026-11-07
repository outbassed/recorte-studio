/** Capturas reais para documentação e inspeção visual (npm run shots). */
import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { openDemo, selectLayer, tab } from './helpers';

const DIR = 'docs/capturas';
const shot = (page: Page, name: string) => page.screenshot({ path: resolve(DIR, `${name}.png`) });
const at = async (page: Page, s: string) => {
  await page.getByTestId('time-input').fill(s);
  await page.getByTestId('time-input').press('Enter');
  await page.waitForTimeout(120);
};

test('desktop 1366×768: painéis', async ({ page }) => {
  await openDemo(page);
  await at(page, '1');
  await shot(page, 'desktop-1366-personagens');
  for (const t of ['backgrounds', 'objects', 'templates', 'scenes', 'layers', 'library', 'direction']) {
    await tab(page, t);
    await page.waitForTimeout(200);
    await shot(page, `desktop-1366-${t}`);
  }
  await selectLayer(page, 'Nina');
  await shot(page, 'desktop-1366-propriedades');
  await page.getByTestId('edit-library').click();
  await page.waitForTimeout(200);
  await shot(page, 'criador-corpo');
  await page.getByTestId('creator-tab-cabelo').click();
  await page.waitForTimeout(300);
  await shot(page, 'criador-cabelo');
  await page.getByTestId('creator-tab-roupas').click();
  await shot(page, 'criador-roupas');
  await page.getByTestId('creator-done').click();
  await page.getByTestId('open-export').click();
  await page.waitForTimeout(300);
  await shot(page, 'exportacao');
});

for (const [w, h] of [[1600, 900], [1920, 1080], [800, 600], [768, 1024]] as const) {
  test(`desktop/tablet ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openDemo(page);
    await at(page, '5');
    await shot(page, `tela-${w}x${h}`);
  });
}

for (const [w, h] of [[390, 844], [375, 667], [430, 932]] as const) {
  test(`mobile ${w}×${h}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await openDemo(page);
    await at(page, '1');
    await shot(page, `mobile-${w}x${h}`);
    await page.getByTestId('dock-characters').click();
    await page.waitForTimeout(200);
    await shot(page, `mobile-${w}x${h}-popup`);
    await page.getByTestId('dock-scenes').click();
    await page.waitForTimeout(200);
    await shot(page, `mobile-${w}x${h}-cenas`);
    await page.getByTestId('dock-layers').click();
    await page.locator('[data-testid="layer-row"][data-node-name="Zeca"] .layer-name').click();
    await page.getByTestId('dock-properties').click();
    await page.waitForTimeout(200);
    await shot(page, `mobile-${w}x${h}-propriedades`);
  });
}

test('mobile paisagem', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openDemo(page);
  await at(page, '1');
  await shot(page, 'mobile-paisagem');
  await page.getByTestId('dock-characters').click();
  await page.waitForTimeout(200);
  await shot(page, 'mobile-paisagem-popup');
});

test('vertical 9:16 e templates', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-testid="project-template-card"][data-template="vertical"]').click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await at(page, '5');
  await shot(page, 'projeto-vertical');
});

test('galeria de templates', async ({ page }) => {
  test.setTimeout(200000);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByTestId('new-project').click();
  await tab(page, 'templates');
  const rows = page.getByTestId('template-row');
  const n = await rows.count();
  for (let i = 0; i < n; i++) {
    const id = await rows.nth(i).getAttribute('data-template');
    await rows.nth(i).getByTestId('template-add').click();
    await at(page, '2,5');
    const stage = page.getByTestId('stage');
    await stage.screenshot({ path: resolve('test-results/templates', `${id}.png`) });
  }
});

test('referência: versão 0.4 antes da migração', async ({ page }) => {
  await page.goto(`file:///${resolve('legado/0.4/index.html').replace(/\\/g, '/')}`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: resolve(DIR, 'antes-0.4.png') });
});
