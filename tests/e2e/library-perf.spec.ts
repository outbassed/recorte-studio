/** Desempenho real: catálogo oficial INTEIRO instalado no Chrome; abrir a Biblioteca, buscar, filtrar e abrir o popup. */
import { expect, test } from '@playwright/test';

test('com todos os pacotes oficiais instalados a Biblioteca abre, busca e filtra rápido', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/');
  await page.getByTestId('home-nav-library').click();
  await page.getByTestId('library-tab-packs').click();
  await page.getByTestId('packs-view-official').click();
  await expect(page.getByTestId('official-catalog')).toBeVisible();
  const total = await page.getByTestId('official-pack').count();
  expect(total).toBeGreaterThanOrEqual(48);
  // Instala todos, um a um, pela própria interface.
  const t0 = Date.now();
  for (let i = 0; i < total; i++) {
    const left = await page.getByTestId('official-install').count();
    if (left === 0) break;
    await page.getByTestId('official-install').first().click();
    await expect.poll(() => page.getByTestId('official-install').count(), { timeout: 30_000 }).toBeLessThan(left);
  }
  const installMs = Date.now() - t0;
  await page.getByTestId('library-tab-items').click();
  const timed = async (fn: () => Promise<void>) => { const t = Date.now(); await fn(); return Date.now() - t; };
  const count = async () => Number(((await page.getByTestId('library-count').textContent()) ?? '').match(/\d+/)?.[0] ?? 0);
  await expect.poll(count, { timeout: 30_000 }).toBeGreaterThanOrEqual(875);
  const all = await count();
  const search = await timed(async () => { await page.getByTestId('library-search').fill('natal'); await expect.poll(count).toBeLessThan(all); });
  const found = await count();
  await page.getByTestId('library-search').fill('');
  await expect.poll(count).toBe(all);
  const filter = await timed(async () => { await page.locator('[data-testid="library-origins"] [data-filter="official"]').click(); await expect.poll(count).toBeLessThan(all); });
  const official = await count();
  const popup = await timed(async () => { await page.getByTestId('library-item').first().click(); await expect(page.getByTestId('library-detail')).toBeVisible(); });
  const rendered = await page.getByTestId('library-item').count();
  console.log(`PERF pacotes=${total} instalacao=${(installMs / 1000).toFixed(1)}s itens=${all} oficiais=${official} renderizados=${rendered} busca("natal")=${search}ms→${found} filtro=${filter}ms popup=${popup}ms`);
  expect(rendered).toBeLessThan(200); // grade progressiva: só a primeira página é desenhada
  expect(search).toBeLessThan(3000);
  expect(filter).toBeLessThan(3000);
  expect(popup).toBeLessThan(3000);
});
