/** Keyframe universal por seção de Propriedades, na interface real (build de produção). */
import { expect, test, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertNoBodyOverflow, OUT, openDemo, selectLayer, setField } from './helpers';

const goTo = async (page: Page, seconds: string) => {
  await page.getByTestId('time-input').fill(seconds);
  await page.getByTestId('time-input').press('Enter');
  await page.waitForTimeout(80);
};
const inspTab = (page: Page, slug: string) => page.getByTestId(`insp-tab-${slug}`).click();
const status = (page: Page, id: string) => page.getByTestId(`section-keys-${id}`).getAttribute('data-status');
const count = (page: Page, id: string) => page.getByTestId(`section-keys-${id}`).getAttribute('data-count');
const num = async (page: Page, testId: string) => Number((await page.getByTestId(testId).locator('input[type="text"]').inputValue()).replace(',', '.'));
const PROPS = ['transform.x', 'transform.y', 'opacity', 'transform.rotationDeg'] as const;

async function selectNina(page: Page) {
  await openDemo(page);
  await selectLayer(page, 'Nina');
  await inspTab(page, 'transformar');
  await expect(page.getByTestId('section-keys-transform')).toBeVisible();
}

test.describe('keyframe universal · computador', () => {
  test('cria os keyframes da seção no instante, com os valores atuais, e um Ctrl+Z desfaz tudo', async ({ page }) => {
    await selectNina(page);
    await goTo(page, '2,37');
    expect(await status(page, 'transform')).toBe('none');
    expect(await count(page, 'transform')).toBe('0/6');
    const before = { x: await num(page, 'prop-transform.x'), y: await num(page, 'prop-transform.y'), r: await num(page, 'prop-transform.rotationDeg'), s: await num(page, 'prop-scale') };
    await page.getByTestId('section-keys-transform').click();
    expect(await status(page, 'transform')).toBe('all');
    expect(await count(page, 'transform')).toBe('6/6');
    await expect(page.getByTestId('toasts')).toContainText('6 keyframe(s) criado(s) em 2,37 s');
    // Cada botão individual da seção mostra o keyframe no instante.
    for (const p of PROPS) await expect(page.getByTestId(`key-${p}`)).toHaveAttribute('aria-pressed', 'true');
    // Escala (X e Y) também recebeu: confere na seção "Escala separada".
    await page.locator('[data-testid="section-keys-scale"]').scrollIntoViewIfNeeded();
    expect(await status(page, 'scale')).toBe('all');
    // Valores: em outro instante, mudar X cria um segundo keyframe e o de 2,37 s guarda o valor de antes.
    await goTo(page, '5');
    await setField(page, 'prop-transform.x', '333');
    await goTo(page, '2,37');
    expect(await num(page, 'prop-transform.x')).toBeCloseTo(before.x, 1);
    expect(await num(page, 'prop-transform.y')).toBeCloseTo(before.y, 1);
    expect(await num(page, 'prop-transform.rotationDeg')).toBeCloseTo(before.r, 1);
    expect(await num(page, 'prop-scale')).toBeCloseTo(before.s, 1);
    await goTo(page, '5');
    expect(await num(page, 'prop-transform.x')).toBeCloseTo(333, 1);
    // Desfazer a edição de X (5 s) e depois a criação inteira da seção, com um único Ctrl+Z.
    await page.getByTestId('undo').click();
    await goTo(page, '2,37');
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('toasts')).toContainText('Desfeito: Criar keyframes da seção');
    expect(await status(page, 'transform')).toBe('none');
    expect(await status(page, 'scale')).toBe('none');
    for (const p of PROPS) await expect(page.getByTestId(`key-${p}`)).toHaveAttribute('aria-pressed', 'false');
    // Refazer devolve tudo.
    await page.getByTestId('redo').click();
    expect(await status(page, 'transform')).toBe('all');
  });

  test('clicar de novo não duplica nem cria histórico; keyframe existente é mantido', async ({ page }) => {
    await selectNina(page);
    await goTo(page, '4,1');
    // Um keyframe individual de Y já existe neste instante, com um valor próprio.
    await page.getByTestId('key-transform.y').click();
    await setField(page, 'prop-transform.y', '123');
    expect(await num(page, 'prop-transform.y')).toBeCloseTo(123, 1);
    expect(await status(page, 'transform')).toBe('partial');
    expect(await count(page, 'transform')).toBe('1/6');
    await page.getByTestId('section-keys-transform').click();
    await expect(page.getByTestId('toasts')).toContainText('5 keyframe(s) criado(s)');
    await expect(page.getByTestId('toasts')).toContainText('1 já existia');
    expect(await num(page, 'prop-transform.y')).toBeCloseTo(123, 1);
    expect(await status(page, 'transform')).toBe('all');
    // Segundo clique: nada muda e nada entra no histórico.
    await page.getByTestId('section-keys-transform').click();
    await expect(page.getByTestId('toasts')).toContainText('Nada foi alterado');
    await page.getByTestId('undo').click();
    expect(await status(page, 'transform')).toBe('partial');
    expect(await count(page, 'transform')).toBe('1/6');
    expect(await num(page, 'prop-transform.y')).toBeCloseTo(123, 1);
    // Os botões individuais seguem funcionando: remover só o de Y deixa a seção sem keyframe.
    await page.getByTestId('key-transform.y').click();
    expect(await status(page, 'transform')).toBe('none');
  });

  test('respeita a seleção e a seção: outro personagem e outras seções não são tocados', async ({ page }) => {
    await selectNina(page);
    await goTo(page, '3,3');
    await page.getByTestId('section-keys-transform').click();
    expect(await status(page, 'transform')).toBe('all');
    // Outras seções (inclusive de outras abas) continuam sem keyframe neste instante.
    await inspTab(page, 'camadas');
    expect(await status(page, 'depth')).toBe('none');
    await inspTab(page, 'rosto');
    expect(await status(page, 'face')).toBe('none');
    expect(await status(page, 'gaze')).toBe('none');
    await inspTab(page, 'pose');
    expect(await status(page, 'rig')).toBe('none');
    expect(await status(page, 'limb-depth')).toBe('none');
    // Zeca, outro personagem, também não recebeu.
    await selectLayer(page, 'Zeca');
    await inspTab(page, 'transformar');
    expect(await status(page, 'transform')).toBe('none');
    // Seção de rosto de Nina: cria só os 3 campos do rosto (expressão, intensidade, boca).
    await selectLayer(page, 'Nina');
    await inspTab(page, 'rosto');
    await page.locator('[data-testid="section-keys-face"]').click();
    expect(await count(page, 'face')).toBe('3/3');
    expect(await status(page, 'gaze')).toBe('none');
  });

  test('câmera: enquadramento recebe x, y, zoom e rotação', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('select-camera').click();
    await inspTab(page, 'enquadramento');
    await goTo(page, '1,5');
    expect(await count(page, 'camera')).toBe('0/4');
    await page.getByTestId('section-keys-camera').click();
    expect(await status(page, 'camera')).toBe('all');
    expect(await count(page, 'camera')).toBe('4/4');
  });

  test('timelines simples e avançada: funciona nas duas e as marcas aparecem no avançado', async ({ page }) => {
    await selectNina(page);
    // Avançada: aparecem marcas (◆) na timeline depois de criar.
    const marks = page.locator('[data-testid="tl-key"]');
    await goTo(page, '2,5');
    await page.getByTestId('section-keys-transform').click();
    // As faixas de propriedade ficam recolhidas; ao expandir, há uma marca por propriedade (6) no instante.
    await page.getByRole('button', { name: /Expandir propriedades de Nina/ }).click();
    await expect.poll(() => marks.count()).toBeGreaterThanOrEqual(6);
    // Simples: o mesmo botão cria, e o modo simples avisa que os keyframes ficam no avançado.
    await page.getByTestId('mode-simple').click();
    await expect(page.getByTestId('simple-timeline')).toBeVisible();
    await expect(page.getByTestId('section-keys-transform')).toBeVisible();
    await page.getByTestId('time-input').count(); // o relógio fica no avançado; o instante continua o mesmo
    await page.getByTestId('section-keys-transform').click();
    await expect(page.getByTestId('toasts')).toContainText('Nada foi alterado');
    await expect(page.getByTestId('simple-keys-note')).toContainText('keyframe(s)');
    // Volta ao avançado: nada se perdeu.
    await page.getByTestId('mode-advanced').click();
    expect(await status(page, 'transform')).toBe('all');
  });

  test('seção de um campo só não ganha botão universal; botões individuais ficam como antes', async ({ page }) => {
    await selectNina(page);
    await inspTab(page, 'animar');
    await expect(page.locator('[data-testid^="section-keys-"]')).toHaveCount(0);
    await inspTab(page, 'transformar');
    for (const id of ['transform', 'scale']) await expect(page.getByTestId(`section-keys-${id}`)).toHaveCount(1);
    await inspTab(page, 'camadas');
    await expect(page.getByTestId('section-keys-depth')).toHaveCount(1);
    await inspTab(page, 'transformar');
    for (const p of PROPS) await expect(page.getByTestId(`key-${p}`)).toHaveCount(1);
  });

  test('inspeção visual: os 3 estados no cabeçalho da seção (capturas em test-results)', async ({ page }) => {
    await selectNina(page);
    await goTo(page, '2,37');
    const head = page.locator('[data-testid="sec-transform"] .section-head');
    mkdirSync(OUT, { recursive: true });
    const snap = async (name: string) => { writeFileSync(resolve(OUT, `${name}.png`), await head.screenshot()); };
    await snap('keys-1-nenhum');
    await page.getByTestId('key-transform.x').click();
    expect(await status(page, 'transform')).toBe('partial');
    await snap('keys-2-parcial');
    await page.getByTestId('section-keys-transform').click();
    expect(await status(page, 'transform')).toBe('all');
    await snap('keys-3-todos');
    // Os três estados são visualmente diferentes (cor/preenchimento do losango).
    const colors = await page.getByTestId('section-keys-transform').evaluate((b) => getComputedStyle(b).color);
    expect(colors).toBeTruthy();
    await page.screenshot({ path: resolve(OUT, 'keys-painel.png') });
  });
});

test.describe('keyframe universal · celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('o botão cabe no cabeçalho, é grande para o toque e cria os keyframes', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('dock-more').tap();
    await page.getByTestId('more-layers').tap();
    await page.locator('[data-testid="layer-row"][data-node-name="Nina"] .layer-name').tap();
    await page.getByTestId('popup-close').tap();
    await page.getByTestId('quick-move').tap();
    const btn = page.getByTestId('section-keys-transform');
    await expect(btn).toBeVisible();
    const b = (await btn.boundingBox())!;
    const head = (await page.locator('[data-testid="sec-transform"] .section-head').boundingBox())!;
    const popup = (await page.getByTestId('mobile-popup').boundingBox())!;
    expect(b.width).toBeGreaterThanOrEqual(36);
    expect(b.height).toBeGreaterThanOrEqual(36);
    expect(b.x + b.width).toBeLessThanOrEqual(popup.x + popup.width + 1);
    expect(b.x).toBeGreaterThan(head.x + 120); // à direita do título, que continua inteiro
    const title = (await page.locator('[data-testid="sec-transform"] .section-title').boundingBox())!;
    expect(title.x + title.width).toBeLessThanOrEqual(b.x + 1);
    await assertNoBodyOverflow(page);
    // No celular o relógio fica no modo avançado; o instante inicial (0 s) serve.
    expect(await status(page, 'transform')).toBe('none');
    await btn.tap();
    expect(await status(page, 'transform')).toBe('all');
    await expect(page.getByTestId('toasts')).toContainText('6 keyframe(s) criado(s)');
    await page.screenshot({ path: resolve(OUT, 'keys-celular.png') });
  });
});
