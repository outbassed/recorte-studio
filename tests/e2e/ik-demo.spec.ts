/**
 * Captura da demonstração do IK (npm run shots / playwright --project=shots): importa o projeto de demonstração,
 * percorre a timeline e salva quadros reais do palco, mais uma folha-contato. Os arquivos ficam em docs/recortestudio/demo/.
 */
import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve('docs/recortestudio/demo');
const FRAMES: Array<[string, string, string]> = [
  ['0,2', 'quadro-1-pose', 'Início: IK com força 0, o braço usa a pose'],
  ['2', 'quadro-2-apontando', 'Aponta para o vaso (longe): braço esticado na direção dele'],
  ['3,2', 'quadro-3-transicao', 'O alvo se move: o braço acompanha, sem saltos'],
  ['4,9', 'quadro-4-alcancando', 'Alcança a caneca (perto): a mão chega nela'],
  ['6,5', 'quadro-5-fim', 'Força volta a 0: o braço volta à pose'],
];

test('demonstração do IK: quadros reais do palco', async ({ page }) => {
  mkdirSync(DIR, { recursive: true });
  await page.goto('/');
  await page.getByTestId('project-input').setInputFiles(resolve('docs/recortestudio/demo/ik-apontar-e-alcancar.json'));
  const report = page.getByTestId('import-report');
  if (await report.isVisible().catch(() => false)) await report.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByTestId('stage')).toBeVisible();
  await page.addStyleTag({ content: '.stage-overlay{display:none !important}' }); // só o quadro da animação, sem as guias do editor
  const imgs: Array<{ file: string; label: string; b64: string }> = [];
  for (const [t, file, label] of FRAMES) {
    await page.getByTestId('time-input').fill(t);
    await page.getByTestId('time-input').press('Enter');
    await page.waitForTimeout(150);
    const buf = await page.getByTestId('stage-svg').screenshot({ path: resolve(DIR, `${file}.png`) });
    imgs.push({ file, label, b64: buf.toString('base64') });
  }
  // Folha-contato com legendas.
  await page.setContent(`<body style="margin:0;background:#12151c;font:14px Inter,Arial,sans-serif;color:#e8eaf0"><div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:10px;width:1500px">${imgs.map((i, n) => `<figure style="margin:0"><img style="width:100%;border-radius:6px;display:block" src="data:image/png;base64,${i.b64}"/><figcaption style="padding:6px 2px">${n + 1}. ${i.label}</figcaption></figure>`).join('')}</div></body>`);
  await page.setViewportSize({ width: 1520, height: 1100 });
  const sheet = await page.screenshot({ fullPage: true });
  writeFileSync(resolve(DIR, 'folha-contato.png'), sheet);
  expect(readFileSync(resolve(DIR, 'quadro-4-alcancando.png')).length).toBeGreaterThan(5000);
});
