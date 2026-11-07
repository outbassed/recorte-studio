/** Importação de mídia: validação, sanitização, blobs em IndexedDB e resolução de URLs. */
import { uid } from '@/engine/model/ids';
import type { Asset, Project } from '@/engine/model/schema';
import { repo } from '@/storage/db';
import { computePeaks } from '@/engine/animation/lipsync';
import { decodeBlob } from '@/features/audio/engine';
import { sanitizeSvg } from './sanitizeSvg';

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 150 * 1024 * 1024;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp,.gif,.svg,image/png,image/jpeg,image/webp,image/gif,image/svg+xml';
export const AUDIO_ACCEPT = '.wav,.mp3,.ogg,.m4a,.aac,.webm,.flac,audio/*';

export class AssetError extends Error {}

const urlCache = new Map<string, string>();
const dataCache = new Map<string, string>();

const imageSize = (url: string) =>
  new Promise<{ w: number; h: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth || 400, h: img.naturalHeight || 400 });
    img.onerror = () => reject(new AssetError('Não foi possível ler esta imagem.'));
    img.src = url;
  });

export async function importImageFile(file: File): Promise<{ asset: Asset; report: string[] }> {
  const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (!isSvg && !IMAGE_TYPES.includes(file.type)) throw new AssetError(`Formato não suportado: ${file.type || file.name}. Use PNG, JPG, WebP, GIF ou SVG.`);
  if (file.size > MAX_IMAGE_BYTES) throw new AssetError('Imagem maior que 25 MB.');
  const id = uid('asset');
  let blob: Blob = file;
  const report: string[] = [];
  let width = 400;
  let height = 400;
  if (isSvg) {
    const res = sanitizeSvg(await file.text());
    blob = new Blob([res.svg], { type: 'image/svg+xml' });
    width = res.width;
    height = res.height;
    if (res.removed.length) report.push(`SVG sanitizado: ${[...new Set(res.removed)].slice(0, 6).join(', ')}.`);
  } else {
    const url = URL.createObjectURL(file);
    try {
      const size = await imageSize(url);
      width = size.w;
      height = size.h;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  await repo.putBlob(id, blob, file.name);
  return {
    asset: { id, kind: isSvg ? 'svg' : 'image', name: file.name, mime: blob.type, size: blob.size, width, height, createdAt: Date.now() },
    report,
  };
}

export async function importAudioFile(file: File): Promise<Asset> {
  if (!file.type.startsWith('audio/') && !/\.(wav|mp3|ogg|m4a|aac|flac|webm)$/i.test(file.name)) throw new AssetError('Formato de áudio não reconhecido.');
  if (file.size > MAX_AUDIO_BYTES) throw new AssetError('Áudio maior que 150 MB.');
  let buffer: AudioBuffer;
  try {
    buffer = await decodeBlob(file);
  } catch {
    throw new AssetError('O navegador não conseguiu decodificar este áudio. Tente WAV, MP3 ou OGG.');
  }
  const channels: Float32Array[] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  const id = uid('asset');
  await repo.putBlob(id, file, file.name);
  return {
    id, kind: 'audio', name: file.name, mime: file.type || 'audio/mpeg', size: file.size, durationMs: Math.round(buffer.duration * 1000),
    peaks: computePeaks(channels, buffer.sampleRate), createdAt: Date.now(),
  };
}

/** Carrega URLs de blob para o preview. */
export async function preloadAssetUrls(project: Project): Promise<void> {
  for (const a of Object.values(project.assets)) {
    if (a.kind === 'audio' || urlCache.has(a.id)) continue;
    const b = await repo.getBlob(a.id);
    if (b) urlCache.set(a.id, URL.createObjectURL(b));
  }
}

export const previewAssetUrl = (id: string): string | undefined => urlCache.get(id);

export function registerAssetBlob(id: string, blob: Blob): void {
  if (!urlCache.has(id)) urlCache.set(id, URL.createObjectURL(blob));
}

export function releaseAssetUrls(): void {
  for (const u of urlCache.values()) URL.revokeObjectURL(u);
  urlCache.clear();
  dataCache.clear();
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('leitura falhou'));
    r.readAsDataURL(b);
  });

/** Exportar: SVG-em-imagem não acessa blob: URLs, então as imagens viram data URLs. */
export async function preloadDataUrls(project: Project): Promise<(id: string) => string | undefined> {
  for (const a of Object.values(project.assets)) {
    if (a.kind === 'audio' || dataCache.has(a.id)) continue;
    const b = await repo.getBlob(a.id);
    if (b) dataCache.set(a.id, await blobToDataUrl(b));
  }
  return (id) => dataCache.get(id);
}
