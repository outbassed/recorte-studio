/** Marketplace: itens oficiais aparecem soltos, com download individual e opção de instalar o volume. */
import { expect, test, type Page } from '@playwright/test';
import { assertNoBodyOverflow, watchErrors } from './helpers';

const card = (page: Page, name: string) => page.getByTestId('marketplace-item').filter({ has: page.locator('.libh-name', { hasText: name }) }).first();
async function openMarket(page: Page) {
  await page.goto('/');
  await page.getByTestId('home-nav-library').click();
  await expect(page.getByTestId('library-tab-items')).toHaveAttribute('aria-selected', 'true');
  await expect.poll(async () => page.getByTestId('marketplace-item').count()).toBeGreaterThan(0);
}
const packsInDb = (page: Page) => page.evaluate(async () => new Promise<Array<{ id: string; items: Array<{ id: string }> }>>((resolve, reject) => {
  const req = indexedDB.open('recorte-studio');
  req.onerror = () => reject(req.error);
  req.onsuccess = () => {
    const db = req.result;
    const get = db.transaction('packs').objectStore('packs').getAll();
    get.onsuccess = () => { db.close(); resolve(get.result as Array<{ id: string; items: Array<{ id: string }> }>); };
    get.onerror = () => reject(get.error);
  };
}));

test('uma vitrine única apresenta itens oficiais não instalados, com seus próprios nomes e miniaturas', async ({ page }) => {
  const errors = watchErrors(page);
  await openMarket(page);
  await expect(page.getByTestId('official-catalog')).toHaveCount(0); // sem seção de pacotes no meio da Biblioteca
  await expect(page.getByTestId('official-pack')).toHaveCount(0);
  await page.getByTestId('library-search').fill('Óculos redondos');
  const item = card(page, 'Óculos redondos');
  await expect(item).toBeVisible();
  await expect(item).toContainText('Baixar');
  await expect(item.locator('img')).toBeVisible();
  await item.click();
  const modal = page.getByTestId('marketplace-detail');
  await expect(modal).toContainText('Óculos redondos');
  await expect(modal.getByTestId('marketplace-install-item')).toBeVisible();
  await expect(modal.getByTestId('marketplace-install-pack')).toContainText('Instalar pacote completo');
  await modal.getByTestId('marketplace-close').click();
  expect(errors).toEqual([]);
});

test('download avulso não instala o kit; depois o usuário pode instalar o volume sem duplicar o item', async ({ page }) => {
  test.setTimeout(150_000);
  await openMarket(page);
  await page.getByTestId('library-search').fill('Óculos redondos');
  await card(page, 'Óculos redondos').click();
  await page.getByTestId('marketplace-install-item').click();
  await expect(page.getByTestId('toasts')).toContainText('Pacote instalado');
  await expect.poll(async () => (await packsInDb(page)).length).toBe(1);
  const justOne = await packsInDb(page);
  expect(justOne[0]!.id).toMatch(/^rs-item-/);
  expect(justOne[0]!.items).toHaveLength(1);
  expect(justOne[0]!.items[0]!.id).toBe('rs-acess-oculos-redondos');
  await expect(page.getByTestId('library-item').filter({ hasText: 'Óculos redondos' })).toBeVisible();
  await expect(page.getByTestId('marketplace-item').filter({ hasText: 'Óculos redondos' })).toHaveCount(0);

  // Outros itens do mesmo kit permanecem disponíveis para baixar separadamente.
  await page.getByTestId('library-search').fill('Acessórios');
  const remain = page.getByTestId('marketplace-item').filter({ hasText: 'Acessórios' }).first();
  await expect(remain).toBeVisible();
  await remain.click();
  await page.getByTestId('marketplace-install-pack').click();
  await expect(page.getByTestId('toasts')).toContainText('Pacote instalado');
  await expect.poll(async () => (await packsInDb(page)).length).toBe(2);
  const both = await packsInDb(page);
  expect(both.find((p) => p.id === 'acessorios-1')?.items.length).toBe(21);
  expect(both.find((p) => p.id.startsWith('rs-item-'))?.items.length).toBe(1);
});

test('buscar e baixar personagem individual de Vila Torta, que continua disponível offline', async ({ page, context }) => {
  test.setTimeout(120_000);
  await openMarket(page);
  await page.getByTestId('library-search').fill('Lon Ruan');
  await card(page, 'Lon Ruan').click();
  await expect(page.getByTestId('marketplace-detail')).toContainText('Vila Torta');
  await page.getByTestId('marketplace-install-item').click();
  await expect(page.getByTestId('toasts')).toContainText('Pacote instalado');
  const mini = await packsInDb(page);
  expect(mini).toHaveLength(1);
  expect(mini[0]!.items).toHaveLength(1);
  expect(mini[0]!.items[0]!.id).toBe('char_3cww98uxr3');

  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await page.getByTestId('library-search').fill('Lon Ruan');
  await expect(page.getByTestId('library-item').filter({ hasText: 'Lon Ruan' })).toBeVisible();
  await context.setOffline(false);
});

test.describe('celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test('itens avulsos e botão de instalação cabem na tela', async ({ page }) => {
    await openMarket(page);
    await page.getByTestId('library-search').fill('Óculos redondos');
    await card(page, 'Óculos redondos').click();
    await expect(page.getByTestId('marketplace-install-item')).toBeVisible();
    await assertNoBodyOverflow(page);
  });
});
