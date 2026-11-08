/** Os 20 fluxos E2E exigidos, no build de produção, em Chrome. */
import { expect, test } from '@playwright/test';
import { resolve } from 'node:path';
import { readJrec, svgFile } from './helpers';
import { assertNoBodyOverflow, boxOf, ffmpegFrame, ffprobe, inViewport, makeWav, openDemo, pngInfo, saveDownload, selectLayer, setField, silenceStarts, tab, waitSaved, watchErrors } from './helpers';

test.describe('fluxos principais', () => {
  test('1. criar projeto, Nina/Zeca, cenário, reproduzir, salvar, recarregar, persistir', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await page.getByTestId('new-project').click();
    await tab(page, 'characters');
    await page.locator('[data-testid="builtin-character"][data-name="Nina"]').click();
    await page.locator('[data-testid="builtin-character"][data-name="Zeca"]').click();
    await tab(page, 'backgrounds');
    await page.locator('[data-testid="bg-card"][data-bg="parque"]').click();
    await tab(page, 'layers');
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Nina"]')).toBeVisible();
    await page.getByTestId('play').click();
    await expect(page.getByTestId('stage-mode')).toContainText('Reproduzindo');
    await page.waitForTimeout(400);
    const clock = await page.getByTestId('clock').textContent();
    expect(clock).not.toBe('00:00:000');
    await page.getByTestId('play').click();
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId('stage')).toBeVisible();
    await tab(page, 'layers');
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Zeca"]')).toBeVisible();
    await expect(page.getByTestId('project-name')).toHaveText('Novo projeto');
    expect(await page.getByTestId('stage-svg').innerHTML()).toContain('data-part="mouth"');
    expect(errors).toEqual([]);
  });

  test('2. cabelo branco vale em nova cena; posições são próprias de cada cena', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Nina');
    await page.getByTestId('edit-library').click();
    await page.getByTestId('creator-tab-cabelo').click();
    await page.getByRole('button', { name: 'Cor #f4f1ea' }).click();
    await page.getByTestId('creator-done').click();
    await setField(page, 'prop-transform.x', '-500');
    await tab(page, 'scenes');
    await page.getByTestId('duplicate-scene').click();
    await expect(page.getByTestId('scene-count')).toHaveText('2');
    await selectLayer(page, 'Nina');
    await setField(page, 'prop-transform.x', '200');
    expect(await page.getByTestId('stage-svg').innerHTML()).toContain('#f4f1ea');
    await tab(page, 'scenes');
    await page.getByTestId('scene-row').first().locator('.scene-open').click();
    expect(await page.getByTestId('stage-svg').innerHTML()).toContain('#f4f1ea');
    await selectLayer(page, 'Nina');
    await expect(page.getByTestId('prop-transform.x').locator('input[type="text"]')).toHaveValue('-500');
  });

  test('3. Nina e Zeca se olham: nariz e pupilas no lado certo, no DOM real', async ({ page }) => {
    await openDemo(page);
    const info = await page.evaluate(() => {
      const res: Record<string, { tip: number; pupil: number; view: string; x: number }> = {};
      for (const g of document.querySelectorAll('[data-testid="stage-svg"] [data-node-id]')) {
        const root = g.querySelector('[data-part="root"]');
        if (!root) continue;
        const nose = g.querySelector('[data-part="nose"]');
        const eye = g.querySelector('[data-part="eye"]');
        const m = (g as SVGGElement).getAttribute('transform')!.match(/translate\((-?[\d.]+)/)!;
        res[Number(m[1]) < 0 ? 'nina' : 'zeca'] = { tip: Number(nose?.getAttribute('data-tip-x')), pupil: Number(eye?.getAttribute('data-pupil-x')), view: root.getAttribute('data-head-view')!, x: Number(m[1]) };
      }
      return res;
    });
    expect(info.nina!.x).toBeLessThan(info.zeca!.x);
    expect(info.nina!.tip).toBeGreaterThan(0);
    expect(info.nina!.pupil).toBeGreaterThan(0);
    expect(info.nina!.view).toMatch(/right/);
    expect(info.zeca!.tip).toBeLessThan(0);
    expect(info.zeca!.pupil).toBeLessThan(0);
    expect(info.zeca!.view).toMatch(/left/);
    await page.getByTestId('toggle-gaze').check();
    await expect(page.locator('[data-testid^="gaze-arrow-"]')).toHaveCount(2);
    await page.screenshot({ path: resolve('docs/capturas/nina-zeca-setas.png') });
    await page.getByTestId('toggle-gaze').uncheck();
    await page.screenshot({ path: resolve('docs/capturas/nina-zeca-sem-setas.png') });
  });

  test('4. trocar expressões e falar nunca gera segunda boca', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Nina');
    const check = async () => {
      const counts = await page.evaluate(() => [...document.querySelectorAll('[data-testid="stage-svg"] [data-part="face"]')].map((f) => f.querySelectorAll('[data-part="mouth"]').length));
      expect(counts.length).toBeGreaterThan(0);
      for (const c of counts) expect(c).toBe(1);
    };
    for (const ex of ['angry', 'laughing', 'surprised', 'crying', 'love', 'neutral']) {
      await page.getByTestId('expression').selectOption(ex);
      await check();
    }
    await page.getByTestId('time-input').fill('1');
    await page.getByTestId('time-input').press('Enter');
    await check();
    await page.getByTestId('play').click();
    for (let i = 0; i < 12; i++) {
      await check();
      await page.waitForTimeout(90);
    }
    await page.getByTestId('play').click();
  });

  test('5. X=-150,5, escala=125, rotação=-35 atualizam campo e palco', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Zeca');
    await setField(page, 'prop-transform.x', '-150,5');
    await setField(page, 'prop-scale', '125');
    await setField(page, 'prop-transform.rotationDeg', '-35');
    const value = (id: string) => page.getByTestId(id).locator('input[type="text"]').inputValue();
    expect(await value('prop-transform.x')).toBe('-150,5');
    expect(await value('prop-scale')).toBe('125');
    expect(await value('prop-transform.rotationDeg')).toBe('-35');
    expect(await page.getByTestId('prop-transform.x').locator('input[type="range"]').inputValue()).toBe('-150.5');
    const transforms = await page.evaluate(() => [...document.querySelectorAll('[data-testid="stage-svg"] [data-node-id]')].map((g) => g.getAttribute('transform')));
    expect(transforms.some((t) => t?.includes('translate(-150.5 420)') && t.includes('rotate(-35)') && t.includes('scale(1.2500'))).toBe(true);
  });

  test('6. mesa acima de Nina a oculta; inverter a ordem inverte preview e PNG', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Nina');
    await setField(page, 'prop-transform.x', '0');
    await tab(page, 'objects');
    await page.locator('[data-testid="prop-card"][data-prop="table"]').click();
    await setField(page, 'prop-transform.x', '0');
    await setField(page, 'prop-transform.y', '420');
    await page.getByTestId('sec-layer').getByRole('button', { name: 'Camada' }).click();
    await page.getByTestId('node-name').fill('Mesa');
    const pixelAt = async (name: string) => {
      await page.getByTestId('open-export').click();
      await page.getByTestId('export-kind').selectOption('frame');
      await page.getByTestId('export-res').selectOption('720');
      const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
      const p = await saveDownload(d, name);
      await page.getByTestId('modal-close').click();
      const info = await pngInfo(page, p);
      expect(info.w).toBe(1280);
      expect(info.h).toBe(720);
      // Ponto na mesa: tampo fica em y=230 do mundo; o pixel é (x+960)*2/3, (y+540)*2/3.
      return info.pixel(Math.round((10 + 960) * (2 / 3)), Math.round((246 + 540) * (2 / 3)));
    };
    const tableOnTop = await pixelAt('mesa-frente.png');
    expect(Math.abs(tableOnTop[0]! - 0xa6)).toBeLessThan(40);
    await tab(page, 'layers');
    const order = async () => page.locator('[data-testid="layer-row"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-node-name')));
    const mesaRow = page.locator('[data-testid="layer-row"][data-node-name="Mesa"]');
    await expect((await order())[0]).toBe('Mesa');
    await expect(mesaRow.getByTestId('layer-up')).toBeDisabled();
    while ((await order()).indexOf('Mesa') < (await order()).indexOf('Nina')) await mesaRow.getByTestId('layer-down').click();
    const svgOrder = await page.evaluate(() => [...document.querySelectorAll('[data-testid="stage-svg"] [data-node-id]')].map((g) => g.getAttribute('data-node-id')));
    expect(svgOrder.length).toBeGreaterThan(2);
    const behind = await pixelAt('mesa-atras.png');
    expect(behind.join()).not.toBe(tableOnTop.join());
  });

  test('7. 200 cenas: botões sempre visíveis, sem rolagem do body', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'scenes');
    await page.evaluate(() => undefined);
    const btn = page.getByTestId('empty-scene');
    for (let i = 0; i < 199; i++) await btn.click({ noWaitAfter: true });
    await expect(page.getByTestId('scene-count')).toHaveText('200');
    const vp = page.viewportSize()!;
    const list = page.getByTestId('scene-list');
    for (const pos of [0, 5000, 100000]) {
      await list.evaluate((el, p) => { el.scrollTop = p; }, pos);
      await page.waitForTimeout(60);
      expect(inViewport(await boxOf(page, 'duplicate-scene'), vp)).toBe(true);
      expect(inViewport(await boxOf(page, 'empty-scene'), vp)).toBe(true);
      await assertNoBodyOverflow(page);
    }
    // Virtualização: o DOM não cresce com o número de cenas.
    expect(await page.getByTestId('scene-row').count()).toBeLessThan(40);
    const scrollInfo = await list.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
    expect(scrollInfo.sh).toBeGreaterThan(scrollInfo.ch);
    await page.screenshot({ path: resolve('docs/capturas/200-cenas.png') });
  });

  test('8. excluir cena intermediária e mover: ordem de reprodução muda', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'scenes');
    await page.getByTestId('empty-scene').click();
    await page.getByTestId('empty-scene').click();
    const names = () => page.locator('[data-testid="scene-row"] .scene-info strong').allTextContents();
    expect(await names()).toEqual(['Você sabe dançar?', 'Cena 2', 'Cena 3']);
    await page.getByTestId('scene-row').nth(1).getByTestId('scene-delete').click();
    await page.getByTestId('confirm-ok').click();
    expect(await names()).toEqual(['Você sabe dançar?', 'Cena 3']);
    await page.getByTestId('scene-row').nth(1).getByTestId('scene-up').click();
    expect(await names()).toEqual(['Cena 3', 'Você sabe dançar?']);
    await page.getByTestId('project-mode').click();
    await expect(page.getByTestId('project-bar')).toContainText('cena 1 de 2');
    await page.getByTestId('project-mode').click();
  });
});

test.describe('mobile', () => {
  test('9. 390×844: palco, timeline e dock; popup acima do dock, sem escondê-lo', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemo(page);
    await expect(page.getByTestId('editor-mobile')).toBeVisible();
    const vp = { width: 390, height: 844 };
    const dockBefore = await boxOf(page, 'mobile-dock');
    expect(inViewport(dockBefore, vp)).toBe(true);
    expect(dockBefore.y + dockBefore.height).toBeCloseTo(844, 0);
    await expect(page.getByTestId('stage')).toBeVisible();
    await expect(page.getByTestId('timeline')).toBeVisible();
    await page.getByTestId('dock-characters').click();
    const popup = await boxOf(page, 'mobile-popup');
    const dock = await boxOf(page, 'mobile-dock');
    expect(popup.y + popup.height).toBeCloseTo(dock.y, 0);
    expect(dock).toEqual(dockBefore);
    const stage = await boxOf(page, 'stage');
    expect(popup.y).toBeGreaterThan(stage.y + 80);
    await assertNoBodyOverflow(page);
    await page.getByTestId('popup-close').click();
    await expect(page.getByTestId('mobile-popup')).toHaveCount(0);
    await expect(page.getByTestId('mobile-dock')).toBeVisible();
  });

  test('10. 375×667: popup rolável, ações fixas, campos numéricos e sem overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await openDemo(page);
    await page.getByTestId('dock-layers').click();
    await page.locator('[data-testid="layer-row"][data-node-name="Zeca"] .layer-name').click();
    await page.getByTestId('dock-properties').click();
    const popup = await boxOf(page, 'mobile-popup');
    const stage = await boxOf(page, 'stage');
    expect(popup.y).toBeGreaterThan(stage.y + 60);
    await page.getByTestId('prop-transform.x').locator('input[type="text"]').scrollIntoViewIfNeeded();
    await setField(page, 'prop-transform.x', '-30');
    await setField(page, 'prop-scale', '125');
    await setField(page, 'prop-transform.rotationDeg', '8');
    expect(await page.getByTestId('prop-scale').locator('input[type="text"]').inputValue()).toBe('125');
    await expect(page.getByTestId('prop-scale').locator('input[type="text"]')).toHaveAttribute('inputmode', 'decimal');
    const scroller = page.getByTestId('mobile-popup').locator('.panel-scroll').first();
    const stageY = (await boxOf(page, 'stage')).y;
    await scroller.evaluate((el) => { el.scrollTop = 400; });
    expect((await boxOf(page, 'stage')).y).toBe(stageY);
    expect(await scroller.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await assertNoBodyOverflow(page);
    await page.getByTestId('popup-close').click();
    await page.getByTestId('dock-scenes').click();
    const vp = { width: 375, height: 667 };
    expect(inViewport(await boxOf(page, 'empty-scene'), vp)).toBe(true);
    const footer = await boxOf(page, 'scene-footer');
    const dock = await boxOf(page, 'mobile-dock');
    expect(footer.y + footer.height).toBeLessThanOrEqual(dock.y + 0.5);
    // Botões principais têm área de toque confortável.
    const size = await boxOf(page, 'dock-scenes');
    expect(size.height).toBeGreaterThanOrEqual(44);
  });

  test('tocar em um elemento do palco abre suas propriedades, sem perder a seleção', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemo(page);
    const st = await boxOf(page, 'stage');
    await page.mouse.click(st.x + st.width * 0.32, st.y + st.height * 0.52);
    await expect(page.getByTestId('mobile-popup')).toBeVisible();
    await expect(page.getByTestId('selected-name')).toHaveText('Nina');
    await page.getByTestId('dock-characters').click();
    await page.getByTestId('dock-properties').click();
    await expect(page.getByTestId('selected-name')).toHaveText('Nina');
  });

  test('paisagem de celular tem layout próprio e usa a largura', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await openDemo(page);
    const stage = await boxOf(page, 'stage');
    const tl = await boxOf(page, 'timeline');
    expect(tl.x).toBeGreaterThanOrEqual(stage.x + stage.width - 1);
    await page.getByTestId('dock-characters').click();
    const popup = await boxOf(page, 'mobile-popup');
    expect(popup.x).toBeGreaterThan(stage.x + 200);
    await assertNoBodyOverflow(page);
  });
});

test.describe('dados e mídia', () => {
  test('11. projeto 0.4: importar, relatório, salvar, recarregar, exportar', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('project-input').setInputFiles(resolve('tests/fixtures/projeto-0.4.json'));
    await expect(page.getByTestId('import-report')).toBeVisible();
    await expect(page.getByTestId('report-counts')).toContainText('2 cena(s)');
    await page.getByTestId('import-report').getByRole('button', { name: 'Continuar' }).click();
    await tab(page, 'scenes');
    await expect(page.locator('[data-testid="scene-row"] .scene-info strong').first()).toHaveText('Você sabe dançar?');
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId('project-name')).toHaveText('Minha animação');
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-project').click()]);
    expect(d.suggestedFilename()).toMatch(/\.jrec$/);
    const { manifest, project } = readJrec(await saveDownload(d, 'reexport.jrec'));
    expect(manifest.format).toBe('recorte-studio-project');
    expect(manifest.appVersion).toBe('1.1.0');
    expect(project.schemaVersion).toBe(1);
    expect(project.sceneOrder).toHaveLength(2);
  });

  test('12. importar áudio, onda, reproduzir com boca por intensidade', async ({ page }) => {
    const errors = watchErrors(page);
    const wav = makeWav(2);
    await openDemo(page);
    await page.getByTestId('audio-input').setInputFiles(wav);
    const clip = page.getByTestId('tl-clip-audio');
    await expect(clip).toBeVisible({ timeout: 15000 });
    await expect(clip.locator('.waveform path')).toHaveAttribute('d', /M/);
    await clip.click();
    await page.getByTestId('audio-lipsync').selectOption({ label: 'Nina' });
    await setField(page, 'clip-start', '0');
    // Tom ligado de 0 a 0,25 s e desligado de 0,25 a 0,5 s: a boca precisa acompanhar.
    const mouth = async () => page.evaluate(() => {
      const m = [...document.querySelectorAll('[data-testid="stage-svg"] [data-part="mouth"]')].map((x) => Number(x.getAttribute('data-open')));
      return Math.max(...m);
    });
    const at = async (s: string) => {
      await page.getByTestId('time-input').fill(s);
      await page.getByTestId('time-input').press('Enter');
      await page.waitForTimeout(80);
    };
    await at('0,1');
    const openMouth = await mouth();
    await at('0,35');
    const closedMouth = await mouth();
    expect(openMouth).toBeGreaterThan(closedMouth);
    await page.getByTestId('play').click();
    await page.waitForTimeout(600);
    const clock = await page.getByTestId('clock').textContent();
    expect(clock).not.toBe('00:00:350');
    await page.getByTestId('play').click();
    // Áudio persiste depois de recarregar.
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId('tl-clip-audio')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('13. PNG e sequência: dimensões, sem guias, ordem correta', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('toggle-grid').click();
    await selectLayer(page, 'Nina');
    await page.getByTestId('open-export').click();
    await page.getByTestId('export-kind').selectOption('frame');
    await page.getByTestId('export-res').selectOption('480');
    await expect(page.getByTestId('export-size')).toContainText('854×480');
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
    const png = await saveDownload(d, 'quadro.png');
    const info = await pngInfo(page, png);
    expect([info.w, info.h]).toEqual([854, 480]);
    // Linha da grade de terços (x=1/3) não pode aparecer: compara com a vizinhança.
    const a = await info.pixel(Math.round(854 / 3), 5);
    const b = await info.pixel(Math.round(854 / 3) + 6, 5);
    expect(Math.abs(a[0]! - b[0]!)).toBeLessThan(25);
    await page.getByTestId('export-kind').selectOption('sequence');
    await page.getByTestId('export-fps').selectOption('24');
    await page.getByTestId('export-scope').selectOption('range');
    const inputs = page.locator('[data-testid="export-dialog"] .snf input[type="text"]');
    await inputs.nth(1).fill('0,5');
    await inputs.nth(1).press('Enter');
    const [z] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByTestId('export-run').click()]);
    const zip = await saveDownload(z, 'seq.zip');
    const { unzipSync } = await import('fflate');
    const entries = Object.keys(unzipSync(new Uint8Array((await import('node:fs')).readFileSync(zip))));
    expect(entries).toHaveLength(12);
    expect(entries[0]).toBe('quadro_000000.png');
  });

  test('14. WebM real: reproduzível, duração, dimensões e áudio', async ({ page }) => {
    const wav = makeWav(2);
    await openDemo(page);
    await page.getByTestId('audio-input').setInputFiles(wav);
    await expect(page.getByTestId('tl-clip-audio')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('open-export').click();
    await page.getByTestId('export-res').selectOption('480');
    await page.getByTestId('export-fps').selectOption('24');
    await expect(page.getByTestId('export-support')).toContainText('WebCodecs');
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 80000 }), page.getByTestId('export-run').click()]);
    const path = await saveDownload(d, 'cena.webm');
    await expect(page.getByTestId('export-result')).toContainText('com áudio');
    const probe = ffprobe(path);
    const v = probe.streams.find((s) => s.codec_type === 'video')!;
    const a = probe.streams.find((s) => s.codec_type === 'audio')!;
    expect(v.width).toBe(854);
    expect(v.height).toBe(480);
    expect(a.codec_name).toBe('opus');
    expect(Number(v.nb_read_frames)).toBe(216);
    expect(Math.abs(Number(probe.format.duration) - 9)).toBeLessThan(0.25);
    // O tom liga e desliga a cada 0,25 s: o silêncio começa onde deveria, sem desvio.
    const silences = silenceStarts(path);
    expect(silences.length).toBeGreaterThan(2);
    expect(Math.abs(silences[0]! - 0.25)).toBeLessThan(0.05);
    expect(Math.abs(silences[1]! - 0.75)).toBeLessThan(0.05);
    // Primeiro e último quadros decodificam e têm conteúdo (não pretos).
    for (const [t, name] of [[0.1, 'webm-first.png'], [8.8, 'webm-last.png']] as const) {
      const img = ffmpegFrame(path, t, name);
      const info = await pngInfo(page, img);
      const px = await info.pixel(420, 240);
      expect(px[0]! + px[1]! + px[2]!).toBeGreaterThan(60);
    }
  });

  test('MP4 só aparece quando há codificador, e funciona de verdade', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('open-export').click();
    const has = await page.locator('[data-testid="export-format"] option[value="mp4"]').count();
    test.skip(has === 0, 'Sem H.264 neste Chrome');
    await page.getByTestId('export-format').selectOption('mp4');
    await page.getByTestId('export-res').selectOption('480');
    await page.getByTestId('export-fps').selectOption('24');
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 80000 }), page.getByTestId('export-run').click()]);
    const probe = ffprobe(await saveDownload(d, 'cena.mp4'));
    expect(probe.streams[0]!.codec_name).toBe('h264');
  });

  test('projeto completo: montagem com transição respeita a ordem e a duração', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'scenes');
    await page.getByTestId('duplicate-scene').click();
    await page.getByTestId('transition-in').selectOption('crossfade');
    await page.getByTestId('open-export').click();
    await page.getByTestId('export-res').selectOption('480');
    await page.getByTestId('export-fps').selectOption('24');
    await page.getByTestId('export-scope').selectOption('project');
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 85000 }), page.getByTestId('export-run').click()]);
    const probe = ffprobe(await saveDownload(d, 'projeto.webm'));
    expect(Math.abs(Number(probe.format.duration) - 17.5)).toBeLessThan(0.3);
  });

  test('preview e exportação combinam: mesmo quadro, pixel a pixel aproximado', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await openDemo(page);
    await page.getByTestId('time-input').fill('1');
    await page.getByTestId('time-input').press('Enter');
    await page.getByTestId('toggle-frame-only').click();
    await page.waitForTimeout(200);
    const stage = page.getByTestId('stage');
    const size = (await stage.boundingBox())!;
    const stagePng = resolve('test-results/e2e/preview-stage.png');
    await stage.screenshot({ path: stagePng });
    await page.getByTestId('open-export').click();
    await page.getByTestId('export-kind').selectOption('frame');
    await page.getByTestId('export-res').selectOption('720');
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
    const png = await saveDownload(d, 'preview-export.png');
    const { readFileSync } = await import('node:fs');
    const diff = await page.evaluate(async ({ a, b, w, h }) => {
      const load = async (s: string) => { const i = new Image(); i.src = `data:image/png;base64,${s}`; await i.decode(); return i; };
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const k = Math.min(w / 1920, h / 1080);
      const fw = 1920 * k;
      const fh = 1080 * k;
      const fx = (w - fw) / 2;
      const fy = (h - fh) / 2;
      const px = (draw: (c: CanvasRenderingContext2D) => void) => {
        const c = document.createElement('canvas');
        c.width = 192;
        c.height = 108;
        const x = c.getContext('2d')!;
        draw(x);
        return x.getImageData(0, 0, 192, 108).data;
      };
      const A = px((x) => x.drawImage(ia, fx, fy, fw, fh, 0, 0, 192, 108));
      const B = px((x) => x.drawImage(ib, 0, 0, 192, 108));
      let sum = 0;
      for (let i = 0; i < A.length; i += 4) sum += (Math.abs(A[i]! - B[i]!) + Math.abs(A[i + 1]! - B[i + 1]!) + Math.abs(A[i + 2]! - B[i + 2]!)) / 3;
      return sum / (A.length / 4);
    }, { a: readFileSync(stagePng).toString('base64'), b: readFileSync(png).toString('base64'), w: size.width, h: size.height });
    expect(diff).toBeLessThan(10);
  });

  test('cancelar a exportação interrompe sem baixar arquivo', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('open-export').click();
    await page.getByTestId('export-fps').selectOption('60');
    await page.getByTestId('export-res').selectOption('1080');
    let downloaded = false;
    page.on('download', () => { downloaded = true; });
    await page.getByTestId('export-run').click();
    await expect(page.getByTestId('export-progress')).toBeVisible();
    await page.getByTestId('export-cancel').click();
    await expect(page.getByTestId('export-error')).toContainText('cancelada', { timeout: 15000 });
    expect(downloaded).toBe(false);
    await expect(page.getByTestId('export-run')).toBeEnabled();
  });

  test('15. 16:9 ↔ 9:16 não desloca nós e o export respeita a moldura', async ({ page }) => {
    await openDemo(page);
    const positions = () => page.evaluate(() => [...document.querySelectorAll('[data-testid="stage-svg"] [data-node-id]')].map((g) => g.getAttribute('transform')));
    const before = await positions();
    await page.getByTestId('open-settings').click();
    await page.getByTestId('aspect').selectOption('9:16');
    await page.getByTestId('modal-close').click();
    expect(await positions()).toEqual(before);
    await page.getByTestId('open-export').click();
    await page.getByTestId('export-kind').selectOption('frame');
    await page.getByTestId('export-res').selectOption('720');
    await expect(page.getByTestId('export-size')).toContainText('720×1280');
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
    const info = await pngInfo(page, await saveDownload(d, 'vertical.png'));
    expect([info.w, info.h]).toEqual([720, 1280]);
    await page.getByTestId('modal-close').click();
    await page.getByTestId('open-settings').click();
    await page.getByTestId('aspect').selectOption('16:9');
    await page.getByTestId('modal-close').click();
    expect(await positions()).toEqual(before);
  });

  test('16. desfazer/refazer exclusão de personagem, camada e cena', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Zeca');
    await page.getByTestId('delete-node').click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Zeca"]')).toHaveCount(0);
    await page.getByTestId('undo').click();
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Zeca"]')).toHaveCount(1);
    await expect(page.getByTestId('timeline')).toContainText('Fala · Zeca');
    await page.getByTestId('redo').click();
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Zeca"]')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Zeca"]')).toHaveCount(1);
    await tab(page, 'scenes');
    await page.getByTestId('empty-scene').click();
    await page.getByTestId('scene-row').nth(1).getByTestId('scene-delete').click();
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('scene-count')).toHaveText('1');
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('scene-count')).toHaveText('2');
    await page.keyboard.press('Control+y');
    await expect(page.getByTestId('scene-count')).toHaveText('1');
  });

  test('17. template completo vira projeto próprio, editável e salvo', async ({ page }) => {
    await page.goto('/');
    await page.locator('[data-testid="project-template-card"][data-template="episodio"]').click();
    await tab(page, 'scenes');
    await expect(page.getByTestId('scene-count')).toHaveText('5');
    await page.getByTestId('scene-row').nth(2).locator('.scene-open').click();
    await selectLayer(page, 'Nina');
    await setField(page, 'prop-transform.x', '-111');
    await waitSaved(page);
    await page.getByTestId('back-projects').click();
    await expect(page.locator('[data-testid="project-card"]').first()).toContainText('Episódio');
    await page.locator('[data-testid="project-card"] .project-open').first().click();
    await expect(page.getByTestId('project-name')).toHaveText(/Episódio/);
  });

  test('18. busca com e sem acento', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'objects');
    await page.getByTestId('prop-search').fill('sofa');
    await expect(page.locator('[data-testid="prop-card"][data-prop="sofa"]')).toBeVisible();
    await page.getByTestId('prop-search').fill('SOFÁ');
    await expect(page.locator('[data-testid="prop-card"][data-prop="sofa"]')).toBeVisible();
    await tab(page, 'backgrounds');
    await page.getByTestId('bg-search').fill('escritório');
    await expect(page.locator('[data-testid="bg-card"][data-bg="escritorio"]')).toBeVisible();
    await page.getByTestId('bg-search').fill('escritorio');
    await expect(page.locator('[data-testid="bg-card"][data-bg="escritorio"]')).toBeVisible();
    await tab(page, 'templates');
    await page.getByTestId('template-search').fill('noticia');
    await expect(page.locator('[data-testid="template-row"][data-template="urgente"]')).toBeVisible();
  });

  test('19. SVG malicioso é sanitizado e nunca executa', async ({ page }) => {
    const errors = watchErrors(page);
    await openDemo(page);
    await tab(page, 'objects');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" onload="window.__pwned=1"><script>window.__pwned=1</script><image href="x" onerror="window.__pwned=1"/><foreignObject><iframe src="javascript:window.__pwned=1"></iframe></foreignObject><rect width="100" height="100" fill="#3a8" onclick="window.__pwned=1"/></svg>`;
    await page.getByTestId('image-input').setInputFiles({ name: 'mal.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svg) });
    await expect(page.getByTestId('toasts')).toContainText('sanitizado');
    await tab(page, 'layers');
    await expect(page.locator('[data-testid="layer-row"][data-node-name="mal.svg"]')).toBeVisible();
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
    const html = await page.getByTestId('stage-svg').innerHTML();
    expect(html).not.toContain('onload');
    expect(errors.filter((e) => /pageerror/.test(e))).toEqual([]);
  });

  test('20. offline: o build não depende de rede', async ({ page, context }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      const url = new URL(r.url());
      if (url.protocol.startsWith('http') && url.hostname !== 'localhost') external.push(r.url());
    });
    await page.goto('/');
    await page.getByTestId('demo-project').click();
    await expect(page.getByTestId('stage')).toBeVisible();
    expect(external).toEqual([]);
    await context.setOffline(true);
    await tab(page, 'characters');
    await page.locator('[data-testid="builtin-character"][data-name="Bia"]').click();
    await tab(page, 'templates');
    await page.locator('[data-testid="template-row"][data-template="aula"]').getByTestId('template-add').click();
    await page.getByTestId('open-export').click();
    await page.getByTestId('export-kind').selectOption('frame');
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
    expect(d.suggestedFilename()).toMatch(/\.png$/);
    await context.setOffline(false);
    expect(external).toEqual([]);
  });

  test('dist/index.html abre direto do disco (file://), salva e exporta', async ({ browser }) => {
    const ctx = await browser.newContext({ acceptDownloads: true, baseURL: undefined, viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    const errors = watchErrors(page);
    await page.goto(`file:///${resolve('dist/index.html').replace(/\\/g, '/')}`);
    await page.getByTestId('demo-project').click();
    await expect(page.getByTestId('stage')).toBeVisible();
    await waitSaved(page);
    await page.reload();
    await expect(page.getByTestId('project-name')).toHaveText('Você sabe dançar?');
    await page.getByTestId('open-export').click();
    await page.getByTestId('export-kind').selectOption('frame');
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-run').click()]);
    expect(d.suggestedFilename()).toMatch(/\.png$/);
    expect(errors).toEqual([]);
    await ctx.close();
  });

  test('.jrec leva projeto e mídia para outra instalação limpa', async ({ page, browser }) => {
    const wav = makeWav(1);
    await openDemo(page);
    await page.getByTestId('audio-input').setInputFiles(wav);
    await expect(page.getByTestId('tl-clip-audio')).toBeVisible({ timeout: 15000 });
    await waitSaved(page);
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-project').click()]);
    const zip = await saveDownload(d, 'pacote.jrec');
    const { manifest } = readJrec(zip);
    expect(manifest.assets.length).toBeGreaterThan(0);
    expect(manifest.missing).toEqual([]);
    const ctx2 = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 1366, height: 768 } });
    const p2 = await ctx2.newPage();
    await p2.goto('/');
    await p2.getByTestId('project-input').setInputFiles(zip);
    await expect(p2.getByTestId('tl-clip-audio')).toBeVisible();
    await p2.getByTestId('play').click();
    await p2.waitForTimeout(500);
    await p2.getByTestId('play').click();
    await ctx2.close();
  });
});

test.describe('timeline e criador', () => {
  test('keyframes: criar, mover por campo, interpolar e excluir', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Zeca');
    await page.getByTestId('key-transform.x').click();
    await page.getByTestId('time-input').fill('2');
    await page.getByTestId('time-input').press('Enter');
    await setField(page, 'prop-transform.x', '0');
    await expect(page.getByTestId('key-transform.x')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('time-input').fill('1');
    await page.getByTestId('time-input').press('Enter');
    await expect(page.getByTestId('prop-transform.x').locator('input[type="text"]')).toHaveValue('170');
    await page.getByRole('button', { name: /Expandir propriedades de Zeca/ }).click();
    await page.getByTestId('tl-key').first().click();
    await expect(page.getByTestId('sec-key')).toBeVisible();
    await page.getByTestId('key-interp').selectOption('hold');
    await page.getByTestId('time-input').fill('1');
    await page.getByTestId('time-input').press('Enter');
    await page.getByTestId('tl-key').first().click();
    await page.getByTestId('delete-key').click();
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('tl-key').first()).toBeVisible();
  });

  test('ação inserida vira clip e pode ser convertida em keyframes', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Nina');
    await page.getByTestId('action-select').selectOption('wave');
    await page.getByTestId('add-action').click();
    const clip = page.locator('[data-testid="tl-clip-action"]').filter({ hasText: 'Acenar' });
    await expect(clip).toBeVisible();
    await clip.click();
    await page.getByTestId('bake-clip').click();
    await expect(clip).toHaveCount(0);
    await expect(page.getByTestId('toasts')).toContainText('keyframes');
  });

  test('arrastar clip e keyframe gera uma entrada de histórico', async ({ page }) => {
    await openDemo(page);
    const clip = page.locator('[data-testid="tl-clip-dialogue"]').filter({ hasText: 'Você sabe' });
    const b = (await clip.boundingBox())!;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(b.x + b.width / 2 + i * 12, b.y + b.height / 2);
    await page.mouse.up();
    const after = (await clip.boundingBox())!;
    expect(after.x).toBeGreaterThan(b.x + 60);
    await page.getByTestId('undo').click();
    await expect.poll(async () => (await clip.boundingBox())!.x).toBeCloseTo(b.x, 0);
  });

  test('criador: 8 vistas reais, cabelo, roupa e nome', async ({ page }) => {
    const errors = watchErrors(page);
    await openDemo(page);
    await tab(page, 'characters');
    await page.getByTestId('create-character').click();
    await expect(page.getByTestId('creator')).toBeVisible();
    const preview = page.getByTestId('creator-preview');
    const seen = new Set<string>();
    for (const v of ['front', 'front-left', 'left', 'back-left', 'back', 'back-right', 'right', 'front-right']) {
      await page.getByTestId(`view-${v}`).click();
      seen.add(await preview.innerHTML());
    }
    expect(seen.size).toBe(8);
    await page.getByTestId('creator-tab-cabelo').click();
    expect(await page.getByTestId('hair-card').count()).toBeGreaterThanOrEqual(25);
    await page.locator('[data-testid="hair-card"][data-hair="afro"]').click();
    await page.getByTestId('creator-tab-roupas').click();
    await page.getByTestId('c-pattern').selectOption('floral');
    await page.getByTestId('creator-tab-acessorios').click();
    await page.getByTestId('acc-cap').check({ force: true });
    await page.getByTestId('creator-tab-roupas').click();
    await expect(page.getByTestId('conflicts')).toContainText('chapéu');
    await page.getByTestId('creator-tab-identidade').click();
    await page.getByTestId('c-name').fill('Bento');
    await page.getByTestId('creator-place').click();
    await tab(page, 'layers');
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Bento"]')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('comandos rápidos: plano, aplicar, desfazer; rótulo honesto', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'direction');
    await expect(page.getByTestId('quick-note')).toContainText('Não é IA');
    await page.getByTestId('direction-input').fill('Crie uma cena de sala de aula com 3 alunos e professor');
    await page.getByTestId('direction-run').click();
    await expect(page.getByTestId('plan-box')).toContainText('Nova cena');
    await page.getByTestId('plan-apply').click();
    await tab(page, 'scenes');
    await expect(page.getByTestId('scene-count')).toHaveText('2');
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('scene-count')).toHaveText('1');
  });

  test('IA local indisponível dá erro honesto, sem fingir conexão', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'direction');
    await page.getByTestId('ai-mode').selectOption('ollama');
    await page.getByTestId('direction-input').fill('Oi');
    await page.getByTestId('direction-run').click();
    await expect(page.locator('.error-box')).toContainText('Configure');
  });

  test('atalhos: espaço, Ctrl+D, setas, Delete, ajuda', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Nina');
    await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => undefined);
    await selectLayer(page, 'Nina');
    await page.keyboard.press('Control+d');
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Nina (cópia)"]')).toBeVisible();
    await page.keyboard.press('Delete');
    await page.getByTestId('confirm-ok').click();
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Nina (cópia)"]')).toHaveCount(0);
    await selectLayer(page, 'Nina');
    const x = page.getByTestId('prop-transform.x').locator('input[type="text"]');
    const before = await x.inputValue();
    await page.getByTestId('tab-layers').focus();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(x).not.toHaveValue(before);
    await page.keyboard.press('?');
    await expect(page.getByTestId('shortcuts')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('shortcuts')).toHaveCount(0);
    await page.keyboard.press(' ');
    await expect(page.getByTestId('stage-mode')).toContainText('Reproduzindo');
    await page.keyboard.press(' ');
  });

  test('menu "…" e toque: ações sem depender de hover nem de clique direito', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'layers');
    await page.getByRole('button', { name: 'Opções de Nina' }).click();
    await expect(page.getByTestId('context-menu')).toContainText('Renomear');
    await page.getByTestId('context-menu').getByRole('menuitem', { name: 'Renomear' }).click();
    await page.getByTestId('prompt-input').fill('Nina Nova');
    await page.getByTestId('prompt-ok').click();
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Nina Nova"]')).toBeVisible();
  });

  test('palco: selecionar clicando e arrastar move no mundo, com undo', async ({ page }) => {
    await openDemo(page);
    const stage = await boxOf(page, 'stage');
    await page.mouse.click(stage.x + stage.width * 0.34, stage.y + stage.height * 0.55);
    await expect(page.getByTestId('selected-name')).toHaveText('Nina');
    await expect(page.getByTestId('selection-box')).toBeVisible();
    const x = page.getByTestId('prop-transform.x').locator('input[type="text"]');
    const before = await x.inputValue();
    await page.mouse.move(stage.x + stage.width * 0.34, stage.y + stage.height * 0.55);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(stage.x + stage.width * 0.34 + i * 10, stage.y + stage.height * 0.55);
    await page.mouse.up();
    await expect(x).not.toHaveValue(before);
    await page.getByTestId('undo').click();
    await expect(x).toHaveValue(before);
  });

  test('zoom e pan do editor não mudam o que é exportado', async ({ page }) => {
    await openDemo(page);
    const before = await page.evaluate(() => [...document.querySelectorAll('[data-testid="stage-svg"] [data-node-id]')].map((g) => g.getAttribute('transform')));
    await page.getByTestId('stage-zoom').selectOption('2');
    const after = await page.evaluate(() => [...document.querySelectorAll('[data-testid="stage-svg"] [data-node-id]')].map((g) => g.getAttribute('transform')));
    expect(after).toEqual(before);
    const vb = await page.getByTestId('stage-svg').getAttribute('viewBox');
    expect(vb).not.toBeNull();
    await page.getByTestId('stage-center').click();
    await expect(page.getByTestId('frame-mask')).toBeVisible();
  });
});

test.describe('layouts em várias telas', () => {
  for (const [w, h] of [[375, 667], [390, 844], [430, 932], [768, 1024], [800, 600], [1366, 768], [1600, 900], [1920, 1080]] as const) {
    test(`${w}×${h}: nada estoura a tela e o essencial aparece`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await openDemo(page);
      await assertNoBodyOverflow(page);
      const vp = { width: w, height: h };
      expect(inViewport(await boxOf(page, 'stage'), vp)).toBe(true);
      expect(inViewport(await boxOf(page, 'timeline'), vp)).toBe(true);
      const st = await boxOf(page, 'stage');
      expect(st.height).toBeGreaterThan(90);
      expect(st.width).toBeGreaterThan(200);
    });
  }
});

test.describe('1.1', () => {
  test('mídia ausente: salvar avisa, oferece revincular ou salvar incompleto', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('audio-input').setInputFiles(makeWav(1));
    await expect(page.getByTestId('tl-clip-audio')).toBeVisible({ timeout: 15000 });
    await waitSaved(page);
    await page.evaluate(() => new Promise<void>((ok, fail) => {
      const r = indexedDB.open('recorte-studio');
      r.onsuccess = () => { const tx = r.result.transaction('blobs', 'readwrite'); tx.objectStore('blobs').clear(); tx.oncomplete = () => { r.result.close(); ok(); }; tx.onerror = () => fail(tx.error); };
      r.onerror = () => fail(r.error);
    }));
    await page.getByTestId('save-project').click();
    await expect(page.getByTestId('confirm-dialog')).toContainText('Mídia ausente');
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByTestId('confirm-dialog').getByRole('button', { name: 'Salvar incompleto' }).click()]);
    expect(d.suggestedFilename()).toMatch(/-incompleto\.jrec$/);
    const { manifest } = readJrec(await saveDownload(d, 'incompleto.jrec'));
    expect(manifest.missing.length).toBeGreaterThan(0);
    await tab(page, 'media');
    await expect(page.getByTestId('media-missing')).toBeVisible();
  });

  test('Mídias: importar por categoria, usar na cena, remover com aviso de uso', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'media');
    await page.getByTestId('audio-category').selectOption('music');
    await page.getByTestId('media-audio-input').setInputFiles(makeWav(1));
    const row = page.getByTestId('media-row').first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('tl-clip-audio')).toHaveCount(0);
    await row.getByTestId('media-use').click();
    await expect(page.getByTestId('tl-clip-audio')).toHaveCount(1);
    // Mesmo arquivo de novo: reaproveitado, sem duplicar.
    await page.getByTestId('media-audio-input').setInputFiles(makeWav(1));
    await expect(page.getByTestId('media-row')).toHaveCount(1);
    await row.getByTestId('media-remove').click();
    await expect(page.getByTestId('confirm-dialog')).toContainText('em uso 1 vez');
    await page.getByTestId('confirm-ok').click();
    await expect(page.getByTestId('media-row')).toHaveCount(0);
    await expect(page.getByTestId('tl-clip-audio')).toHaveCount(0);
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('tl-clip-audio')).toHaveCount(1);
  });

  for (const times of [['day'], ['morning', 'sunset', 'night'], ['morning', 'day', 'afternoon', 'sunset', 'night']]) {
    test(`cenário próprio com ${times.length} horário(s): aplicar, trocar horário, persistir`, async ({ page }) => {
      await openDemo(page);
      await tab(page, 'backgrounds');
      await page.getByTestId('custom-bg-new').click();
      await page.getByTestId('prompt-input').fill('Quintal');
      await page.getByTestId('prompt-ok').click();
      const colors = ['#f5c26b', '#7ec8f2', '#f0a35e', '#e0705a', '#203060'];
      for (const [i, t] of times.entries()) {
        await page.getByTestId(`cbg-slot-${t}`).click();
        await page.getByTestId('cbg-input').setInputFiles(svgFile(`${t}.svg`, colors[i]));
        await expect(page.getByTestId(`cbg-slot-${t}`).locator('img')).toBeVisible({ timeout: 10000 });
      }
      await page.getByTestId('custom-bg-apply').click();
      await expect(page.locator('[data-testid="stage-svg"] [data-custom-bg]')).toHaveCount(1);
      await page.keyboard.press('Escape');
      const timeSel = page.getByTestId('bg-time');
      await expect(timeSel.locator('option')).toHaveCount(times.length);
      if (times.length > 1) await timeSel.selectOption(times[times.length - 1]);
      await expect(page.locator('[data-testid="stage-svg"] [data-custom-bg]')).toHaveAttribute('data-time', times[times.length - 1]);
      await waitSaved(page);
      await page.reload();
      await page.keyboard.press('Escape');
      await expect(page.getByTestId('bg-time')).toHaveValue(times[times.length - 1]);
    });
  }

  test('modo simples e avançado editam os mesmos dados', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('mode-simple').click();
    await expect(page.getByTestId('simple-timeline')).toBeVisible();
    const before = await page.getByTestId('simple-step').count();
    await page.getByTestId('simple-text').fill('Oi, tudo bem?');
    await page.getByTestId('simple-at').fill('1');
    await page.getByTestId('simple-add').click();
    await expect(page.getByTestId('simple-step')).toHaveCount(before + 1);
    await page.getByTestId('mode-advanced').click();
    await expect(page.getByTestId('simple-timeline')).toHaveCount(0);
    await page.getByTestId('mode-simple').click();
    await expect(page.getByTestId('simple-step')).toHaveCount(before + 1);
    await page.keyboard.press('Control+z');
    await expect(page.getByTestId('simple-step')).toHaveCount(before);
    await page.getByTestId('mode-advanced').click();
  });

  test('PWA: recarrega offline no mesmo link de projeto', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await page.getByTestId('demo-project').click();
    await expect(page.getByTestId('stage')).toBeVisible();
    await waitSaved(page);
    const url = page.url();
    expect(url).toMatch(/projeto=/);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('stage')).toBeVisible();
    expect(page.url()).toBe(url);
    await expect(page.getByTestId('project-name')).toHaveText('Você sabe dançar?');
    await context.setOffline(false);
  });

  test('390×844: salvar projeto, mídias e modo simples alcançáveis', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openDemo(page);
    await expect(page.getByTestId('save-project')).toBeVisible();
    await expect(page.getByTestId('tl-import-audio')).toBeVisible();
    await page.getByTestId('mode-simple').click();
    await expect(page.getByTestId('simple-timeline')).toBeVisible();
    await assertNoBodyOverflow(page);
    await page.getByTestId('mode-advanced').click();
  });
});
