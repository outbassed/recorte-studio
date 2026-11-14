/** Desempenho da vitrine unificada: ativos e disponíveis no mesmo catálogo, sem instalar os 48 volumes. */
import { expect, test } from '@playwright/test';

test('centenas de itens disponíveis carregam com paginação e busca rápida', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByTestId('home-nav-library').click();
  const count = async () => Number(((await page.getByTestId('library-count').textContent()) ?? '').match(/\d+/)?.[0] ?? 0);
  await expect.poll(count, { timeout: 30_000 }).toBeGreaterThanOrEqual(875);
  const all = await count();
  const timed = async (fn: () => Promise<void>) => { const start = Date.now(); await fn(); return Date.now() - start; };
  const search = await timed(async () => {
    await page.getByTestId('library-search').fill('natal');
    await expect.poll(count).toBeLessThan(all);
  });
  const found = await count();
  await page.getByTestId('library-search').fill('');
  await expect.poll(count).toBe(all);
  const filter = await timed(async () => {
    await page.locator('[data-testid="library-origins"] [data-filter="official"]').click();
    await expect.poll(count).toBeLessThan(all);
  });
  const official = await count();
  const modalMs = await timed(async () => {
    await page.getByTestId('marketplace-item').first().click();
    await expect(page.getByTestId('marketplace-detail')).toBeVisible();
  });
  const rendered = await page.getByTestId('library-results').locator(':scope > .libh-card').count();
  console.log(`PERF loja itens=${all} oficiais=${official} renderizados=${rendered} busca=${search}ms→${found} filtro=${filter}ms modal=${modalMs}ms`);
  expect(rendered).toBeLessThanOrEqual(80);
  expect(search).toBeLessThan(3000);
  expect(filter).toBeLessThan(3000);
  expect(modalMs).toBeLessThan(3000);
});
