/**
 * Rosto: olhos, sobrancelhas, nariz, boca, orelhas, pelos faciais e detalhes.
 *
 * Regras críticas garantidas aqui e cobertas por testes:
 *  - exatamente UMA boca por rosto visível;
 *  - a órbita ocular tem tamanho fixo: a pupila se move DENTRO dela (clipPath);
 *  - na frente os dois olhos têm a mesma dimensão-base;
 *  - em 3/4 o olho distante é menor de modo consistente (FAR_EYE_SCALE);
 *  - o nariz aponta sempre para o lado da vista (data-tip-x).
 */
import { clamp, esc, n, path, shade, smoothPath, type Pt } from '../render/svg';
import type { CharacterDefinition } from '../model/schema';
import type { ViewInfo } from './views';
import { blendMouth, getExpression, NEUTRAL, VISEMES, type MouthParams } from './expressions';

export const FAR_EYE_SCALE = 0.74;

export interface FaceState {
  expression: string;
  intensity: number;
  /** visema manual ou automático; null usa a boca da expressão */
  viseme: string | null;
  /** quanto o visema substitui a boca da expressão (0–1) */
  visemeAmount: number;
  /** 0 = aberto, 1 = fechado */
  blink: number;
  /** direção do olhar normalizada (−1…1) */
  gazeX: number;
  gazeY: number;
}

interface EyeBase { rx: number; ry: number; pupil: number; pinch: number; slant: number }
export const EYE_STYLES: Record<string, EyeBase> = {
  round: { rx: 25, ry: 27, pupil: 0.42, pinch: 0, slant: 0 },
  oval: { rx: 20, ry: 30, pupil: 0.42, pinch: 0, slant: 0 },
  almond: { rx: 28, ry: 19, pupil: 0.58, pinch: 0.6, slant: 3 },
  big: { rx: 28, ry: 32, pupil: 0.45, pinch: 0, slant: 0 },
  small: { rx: 16, ry: 18, pupil: 0.5, pinch: 0, slant: 0 },
  sleepy: { rx: 25, ry: 21, pupil: 0.56, pinch: 0.2, slant: -3 },
  wide: { rx: 33, ry: 24, pupil: 0.5, pinch: 0.15, slant: 0 },
  cat: { rx: 26, ry: 22, pupil: 0.55, pinch: 0.45, slant: 7 },
};

export interface FaceLayout {
  /** centro dos olhos em x (relativo a rx), por olho visível */
  eyes: Array<{ side: 'near' | 'far' | 'L' | 'R'; x: number; scale: number }>;
  noseX: number;
  mouthX: number;
  mouthScale: number;
  centerX: number;
}

/** Template do rosto por vista. Unidades em frações de rx. */
export function faceLayout(view: ViewInfo, spacing: number): FaceLayout | null {
  if (!view.showsFace) return null;
  const s = view.facing;
  const E = 0.42 * spacing;
  if (view.cls === 'front') {
    return {
      eyes: [
        { side: 'R', x: -E, scale: 1 },
        { side: 'L', x: E, scale: 1 },
      ],
      noseX: 0, mouthX: 0, mouthScale: 1, centerX: 0,
    };
  }
  if (view.cls === 'quarter') {
    const c = s * 0.34;
    return {
      eyes: [
        { side: 'near', x: c - s * E * 0.72, scale: 1 },
        { side: 'far', x: c + s * E * 0.72, scale: FAR_EYE_SCALE },
      ],
      noseX: s * 0.4, mouthX: s * 0.4, mouthScale: 0.82, centerX: c,
    };
  }
  return {
    eyes: [{ side: 'near', x: s * 0.52, scale: 0.8 }],
    noseX: s * 0.9, mouthX: s * 0.68, mouthScale: 0.56, centerX: s * 0.5,
  };
}

function eyeOutline(rx: number, ry: number, pinch: number, slant: number): string {
  const pts: Pt[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const pinchK = 1 - pinch * Math.pow(Math.abs(c), 3) * 0.55;
    pts.push([rx * c, ry * sn * pinchK + slant * -c]);
  }
  return smoothPath(pts, true);
}

const heartPath = (x: number, y: number, r: number): string =>
  `M${n(x)} ${n(y + r)}C${n(x - r * 1.6)} ${n(y - r * 0.2)} ${n(x - r * 0.7)} ${n(y - r * 1.2)} ${n(x)} ${n(y - r * 0.35)}C${n(x + r * 0.7)} ${n(y - r * 1.2)} ${n(x + r * 1.6)} ${n(y - r * 0.2)} ${n(x)} ${n(y + r)}Z`;

/** Um olho. Órbita constante; a pálpebra é desenhada por cima, recortada. */
export function renderEye(opts: {
  id: string; which: string; x: number; y: number; scale: number; style: EyeBase; size: number;
  skin: string; ink: string; iris: string; open: number; lower: number; blink: number;
  gazeX: number; gazeY: number; pupilScale: number; lashes: boolean; hearts: boolean; flip: number; ow: number;
}): string {
  const { id, which, x, y, scale, style, size, skin, ink, iris, blink, flip, ow } = opts;
  const rx = style.rx * size * scale;
  const ry = style.ry * size * (0.9 + scale * 0.1);
  const d = eyeOutline(rx, ry, style.pinch, style.slant * flip);
  const clipId = `${id}-eye${which}`;
  const closed = blink >= 0.85;
  const attrs = `data-part="eye" data-eye="${which}" data-rx="${n(rx)}" data-ry="${n(ry)}" data-closed="${closed ? 1 : 0}"`;
  const lash = opts.lashes
    ? path(`M${n(rx * flip * 0.65)} ${n(-ry * 0.72)}l${n(flip * 7)} -7M${n(rx * flip * 0.95)} ${n(-ry * 0.3)}l${n(flip * 9)} -5`, `fill="none" stroke="${ink}" stroke-width="${n(ow * 0.7)}" stroke-linecap="round"`)
    : '';
  if (closed) {
    // Piscar: o olho vira uma única linha. Nada de segundo olho sobreposto.
    return `<g ${attrs} transform="translate(${n(x)} ${n(y)})">${path(
      `M${n(-rx)} ${n(ry * 0.08)}Q0 ${n(ry * 0.52)} ${n(rx)} ${n(ry * 0.08)}`,
      `fill="none" stroke="${ink}" stroke-width="${n(ow)}" stroke-linecap="round"`,
    )}${lash}</g>`;
  }
  const pr = Math.min(rx, ry) * style.pupil * opts.pupilScale + 2.2;
  const maxX = Math.max(0, rx - pr * 1.02);
  const maxY = Math.max(0, ry - pr * 1.02);
  const px = clamp(opts.gazeX, -1, 1) * maxX;
  const py = clamp(opts.gazeY, -1, 1) * maxY;
  const openV = clamp(opts.open * (1 - blink), 0, 1.15);
  const lidY = -ry + (1 - Math.min(openV, 1)) * ry * 2;
  const lowerY = ry - clamp(opts.lower, 0, 0.8) * ry;
  const pupil = opts.hearts
    ? path(heartPath(px, py, pr * 1.2), `data-pupil="1" fill="#e0395f"`)
    : `<circle data-pupil="1" cx="${n(px)}" cy="${n(py)}" r="${n(pr)}" fill="${iris}"/><circle cx="${n(px + pr * 0.3)}" cy="${n(py - pr * 0.36)}" r="${n(Math.max(1.4, pr * 0.27))}" fill="#fff"/>`;
  const lid = openV < 0.99
    ? `<rect x="${n(-rx - 3)}" y="${n(-ry - 6)}" width="${n(rx * 2 + 6)}" height="${n(lidY + ry + 6)}" fill="${skin}"/>${path(`M${n(-rx - 2)} ${n(lidY)}L${n(rx + 2)} ${n(lidY)}`, `stroke="${ink}" stroke-width="${n(ow * 0.8)}"`)}`
    : '';
  const lower = opts.lower > 0.01
    ? `<rect x="${n(-rx - 3)}" y="${n(lowerY)}" width="${n(rx * 2 + 6)}" height="${n(ry - lowerY + 6)}" fill="${skin}"/>${path(`M${n(-rx - 2)} ${n(lowerY)}L${n(rx + 2)} ${n(lowerY)}`, `stroke="${ink}" stroke-width="${n(ow * 0.55)}"`)}`
    : '';
  return (
    `<g ${attrs} data-pupil-x="${n(px)}" data-pupil-y="${n(py)}" data-pupil-r="${n(pr)}" transform="translate(${n(x)} ${n(y)})">` +
    `<clipPath id="${clipId}"><path d="${d}"/></clipPath>` +
    path(d, `fill="#fffdf7"`) +
    `<g clip-path="url(#${clipId})">${pupil}${lid}${lower}</g>` +
    path(d, `fill="none" stroke="${ink}" stroke-width="${n(ow * 0.7)}"`) +
    lash +
    `</g>`
  );
}

export const BROW_STYLES: Record<string, { w: number; thick: number; arch: number }> = {
  soft: { w: 25, thick: 6, arch: 1 },
  thick: { w: 28, thick: 11, arch: 0.8 },
  thin: { w: 26, thick: 3.6, arch: 1 },
  arched: { w: 27, thick: 5.5, arch: 2 },
  straight: { w: 27, thick: 6.5, arch: 0.1 },
  bushy: { w: 30, thick: 14, arch: 0.7 },
  short: { w: 15, thick: 7, arch: 0.6 },
  none: { w: 0, thick: 0, arch: 0 },
};

function renderBrow(x: number, y: number, scale: number, inner: number, style: { w: number; thick: number; arch: number },
  angle: number, curve: number, color: string, which: string): string {
  if (!style.w) return '';
  const w = style.w * scale;
  const a: Pt = [x + inner * w, y + angle * 0.55];
  const b: Pt = [x, y - 8 * curve * style.arch];
  const c: Pt = [x - inner * w, y - angle * 0.55];
  return path(smoothPath([a, b, c]), `data-part="brow" data-brow="${which}" fill="none" stroke="${color}" stroke-width="${n(style.thick)}" stroke-linecap="round"`);
}

/** Boca paramétrica: UMA forma por vez. */
export function renderMouth(opts: {
  x: number; y: number; scaleX: number; facing: number; params: MouthParams; size: number;
  ink: string; lip: string; style: string; shape: string; clipId: string; ow: number;
}): string {
  const { x, y, scaleX, facing, params: p, ink, ow } = opts;
  const styleW = ({ wide: 1.3, small: 0.72, thin: 1, full: 1.05, cute: 0.62, teeth: 1, lips: 1, simple: 1 } as Record<string, number>)[opts.style] ?? 1;
  const W = 30 * p.w * styleW * opts.size * scaleX;
  const H = 34 * p.open * opts.size;
  const c = 16 * p.curve * opts.size;
  const skew = p.skew * 9 * opts.size;
  const shift = facing * W * 0.12;
  const left: Pt = [-W + shift, -c * 0.6 + skew];
  const right: Pt = [W + shift, -c * 0.6 - skew];
  const lipStroke = opts.style === 'lips' || opts.style === 'full' ? opts.lip : ink;
  const lipWidth = opts.style === 'full' ? ow * 1.9 : opts.style === 'thin' ? ow * 0.6 : opts.style === 'lips' ? ow * 1.25 : ow * 0.9;
  let inner: string;
  if (H < 3) {
    inner = path(
      `M${n(left[0])} ${n(left[1])}Q${n(shift)} ${n(c * 0.8)} ${n(right[0])} ${n(right[1])}`,
      `fill="none" stroke="${lipStroke}" stroke-width="${n(lipWidth)}" stroke-linecap="round"`,
    );
    if (p.curve > 0.55) {
      inner += path(`M${n(left[0])} ${n(left[1] - 4)}l-3 5M${n(right[0])} ${n(right[1] - 4)}l3 5`, `fill="none" stroke="${ink}" stroke-width="${n(ow * 0.55)}" stroke-linecap="round"`);
    }
  } else if (p.round > 0.6) {
    const rx = Math.max(6, W);
    inner = `<ellipse cx="${n(shift)}" cy="${n(H * 0.25)}" rx="${n(rx)}" ry="${n(H * 0.72 + 3)}" fill="#4a1d2a" stroke="${lipStroke}" stroke-width="${n(lipWidth)}"/>`;
    if (p.tongue > 0.2) inner += `<ellipse cx="${n(shift)}" cy="${n(H * 0.72)}" rx="${n(rx * 0.6)}" ry="${n(H * 0.26)}" fill="#d26a78"/>`;
  } else {
    const top = -c * 0.1 - H * 0.12;
    const bottom = c * 0.55 + H;
    const d = `M${n(left[0])} ${n(left[1])}Q${n(shift)} ${n(top)} ${n(right[0])} ${n(right[1])}Q${n(shift)} ${n(bottom * 1.25)} ${n(left[0])} ${n(left[1])}Z`;
    inner =
      path(d, `fill="#4a1d2a"`) +
      `<clipPath id="${opts.clipId}"><path d="${d}"/></clipPath><g clip-path="url(#${opts.clipId})">` +
      (p.teeth > 0.3 ? `<rect x="${n(left[0] - 2)}" y="${n(top - 30)}" width="${n(W * 2 + 4)}" height="${n(30 + Math.max(5, H * 0.3))}" fill="#fbf6ea"/>` : '') +
      (p.tongue > 0.2 ? `<ellipse cx="${n(shift)}" cy="${n(bottom * 0.92)}" rx="${n(W * 0.62)}" ry="${n(H * 0.34 + 2)}" fill="#d26a78"/>` : '') +
      `</g>` +
      path(d, `fill="none" stroke="${lipStroke}" stroke-width="${n(lipWidth)}" stroke-linejoin="round"`);
  }
  return `<g data-part="mouth" data-shape="${esc(opts.shape)}" data-open="${n(p.open)}" transform="translate(${n(x)} ${n(y)})">${inner}</g>`;
}

interface NoseShape { len: number; w: number; drop: number; tipR: number; hook: number }
export const NOSE_STYLES: Record<string, NoseShape> = {
  button: { len: 15, w: 9, drop: 14, tipR: 7, hook: 0 },
  small: { len: 10, w: 6, drop: 9, tipR: 4, hook: 0 },
  round: { len: 22, w: 15, drop: 18, tipR: 13, hook: 0 },
  pointy: { len: 34, w: 8, drop: 22, tipR: 2, hook: 0 },
  long: { len: 44, w: 10, drop: 34, tipR: 6, hook: 0 },
  wide: { len: 19, w: 23, drop: 16, tipR: 9, hook: 0 },
  hook: { len: 34, w: 11, drop: 30, tipR: 5, hook: 12 },
  bulb: { len: 30, w: 17, drop: 26, tipR: 16, hook: 0 },
  flat: { len: 9, w: 19, drop: 11, tipR: 6, hook: 0 },
  upturned: { len: 22, w: 9, drop: 13, tipR: 5, hook: -8 },
};

/** Nariz: frente é simétrico; 3/4 e perfil saem em direção à vista. */
export function renderNose(opts: { x: number; y: number; view: ViewInfo; style: string; size: number; skin: string; ink: string; ow: number }): string {
  const { x, y, view, size, skin, ink, ow } = opts;
  const st = NOSE_STYLES[opts.style] ?? NOSE_STYLES.button!;
  const s = view.facing;
  const stroke = `stroke="${ink}" stroke-width="${n(ow * 0.75)}" stroke-linejoin="round" stroke-linecap="round"`;
  let inner: string;
  let tipX: number;
  if (s === 0) {
    const w = st.w * size;
    const dr = st.drop * size;
    tipX = 0;
    inner = path(
      `M${n(-w * 0.15)} ${n(-dr * 0.9)}Q${n(-w)} ${n(dr * 0.55)} ${n(-w * 0.55)} ${n(dr * 0.85)}Q0 ${n(dr * 1.25)} ${n(w * 0.55)} ${n(dr * 0.85)}Q${n(w)} ${n(dr * 0.55)} ${n(w * 0.15)} ${n(-dr * 0.9)}`,
      `fill="${shade(skin, -0.05)}" fill-opacity=".55" ${stroke}`,
    );
  } else {
    const k = view.cls === 'profile' ? 1 : 0.82;
    const len = st.len * size * k;
    const dr = st.drop * size;
    const tip: Pt = [s * len, dr * 0.45 + st.hook * size * 0.5];
    tipX = tip[0];
    const tr = st.tipR * size;
    const d = `M${n(-s * 4)} ${n(-dr)}Q${n(s * len * 0.55)} ${n(-dr * 0.3 - st.hook * size)} ${n(tip[0])} ${n(tip[1] - tr * 0.5)}Q${n(tip[0] + s * tr)} ${n(tip[1] + tr * 0.7)} ${n(tip[0] - s * tr)} ${n(dr * 0.95)}L${n(-s * 5)} ${n(dr * 0.9)}`;
    inner = path(d, `fill="${skin}" ${stroke}`);
  }
  return `<g data-part="nose" data-tip-x="${n(x + tipX)}" data-base-x="${n(x)}" data-facing="${s}" transform="translate(${n(x)} ${n(y)})">${inner}</g>`;
}

export function renderFacialHair(opts: { def: CharacterDefinition; rx: number; ry: number; mx: number; my: number; mw: number; view: ViewInfo; ink: string; ow: number }): { beard: string; mustache: string } {
  const { def, rx, ry, mx, my, mw, view, ink, ow } = opts;
  const c = def.face.facialHairColor;
  const s = view.facing;
  let beard = '';
  const attrs = `fill="${c}" stroke="${ink}" stroke-width="${n(ow * 0.7)}" stroke-linejoin="round"`;
  const style = def.face.beard;
  if (style !== 'none' && view.showsFace) {
    const cx = mx * 0.65;
    const halfW = rx * (view.cls === 'front' ? 0.92 : view.cls === 'quarter' ? 0.9 : 0.72);
    if (style === 'stubble') {
      let dots = '';
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI;
        const px = cx + Math.cos(a) * halfW * 0.75 * (1 - (i % 3) * 0.08);
        const py = my + 8 + Math.sin(a) * ry * 0.26 * (1 + (i % 2) * 0.25);
        dots += `<circle cx="${n(px)}" cy="${n(py)}" r="1.5"/>`;
      }
      beard = `<g data-part="beard" fill="${shade(c, 0.1)}" fill-opacity=".75">${dots}</g>`;
    } else if (style === 'goatee') {
      beard = path(smoothPath([[mx - 15, my + 12], [mx - 19, my + 40], [mx, my + 54], [mx + 19, my + 40], [mx + 15, my + 12], [mx, my + 18]], true), `data-part="beard" ${attrs}`);
    } else if (style === 'chin') {
      beard = path(smoothPath([[cx - halfW * 0.5, my + 18], [cx - halfW * 0.5, my + 44], [cx, my + 58], [cx + halfW * 0.5, my + 44], [cx + halfW * 0.5, my + 18], [cx, my + 26]], true), `data-part="beard" ${attrs}`);
    } else if (style === 'chinstrap') {
      const inner = halfW * 0.8;
      beard = path(`M${n(cx - halfW)} ${n(my - 40)}Q${n(cx - halfW)} ${n(my + 58)} ${n(cx)} ${n(my + 60)}Q${n(cx + halfW)} ${n(my + 58)} ${n(cx + halfW)} ${n(my - 40)}L${n(cx + inner)} ${n(my - 30)}Q${n(cx + inner)} ${n(my + 40)} ${n(cx)} ${n(my + 40)}Q${n(cx - inner)} ${n(my + 40)} ${n(cx - inner)} ${n(my - 30)}Z`, `data-part="beard" ${attrs}`);
    } else {
      const extra = style === 'long' ? 80 : 26;
      const tipX = s === 0 ? cx : cx + s * 8;
      beard = path(
        smoothPath([[cx - halfW, my - 34], [cx - halfW * 0.98, my + 20], [tipX - halfW * 0.4, my + 46 + extra * 0.7], [tipX, my + 52 + extra], [tipX + halfW * 0.4, my + 46 + extra * 0.7], [cx + halfW * 0.98, my + 20], [cx + halfW, my - 34], [cx + halfW * 0.72, my - 14], [mx + mw * 1.1, my - 4], [mx, my - 12], [mx - mw * 1.1, my - 4], [cx - halfW * 0.72, my - 14]], true),
        `data-part="beard" ${attrs}`,
      );
    }
  }
  let mustache = '';
  const mst = def.face.mustache;
  if (mst !== 'none' && view.showsFace) {
    const y = my - 16;
    const W = mw * (view.cls === 'profile' ? 0.8 : 1.15);
    const left = -W;
    const right = W;
    const x = mx + (s * W) / 8;
    const fill = `data-part="mustache" fill="${c}" stroke="${ink}" stroke-width="${n(ow * 0.6)}" stroke-linejoin="round"`;
    if (mst === 'thin' || mst === 'pencil') {
      const t = mst === 'pencil' ? 3.5 : 7;
      mustache = path(`M${n(x + left)} ${n(y + 7)}Q${n(x)} ${n(y - t)} ${n(x + right)} ${n(y + 7)}Q${n(x)} ${n(y + t * 0.3)} ${n(x + left)} ${n(y + 7)}Z`, fill);
    } else if (mst === 'thick') {
      mustache = path(smoothPath([[x + left - 3, y + 11], [x + left * 0.5, y - 8], [x, y - 3], [x + right * 0.5, y - 8], [x + right + 3, y + 11], [x, y + 9]], true), fill);
    } else if (mst === 'walrus') {
      mustache = path(smoothPath([[x + left - 8, y + 26], [x + left * 0.7, y - 8], [x, y - 5], [x + right * 0.7, y - 8], [x + right + 8, y + 26], [x + right * 0.5, y + 15], [x, y + 13], [x + left * 0.5, y + 15]], true), fill);
    } else {
      mustache = path(`M${n(x + left * 1.45)} ${n(y - 7)}Q${n(x + left * 1.1)} ${n(y + 16)} ${n(x + left * 0.5)} ${n(y + 6)}Q${n(x)} ${n(y - 8)} ${n(x + right * 0.5)} ${n(y + 6)}Q${n(x + right * 1.1)} ${n(y + 16)} ${n(x + right * 1.45)} ${n(y - 7)}Q${n(x + right * 1.05)} ${n(y + 3)} ${n(x)} ${n(y - 2)}Q${n(x + left * 1.05)} ${n(y + 3)} ${n(x + left * 1.45)} ${n(y - 7)}Z`, fill);
    }
  }
  return { beard, mustache };
}

/** Parâmetros efetivos do rosto (expressão com intensidade + visema). */
export function resolveFace(state: FaceState) {
  const ex = getExpression(state.expression);
  const t = clamp(state.intensity, 0, 1.5);
  const lerpN = (a: number, b: number) => a + (b - a) * t;
  const mouthExpr = blendMouth(NEUTRAL.mouth, ex.mouth, Math.min(t, 1));
  const vis = state.viseme ? VISEMES[state.viseme] : null;
  const mouth = vis ? blendMouth(mouthExpr, { ...vis.mouth, curve: vis.mouth.curve + mouthExpr.curve * 0.4 }, clamp(state.visemeAmount, 0, 1)) : mouthExpr;
  return {
    ex,
    browY: lerpN(NEUTRAL.browY, ex.browY),
    browAngle: lerpN(NEUTRAL.browAngle, ex.browAngle),
    browCurve: lerpN(NEUTRAL.browCurve, ex.browCurve),
    browAsym: lerpN(0, ex.browAsym),
    open: lerpN(NEUTRAL.open, ex.open),
    lower: lerpN(0, ex.lower),
    pupil: lerpN(1, ex.pupil),
    gazeX: lerpN(0, ex.gazeX),
    gazeY: lerpN(0, ex.gazeY),
    mouth,
    shapeName: vis && state.visemeAmount > 0.01 ? state.viseme! : ex.id,
  };
}

export function renderFace(opts: {
  id: string; def: CharacterDefinition; rx: number; ry: number; view: ViewInfo; state: FaceState;
}): string {
  const { id, def, rx, ry, view, state } = opts;
  const layout = faceLayout(view, def.face.eyeSpacing);
  if (!layout) return '';
  const ink = def.outlineColor;
  const ow = def.outlineWidth;
  const f = resolveFace(state);
  const eyeStyle = EYE_STYLES[def.face.eyes] ?? EYE_STYLES.round!;
  const eyeY = -ry * 0.04;
  const size = def.face.eyeSize;
  const browStyle = BROW_STYLES[def.face.brows] ?? BROW_STYLES.soft!;
  let out = '';

  const cheekY = eyeY + 42;
  if (def.face.cheeks || f.ex.blush) {
    const blushing = f.ex.blush && state.intensity > 0.3;
    const col = blushing ? '#e8606a' : shade(def.skin, -0.14);
    const op = blushing ? 0.42 : 0.5;
    for (const e of layout.eyes) {
      out += `<ellipse data-part="cheek" cx="${n(e.x * rx)}" cy="${n(cheekY)}" rx="${n(20 * e.scale)}" ry="11" fill="${col}" fill-opacity="${op}"/>`;
    }
  }
  if (def.face.freckles) {
    for (const e of layout.eyes) {
      for (const [dx, dy] of [[-10, 0], [0, 5], [10, -1], [5, -6], [-5, -5]] as Pt[]) {
        out += `<circle cx="${n(e.x * rx + dx * e.scale)}" cy="${n(cheekY + dy - 8)}" r="1.7" fill="${shade(def.skin, -0.38)}"/>`;
      }
    }
  }
  if (def.face.wrinkles) {
    const wr = `fill="none" stroke="${shade(def.skin, -0.32)}" stroke-width="2.2" stroke-linecap="round"`;
    const cx = layout.centerX * rx;
    out += path(`M${n(cx - 34)} ${n(-ry * 0.42)}Q${n(cx)} ${n(-ry * 0.47)} ${n(cx + 34)} ${n(-ry * 0.42)}M${n(cx - 24)} ${n(-ry * 0.34)}Q${n(cx)} ${n(-ry * 0.38)} ${n(cx + 24)} ${n(-ry * 0.34)}`, wr);
    for (const e of layout.eyes) {
      const side = e.x * rx < cx ? -1 : 1;
      const ex = e.x * rx + side * (eyeStyle.rx * size * e.scale + 6);
      out += path(`M${n(ex)} ${n(eyeY - 4)}l${n(side * 8)} -3M${n(ex)} ${n(eyeY + 4)}l${n(side * 8)} 3`, wr);
    }
    const mxW = layout.mouthX * rx;
    out += path(`M${n(mxW - 32 * layout.mouthScale)} ${n(ry * 0.42)}q-5 12 2 24M${n(mxW + 32 * layout.mouthScale)} ${n(ry * 0.42)}q5 12 -2 24`, wr);
  }

  // Pelos faciais ficam ABAIXO da boca para ela continuar legível.
  const mouthX = layout.mouthX * rx;
  const mouthY = ry * 0.56;
  const hair = renderFacialHair({ def, rx, ry, mx: mouthX, my: mouthY, mw: 30 * layout.mouthScale, view, ink, ow });
  out += hair.beard;

  const cx0 = layout.centerX * rx;
  const gazeX = clamp(state.gazeX + f.gazeX * (1 - Math.abs(state.gazeX)), -1, 1);
  const gazeY = clamp(state.gazeY + f.gazeY * (1 - Math.abs(state.gazeY)), -1, 1);
  layout.eyes.forEach((e, i) => {
    const x = e.x * rx;
    const inner = x < cx0 ? 1 : -1;
    const flip = view.cls === 'profile' ? view.facing : -inner;
    const browY = eyeY - eyeStyle.ry * size - 15 + f.browY + (i === 0 ? -f.browAsym * 0.5 : f.browAsym * 0.5);
    out += renderEye({
      id, which: e.side, x, y: eyeY, scale: e.scale, style: eyeStyle, size, skin: def.skin, ink, iris: def.face.eyeColor,
      open: f.open, lower: f.lower, blink: state.blink, gazeX, gazeY, pupilScale: f.pupil, lashes: def.face.lashes,
      hearts: !!f.ex.hearts && state.intensity > 0.4, flip, ow,
    });
    out += renderBrow(x, browY, size * e.scale, view.cls === 'profile' ? view.facing : inner, browStyle, f.browAngle, f.browCurve, def.face.browColor, e.side);
    if (f.ex.tears && state.intensity > 0.3) {
      out += path(`M${n(x)} ${n(eyeY + eyeStyle.ry * size)}q-11 20 0 33q11 -13 0 -33Z`, `data-part="tear" fill="#7cc4e8" stroke="${ink}" stroke-width="1.6"`);
    }
    if (f.ex.gloom && state.intensity > 0.3) {
      out += path(`M${n(x - 20 * e.scale)} ${n(eyeY + eyeStyle.ry * size + 7)}q${n(20 * e.scale)} 8 ${n(40 * e.scale)} 0`, `fill="none" stroke="${shade(def.skin, -0.3)}" stroke-width="3" stroke-linecap="round"`);
    }
  });

  out += renderNose({ x: layout.noseX * rx, y: ry * 0.22, view, style: def.face.nose, size: def.face.noseSize, skin: def.skin, ink, ow });

  // Exatamente UMA boca.
  out += renderMouth({
    x: mouthX, y: mouthY, scaleX: layout.mouthScale, facing: view.facing, params: f.mouth, size: 1, ink,
    lip: def.face.lipColor, style: def.face.mouth, shape: f.shapeName, clipId: `${id}-mouthclip`, ow,
  });
  out += hair.mustache;

  if (f.ex.sweat && state.intensity > 0.3) {
    const sx = (layout.centerX + (view.facing || 1) * -0.55) * rx;
    out += path(`M${n(sx)} ${n(-ry * 0.42)}q-9 17 0 27q9 -10 0 -27Z`, `fill="#9ad8f2" stroke="${ink}" stroke-width="1.8"`);
  }
  if (f.ex.zzz && state.intensity > 0.3) {
    out += `<text x="${n(rx * 0.9)}" y="${n(-ry * 0.9)}" font-family="Arial,sans-serif" font-weight="900" font-size="34" fill="#fff" stroke="${ink}" stroke-width="1.5">z</text>`;
  }
  return out;
}

/** Orelhas por vista. Retorna o que fica atrás e o que fica sobre a cabeça. */
export const EAR_STYLES: Record<string, { w: number; h: number; pointy: number }> = {
  round: { w: 19, h: 27, pointy: 0 },
  small: { w: 13, h: 20, pointy: 0 },
  big: { w: 28, h: 37, pointy: 0 },
  pointy: { w: 20, h: 32, pointy: 1 },
  none: { w: 0, h: 0, pointy: 0 },
};

export function renderEars(opts: { def: CharacterDefinition; rx: number; ry: number; view: ViewInfo }): { behind: string; over: string } {
  const { def, rx, ry, view } = opts;
  const st = EAR_STYLES[def.face.ears] ?? EAR_STYLES.round!;
  if (!st.w) return { behind: '', over: '' };
  const attrs = `fill="${def.skin}" stroke="${def.outlineColor}" stroke-width="${n(def.outlineWidth * 0.85)}" stroke-linejoin="round"`;
  const inner = `fill="none" stroke="${shade(def.skin, -0.3)}" stroke-width="2.4" stroke-linecap="round"`;
  const y = ry * 0.08;
  const one = (x: number, outward: number): string => {
    const w = st.w;
    const h = st.h;
    const top = st.pointy ? -h * 1.3 : -h;
    const d = `M${n(x)} ${n(y + top)}Q${n(x + outward * w * 1.3)} ${n(y + top * 0.9)} ${n(x + outward * w)} ${n(y)}Q${n(x + outward * w * 0.9)} ${n(y + h)} ${n(x)} ${n(y + h * 0.9)}Z`;
    return path(d, attrs) + path(`M${n(x + outward * w * 0.25)} ${n(y - h * 0.4)}Q${n(x + outward * w * 0.75)} ${n(y - h * 0.3)} ${n(x + outward * w * 0.45)} ${n(y + h * 0.3)}`, inner);
  };
  if (view.cls === 'front' || view.cls === 'back') {
    return { behind: `<g data-part="ears">${one(-rx * 0.96, -1)}${one(rx * 0.96, 1)}</g>`, over: '' };
  }
  const s = view.facing;
  if (view.cls === 'profile') return { behind: '', over: `<g data-part="ears">${one(-s * rx * 0.22, -s)}</g>` };
  if (view.cls === 'quarter') return { behind: '', over: `<g data-part="ears">${one(-s * rx * 0.74, -s)}</g>` };
  // Traseiro 3/4: a orelha visível fica no lado para onde o personagem se volta.
  return { behind: '', over: `<g data-part="ears">${one(s * rx * 0.68, s)}</g>` };
}
