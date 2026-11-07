// Medição de desempenho no navegador real, com cena pesada (npm run preview antes).
import { chromium } from '@playwright/test';

const browser = await chromium.launch({ channel: 'chrome' });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
await page.goto('http://localhost:4173/');
await page.getByTestId('demo-project').click();
await page.getByTestId('stage').waitFor();
await page.getByTestId('tab-characters').click();
for (const name of ['Dona Lurdes', 'Seu Tião', 'Bia', 'Caio', 'Dra. Marta', 'Otávio', 'Rafa', 'Helena', 'Sargento Nuno', 'Luma']) {
  await page.locator(`[data-testid="builtin-character"][data-name="${name}"]`).click();
}
await page.getByTestId('tab-objects').click();
for (const id of ['table', 'tv', 'car', 'tree', 'shelf', 'door', 'plant', 'lamp', 'box', 'bench']) await page.locator(`[data-testid="prop-card"][data-prop="${id}"]`).click();
await page.getByTestId('play').click();
const result = await page.evaluate(async () => {
  const frames = [];
  let last = performance.now();
  const end = last + 4000;
  while (performance.now() < end) {
    await new Promise(requestAnimationFrame);
    const n = performance.now();
    frames.push(n - last);
    last = n;
  }
  frames.sort((a, b) => a - b);
  return {
    fps: Math.round((frames.length / 4) * 10) / 10,
    p50: Math.round(frames[Math.floor(frames.length / 2)] * 10) / 10,
    p95: Math.round(frames[Math.floor(frames.length * 0.95)] * 10) / 10,
    nodes: document.querySelectorAll('[data-testid="stage-svg"] [data-node-id]').length,
    memoryMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  };
});
console.log(JSON.stringify(result));
await browser.close();
