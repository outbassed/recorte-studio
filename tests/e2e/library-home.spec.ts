/** Biblioteca principal na tela inicial e no editor, Toolbox do Studio e itens individuais compartilhados. */
import { expect, test, type Page } from '@playwright/test';
import { assertNoBodyOverflow, openDemo, tab, watchErrors } from './helpers';

const item = (page: Page, name: string) => page.locator(`[data-testid="library-item"][data-name="${name}"]`).first();

test('explorar sem projeto: busca, tipos, origens, detalhes completos e grade/lista', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByTestId('home-nav-library').click();
  await page.getByTestId('library-search').fill('FOGUEIRA');
  await expect(item(page, 'Fogueira')).toBeVisible();
  await item(page, 'Fogueira').click();
  const d = page.getByTestId('library-detail');
  await expect(d.getByTestId('library-origin')).toHaveText('Padrão');
  await expect(d.getByTestId('library-license')).toContainText('Original do Recorte Studio');
  await expect(d.getByTestId('library-anims')).toHaveText('Aceso, Apagando');
  await expect(d.getByTestId('catalog-views').locator('figure')).toHaveCount(2);
  // Item padrão: sem apagar/renomear; com copiar e editar cópia.
  await expect(d.getByTestId('library-delete')).toHaveCount(0);
  await expect(d.getByTestId('library-copy')).toBeVisible();
  await page.getByTestId('library-detail-close').click();
  await page.getByTestId('library-search').fill('');
  await page.locator('[data-testid="library-kinds"] [data-kind="character"]').click();
  const n = await page.getByTestId('library-item').count();
  expect(n).toBeGreaterThan(5);
  expect(await page.locator('[data-testid="library-item"]:not([data-kind="character"])').count()).toBe(0);
  await page.getByTestId('library-layout').click();
  await expect(page.locator('.libh-list')).toBeVisible();
  await page.getByTestId('library-layout').click();
  expect(errors).toEqual([]);
});

test('item individual: copiar, renomear, duplicar, favoritar e apagar sem projeto; aparece no Studio e vice-versa', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByTestId('home-nav-library').click();
  await page.getByTestId('library-search').fill('sofa');
  await item(page, 'Sofá').click();
  await page.getByTestId('library-copy').click();
  await expect(page.getByTestId('toasts')).toContainText('salvo na sua biblioteca');
  await page.getByTestId('library-search').fill('');
  await page.locator('[data-testid="library-origins"] [data-filter="mine"]').click();
  await expect(page.getByTestId('library-item')).toHaveCount(1);
  await item(page, 'Sofá (cópia)').click();
  await page.getByTestId('library-rename').click();
  await page.getByTestId('prompt-input').fill('Sofá da vovó');
  await page.getByTestId('prompt-ok').click();
  await expect(item(page, 'Sofá da vovó')).toBeVisible();
  await item(page, 'Sofá da vovó').click();
  await page.getByTestId('library-favorite').click();
  await expect(page.getByTestId('library-favorite')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('library-duplicate').click();
  await expect(page.getByTestId('library-item')).toHaveCount(2);

  // O item salvo na Biblioteca principal está no Studio.
  await page.getByTestId('home-nav-home').click();
  await page.getByTestId('new-project').first().click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await tab(page, 'objects');
  await page.locator('[data-testid="objects-panel"] [data-filter="mine"]').click();
  await expect(page.locator('[data-testid="obj-lib-row"][data-name="Sofá da vovó"]')).toHaveCount(1);
  await page.locator('[data-testid="obj-lib-row"][data-name="Sofá da vovó"] .card-main').click();
  await expect(page.locator('[data-testid="stage-svg"] [data-node-id]')).not.toHaveCount(0);

  // Algo salvo pelo Studio aparece na Biblioteca principal (sobre o editor) e dá para inserir de lá.
  await page.locator('[data-testid="my-object"][data-name="Sofá da vovó"]').getByTestId('catalog-details-open').click();
  await expect(page.getByTestId('catalog-save-lib')).toContainText('Atualizar');
  await page.keyboard.press('Escape');
  await page.locator('[data-testid="objects-panel"] [data-testid="open-library"]').click();
  await expect(page.getByTestId('library-home')).toBeVisible();
  await page.locator('[data-testid="library-origins"] [data-filter="project"]').click();
  await item(page, 'Sofá da vovó').click();
  const nodes = await page.locator('[data-testid="stage-svg"] [data-node-id]').count();
  await page.getByTestId('library-insert').click();
  await expect(page.getByTestId('library-home')).toHaveCount(0);
  await expect.poll(() => page.locator('[data-testid="stage-svg"] [data-node-id]').count()).toBeGreaterThan(nodes);

  // Apagar da biblioteca não mexe no projeto.
  await page.getByTestId('back-projects').click();
  await page.getByTestId('home-nav-library').click();
  await page.locator('[data-testid="library-origins"] [data-filter="mine"]').click();
  await item(page, 'Sofá da vovó (cópia)').click();
  await page.getByTestId('library-delete').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('library-item')).toHaveCount(1);
});

test('Toolbox do Studio: compacta, busca e insere; leva à Biblioteca completa e volta', async ({ page }) => {
  await openDemo(page);
  await tab(page, 'library');
  const tb = page.getByTestId('toolbox-panel');
  await expect(tb).toBeVisible();
  await expect(tb.getByTestId('packs-tab')).toHaveCount(0);
  await page.getByTestId('toolbox-search').fill('ventilador');
  await page.getByTestId('toolbox-kind').selectOption('object');
  const card = tb.locator('[data-name="Ventilador"] .card-main');
  await expect(card).toBeVisible();
  const before = await page.locator('[data-testid="stage-svg"] [data-obj-clip]').count();
  await card.click();
  await expect.poll(() => page.locator('[data-testid="stage-svg"] [data-obj-clip]').count()).toBe(before + 1);
  await page.getByTestId('toolbox-open-library').click();
  await expect(page.getByTestId('library-home')).toBeVisible();
  await page.getByTestId('library-close').click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect(page.getByTestId('toolbox-panel')).toBeVisible();
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('Biblioteca principal: busca, detalhes em tela cheia e fechar', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-nav-library').click();
    await page.getByTestId('library-search').fill('barco');
    await item(page, 'Barco').click();
    const d = page.getByTestId('library-detail');
    const b = (await d.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390.5);
    expect(b.y + b.height).toBeLessThanOrEqual(844.5);
    await expect(page.getByTestId('library-detail-close')).toBeVisible();
    await page.getByTestId('library-detail-close').click();
    await expect(d).toHaveCount(0);
    await assertNoBodyOverflow(page);
  });
});
