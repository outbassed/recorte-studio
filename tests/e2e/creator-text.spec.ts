/** Fase 3a: texto editável nos criadores (Objetos e Cenários), salvo na biblioteca e usado na cena. */
import { expect, test, type Page } from '@playwright/test';
import { OUT, openDemo, setField, tab, watchErrors } from './helpers';

const stageText = (page: Page) => page.locator('[data-testid="stage-svg"] text').allTextContents();

test('camiseta com "TRAQUINA" e número: criar, estilizar, salvar, inserir, editar depois e desfazer', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openDemo(page);
  await tab(page, 'objects');
  await page.getByTestId('object-new').click();
  await page.getByTestId('prompt-input').fill('Camisa do time');
  await page.getByTestId('prompt-ok').click();
  await page.getByTestId('obj-studio-tab-add').click();
  await page.getByTestId('add-text-piece').click();
  await expect(page.getByTestId('piece-text-controls')).toBeVisible();
  await page.getByTestId('piece-text').fill('TRAQUINA');
  await page.getByTestId('piece-font').selectOption('serif');
  await setField(page, 'piece-font-size', '90');
  await page.getByTestId('piece-font-weight').selectOption('900');
  await page.getByTestId('piece-text-color').fill('#ff0000');
  await setField(page, 'piece-text-stroke-width', '4');
  const canvasText = page.locator('[data-testid="obj-studio-canvas"] text');
  await expect(canvasText).toContainText('TRAQUINA');
  await expect(canvasText).toHaveAttribute('font-size', '90');
  await expect(canvasText).toHaveAttribute('fill', '#ff0000');
  // Segunda linha de texto: número.
  await page.getByTestId('obj-studio-tab-add').click();
  await page.getByTestId('add-text-piece').click();
  await page.getByTestId('piece-text').fill('10');
  await page.screenshot({ path: `${OUT}/texto-criador.png` });
  await page.getByTestId('object-save-lib').click();
  await expect(page.getByTestId('toasts')).toContainText('salvo na sua biblioteca');
  await page.getByTestId('object-insert').click();
  await expect.poll(() => stageText(page)).toEqual(expect.arrayContaining(['TRAQUINA', '10']));

  // Editar depois: o texto continua texto (não virou imagem).
  await page.locator('[data-testid="my-object"][data-name="Camisa do time"]').getByTestId('my-object-edit').click();
  await page.getByTestId('obj-studio-tab-layers').click();
  await page.locator('[data-testid="studio-layer"]').filter({ hasText: 'Texto' }).first().click();
  await page.getByTestId('obj-studio-tab-props').click();
  await page.getByTestId('piece-text').fill('TRAQUINA FC');
  await page.getByTestId('object-creator-close').click();
  await expect.poll(() => stageText(page)).toEqual(expect.arrayContaining(['TRAQUINA FC']));
  await page.getByTestId('undo').click();
  await expect.poll(() => stageText(page)).toEqual(expect.arrayContaining(['TRAQUINA']));

  // O conteúdo do texto entra na busca da Biblioteca principal.
  await page.locator('[data-testid="objects-panel"] [data-testid="open-library"]').click();
  await page.getByTestId('library-search').fill('traquina');
  await expect(page.locator('[data-testid="library-item"][data-name="Camisa do time"]').first()).toBeVisible();
  await page.getByTestId('library-close').click();
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});

test('Criador de Cenários também tem texto (letreiro)', async ({ page }) => {
  await openDemo(page);
  await tab(page, 'backgrounds');
  await page.getByTestId('scenery-new').click();
  await page.getByTestId('prompt-input').fill('Rua da loja');
  await page.getByTestId('prompt-ok').click();
  await page.getByTestId('start-empty').click();
  await page.getByTestId('scene-studio-tab-add').click();
  await page.getByTestId('add-text-piece').click();
  await page.getByTestId('piece-text').fill('PADARIA');
  await expect(page.locator('[data-testid="scene-studio-canvas"] text', { hasText: 'PADARIA' })).toHaveCount(1);
  await page.getByTestId('scenery-apply').click();
  await expect.poll(() => stageText(page)).toEqual(expect.arrayContaining(['PADARIA']));
});
