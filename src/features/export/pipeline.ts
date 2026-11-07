/**
 * Exportação. Todo quadro passa por: plano → SVG → imagem → canvas. O tempo de cada
 * quadro é calculado a partir do índice (i / fps), então não há drift.
 *
 * Vídeo: prefere WebCodecs + muxer (quadro a quadro, mais rápido que tempo real e com
 * timestamps exatos). Sem WebCodecs, cai para MediaRecorder em tempo real, avisando.
 */
import { zipSync, type Zippable } from 'fflate';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmTarget } from 'webm-muxer';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4Target } from 'mp4-muxer';
import type { Project } from '@/engine/model/schema';
import { buildMontage, planMontageFrame } from '@/engine/render/montage';
import { planFrame, planToSvgString, type AssetResolver } from '@/engine/render/plan';
import { preloadDataUrls } from '@/features/library/assets';
import { eventsFrom, montageAudioEvents, scheduleGain, sceneAudioEvents, type AudioEvent } from '@/features/audio/mix';
import { getBuffer } from '@/features/audio/engine';
import { deepClone } from '@/engine/model/ids';

export type ExportScope = { kind: 'current'; sceneId: string } | { kind: 'range'; sceneId: string; startMs: number; endMs: number } | { kind: 'project' };

export interface ResolutionPreset { id: string; label: string; short: number }
export const RESOLUTIONS: ResolutionPreset[] = [
  { id: '480', label: '480p', short: 480 },
  { id: '720', label: '720p', short: 720 },
  { id: '1080', label: '1080p', short: 1080 },
];
export const MAX_EXPORT_DIMENSION = 4096;

/** Resolução de saída respeitando a proporção do projeto. Sempre par (exigido por codecs). */
export function resolveOutputSize(settings: { width: number; height: number }, shortSide: number | null, custom?: { w: number; h: number }): { w: number; h: number } {
  const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);
  if (custom) {
    const k = Math.min(1, MAX_EXPORT_DIMENSION / Math.max(custom.w, custom.h));
    return { w: even(custom.w * k), h: even(custom.h * k) };
  }
  const short = shortSide ?? Math.min(settings.width, settings.height);
  const k = short / Math.min(settings.width, settings.height);
  let w = settings.width * k;
  let h = settings.height * k;
  const limit = MAX_EXPORT_DIMENSION / Math.max(w, h);
  if (limit < 1) {
    w *= limit;
    h *= limit;
  }
  return { w: even(w), h: even(h) };
}

export interface ExportProgress { done: number; total: number; label: string }
export type ProgressFn = (p: ExportProgress) => void;

export function scopeRange(project: Project, scope: ExportScope): { totalMs: number; frameAt: (t: number, assets: AssetResolver, transparent: boolean) => string; size: (w: number, h: number) => void; events: AudioEvent[] } {
  let W = project.settings.width;
  let H = project.settings.height;
  const size = (w: number, h: number) => {
    W = w;
    H = h;
  };
  if (scope.kind === 'project') {
    const { segments, totalMs } = buildMontage(project);
    return {
      totalMs,
      size,
      events: montageAudioEvents(project, segments),
      frameAt: (t, assets, transparent) => planToSvgString(planMontageFrame(project, segments, t, assets, { transparentBg: transparent }), W, H),
    };
  }
  const scene = project.scenes[scope.sceneId]!;
  const start = scope.kind === 'range' ? scope.startMs : 0;
  const end = scope.kind === 'range' ? Math.min(scope.endMs, scene.durationMs) : scene.durationMs;
  const events = eventsFrom(sceneAudioEvents(scene, 0, project.settings.masterVolume), start).map((e) => ({ ...e, whenMs: e.whenMs - start }));
  return {
    totalMs: Math.max(1, end - start),
    size,
    events,
    frameAt: (t, assets, transparent) => planToSvgString(planFrame(project, scene, start + t, assets, { transparentBg: transparent }), W, H),
  };
}

/** Desenha um SVG completo em um canvas. */
export async function drawSvgToCanvas(svg: string, ctx: CanvasRenderingContext2D, w: number, h: number, clear = true): Promise<void> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (clear) ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const createCanvas = (w: number, h: number): HTMLCanvasElement => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
};

const yieldToUI = () => new Promise<void>((r) => setTimeout(r, 0));

const canvasToBlob = (c: HTMLCanvasElement, type = 'image/png'): Promise<Blob> =>
  new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao codificar a imagem.'))), type));

export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Exportação cancelada', 'AbortError');
}

export async function exportFramePng(project: Project, sceneId: string, timeMs: number, size: { w: number; h: number }, transparent = false): Promise<Blob> {
  const assets = await preloadDataUrls(project);
  const scene = project.scenes[sceneId]!;
  const svg = planToSvgString(planFrame(project, scene, timeMs, assets, { transparentBg: transparent }), size.w, size.h);
  const canvas = createCanvas(size.w, size.h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');
  await drawSvgToCanvas(svg, ctx, size.w, size.h);
  return canvasToBlob(canvas);
}

export async function exportPngSequence(project: Project, scope: ExportScope, size: { w: number; h: number }, fps: number, opts: { transparent?: boolean; onProgress?: ProgressFn; signal?: AbortSignal } = {}): Promise<Blob> {
  const assets = await preloadDataUrls(project);
  const r = scopeRange(project, scope);
  r.size(size.w, size.h);
  const total = Math.max(1, Math.ceil((r.totalMs / 1000) * fps));
  const canvas = createCanvas(size.w, size.h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');
  const files: Zippable = {};
  for (let i = 0; i < total; i++) {
    throwIfAborted(opts.signal);
    await drawSvgToCanvas(r.frameAt((i / fps) * 1000, assets, !!opts.transparent), ctx, size.w, size.h);
    const blob = await canvasToBlob(canvas);
    files[`quadro_${String(i).padStart(6, '0')}.png`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    opts.onProgress?.({ done: i + 1, total, label: `Quadro ${i + 1} de ${total}` });
    if (i % 3 === 0) await yieldToUI();
  }
  return new Blob([zipSync(files, { level: 0 }) as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

/* ------------------------------ Áudio ------------------------------ */

export async function renderAudioMix(events: AudioEvent[], totalMs: number, sampleRate: number): Promise<AudioBuffer | null> {
  if (events.length === 0) return null;
  const length = Math.ceil((totalMs / 1000) * sampleRate);
  const off = new OfflineAudioContext(2, length, sampleRate);
  const buffers = await Promise.all(events.map((e) => getBuffer(e.assetId)));
  let any = false;
  events.forEach((e, i) => {
    const b = buffers[i];
    if (!b) return;
    any = true;
    const src = off.createBufferSource();
    src.buffer = b;
    const gain = off.createGain();
    const when = e.whenMs / 1000;
    scheduleGain(gain.gain, when, e);
    src.connect(gain).connect(off.destination);
    src.start(when, e.offsetMs / 1000, e.durationMs / 1000);
  });
  return any ? off.startRendering() : null;
}

/* ------------------------------ Vídeo ------------------------------ */

export type VideoFormat = 'webm' | 'mp4';

export interface VideoSupport {
  webCodecs: boolean;
  webmVideoCodec: string | null;
  webmAudio: boolean;
  mp4Video: boolean;
  mp4Audio: boolean;
  mediaRecorder: string | null;
}

const WEBM_CODECS: Array<{ encoder: string; muxer: 'V_VP9' | 'V_VP8' }> = [
  { encoder: 'vp09.00.10.08', muxer: 'V_VP9' },
  { encoder: 'vp8', muxer: 'V_VP8' },
];

export async function detectVideoSupport(w = 1280, h = 720, fps = 30): Promise<VideoSupport> {
  const out: VideoSupport = { webCodecs: false, webmVideoCodec: null, webmAudio: false, mp4Video: false, mp4Audio: false, mediaRecorder: null };
  if (typeof MediaRecorder !== 'undefined') {
    out.mediaRecorder = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
  }
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') return out;
  out.webCodecs = true;
  for (const c of WEBM_CODECS) {
    const r = await VideoEncoder.isConfigSupported({ codec: c.encoder, width: w, height: h, framerate: fps, bitrate: 5_000_000 }).catch(() => ({ supported: false }));
    if (r.supported) {
      out.webmVideoCodec = c.encoder;
      break;
    }
  }
  const avc = await VideoEncoder.isConfigSupported({ codec: h264Codec(w, h), width: w, height: h, framerate: fps, bitrate: 5_000_000 }).catch(() => ({ supported: false }));
  out.mp4Video = !!avc.supported;
  if (typeof AudioEncoder !== 'undefined') {
    const opus = await AudioEncoder.isConfigSupported({ codec: 'opus', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 }).catch(() => ({ supported: false }));
    out.webmAudio = !!opus.supported;
    const aac = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 128000 }).catch(() => ({ supported: false }));
    out.mp4Audio = !!aac.supported;
  }
  return out;
}

const h264Codec = (w: number, h: number) => (w * h > 2073600 ? 'avc1.640033' : 'avc1.640028');

export interface VideoOptions {
  format: VideoFormat;
  fps: number;
  size: { w: number; h: number };
  bitrate?: number;
  includeAudio: boolean;
  onProgress?: ProgressFn;
  signal?: AbortSignal;
}

export interface VideoResult { blob: Blob; method: 'webcodecs' | 'mediarecorder'; hasAudio: boolean; warnings: string[]; frames: number }

export async function exportVideo(project: Project, scope: ExportScope, opts: VideoOptions): Promise<VideoResult> {
  const { w, h } = opts.size;
  const support = await detectVideoSupport(w, h, opts.fps);
  if (opts.format === 'mp4' && !support.mp4Video) throw new Error('Este navegador não oferece codificador H.264 para MP4. Use WebM.');
  if (support.webCodecs && (opts.format === 'mp4' || support.webmVideoCodec)) return exportWebCodecs(project, scope, opts, support);
  if (opts.format === 'webm' && support.mediaRecorder) return exportMediaRecorder(project, scope, opts, support.mediaRecorder);
  throw new Error('Este navegador não tem como codificar vídeo (sem WebCodecs e sem MediaRecorder). Exporte a sequência de PNGs.');
}

async function exportWebCodecs(project: Project, scope: ExportScope, opts: VideoOptions, support: VideoSupport): Promise<VideoResult> {
  const { w, h } = opts.size;
  const { fps } = opts;
  const assets = await preloadDataUrls(project);
  const r = scopeRange(project, scope);
  r.size(w, h);
  const total = Math.max(1, Math.ceil((r.totalMs / 1000) * fps));
  const bitrate = opts.bitrate ?? Math.round(w * h * fps * 0.13);
  const warnings: string[] = [];
  const sampleRate = 48000;

  let mix: AudioBuffer | null = null;
  const audioAllowed = opts.format === 'webm' ? support.webmAudio : support.mp4Audio;
  if (opts.includeAudio && r.events.length) {
    if (audioAllowed) {
      opts.onProgress?.({ done: 0, total, label: 'Mixando áudio…' });
      mix = await renderAudioMix(r.events, r.totalMs, sampleRate);
    } else {
      warnings.push(`O navegador não codifica áudio para ${opts.format.toUpperCase()}: o vídeo saiu sem som.`);
    }
  }

  const isWebm = opts.format === 'webm';
  const webmCodec = WEBM_CODECS.find((c) => c.encoder === support.webmVideoCodec);
  const target = isWebm ? new WebmTarget() : new Mp4Target();
  const muxer = isWebm
    ? new WebmMuxer({
        target: target as WebmTarget,
        video: { codec: webmCodec?.muxer ?? 'V_VP8', width: w, height: h, frameRate: fps },
        ...(mix ? { audio: { codec: 'A_OPUS' as const, sampleRate, numberOfChannels: 2 } } : {}),
        firstTimestampBehavior: 'offset',
      })
    : new Mp4Muxer({
        target: target as Mp4Target,
        video: { codec: 'avc', width: w, height: h, frameRate: fps },
        ...(mix ? { audio: { codec: 'aac' as const, sampleRate, numberOfChannels: 2 } } : {}),
        fastStart: 'in-memory',
        firstTimestampBehavior: 'offset',
      });

  let encodeError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => (muxer as WebmMuxer<WebmTarget>).addVideoChunk(chunk, meta),
    error: (e) => {
      encodeError = e;
    },
  });
  videoEncoder.configure({
    codec: isWebm ? support.webmVideoCodec! : h264Codec(w, h),
    width: w, height: h, framerate: fps, bitrate,
    ...(isWebm ? {} : { avc: { format: 'avc' as const } }),
  });

  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('Canvas 2D indisponível.');
  try {
    for (let i = 0; i < total; i++) {
      throwIfAborted(opts.signal);
      if (encodeError) throw encodeError;
      const timeMs = (i / fps) * 1000;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      await drawSvgToCanvas(r.frameAt(timeMs, assets, false), ctx, w, h, false);
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i / fps) * 1e6), duration: Math.round(1e6 / fps) });
      videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
      frame.close();
      while (videoEncoder.encodeQueueSize > 8) await new Promise((res) => setTimeout(res, 4));
      opts.onProgress?.({ done: i + 1, total, label: `Codificando quadro ${i + 1} de ${total}` });
      if (i % 4 === 0) await yieldToUI();
    }
    await videoEncoder.flush();
    if (encodeError) throw encodeError;
    if (mix) await encodeAudio(mix, sampleRate, isWebm, muxer as WebmMuxer<WebmTarget>);
  } finally {
    if (videoEncoder.state !== 'closed') videoEncoder.close();
  }
  muxer.finalize();
  const buffer = (target as WebmTarget).buffer;
  return { blob: new Blob([buffer], { type: isWebm ? 'video/webm' : 'video/mp4' }), method: 'webcodecs', hasAudio: !!mix, warnings, frames: total };
}

async function encodeAudio(mix: AudioBuffer, sampleRate: number, isWebm: boolean, muxer: WebmMuxer<WebmTarget>): Promise<void> {
  let err: Error | null = null;
  const enc = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (e) => {
      err = e;
    },
  });
  enc.configure({ codec: isWebm ? 'opus' : 'mp4a.40.2', sampleRate, numberOfChannels: 2, bitrate: 160_000 });
  const L = mix.getChannelData(0);
  const R = mix.numberOfChannels > 1 ? mix.getChannelData(1) : L;
  const chunk = 4800;
  for (let i = 0; i < mix.length; i += chunk) {
    const n = Math.min(chunk, mix.length - i);
    const data = new Float32Array(n * 2);
    data.set(L.subarray(i, i + n), 0);
    data.set(R.subarray(i, i + n), n);
    const ad = new AudioData({ format: 'f32-planar', sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round((i / sampleRate) * 1e6), data });
    enc.encode(ad);
    ad.close();
  }
  await enc.flush();
  enc.close();
  if (err) throw err;
}

async function exportMediaRecorder(project: Project, scope: ExportScope, opts: VideoOptions, mime: string): Promise<VideoResult> {
  const { w, h } = opts.size;
  const assets = await preloadDataUrls(project);
  const r = scopeRange(project, scope);
  r.size(w, h);
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D indisponível.');
  const stream = canvas.captureStream(opts.fps);
  const warnings = ['Exportação em tempo real via MediaRecorder: não mude de aba até terminar. A sincronia é aproximada.'];
  let audioCtx: AudioContext | null = null;
  let hasAudio = false;
  if (opts.includeAudio && r.events.length) {
    const mix = await renderAudioMix(r.events, r.totalMs, 48000);
    if (mix) {
      audioCtx = new AudioContext({ sampleRate: 48000 });
      const dest = audioCtx.createMediaStreamDestination();
      const src = audioCtx.createBufferSource();
      src.buffer = mix;
      src.connect(dest);
      src.start();
      dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
      hasAudio = true;
    }
  }
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: opts.bitrate ?? 6_000_000 });
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const finished = new Promise<void>((res) => {
    rec.onstop = () => res();
  });
  rec.start(250);
  const t0 = performance.now();
  let frames = 0;
  try {
    while (true) {
      throwIfAborted(opts.signal);
      const t = performance.now() - t0;
      if (t >= r.totalMs) break;
      await drawSvgToCanvas(r.frameAt(t, assets, false), ctx, w, h);
      frames++;
      opts.onProgress?.({ done: Math.round(t), total: Math.round(r.totalMs), label: 'Gravando em tempo real…' });
      await new Promise((res) => setTimeout(res, 1000 / opts.fps / 2));
    }
  } finally {
    rec.stop();
    await finished;
    stream.getTracks().forEach((tr) => tr.stop());
    await audioCtx?.close();
  }
  return { blob: new Blob(chunks, { type: 'video/webm' }), method: 'mediarecorder', hasAudio, warnings, frames };
}

/* Projetos editáveis são salvos SÓ em .jrec: ver src/features/projects/jrec.ts. */

export const cloneForExport = deepClone;
