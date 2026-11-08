import { expect, type Download, type Page } from '@playwright/test';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { strFromU8, unzipSync } from 'fflate';

export const OUT = resolve('test-results/e2e');
mkdirSync(OUT, { recursive: true });

export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

export async function openDemo(page: Page) {
  await page.goto('/');
  await page.getByTestId('demo-project').click();
  await expect(page.getByTestId('stage')).toBeVisible();
}

export async function tab(page: Page, id: string) {
  await page.getByTestId(`tab-${id}`).click();
}

export async function selectLayer(page: Page, name: string) {
  await tab(page, 'layers');
  await page.locator(`[data-testid="layer-row"][data-node-name="${name}"] .layer-name`).click();
}

export async function setField(page: Page, testId: string, value: string) {
  const input = page.getByTestId(testId).locator('input[type="text"]');
  await input.fill(value);
  await input.press('Enter');
}

/** Estado real do documento lido do IndexedDB, sem passar pela interface. */
export async function waitSaved(page: Page) {
  await expect(page.getByTestId('save-status')).toContainText('Salvo', { timeout: 15000 });
}

export async function saveDownload(download: Download, name: string): Promise<string> {
  const path = resolve(OUT, name);
  await download.saveAs(path);
  return path;
}

export async function pngInfo(page: Page, path: string): Promise<{ w: number; h: number; pixel: (x: number, y: number) => Promise<number[]> }> {
  const b64 = readFileSync(path).toString('base64');
  const handle = await page.evaluateHandle(async (data) => {
    const img = new Image();
    img.src = `data:image/png;base64,${data}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    return c;
  }, b64);
  const size = await handle.evaluate((c: HTMLCanvasElement) => ({ w: c.width, h: c.height }));
  return {
    ...size,
    pixel: (x, y) => handle.evaluate((c: HTMLCanvasElement, p) => [...c.getContext('2d')!.getImageData(p.x, p.y, 1, 1).data], { x, y }),
  };
}

export function ffprobe(path: string): { streams: Array<{ codec_type: string; codec_name: string; width?: number; height?: number; nb_read_frames?: string }>; format: { duration: string; format_name: string } } {
  const out = execFileSync('ffprobe', ['-v', 'error', '-count_frames', '-show_streams', '-show_format', '-of', 'json', path], { encoding: 'utf8', maxBuffer: 1 << 26 });
  return JSON.parse(out);
}

/** Decodifica um quadro do vídeo com ffmpeg, provando que o arquivo é reproduzível. */
export function ffmpegFrame(path: string, atSec: number, name: string): string {
  const out = resolve(OUT, name);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(atSec), '-i', path, '-frames:v', '1', out]);
  return out;
}

/** Instantes em que o silêncio começa: prova a posição do áudio dentro do vídeo. */
export function silenceStarts(path: string): number[] {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', path, '-af', 'silencedetect=noise=-30dB:d=0.1', '-f', 'null', '-'], { encoding: 'utf8' });
  return [...r.stderr.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
}

/** WAV de teste: tom de 440 Hz com amplitude alternada, para exercitar o lip-sync. */
export function makeWav(seconds = 2): string {
  const rate = 48000;
  const n = rate * seconds;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24);
  buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    const env = Math.floor(t * 4) % 2 === 0 ? 0.8 : 0;
    buf.writeInt16LE(Math.round(Math.sin(2 * Math.PI * 440 * t) * env * 32000), 44 + i * 2);
  }
  const path = resolve(OUT, 'teste.wav');
  writeFileSync(path, buf);
  return path;
}

/** Sem overflow horizontal do body, nem rolagem da página. */
export async function assertNoBodyOverflow(page: Page) {
  const r = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    sh: document.documentElement.scrollHeight, ch: document.documentElement.clientHeight,
  }));
  expect(r.sw, 'overflow horizontal').toBeLessThanOrEqual(r.cw);
  expect(r.sh, 'overflow vertical').toBeLessThanOrEqual(r.ch);
}

export async function boxOf(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, `${testId} visível`).not.toBeNull();
  return box!;
}

export function inViewport(b: { x: number; y: number; width: number; height: number }, vp: { width: number; height: number }) {
  return b.x >= -0.5 && b.y >= -0.5 && b.x + b.width <= vp.width + 0.5 && b.y + b.height <= vp.height + 0.5;
}

/** Lê um .jrec (ZIP) baixado: manifest e project.json. */
export function readJrec(path: string): { manifest: { format: string; appVersion: string; assets: Array<{ id: string }>; missing: string[] }; project: { schemaVersion: number; sceneOrder: string[] } } {
  const files = unzipSync(new Uint8Array(readFileSync(path)));
  return { manifest: JSON.parse(strFromU8(files['manifest.json'])), project: JSON.parse(strFromU8(files['project.json'])) };
}

/** Imagem SVG simples (cor sólida) para testes de cenário. */
export function svgFile(name: string, color: string): string {
  const p = resolve(OUT, name);
  mkdirSync(OUT, { recursive: true });
  writeFileSync(p, `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="${color}"/></svg>`);
  return p;
}
