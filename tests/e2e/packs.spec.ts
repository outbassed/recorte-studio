/** Pacotes pela Biblioteca principal: inspecionar ANTES de instalar, instalar, usar em dois projetos, desativar, reativar, exportar, remover e reimportar. */
import { expect, test, type Page } from '@playwright/test';
import { saveDownload, tab, waitSaved, watchErrors } from './helpers';

const packCount = (page: Page) => page.evaluate(() => new Promise<number>((ok) => {
  const open = indexedDB.open('recorte-studio');
  open.onsuccess = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains('packs')) { db.close(); ok(0); return; }
    const r = db.transaction('packs').objectStore('packs').count();
    r.onsuccess = () => { db.close(); ok(r.result); };
  };
}));
async function homeLibrary(page: Page) {
  await page.getByTestId('home-nav-library').click();
  await expect(page.getByTestId('library-home')).toBeVisible();
}
const objectsFilterPacks = (page: Page) => page.locator('[data-testid="objects-panel"] [data-filter="packs"]');

test('inspecionar antes de instalar, ciclo completo e projetos intactos', async ({ page }) => {
  test.setTimeout(160_000);
  const errors = watchErrors(page);
  await page.goto('/');
  await homeLibrary(page);
  await page.getByTestId('library-tab-packs').click();
  await expect(page.getByTestId('packs-empty')).toBeVisible();
  // Inspeção: vê tudo do pacote, nada instalado ainda.
  await page.getByTestId('pack-demo').click();
  const pageEl = page.getByTestId('pack-page');
  await expect(pageEl).toHaveAttribute('data-mode', 'inspect');
  await expect(page.getByTestId('pack-inspect-note')).toContainText('nada foi instalado');
  await expect(page.getByTestId('pack-page-item')).toHaveCount(4);
  await expect(page.getByTestId('pack-license')).toContainText('CC0');
  await expect(page.getByTestId('pack-counts')).toContainText('3 objeto(s), 1 cenário(s), 1 animado(s)');
  await expect(page.locator('[data-testid="pack-page-item"][data-name="Chaleira"]')).toContainText('Fervendo');
  await page.getByTestId('pack-search').fill('azulejo');
  await expect(page.getByTestId('pack-page-item')).toHaveCount(2);
  expect(await packCount(page)).toBe(0);
  // Confirmar a instalação.
  await page.getByTestId('pack-install').click();
  await expect(page.getByTestId('toasts')).toContainText('Pacote instalado');
  expect(await packCount(page)).toBe(1);
  // Depois de instalar, a página mostra o pacote instalado.
  await expect(page.getByTestId('pack-page')).toHaveAttribute('data-mode', 'installed');
  await expect(page.getByTestId('pack-state')).toHaveText('Instalado e ativo');
  // Itens do pacote aparecem individualmente na Biblioteca.
  await page.getByTestId('library-tab-items').click();
  await page.locator('[data-testid="library-origins"] [data-filter="packs"]').click();
  await expect(page.getByTestId('library-item')).toHaveCount(4);

  // Projeto A (novo) usa o painel de azulejos pelo Studio.
  await page.getByTestId('home-nav-home').click();
  await page.getByTestId('new-project').first().click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await tab(page, 'objects');
  await objectsFilterPacks(page).click();
  await page.locator('[data-testid="pack-item"][data-name="Painel de azulejos"] .card-main').click();
  await expect(page.locator('[data-testid="stage-svg"] image').first()).toBeVisible();
  await expect(page.locator('[data-testid="stage-svg"]')).not.toContainText('Imagem indisponível');
  await waitSaved(page);

  // Desativar pela Biblioteca (sobre o editor): some do Studio, o projeto continua igual.
  await page.locator('[data-testid="objects-panel"] [data-testid="open-library"]').click();
  await page.getByTestId('library-tab-packs').click();
  await page.locator('[data-testid="pack-card"][data-pack="recorte.cozinha-retro"]').click();
  await page.getByTestId('pack-enabled').uncheck();
  await expect(page.getByTestId('pack-state')).toHaveText('Instalado e desativado');
  await page.getByTestId('library-close').click();
  await expect(objectsFilterPacks(page)).toHaveCount(0);
  await expect(page.locator('[data-testid="my-object"][data-name="Painel de azulejos"]')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('[data-testid="stage-svg"] image').first()).toBeVisible();

  // Reativar, exportar, remover; o projeto continua com o objeto e a imagem.
  await page.getByTestId('back-projects').click();
  await homeLibrary(page);
  await page.getByTestId('library-tab-packs').click();
  await page.locator('[data-testid="pack-card"][data-pack="recorte.cozinha-retro"]').click();
  await page.getByTestId('pack-enabled').check();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('pack-export').click()]);
  const file = await saveDownload(dl, 'cozinha-retro.rspack');
  expect(dl.suggestedFilename()).toBe('recorte.cozinha-retro-1.0.0.rspack');
  await page.getByTestId('pack-remove').click();
  await page.getByTestId('confirm-ok').click();
  await expect(page.getByTestId('packs-empty')).toBeVisible();
  await page.getByTestId('home-nav-projects').click();
  await page.locator('[data-testid="project-card"] .project-open').first().click();
  await expect(page.locator('[data-testid="stage-svg"] image').first()).toBeVisible();

  // Reimportar o arquivo exportado: inspeção primeiro, depois instalar.
  await page.getByTestId('back-projects').click();
  await homeLibrary(page);
  await page.getByTestId('library-input').setInputFiles(file);
  await expect(page.getByTestId('pack-page')).toHaveAttribute('data-mode', 'inspect');
  await page.getByTestId('pack-install').click();
  await expect(page.getByTestId('toasts')).toContainText('Pacote instalado');
  expect(await packCount(page)).toBe(1);
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});

test('arquivo que não é pacote é recusado na inspeção, sem instalar nada', async ({ page }) => {
  await page.goto('/');
  await homeLibrary(page);
  await page.getByTestId('library-tab-packs').click();
  await page.getByTestId('pack-input').setInputFiles({ name: 'falso.rspack', mimeType: 'application/zip', buffer: Buffer.from('isso não é um zip') });
  await expect(page.getByTestId('toasts')).toContainText('Pacote recusado');
  await expect(page.getByTestId('pack-page')).toHaveCount(0);
  expect(await packCount(page)).toBe(0);
});
