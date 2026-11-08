/** Biblioteca com formatos antigos e dependências, ações rápidas do celular e seleção/grupos no Criador de Objetos. */
import { expect, test, type Page } from '@playwright/test';
import { tab } from './helpers';

const putLibrary = (page: Page, rec: Record<string, unknown>) => page.evaluate((r) => new Promise<void>((ok, fail) => {
  const open = indexedDB.open('recorte-studio');
  open.onsuccess = () => {
    const tx = open.result.transaction('library', 'readwrite');
    tx.objectStore('library').put(r);
    tx.oncomplete = () => { open.result.close(); ok(); };
    tx.onerror = () => fail(tx.error);
  };
  open.onerror = () => fail(open.error);
}), rec);

const asset = (id: string) => ({ id, kind: 'image', name: `${id}.png`, mime: 'image/png', size: 12, createdAt: 0, width: 10, height: 10 });
const rect = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: 'Peça', kind: 'rect', x: 0, y: -60, w: 100, h: 100, fill: '#ff0000', ...extra });
const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid'));

async function openDemo(page: Page) {
  await page.goto('/');
  await page.getByTestId('demo-project').click();
  await expect(page.getByTestId('stage')).toBeVisible();
}

test.describe('biblioteca com formatos antigos e dependências', () => {
  test('cenário 1.1 (assets em registro) abre; registro ilegível mostra erro claro e pode ser apagado', async ({ page }) => {
    await openDemo(page);
    await putLibrary(page, { id: 'lib_old', kind: 'background', name: 'Antigo 1.1', favorite: 0, createdAt: 1, data: { background: { id: 'cbg_old', name: 'Antigo 1.1', variants: { day: { assetId: 'asset_old', fit: 'cover' } }, createdAt: 1 }, assets: { asset_old: asset('asset_old') } } });
    await putLibrary(page, { id: 'lib_bad', kind: 'background', name: 'Quebrado', favorite: 0, createdAt: 2, data: { lixo: true } });
    // O painel lê a biblioteca ao abrir.
    await tab(page, 'scenes');
    await tab(page, 'backgrounds');
    const bad = page.locator('[data-testid="cbg-lib-row"][data-name="Quebrado"]');
    await expect(bad).toContainText('Formato incompatível');
    await expect(bad.getByTestId('cbg-lib-bring')).toHaveCount(0);
    const old = page.locator('[data-testid="cbg-lib-row"][data-name="Antigo 1.1"]');
    await old.getByTestId('cbg-lib-bring').click();
    await expect(page.getByTestId('toasts')).toContainText('não estão mais neste navegador');
    await expect(page.locator('[data-testid="custom-bg"][data-name="Antigo 1.1"]')).toHaveCount(1);
    await bad.getByRole('button', { name: /Apagar Quebrado/ }).click();
    await page.getByTestId('confirm-ok').click();
    await expect(bad).toHaveCount(0);
  });

  test('objeto da biblioteca traz os objetos que ele usa; ciclos A → B → A são impedidos no criador', async ({ page }) => {
    await openDemo(page);
    const inner = { id: 'obj_in', name: 'Dentro', width: 100, height: 100, pivotX: 0, pivotY: 0, pieces: [rect('p1')], createdAt: 0, updatedAt: 0 };
    const outer = { id: 'obj_out', name: 'Fora', width: 200, height: 200, pivotX: 0, pivotY: 0, pieces: [rect('p2', { fill: '#00ff00' }), { ...rect('p3'), kind: 'object', refId: 'obj_in' }], createdAt: 0, updatedAt: 0 };
    await putLibrary(page, { id: 'lib_obj', kind: 'object', name: 'Fora', favorite: 0, createdAt: 1, data: { bundle: 2, object: outer, objects: [inner], assets: [] } });
    await tab(page, 'scenes');
    await tab(page, 'objects');
    await page.locator('[data-testid="obj-lib-row"][data-name="Fora"]').getByTestId('obj-lib-bring').click();
    await expect(page.getByTestId('toasts')).toContainText('com 1 objeto');
    await expect(page.locator('[data-testid="my-object"]')).toHaveCount(2);
    // Criador de "Dentro": "Fora" (que contém "Dentro") não pode ser adicionado dentro dele.
    await page.locator('[data-testid="my-object"][data-name="Dentro"]').getByTestId('my-object-edit').click();
    await page.getByTestId('obj-studio-tab-add').click();
    await expect(page.getByTestId('add-object')).toHaveCount(0);
    await page.getByTestId('object-creator-close').click();
    // Criador de "Fora": "Dentro" pode ser usado nele.
    await page.locator('[data-testid="my-object"][data-name="Fora"]').getByTestId('my-object-edit').click();
    await page.getByTestId('obj-studio-tab-add').click();
    await expect(page.getByTestId('add-object').locator('option', { hasText: 'Dentro' })).toHaveCount(1);
  });
});

test.describe('celular: ações rápidas contextuais', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('a barra muda com o estado (Editar fala × Falar) e cada ação abre aba, seção e foco certos', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('dock-more').click();
    await page.getByTestId('more-layers').click();
    await page.locator('[data-testid="layer-row"][data-node-name="Nina"] .layer-name').click();
    await page.getByTestId('popup-close').click();
    // O modo simples é o padrão no celular; o relógio fica no avançado.
    await page.getByTestId('mode-advanced').click();
    await page.getByTestId('time-input').fill('1');
    await page.getByTestId('time-input').press('Enter');
    // Em 1 s a Nina está falando ("Você sabe dançar?").
    await expect(page.getByTestId('quick-talk')).toHaveText('Editar fala');
    await page.getByTestId('quick-gaze').click();
    await expect(page.getByTestId('insp-tab-rosto')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => focusedId(page)).toBe('gaze-mode');
    await page.getByTestId('popup-close').click();
    await page.getByTestId('quick-pose').click();
    await expect(page.getByTestId('insp-tab-pose')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => focusedId(page)).toBe('pose');
    await page.getByTestId('popup-close').click();
    // Depois da fala: a ação é escrever uma nova.
    await page.getByTestId('time-input').fill('8');
    await page.getByTestId('time-input').press('Enter');
    await expect(page.getByTestId('quick-talk')).toHaveText('Falar');
    await page.getByTestId('quick-talk').click();
    await expect(page.getByTestId('insp-tab-animar')).toHaveAttribute('aria-selected', 'true');
    await expect.poll(() => focusedId(page)).toBe('speech-text');
  });

  test('câmera selecionada mostra ações de câmera, não as de personagem', async ({ page }) => {
    await openDemo(page);
    await page.getByTestId('select-camera').click();
    await expect(page.getByTestId('quick-frame')).toBeVisible();
    await expect(page.getByTestId('quick-follow')).toBeVisible();
    await expect(page.getByTestId('quick-talk')).toHaveCount(0);
  });
});

test.describe('Criador de Objetos: seleção girada e grupos', () => {
  async function newObject(page: Page) {
    await openDemo(page);
    await tab(page, 'objects');
    await page.getByTestId('object-new').click();
    await page.getByTestId('prompt-ok').click();
  }
  const set = async (page: Page, id: string, v: string) => {
    const i = page.getByTestId(id).locator('input[type="text"]');
    await i.fill(v);
    await i.press('Enter');
  };

  test('clicar numa peça girada seleciona pelo desenho girado, não pela caixa antiga', async ({ page }) => {
    await newObject(page);
    await page.getByTestId('obj-studio-tab-layers').click();
    await page.locator('[data-testid="studio-layer"] .studio-layer-name').first().click();
    await page.getByTestId('obj-studio-tab-props').click();
    await set(page, 'piece-w', '240');
    await set(page, 'piece-h', '60');
    await set(page, 'piece-rotation', '90');
    const box = (await page.locator('[data-testid="obj-studio-canvas"] [data-piece]').first().boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const outlines = page.locator('[data-testid="obj-studio-canvas"] [data-testid="piece-outline"]');
    // Limpa a seleção; clica na ponta de cima da peça girada (fora da caixa original, larga e baixa).
    await page.mouse.click(box.x - 60, box.y - 60);
    await expect(outlines).toHaveCount(0);
    await page.mouse.click(cx, cy - box.height * 0.42);
    await expect(outlines).toHaveCount(1);
    // Ao lado, onde a caixa antiga cobria mas a peça girada não: não seleciona.
    await page.mouse.click(box.x - 60, box.y - 60);
    await expect(outlines).toHaveCount(0);
    await page.mouse.click(cx + box.height * 0.45, cy);
    await expect(outlines).toHaveCount(0);
  });

  test('grupo: seleção com Shift, caixa do grupo, girar em bloco, agrupar e desfazer', async ({ page }) => {
    await newObject(page);
    await page.getByTestId('obj-studio-tab-add').click();
    await page.getByTestId('add-ellipse').click();
    await page.getByTestId('obj-studio-tab-layers').click();
    const names = page.locator('[data-testid="studio-layer"] .studio-layer-name');
    await names.nth(0).click();
    await names.nth(1).click({ modifiers: ['Shift'] });
    await page.getByTestId('obj-studio-tab-props').click();
    await expect(page.getByTestId('group-controls')).toBeVisible();
    await expect(page.getByTestId('group-box')).toHaveCount(1);
    const pieces = page.locator('[data-testid="obj-studio-canvas"] [data-piece]');
    const before = await pieces.evaluateAll((els) => els.map((e) => e.getAttribute('transform')));
    await page.getByTestId('group-rot-right').click();
    const after = await pieces.evaluateAll((els) => els.map((e) => e.getAttribute('transform')));
    expect(after).not.toEqual(before);
    expect(after.every((t) => /rotate\(15\)/.test(t ?? ''))).toBe(true);
    // Agrupar: clicar numa peça seleciona o grupo todo.
    await page.getByTestId('obj-studio-tab-layers').click();
    await page.getByTestId('studio-group').click();
    await page.mouse.click(5, 5);
    await names.first().click();
    await expect(page.locator('[data-testid="obj-studio-canvas"] [data-testid="piece-outline"]')).toHaveCount(2);
    // Ctrl+Z (dentro do criador) desfaz o agrupamento e a rotação em bloco.
    await page.getByTestId('obj-studio-canvas').focus();
    await page.keyboard.press('Control+z');
    await page.keyboard.press('Control+z');
    const undone = await pieces.evaluateAll((els) => els.map((e) => e.getAttribute('transform')));
    expect(undone).toEqual(before);
  });
});
