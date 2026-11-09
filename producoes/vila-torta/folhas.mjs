// Folhas de contato para revisão visual (uso interno; não faz parte da entrega).
import { createRequire } from 'node:module';
import { readdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dir = process.argv[2] ?? '/tmp/claude-0/shots';
const files = readdirSync(dir).filter((f) => /^s\d+_\d+\.svg$/.test(f)).sort();
const per = 20; const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
for (let i = 0; i < files.length; i += per) {
  const chunk = files.slice(i, i + per);
  const html = `<body style="margin:0;background:#111;display:grid;grid-template-columns:repeat(5,384px);grid-auto-rows:216px;gap:0">${chunk.map((f) => `<div style="position:relative;width:384px;height:216px;overflow:hidden"><img src="file://${dir}/${f}" width="384" height="216"><span style="position:absolute;left:2px;top:2px;background:#000c;color:#fff;font:bold 13px sans-serif;padding:1px 4px">${f.slice(1, 4)}</span></div>`).join('')}</body>`;
  writeFileSync('/tmp/claude-0/folha.html', html);
  await page.goto('file:///tmp/claude-0/folha.html'); await page.waitForTimeout(600);
  await page.screenshot({ path: `${dir}/folha_${String(i / per + 1).padStart(2, '0')}.png`, clip: { x: 0, y: 0, width: 1920, height: 864 } });
}
await browser.close();
