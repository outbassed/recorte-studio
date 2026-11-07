/** Motor de áudio ao vivo (Web Audio). O relógio da reprodução vem daqui quando há áudio. */
import { repo } from '@/storage/db';
import { eventsFrom, scheduleGain, type AudioEvent } from './mix';

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let active: AudioBufferSourceNode[] = [];

export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function decodeBlob(blob: Blob): Promise<AudioBuffer> {
  return blob.arrayBuffer().then((b) => audioContext().decodeAudioData(b));
}

export function getBuffer(assetId: string): Promise<AudioBuffer | null> {
  let p = buffers.get(assetId);
  if (!p) {
    p = repo.getBlob(assetId).then((b) => (b ? decodeBlob(b) : null)).catch(() => null);
    buffers.set(assetId, p);
  }
  return p;
}

export function forgetBuffer(assetId: string): void {
  buffers.delete(assetId);
}

export function stopAudio(): void {
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

/** Agenda os eventos a partir de `fromMs` da timeline. Retorna o instante-base do relógio. */
export async function playAudio(events: AudioEvent[], fromMs: number, rate: number): Promise<void> {
  stopAudio();
  const list = eventsFrom(events, fromMs);
  if (list.length === 0) return;
  const c = audioContext();
  if (c.state === 'suspended') await c.resume();
  const loaded = await Promise.all(list.map((e) => getBuffer(e.assetId)));
  const zero = c.currentTime + 0.03;
  list.forEach((e, i) => {
    const buffer = loaded[i];
    if (!buffer) return;
    const source = c.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = c.createGain();
    const when = zero + (e.whenMs - fromMs) / 1000 / rate;
    // A curva de ganho é calculada para velocidade 1; em outras velocidades ela é comprimida.
    scheduleGain(gain.gain, when, rate === 1 ? e : { ...e, durationMs: e.durationMs / rate, fadeInMs: e.fadeInMs / rate, fadeOutMs: e.fadeOutMs / rate });
    source.connect(gain).connect(c.destination);
    source.start(when, e.offsetMs / 1000, e.durationMs / 1000);
    active.push(source);
  });
}
