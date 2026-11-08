/** Bolinha do grupo no palco e modelos Mar e Barco / Acampamento (build de produção). */
import { expect, test, type Page } from '@playwright/test';
import { OUT, pngInfo, saveDownload, waitSaved, watchErrors } from './helpers';

const go = async (page: Page, s: string) => {
  await page.getByTestId('time-input').fill(s);
  await page.getByTestId('time-input').press('Enter');
  await page.waitForTimeout(120);
};
async function openTemplate(page: Page, id: string) {
  await page.goto('/');
  await page.getByTestId('home-nav-templates').click();
  await page.locator(`[data-template="${id}"]`).click();
  await expect(page.getByTestId('stage')).toBeVisible();
}
const idOf = (page: Page, name: string) => page.locator(`[data-testid="layer-row"][data-node-name="${name}"]`).first().getAttribute('data-node-id');
const centerOf = (page: Page, id: string) => page.locator(`[data-testid="stage-svg"] [data-node-id="${id}"]`).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
async function dragHandle(page: Page, dx: number, dy: number, steps = 12) {
  const h = page.getByTestId('group-handle');
  const b = (await h.boundingBox())!;
  const x = b.x + b.width / 2;
  const y = b.y + b.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx, y + dy, { steps });
  return { up: () => page.mouse.up() };
}

test('Mar e Barco: a bolinha move barco e passageiros juntos; desfazer/refazer; Esc cancela; não sai na exportação', async ({ page }) => {
  test.setTimeout(150_000);
  const errors = watchErrors(page);
  await page.goto('/');
  await page.getByTestId('home-nav-templates').click();
  await page.locator('[data-category="Ambientes"]').click();
  await page.locator('[data-template="mar-barco"]').locator('..').getByTestId('template-preview-open').click();
  await expect(page.getByTestId('template-what-to-test')).toContainText('bolinha laranja');
  await page.getByTestId('template-preview-create').click();
  await expect(page.getByTestId('stage')).toBeVisible();

  await page.getByTestId('tab-layers').click();
  const group = (await idOf(page, 'Barco com passageiros'))!;
  await page.locator(`[data-testid="layer-row"][data-node-id="${group}"] .layer-name`).click();
  const kids = await page.locator(`[data-testid="stage-svg"] [data-node-id="${group}"] [data-node-id]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-node-id')!));
  expect(kids.length).toBeGreaterThanOrEqual(3);
  await go(page, '0');
  const handle = page.getByTestId('group-handle');
  await expect(handle).toBeVisible();
  const before = await Promise.all(kids.map((k) => centerOf(page, k)));

  // Arrastar a bolinha 90 px à direita e 30 px para cima: todos os filhos andam o mesmo tanto.
  const d = await dragHandle(page, 90, -30);
  await d.up();
  const after = await Promise.all(kids.map((k) => centerOf(page, k)));
  for (let i = 0; i < kids.length; i++) {
    expect(after[i]!.x - before[i]!.x).toBeCloseTo(90, -0.5);
    expect(after[i]!.y - before[i]!.y).toBeCloseTo(-30, -0.5);
  }
  // Um gesto = um passo de histórico.
  await page.getByTestId('undo').click();
  await expect(page.getByTestId('toasts')).toContainText('Desfeito: Mover no palco');
  const undone = await Promise.all(kids.map((k) => centerOf(page, k)));
  for (let i = 0; i < kids.length; i++) expect(Math.abs(undone[i]!.x - before[i]!.x)).toBeLessThan(1.5);
  await page.getByTestId('redo').click();
  const redone = await centerOf(page, kids[0]!);
  expect(Math.abs(redone.x - after[0]!.x)).toBeLessThan(1.5);

  // Esc no meio do arraste: volta ao lugar de antes do gesto.
  const start = await centerOf(page, kids[0]!);
  const d2 = await dragHandle(page, -120, 0);
  await page.keyboard.press('Escape');
  await d2.up();
  const esc = await centerOf(page, kids[0]!);
  expect(Math.abs(esc.x - start.x)).toBeLessThan(1.5);

  // O balanço continua (keyframes do grupo) e o Zeca acena enquanto isso.
  // (O arraste em 0 s gravou a chave de 0 s: autokey, como nos demais elementos animados.)
  await go(page, '3');
  const low = await centerOf(page, kids[0]!);
  await go(page, '1,5');
  const mid = await centerOf(page, kids[0]!);
  expect(mid.y).toBeLessThan(low.y - 2);
  await page.screenshot({ path: `${OUT}/grupo-bolinha.png` });

  // Exportar o quadro: a bolinha (laranja #f2a65a) não aparece no PNG.
  const hb = (await handle.boundingBox())!;
  const frame = (await page.getByTestId('frame-border').boundingBox())!;
  const fx = (hb.x + hb.width / 2 - frame.x) / frame.width;
  const fy = (hb.y + hb.height / 2 - frame.y) / frame.height;
  await page.getByTestId('open-export').click();
  await page.getByTestId('export-kind').selectOption('frame');
  await page.getByTestId('export-res').selectOption('720');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
  const png = await pngInfo(page, await saveDownload(dl, 'mar-barco-quadro.png'));
  const [r, g, b] = await png.pixel(Math.round(fx * png.w), Math.round(fy * png.h));
  const isHandle = Math.abs(r! - 242) < 20 && Math.abs(g! - 166) < 20 && Math.abs(b! - 90) < 20;
  expect(isHandle, `pixel ${r},${g},${b}`).toBe(false);
  await page.getByTestId('modal-close').click();

  // Salvar e reabrir: vínculo e posição mantidos.
  await waitSaved(page);
  await page.reload();
  await expect(page.getByTestId('stage')).toBeVisible();
  await go(page, '1,5');
  const reopened = await centerOf(page, kids[0]!);
  expect(Math.abs(reopened.x - mid.x)).toBeLessThan(1.5);
  expect(await page.locator(`[data-testid="stage-svg"] [data-node-id="${group}"] [data-node-id]`).count()).toBe(kids.length);
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});

test('grupo dentro de grupo girado: a bolinha do grupo de dentro segue o cursor', async ({ page }) => {
  await openTemplate(page, 'mar-barco');
  await page.getByTestId('tab-layers').click();
  // Coloca o grupo do barco dentro de um grupo externo girado 30° (via Agrupar com as ondas).
  const group = (await idOf(page, 'Barco com passageiros'))!;
  const waves = (await idOf(page, 'Ondas na frente'))!;
  await page.locator(`[data-testid="layer-row"][data-node-id="${group}"] .layer-name`).click();
  await page.locator(`[data-testid="layer-row"][data-node-id="${waves}"] .layer-name`).click({ modifiers: ['Shift'] });
  await page.getByTestId('layers-panel').getByRole('button', { name: /Agrupar/ }).click();
  await page.getByTestId('insp-tab-transformar').click();
  await page.getByTestId('prop-transform.rotationDeg').locator('input[type="text"]').fill('30');
  await page.getByTestId('prop-transform.rotationDeg').locator('input[type="text"]').press('Enter');
  // Seleciona o grupo de dentro pelo menu do palco (clique com o botão direito num passageiro).
  const kid = await page.locator(`[data-testid="stage-svg"] [data-node-id="${group}"] [data-node-id]`).first().getAttribute('data-node-id');
  const c = await centerOf(page, kid!);
  await page.mouse.click(c.x, c.y, { button: 'right' });
  await page.getByTestId('context-menu').getByText('Selecionar o grupo "Barco com passageiros"').click();
  const h = page.getByTestId('group-handle');
  await expect(h).toBeVisible();
  const before = await centerOf(page, kid!);
  const d = await dragHandle(page, 0, -60);
  await d.up();
  const after = await centerOf(page, kid!);
  // Mesmo com o pai girado 30°, o conjunto vai para cima (onde o cursor foi), não na diagonal.
  expect(Math.abs(after.x - before.x)).toBeLessThan(3);
  expect(after.y - before.y).toBeCloseTo(-60, -0.5);
});

test('Acampamento: a fogueira muda de quadro no tempo, sem keyframes na cena', async ({ page }) => {
  const errors = watchErrors(page);
  await openTemplate(page, 'acampamento');
  const fire = (await page.locator('[data-testid="stage-svg"] [data-obj-clip="aceso"]').first().evaluate((el) => el.closest('[data-node-id]')!.getAttribute('data-node-id')))!;
  const frameAt = async (s: string) => { await go(page, s); return page.locator(`[data-testid="stage-svg"] [data-node-id="${fire}"] [data-obj-frame]`).first().getAttribute('data-obj-frame'); };
  expect(await frameAt('0')).toBe('0');
  expect(await frameAt('0,12')).toBe('1');
  expect(await frameAt('0,23')).toBe('2');
  expect(await frameAt('0,44')).toBe('0');
  await page.screenshot({ path: `${OUT}/acampamento.png` });
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});
