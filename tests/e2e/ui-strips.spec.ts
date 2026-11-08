/** Faixas horizontais (abas do Inspector, filtros do catálogo): tudo alcançável, barra/setas visíveis, item ativo à vista. */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { assertNoBodyOverflow, openDemo, selectLayer } from './helpers';

/** O elemento está inteiro dentro da área visível da faixa? */
const insideStrip = async (strip: Locator, el: Locator) => {
  const s = await strip.elementHandle();
  return el.evaluate((node, sn) => {
    const a = node.getBoundingClientRect();
    const b = (sn as Element).getBoundingClientRect();
    return a.left >= b.left - 1 && a.right <= b.right + 1;
  }, s);
};
const scrollLeft = (l: Locator) => l.evaluate((n) => (n as HTMLElement).scrollLeft);
const pageScroll = (page: Page) => page.evaluate(() => [window.scrollX, window.scrollY, document.scrollingElement?.scrollLeft ?? 0]);

for (const vp of [{ width: 1024, height: 700 }, { width: 320, height: 640 }, { width: 390, height: 844 }]) {
  test.describe(`${vp.width}×${vp.height}`, () => {
    test.use({ viewport: vp, hasTouch: vp.width < 600 });

    test('Inspector: última aba alcançável por seta, teclado e roda; aba ativa sempre à vista', async ({ page }) => {
      await openDemo(page);
      if (vp.width < 600) {
        await page.getByTestId('dock-more').click();
        await page.getByTestId('more-layers').click();
        await page.locator('[data-testid="layer-row"][data-node-name="Nina"] .layer-name').click();
        await page.getByTestId('popup-close').click();
        await page.getByTestId('dock-properties').click();
      } else await selectLayer(page, 'Nina');
      const strip = page.getByTestId('insp-tabs');
      const tabs = strip.getByRole('tab');
      const last = tabs.last();
      const n = await tabs.count();
      expect(n).toBeGreaterThan(3);
      const over = await strip.evaluate((s) => s.scrollWidth > s.clientWidth + 1);
      if (over) {
        // Setas visíveis; a da esquerda começa desabilitada (já está no início).
        await expect(page.getByTestId('insp-tabs-right')).toBeEnabled();
        await expect(page.getByTestId('insp-tabs-left')).toBeDisabled();
        expect(await insideStrip(strip, last)).toBe(false);
        // Seta da direita até a última aba aparecer.
        for (let i = 0; i < 6 && !(await insideStrip(strip, last)); i++) {
          await page.getByTestId('insp-tabs-right').click();
          await page.waitForTimeout(350);
        }
        expect(await insideStrip(strip, last)).toBe(true);
        await expect(page.getByTestId('insp-tabs-right')).toBeDisabled();
        await last.click();
        await expect(last).toHaveAttribute('aria-selected', 'true');
        await expect(page.locator('#insp-pane')).toHaveAttribute('data-tab', (await last.textContent())!.trim());
        // Teclado: volta à primeira (seta direita na última dá a volta) e ela aparece.
        await last.focus();
        await page.keyboard.press('ArrowRight');
        await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
        await expect.poll(() => insideStrip(strip, tabs.first())).toBe(true);
        // Roda do mouse vertical anda na horizontal (desktop).
        if (vp.width >= 600) {
          await strip.hover();
          const before = await scrollLeft(strip);
          await page.mouse.wheel(0, 240);
          await expect.poll(() => scrollLeft(strip)).toBeGreaterThan(before);
        }
      } else {
        // Sem excesso: nenhuma seta e a última aba já está à vista.
        await expect(page.getByTestId('insp-tabs-right')).toHaveCount(0);
        expect(await insideStrip(strip, last)).toBe(true);
      }
      expect(await pageScroll(page)).toEqual([0, 0, 0]);
      await assertNoBodyOverflow(page);
    });

    test('Catálogo: último filtro alcançável, clique não vira arrasto, filtro ativo à vista', async ({ page }) => {
      await openDemo(page);
      if (vp.width < 600) await page.getByTestId('dock-characters').click();
      else await page.getByTestId('tab-characters').click();
      const strip = page.getByTestId('catalog-filters');
      const lastChip = strip.locator('[data-filter="project"]');
      const over = await strip.evaluate((s) => s.scrollWidth > s.clientWidth + 1);
      if (over) {
        await expect(page.getByTestId('catalog-filters-right')).toBeVisible();
        for (let i = 0; i < 6 && !(await insideStrip(strip, lastChip)); i++) {
          await page.getByTestId('catalog-filters-right').click();
          await page.waitForTimeout(350);
        }
      }
      expect(await insideStrip(strip, lastChip)).toBe(true);
      await lastChip.click();
      await expect(lastChip).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-testid="characters-panel"] [data-origin="project"]').first()).toBeVisible();
      // Volta ao primeiro filtro pelo teclado (Tab/Shift+Tab focam e trazem à vista).
      const first = strip.locator('[data-filter="all"]');
      await first.focus();
      await expect.poll(() => insideStrip(strip, first)).toBe(true);
      await first.click();
      await expect(first).toHaveAttribute('aria-pressed', 'true');
      // Busca continua funcionando com a faixa rolada.
      await page.getByTestId('char-search').fill('zeca');
      await expect(page.locator('[data-name="Zeca"]').first()).toBeVisible();
      expect(await pageScroll(page)).toEqual([0, 0, 0]);
      await assertNoBodyOverflow(page);
    });
  });
}

test('barra de rolagem fina é visível (não escondida) nas faixas', async ({ page }) => {
  await openDemo(page);
  await page.getByTestId('tab-characters').click();
  const style = await page.getByTestId('catalog-filters').evaluate((s) => getComputedStyle(s).scrollbarWidth);
  expect(style).toBe('thin');
});
