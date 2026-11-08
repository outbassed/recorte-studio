/** Balões de diálogo e legendas originais. Quebra de linha determinística. */
import { clamp, esc, n, path, rect } from './svg';

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

export function renderBubble(b: BubbleLayout): string {
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
