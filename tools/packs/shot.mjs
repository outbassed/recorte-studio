// node tools/packs/shot.mjs <html> <png> [largura]   (usa o Chromium já instalado)
import { chromium } from '@playwright/test';
const [, , html, png, w = '1500'] = process.argv;
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: Number(w), height: 800 } });
await p.goto(`file://${html}`);
await p.screenshot({ path: png, fullPage: true });
await b.close();
