/**
 * Popup de detalhes da Biblioteca (desktop e celular) e conflito de ID na importação de .rspack, pela interface.
 * Os pacotes de teste são montados aqui (ZIP real com manifesto, sha256 e itens) e importados como um usuário faria.
 */
import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { strToU8, zipSync } from 'fflate';
import { assertNoBodyOverflow, watchErrors } from './helpers';

const item = (page: Page, name: string) => page.locator(`[data-testid="library-item"][data-name="${name}"]`).first();
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

function makePack(id: string, version: string, items: Array<{ id: string; name: string; color: string }>): Buffer {
  const files: Record<string, Uint8Array> = {};
  const list = items.map((it) => {
    const data = { bundle: 2, object: { id: it.id, name: it.name, width: 200, height: 200, pieces: [{ id: 'p', name: 'Forma', kind: 'rect', x: 0, y: -50, w: 100, h: 100, fill: it.color }], clips: [] }, objects: [], assets: [] };
    const b = strToU8(JSON.stringify(data));
    files[`items/${it.id}.json`] = b;
    return { id: it.id, kind: 'object', name: it.name, file: `items/${it.id}.json`, sha256: sha(b) };
  });
  files['manifest.json'] = strToU8(JSON.stringify({ format: 'recorte-studio-pack', formatVersion: 1, id, name: `Pacote ${id}`, version, description: '', author: 'Teste', license: 'CC0', category: 'Teste', dependencies: [], items: list, media: [] }));
  return Buffer.from(zipSync(files));
}
const upload = (page: Page, name: string, buffer: Buffer) => page.getByTestId('library-input').setInputFiles({ name, mimeType: 'application/zip', buffer });

test('popup no desktop: centralizado, sem coluna lateral, Esc, clique fora, X, foco preso e devolvido', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByTestId('home-nav-library').click();
  await page.getByTestId('library-search').fill('Nina');
  const card = item(page, 'Nina');
  await expect(card).toBeVisible();
  const gridBefore = (await page.getByTestId('library-results').boundingBox())!;

  await card.click();
  const d = page.getByTestId('library-detail');
  await expect(d).toBeVisible();
  await expect(d).toHaveAttribute('role', 'dialog');
  const b = (await d.boundingBox())!;
  expect(b.width).toBeLessThanOrEqual(951);
  expect(b.height).toBeLessThanOrEqual(768 * 0.85 + 2);
  expect(Math.abs(b.x + b.width / 2 - 683)).toBeLessThan(2); // centralizado na horizontal
  expect(Math.abs(b.y + b.height / 2 - 384)).toBeLessThan(2); // e na vertical
  // Sem painel lateral: o catálogo continua com a mesma largura e nada com a classe antiga existe.
  const gridAfter = (await page.getByTestId('library-results').boundingBox())!;
  expect(Math.abs(gridAfter.width - gridBefore.width)).toBeLessThan(1);
  await expect(page.locator('.libh-detail')).toHaveCount(0);
  // Fundo discretamente escurecido (não preto).
  const alpha = await page.locator('.modal-back.is-soft').evaluate((el) => Number(getComputedStyle(el).backgroundColor.match(/[\d.]+/g)![3] ?? 1));
  expect(alpha).toBeGreaterThan(0);
  expect(alpha).toBeLessThanOrEqual(0.35);
  // Informações pedidas.
  await expect(d.getByTestId('library-name')).toHaveText('Nina');
  await expect(d.getByTestId('library-id')).toHaveText('nina');
  for (const t of ['library-origin', 'library-pack', 'library-collection', 'library-license', 'library-anims', 'library-deps', 'library-meta']) await expect(d.getByTestId(t)).toBeVisible();
  for (const label of ['Tipo', 'Categoria', 'Criador', 'Versão', 'Compatibilidade', 'Tamanho', 'Vistas', 'Dependências']) await expect(d.locator('dt', { hasText: label }).first()).toBeVisible();
  // Personagem: 4 vistas principais, diagonais sob demanda.
  await expect(d.getByTestId('catalog-views').locator('figure')).toHaveCount(4);
  await d.getByTestId('catalog-diagonals').click();
  await expect(d.getByTestId('catalog-views').locator('figure')).toHaveCount(8);
  // Foco preso: 40 Tabs e o foco nunca sai do popup.
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="library-detail"]'))).toBe(true);
  }
  // Esc fecha e o foco volta ao cartão.
  await page.keyboard.press('Escape');
  await expect(d).toHaveCount(0);
  expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.getAttribute('data-name'))).toBe('Nina');
  // Clique fora fecha.
  await card.click();
  await expect(d).toBeVisible();
  await page.mouse.click(6, 6);
  await expect(d).toHaveCount(0);
  // X fecha.
  await card.click();
  await page.getByTestId('library-detail-close').click();
  await expect(d).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('popup com pouca altura rola por dentro e não corta os botões', async ({ page }) => {
  await page.setViewportSize({ width: 1100, height: 520 });
  await page.goto('/');
  await page.getByTestId('home-nav-library').click();
  await page.getByTestId('library-search').fill('Nina');
  await item(page, 'Nina').click();
  const d = page.getByTestId('library-detail');
  const b = (await d.boundingBox())!;
  expect(b.height).toBeLessThanOrEqual(520 * 0.85 + 2);
  const scroll = await d.locator('.modal-body').evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight, oy: getComputedStyle(el).overflowY }));
  expect(['auto', 'scroll']).toContain(scroll.oy);
  expect(scroll.sh).toBeGreaterThan(scroll.ch); // conteúdo maior que a área: rola por dentro
  await expect(page.getByTestId('library-favorite')).toBeVisible(); // rodapé de ações sempre à vista
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('popup ocupa a tela, botões não cortam e o catálogo não estoura', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('home-nav-library').click();
    await page.getByTestId('library-search').fill('Nina');
    await item(page, 'Nina').click();
    const d = page.getByTestId('library-detail');
    const b = (await d.boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390.5);
    expect(b.width).toBeGreaterThan(370); // usa quase toda a largura
    expect(b.height).toBeGreaterThan(800); // e a altura
    const buttons = await d.getByTestId('library-actions').locator('button').evaluateAll((els) => els.map((el) => { const r = el.getBoundingClientRect(); return { l: r.left, r: r.right, w: r.width }; }));
    expect(buttons.length).toBeGreaterThan(1);
    for (const x of buttons) { expect(x.l).toBeGreaterThanOrEqual(-0.5); expect(x.r).toBeLessThanOrEqual(390.5); expect(x.w).toBeGreaterThan(20); }
    await page.getByTestId('library-detail-close').click();
    await expect(d).toHaveCount(0);
    await assertNoBodyOverflow(page);
  });
});

test('conflito de ID ao importar .rspack: novo ID, ID manual validado, pular, duplicata e nome igual com ID diferente', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto('/');
  await page.getByTestId('home-nav-library').click();
  const installFile = async (name: string, buf: Buffer) => {
    await upload(page, name, buf);
    await expect(page.getByTestId('pack-page')).toHaveAttribute('data-mode', 'inspect');
    await page.getByTestId('pack-install').click();
  };
  const toItems = async () => { await page.getByTestId('library-tab-items').click(); };
  const search = async (t: string) => { await toItems(); await page.getByTestId('library-search').fill(t); };

  // 1) Pacote A instala sem conflito.
  const A = makePack('conflito-a', '1.0.0', [{ id: 'cadeira-1', name: 'Cadeira A', color: '#cc2222' }]);
  await installFile('a.rspack', A);
  await expect(page.getByTestId('toasts')).toContainText('Pacote instalado');
  await expect(page.getByTestId('import-conflict-dialog')).toHaveCount(0);

  // 2) Pacote B: mesmo ID "cadeira-1" com conteúdo diferente + um item novo. Escolha: ID manual.
  const B = makePack('conflito-b', '1.0.0', [{ id: 'cadeira-1', name: 'Cadeira B', color: '#2222cc' }, { id: 'mesa-1', name: 'Mesa B', color: '#22cc22' }]);
  await installFile('b.rspack', B);
  const dlg = page.getByTestId('import-conflict-dialog');
  await expect(dlg).toBeVisible();
  await expect(dlg).toHaveAttribute('aria-label', 'Conflito de ID detectado');
  const card = dlg.getByTestId('conflict-item');
  await expect(card).toHaveCount(1); // só o que conflita; a Mesa B não aparece
  await expect(card).toHaveAttribute('data-id', 'cadeira-1');
  await expect(card.getByTestId('conflict-existing')).toContainText('Cadeira A');
  await expect(card.getByTestId('conflict-existing')).toContainText('Pacote conflito-a');
  await expect(card.getByTestId('conflict-incoming')).toContainText('Cadeira B');
  await expect(card.getByTestId('conflict-incoming')).toContainText('Pacote conflito-b');
  await expect(card).toContainText('cadeira-1');
  await expect(card.getByTestId('conflict-mode-new')).toBeChecked(); // recomendado, já marcado
  await card.getByTestId('conflict-mode-manual').check();
  const input = card.getByTestId('conflict-manual-input');
  const status = card.getByTestId('conflict-manual-status');
  const ok = dlg.getByTestId('conflict-confirm');
  await input.fill('com espaço');
  await expect(status).toContainText('Use só letras');
  await expect(ok).toBeDisabled();
  await input.fill('a'.repeat(41));
  await expect(status).toContainText('41 caracteres');
  await expect(ok).toBeDisabled();
  await input.fill('cadeira-1');
  await expect(status).toContainText('Cadeira A'); // já em uso por outro item
  await expect(ok).toBeDisabled();
  await input.fill('Cadeira-1'); // maiúscula diferente = outro ID, livre
  await expect(status).toHaveText('ID disponível.');
  await expect(ok).toBeEnabled();
  await input.fill('Cadeira-B-1');
  await ok.click();
  await expect(page.getByTestId('toasts')).toContainText('2 item(ns) no catálogo');
  await search('id:Cadeira-B-1');
  await expect(item(page, 'Cadeira B')).toBeVisible();
  await search('id:cadeira-1');
  await expect(item(page, 'Cadeira A')).toBeVisible(); // o existente ficou intacto
  await expect(page.getByTestId('library-count')).toHaveText('1 item(ns)');
  await search('id:CADEIRA-1');
  await expect(page.getByTestId('library-count')).toHaveText('0 item(ns)'); // ID exato respeita maiúsculas
  // O popup mostra o ID escolhido.
  await search('id:Cadeira-B-1');
  await item(page, 'Cadeira B').click();
  await expect(page.getByTestId('library-id')).toHaveText('Cadeira-B-1');
  await expect(page.getByTestId('library-pack')).toContainText('Pacote conflito-b');
  await page.getByTestId('library-detail-close').click();

  // 3) Pacote C: mesmo ID outra vez. Escolha: novo ID automático (recomendado) → UUID v4.
  const C = makePack('conflito-c', '1.0.0', [{ id: 'cadeira-1', name: 'Banqueta Cobalto', color: '#cccc22' }]);
  await toItems();
  await installFile('c.rspack', C);
  await expect(dlg).toBeVisible();
  await expect(dlg.getByTestId('conflict-item')).toHaveCount(1);
  await ok.click(); // padrão = novo ID automático
  await expect(page.getByTestId('toasts')).toContainText('1 ID(s) novo(s) gerado(s)');
  await search('Banqueta Cobalto');
  await item(page, 'Banqueta Cobalto').click();
  const newId = (await page.getByTestId('library-id').textContent())!;
  expect(newId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  await expect(page.locator('.libd-badge')).toHaveText('UUID v4');
  await page.getByTestId('library-detail-close').click();

  // 4) Pacote D: conflito resolvido com "Não importar este item"; o outro item entra.
  const Dp = makePack('conflito-d', '1.0.0', [{ id: 'cadeira-1', name: 'Poltrona Dourada', color: '#22cccc' }, { id: 'mesa-d', name: 'Escrivaninha Dalia', color: '#cc22cc' }]);
  await toItems();
  await installFile('d.rspack', Dp);
  await expect(dlg).toBeVisible();
  await dlg.getByTestId('conflict-mode-skip').check();
  await ok.click();
  await expect(page.getByTestId('toasts')).toContainText('1 item(ns) pulado(s)');
  await search('Poltrona Dourada');
  await expect(page.getByTestId('library-count')).toHaveText('0 item(ns)');
  await search('Escrivaninha Dalia');
  await expect(page.getByTestId('library-count')).toHaveText('1 item(ns)');

  // 5) Reimportar o MESMO pacote A: reconhecido, sem sobrescrever e sem conflito.
  await toItems();
  await upload(page, 'a.rspack', A);
  await expect(page.getByTestId('pack-page')).toBeVisible();
  await expect(page.getByTestId('pack-same')).toContainText('já está instalada');
  await expect(page.getByTestId('pack-install')).toHaveCount(0);

  // 6) Cancelar a importação não grava nada.
  const E = makePack('conflito-e', '1.0.0', [{ id: 'cadeira-1', name: 'Cadeira E', color: '#888888' }]);
  await toItems();
  await installFile('e.rspack', E);
  await expect(dlg).toBeVisible();
  await dlg.getByTestId('conflict-cancel').click();
  await expect(dlg).toHaveCount(0);
  await page.getByTestId('pack-back').click(); // volta da inspeção para a lista de pacotes
  await expect(page.getByTestId('pack-card')).toHaveCount(4); // a, b, c, d (e não: cancelado, nada gravado)
  expect(errors).toEqual([]);
});
