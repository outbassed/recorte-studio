/**
 * Motor de áudio ao vivo (Web Audio). O relógio da reprodução vem daqui quando há áudio.
 *
 * Cada play recebe um "token": se pause, seek ou troca de projeto acontecer enquanto os
 * buffers ainda decodificam, o agendamento antigo é descartado em vez de tocar atrasado.
 * Os buffers decodificados ficam num cache LRU limitado por memória.
 */
import { repo } from '@/storage/db';
import { editorVolume, usePrefs } from '@/state/prefs';
import { eventsFrom, scheduleGain, type AudioEvent } from './mix';

let ctx: AudioContext | null = null;
let active: AudioBufferSourceNode[] = [];
let playToken = 0;

let master: GainNode | null = null;
/** Volume do editor (Configurações → Áudio). A exportação mixa offline e não passa por aqui. */
function masterOut(c: AudioContext): AudioNode {
  if (!master || master.context !== c) {
    master = c.createGain();
    master.connect(c.destination);
  }
  master.gain.value = editorVolume();
  return master;
}
usePrefs.subscribe(() => {
  if (master) master.gain.value = editorVolume();
  if (previewEl) previewEl.volume = editorVolume();
});

export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  return blob.arrayBuffer().then((b) => audioContext().decodeAudioData(b));
}

/** Cache LRU por bytes decodificados (amostras float32). */
export class BufferCache<T> {
  private map = new Map<string, { value: Promise<T | null>; bytes: number }>();
  private used = 0;
  constructor(private maxBytes: number, private sizeOf: (v: T) => number) {}
  get(key: string, load: () => Promise<T | null>): Promise<T | null> {
    const hit = this.map.get(key);
    if (hit) {
      this.map.delete(key);
      this.map.set(key, hit);
      return hit.value;
    }
    const entry = { value: load(), bytes: 0 };
    this.map.set(key, entry);
    entry.value.then((v) => {
      if (this.map.get(key) !== entry) return;
      if (!v) {
        this.map.delete(key);
        return;
      }
      entry.bytes = this.sizeOf(v);
      this.used += entry.bytes;
      this.evict(key);
    }, () => this.map.delete(key));
    return entry.value;
  }
  private evict(keep: string): void {
    for (const [k, e] of this.map) {
      if (this.used <= this.maxBytes) break;
      if (k === keep) continue;
      this.map.delete(k);
      this.used -= e.bytes;
    }
  }
  delete(key: string): void {
    const e = this.map.get(key);
    if (e) this.used -= e.bytes;
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
    this.used = 0;
  }
  get size(): number {
    return this.map.size;
  }
  get usedBytes(): number {
    return this.used;
  }
}

/** ~256 MB de áudio decodificado (≈11 min de estéreo a 48 kHz). */
export const AUDIO_CACHE_BYTES = 256 * 1024 * 1024;
const buffers = new BufferCache<AudioBuffer>(AUDIO_CACHE_BYTES, (b) => b.length * b.numberOfChannels * 4);

export function getBuffer(assetId: string): Promise<AudioBuffer | null> {
  return buffers.get(assetId, () => repo.getBlob(assetId).then((b) => (b ? decodeBlob(b) : null)).catch(() => null));
}

export function forgetBuffer(assetId: string): void {
  buffers.delete(assetId);
}

/** Ao trocar de projeto: nada do anterior continua tocando nem ocupando memória. */
export function resetAudio(): void {
  stopAudio();
  buffers.clear();
}

export function stopAudio(): void {
  playToken++;
  for (const s of active) {
    try {
      s.stop();
      s.disconnect();
    } catch {
      /* já parado */
    }
  }
  active = [];
}

export const currentPlayToken = (): number => playToken;

/** Agenda os eventos a partir de `fromMs`. Resolve `false` se foi cancelado antes de tocar. */
export async function playAudio(events: AudioEvent[], fromMs: number, rate: number): Promise<boolean> {
  stopAudio();
  const token = playToken;
  const list = eventsFrom(events, fromMs);
  if (list.length === 0) return true;
  const c = audioContext();
  if (c.state === 'suspended') await c.resume();
  const loaded = await Promise.all(list.map((e) => getBuffer(e.assetId)));
  // Pause, seek ou troca de cena durante a decodificação: não tocar nada atrasado.
  if (token !== playToken) return false;
  const zero = c.currentTime + 0.03;
  list.forEach((e, i) => {
    const buffer = loaded[i];
    if (!buffer) return;
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = c.createGain();
    const when = zero + (e.whenMs - fromMs) / 1000 / rate;
    scheduleGain(gain.gain, when, rate === 1 ? e : { ...e, durationMs: e.durationMs / rate, fadeInMs: e.fadeInMs / rate, fadeOutMs: e.fadeOutMs / rate });
    source.connect(gain).connect(masterOut(c));
    source.start(when, e.offsetMs / 1000, e.durationMs / 1000);
    active.push(source);
  });
  return true;
}

/** Pré-escuta da biblioteca, independente da timeline. */
let previewEl: HTMLAudioElement | null = null;
let previewUrl: string | null = null;
let previewToken = 0;
export async function previewAudio(assetId: string | null, onEnd?: () => void): Promise<boolean> {
  const token = ++previewToken;
  if (previewEl) {
    previewEl.onended = null;
    previewEl.pause();
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewEl = null;
  previewUrl = null;
  if (!assetId) return false;
  const blob = await repo.getBlob(assetId);
  // Pediram para parar ou trocaram de arquivo enquanto o blob carregava: descarta.
  if (!blob || token !== previewToken) return false;
  const url = URL.createObjectURL(blob);
  const el = new Audio(url);
  el.volume = editorVolume();
  previewUrl = url;
  previewEl = el;
  el.onended = () => {
    if (token === previewToken) onEnd?.();
  };
  try {
    await el.play();
  } catch (e) {
    if (token !== previewToken) return false;
    throw e;
  }
  if (token !== previewToken) {
    el.pause();
    return false;
  }
  return true;
}
/** Para testes: estado atual da pré-escuta. */
export const previewState = () => ({ token: previewToken, playing: !!previewEl && !previewEl.paused });
