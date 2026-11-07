// Ferramenta de desenvolvimento: abre o exemplo e captura o editor, listando erros do console.
// Uso: node tests/tools/quickshot.mjs saida-prefixo [largura] [altura]
import { chromium } from '@playwright/test';

const [prefix, w = '1366', h = '768'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({ viewport: { width: Number(w), height: Number(h) } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(`PAGEERROR ${e.message}`));
await page.goto('http://localhost:4173/');
await page.screenshot({ path: `${prefix}-projects.png` });
await page.getByTestId('demo-project').click();
await page.waitForTimeout(1200);
await page.screenshot({ path: `${prefix}-editor.png` });
await page.getByTestId('time-input').fill('1');
await page.getByTestId('time-input').press('Enter');
await page.waitForTimeout(300);
await page.screenshot({ path: `${prefix}-t1.png` });
console.log(errors.length ? errors.join('\n') : 'sem erros no console');
await browser.close();
