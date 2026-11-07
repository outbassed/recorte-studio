/** Importação de mídia: validação, sanitização, blobs em IndexedDB e resolução de URLs. */
import { mediaIdFor, sniffMedia } from './media';
import type { Asset, Project } from '@/engine/model/schema';
import { repo } from '@/storage/db';
import { computePeaks } from '@/engine/animation/lipsync';
import { decodeBlob } from '@/features/audio/engine';
import { sanitizeSvg } from './sanitizeSvg';

export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 150 * 1024 * 1024;
export type AudioCategory = 'voice' | 'music' | 'sfx' | 'ambient';
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

/** Guarda os bytes uma única vez, com ID derivado do conteúdo. */
async function storeBytes(bytes: Uint8Array, mime: string, name: string): Promise<{ id: string; hash?: string; reused: boolean }> {
  const { id, hash } = await mediaIdFor(bytes);
  const exists = await repo.hasBlob(id);
  if (!exists) await repo.putBlob(id, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: mime }), name);
  return { id, hash, reused: exists };
}

export async function importImageFile(file: File): Promise<{ asset: Asset; report: string[] }> {
  if (file.size > MAX_IMAGE_BYTES) throw new AssetError('Imagem maior que 25 MB.');
  const raw = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMedia(raw);
  if (!sniffed || sniffed.kind === 'audio') throw new AssetError(`Formato não suportado: ${file.name}. Use PNG, JPG, WebP, GIF ou SVG.`);
  const report: string[] = [];
  let bytes = raw;
  let width = 400;
  let height = 400;
  if (sniffed.kind === 'svg') {
    const res = sanitizeSvg(new TextDecoder().decode(raw));
    bytes = new TextEncoder().encode(res.svg);
    width = res.width;
    height = res.height;
    if (res.removed.length) report.push(`SVG sanitizado: ${[...new Set(res.removed)].slice(0, 6).join(', ')}.`);
  } else {
    const url = URL.createObjectURL(new Blob([raw], { type: sniffed.mime }));
    try {
      const size = await imageSize(url);
      width = size.w;
      height = size.h;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  const { id, hash } = await storeBytes(bytes, sniffed.mime, file.name);
  return {
    asset: { id, kind: sniffed.kind === 'svg' ? 'svg' : 'image', name: file.name, mime: sniffed.mime, size: bytes.length, width, height, createdAt: Date.now(), hash },
    report,
  };
}

export async function importAudioFile(file: File, category: AudioCategory = 'sfx'): Promise<Asset> {
  if (file.size > MAX_AUDIO_BYTES) throw new AssetError('Áudio maior que 150 MB.');
  const raw = new Uint8Array(await file.arrayBuffer());
  const sniffed = sniffMedia(raw);
  if (sniffed && sniffed.kind !== 'audio') throw new AssetError(`"${file.name}" não é um arquivo de áudio.`);
  const mime = sniffed?.mime ?? (file.type.startsWith('audio/') ? file.type : 'audio/mpeg');
  let buffer: AudioBuffer;
  try {
    buffer = await decodeBlob(new Blob([raw], { type: mime }));
  } catch {
    throw new AssetError('O navegador não conseguiu decodificar este áudio. Tente WAV, MP3 ou OGG.');
  }
  const channels: Float32Array[] = [];
  for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  const peaks = computePeaks(channels, buffer.sampleRate);
  const { id, hash } = await storeBytes(raw, mime, file.name);
  return {
    id, kind: 'audio', name: file.name, mime, size: raw.length, durationMs: Math.round(buffer.duration * 1000),
    peaks, createdAt: Date.now(), category, hash,
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
