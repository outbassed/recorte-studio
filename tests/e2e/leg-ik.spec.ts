/** Pés fixos e IK de joelhos no editor real: mesma interface do Recorte Studio. */
import { expect, test, type Page } from '@playwright/test';
import { assertNoBodyOverflow, openDemo, selectLayer, setField, waitSaved, watchErrors } from './helpers';

async function openFootIk(page: Page) {
  await openDemo(page);
  await selectLayer(page, 'Nina');
  await page.getByTestId('insp-tab-pose').click();
  await expect(page.getByTestId('sec-foot-ik')).toBeVisible();
  await page.locator('[data-testid="sec-foot-ik"] .section-title').click();
  await expect(page.getByTestId('ik-toggle-legL')).toBeVisible();
}
async function flip(page: Page, id: string, value: boolean) {
  const input = page.getByTestId(id);
  if (await input.isChecked() !== value) await page.locator('label.toggle').filter({ has: input }).click();
  if (value) await expect(input).toBeChecked(); else await expect(input).not.toBeChecked();
}
const value = async (page: Page, id: string) => Number((await page.getByTestId(id).locator('input[type="text"]').inputValue()).replace(',', '.'));

test('pés: desligados inicialmente; ligar conserva a pose, cria marcador e permite alcançar novo alvo', async ({ page }) => {
  const errors = watchErrors(page);
  await openFootIk(page);
  await expect(page.getByTestId('ik-toggle-legL')).not.toBeChecked();
  await expect(page.getByTestId('ik-foot-marker-L')).toHaveCount(0);
  await flip(page, 'ik-toggle-legL', true);
  await expect(page.getByTestId('ik-foot-status-L')).toHaveAttribute('data-reached', 'true');
  await expect(page.getByTestId('ik-foot-marker-L')).toBeVisible();
  const y = await value(page, 'ik-y-legL');
  await setField(page, 'ik-y-legL', String(y - 25));
  await expect(page.getByTestId('ik-foot-marker-L')).toBeVisible();
  await expect(page.locator('[data-testid="stage-svg"] [data-part="ik-knee-L"]')).toHaveCount(1);
  await flip(page, 'ik-toggle-legR', true);
  await expect(page.getByTestId('ik-foot-marker-R')).toBeVisible();
  await expect(page.locator('[data-testid="stage-svg"] [data-part="ik-knee-R"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('pés: mover alvo, salvar, recarregar e soltar a perna', async ({ page }) => {
  await openFootIk(page);
  await flip(page, 'ik-toggle-legL', true);
  const x = await value(page, 'ik-x-legL');
  await setField(page, 'ik-x-legL', String(x + 12));
  await waitSaved(page);
  await page.reload();
  await selectLayer(page, 'Nina');
  await page.getByTestId('insp-tab-pose').click();
  await page.locator('[data-testid="sec-foot-ik"] .section-title').click();
  await expect(page.getByTestId('ik-toggle-legL')).toBeChecked();
  expect(await value(page, 'ik-x-legL')).toBeCloseTo(x + 12, 1);
  await flip(page, 'ik-toggle-legL', false);
  await expect(page.getByTestId('ik-foot-marker-L')).toHaveCount(0);
  await expect(page.locator('[data-testid="stage-svg"] [data-part="ik-knee-L"]')).toHaveCount(0);
});

test('pés: alvo fora de alcance avisa em português e não quebra', async ({ page }) => {
  await openFootIk(page);
  await flip(page, 'ik-toggle-legL', true);
  await setField(page, 'ik-x-legL', '4000');
  await expect(page.getByTestId('ik-foot-status-L')).toHaveAttribute('data-reached', 'false');
  await expect(page.getByTestId('ik-foot-status-L')).toContainText('fora do alcance');
  await expect(page.getByTestId('ik-foot-marker-L')).toHaveAttribute('data-reached', 'false');
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('IK de pé pode ser ativado sem arrastar e sem mudar o layout', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('dock-more').tap();
    await page.getByTestId('more-layers').tap();
    await page.locator('[data-testid="layer-row"][data-node-name="Nina"] .layer-name').tap();
    await page.getByTestId('popup-close').tap();
    await page.getByTestId('quick-pose').tap();
    await page.locator('[data-testid="sec-foot-ik"] .section-title').tap();
    await flip(page, 'ik-toggle-legL', true);
    await expect(page.getByTestId('ik-x-legL')).toBeVisible();
    await assertNoBodyOverflow(page);
  });
});
