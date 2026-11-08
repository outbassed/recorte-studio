/**
 * Transporte: tempo atual e reprodução. O tempo muda a cada quadro, por isso é um
 * store próprio com assinatura direta: a UI só re-renderiza onde pede.
 * O relógio é o do AudioContext quando há áudio, senão performance.now (sem drift:
 * tempo = início + (agora − base), nunca somatório de deltas).
 */
import { createStore } from 'zustand/vanilla';
import { useStore } from 'zustand';
import { buildMontage, segmentAt } from '@/engine/render/montage';
import { montageAudioEvents, sceneAudioEvents } from '@/features/audio/mix';
import { audioContext, playAudio, stopAudio } from '@/features/audio/engine';
import { currentProject, useProjectStore } from './projectStore';
import { usePrefs } from './prefs';

let lastEmit = 0;

export interface TransportState {
  timeMs: number;
  playing: boolean;
  loop: boolean;
  /** Reproduz o projeto inteiro em vez da cena atual */
  projectMode: boolean;
  projectTimeMs: number;
  rate: number;
  rangeStart: number | null;
  rangeEnd: number | null;
}

export const transport = createStore<TransportState>(() => ({
  timeMs: 0,
  playing: false,
  loop: true,
  projectMode: false,
  projectTimeMs: 0,
  rate: 1,
  rangeStart: null,
  rangeEnd: null,
}));

export const useTransport = <T,>(sel: (s: TransportState) => T): T => useStore(transport, sel);

let raf = 0;
let baseClock = 0;
let baseTime = 0;
let useAudioClock = false;

const now = () => (useAudioClock ? audioContext().currentTime * 1000 : performance.now());

function hasAudio(): boolean {
  const p = useProjectStore.getState().project;
  if (!p) return false;
  return Object.values(p.assets).some((a) => a.kind === 'audio');
}

function sceneDuration(): number {
  const p = useProjectStore.getState().project;
  if (!p) return 1000;
  return p.scenes[p.currentSceneId ?? p.sceneOrder[0]!]?.durationMs ?? 1000;
}

async function startClock(fromMs: number): Promise<void> {
  const p = currentProject();
  const s = transport.getState();
  if (s.projectMode) {
    const { segments } = buildMontage(p);
    await playAudio(montageAudioEvents(p, segments), fromMs, s.rate);
  } else {
    const scene = p.scenes[p.currentSceneId ?? p.sceneOrder[0]!]!;
    await playAudio(sceneAudioEvents(scene, 0, p.settings.masterVolume), fromMs, s.rate);
  }
  useAudioClock = hasAudio();
  baseClock = now() + (useAudioClock ? 30 : 0);
  baseTime = fromMs;
}

function tick(): void {
  const s = transport.getState();
  if (!s.playing) return;
  // Limite de FPS da prévia (Configurações → Desempenho): pula atualizações intermediárias.
  const cap = usePrefs.getState().previewFps;
  const clock = now();
  if (cap && clock - lastEmit < 1000 / cap - 2) {
    raf = requestAnimationFrame(tick);
    return;
  }
  lastEmit = clock;
  const elapsed = (now() - baseClock) * s.rate;
  let t = baseTime + Math.max(0, elapsed);
  const p = useProjectStore.getState().project;
  if (!p) return;
  if (s.projectMode) {
    const { segments, totalMs } = buildMontage(p);
    if (t >= totalMs) {
      if (s.loop) {
        t = 0;
        void startClock(0);
      } else {
        pause();
        t = totalMs;
      }
    }
    const idx = segmentAt(segments, t);
    const seg = segments[idx]!;
    if (seg.sceneId !== p.currentSceneId) useProjectStore.setState({ project: { ...p, currentSceneId: seg.sceneId } });
    transport.setState({ projectTimeMs: t, timeMs: Math.max(0, t - seg.startMs) });
  } else {
    const dur = sceneDuration();
    const start = s.rangeStart ?? 0;
    const end = s.rangeEnd ?? dur;
    if (t >= end) {
      if (s.loop) {
        t = start;
        void startClock(start);
      } else {
        transport.setState({ timeMs: end });
        pause();
        return;
      }
    }
    transport.setState({ timeMs: t });
  }
  raf = requestAnimationFrame(tick);
}

export async function play(): Promise<void> {
  const s = transport.getState();
  if (s.playing) return;
  const from = s.projectMode ? s.projectTimeMs : s.timeMs >= (s.rangeEnd ?? sceneDuration()) ? (s.rangeStart ?? 0) : s.timeMs;
  transport.setState({ playing: true, timeMs: s.projectMode ? s.timeMs : from });
  await startClock(from);
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
}

export function pause(): void {
  cancelAnimationFrame(raf);
  stopAudio();
  transport.setState({ playing: false });
}

export const togglePlay = (): void => {
  if (transport.getState().playing) pause();
  else void play();
};

export function stop(): void {
  pause();
  transport.setState({ timeMs: transport.getState().rangeStart ?? 0, projectTimeMs: 0 });
}

export function seek(ms: number): void {
  const s = transport.getState();
  const t = Math.max(0, Math.min(sceneDuration(), Math.round(ms)));
  transport.setState({ timeMs: t });
  if (s.playing && !s.projectMode) void startClock(t);
}

export function setRate(rate: number): void {
  const s = transport.getState();
  transport.setState({ rate });
  if (s.playing) void startClock(s.projectMode ? s.projectTimeMs : s.timeMs);
}

export function setProjectMode(on: boolean): void {
  pause();
  transport.setState({ projectMode: on, projectTimeMs: 0, timeMs: 0 });
  if (on) {
    const p = currentProject();
    const first = p.sceneOrder[0];
    if (first) useProjectStore.setState({ project: { ...p, currentSceneId: first } });
  }
}

export function resetTransport(): void {
  pause();
  transport.setState({ timeMs: 0, projectTimeMs: 0, projectMode: false, rangeStart: null, rangeEnd: null });
}
