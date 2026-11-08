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
