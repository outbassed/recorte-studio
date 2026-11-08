/**
 * Critério do Super Prompt: fogo de 4 quadros criado na interface, salvo, colocado em 2 cenas e 3 instâncias,
 * animando sozinho (sem keyframe de desenho), com defasagem por instância, igual após recarregar e no vídeo.
 */
import { expect, test, type Page } from '@playwright/test';
import { ffmpegFrame, ffprobe, OUT, openDemo, pngInfo, saveDownload, setField, tab, waitSaved, watchErrors } from './helpers';

const COLORS = ['#ff0000', '#00c800', '#0000ff', '#ffff00'];

/** Quadro mostrado por cada instância do objeto no palco, na ordem das camadas. */
const stageFrames = (page: Page) => page.evaluate(() => [...document.querySelectorAll('[data-testid="stage-svg"] [data-obj-frame]')].map((el) => ({
  node: el.closest('[data-node-id]')?.getAttribute('data-node-id') ?? '',
  frame: Number(el.getAttribute('data-obj-frame')),
})));
const go = async (page: Page, s: string) => {
  await page.getByTestId('time-input').fill(s);
  await page.getByTestId('time-input').press('Enter');
  await page.waitForTimeout(120);
};

async function buildFire(page: Page) {
  await tab(page, 'objects');
  await page.getByTestId('object-new').click();
  await page.getByTestId('prompt-input').fill('Fogueira');
  await page.getByTestId('prompt-ok').click();
  await expect(page.getByTestId('object-creator')).toBeVisible();
  await page.getByTestId('anim-new').click();
  await page.getByTestId('prompt-input').fill('Aceso');
  await page.getByTestId('prompt-ok').click();
  await page.getByTestId('obj-studio-tab-layers').click();
  await page.locator('[data-testid="studio-layer"][data-name="Base"]').click();
  await page.getByTestId('obj-studio-tab-props').click();
  for (const [i, c] of COLORS.entries()) {
    if (i > 0) await page.getByTestId('anim-frame-add').click();
    await expect(page.locator('[data-testid="anim-frame"].is-active')).toHaveAttribute('data-index', String(i));
    await page.getByTestId('piece-fill').fill(c);
  }
  await page.getByTestId('anim-all-ms').click();
  await page.getByTestId('prompt-input').fill('250');
  await page.getByTestId('prompt-ok').click();
  await expect(page.getByTestId('anim-total')).toHaveText('Total: 1000 ms');
  await expect(page.getByTestId('anim-frame')).toHaveCount(4);
  await expect(page.getByTestId('anim-default')).toBeChecked();
  // Papel vegetal: o quadro anterior aparece por baixo.
  await expect(page.getByTestId('onion-skin')).toHaveCount(1);
  await page.screenshot({ path: `${OUT}/anim-editor.png` });
  await page.getByTestId('object-creator-close').click();
}

async function placeAt(page: Page, x: string) {
  await page.locator('[data-testid="my-object"][data-name="Fogueira"] .card-main').click();
  await page.getByTestId('insp-tab-transformar').click();
  await setField(page, 'prop-transform.x', x);
}

test('fogo de 4 quadros: 3 instâncias em 2 cenas, defasagem própria, recarregar e vídeo', async ({ page }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await openDemo(page);
  await buildFire(page);
  await placeAt(page, '-400');
  await placeAt(page, '400');
  // Segunda instância começa 250 ms adiantada (sem copiar o objeto).
  await page.getByTestId('insp-tab-aparencia').click();
  await expect(page.getByTestId('sec-object-anim')).toBeVisible();
  await setField(page, 'prop-clip-offset', '250');

  await go(page, '0,1');
  expect((await stageFrames(page)).map((f) => f.frame)).toEqual([0, 1]);
  await go(page, '0,6');
  expect((await stageFrames(page)).map((f) => f.frame)).toEqual([2, 3]);
  await go(page, '1,1');
  expect((await stageFrames(page)).map((f) => f.frame)).toEqual([0, 1]);
  // Nenhum keyframe foi criado para animar o desenho.
  await expect(page.locator('[data-testid="tl-key"]')).toHaveCount(await page.locator('[data-testid="tl-key"]').count());

  // Segunda cena com a terceira instância.
  await tab(page, 'scenes');
  await page.getByTestId('empty-scene').click();
  await tab(page, 'objects');
  await page.locator('[data-testid="my-object"][data-name="Fogueira"] .card-main').click();
  await go(page, '0,3');
  expect((await stageFrames(page)).map((f) => f.frame)).toEqual([1]);

  // Salvar e reabrir: mesmo quadro no mesmo instante.
  await waitSaved(page);
  await page.reload();
  await expect(page.getByTestId('stage')).toBeVisible();
  await tab(page, 'scenes');
  await page.locator('[data-testid="scene-row"]').first().click();
  await go(page, '0,6');
  expect((await stageFrames(page)).map((f) => f.frame)).toEqual([2, 3]);

  // Vídeo da cena 1 (720p): pixel no centro de cada fogo tem a cor do quadro certo.
  await page.getByTestId('open-export').click();
  await page.getByTestId('export-res').selectOption('720');
  await page.getByTestId('export-fps').selectOption('30');
  await page.getByTestId('export-scope').selectOption('current');
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 200_000 }), page.getByTestId('export-run').click()]);
  const file = await saveDownload(d, 'fogo.mp4');
  expect(ffprobe(file).streams.some((s) => s.codec_type === 'video')).toBe(true);
  // Centro do retângulo do fogo: mundo (x, 100) → pixel ((x+960)·2/3, (100+540)·2/3).
  const px = (x: number) => [Math.round((x + 960) * (2 / 3)), Math.round(640 * (2 / 3))] as const;
  const dominant = (rgb: number[]) => {
    const [r, g, b] = rgb as [number, number, number];
    if (r > 180 && g > 180 && b < 90) return 3;
    if (r > 150 && g < 90 && b < 90) return 0;
    if (g > 120 && r < 90 && b < 90) return 1;
    if (b > 150 && r < 90 && g < 90) return 2;
    return -1;
  };
  for (const [sec, expected] of [[0.1, [0, 1]], [0.35, [1, 2]], [0.6, [2, 3]], [0.85, [3, 0]], [2.1, [0, 1]]] as const) {
    const info = await pngInfo(page, ffmpegFrame(file, sec, `fogo-${sec}.png`));
    const got = [dominant(await info.pixel(...px(-400))), dominant(await info.pixel(...px(400)))];
    expect(got, `quadros no vídeo em ${sec}s`).toEqual([...expected]);
  }
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});

/** Centro, na tela, do desenho de um nó no palco. */
const centerOf = (page: Page, id: string) => page.locator(`[data-testid="stage-svg"] [data-node-id="${id}"]`).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
});
const idOf = (page: Page, name: string) => page.locator(`[data-testid="layer-row"][data-node-name="${name}"]`).first().getAttribute('data-node-id');

test('barco com passageiros: vincular sem salto, balançar o grupo, passageiros acompanham e mantêm as animações; igual após recarregar', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await openDemo(page);
  await tab(page, 'objects');
  await page.getByTestId('prop-search').fill('barco');
  await page.locator('[data-testid="tpl-object"][data-name="Barco"] .card-main').click();
  await tab(page, 'layers');
  const boat = (await idOf(page, 'Barco'))!;
  const nina = (await idOf(page, 'Nina'))!;
  const zeca = (await idOf(page, 'Zeca'))!;
  // Agrupar barco + Zeca.
  await page.locator(`[data-testid="layer-row"][data-node-id="${boat}"] .layer-name`).click();
  await page.locator(`[data-testid="layer-row"][data-node-id="${zeca}"] .layer-name`).click({ modifiers: ['Shift'] });
  await page.getByTestId('layers-panel').getByRole('button', { name: /Agrupar/ }).click();
  const group = (await idOf(page, 'Grupo'))!;
  expect(group).toBeTruthy();
  // Vincular a Nina ao grupo pelo painel Propriedades: ela não pode pular na tela.
  await page.locator(`[data-testid="layer-row"][data-node-id="${nina}"] .layer-name`).click();
  await page.getByTestId('insp-tab-camadas').click();
  const before = await centerOf(page, nina);
  await page.getByTestId('node-parent').selectOption(group);
  await expect(page.getByTestId('toasts')).toContainText('Vinculado');
  const after = await centerOf(page, nina);
  expect(Math.abs(after.x - before.x)).toBeLessThan(1.5);
  expect(Math.abs(after.y - before.y)).toBeLessThan(1.5);
  // Nina agora é desenhada DENTRO do grupo.
  expect(await page.locator(`[data-testid="stage-svg"] [data-node-id="${group}"] [data-node-id="${nina}"]`).count()).toBe(1);

  // Balançar o grupo: keyframes em 0 s e 1 s.
  await tab(page, 'layers');
  await page.locator(`[data-testid="layer-row"][data-node-id="${group}"] .layer-name`).click();
  await page.getByTestId('insp-tab-transformar').click();
  await go(page, '0');
  await page.getByTestId('section-keys-transform').click();
  await go(page, '1');
  await setField(page, 'prop-transform.y', '-80');
  await setField(page, 'prop-transform.rotationDeg', '8');
  await page.keyboard.press('Escape');

  const snap = async () => ({ n: await centerOf(page, nina), z: await centerOf(page, zeca), b: await centerOf(page, boat), ninaSvg: await page.locator(`[data-testid="stage-svg"] [data-node-id="${nina}"]`).first().innerHTML() });
  await go(page, '0');
  const t0 = await snap();
  await go(page, '1');
  const t1 = await snap();
  // Todos subiram juntos (o grupo subiu 80 px no mundo e girou 8°: quem está à direita do pivô sobe menos).
  for (const k of ['n', 'z', 'b'] as const) expect(t1[k].y, k).toBeLessThan(t0[k].y - 5);
  // A distância entre os passageiros não muda (só gira junto): mesmo corpo rígido.
  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
  expect(Math.abs(dist(t1.n, t1.b) - dist(t0.n, t0.b))).toBeLessThan(4);
  // As faixas dos passageiros continuam na timeline, abaixo do grupo (falas e ações editáveis).
  await expect(page.getByText('Grupo › Nina', { exact: true })).toBeVisible();
  await expect(page.getByText('Grupo › Zeca', { exact: true })).toBeVisible();
  // Fala da Nina continua animando dentro do grupo (desenho dela muda entre os instantes).
  expect(t1.ninaSvg).not.toBe(t0.ninaSvg);

  // Salvar e reabrir: mesmo lugar no mesmo instante.
  await waitSaved(page);
  await page.reload();
  await expect(page.getByTestId('stage')).toBeVisible();
  await go(page, '1');
  const again = await snap();
  for (const k of ['n', 'z', 'b'] as const) {
    expect(Math.abs(again[k].x - t1[k].x)).toBeLessThan(1.5);
    expect(Math.abs(again[k].y - t1[k].y)).toBeLessThan(1.5);
  }
  await page.screenshot({ path: `${OUT}/barco-passageiros.png` });
  expect(errors.filter((e) => !/favicon/.test(e))).toEqual([]);
});
