/** IK opcional de braço, na interface real (build de produção): ligar sem pular, campos, arrastar o alvo, desfazer, salvar. */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertNoBodyOverflow, openDemo, selectLayer, setField, waitSaved, watchErrors } from './helpers';

const SHOTS = resolve(process.env.IK_SHOTS ?? 'test-results/e2e/ik');
mkdirSync(SHOTS, { recursive: true });

const armRotation = async (page: Page, side: 'L' | 'R') => {
  const t = await page.locator(`[data-testid="stage-svg"] g[data-part="arm-${side}"]`).first().getAttribute('transform');
  const m = /rotate\((-?[\d.]+)\)/.exec(t ?? '');
  return Number(m?.[1]);
};
const num = async (page: Page, testId: string) => Number((await page.getByTestId(testId).locator('input[type="text"]').inputValue()).replace(',', '.'));
async function openIk(page: Page) {
  await openDemo(page);
  await selectLayer(page, 'Nina');
  await page.getByTestId('insp-tab-pose').click();
  await expect(page.getByTestId('sec-ik')).toBeVisible();
  // recolhida por padrão: nada do IK aparece até abrir
  await expect(page.getByTestId('ik-toggle-armL')).toHaveCount(0);
  await page.locator('[data-testid="sec-ik"] .section-title').click();
  await expect(page.getByTestId('ik-toggle-armL')).toBeVisible();
}
/** Interruptor: o <input> é invisível por design; o clique real vai no rótulo, como o usuário faz. */
async function flip(page: Page, testId: string, on: boolean) {
  const input = page.getByTestId(testId);
  if ((await input.isChecked()) !== on) await page.locator('label.toggle').filter({ has: input }).click();
  if (on) await expect(input).toBeChecked(); else await expect(input).not.toBeChecked();
}
const marker = (page: Page, side: 'L' | 'R') => page.getByTestId(`ik-marker-${side}`);

test('IK: desligado por padrão; ligar NÃO mexe no braço; o alvo nasce na mão', async ({ page }) => {
  const errors = watchErrors(page);
  await openIk(page);
  await expect(page.getByTestId('ik-toggle-armL')).not.toBeChecked();
  await expect(marker(page, 'L')).toHaveCount(0);
  const before = [await armRotation(page, 'L'), await armRotation(page, 'R')];
  await flip(page, 'ik-toggle-armL', true);
  await expect(page.getByTestId('ik-status-L')).toHaveAttribute('data-reached', 'true');
  await expect(marker(page, 'L')).toBeVisible();
  const after = [await armRotation(page, 'L'), await armRotation(page, 'R')];
  expect(Math.abs(after[0]! - before[0]!)).toBeLessThan(0.6); // ligar o IK não pula o braço
  expect(after[1]).toBe(before[1]); // o outro braço fica intacto
  expect(errors).toEqual([]);
});

test('IK: campos X/Y movem o braço; fora do alcance estica e avisa; desfazer volta; salvar e recarregar mantém', async ({ page }) => {
  const errors = watchErrors(page);
  await openIk(page);
  await flip(page, 'ik-toggle-armL', true);
  const rig0 = await armRotation(page, 'L');
  const x0 = await num(page, 'ik-x-armL');
  const y0 = await num(page, 'ik-y-armL');
  // Mover o alvo para cima: o braço sobe e continua alcançando.
  await setField(page, 'ik-y-armL', String(y0 - 90));
  await expect(page.getByTestId('ik-status-L')).toHaveAttribute('data-reached', 'true');
  expect(Math.abs((await armRotation(page, 'L')) - rig0)).toBeGreaterThan(5);
  await page.screenshot({ path: resolve(SHOTS, 'ik-alcancou.png') });
  // Longe demais: estica ao máximo e diz isso em português.
  await setField(page, 'ik-x-armL', String(x0 + 3000));
  await expect(page.getByTestId('ik-status-L')).toHaveAttribute('data-reached', 'false');
  await expect(page.getByTestId('ik-status-L')).toContainText('longe demais');
  await expect(marker(page, 'L')).toHaveAttribute('data-reached', 'false');
  await page.screenshot({ path: resolve(SHOTS, 'ik-fora-do-alcance.png') });
  // Desfazer volta ao alvo anterior.
  await page.keyboard.press('Control+z');
  await expect(page.getByTestId('ik-status-L')).toHaveAttribute('data-reached', 'true');
  expect(await num(page, 'ik-x-armL')).toBeCloseTo(x0, 1);
  // Salvar, recarregar: IK continua ligado com os mesmos valores.
  await waitSaved(page);
  const y1 = await num(page, 'ik-y-armL');
  await page.reload();
  await expect(page.getByTestId('stage')).toBeVisible();
  await selectLayer(page, 'Nina');
  await page.getByTestId('insp-tab-pose').click();
  await page.locator('[data-testid="sec-ik"] .section-title').click();
  await expect(page.getByTestId('ik-toggle-armL')).toBeChecked();
  expect(await num(page, 'ik-y-armL')).toBeCloseTo(y1, 1);
  // Desligar devolve o braço à pose (sem IK).
  await flip(page, 'ik-toggle-armL', false);
  await expect(marker(page, 'L')).toHaveCount(0);
  expect(errors.filter((e) => !/Failed to load resource|net::ERR/.test(e))).toEqual([]);
});

test('IK: arrastar o alvo no palco move o braço; um Ctrl+Z desfaz o arraste inteiro', async ({ page }) => {
  await openIk(page);
  await flip(page, 'ik-toggle-armL', true);
  const x0 = await num(page, 'ik-x-armL');
  const y0 = await num(page, 'ik-y-armL');
  const rot0 = await armRotation(page, 'L');
  const box = (await marker(page, 'L').locator('circle').first().boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 20, cy - 25, { steps: 4 });
  await page.mouse.move(cx + 45, cy - 60, { steps: 6 });
  await page.mouse.up();
  const x1 = await num(page, 'ik-x-armL');
  const y1 = await num(page, 'ik-y-armL');
  expect(Math.hypot(x1 - x0, y1 - y0)).toBeGreaterThan(40);
  expect(Math.abs((await armRotation(page, 'L')) - rot0)).toBeGreaterThan(3);
  await page.screenshot({ path: resolve(SHOTS, 'ik-arrastado.png') });
  await page.keyboard.press('Control+z');
  expect(await num(page, 'ik-x-armL')).toBeCloseTo(x0, 1);
  expect(await num(page, 'ik-y-armL')).toBeCloseTo(y0, 1);
});

test('IK: alvo = elemento da cena; força animada e dois braços; reprodução sem erros', async ({ page }) => {
  const errors = watchErrors(page);
  await openIk(page);
  await flip(page, 'ik-toggle-armR', true);
  await page.getByTestId('ik-mode-armR').selectOption('node');
  await page.getByTestId('ik-target-armR').selectOption({ label: 'Zeca' });
  await expect(page.getByTestId('ik-status-R')).toBeVisible();
  // Força: 0 = pose, 100% = IK.
  await setField(page, 'ik-weight-armR', '40');
  expect(await num(page, 'ik-weight-armR')).toBeCloseTo(40, 0);
  await flip(page, 'ik-toggle-armL', true);
  await page.getByTestId('play').click();
  await page.waitForTimeout(600);
  await page.getByTestId('play').click();
  expect(errors.filter((e) => !/Failed to load resource|net::ERR/.test(e))).toEqual([]);
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('IK: ligar, editar por campos (sem arrastar) e nada estoura a tela', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('dock-more').tap();
    await page.getByTestId('more-layers').tap();
    await page.locator('[data-testid="layer-row"][data-node-name="Nina"] .layer-name').tap();
    await page.getByTestId('popup-close').tap();
    await page.getByTestId('quick-pose').tap();
    await page.locator('[data-testid="sec-ik"] .section-title').tap();
    await flip(page, 'ik-toggle-armL', true);
    await expect(page.getByTestId('ik-status-L')).toHaveAttribute('data-reached', 'true');
    const y0 = await num(page, 'ik-y-armL');
    await setField(page, 'ik-y-armL', String(y0 - 60));
    expect(await num(page, 'ik-y-armL')).toBeCloseTo(y0 - 60, 1);
    await assertNoBodyOverflow(page);
    await page.getByTestId('sec-ik').scrollIntoViewIfNeeded();
    await page.screenshot({ path: resolve(SHOTS, 'ik-celular.png') });
  });
});
