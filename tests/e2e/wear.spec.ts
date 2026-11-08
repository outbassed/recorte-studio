/** Fase 3b: Criadores de Roupas e Cabelos com manequim — criar, vestir, vistas, biblioteca, reabrir e exportar. */
import { expect, test, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { OUT, openDemo, pngInfo, saveDownload, selectLayer, tab, waitSaved, watchErrors } from './helpers';

const stageWear = (page: Page) => page.locator('[data-testid="stage-svg"] [data-wear-layer]');
const stageText = (page: Page) => page.locator('[data-testid="stage-svg"] text').allTextContents();

async function createWear(page: Page, kind: 'clothing' | 'hair', name: string) {
  await tab(page, 'characters');
  await page.getByTestId(kind === 'hair' ? 'create-hair' : 'create-clothing').click();
  await page.getByTestId('prompt-input').fill(name);
  await page.getByTestId('prompt-ok').click();
  await expect(page.getByTestId('wear-creator')).toBeVisible();
}

test('roupa com texto e cabelo: criar no manequim, vistas, vestir na Nina, biblioteca, reabrir e exportar PNG', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await openDemo(page);
  await selectLayer(page, 'Nina');
  const before = await stageWear(page).count();
  expect(before).toBe(0);

  // Roupa: camiseta (ponto de partida) + texto "TRAQUINA" na camada do tronco.
  await createWear(page, 'clothing', 'Camiseta Traquina');
  await expect(page.getByTestId('wear-big').locator('[data-wear-layer]').first()).toBeAttached();
  await page.getByTestId('wear-studio-tab-add').click();
  await page.getByTestId('add-text-piece').click();
  await page.getByTestId('piece-text').fill('TRAQUINA');
  await expect(page.getByTestId('wear-big').locator('text')).toContainText('TRAQUINA');
  // 8 vistas na faixa; trocar a vista principal.
  await expect(page.getByTestId('wear-views').locator('li')).toHaveCount(8);
  await page.getByTestId('wear-view-back').click();
  await expect(page.getByTestId('wear-big')).toHaveAttribute('data-view', 'back');
  await page.getByTestId('wear-view-front').click();
  // Experimentar em outro corpo (criança) não muda o personagem real.
  await page.getByTestId('wear-model').selectOption('mq:crianca');
  await expect(page.getByTestId('wear-big').locator('text')).toContainText('TRAQUINA');
  await page.screenshot({ path: resolve('docs/capturas/criador-roupas.png') });
  expect(await stageWear(page).count()).toBe(0);

  await page.getByTestId('wear-save-lib').click();
  await expect(page.getByTestId('toasts')).toContainText('salvo na sua biblioteca');
  await page.getByTestId('wear-apply').click();
  await expect(page.getByTestId('toasts')).toContainText('agora usa "Camiseta Traquina"');
  await page.getByTestId('wear-creator-close').click();
  await expect.poll(() => stageWear(page).count()).toBeGreaterThan(0);
  await expect.poll(() => stageText(page)).toEqual(expect.arrayContaining(['TRAQUINA']));

  // Cabelo: curto, aplicado, aparece no palco; desfazer tira, refazer devolve.
  const withShirt = await stageWear(page).count();
  await createWear(page, 'hair', 'Cabelo da Nina');
  await page.getByTestId('wear-view-left').click();
  await page.screenshot({ path: resolve('docs/capturas/criador-cabelos.png') });
  await page.getByTestId('wear-apply').click();
  await page.getByTestId('wear-creator-close').click();
  await expect.poll(() => stageWear(page).count()).toBeGreaterThan(withShirt);
  const withHair = await stageWear(page).count();
  await page.getByTestId('undo').click();
  await expect.poll(() => stageWear(page).count()).toBe(withShirt);
  await page.getByTestId('redo').click();
  await expect.poll(() => stageWear(page).count()).toBe(withHair);

  // Elenco: as peças aparecem como itens individuais do projeto.
  await tab(page, 'characters');
  await expect(page.locator('[data-testid="my-wearable"][data-name="Camiseta Traquina"]')).toBeVisible();
  await expect(page.locator('[data-testid="my-wearable"][data-name="Cabelo da Nina"]')).toBeVisible();

  // Reabrir o projeto: tudo continua vestido.
  await waitSaved(page);
  await page.reload();
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect.poll(() => stageWear(page).count()).toBe(withHair);
  await expect.poll(() => stageText(page)).toEqual(expect.arrayContaining(['TRAQUINA']));

  // Exportar PNG com a roupa.
  await page.getByTestId('open-export').click();
  await page.getByTestId('export-kind').selectOption('frame');
  await page.getByTestId('export-res').selectOption('480');
  const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
  const info = await pngInfo(page, await saveDownload(d, 'roupa.png'));
  expect([info.w, info.h]).toEqual([854, 480]);
  await page.keyboard.press('Escape');

  // Biblioteca principal: a roupa salva é um item individual, com miniatura e informações.
  await tab(page, 'characters');
  await page.locator('[data-testid="characters-panel"] [data-testid="open-library"]').click();
  await page.getByTestId('library-search').fill('traquina');
  const it = page.locator('[data-testid="library-item"][data-name="Camiseta Traquina"]').first();
  await expect(it).toBeVisible();
  await it.click();
  await expect(page.getByTestId('library-detail').getByTestId('catalog-views').locator('figure')).toHaveCount(4);
  await page.screenshot({ path: `${OUT}/wear-library.png` });
  await page.getByTestId('library-close').click();
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});

test('Criador de Personagens: vestir e tirar roupa criada, manequim sem roupa coberto', async ({ page }) => {
  await openDemo(page);
  await createWear(page, 'clothing', 'Vestido azul');
  await page.getByTestId('wear-starter').selectOption('dress');
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('wear-category')).toHaveValue('Vestido');
  await page.getByTestId('wear-tryon').click();
  // Sem a peça: manequim com cobertura neutra (peito e quadril), nunca nu.
  await expect(page.getByTestId('wear-big').locator('[data-wear-layer]')).toHaveCount(0);
  await expect(page.getByTestId('wear-big').locator('[fill="#9a948c"]').first()).toBeAttached();
  await page.getByTestId('wear-creator-close').click();
  await tab(page, 'characters');
  await page.locator('[data-testid="project-character"][data-name="Nina"]').getByTestId('edit-character').click();
  await page.getByRole('tab', { name: 'Roupas' }).click();
  const row = page.locator('[data-testid="created-wear-row"]').filter({ hasText: 'Vestido azul' });
  await row.getByTestId('created-wear-toggle').check({ force: true });
  await expect.poll(() => stageWear(page).count()).toBeGreaterThan(0);
  await row.getByTestId('created-wear-toggle').uncheck({ force: true });
  await expect.poll(() => stageWear(page).count()).toBe(0);
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('criador de roupas: prévia primeiro, controles abaixo', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('demo-project').click();
    await expect(page.getByTestId('editor-mobile')).toBeVisible();
    // No celular o Elenco fica no painel do dock.
    await page.getByTestId('dock-characters').click();
    await page.getByTestId('create-clothing').click();
    await page.getByTestId('prompt-input').fill('Jaqueta');
    await page.getByTestId('prompt-ok').click();
    await expect(page.getByTestId('wear-creator')).toBeVisible();
    const pv = (await page.getByTestId('wear-preview').boundingBox())!;
    const ly = (await page.getByTestId('wear-layers').boundingBox())!;
    expect(pv.y).toBeLessThan(ly.y);
    expect(pv.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: resolve('docs/capturas/criador-roupas-celular.png') });
    await page.getByTestId('wear-layers').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve('docs/capturas/criador-roupas-celular-camadas.png') });
  });
});
