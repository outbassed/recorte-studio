/**
 * Linha de base de LAYOUT (regressão visual): capturas e medidas das regiões principais do app, em computador
 * (1366×768) e celular (390×844). Roda contra qualquer build: LAYOUT_OUT define a pasta de saída e BASE_URL o app.
 * Uso típico: capturar o app ORIGINAL e o NOVO e comparar com tools/layout-diff.py.
 *   LAYOUT_OUT=docs/recortestudio/baseline/original BASE_URL=http://localhost:4174 npx playwright test --project=baseline
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT = resolve(process.env.LAYOUT_OUT ?? 'test-results/layout');
mkdirSync(OUT, { recursive: true });

const REGIONS: Record<string, string> = {
  header: 'header, [role="banner"]',
  leftPanel: '[aria-label="Biblioteca e cena"]',
  stage: '[data-testid="stage"]',
  properties: '[aria-label="Propriedades"]',
  timeline: '[data-testid="timeline"], .timeline',
  mobilePopup: '[data-testid="mobile-popup"]',
  mobileDock: '[data-testid="dock-more"]',
};

async function measure(page: Page): Promise<Record<string, { x: number; y: number; w: number; h: number } | null>> {
  const out: Record<string, { x: number; y: number; w: number; h: number } | null> = {};
  for (const [name, sel] of Object.entries(REGIONS)) {
    const box = await page.locator(sel).first().boundingBox({ timeout: 400 }).catch(() => null);
    out[name] = box ? { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) } : null;
  }
  return out;
}
const metrics: Record<string, unknown> = {};
async function snap(page: Page, name: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: resolve(OUT, `${name}.png`) });
  metrics[name] = await measure(page);
  writeFileSync(resolve(OUT, 'metrics.json'), JSON.stringify(metrics, null, 1));
}
const seek = async (page: Page, s: string) => {
  await page.getByTestId('time-input').fill(s);
  await page.getByTestId('time-input').press('Enter');
  await page.waitForTimeout(150);
};

test.describe('desktop 1366×768', () => {
  test.use({ viewport: { width: 1366, height: 768 } });
  test('telas principais', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('demo-project')).toBeVisible();
    await snap(page, 'desktop-01-inicio');
    await page.getByTestId('demo-project').click();
    await expect(page.getByTestId('stage')).toBeVisible();
    await seek(page, '1');
    await snap(page, 'desktop-02-studio-elenco');
    await page.getByTestId('tab-layers').click();
    await page.locator('[data-testid="layer-row"][data-node-name="Nina"] .layer-name').click();
    await page.getByTestId('insp-tab-transformar').click();
    await snap(page, 'desktop-03-inspetor-transformar');
    await page.getByTestId('insp-tab-pose').click();
    await snap(page, 'desktop-04-inspetor-pose');
    await page.locator('#insp-pane .section').last().scrollIntoViewIfNeeded(); // o fim da aba Pose (no app novo, termina com a seção IK recolhida)
    await snap(page, 'desktop-04b-inspetor-pose-fim');
    await page.getByTestId('insp-tab-rosto').click();
    await snap(page, 'desktop-05-inspetor-rosto');
    await page.getByTestId('tab-library').click();
    await snap(page, 'desktop-06-biblioteca');
  });
});

test.describe('celular 390×844', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('telas principais', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('demo-project')).toBeVisible();
    await snap(page, 'celular-01-inicio');
    await page.getByTestId('demo-project').tap();
    await expect(page.getByTestId('stage')).toBeVisible();
    await snap(page, 'celular-02-studio');
    await page.getByTestId('dock-more').tap();
    await page.getByTestId('more-layers').tap();
    await page.locator('[data-testid="layer-row"][data-node-name="Nina"] .layer-name').tap();
    await page.getByTestId('popup-close').tap();
    await page.getByTestId('quick-pose').tap();
    await snap(page, 'celular-03-pose');
  });
});
