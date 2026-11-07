/** Agenda de áudio: a mesma lista de eventos serve à reprodução e à exportação. */
import type { MontageSegment } from '@/engine/render/montage';
import type { AudioClip, Project, Scene } from '@/engine/model/schema';

export interface AudioEvent {
  assetId: string;
  whenMs: number;
  offsetMs: number;
  durationMs: number;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
}

export function sceneAudioEvents(scene: Scene, baseMs = 0, master = 1): AudioEvent[] {
  const tracks = scene.tracks.filter((t) => t.type === 'audio');
  const anySolo = tracks.some((t) => t.solo);
  const out: AudioEvent[] = [];
  for (const t of tracks) {
    if (t.type !== 'audio' || !t.enabled || t.muted || (anySolo && !t.solo)) continue;
    for (const c of t.clips as AudioClip[]) {
      const dur = Math.min(c.durationMs, Math.max(0, scene.durationMs - c.startMs));
      if (dur <= 0) continue;
      out.push({ assetId: c.assetId, whenMs: baseMs + c.startMs, offsetMs: c.offsetMs, durationMs: dur, volume: c.volume * master, fadeInMs: c.fadeInMs, fadeOutMs: c.fadeOutMs });
    }
  }
  return out;
}

export function montageAudioEvents(project: Project, segments: MontageSegment[]): AudioEvent[] {
  const out: AudioEvent[] = [];
  for (const seg of segments) {
    const scene = project.scenes[seg.sceneId];
    if (scene) out.push(...sceneAudioEvents(scene, seg.startMs, project.settings.masterVolume));
  }
  return out;
}

/** Recorta eventos para começar a tocar a partir de `fromMs`. */
export function eventsFrom(events: AudioEvent[], fromMs: number): AudioEvent[] {
  const out: AudioEvent[] = [];
  for (const e of events) {
    const end = e.whenMs + e.durationMs;
    if (end <= fromMs) continue;
    if (e.whenMs >= fromMs) out.push(e);
    else {
      const skip = fromMs - e.whenMs;
      out.push({ ...e, whenMs: fromMs, offsetMs: e.offsetMs + skip, durationMs: e.durationMs - skip, fadeInMs: Math.max(0, e.fadeInMs - skip) });
    }
  }
  return out;
}

/** Curva de ganho idêntica para live e offline. */
export function scheduleGain(gain: AudioParam, startSec: number, e: AudioEvent): void {
  const dur = e.durationMs / 1000;
  const fi = Math.min(e.fadeInMs / 1000, dur);
  const fo = Math.min(e.fadeOutMs / 1000, dur - fi);
  gain.setValueAtTime(fi > 0 ? 0 : e.volume, startSec);
  if (fi > 0) gain.linearRampToValueAtTime(e.volume, startSec + fi);
  if (fo > 0) {
    gain.setValueAtTime(e.volume, startSec + dur - fo);
    gain.linearRampToValueAtTime(0, startSec + dur);
  }
}
