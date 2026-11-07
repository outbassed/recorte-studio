/**
 * Mídia endereçada por conteúdo. O ID de uma mídia nova é derivado do SHA-256 dos
 * bytes, então o mesmo arquivo nunca é guardado duas vezes e dois arquivos
 * diferentes nunca disputam o mesmo ID, inclusive entre projetos importados.
 */
import { uid } from '@/engine/model/ids';

export async function sha256Hex(data: Uint8Array | ArrayBuffer): Promise<string | null> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return null;
  const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
  const digest = await subtle.digest('SHA-256', buf as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** ID estável para os bytes. Sem WebCrypto (contexto inseguro), cai para um ID aleatório. */
export async function mediaIdFor(data: Uint8Array | ArrayBuffer): Promise<{ id: string; hash?: string }> {
  const hash = await sha256Hex(data);
  return hash ? { id: `media_${hash.slice(0, 40)}`, hash } : { id: uid('media') };
}

export type MediaKind = 'image' | 'svg' | 'audio';

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.subarray(from, Math.min(to, b.length)));

/** Tipo real pelo conteúdo, nunca só pela extensão. */
export function sniffMedia(bytes: Uint8Array): { kind: MediaKind; mime: string } | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return { kind: 'image', mime: 'image/png' };
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { kind: 'image', mime: 'image/jpeg' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return { kind: 'image', mime: 'image/webp' };
  if (ascii(bytes, 0, 4) === 'GIF8') return { kind: 'image', mime: 'image/gif' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WAVE') return { kind: 'audio', mime: 'audio/wav' };
  if (ascii(bytes, 0, 4) === 'OggS') return { kind: 'audio', mime: 'audio/ogg' };
  if (ascii(bytes, 0, 4) === 'fLaC') return { kind: 'audio', mime: 'audio/flac' };
  if (ascii(bytes, 0, 3) === 'ID3' || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0)) return { kind: 'audio', mime: 'audio/mpeg' };
  if (ascii(bytes, 4, 8) === 'ftyp') return { kind: 'audio', mime: 'audio/mp4' };
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: 'audio', mime: 'audio/webm' };
  const head = new TextDecoder().decode(bytes.subarray(0, 512)).replace(/^﻿/, '').trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return { kind: 'svg', mime: 'image/svg+xml' };
  return null;
}

export const extensionFor = (mime: string): string =>
  ({
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'image/svg+xml': '.svg',
    'audio/wav': '.wav', 'audio/ogg': '.ogg', 'audio/flac': '.flac', 'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/webm': '.webm',
  })[mime] ?? '.bin';
