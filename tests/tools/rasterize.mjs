// Ferramenta de desenvolvimento: abre um SVG/HTML local no Chrome e salva um PNG.
// Uso: node tests/tools/rasterize.mjs entrada.svg saida.png [largura] [altura]
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [input, output, w = '1800', h = '1200'] = process.argv.slice(2);
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
await page.setContent(`<!doctype html><body style="margin:0;background:#8fa3b5">${readFileSync(resolve(input), 'utf8')}</body>`);
await page.screenshot({ path: output });
await browser.close();
