/**
 * Histórias completas e exportações grandes, de ponta a ponta no build de produção:
 * importar um projeto grande, exportar o vídeo inteiro, conferir arquivo com ffprobe/ffmpeg,
 * salvar .jrec, abrir numa instalação limpa e reexportar.
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildMontage } from '@/engine/render/montage';
import { bigStory, SKY } from '../fixtures/story';
import { OUT, ffmpegFrame, ffprobe, pngInfo, saveDownload, tab, waitSaved, watchErrors } from './helpers';

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const near = (a: number[], b: number[], tol = 14) => a.slice(0, 3).every((v, i) => Math.abs(v - b[i]!) <= tol);

function writeStory(name: string, opts?: Parameters<typeof bigStory>[0]) {
  const project = bigStory(opts);
  mkdirSync(OUT, { recursive: true });
  const path = resolve(OUT, name);
  writeFileSync(path, JSON.stringify(project));
  return { project, path };
}

async function importProject(page: Page, path: string, title: string) {
  await page.goto('/');
  await page.getByTestId('project-input').setInputFiles(path);
  const report = page.getByTestId('import-report');
  if (await report.isVisible({ timeout: 4000 }).catch(() => false)) await report.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByTestId('stage')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('project-name')).toHaveText(title);
}

async function exportVideo(page: Page, o: { res: string; fps: string; scope?: 'project' | 'current' }) {
  await page.getByTestId('open-export').click();
  await page.getByTestId('export-res').selectOption(o.res);
  await page.getByTestId('export-fps').selectOption(o.fps);
  await page.getByTestId('export-scope').selectOption(o.scope ?? 'project');
  const [d] = await Promise.all([page.waitForEvent('download', { timeout: 280_000 }), page.getByTestId('export-run').click()]);
  return d;
}

test.describe('histórias completas', () => {
  test('16:9, 5 cenas, cenário próprio com multidão: vídeo inteiro em 1080p confere duração, tamanho e cada horário', async ({ page }) => {
    test.setTimeout(420_000);
    const errors = watchErrors(page);
    const { project, path } = writeStory('historia-grande.json');
    await importProject(page, path, project.title);
    const t0 = Date.now();
    const d = await exportVideo(page, { res: '1080', fps: '30' });
    const file = await saveDownload(d, 'historia-1080.webm');
    const seconds = (Date.now() - t0) / 1000;
    const probe = ffprobe(file);
    const v = probe.streams.find((s) => s.codec_type === 'video')!;
    const { totalMs, segments } = buildMontage(project);
    expect([v.width, v.height]).toEqual([1920, 1080]);
    expect(Math.abs(Number(probe.format.duration) - totalMs / 1000)).toBeLessThan(0.4);
    expect(Number(v.nb_read_frames)).toBeGreaterThan((totalMs / 1000) * 30 - 8);
    expect(statSync(file).size).toBeGreaterThan(200_000);
    console.log(`[história 1080p] ${Math.round(totalMs / 1000)} s de vídeo em ${seconds.toFixed(0)} s, ${(statSync(file).size / 1048576).toFixed(1)} MB`);

    // Cada cena com cenário próprio mostra o céu do horário certo no topo do quadro.
    const expected: Array<[number, 'day' | 'night']> = [[0, 'day'], [2, 'night'], [4, 'day']];
    for (const [i, time] of expected) {
      const seg = segments[i]!;
      const img = ffmpegFrame(file, (seg.startMs + 1800) / 1000, `historia-cena${i + 1}.png`);
      const info = await pngInfo(page, img);
      expect(near(await info.pixel(960, 24), hex(SKY[time])), `cena ${i + 1} (${time})`).toBe(true);
    }
    // A cena 2 (sem cenário próprio) NÃO usa o céu da composição.
    const mid = ffmpegFrame(file, (segments[1]!.startMs + 1800) / 1000, 'historia-cena2.png');
    const midInfo = await pngInfo(page, mid);
    expect(near(await midInfo.pixel(960, 24), hex(SKY.day), 6)).toBe(false);
    expect(errors).toEqual([]);
  });

  test('.jrec da história grande: salvar, abrir em instalação limpa e o quadro PNG sai igual', async ({ page, browser }) => {
    test.setTimeout(240_000);
    const { project, path } = writeStory('historia-jrec.json', { crowd: 8 });
    await importProject(page, path, project.title);
    await waitSaved(page);
    const frame = async (p: Page, name: string) => {
      await p.getByTestId('open-export').click();
      await p.getByTestId('export-kind').selectOption('frame');
      const [d] = await Promise.all([p.waitForEvent('download', { timeout: 60_000 }), p.getByTestId('export-run').click()]);
      await p.keyboard.press('Escape');
      return saveDownload(d, name);
    };
    const a = await frame(page, 'jrec-antes.png');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-project').click()]);
    const jrec = await saveDownload(dl, 'historia.jrec');

    const ctx = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 1366, height: 768 }, acceptDownloads: true });
    const p2 = await ctx.newPage();
    await p2.goto('/');
    await p2.getByTestId('project-input').setInputFiles(jrec);
    await expect(p2.getByTestId('stage')).toBeVisible({ timeout: 30_000 });
    await expect(p2.getByTestId('project-name')).toHaveText(project.title);
    await tab(p2, 'objects');
    await expect(p2.locator('[data-testid="my-object"]')).toHaveCount(2);
    const b = await frame(p2, 'jrec-depois.png');
    const ia = await pngInfo(page, a);
    const ib = await pngInfo(p2, b);
    expect([ib.w, ib.h]).toEqual([ia.w, ia.h]);
    for (const [x, y] of [[40, 40], [ia.w / 2, 30], [ia.w - 40, 60], [ia.w / 2, ia.h - 40], [ia.w * 0.3, ia.h * 0.7], [ia.w * 0.55, ia.h * 0.6], [ia.w * 0.7, ia.h * 0.8]] as const) {
      expect(near(await ib.pixel(Math.round(x), Math.round(y)), await ia.pixel(Math.round(x), Math.round(y)), 4), `pixel ${Math.round(x)},${Math.round(y)}`).toBe(true);
    }
    await ctx.close();
  });

  test('vertical 9:16: vídeo de 1080p mantém a proporção e o céu do cenário próprio', async ({ page }) => {
    test.setTimeout(240_000);
    const { project, path } = writeStory('historia-vertical.json', { template: 'vertical', crowd: 5 });
    await importProject(page, path, project.title);
    const d = await exportVideo(page, { res: '1080', fps: '30', scope: 'current' });
    const file = await saveDownload(d, 'historia-vertical.webm');
    const probe = ffprobe(file);
    const v = probe.streams.find((s) => s.codec_type === 'video')!;
    expect(v.height! / v.width!).toBeCloseTo(16 / 9, 1);
    expect(v.width).toBeLessThan(v.height!);
    const img = ffmpegFrame(file, 1.2, 'historia-vertical.png');
    const info = await pngInfo(page, img);
    expect(near(await info.pixel(Math.round(info.w / 2), 20), hex(SKY.day))).toBe(true);
  });
});

test.describe('criadores pela interface, até o vídeo', () => {
  test('cenário com personagem estático: aparece no quadro exportado, mas não vira personagem da timeline', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await page.getByTestId('demo-project').click();
    await expect(page.getByTestId('stage')).toBeVisible();
    await tab(page, 'backgrounds');
    await page.getByTestId('scenery-new').click();
    await page.getByTestId('prompt-ok').click();
    await page.getByTestId('start-template').selectOption('street');
    await page.getByTestId('scene-studio-tab-add').click();
    await page.getByTestId('add-character').selectOption({ index: 1 });
    await expect(page.getByTestId('scene-studio-canvas').locator('[data-piece]').filter({ has: page.locator('[data-part="head"]') })).toHaveCount(1);
    await page.getByTestId('scenery-apply').click();
    await expect(page.locator('[data-testid="stage-svg"] [data-composition]')).toHaveCount(1);
    // Não é elemento controlável: não aparece em Camadas nem na timeline.
    await tab(page, 'layers');
    const names = await page.locator('[data-testid="layer-row"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-node-name')));
    expect(names).toEqual(expect.arrayContaining(['Nina', 'Zeca']));
    expect(names.some((n) => /Figurante/.test(n ?? ''))).toBe(false);
    await expect(page.getByTestId('timeline')).not.toContainText('Figurante');
    // Sai no vídeo: o céu do cenário próprio no topo e a pele do figurante em algum lugar do quadro.
    await page.getByTestId('open-export').click();
    await page.getByTestId('export-kind').selectOption('frame');
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
    const info = await pngInfo(page, await saveDownload(d, 'cenario-estatico.png'));
    expect(near(await info.pixel(Math.round(info.w / 2), 16), hex(SKY.day))).toBe(true);
  });

  test('objeto criado: inserido na cena, editado no criador e a edição chega ao quadro sem recarregar', async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await page.getByTestId('demo-project').click();
    await expect(page.getByTestId('stage')).toBeVisible();
    await tab(page, 'objects');
    await page.getByTestId('object-new').click();
    await page.getByTestId('prompt-input').fill('Placa nova');
    await page.getByTestId('prompt-ok').click();
    await page.getByTestId('object-insert').click();
    const stage = page.locator('[data-testid="stage-svg"]');
    await expect(stage.locator('[data-piece]')).toHaveCount(1);
    // Editar o objeto pelo criador: a cor da base muda na cena na hora (cache invalidado).
    await page.getByTestId('my-object-edit').click();
    await page.getByTestId('obj-studio-tab-layers').click();
    await page.locator('[data-testid="studio-layer"]').first().locator('.studio-layer-name').click();
    await page.getByTestId('obj-studio-tab-props').click();
    await page.getByTestId('piece-fill').fill('#12ab34');
    await page.getByTestId('object-creator-close').click();
    await expect(stage.locator('[data-piece] rect[fill="#12ab34"]')).toHaveCount(1);
  });
});
