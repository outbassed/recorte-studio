/** Balões de diálogo e legendas originais. Quebra de linha determinística. */
import { clamp, esc, n, path, rect } from './svg';
import { EASINGS } from '../animation/interp';
import type { BubbleAnim, DialogueClip } from '../model/schema';

const CHAR_W = 0.54;

export function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    let line = '';
    const words = raw.split(/\s+/).flatMap((w) => {
      if (w.length <= maxChars) return [w];
      // Palavra maior que a linha: quebra com hífen em pedaços que cabem.
      const parts: string[] = [];
      for (let i = 0; i < w.length; i += maxChars - 1) parts.push(i + maxChars - 1 < w.length ? `${w.slice(i, i + maxChars - 1)}-` : w.slice(i));
      return parts;
    });
    for (const word of words) {
      if (!word) continue;
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export interface BubbleLayout {
  text: string[];
  style: string;
  x: number;
  y: number;
  w: number;
  h: number;
  tailX: number;
  tailY: number;
  fontSize: number;
}

export const BUBBLE_STYLES: Array<{ id: string; label: string }> = [
  { id: 'speech', label: 'Fala' },
  { id: 'thought', label: 'Pensamento' },
  { id: 'shout', label: 'Grito' },
  { id: 'whisper', label: 'Sussurro' },
  { id: 'caption', label: 'Caixa de narração' },
];

export function bubbleLayout(o: {
  text: string; style: string; scale: number; offsetX: number; offsetY: number; frameW: number; frameH: number;
  headX: number; headY: number; headR: number;
}): BubbleLayout {
  let fontSize = 38 * o.scale;
  let lines: string[] = [];
  for (let attempt = 0; attempt < 6; attempt++) {
    const maxChars = Math.max(8, Math.min(Math.floor(((o.frameW * 0.62) / fontSize) / CHAR_W), Math.round(26 * (38 * o.scale) / fontSize)));
    lines = wrapText(o.text, maxChars);
    if (lines.length * fontSize * 1.22 + fontSize * 1.1 <= o.frameH * 0.55) break;
    fontSize *= 0.85;
  }
  const longest = Math.max(...lines.map((l) => l.length), 1);
  const w = longest * fontSize * CHAR_W + fontSize * 1.6;
  const h = lines.length * fontSize * 1.22 + fontSize * 1.1;
  const margin = 22;
  const anchorY = o.headY - o.headR - 22;
  const x = clamp(o.headX + o.offsetX - w / 2, -o.frameW / 2 + margin, o.frameW / 2 - w - margin);
  const y = clamp(anchorY - h + o.offsetY, -o.frameH / 2 + margin, o.frameH / 2 - h - margin);
  return { text: lines, style: o.style, x, y, w, h, tailX: clamp(o.headX, -o.frameW / 2, o.frameW / 2), tailY: o.headY - o.headR * 0.72, fontSize };
}

/* ---------------------------- Entrada e saída do balão ---------------------------- */

export const BUBBLE_ANIM_DEFAULT_IN_MS = 240;
export const BUBBLE_ANIM_DEFAULT_OUT_MS = 200;
export const BUBBLE_IN_OPTIONS: Array<{ id: BubbleAnim; label: string }> = [
  { id: 'none', label: 'Nenhuma (estático)' }, { id: 'pop', label: 'Pop com leve overshoot' }, { id: 'fade', label: 'Aparecer suavemente' }, { id: 'popFade', label: 'Pop + aparecer' },
];
export const BUBBLE_OUT_OPTIONS: Array<{ id: BubbleAnim; label: string }> = [
  { id: 'none', label: 'Nenhuma (some no fim)' }, { id: 'pop', label: 'Encolher' }, { id: 'fade', label: 'Sumir suavemente' }, { id: 'popFade', label: 'Encolher + sumir' },
];

export interface BubbleAnimState {
  /** 1 = tamanho normal */
  scale: number;
  opacity: number;
}

const STATIC_BUBBLE: BubbleAnimState = { scale: 1, opacity: 1 };
const smooth01 = (x: number) => {
  const k = clamp(x, 0, 1);
  return k * k * (3 - 2 * k);
};

/**
 * Estado do balão num instante, só a partir do tempo local do clip e do que resta dele.
 * Sem campos de animação (clips antigos) devolve escala 1 e opacidade 1: balão estático.
 * Se entrada + saída não cabem no clip, as duas encolhem na mesma proporção.
 */
export function bubbleAnimation(
  clip: Pick<DialogueClip, 'bubbleIn' | 'bubbleOut' | 'bubbleInMs' | 'bubbleOutMs'>,
  localMs: number,
  remainingMs: number,
): BubbleAnimState {
  const kindIn = clip.bubbleIn ?? 'none';
  const kindOut = clip.bubbleOut ?? 'none';
  if (kindIn === 'none' && kindOut === 'none') return STATIC_BUBBLE;
  const fin = (v: number, fallback = 0) => (Number.isFinite(v) ? v : fallback);
  let inMs = kindIn === 'none' ? 0 : Math.max(0, fin(clip.bubbleInMs ?? BUBBLE_ANIM_DEFAULT_IN_MS));
  let outMs = kindOut === 'none' ? 0 : Math.max(0, fin(clip.bubbleOutMs ?? BUBBLE_ANIM_DEFAULT_OUT_MS));
  const local = Math.max(0, fin(localMs));
  const remaining = Math.max(0, fin(remainingMs));
  const total = local + remaining;
  if (inMs + outMs > total && inMs + outMs > 0) {
    const k = total / (inMs + outMs);
    inMs *= k;
    outMs *= k;
  }
  let scale = 1;
  let opacity = 1;
  if (inMs > 0 && local < inMs) {
    const p = clamp(local / inMs, 0, 1);
    if (kindIn === 'pop' || kindIn === 'popFade') scale *= 0.6 + 0.4 * EASINGS.backOut(p);
    opacity *= kindIn === 'pop' ? Math.min(1, p * 3) : EASINGS.easeOutCubic(p);
  }
  if (outMs > 0 && remaining < outMs) {
    const q = 1 - clamp(remaining / outMs, 0, 1); // 0 → 1 durante a saída
    if (kindOut === 'pop' || kindOut === 'popFade') scale *= 1 - 0.2 * EASINGS.easeInCubic(q);
    opacity *= kindOut === 'pop' ? 1 - smooth01((q - 0.4) / 0.6) : 1 - smooth01(q);
  }
  return { scale: clamp(scale, 0, 2), opacity: clamp(opacity, 0, 1) };
}

/** Ponto que não pode se mover durante o pop: a ponta da cauda (ou o centro da base na caixa de narração). */
export function bubbleAnchor(b: BubbleLayout): { x: number; y: number } {
  return b.style === 'caption' ? { x: b.x + b.w / 2, y: b.y + b.h } : { x: b.tailX, y: b.tailY };
}

export function renderBubble(b: BubbleLayout, anim?: BubbleAnimState): string {
  const svg = renderBubbleBody(b);
  if (!anim || (anim.scale === 1 && anim.opacity === 1)) return svg;
  const a = bubbleAnchor(b);
  const t = anim.scale === 1 ? '' : ` transform="translate(${n(a.x)} ${n(a.y)}) scale(${anim.scale.toFixed(4)}) translate(${n(-a.x)} ${n(-a.y)})"`;
  const o = anim.opacity === 1 ? '' : ` opacity="${anim.opacity.toFixed(3)}"`;
  return `<g data-part="bubble-anim"${t}${o}>${svg}</g>`;
}

function renderBubbleBody(b: BubbleLayout): string {
  const ink = '#23202b';
  const attrs = `fill="#fffdf6" stroke="${ink}" stroke-width="5" stroke-linejoin="round"`;
  const cx = b.x + b.w / 2;
  const bottom = b.y + b.h;
  const baseX = clamp(b.tailX, b.x + 36, b.x + b.w - 36);
  let shape = '';
  switch (b.style) {
    case 'thought': {
      shape = `<rect x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" rx="${n(b.h / 2)}" ${attrs}/>`;
      const dx = b.tailX - baseX;
      const dy = b.tailY - bottom;
      shape += `<circle cx="${n(baseX + dx * 0.3)}" cy="${n(bottom + dy * 0.3 + 8)}" r="13" ${attrs}/><circle cx="${n(baseX + dx * 0.65)}" cy="${n(bottom + dy * 0.65 + 6)}" r="8" ${attrs}/>`;
      break;
    }
    case 'shout': {
      const spikes = 16;
      let d = '';
      for (let i = 0; i < spikes * 2; i++) {
        const a = (i / (spikes * 2)) * Math.PI * 2;
        const k = i % 2 === 0 ? 1.26 : 1.03;
        d += `${i ? 'L' : 'M'}${n(cx + (Math.cos(a) * b.w * k) / 2)} ${n(b.y + b.h / 2 + (Math.sin(a) * b.h * k) / 2)}`;
      }
      shape = path(`${d}Z`, `fill="#fff2a8" stroke="${ink}" stroke-width="5" stroke-linejoin="round"`);
      break;
    }
    case 'caption':
      shape = rect(b.x, b.y, b.w, b.h, `rx="4" fill="#f2e6b8" stroke="${ink}" stroke-width="5"`);
      break;
    case 'whisper':
      shape = rect(b.x, b.y, b.w, b.h, `rx="${n(b.h / 2.4)}" fill="#fffdf6" stroke="${ink}" stroke-width="4" stroke-dasharray="11 9"`) +
        path(`M${n(baseX - 14)} ${n(bottom)}L${n(b.tailX)} ${n(b.tailY)}L${n(baseX + 14)} ${n(bottom)}`, `fill="#fffdf6" stroke="${ink}" stroke-width="4" stroke-dasharray="9 7"`);
      break;
    default:
      shape = rect(b.x, b.y, b.w, b.h, `rx="26" ${attrs}`) +
        path(`M${n(baseX - 18)} ${n(bottom - 2)}L${n(b.tailX)} ${n(b.tailY)}L${n(baseX + 18)} ${n(bottom - 2)}`, attrs) +
        path(`M${n(baseX - 15)} ${n(bottom - 3)}H${n(baseX + 15)}`, `stroke="#fffdf6" stroke-width="7"`);
  }
  const lines = b.text
    .map((l, i) => `<tspan x="${n(cx)}" y="${n(b.y + b.h / 2 + (i - (b.text.length - 1) / 2) * b.fontSize * 1.22 + b.fontSize * 0.34)}">${esc(l)}</tspan>`)
    .join('');
  return `<g data-part="bubble">${shape}<text text-anchor="middle" font-family="'Trebuchet MS','Segoe UI',Arial,sans-serif" font-weight="700" font-size="${n(b.fontSize)}" fill="${ink}" ${b.style === 'whisper' ? 'font-style="italic"' : ''}>${lines}</text></g>`;
}

export function renderSubtitle(text: string, pos: 'bottom' | 'top' | 'center', fontSize: number, color: string, bg: boolean, frameW: number): string {
  const maxChars = Math.floor((frameW * 0.86) / (fontSize * CHAR_W));
  const lines = wrapText(text, maxChars);
  const lh = fontSize * 1.26;
  const total = lines.length * lh;
  const startY = pos === 'bottom' ? 480 - total : pos === 'top' ? -480 : -total / 2;
  let out = '';
  lines.forEach((l, i) => {
    const y = startY + i * lh + fontSize;
    if (bg) {
      const w = l.length * fontSize * CHAR_W + fontSize;
      out += rect(-w / 2, startY + i * lh - fontSize * 0.08, w, lh, `rx="6" fill="#000" fill-opacity=".72"`);
    }
    out += `<text x="0" y="${n(y)}" text-anchor="middle" font-family="'Trebuchet MS','Segoe UI',Arial,sans-serif" font-weight="700" font-size="${n(fontSize)}" fill="${color}" ${bg ? '' : `stroke="#000" stroke-width="${n(fontSize * 0.13)}" paint-order="stroke" stroke-linejoin="round"`}>${esc(l)}</text>`;
  });
  return `<g data-part="subtitle">${out}</g>`;
}
