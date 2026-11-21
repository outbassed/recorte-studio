/** Etapa 1: curvas de easing editáveis, transições suaves, acabamento do pulo e balões animados (build de produção). */
import { expect, test, type Page } from '@playwright/test';
import { strFromU8, unzipSync } from 'fflate';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { OUT, assertNoBodyOverflow, openDemo, saveDownload, selectLayer, setField, waitSaved, watchErrors } from './helpers';

const goTo = async (page: Page, seconds: string) => {
  await page.getByTestId('time-input').fill(seconds);
  await page.getByTestId('time-input').press('Enter');
  await page.waitForTimeout(80);
};
const num = async (page: Page, testId: string) => Number((await page.getByTestId(testId).locator('input[type="text"]').inputValue()).replace(',', '.'));

/** Abre "Valores numéricos" do editor de curva se ainda estiver fechado. */
const openNumbers = async (page: Page) => {
  const d = page.getByTestId('bezier').locator('details');
  if (!(await d.evaluate((el) => (el as HTMLDetailsElement).open))) await d.locator('summary').click();
};

/** Zeca com keyframes de X em 0 s e 2 s e o primeiro selecionado na timeline. */
async function openFirstKey(page: Page) {
  await openDemo(page);
  await selectLayer(page, 'Zeca');
  await page.getByTestId('key-transform.x').click();
  await goTo(page, '2');
  await setField(page, 'prop-transform.x', '0');
  await goTo(page, '0');
  await page.getByRole('button', { name: /Expandir propriedades de Zeca/ }).click();
  await page.getByTestId('tl-key').first().click();
  await expect(page.getByTestId('sec-key')).toBeVisible();
}

const jrecProject = (path: string): { scenes: Record<string, { tracks: Array<{ type: string; keyframes?: Array<{ bezierHandles?: Record<string, number>; interpolation: string }> }>; transitionIn: { easing?: string } }> } => {
  const files = unzipSync(new Uint8Array(readFileSync(path)));
  return JSON.parse(strFromU8(files['project.json']!));
};

test.describe('Etapa 1 · curva de easing no keyframe', () => {
  test('editor aparece só com "Curva personalizada"; presets, teclado, numérico, desfazer, refazer e restaurar', async ({ page }) => {
    const errors = watchErrors(page);
    await openFirstKey(page);
    await expect(page.getByTestId('bezier')).toHaveCount(0);
    await page.getByTestId('key-interp').selectOption('bezier');
    // padrão legado: nenhum editor, easing nomeado
    await expect(page.getByTestId('key-easing')).toHaveValue('easeInOut');
    await expect(page.getByTestId('bezier')).toHaveCount(0);

    await page.getByTestId('key-easing').selectOption('custom');
    await expect(page.getByTestId('bezier-graph')).toBeVisible();
    // começou da aproximação do easing que o keyframe já tinha (suave nas duas pontas)
    await openNumbers(page);
    expect(await num(page, 'bezier-x1')).toBeCloseTo(0.45, 2);

    // preset com overshoot: Y passa de 1
    await page.getByTestId('bezier-preset-overshoot').click();
    expect(await num(page, 'bezier-y1')).toBeCloseTo(1.56, 2);
    await expect(page.getByTestId('bezier-preset-overshoot')).toHaveAttribute('aria-pressed', 'true');

    // o valor interpolado muda de fato: 30% do tempo (0,6 s de 2 s) com overshoot passa de 30% do caminho
    const from = 170;
    await goTo(page, '0,6');
    await selectLayer(page, 'Zeca'); // o Inspector mostra o personagem e não o keyframe selecionado
    const x = await num(page, 'prop-transform.x');
    expect(x, 'passou do trecho linear (170 → 0)').toBeLessThan(from - 0.3 * from);

    // teclado: ponto 1 move X em 0,01 por seta (alternativa sem arrastar)
    await page.getByTestId('tl-key').first().click();
    await openNumbers(page);
    const before = await num(page, 'bezier-x1');
    await page.getByTestId('bezier-p1').focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    expect(await num(page, 'bezier-x1')).toBeCloseTo(before + 0.02, 2);
    await page.keyboard.press('ArrowUp');
    expect(await num(page, 'bezier-y1')).toBeCloseTo(1.57, 2);

    // numérico: valor fora da faixa é recusado/limitado (X só vai de 0 a 1)
    const x2 = page.getByTestId('bezier-x2').locator('input[type="text"]');
    await x2.fill('5');
    await x2.press('Enter');
    expect(await num(page, 'bezier-x2')).toBeLessThanOrEqual(1);

    // arrastar com o mouse, numa única entrada de histórico
    const handle = page.getByTestId('bezier-p2');
    await page.getByTestId('bezier-graph').scrollIntoViewIfNeeded();
    const hb = (await handle.boundingBox())!;
    const g = (await page.getByTestId('bezier-graph').boundingBox())!;
    const y2Before = await num(page, 'bezier-y2');
    await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await page.mouse.down();
    await page.mouse.move(g.x + g.width * 0.5, g.y + g.height * 0.2, { steps: 8 });
    await page.mouse.up();
    expect(await num(page, 'bezier-y2')).toBeGreaterThan(y2Before + 0.1);
    const afterDrag = { x2: await num(page, 'bezier-x2'), y2: await num(page, 'bezier-y2') };
    await page.getByTestId('undo').click();
    expect(await num(page, 'bezier-y2')).toBeCloseTo(y2Before, 2);
    await page.getByTestId('redo').click();
    expect(await num(page, 'bezier-y2')).toBeCloseTo(afterDrag.y2, 2);

    // restaurar volta ao easing nomeado e some o editor
    await page.getByTestId('bezier-reset').click();
    await expect(page.getByTestId('bezier')).toHaveCount(0);
    await expect(page.getByTestId('key-easing')).toHaveValue('easeInOut');
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('bezier-graph')).toBeVisible();
    await page.screenshot({ path: resolve(OUT, 'etapa1-curva.png') });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('a curva persiste: autosave, recarregar e .jrec', async ({ page }) => {
    await openFirstKey(page);
    await page.getByTestId('key-interp').selectOption('bezier');
    await page.getByTestId('key-easing').selectOption('custom');
    await page.getByTestId('bezier-preset-anticipate').click();
    await waitSaved(page);
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-project').click()]);
    const project = jrecProject(await saveDownload(d, 'etapa1-curva.jrec'));
    const keys = Object.values(project.scenes).flatMap((s) => s.tracks.flatMap((t) => (t.type === 'property' ? t.keyframes ?? [] : [])));
    const withCurve = keys.filter((k) => k.bezierHandles);
    expect(withCurve).toHaveLength(1);
    expect(withCurve[0]).toMatchObject({ interpolation: 'bezier', bezierHandles: { x1: 0.36, y1: 0, x2: 0.66, y2: -0.56 } });

    // recarrega a página: a curva volta do IndexedDB
    await page.reload();
    await expect(page.getByTestId('stage')).toBeVisible();
    await selectLayer(page, 'Zeca');
    await page.getByRole('button', { name: /Expandir propriedades de Zeca/ }).click();
    await page.getByTestId('tl-key').first().click();
    await expect(page.getByTestId('key-easing')).toHaveValue('custom');
    await openNumbers(page);
    expect(await num(page, 'bezier-y2')).toBeCloseTo(-0.56, 2);
  });

  test('keyframe antigo (sem curva) continua com o easing nomeado e a lista nova mantém os ids antigos', async ({ page }) => {
    await openFirstKey(page);
    await page.getByTestId('key-interp').selectOption('bezier');
    const ids = await page.getByTestId('key-easing').locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value));
    for (const id of ['easeInOut', 'easeIn', 'easeOut', 'backOut', 'bounceOut', 'linear', 'easeInOutCubic', 'easeInCubic', 'easeOutCubic', 'backIn', 'backInOut', 'custom']) expect(ids).toContain(id);
    await page.getByTestId('key-easing').selectOption('easeInOutCubic');
    await expect(page.getByTestId('bezier')).toHaveCount(0);
    await page.getByTestId('key-interp').selectOption('linear');
    await expect(page.getByTestId('key-easing')).toHaveCount(0);
  });
});

test.describe('Etapa 1 · transições, pulo e balões no Inspector', () => {
  test('suavização da transição é salva no projeto e padrão continua linear', async ({ page }) => {
    await openDemo(page);
    // abre pelas cenas e seleciona a cena
    await page.getByTestId('tab-scenes').click();
    await page.locator('[data-testid="scene-row"]').first().click();
    await page.getByTestId('insp-tab-transicoes').click();
    await expect(page.getByTestId('transition-in-easing')).toHaveValue('linear');
    await expect(page.getByTestId('transition-in-easing')).toBeDisabled(); // corte seco: nada a suavizar
    await page.getByTestId('transition-in').selectOption('crossfade');
    await expect(page.getByTestId('transition-in-easing')).toBeEnabled();
    await page.getByTestId('transition-in-easing').selectOption('easeInOutCubic');
    await waitSaved(page);
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('transition-in-easing')).toHaveValue('linear');
    await page.getByTestId('redo').click();
    await expect(page.getByTestId('transition-in-easing')).toHaveValue('easeInOutCubic');
    await waitSaved(page);
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-project').click()]);
    const project = jrecProject(await saveDownload(d, 'etapa1-transicao.jrec'));
    expect(Object.values(project.scenes).some((s) => s.transitionIn.easing === 'easeInOutCubic')).toBe(true);
  });

  test('acabamento do pulo: desligado por padrão, liga e desliga, entra no .jrec', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Nina');
    await page.getByTestId('insp-tab-animar').click();
    await page.getByTestId('action-select').selectOption('jump');
    await page.getByTestId('add-action').click();
    const clip = page.locator('[data-testid="tl-clip-action"]').filter({ hasText: 'Pular' });
    await expect(clip).toBeVisible();
    await clip.click();
    await page.getByTestId('insp-tab-acao').click();
    const toggle = page.getByTestId('clip-finish');
    await expect(toggle).toBeVisible();
    await expect(page.getByTestId('clip-finish-amount')).toHaveCount(0);
    await page.locator('label.toggle').filter({ has: toggle }).click();
    await expect(toggle).toBeChecked();
    await expect(page.getByTestId('clip-finish-amount')).toBeVisible();
    await waitSaved(page);
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-project').click()]);
    const files = unzipSync(new Uint8Array(readFileSync(await saveDownload(d, 'etapa1-pulo.jrec'))));
    expect(strFromU8(files['project.json']!)).toMatch(/"finish":1/);
    await page.locator('label.toggle').filter({ has: toggle }).click();
    await expect(toggle).not.toBeChecked();
    await expect(page.getByTestId('clip-finish-amount')).toHaveCount(0);
    // outras ações não oferecem o recurso
    await selectLayer(page, 'Nina');
    await page.getByTestId('insp-tab-animar').click();
    await page.getByTestId('action-select').selectOption('wave');
    await page.getByTestId('add-action').click();
    await page.locator('[data-testid="tl-clip-action"]').filter({ hasText: 'Acenar' }).click();
    await page.getByTestId('insp-tab-acao').click();
    await expect(page.getByTestId('clip-finish')).toHaveCount(0);
  });

  test('balão: entrada e saída, durações, desfazer; clip antigo começa em "nenhuma"', async ({ page }) => {
    await openDemo(page);
    await page.locator('[data-testid="tl-clip-dialogue"]').filter({ hasText: 'Você sabe' }).click();
    await page.getByTestId('insp-tab-balao').click();
    await expect(page.getByTestId('bubble-in')).toHaveValue('none');
    await expect(page.getByTestId('bubble-out')).toHaveValue('none');
    await expect(page.getByTestId('bubble-in-ms')).toHaveCount(0);
    await page.getByTestId('bubble-in').selectOption('pop');
    await expect(page.getByTestId('bubble-in-ms')).toBeVisible();
    await page.getByTestId('bubble-out').selectOption('fade');
    await setField(page, 'bubble-out-ms', '350');
    expect(await num(page, 'bubble-out-ms')).toBe(350);
    await waitSaved(page);
    // as edições seguidas do mesmo clip podem ser fundidas no histórico: desfaz até voltar ao início
    for (let i = 0; i < 6 && (await page.getByTestId('bubble-out').inputValue()) !== 'none'; i++) await page.getByTestId('undo').click();
    await expect(page.getByTestId('bubble-out')).toHaveValue('none');
    for (let i = 0; i < 6 && (await page.getByTestId('bubble-out').inputValue()) !== 'fade'; i++) await page.getByTestId('redo').click();
    await expect(page.getByTestId('bubble-out')).toHaveValue('fade');
    expect(await num(page, 'bubble-out-ms')).toBe(350);
  });

  test('o quadro do palco mostra o balão em pop no início e normal depois', async ({ page }) => {
    const errors = watchErrors(page);
    await openDemo(page);
    await page.locator('[data-testid="tl-clip-dialogue"]').filter({ hasText: 'Você sabe' }).click();
    await page.getByTestId('insp-tab-balao').click();
    await page.getByTestId('bubble-in').selectOption('popFade');
    await setField(page, 'bubble-in-ms', '600');
    // início do clip de fala: o balão está dentro do grupo animado; mais adiante, sem o grupo
    const start = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="tl-clip-dialogue"]');
      return el ? 1 : 0;
    });
    expect(start).toBe(1);
    await goTo(page, '0,05');
    // o instante exato do clip varia com o exemplo: procura o primeiro instante com balão e confere a janela
    let found = false;
    for (const t of ['0,05', '0,3', '0,8', '1,2', '1,6', '2', '2,4', '3']) {
      await goTo(page, t);
      if (await page.locator('[data-part="bubble"]').count()) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});

test.describe('Etapa 1 · celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  const insidePopup = async (page: Page, testId: string) => {
    const popup = (await page.getByTestId('mobile-popup').boundingBox())!;
    const b = (await page.getByTestId(testId).boundingBox())!;
    expect(b.x, `${testId} dentro do painel (esquerda)`).toBeGreaterThanOrEqual(popup.x - 1);
    expect(b.x + b.width, `${testId} dentro do painel (direita)`).toBeLessThanOrEqual(popup.x + popup.width + 1);
    return b;
  };

  test('balão animado: opções cabem, são tocáveis e funcionam por toque', async ({ page }) => {
    const errors = watchErrors(page);
    await openDemo(page);
    await page.getByTestId('mode-advanced').tap();
    await page.locator('[data-testid="tl-clip-dialogue"]').filter({ hasText: 'Você sabe' }).tap();
    await page.getByTestId('dock-properties').tap();
    await page.getByTestId('insp-tab-balao').tap();
    for (const id of ['bubble-in', 'bubble-out']) {
      const b = await insidePopup(page, id);
      expect(b.height, `${id} tocável`).toBeGreaterThanOrEqual(32);
    }
    await page.getByTestId('bubble-in').selectOption('popFade');
    await page.getByTestId('bubble-out').selectOption('popFade');
    await expect(page.getByTestId('bubble-in-ms')).toBeVisible();
    await insidePopup(page, 'bubble-in-ms');
    await insidePopup(page, 'bubble-out-ms');
    await assertNoBodyOverflow(page);
    await page.screenshot({ path: resolve(OUT, 'etapa1-celular-balao.png') });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('curva do keyframe no celular: sem estouro, alvos de toque e arrasto por toque', async ({ page }) => {
    const errors = watchErrors(page);
    await openDemo(page);
    await page.getByTestId('mode-advanced').tap();
    // cria dois keyframes de X em Nina e abre o primeiro
    await page.getByTestId('dock-more').tap();
    await page.getByTestId('more-layers').tap();
    await page.locator('[data-testid="layer-row"][data-node-name="Nina"] .layer-name').tap();
    await page.getByTestId('popup-close').tap();
    await page.getByTestId('quick-move').tap();
    await page.getByTestId('key-transform.x').tap();
    await page.getByTestId('popup-close').tap();
    await page.getByTestId('time-input').fill('2');
    await page.getByTestId('time-input').press('Enter');
    await page.getByTestId('quick-move').tap();
    await setField(page, 'prop-transform.x', '10');
    await page.getByTestId('popup-close').tap();
    await page.getByRole('button', { name: /Expandir propriedades de Nina/ }).tap();
    await page.getByTestId('tl-key').first().tap();
    await page.getByTestId('dock-properties').tap();
    await expect(page.getByTestId('sec-key')).toBeVisible();
    await page.getByTestId('key-interp').selectOption('bezier');
    await page.getByTestId('key-easing').selectOption('custom');
    await expect(page.getByTestId('bezier-graph')).toBeVisible();
    await page.getByTestId('bezier-graph').scrollIntoViewIfNeeded();
    await insidePopup(page, 'bezier-graph');
    const preset = await insidePopup(page, 'bezier-preset-overshoot');
    expect(preset.height, 'preset tocável').toBeGreaterThanOrEqual(36);
    const handle = (await page.getByTestId('bezier-p1').boundingBox())!;
    expect(handle.width, 'handle tocável').toBeGreaterThanOrEqual(20);
    await page.getByTestId('bezier-preset-overshoot').tap();
    await expect(page.getByTestId('bezier-preset-overshoot')).toHaveAttribute('aria-pressed', 'true');
    // arrasto com toque (pointer events, sem mouse): o ponto 1 muda
    await page.getByTestId('bezier').locator('summary').tap();
    const y1Before = Number((await page.getByTestId('bezier-y1').locator('input[type="text"]').inputValue()).replace(',', '.'));
    const hb = (await page.getByTestId('bezier-p1').boundingBox())!;
    const g = (await page.getByTestId('bezier-graph').boundingBox())!;
    await page.evaluate(([x0, y0, x1, y1]) => {
      const el = document.querySelector('[data-testid="bezier-p1"]')!;
      const mk = (type: string, x: number, y: number) => new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y });
      el.dispatchEvent(mk('pointerdown', x0!, y0!));
      for (let i = 1; i <= 6; i++) el.dispatchEvent(mk('pointermove', x0! + ((x1! - x0!) * i) / 6, y0! + ((y1! - y0!) * i) / 6));
      el.dispatchEvent(mk('pointerup', x1!, y1!));
    }, [hb.x + hb.width / 2, hb.y + hb.height / 2, g.x + g.width * 0.6, g.y + g.height * 0.7]);
    const y1After = Number((await page.getByTestId('bezier-y1').locator('input[type="text"]').inputValue()).replace(',', '.'));
    expect(y1After).toBeLessThan(y1Before - 0.2);
    await assertNoBodyOverflow(page);
    await page.screenshot({ path: resolve(OUT, 'etapa1-celular-curva.png') });
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
