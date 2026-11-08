/**
 * Prévia dos modelos (tela inicial → Modelos → Prévia). Regressão do bug do modal que "piscava":
 * o modal ficava DENTRO do cartão com :hover (transform), então o position:fixed virava relativo ao
 * cartão e o modal oscilava com o mouse. Aqui a estabilidade é medida de verdade: posição, remontagem
 * do nó, imagens decodificadas e capturas de tela idênticas com o mouse se mexendo.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createDemoProject, createFromProjectTemplate, PROJECT_TEMPLATES } from '@/features/templates/projects';
import { OUT, watchErrors } from './helpers';

const TEMPLATES = [
  { id: 'demo', make: createDemoProject },
  ...PROJECT_TEMPLATES.map((t) => ({ id: t.id, make: () => createFromProjectTemplate(t.id) })),
].map((t) => {
  const p = t.make();
  return { id: t.id, title: p.title, scenes: p.sceneOrder.map((id) => p.scenes[id]!.name) };
});

const VIEWPORTS = [
  { name: 'desktop-1280', w: 1280, h: 800 },
  { name: 'tablet-768', w: 768, h: 1024 },
  { name: 'celular-390', w: 390, h: 844 },
  { name: 'celular-320', w: 320, h: 640 },
] as const;

async function openTemplates(page: Page) {
  await page.goto('/');
  await page.getByTestId('home-nav-templates').click();
  await expect(page.locator('.tpl-card')).toHaveCount(TEMPLATES.length);
}

/** Abre a prévia do cartão i e mede a estabilidade por ~1 s com o mouse se mexendo sobre o modal. */
async function inspectPreview(page: Page, i: number, shotName: string) {
  const vp = page.viewportSize()!;
  const card = page.locator('.tpl-card').nth(i);
  await card.scrollIntoViewIfNeeded();
  await card.getByTestId('template-preview-open').click();
  const dialog = page.getByTestId('template-preview');
  await expect(dialog).toBeVisible();
  // Um único modal, direto no <body> (fora do cartão, que tem transform no :hover).
  await expect(page.locator('[role="dialog"]')).toHaveCount(1);
  expect(await dialog.evaluate((el) => !!el.closest('.tpl-card'))).toBe(false);
  // Deixa terminar transições que já estavam em curso (ex.: o cartão sob o mouse que acabou de perder o :hover).
  // Piscar de verdade não termina nunca: as medições abaixo continuam exigindo estabilidade total.
  await page.evaluate(() => Promise.allSettled(document.getAnimations().map((a) => a.finished)));
  // Marca o nó: remontagem (loop de render) apagaria a marca.
  await dialog.evaluate((el) => el.setAttribute('data-probe', 'estavel'));
  const box0 = (await dialog.boundingBox())!;
  const positions = new Set<string>();
  const shots: Buffer[] = [];
  for (let k = 0; k < 24; k++) {
    // Mexe o mouse de verdade sobre o modal (era assim que o :hover do cartão alternava).
    await page.mouse.move(box0.x + 30 + (k % 9) * 11, box0.y + 40 + (k % 6) * 9);
    const b = (await dialog.boundingBox())!;
    const back = (await page.locator('.modal-back').boundingBox())!;
    positions.add(`${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)},${Math.round(b.height)}|${Math.round(back.x)},${Math.round(back.y)},${Math.round(back.width)},${Math.round(back.height)}`);
    if (k % 8 === 0) shots.push(await page.screenshot());
    await page.waitForTimeout(40);
  }
  expect([...positions], 'posição/tamanho do modal e do fundo').toHaveLength(1);
  expect(await dialog.getAttribute('data-probe'), 'o nó do modal não pode ser remontado').toBe('estavel');
  // O fundo cobre a janela inteira e o modal cabe nela.
  const back = (await page.locator('.modal-back').boundingBox())!;
  expect([Math.round(back.x), Math.round(back.y), Math.round(back.width), Math.round(back.height)]).toEqual([0, 0, vp.width, vp.height]);
  expect(box0.x).toBeGreaterThanOrEqual(0);
  expect(box0.y).toBeGreaterThanOrEqual(0);
  expect(box0.x + box0.width).toBeLessThanOrEqual(vp.width);
  expect(box0.y + box0.height).toBeLessThanOrEqual(vp.height);
  // Inspeção visual: capturas tiradas em instantes diferentes, com o mouse mexendo, são idênticas.
  for (const s of shots.slice(1)) expect(s.equals(shots[0]!), 'a tela piscou ou mudou entre as capturas').toBe(true);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, `${shotName}.png`), shots[0]!);

  // Imagens carregadas e decodificadas, uma por cena, na ordem do modelo.
  const tpl = TEMPLATES[i]!;
  const scenes = dialog.getByTestId('template-preview-scene');
  await expect(scenes).toHaveCount(tpl.scenes.length);
  const loaded = await scenes.locator('img').evaluateAll((imgs) => Promise.all(imgs.map(async (im) => {
    const el = im as HTMLImageElement;
    await el.decode().catch(() => undefined);
    return el.complete && el.naturalWidth > 0 && el.naturalHeight > 0;
  })));
  expect(loaded.every(Boolean), 'todas as imagens carregaram').toBe(true);
  const labels = await scenes.locator('span').allTextContents();
  expect(labels).toEqual(tpl.scenes.map((n, k) => `${k + 1}. ${n}`));
  // O cartão anuncia o mesmo número de cenas.
  await expect(card).toContainText(`${tpl.scenes.length} cena(s)`);
  return { dialog, card };
}

for (const vp of VIEWPORTS) {
  test.describe(`prévia dos modelos · ${vp.name}`, () => {
    test.use({ viewport: { width: vp.w, height: vp.h } });

    test('cada modelo abre estável, com todas as cenas em ordem, e fecha pelo X e por Esc', async ({ page }) => {
      test.setTimeout(240_000);
      const errors = watchErrors(page);
      await openTemplates(page);
      for (const [i, tpl] of TEMPLATES.entries()) {
        const { dialog } = await inspectPreview(page, i, `preview-${tpl.id}-${vp.name}`);
        await dialog.getByTestId('modal-close').click();
        await expect(page.locator('[role="dialog"]')).toHaveCount(0);
        // Reabre e fecha com Esc; depois de fechar, o cartão continua funcional.
        await page.locator('.tpl-card').nth(i).getByTestId('template-preview-open').click();
        await expect(page.getByTestId('template-preview')).toBeVisible();
        await page.keyboard.press('Escape');
        await expect(page.locator('[role="dialog"]')).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });

    test('fechar e reabrir repetidamente continua estável (10 vezes)', async ({ page }) => {
      const errors = watchErrors(page);
      await openTemplates(page);
      const i = TEMPLATES.findIndex((t) => t.id === 'episodio');
      const card = page.locator('.tpl-card').nth(i);
      await card.scrollIntoViewIfNeeded();
      for (let n = 0; n < 10; n++) {
        await card.getByTestId('template-preview-open').click();
        const dialog = page.getByTestId('template-preview');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByTestId('template-preview-scene')).toHaveCount(TEMPLATES[i]!.scenes.length);
        const a = (await dialog.boundingBox())!;
        await page.waitForTimeout(120);
        const b = (await dialog.boundingBox())!;
        expect([b.x, b.y, b.width, b.height]).toEqual([a.x, a.y, a.width, a.height]);
        await dialog.getByTestId('modal-close').click();
        await expect(dialog).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });

    test('criar projeto a partir da prévia abre o editor com as cenas do modelo', async ({ page }) => {
      await openTemplates(page);
      const i = TEMPLATES.findIndex((t) => t.id === 'episodio');
      await page.locator('.tpl-card').nth(i).getByTestId('template-preview-open').click();
      await page.getByTestId('template-preview-create').click();
      await expect(page.getByTestId('stage')).toBeVisible({ timeout: 20_000 });
      await expect(page.getByTestId('project-name')).toHaveText(TEMPLATES[i]!.title);
      await expect(page.locator('[data-testid="stage"]')).toBeVisible();
      // Layout de celular/tablet tem o dock; o de computador tem as abas laterais.
      const dock = page.getByTestId('dock-scenes');
      if (await dock.count()) await dock.click();
      else await page.getByTestId('tab-scenes').click();
      await expect(page.locator('[data-testid="scene-row"]')).toHaveCount(TEMPLATES[i]!.scenes.length);
    });
  });
}

test.describe('cartões de modelo', () => {
  test('as miniaturas preenchem o cartão (não herdam o tamanho 72×42 do painel do editor)', async ({ page }) => {
    await openTemplates(page);
    for (let i = 0; i < TEMPLATES.length; i++) {
      const card = page.locator('.tpl-card').nth(i);
      const cb = (await card.boundingBox())!;
      const tb = (await card.locator('.tpl-thumb').boundingBox())!;
      expect(tb.width, TEMPLATES[i]!.id).toBeGreaterThan(cb.width - 4);
      expect(Math.abs(tb.height - (tb.width * 9) / 16)).toBeLessThan(2);
      const ok = await card.locator('.tpl-thumb img').evaluate((im) => (im as HTMLImageElement).complete && (im as HTMLImageElement).naturalWidth > 0);
      expect(ok).toBe(true);
    }
  });

  test('passar o mouse nos cartões com a prévia aberta não mexe no modal', async ({ page }) => {
    await openTemplates(page);
    await page.locator('.tpl-card').first().getByTestId('template-preview-open').click();
    const dialog = page.getByTestId('template-preview');
    const a = (await dialog.boundingBox())!;
    // Varre o mouse por toda a janela (inclusive por cima do cartão que abriu o modal).
    for (let x = 20; x < 1260; x += 80) for (const y of [100, 300, 500, 700]) await page.mouse.move(x, y);
    const b = (await dialog.boundingBox())!;
    expect([b.x, b.y, b.width, b.height]).toEqual([a.x, a.y, a.width, a.height]);
  });
});
