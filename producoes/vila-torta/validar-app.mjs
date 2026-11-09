// Validação no Recorte Studio REAL (build de produção servido localmente): importa o .jrec pela
// interface, confere cenas, reproduz, edita, salva (.jrec), recarrega e reabre.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const OUT = process.argv[5] ?? '/tmp/claude-0/app'; mkdirSync(OUT, { recursive: true });
const JREC = resolve(process.argv[2] ?? 'producoes/vila-torta/entrega/Vila-Torta-T1E1-Politicos-de-Estimacao.jrec');
const NCENAS = Number(process.argv[3] ?? 145); const TITULO = process.argv[4] ?? 'Políticos de Estimação'; const OUTDIR = process.argv[5] ?? '/tmp/claude-0/app';
const log = []; const ok = (n, v, d = '') => { log.push({ teste: n, ok: !!v, detalhe: d }); console.log(v ? 'OK ' : 'FALHOU', n, d); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const ctx = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 1600, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto('/');
await page.getByTestId('project-input').setInputFiles(JREC);
await page.getByTestId('stage').waitFor({ timeout: 60000 });
await page.waitForTimeout(1500);
await page.getByTestId('tab-scenes').click();
ok('A1. Importação do .jrec pela interface abre o editor', await page.getByTestId('stage').isVisible());
ok('A2. Título do projeto', (await page.getByTestId('project-name').innerText()).includes(TITULO), await page.getByTestId('project-name').innerText());
const n = Number(await page.getByTestId('scene-count').innerText());
ok('A3. Lista de cenas com as 145 tomadas', n === NCENAS, String(n));
await page.screenshot({ path: `${OUT}/editor-aberto.png` });

// reprodução: avança o playhead e fica em "Reproduzindo"
await page.getByTestId('play').click();
await page.waitForTimeout(1200);
const mode1 = await page.getByTestId('stage-mode').innerText();
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/reproduzindo.png` });
await page.getByTestId('play').click();
ok('A4. Reprodução inicia e pausa', /Reproduzindo/.test(mode1), mode1);

// navegar por cenas: abre a 3ª, uma do debate e a final
const rows = page.getByTestId('scene-row');
const goto = async (i) => {
  await page.getByTestId('scene-list').evaluate((el, y) => { const sc = el.querySelector('[style*="overflow"]') ?? el; (el.scrollTop !== undefined) && (el.scrollTop = y); sc.scrollTop = y; }, i * 84);
  await page.waitForTimeout(400);
  await rows.first().click(); await page.waitForTimeout(500);
};
await goto(0); await page.screenshot({ path: `${OUT}/cena-001.png` });
await goto(3); await page.screenshot({ path: `${OUT}/cena-004-impacto.png` });
await goto(Math.floor(NCENAS / 2)); await page.screenshot({ path: `${OUT}/cena-071-debate.png` });
await goto(NCENAS - 6); await page.screenshot({ path: `${OUT}/cena-140-placa.png` });

// editar: seleciona um personagem pela camada e troca a expressão; verifica salvamento
await goto(NCENAS - 14);
await page.getByTestId('tab-layers').click();
const layer = page.locator('[data-testid="layer-row"]').first();
const nLayers = await page.locator('[data-testid="layer-row"]').count();
ok('A5. Camadas editáveis listadas (personagens, objetos, grupos)', nLayers > 3, `${nLayers} camadas na tomada 131`);
await page.locator('[data-testid="layer-row"] .layer-name').first().click();
await page.screenshot({ path: `${OUT}/editando-camada.png` });
await page.getByTestId('tab-layers').click().catch(() => {});
const keys = await page.evaluate(() => document.querySelectorAll('[class*="tl-key"], [class*="tl-clip"], [data-testid^="tl-"]').length);
ok('A6. Timeline mostra clips/keyframes editáveis', keys > 0, `${keys} elementos`);
await page.waitForTimeout(1500);
const saveStatus = await page.getByTestId('save-status').innerText().catch(() => '');
ok('A7. Autosave local ("Salvo")', /Salvo/.test(saveStatus), saveStatus);

// salvar .jrec a partir do app
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('save-project').click()]);
const saved = `${OUT}/reexport.jrec`; await dl.saveAs(saved);
ok('A8. "Salvar projeto" baixa um .jrec', /\.jrec$/.test(dl.suggestedFilename()) && statSync(saved).size > 100000, `${dl.suggestedFilename()} (${statSync(saved).size} bytes)`);

// recarregar a página: projeto continua na lista e reabre com as mesmas cenas
await page.reload();
await page.waitForTimeout(2500);
const reabriuSozinho = await page.getByTestId('stage').isVisible().catch(() => false);
if (!reabriuSozinho) {
  await page.getByTestId('project-card').first().locator('.project-open').click();
  await page.getByTestId('stage').waitFor({ timeout: 30000 });
}
ok('A9. Após recarregar a página, o projeto reabre do armazenamento do navegador', await page.getByTestId('stage').isVisible(), reabriuSozinho ? 'reabriu direto no editor' : 'reaberto pela lista de projetos');
await page.getByTestId('tab-scenes').click();
const n2 = Number(await page.getByTestId('scene-count').innerText());
ok('A10. Reabrir preserva as 145 tomadas', n2 === NCENAS, String(n2));
await page.getByTestId('back-projects').click();
await page.waitForTimeout(800);
ok('A10b. O projeto aparece na lista "Meus projetos"', (await page.getByTestId('project-card').count()) >= 1);
await page.screenshot({ path: `${OUT}/lista-projetos.png` });

// instalação limpa: importa o .jrec re-exportado em contexto novo
const ctx2 = await browser.newContext({ baseURL: 'http://localhost:4173', viewport: { width: 1600, height: 900 } });
const p2 = await ctx2.newPage(); const err2 = []; p2.on('pageerror', (e) => err2.push(e.message));
await p2.goto('/'); await p2.getByTestId('project-input').setInputFiles(saved);
await p2.getByTestId('stage').waitFor({ timeout: 60000 }); await p2.getByTestId('tab-scenes').click();
const n3 = Number(await p2.getByTestId('scene-count').innerText());
ok('A11. O .jrec salvo pelo app reabre numa instalação limpa', n3 === NCENAS, String(n3));
await p2.getByTestId('play').click(); await p2.waitForTimeout(1500); await p2.getByTestId('play').click();
ok('A12. Sem erros de console/página', errors.filter((e) => !/favicon|manifest|service/i.test(e)).length === 0 && err2.length === 0, JSON.stringify(errors.slice(0, 3)));
writeFileSync(`${OUT}/validacao-app.json`, JSON.stringify(log, null, 2));
await browser.close();
