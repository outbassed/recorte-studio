/** Catálogo oficial de pacotes pela interface: ver antes de instalar, instalar volume e coleção, usar os itens e funcionar offline. */
import { expect, test, type Page } from '@playwright/test';
import { assertNoBodyOverflow, tab, watchErrors } from './helpers';

const item = (page: Page, name: string) => page.locator(`[data-testid="library-item"][data-name="${name}"]`).first();
const packCount = (page: Page) => page.evaluate(() => new Promise<number>((ok) => {
  const open = indexedDB.open('recorte-studio');
  open.onsuccess = () => {
    const db = open.result;
    if (!db.objectStoreNames.contains('packs')) { db.close(); ok(0); return; }
    const r = db.transaction('packs').objectStore('packs').count();
    r.onsuccess = () => { db.close(); ok(r.result); };
  };
}));
async function openOfficial(page: Page) {
  await page.getByTestId('home-nav-library').click();
  await page.getByTestId('library-tab-packs').click();
  await expect(page.getByTestId('essential-packs')).toBeVisible();
  await page.getByTestId('packs-view-official').click();
  await expect(page.getByTestId('official-catalog')).toBeVisible();
}
const card = (page: Page, id: string) => page.locator(`[data-testid="official-pack"][data-pack="${id}"]`);

test('catálogo oficial: ver conteúdo antes, instalar um volume, instalar a coleção e usar no Studio, também offline', async ({ page, context }) => {
  test.setTimeout(240_000);
  const errors = watchErrors(page);
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);

  // Conteúdo essencial vem com o programa, sempre ativo, sem remover.
  await page.getByTestId('home-nav-library').click();
  await page.getByTestId('library-tab-packs').click();
  await expect(page.getByTestId('essential-pack')).toHaveCount(3);
  await expect(page.getByTestId('essential-packs')).toContainText('sempre ativo');
  await expect(page.getByTestId('essential-packs').getByRole('button', { name: /remover/i })).toHaveCount(0);
  await page.getByTestId('packs-view-official').click();

  // Coleção Vila Torta com 7 volumes, contagens reais e nada instalado.
  const col = page.locator('[data-testid="official-collection"][data-collection="Vila Torta"]');
  await expect(col).toBeVisible();
  await expect(col.getByTestId('official-pack')).toHaveCount(7);
  await expect(card(page, 'vila-torta-personagens-1').getByTestId('official-counts')).toHaveText('7 personagens');
  await expect(card(page, 'vila-torta-personagens-1').getByTestId('official-state')).toContainText('Não instalado');
  await expect(card(page, 'vila-torta-assets-1').getByTestId('official-counts')).toContainText('objetos');
  expect(await packCount(page)).toBe(0);

  // Busca e filtro por categoria no catálogo.
  await page.getByTestId('official-search').fill('lon ruan');
  await expect(page.getByTestId('official-pack')).toHaveCount(2); // o personagem (personagens-2) e os objetos "…de Lon Ruan" (assets-2)
  await expect(card(page, 'vila-torta-personagens-2')).toBeVisible();
  await expect(card(page, 'vila-torta-assets-2')).toBeVisible();
  await page.getByTestId('official-search').fill('');
  await page.getByTestId('official-category').selectOption('Veículos');
  await expect(page.getByTestId('official-pack')).toHaveCount(1);
  await page.getByTestId('official-category').selectOption('');

  // Ver o conteúdo ANTES de instalar: baixa, confere e mostra; nada é gravado.
  await card(page, 'vila-torta-personagens-1').getByTestId('official-view').click();
  await expect(page.getByTestId('pack-page')).toHaveAttribute('data-mode', 'inspect');
  await expect(page.getByTestId('pack-page-item')).toHaveCount(7);
  await expect(page.getByTestId('pack-source')).toHaveText('Oficial do Recorte Studio');
  await expect(page.getByTestId('pack-collection')).toContainText('Vila Torta');
  await expect(page.getByTestId('pack-counts')).toContainText('7 personagem(ns)');
  expect(await packCount(page)).toBe(0);
  await page.getByTestId('pack-install').click();
  await expect(page.getByTestId('toasts')).toContainText('Pacote instalado');
  expect(await packCount(page)).toBe(1);
  await page.getByTestId('pack-back').click(); // volta da página do pacote para a lista de pacotes
  await page.getByTestId('packs-view-official').click();
  await expect(card(page, 'vila-torta-personagens-1').getByTestId('official-state')).toContainText('Instalado');
  await expect(card(page, 'vila-torta-personagens-1').getByTestId('official-install')).toHaveCount(0);

  // Instalar a coleção: instala só os volumes que faltam (6).
  await expect(col.getByTestId('official-install-collection')).toContainText('(6)');
  await col.getByTestId('official-install-collection').click();
  await expect(page.getByTestId('toasts')).toContainText('6 pacote(s) instalado(s)', { timeout: 60_000 });
  expect(await packCount(page)).toBe(7);
  await expect(col).toContainText('Coleção instalada');

  // Itens misturados no catálogo geral, achados por nome, ID, pacote, coleção e tema.
  await page.getByTestId('library-tab-items').click();
  await page.locator('[data-testid="library-origins"] [data-filter="official"]').click();
  await expect(page.getByTestId('library-count')).toHaveText('95 item(ns)');
  await page.getByTestId('library-search').fill('lon ruan');
  await expect(item(page, 'Lon Ruan')).toBeVisible();
  await item(page, 'Lon Ruan').click();
  const d = page.getByTestId('library-detail');
  await expect(d.getByTestId('library-pack')).toContainText('Vila Torta · Personagens 2');
  await expect(d.getByTestId('library-pack')).toContainText('oficial');
  await expect(d.getByTestId('library-collection')).toHaveText('Vila Torta');
  await expect(d.getByTestId('library-id')).toHaveText('char_3cww98uxr3');
  await expect(d.locator('.libd-badge')).toContainText('legado'); // ID dos episódios preservado, sem reescrever
  await expect(d.getByTestId('library-description')).toContainText('Cantor fictício de funk/trap');
  await page.getByTestId('library-detail-close').click();
  await page.getByTestId('library-search').fill('id:vt-rafa');
  await expect(item(page, 'Rafael')).toBeVisible();
  await page.getByTestId('library-search').fill('');
  if (!(await page.locator('.libh-more[open]').count())) await page.getByTestId('library-more').click(); // no desktop já vem aberto
  await page.locator('[data-testid="library-themes"] [data-theme="series"]').click();
  await expect(page.getByTestId('library-count')).toHaveText('95 item(ns)');

  // Usar no Studio.
  await page.getByTestId('home-nav-home').click();
  await page.getByTestId('new-project').first().click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await tab(page, 'library');
  await page.getByTestId('toolbox-search').fill('Samuca');
  const before = await page.locator('[data-testid="stage-svg"] [data-node-id]').count();
  await page.locator('[data-testid="toolbox-panel"] [data-name="Samuca"] .card-main').first().click();
  await expect.poll(() => page.locator('[data-testid="stage-svg"] [data-node-id]').count()).toBeGreaterThan(before);

  // Offline: itens instalados continuam disponíveis e usáveis.
  await expect(page.getByTestId('save-status')).toContainText('Salvo', { timeout: 15_000 });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('stage')).toBeVisible();
  await tab(page, 'library');
  await page.getByTestId('toolbox-search').fill('Lon Ruan');
  const n2 = await page.locator('[data-testid="stage-svg"] [data-node-id]').count();
  await page.locator('[data-testid="toolbox-panel"] [data-name="Lon Ruan"] .card-main').first().click();
  await expect.poll(() => page.locator('[data-testid="stage-svg"] [data-node-id]').count()).toBeGreaterThan(n2);
  await context.setOffline(false);
  expect(errors.filter((e) => !/Failed to load resource|net::ERR/.test(e))).toEqual([]);
});

test('catálogo oficial sem conexão: erro claro com "tentar de novo" e pacotes instalados intactos', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await context.setOffline(true);
  await openOfficial(page);
  await expect(page.getByTestId('official-error')).toContainText('Não foi possível carregar o catálogo oficial');
  await expect(page.getByTestId('official-error')).toContainText('continuam funcionando offline');
  await context.setOffline(false);
  await page.getByTestId('official-retry').click();
  await expect(page.getByTestId('official-pack')).toHaveCount(7);
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('catálogo oficial cabe na tela e os botões ficam alcançáveis', async ({ page }) => {
    await page.goto('/');
    await openOfficial(page);
    await expect(page.getByTestId('official-pack').first()).toBeVisible();
    await assertNoBodyOverflow(page);
    const b = (await page.getByTestId('official-pack').first().boundingBox())!;
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(390.5);
    await expect(page.getByTestId('official-install').first()).toBeVisible();
  });
});
