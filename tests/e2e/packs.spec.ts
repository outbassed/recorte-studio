/** Pacotes opcionais pela interface: instalar, usar em dois projetos, desativar, reativar, exportar, remover e reimportar. */
import { expect, test, type Page } from '@playwright/test';
import { openDemo, saveDownload, tab, waitSaved, watchErrors } from './helpers';

const packRow = (page: Page) => page.locator('[data-testid="pack-row"][data-pack="recorte.cozinha-retro"]');
const objectsFilterPacks = (page: Page) => page.locator('[data-testid="objects-panel"] [data-filter="packs"]');

test('ciclo completo do pacote de demonstração, sem quebrar projetos', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await openDemo(page);
  // Sem pacote: o filtro "Pacotes" não existe.
  await tab(page, 'objects');
  await expect(objectsFilterPacks(page)).toHaveCount(0);

  await tab(page, 'library');
  await page.getByTestId('pack-demo').click();
  await expect(page.getByTestId('toasts')).toContainText('Pacote instalado');
  await expect(packRow(page)).toHaveAttribute('data-enabled', '1');

  // Projeto A: insere o painel de azulejos (objeto com imagem do pacote).
  await tab(page, 'objects');
  await objectsFilterPacks(page).click();
  await expect(page.locator('[data-testid="pack-item"]')).toHaveCount(3);
  await page.locator('[data-testid="pack-item"][data-name="Painel de azulejos"] .card-main').click();
  const tiles = page.locator('[data-testid="stage-svg"] image');
  await expect(tiles.first()).toBeVisible();
  const href = await tiles.first().getAttribute('href');
  expect(href).toMatch(/^blob:|^data:/);
  await expect(page.locator('[data-testid="stage-svg"]')).not.toContainText('Imagem indisponível');

  // Desativar: some do catálogo; o projeto continua com o objeto (inclusive depois de recarregar).
  await tab(page, 'library');
  await packRow(page).getByTestId('pack-enabled').uncheck();
  await expect(packRow(page)).toHaveAttribute('data-enabled', '0');
  await tab(page, 'objects');
  await expect(objectsFilterPacks(page)).toHaveCount(0);
  await expect(page.locator('[data-testid="my-object"][data-name="Painel de azulejos"]')).toHaveCount(1);
  await waitSaved(page);
  await page.reload();
  await expect(page.getByTestId('stage')).toBeVisible();
  await expect(page.locator('[data-testid="stage-svg"] image').first()).toBeVisible();

  // Reativar e usar num projeto B (novo).
  await tab(page, 'library');
  await packRow(page).getByTestId('pack-enabled').check();
  await page.getByTestId('back-projects').click();
  await page.getByTestId('new-project').click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await tab(page, 'objects');
  await objectsFilterPacks(page).click();
  await page.locator('[data-testid="pack-item"][data-name="Chaleira"] .card-main').click();
  await expect(page.locator('[data-testid="stage-svg"] [data-obj-clip="fervendo"]')).toHaveCount(1);

  // Exportar o pacote, remover (com confirmação) e conferir que o projeto B continua igual.
  await tab(page, 'library');
  const [dl] = await Promise.all([page.waitForEvent('download'), packRow(page).getByTestId('pack-export').click()]);
  const file = await saveDownload(dl, 'cozinha-retro.rspack');
  expect(dl.suggestedFilename()).toBe('recorte.cozinha-retro-1.0.0.rspack');
  await packRow(page).getByTestId('pack-remove').click();
  await expect(page.getByTestId('confirm-ok')).toBeVisible();
  await page.getByTestId('confirm-ok').click();
  await expect(packRow(page)).toHaveCount(0);
  await waitSaved(page);
  await page.reload();
  await expect(page.locator('[data-testid="stage-svg"] [data-obj-clip="fervendo"]')).toHaveCount(1);

  // Reimportar o arquivo exportado.
  await tab(page, 'library');
  await page.getByTestId('pack-input').setInputFiles(file);
  await expect(page.getByTestId('toasts')).toContainText('Pacote instalado');
  await expect(packRow(page)).toHaveCount(1);
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});

test('arquivo que não é pacote é recusado com mensagem clara', async ({ page }) => {
  await openDemo(page);
  await tab(page, 'library');
  await page.getByTestId('pack-input').setInputFiles({ name: 'falso.rspack', mimeType: 'application/zip', buffer: Buffer.from('isso não é um zip') });
  await expect(page.getByTestId('toasts')).toContainText('Não foi possível instalar');
  await expect(page.locator('[data-testid="pack-row"]')).toHaveCount(0);
});
