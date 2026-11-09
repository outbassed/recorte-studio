// Rasteriza SVGs de quadros em PNG (apenas para conferência visual; não faz parte da entrega).
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const files = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (const f of files) {
  await page.setContent(`<!doctype html><body style="margin:0;background:#000">${readFileSync(f, 'utf8')}</body>`);
  await page.screenshot({ path: f.replace(/\.svg$/, '.png') });
}
await browser.close();
