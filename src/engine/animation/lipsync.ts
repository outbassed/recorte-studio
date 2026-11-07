/**
 * Lip-sync básico. Importante ser honesto: NÃO há reconhecimento de fonemas.
 *  - "text": sequência de visemas estimada a partir das letras do texto, distribuída
 *    no tempo do clip. Não analisa o áudio.
 *  - "amplitude": a abertura segue a intensidade do áudio decodificado.
 *  - "manual": o animador grava keyframes na trilha "Boca (visema)".
 */
import { hashString } from '../render/svg';

export const PEAK_WINDOW_MS = 20;

const VOWEL: Record<string, string> = {
  a: 'A', á: 'A', à: 'A', â: 'A', ã: 'A',
  e: 'E', é: 'E', ê: 'E',
  i: 'I', í: 'I', y: 'I',
  o: 'O', ó: 'O', ô: 'O', õ: 'O',
  u: 'U', ú: 'U', ü: 'U',
};
const CONS: Record<string, string> = {
  m: 'M', b: 'M', p: 'M',
  f: 'F', v: 'F',
  l: 'L', n: 'L', t: 'L', d: 'L', r: 'L',
  s: 'S', z: 'S', c: 'S', ç: 'S', x: 'S', j: 'S', g: 'E', q: 'U', k: 'E', h: 'rest', w: 'U',
};

export function textToVisemes(text: string): string[] {
  const out: string[] = [];
  for (const ch of text.toLowerCase()) {
    if (VOWEL[ch]) out.push(VOWEL[ch]!);
    else if (CONS[ch]) out.push(CONS[ch]!);
    else if (/[\s]/.test(ch)) out.push('rest');
    else if (/[.,;:!?…]/.test(ch)) out.push('rest', 'rest');
  }
  return out.length ? out : ['rest'];
}

const CACHE = new Map<string, string[]>();
export function visemeAt(text: string, localMs: number, durationMs: number): string {
  let seq = CACHE.get(text);
  if (!seq) {
    seq = textToVisemes(text);
    if (CACHE.size > 500) CACHE.clear();
    CACHE.set(text, seq);
  }
  // Fecha a boca nos últimos 60 ms para não "congelar" aberta.
  if (localMs >= durationMs - 60 || localMs < 0) return 'rest';
  const i = Math.floor((localMs / durationMs) * seq.length);
  return seq[Math.min(seq.length - 1, i)]!;
}

/** Abertura (0–1) a partir dos picos do áudio; determinística. */
export function amplitudeAt(peaks: readonly number[] | undefined, audioMs: number, sensitivity: number): number {
  if (!peaks || peaks.length === 0 || audioMs < 0) return 0;
  const i = Math.floor(audioMs / PEAK_WINDOW_MS);
  if (i >= peaks.length) return 0;
  const raw = peaks[i] ?? 0;
  return Math.min(1, Math.max(0, (raw - 0.02) * 2.4 * sensitivity));
}

export function amplitudeToViseme(a: number): { viseme: string; amount: number } {
  if (a < 0.08) return { viseme: 'rest', amount: 1 };
  if (a < 0.28) return { viseme: 'E', amount: 0.55 + a };
  if (a < 0.55) return { viseme: 'O', amount: 0.7 + a * 0.3 };
  return { viseme: 'A', amount: 1 };
}

/** Piscar automático determinístico: mesma cena + mesmo tempo = mesmo olho. */
export function autoBlink(nodeId: string, timeMs: number): number {
  const seed = hashString(nodeId);
  const period = 3400 + (seed % 2400);
  const offset = seed % period;
  const local = timeMs + offset;
  const cycle = Math.floor(local / period);
  const phase = local % period;
  const dur = 130;
  const curve = (p: number) => {
    if (p < 0 || p > dur) return 0;
    const t = p / dur;
    return t < 0.5 ? t * 2 : (1 - t) * 2;
  };
  // Cerca de 1 em cada 5 ciclos tem piscada dupla (determinística).
  const double = hashString(`${seed}:${cycle}`) % 5 === 0;
  return Math.max(curve(phase), double ? curve(phase - 230) : 0);
}

/** Calcula picos de um AudioBuffer-like (canais Float32Array). */
export function computePeaks(channels: Float32Array[], sampleRate: number): number[] {
  if (channels.length === 0) return [];
  const windowSize = Math.max(1, Math.floor((sampleRate * PEAK_WINDOW_MS) / 1000));
  const len = channels[0]!.length;
  const out: number[] = [];
  for (let i = 0; i < len; i += windowSize) {
    let peak = 0;
    const end = Math.min(len, i + windowSize);
    for (const ch of channels) {
      for (let j = i; j < end; j += 8) {
        const v = Math.abs(ch[j] ?? 0);
        if (v > peak) peak = v;
      }
    }
    out.push(Math.round(peak * 1000) / 1000);
  }
  return out;
}
