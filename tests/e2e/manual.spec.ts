/**
 * Capturas reais para o manual (public/manual/*.jpg) e posição das marcações numeradas
 * (src/features/manual/marks.generated.ts), medidas nos elementos de verdade.
 * Rode com: npm run manual:shots
 */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { makeWav, openDemo, selectLayer, tab } from './helpers';

const DIR = resolve('public/manual');
const marks: Record<string, Array<{ n: number; x: number; y: number }>> = {};

/** Fotografa a janela e mede o centro de cada alvo (em % da imagem). */
async function capture(page: Page, name: string, targets: string[] = []) {
  // Avisos temporários de passos anteriores não entram nas capturas.
  await page.addStyleTag({ content: '[data-testid="toasts"]{display:none!important}' });
  await page.waitForTimeout(350);
  const vp = page.viewportSize()!;
  const list: Array<{ n: number; x: number; y: number }> = [];
  for (const sel of targets) await page.locator(sel).first().scrollIntoViewIfNeeded({ timeout: 5000 });
  await page.waitForTimeout(150);
  for (const [i, sel] of targets.entries()) {
    const box = await page.locator(sel).first().boundingBox({ timeout: 5000 });
    if (!box) throw new Error(`Marcação ${i + 1} de ${name} não encontrada: ${sel}`);
    // Marcação fora da imagem é erro: a captura teria de ser refeita com o alvo visível.
    const cx = box.x + box.width / 2;
    const cy = box.y + Math.min(box.height, 40) / 2;
    if (cx < 0 || cx > vp.width || cy < 0 || cy > vp.height) throw new Error(`Marcação ${i + 1} de ${name} fora da imagem: ${sel} (${Math.round(cx)},${Math.round(cy)} em ${vp.width}x${vp.height})`);
    list.push({ n: i + 1, x: +(((box.x + box.width / 2) / vp.width) * 100).toFixed(1), y: +(((box.y + Math.min(box.height, 40) / 2) / vp.height) * 100).toFixed(1) });
  }
  marks[`${name}.jpg`] = list;
  await page.screenshot({ path: resolve(DIR, `${name}.jpg`), type: 'jpeg', quality: 78 });
}
const t = (id: string) => `[data-testid="${id}"]`;

test.use({ viewport: { width: 1280, height: 800 } });

test('capturas do manual (computador)', async ({ page }) => {
  test.setTimeout(240_000);
  mkdirSync(DIR, { recursive: true });
  await page.goto('/');
  await capture(page, 'inicio', [t('new-project'), t('import-project'), t('home-nav-projects'), t('home-nav-templates'), t('home-nav-manual'), t('home-nav-settings')]);
  await page.getByTestId('home-nav-templates').click();
  await capture(page, 'modelos', ['.tpl-card >> nth=1']);

  await openDemo(page);
  await capture(page, 'editor', [t('tab-characters'), t('stage'), t('inspector'), t('timeline'), '.mode-toggle', t('save-project'), t('open-export')]);
  await page.getByTestId('back-projects').click();
  await page.getByTestId('home-nav-projects').click();
  await expect(page.getByTestId('project-card').first()).toBeVisible();
  await capture(page, 'projetos', [t('project-search'), t('project-sort'), t('project-filter-archived'), t('project-jrec'), '.project-open']);
  await page.locator('[data-testid="project-card"] .project-open').first().click();
  await expect(page.getByTestId('stage')).toBeVisible();

  // Personagens
  await selectLayer(page, 'Nina');
  await capture(page, 'propriedades', ['.insp-tabs', t('insp-tab-transformar'), t('insp-tab-rosto'), t('insp-tab-pose'), t('insp-tab-animar')]);
  await page.getByTestId('insp-tab-rosto').click();
  await page.locator('[data-testid="sec-identity"] .section-title').click();
  await page.locator('[data-testid="sec-gaze"] .section-title').click();
  await capture(page, 'rosto', ['[data-testid="sec-gaze"] .section-title', t('expression')]);
  await page.getByTestId('insp-tab-pose').click();
  await page.locator('[data-testid="sec-secondary"] .section-title').click();
  // A seção de profundidade é alta: uma janela mais alta mostra o título dela e o da pose juntos.
  await page.setViewportSize({ width: 1280, height: 1060 });
  await page.evaluate(() => document.querySelectorAll('*').forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }));
  await capture(page, 'pose', ['[data-testid="sec-limb-depth"] .section-title', '[data-testid="sec-rig"] .section-title']);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByTestId('insp-tab-rosto').click();
  await page.getByTestId('edit-library').click();
  await capture(page, 'criador-personagem', [t('creator-tab-cabelo'), t('creator-preview'), t('creator-done')]);
  await page.keyboard.press('Escape');

  // Catálogo (Elenco)
  await tab(page, 'characters');
  await capture(page, 'catalogo', [t('char-search'), t('catalog-filters'), t('catalog-category'), '[data-testid="builtin-character"] [data-testid="catalog-details-open"]', t('create-character')]);
  await page.locator('[data-testid="builtin-character"] [data-testid="catalog-details-open"]').first().click();
  await capture(page, 'catalogo-detalhes', [t('catalog-views'), t('catalog-policy'), t('catalog-insert'), t('catalog-copy')]);
  await page.keyboard.press('Escape');

  // Painéis
  await tab(page, 'scenes');
  await capture(page, 'cenas', ['[data-testid="scene-row"]']);
  await tab(page, 'backgrounds');
  await capture(page, 'cenarios', [t('scenery-new'), t('custom-bg-new')]);
  await tab(page, 'objects');
  await capture(page, 'objetos', [t('object-new')]);
  await tab(page, 'layers');
  await capture(page, 'camadas', ['[data-testid="layer-row"]']);

  // Áudio
  await tab(page, 'media');
  await page.getByTestId('audio-category').selectOption('music');
  await page.getByTestId('media-audio-input').setInputFiles(makeWav(2));
  await expect(page.getByTestId('media-row').first()).toBeVisible({ timeout: 15000 });
  await capture(page, 'midias', [t('audio-category'), t('media-import-audio'), t('media-use')]);
  await page.getByTestId('media-use').first().click();

  // Timeline
  await capture(page, 'timeline-avancada', [t('tl-import-audio'), t('tl-add'), '[data-testid="tl-clip-audio"]']);
  await page.getByTestId('mode-simple').click();
  await capture(page, 'timeline-simples', [t('simple-who'), t('simple-what'), t('simple-at'), t('simple-add')]);
  await page.getByTestId('mode-advanced').click();

  // Câmera
  await page.keyboard.press('Escape');
  await page.getByTestId('select-camera').click();
  await page.getByTestId('insp-tab-movimento').click();
  await capture(page, 'camera', [t('select-camera'), t('insp-tab-enquadramento'), t('insp-tab-movimento'), t('insp-tab-seguir')]);

  // Criadores
  await page.keyboard.press('Escape');
  await tab(page, 'objects');
  await page.getByTestId('object-new').click();
  await page.getByTestId('prompt-input').fill('Placa da loja');
  await page.getByTestId('prompt-ok').click();
  await page.getByTestId('add-star').click();
  await page.getByTestId('obj-studio-tab-add').click();
  await capture(page, 'criador-objetos', [t('object-width'), t('obj-studio-canvas'), t('obj-studio-tab-add'), t('obj-studio-tab-layers'), t('object-insert')]);
  // Quadros: uma animação com 3 quadros.
  await page.getByTestId('anim-new').click();
  await page.getByTestId('prompt-input').fill('Piscando');
  await page.getByTestId('prompt-ok').click();
  await page.getByTestId('anim-frame-add').click();
  await page.getByTestId('anim-frame-add').click();
  await capture(page, 'criador-objetos-quadros', [t('anim-clip'), t('anim-frames'), t('anim-frame-add'), t('anim-frame-ms'), t('anim-play')]);
  await page.getByTestId('object-creator-close').click();

  await tab(page, 'backgrounds');
  await page.getByTestId('scenery-new').click();
  await page.getByTestId('prompt-input').fill('Rua da escola');
  await page.getByTestId('prompt-ok').click();
  await capture(page, 'criador-cenarios-inicio', [t('scenery-time-day'), t('start-empty'), t('start-template')]);
  await page.getByTestId('start-template').selectOption('street');
  await page.getByTestId('scene-studio-tab-add').click();
  await page.getByTestId('add-character').selectOption({ index: 1 });
  await capture(page, 'criador-cenarios', [t('scenery-time-morning'), t('scene-studio-canvas'), t('scene-studio-tab-add'), t('scene-studio-tab-props'), t('scenery-apply')]);
  await page.getByTestId('scene-creator-close').click();

  // Pacotes (Biblioteca)
  await tab(page, 'library');
  await page.getByTestId('pack-demo').click();
  await expect(page.locator('[data-testid="pack-row"]')).toHaveCount(1);
  await capture(page, 'pacotes', [t('pack-import'), t('pack-enabled'), t('pack-export'), t('pack-remove')]);

  // Exportar e salvar
  await page.getByTestId('open-export').click();
  await capture(page, 'exportar', [t('export-kind'), t('export-run')]);
  await page.keyboard.press('Escape');

  // Configurações e manual
  await page.getByTestId('open-app-settings').click();
  await capture(page, 'configuracoes', [t('settings-geral'), t('settings-aparencia'), t('settings-armazenamento'), t('overlay-close')]);
  await page.getByTestId('overlay-close').click();
});

test('captura do manual: bolinha do grupo', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('home-nav-templates').click();
  await page.locator('[data-template="mar-barco"]').click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await tab(page, 'layers');
  await page.locator('[data-testid="layer-row"][data-node-name="Barco com passageiros"] .layer-name').click();
  await capture(page, 'grupo-bolinha', [t('group-handle'), '[data-testid="layer-row"][data-node-name="Barco com passageiros"]']);
});

test('capturas do manual (celular)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page);
  await page.getByTestId('dock-more').click();
  await page.getByTestId('more-layers').click();
  await page.locator('[data-testid="layer-row"][data-node-name="Nina"] .layer-name').click();
  await page.getByTestId('popup-close').click();
  await capture(page, 'celular', [t('mobile-quick'), '.mode-toggle', t('save-project'), t('dock-scenes'), t('dock-camera'), t('dock-more')]);
  await page.getByTestId('quick-pose').click();
  await capture(page, 'celular-pose', [t('mobile-popup')]);
});

test.afterAll(() => {
  const keys = Object.keys(marks).sort();
  const body = keys.map((k) => `  '${k}': ${JSON.stringify(marks[k])},`).join('\n');
  writeFileSync(resolve('src/features/manual/marks.generated.ts'), `/* Gerado por tests/e2e/manual.spec.ts: posições medidas nas capturas reais. Não edite à mão. */\nexport const MARKS: Record<string, Array<{ n: number; x: number; y: number }>> = {\n${body}\n};\n`);
});
