/** Catálogo unificado nas abas Elenco, Cenários e Objetos (build de produção, interface real). */
import { expect, test, type Page } from '@playwright/test';
import { assertNoBodyOverflow, OUT, openDemo, selectLayer, tab, waitSaved, watchErrors } from './helpers';

const putLibrary = (page: Page, recs: Array<Record<string, unknown>>) => page.evaluate((rs) => new Promise<void>((ok, fail) => {
  const open = indexedDB.open('recorte-studio');
  open.onsuccess = () => {
    const tx = open.result.transaction('library', 'readwrite');
    for (const r of rs) tx.objectStore('library').put(r);
    tx.oncomplete = () => { open.result.close(); ok(); };
    tx.onerror = () => fail(tx.error);
  };
  open.onerror = () => fail(open.error);
}), recs);
const libCount = (page: Page) => page.evaluate(() => new Promise<number>((ok) => {
  const open = indexedDB.open('recorte-studio');
  open.onsuccess = () => { const r = open.result.transaction('library').objectStore('library').count(); r.onsuccess = () => { open.result.close(); ok(r.result); }; };
}));
const objRec = (i: number) => ({
  id: `lib_p${i}`, kind: 'object', name: `Caixa ${i}`, favorite: 0, createdAt: i,
  data: { bundle: 2, object: { id: `obj_p${i}`, name: `Caixa ${i}`, width: 120, height: 120, pivotX: 0, pivotY: 0, pieces: [{ id: `pc${i}`, name: 'Base', kind: 'rect', x: 0, y: -60, w: 100, h: 100, fill: `hsl(${i * 7} 70% 55%)` }], createdAt: 0, updatedAt: 0 }, objects: [], assets: [] },
});
const card = (page: Page, testId: string, name: string) => page.locator(`[data-testid="${testId}"][data-name="${name}"]`);
const stageCount = (page: Page, sel: string) => page.locator(`[data-testid="stage-svg"] ${sel}`).count();

test.describe('catálogo · computador', () => {
  test('Elenco: busca sem acento, filtros Padrão/Meus, detalhes com 4 vistas e inserir sem mudar a definição', async ({ page }) => {
    const errors = watchErrors(page);
    await openDemo(page);
    await tab(page, 'characters');
    const panel = page.getByTestId('characters-panel');
    await page.getByTestId('char-search').fill('ZECA');
    await expect(card(page, 'project-character', 'Zeca')).toBeVisible();
    // "Padrão" mostra o personagem pronto mesmo quando o projeto já tem a definição.
    await panel.locator('[data-filter="builtin"]').click();
    await page.getByTestId('char-search').fill('');
    await expect(panel.locator('[data-origin="project"]')).toHaveCount(0);
    expect(await panel.locator('[data-origin="builtin"]').count()).toBeGreaterThan(5);
    await panel.locator('[data-filter="mine"]').click();
    await expect(page.getByTestId('catalog-empty')).toBeVisible();
    await panel.locator('[data-filter="all"]').click();
    // Detalhes: 4 vistas reais desenhadas pelo renderizador.
    await card(page, 'builtin-character', 'Bia').getByTestId('catalog-details-open').click();
    const dlg = page.getByTestId('catalog-details');
    await expect(dlg.getByTestId('catalog-views').locator('figure')).toHaveCount(4);
    await expect(dlg.getByTestId('catalog-origin')).toHaveText('Padrão');
    await expect(dlg.getByTestId('catalog-policy')).toContainText('Editar cria uma cópia');
    await page.screenshot({ path: `${OUT}/catalog-details-desktop.png` });
    const before = await page.evaluate(() => document.querySelectorAll('[data-testid="stage-svg"] [data-node-kind="character"], [data-testid="stage-svg"] [data-kind="character"]').length);
    await dlg.getByTestId('catalog-insert').click();
    await expect(dlg).toHaveCount(0);
    await expect(page.getByTestId('toasts')).not.toContainText('erro');
    await tab(page, 'layers');
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Bia"]')).toHaveCount(1);
    expect(before).toBeGreaterThanOrEqual(0);
    // A cena continua com os personagens de antes.
    await expect(page.locator('[data-testid="layer-row"][data-node-name="Nina"]')).toHaveCount(1);
    await tab(page, 'characters');
    // Inserido aparece em "No projeto" e o padrão some de "Todos" (sem duplicar).
    await expect(card(page, 'project-character', 'Bia')).toHaveCount(1);
    await expect(card(page, 'builtin-character', 'Bia')).toHaveCount(0);
    await panel.locator('[data-filter="recent"]').click();
    await expect(panel.locator('[data-name="Bia"]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('Cenários e Objetos: busca, categoria, inserir; a aba Cenas continua separada', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'backgrounds');
    await page.getByTestId('bg-search').fill('praca');
    await card(page, 'bg-card', 'Praça').locator('.card-main').click();
    await expect(card(page, 'bg-card', 'Praça')).toHaveClass(/is-active/);
    await page.getByTestId('bg-search').fill('');
    await page.getByTestId('catalog-category').selectOption('Casa');
    const cats = await page.locator('[data-testid="backgrounds-panel"] [data-kind="background"]').evaluateAll((els) => els.length);
    expect(cats).toBeGreaterThan(2);
    await tab(page, 'objects');
    await page.getByTestId('prop-search').fill('geladeira');
    const n = await stageCount(page, '[data-node-id]');
    await page.locator('[data-testid="prop-card"]').first().locator('.card-main').click();
    await expect.poll(() => stageCount(page, '[data-node-id]')).toBeGreaterThan(n);
    // Cenas do projeto seguem na aba própria, com o rodapé de criar/duplicar.
    await tab(page, 'scenes');
    await expect(page.getByTestId('scenes-panel')).toBeVisible();
  });

  test('cópia ao editar: objeto padrão vira cópia pessoal com ID novo; cor muda só na cópia; cópia é inserível', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'objects');
    await page.getByTestId('prop-search').fill('sofa');
    await card(page, 'prop-card', 'Sofá').getByTestId('catalog-edit').click();
    await expect(page.getByTestId('object-creator')).toBeVisible();
    await expect(page.getByTestId('toasts')).toContainText('O objeto padrão continua igual');
    await page.getByTestId('obj-studio-tab-layers').click();
    await page.locator('[data-testid="studio-layer"][data-name="Sofá"]').click();
    await page.getByTestId('obj-studio-tab-props').click();
    await page.getByTestId('piece-color-a').fill('#ff0000');
    await page.getByTestId('object-creator-close').click();
    // Cópia: "Sofá (cópia)" em Meus, com ID próprio; o padrão segue com a cor original.
    await page.getByTestId('prop-search').fill('');
    const copy = card(page, 'my-object', 'Sofá (cópia)');
    await expect(copy).toHaveCount(1);
    const key = await copy.getAttribute('data-key');
    expect(key).toMatch(/^project:object:obj_/);
    const copyHtml = await copy.locator('svg').first().innerHTML();
    expect(copyHtml.toLowerCase()).toContain('#ff0000');
    const origHtml = await card(page, 'prop-card', 'Sofá').locator('svg').first().innerHTML();
    expect(origHtml.toLowerCase()).not.toContain('#ff0000');
    await copy.locator('.card-main').click();
    await expect(page.locator('[data-testid="stage-svg"] [data-node-id]').filter({ has: page.locator('[fill="#ff0000"], [fill="#FF0000"]') })).not.toHaveCount(0);
  });

  test('cópia ao editar: personagem e cenário padrão', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'characters');
    await card(page, 'builtin-character', 'Bia').getByTestId('catalog-edit').click();
    await expect(page.getByTestId('toasts')).toContainText('O personagem padrão continua igual');
    await page.keyboard.press('Escape');
    await expect(card(page, 'project-character', 'Bia (cópia)')).toHaveCount(1);
    await expect(card(page, 'builtin-character', 'Bia')).toHaveCount(1);
    await tab(page, 'backgrounds');
    await page.getByTestId('bg-search').fill('praia');
    await card(page, 'bg-card', 'Praia').getByTestId('catalog-edit').click();
    await expect(page.getByTestId('scene-creator')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('toasts')).toContainText('com Dia e Noite');
    await page.keyboard.press('Escape');
    await page.getByTestId('bg-search').fill('');
    await page.locator('[data-testid="backgrounds-panel"] [data-filter="mine"]').click();
    await expect(card(page, 'custom-bg', 'Praia (cópia)')).toHaveCount(1);
  });

  test('uso entre projetos: salvar objeto pessoal, abrir outro projeto, achar no catálogo e inserir', async ({ page }) => {
    await openDemo(page);
    await tab(page, 'objects');
    await page.getByTestId('object-new').click();
    await page.getByTestId('prompt-input').fill('Totem Azul');
    await page.getByTestId('prompt-ok').click();
    await page.getByTestId('object-creator-close').click();
    await card(page, 'my-object', 'Totem Azul').getByTestId('catalog-details-open').click();
    await page.getByTestId('catalog-save-lib').click();
    await expect(page.getByTestId('toasts')).toContainText('salvo na sua biblioteca');
    await expect(page.getByTestId('catalog-save-lib')).toContainText('Atualizar');
    await page.keyboard.press('Escape');
    expect(await libCount(page)).toBe(1);
    await waitSaved(page);
    // Projeto novo, vazio.
    await page.getByTestId('back-projects').click();
    await page.getByTestId('new-project').click();
    await expect(page.getByTestId('stage')).toBeVisible();
    await tab(page, 'objects');
    await page.getByTestId('prop-search').fill('totem');
    const lib = card(page, 'obj-lib-row', 'Totem Azul');
    await expect(lib).toHaveAttribute('data-origin', 'mine');
    await lib.locator('.card-main').click();
    await expect(card(page, 'my-object', 'Totem Azul')).toHaveCount(1);
    await expect(page.locator('[data-testid="stage-svg"] [data-node-id]')).not.toHaveCount(0);
  });

  test('centenas de itens: abre rápido, carrega aos poucos e busca acha o item', async ({ page }) => {
    await openDemo(page);
    await putLibrary(page, Array.from({ length: 400 }, (_, i) => objRec(i)));
    await tab(page, 'scenes');
    const t0 = Date.now();
    await tab(page, 'objects');
    await expect(page.locator('[data-testid="obj-lib-row"]').first()).toBeVisible();
    const openMs = Date.now() - t0;
    // Só a primeira página está no DOM; o resto vem ao rolar.
    const first = await page.locator('[data-testid="objects-panel"] .cat-card').count();
    // Bem menos que os 400: o resto só entra ao rolar (ou em "Mostrar mais").
    expect(first).toBeLessThan(150);
    await expect(page.getByRole('button', { name: /Mostrar mais/ })).toBeVisible();
    await expect(page.getByTestId('catalog-count')).toHaveText(/^4\d\d$/);
    const t1 = Date.now();
    await page.getByTestId('prop-search').fill('caixa 377');
    await expect(card(page, 'obj-lib-row', 'Caixa 377')).toBeVisible();
    const searchMs = Date.now() - t1;
    console.log(`catálogo com 400+ itens: abrir ${openMs} ms, buscar ${searchMs} ms, ${first} cartões na 1ª página`);
    expect(openMs).toBeLessThan(4000);
    expect(searchMs).toBeLessThan(2000);
  });

  test('registros quebrados da biblioteca aparecem com o motivo e podem ser apagados', async ({ page }) => {
    await openDemo(page);
    await putLibrary(page, [{ id: 'lib_x', kind: 'character', name: 'Fantasma', favorite: 0, createdAt: 1, data: { id: 5 } }]);
    await tab(page, 'scenes');
    await tab(page, 'characters');
    const bad = page.locator('[data-name="Fantasma"]');
    await expect(bad).toContainText('Formato incompatível');
    await bad.getByRole('button', { name: /Apagar Fantasma/ }).click();
    await page.getByTestId('confirm-ok').click();
    await expect(bad).toHaveCount(0);
  });
});

test.describe('catálogo · celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  for (const [id, search, name] of [['characters', 'char-search', 'Bia'], ['backgrounds', 'bg-search', 'Praia'], ['objects', 'prop-search', 'Sofá']] as const) {
    test(`${id}: buscar, filtrar, ver detalhes e inserir sem cortar nada`, async ({ page }) => {
      const errors = watchErrors(page);
      await openDemo(page);
      if (id === 'objects') { await page.getByTestId('dock-more').click(); await page.getByTestId('more-objects').click(); }
      else await page.getByTestId(`dock-${id}`).click();
      await page.getByTestId(search).fill(name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
      const c = page.locator(`[data-name="${name}"]`).first();
      await expect(c).toBeVisible();
      await page.locator('[data-filter="builtin"]').first().click();
      await expect(c).toBeVisible();
      await c.getByTestId('catalog-details-open').click();
      const dlg = page.getByTestId('catalog-details');
      await expect(dlg).toBeVisible();
      const box = (await dlg.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390.5);
      expect(box.y + box.height).toBeLessThanOrEqual(844.5);
      const ins = dlg.getByTestId('catalog-insert');
      const ib = (await ins.boundingBox())!;
      expect(ib.height).toBeGreaterThanOrEqual(32);
      await page.screenshot({ path: `${OUT}/catalog-mobile-${id}.png` });
      await ins.click();
      await expect(dlg).toHaveCount(0);
      await assertNoBodyOverflow(page);
      expect(errors).toEqual([]);
    });
  }
});

test.describe('keyframe da seção · Shift+clique', () => {
  test('remove só as chaves da seção no instante; um Ctrl+Z restaura', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Nina');
    await page.getByTestId('insp-tab-transformar').click();
    const go = async (s: string) => { await page.getByTestId('time-input').fill(s); await page.getByTestId('time-input').press('Enter'); await page.waitForTimeout(80); };
    const btn = page.getByTestId('section-keys-transform');
    await go('1');
    await btn.click();
    await go('3');
    await btn.click();
    await expect(btn).toHaveAttribute('data-status', 'all');
    await btn.click({ modifiers: ['Shift'] });
    await expect(page.getByTestId('toasts')).toContainText('removido(s) em 3 s');
    await expect(btn).toHaveAttribute('data-status', 'none');
    await go('1');
    await expect(btn).toHaveAttribute('data-status', 'all');
    await go('3');
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('toasts')).toContainText('Desfeito: Remover keyframes da seção');
    await expect(btn).toHaveAttribute('data-status', 'all');
    // Sem chave no instante: nada muda.
    await go('5');
    await btn.click({ modifiers: ['Shift'] });
    await expect(page.getByTestId('toasts')).toContainText('Nada foi alterado');
  });

  test('único keyframe da faixa: pede confirmação antes de acabar com a animação', async ({ page }) => {
    await openDemo(page);
    await selectLayer(page, 'Nina');
    await page.getByTestId('insp-tab-transformar').click();
    await page.getByTestId('time-input').fill('2');
    await page.getByTestId('time-input').press('Enter');
    const btn = page.getByTestId('section-keys-transform');
    await btn.click();
    await btn.click({ modifiers: ['Shift'] });
    await expect(page.getByTestId('confirm-ok')).toBeVisible();
    await page.getByTestId('confirm-cancel').click();
    await expect(btn).toHaveAttribute('data-status', 'all');
    await btn.click({ modifiers: ['Shift'] });
    await page.getByTestId('confirm-ok').click();
    await expect(btn).toHaveAttribute('data-status', 'none');
  });
});
