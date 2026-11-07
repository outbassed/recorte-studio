/**
 * Renderizador de personagem: gera SVG do rig em peças para uma pose.
 *
 * Hierarquia (cada grupo tem pivô próprio, então mover o braço nunca desloca olhos):
 *  raiz (pés em 0,0)
 *   ├ pernas (coxa → canela → pé)
 *   └ tronco (quadril) → ombros → braços (braço → antebraço → mão)
 *                      → pescoço → cabeça → rosto + cabelo + acessórios
 *
 * A ordem de desenho é decidida pela vista (membro distante atrás do tronco).
 * Não há espelhamento: detalhes assimétricos continuam do mesmo lado do personagem.
 */
import type { CharacterDefinition, Rig, ViewId } from '../model/schema';
import { clamp, ellipse, n, path, rad, rect, shade, smoothPath, type Pt } from '../render/svg';
import { renderEars, renderFace, type FaceState } from './face';
import { renderHair } from './hair';
import { azZ, viewInfo, type ViewInfo } from './views';

export interface CharacterPose {
  bodyView: ViewId;
  headView: ViewId;
  rig: Rig;
  face: FaceState;
  handL: 'open' | 'fist' | 'point';
  handR: 'open' | 'fist' | 'point';
}

export const AGE_SCALE: Record<string, { body: number; head: number; shoulders: number }> = {
  child: { body: 0.68, head: 0.9, shoulders: 0.72 },
  teen: { body: 0.86, head: 0.95, shoulders: 0.88 },
  adult: { body: 1, head: 1, shoulders: 1 },
  elder: { body: 0.95, head: 1, shoulders: 0.94 },
};

export interface BodyMetrics {
  rx: number; ry: number; thigh: number; shin: number; footH: number; torso: number; neck: number;
  upperArm: number; forearm: number; shoulderW: number; hipW: number; limbW: number; legW: number; totalHeight: number;
  headCenterY: number;
}

export function bodyMetrics(def: CharacterDefinition): BodyMetrics {
  const b = def.body;
  const age = AGE_SCALE[b.age] ?? AGE_SCALE.adult!;
  const hs = age.body * b.height;
  const thigh = 84 * b.legLength * hs;
  const shin = 76 * b.legLength * hs;
  const torso = 166 * b.torsoLength * hs;
  const neck = 12 * hs;
  const rx = 108 * b.headWidth * age.head;
  const ry = 118 * b.headHeight * age.head;
  const upperArm = 76 * b.armLength * hs;
  const forearm = 70 * b.armLength * hs;
  const shoulderW = 148 * b.shoulders * b.build * age.shoulders;
  const hipW = 104 * b.build * age.shoulders;
  const limbW = 25 * clamp(b.build, 0.7, 1.5) * (0.8 + age.shoulders * 0.2);
  const legW = 31 * clamp(b.build, 0.7, 1.5) * (0.8 + age.shoulders * 0.2);
  const footH = 18;
  const headCenterY = -(thigh + shin + footH + torso + neck + ry * 0.8);
  return {
    rx, ry, thigh, shin, footH, torso, neck, upperArm, forearm, shoulderW, hipW, limbW, legW,
    totalHeight: thigh + shin + footH + torso + neck + ry * 1.8 + 20,
    headCenterY,
  };
}

/** Superfície da cabeça: contorno por vista. */
export function headOutline(shape: string, rx: number, ry: number, view: ViewInfo): string {
  const presets: Record<string, { jaw: number; chin: number; top: number; square: number }> = {
    oval: { jaw: 0.86, chin: 1.0, top: 1, square: 0 },
    round: { jaw: 1, chin: 0.94, top: 1, square: 0 },
    square: { jaw: 1, chin: 0.92, top: 0.97, square: 0.5 },
    heart: { jaw: 0.68, chin: 1.08, top: 1.04, square: 0 },
    long: { jaw: 0.8, chin: 1.14, top: 0.93, square: 0.1 },
    diamond: { jaw: 0.74, chin: 1.08, top: 0.84, square: 0 },
    pear: { jaw: 1.14, chin: 0.98, top: 0.82, square: 0.15 },
    wide: { jaw: 1.02, chin: 0.88, top: 1.08, square: 0.2 },
  };
  const p = presets[shape] ?? presets.oval!;
  const s = view.facing;
  const pts: Pt[] = [];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const lowerK = sn > 0 ? 1 : 0;
    const widthK = lowerK ? 1 + (p.jaw - 1) * Math.pow(sn, 1.3) : 1 + (p.top - 1) * Math.pow(-sn, 1.2);
    const heightK = lowerK ? p.chin : 1;
    const sq = 1 + p.square * Math.pow(Math.abs(Math.sin(a * 2)), 2) * 0.1;
    let x = c * rx * widthK * sq;
    const y = sn * ry * heightK * sq;
    // Em 3/4 e perfil o queixo avança e a nuca recua: silhueta distinta, sem 3D.
    if (s !== 0) {
      const amount = view.cls === 'profile' ? 1 : view.cls === 'quarter' ? 0.5 : -0.25;
      if (lowerK) x += s * amount * rx * 0.14 * sn;
      else x -= s * amount * rx * 0.06 * -sn;
      if (view.cls === 'profile') {
        const back = c * s < 0;
        if (back && lowerK) x *= 0.82 + 0.18 * (1 - sn);
      }
    }
    pts.push([x, y]);
  }
  return smoothPath(pts, true);
}

function limb(d: string, color: string, ink: string, width: number, ow: number): string {
  return (
    path(d, `fill="none" stroke="${ink}" stroke-width="${n(width + ow * 2)}" stroke-linecap="round"`) +
    path(d, `fill="none" stroke="${color}" stroke-width="${n(width)}" stroke-linecap="round"`)
  );
}

function hand(x: number, y: number, kind: string, side: number, skin: string, ink: string, ow: number, size: number): string {
  const r = size;
  const a = `fill="${skin}" stroke="${ink}" stroke-width="${n(ow * 0.85)}" stroke-linejoin="round"`;
  if (kind === 'fist') {
    return `<g data-part="hand" data-kind="fist"><circle cx="${n(x)}" cy="${n(y + r * 0.6)}" r="${n(r)}" ${a}/>${path(`M${n(x - r * 0.3)} ${n(y + r * 1.1)}v${n(-r * 0.45)}M${n(x + r * 0.2)} ${n(y + r * 1.2)}v${n(-r * 0.45)}`, `stroke="${ink}" stroke-width="2" fill="none"`)}</g>`;
  }
  if (kind === 'point') {
    return `<g data-part="hand" data-kind="point">${path(`M${n(x - side * r * 0.1)} ${n(y)}L${n(x + side * r * 0.25)} ${n(y + r * 2.4)}`, `fill="none" stroke="${ink}" stroke-width="${n(r * 0.62 + ow * 2 * 0.85)}" stroke-linecap="round"`)}${path(`M${n(x - side * r * 0.1)} ${n(y)}L${n(x + side * r * 0.25)} ${n(y + r * 2.4)}`, `fill="none" stroke="${skin}" stroke-width="${n(r * 0.62)}" stroke-linecap="round"`)}<circle cx="${n(x)}" cy="${n(y + r * 0.55)}" r="${n(r * 0.92)}" ${a}/></g>`;
  }
  // Mão aberta: palma + polegar + dedos sugeridos.
  return `<g data-part="hand" data-kind="open">${path(`M${n(x + side * r * 0.7)} ${n(y + r * 0.2)}q${n(side * r * 0.9)} ${n(r * 0.2)} ${n(side * r * 0.8)} ${n(r * 1.05)}`, `fill="none" stroke="${ink}" stroke-width="${n(r * 0.5 + ow * 1.7)}" stroke-linecap="round"`)}${path(`M${n(x + side * r * 0.7)} ${n(y + r * 0.2)}q${n(side * r * 0.9)} ${n(r * 0.2)} ${n(side * r * 0.8)} ${n(r * 1.05)}`, `fill="none" stroke="${skin}" stroke-width="${n(r * 0.5)}" stroke-linecap="round"`)}${ellipse(x, y + r * 0.95, r * 0.95, r * 1.2, a)}${path(`M${n(x - r * 0.3)} ${n(y + r * 1.9)}v${n(-r * 0.7)}M${n(x + r * 0.15)} ${n(y + r * 2)}v${n(-r * 0.7)}`, `stroke="${shade(skin, -0.35)}" stroke-width="2" fill="none" stroke-linecap="round"`)}</g>`;
}

function foot(shoes: string, color: string, view: ViewInfo, x: number, y: number, size: number, ink: string, ow: number, skin: string): string {
  const s = view.facing;
  const dir = view.cls === 'profile' || view.cls === 'quarter' ? s : view.cls === 'backQuarter' ? s * 0.45 : 0;
  const len = 40 * size;
  const a = `fill="${color}" stroke="${ink}" stroke-width="${n(ow * 0.9)}" stroke-linejoin="round"`;
  const sole = shoes === 'sneakers' ? '#f2efe6' : shade(color, -0.45);
  const toeX = dir * len * 1.05;
  const heelX = -dir * len * 0.42;
  const halfW = dir === 0 ? len * 0.62 : Math.abs(toeX - heelX) / 2;
  const cx = (toeX + heelX) / 2;
  if (shoes === 'sandals') {
    return `<g data-part="foot">${ellipse(x + cx, y + 14, halfW, 8, `fill="${skin}" stroke="${ink}" stroke-width="${n(ow * 0.8)}"`)}${rect(x + cx - halfW * 1.05, y + 18, halfW * 2.1, 6, `rx="3" fill="${color}" stroke="${ink}" stroke-width="${n(ow * 0.6)}"`)}${path(`M${n(x + cx - halfW * 0.4)} ${n(y + 16)}l${n(halfW * 0.4)} -9l${n(halfW * 0.4)} 9`, `fill="none" stroke="${color}" stroke-width="4"`)}</g>`;
  }
  const ankleTop = shoes === 'boots' ? -34 : -8;
  const ankle = 15 * size;
  let d: string;
  if (dir === 0) {
    d = `M${n(x - halfW)} ${n(y + 20)}L${n(x + halfW)} ${n(y + 20)}Q${n(x + halfW + 2)} ${n(y + 6)} ${n(x + ankle)} ${n(y + ankleTop)}L${n(x - ankle)} ${n(y + ankleTop)}Q${n(x - halfW - 2)} ${n(y + 6)} ${n(x - halfW)} ${n(y + 20)}Z`;
  } else {
    const sgn = dir > 0 ? 1 : -1;
    d = `M${n(x - sgn * ankle)} ${n(y + ankleTop)}L${n(x + heelX)} ${n(y + 4)}L${n(x + heelX)} ${n(y + 20)}L${n(x + toeX)} ${n(y + 20)}Q${n(x + toeX + sgn * 5)} ${n(y + 6)} ${n(x + toeX * 0.5)} ${n(y + 1)}L${n(x + sgn * ankle)} ${n(y + ankleTop)}Z`;
  }
  const sneak = shoes === 'sneakers' ? path(`M${n(x + cx - halfW * 0.25)} ${n(y + 3)}l${n(halfW * 0.5)} 0M${n(x + cx - halfW * 0.25)} ${n(y + 9)}l${n(halfW * 0.5)} 0`, `stroke="${shade(color, 0.55)}" stroke-width="3" fill="none"`) : '';
  const heel = shoes === 'heels' ? path(`M${n(x + heelX)} ${n(y + 20)}l${n(-dir * 4)} 12`, `stroke="${ink}" stroke-width="5" stroke-linecap="round"`) : '';
  return `<g data-part="foot">${heel}${path(d, a)}${rect(x + cx - halfW, y + 17, halfW * 2, 6, `rx="3" fill="${sole}" stroke="${ink}" stroke-width="${n(ow * 0.7)}"`)}${sneak}</g>`;
}

interface OutfitInfo {
  sleeveLong: boolean;
  sleeveShort: boolean;
  sleeveless: boolean;
  skirtFromTop: boolean;
  topFill: string;
  sleeveColor: string;
  defs: string;
}

function outfitInfo(def: CharacterDefinition, id: string): OutfitInfo {
  const o = def.outfit;
  const ink = def.outlineColor;
  let defs = '';
  let topFill = o.topColor;
  if (o.topPattern !== 'none') {
    const pid = `${id}-pat`;
    const c = o.topPatternColor;
    let art = '';
    let size = 26;
    if (o.topPattern === 'stripes') art = `<rect width="26" height="10" fill="${c}"/>`;
    if (o.topPattern === 'dots') art = `<circle cx="7" cy="7" r="4" fill="${c}"/><circle cx="20" cy="20" r="4" fill="${c}"/>`;
    if (o.topPattern === 'plaid') art = `<path d="M0 8H26M0 20H26M8 0V26M20 0V26" stroke="${c}" stroke-width="3.4" stroke-opacity=".8"/>`;
    if (o.topPattern === 'floral') {
      size = 44;
      const fl = (x: number, y: number, col: string) =>
        [0, 72, 144, 216, 288].map((a) => `<ellipse cx="${n(x + Math.cos(rad(a)) * 5.4)}" cy="${n(y + Math.sin(rad(a)) * 5.4)}" rx="4" ry="4" fill="${col}"/>`).join('') + `<circle cx="${x}" cy="${y}" r="3" fill="${shade(ink, 0.7)}"/>`;
      art = fl(11, 12, c) + fl(33, 34, shade(c, -0.2));
    }
    defs += `<pattern id="${pid}" width="${size}" height="${size}" patternUnits="userSpaceOnUse"><rect width="${size}" height="${size}" fill="${o.topColor}"/>${art}</pattern>`;
    topFill = `url(#${pid})`;
  }
  const short = ['tshirt', 'polo', 'scrubs', 'police', 'apron'].includes(o.top);
  const none = o.top === 'tank' || o.top === 'dress';
  const sleeveColor = o.topPattern !== 'none' && (o.top === 'tshirt' || o.top === 'shirt' || o.top === 'longsleeve' || o.top === 'polo') ? topFill : o.topColor;
  return {
    sleeveShort: short,
    sleeveless: none,
    sleeveLong: !short && !none,
    skirtFromTop: o.top === 'dress',
    topFill,
    sleeveColor,
    defs,
  };
}

/** Lado da tela para onde um membro "abre" nesta vista. */
function limbSide(view: ViewInfo, limbName: 'L' | 'R'): number {
  const az = limbName === 'L' ? 90 : -90;
  const x = Math.sin(rad(view.yaw + az));
  if (Math.abs(x) > 0.1) return Math.sign(x);
  return view.facing || 1;
}

function limbNear(view: ViewInfo, limbName: 'L' | 'R'): number {
  return azZ(view.yaw, limbName === 'L' ? 90 : -90);
}

export interface CharacterRenderResult {
  svg: string;
  /** Posição das mãos em coordenadas locais do personagem, para objetos segurados. */
  handL: Pt;
  handR: Pt;
  head: Pt;
  metrics: BodyMetrics;
}

export function renderCharacter(def: CharacterDefinition, pose: CharacterPose, id: string): CharacterRenderResult {
  const m = bodyMetrics(def);
  const ink = def.outlineColor;
  const ow = def.outlineWidth;
  const skin = def.skin;
  const rig = pose.rig;
  const bodyV = viewInfo(pose.bodyView);
  const headV = viewInfo(pose.headView);
  const o = def.outfit;
  const info = outfitInfo(def, id);
  const accIds = def.accessories.map((a) => a.id);
  const acc = (key: string) => def.accessories.find((a) => a.id === key);

  // ---- pernas e quadril, com "sentar" mantendo os pés no chão ----
  const swingSide = Math.abs(Math.sin(rad(bodyV.yaw))) > 0.3 ? (bodyV.facing || 1) : 0;
  const sideFactor = Math.abs(Math.sin(rad(bodyV.yaw)));
  const sit = clamp(rig.sit, 0, 1);
  const thighForeshort = 1 - sit * 0.72 * (1 - sideFactor);
  const sitAngle = 82 * sit * sideFactor;
  const hipHeight = m.thigh * thighForeshort * Math.cos(rad(sitAngle)) + m.shin + m.footH;
  const hipY = -hipHeight + rig.bodyY * -1 * 0;
  const hipOff = (m.hipW / 2 - m.legW * 0.4) * Math.abs(Math.cos(rad(bodyV.yaw))) * 1;
  const legGeom = (name: 'L' | 'R') => {
    const near = limbNear(bodyV, name);
    const x = name === 'L' ? Math.cos(rad(bodyV.yaw)) * hipOff : -Math.cos(rad(bodyV.yaw)) * hipOff;
    const upper = name === 'L' ? rig.legLUpper : rig.legRUpper;
    const lower = name === 'L' ? rig.legLLower : rig.legRLower;
    const dir = swingSide !== 0 ? swingSide : limbSide(bodyV, name);
    const k = swingSide !== 0 ? 1 : 0.4;
    return { near, x, upperDeg: -dir * (upper * k + sitAngle), lowerDeg: dir * (lower * k + sitAngle) };
  };
  const bottomIsLong = !['shorts', 'skirt'].includes(o.bottom) && !info.skirtFromTop;
  const legColor = info.skirtFromTop ? skin : o.bottom === 'skirt' || o.bottom === 'shorts' ? skin : o.bottom === 'longskirt' ? o.bottomColor : o.bottomColor;
  const renderLeg = (name: 'L' | 'R'): string => {
    const g = legGeom(name);
    const thigh = m.thigh * thighForeshort;
    let upperCloth = '';
    if (o.bottom === 'shorts' && !info.skirtFromTop) {
      upperCloth = limb(`M0 2L0 ${n(thigh * 0.82)}`, o.bottomColor, ink, m.legW * 1.12, ow);
    }
    const jeans = o.bottom === 'jeans' && !info.skirtFromTop
      ? path(`M${n(m.legW * 0.28)} 4L${n(m.legW * 0.28)} ${n(thigh)}`, `stroke="${shade(o.bottomColor, 0.32)}" stroke-width="2" stroke-dasharray="5 4" fill="none"`)
      : '';
    const sock = !bottomIsLong ? '' : '';
    return (
      `<g data-part="leg-${name}" transform="translate(${n(g.x)} ${n(hipY)})">` +
      `<g transform="rotate(${n(g.upperDeg)})">` +
      limb(`M0 0L0 ${n(thigh)}`, legColor, ink, m.legW, ow) +
      upperCloth + jeans + sock +
      `<g transform="translate(0 ${n(thigh)}) rotate(${n(g.lowerDeg)})">` +
      limb(`M0 0L0 ${n(m.shin)}`, legColor, ink, m.legW * 0.92, ow) +
      `<g transform="rotate(${n(-g.upperDeg - g.lowerDeg)} 0 ${n(m.shin)})">${foot(o.shoes, o.shoeColor, bodyV, 0, m.shin - 2, def.body.height * (AGE_SCALE[def.body.age]?.shoulders ?? 1), ink, ow, skin)}</g>` +
      `</g></g></g>`
    );
  };

  // ---- braços ----
  const shoulderY = -m.torso + 18;
  const handSize = 13.5 * (0.75 + (AGE_SCALE[def.body.age]?.shoulders ?? 1) * 0.25);
  const armGeom = (name: 'L' | 'R') => {
    const near = limbNear(bodyV, name);
    const cosY = Math.cos(rad(bodyV.yaw));
    const halfS = (m.shoulderW / 2) * bodyV.bodyWidth;
    const profileOff = bodyV.cls === 'profile' ? -(bodyV.facing) * 4 * (near > 0 ? 1 : -1) : 0;
    const x = (name === 'L' ? cosY : -cosY) * halfS * 0.98 + profileOff;
    const side = limbSide(bodyV, name);
    const upper = name === 'L' ? rig.armLUpper : rig.armRUpper;
    const lower = name === 'L' ? rig.armLLower : rig.armRLower;
    const rest = bodyV.cls === 'profile' ? 2 : 7;
    return { near, x, side, upperDeg: -side * (upper + rest), lowerDeg: -side * lower };
  };
  const renderArm = (name: 'L' | 'R'): string => {
    const g = armGeom(name);
    const handKind = name === 'L' ? pose.handL : pose.handR;
    const sleeve = info.sleeveColor;
    let upperArm: string;
    let lowerArm: string;
    if (info.sleeveLong) {
      upperArm = limb(`M0 0L0 ${n(m.upperArm)}`, sleeve, ink, m.limbW * 1.08, ow);
      lowerArm = limb(`M0 0L0 ${n(m.forearm)}`, sleeve, ink, m.limbW, ow) + rect(-m.limbW * 0.62, m.forearm - 6, m.limbW * 1.24, 10, `rx="3" fill="${shade(o.topColor, -0.2)}" stroke="${ink}" stroke-width="${n(ow * 0.6)}"`);
    } else {
      upperArm = limb(`M0 0L0 ${n(m.upperArm)}`, skin, ink, m.limbW * 0.92, ow);
      if (info.sleeveShort) {
        upperArm += limb(`M0 0L0 ${n(m.upperArm * 0.52)}`, sleeve, ink, m.limbW * 1.18, ow);
      }
      lowerArm = limb(`M0 0L0 ${n(m.forearm)}`, skin, ink, m.limbW * 0.86, ow);
    }
    const watch = acc('watch') && name === 'L'
      ? rect(-m.limbW * 0.6, m.forearm * 0.72, m.limbW * 1.2, 10, `rx="2" fill="${acc('watch')!.color}" stroke="${ink}" stroke-width="2"`)
      : '';
    return (
      `<g data-part="arm-${name}" transform="translate(${n(g.x)} ${n(shoulderY)}) rotate(${n(g.upperDeg)})">` +
      upperArm +
      `<g transform="translate(0 ${n(m.upperArm)}) rotate(${n(g.lowerDeg)})">` +
      lowerArm + watch +
      hand(0, m.forearm + 2, handKind, g.side * -1 * (bodyV.cls === 'profile' ? 1 : 1), skin, ink, ow, handSize) +
      `</g></g>`
    );
  };

  // ---- tronco ----
  const s = bodyV.facing;
  const halfS = (m.shoulderW / 2) * bodyV.bodyWidth;
  const halfH = (m.hipW / 2 + 8) * bodyV.bodyWidth;
  const belly = def.body.belly;
  const bellyX = s !== 0 ? s * 26 * belly : 0;
  const waist = lerpN(halfS, halfH, 0.6) + 8 * belly * bodyV.bodyWidth * (s === 0 ? 1.3 : 1);
  const top = -m.torso;
  const torsoPts: Pt[] = [
    [-halfS * 0.55, top + 2],
    [-halfS, top + 20],
    [-waist + Math.min(0, bellyX), top + m.torso * 0.58],
    [-halfH, 8],
    [halfH, 8],
    [waist + Math.max(0, bellyX), top + m.torso * 0.58],
    [halfS, top + 20],
    [halfS * 0.55, top + 2],
  ];
  const torsoD = smoothPath(torsoPts, true, 0.42);
  let torso = '';
  const topStroke = `stroke="${ink}" stroke-width="${n(ow)}" stroke-linejoin="round"`;
  if (accIds.includes('backpack') && bodyV.showsFace) {
    const shift = s !== 0 ? -s * halfS * 0.9 : 0;
    if (s !== 0) torso += rect(shift - 34, top + 22, 68, m.torso * 0.7, `rx="16" fill="${acc('backpack')!.color}" ${topStroke}`);
  }
  torso += path(torsoD, `data-part="torso" fill="${info.topFill}" ${topStroke}`);

  const detailX = s * halfS * (bodyV.cls === 'profile' ? 0.55 : 0.32);
  const showFront = bodyV.showsFace;
  const detailStroke = `stroke="${ink}" stroke-width="${n(ow * 0.7)}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  const collarY = top + 4;
  // Sombra suave do queixo sobre o tronco (recorte de papel).
  torso += ellipse(headV.facing * 6, top + 10, halfS * 0.42, 9, `fill="#000" fill-opacity=".14"`);
  // Barra da roupa (ou calça)
  if (!info.skirtFromTop && o.top !== 'coat') {
    torso += path(`M${n(-halfH * 1.03)} ${n(-6)}Q0 ${n(4)} ${n(halfH * 1.03)} ${n(-6)}`, detailStroke);
  }
  if (showFront) {
    const dx = detailX;
    const neckW = 26;
    switch (o.top) {
      case 'tshirt':
      case 'longsleeve':
      case 'sweater':
        torso += path(`M${n(dx - neckW)} ${n(collarY)}Q${n(dx)} ${n(collarY + 20)} ${n(dx + neckW)} ${n(collarY)}`, detailStroke);
        if (o.top === 'sweater') torso += path(`M${n(-halfH)} -22L${n(halfH)} -22`, `stroke="${shade(o.topColor, -0.25)}" stroke-width="6"`);
        break;
      case 'tank':
        torso += path(`M${n(dx - neckW)} ${n(collarY)}Q${n(dx)} ${n(collarY + 40)} ${n(dx + neckW)} ${n(collarY)}Z`, `fill="${skin}" ${topStroke}`);
        break;
      case 'shirt':
      case 'polo': {
        torso += path(`M${n(dx - neckW - 8)} ${n(collarY - 2)}L${n(dx)} ${n(collarY + 26)}L${n(dx + neckW + 8)} ${n(collarY - 2)}L${n(dx + neckW - 10)} ${n(collarY + 12)}L${n(dx)} ${n(collarY + 26)}L${n(dx - neckW + 10)} ${n(collarY + 12)}Z`, `fill="${shade(o.topColor, 0.22)}" ${topStroke}`);
        const btnCount = o.top === 'shirt' ? 5 : 2;
        for (let i = 0; i < btnCount; i++) torso += `<circle cx="${n(dx)}" cy="${n(collarY + 36 + i * 26)}" r="3" fill="${ink}"/>`;
        if (o.top === 'shirt') torso += path(`M${n(dx - 8)} ${n(collarY + 28)}V-8`, `stroke="${ink}" stroke-opacity=".35" stroke-width="2"`);
        break;
      }
      case 'hoodie': {
        torso += path(`M${n(dx - 36)} ${n(collarY + 2)}Q${n(dx)} ${n(collarY + 40)} ${n(dx + 36)} ${n(collarY + 2)}Q${n(dx)} ${n(collarY + 14)} ${n(dx - 36)} ${n(collarY + 2)}Z`, `fill="${shade(o.topColor, -0.18)}" ${topStroke}`);
        torso += path(`M${n(dx - 12)} ${n(collarY + 26)}v26M${n(dx + 12)} ${n(collarY + 26)}v26`, detailStroke);
        const pw = halfH * (bodyV.cls === 'profile' ? 0.4 : 0.62);
        torso += path(`M${n(dx - pw)} -14L${n(dx - pw + 14)} -48L${n(dx + pw - 14)} -48L${n(dx + pw)} -14Z`, `fill="${shade(o.topColor, -0.1)}" ${topStroke}`);
        break;
      }
      case 'jacket':
      case 'blazer':
      case 'coat': {
        const inner = o.top === 'blazer' ? '#f4f1ea' : shade(o.topColor, 0.55);
        const v = o.top === 'blazer' ? 78 : m.torso - 14;
        torso += path(`M${n(dx - 26)} ${n(collarY)}L${n(dx)} ${n(collarY + v)}L${n(dx + 26)} ${n(collarY)}Z`, `fill="${inner}" ${topStroke}`);
        torso += path(`M${n(dx - 26)} ${n(collarY)}L${n(dx - 38)} ${n(collarY + 26)}L${n(dx - 16)} ${n(collarY + 34)}L${n(dx)} ${n(collarY + v)}M${n(dx + 26)} ${n(collarY)}L${n(dx + 38)} ${n(collarY + 26)}L${n(dx + 16)} ${n(collarY + 34)}L${n(dx)} ${n(collarY + v)}`, `fill="${shade(o.topColor, -0.12)}" ${topStroke}`);
        if (o.top === 'blazer') for (let i = 0; i < 2; i++) torso += `<circle cx="${n(dx + 5)}" cy="${n(collarY + v + 16 + i * 22)}" r="3.5" fill="${ink}"/>`;
        else torso += path(`M${n(dx)} ${n(collarY + v)}V4`, detailStroke);
        break;
      }
      case 'scrubs':
        torso += path(`M${n(dx - 26)} ${n(collarY)}L${n(dx)} ${n(collarY + 40)}L${n(dx + 26)} ${n(collarY)}Z`, `fill="${skin}" ${topStroke}`);
        torso += rect(dx + halfH * 0.18, top + m.torso * 0.42, 30, 26, `rx="3" fill="${shade(o.topColor, 0.18)}" ${topStroke}`);
        break;
      case 'police':
        torso += path(`M${n(dx - neckW - 8)} ${n(collarY - 2)}L${n(dx)} ${n(collarY + 24)}L${n(dx + neckW + 8)} ${n(collarY - 2)}`, `fill="${shade(o.topColor, 0.15)}" ${topStroke}`);
        torso += rect(dx - 8, -12, 16, 7, `fill="#e9c75c" ${topStroke}`);
        torso += path(`M${n(-halfH)} -9L${n(halfH)} -9`, `stroke="#21222c" stroke-width="9"`);
        torso += path(`M${n(dx + halfS * 0.28)} ${n(top + 56)}l9 7l-3 14h-12l-3 -14z`, `fill="#e9c75c" stroke="${ink}" stroke-width="2"`);
        break;
      case 'apron':
        torso += path(`M${n(dx - halfH * 0.72)} ${n(top + 52)}Q${n(dx)} ${n(top + 40)} ${n(dx + halfH * 0.72)} ${n(top + 52)}L${n(dx + halfH * 0.88)} 2L${n(dx - halfH * 0.88)} 2Z`, `fill="#f4f1ea" ${topStroke}`);
        torso += path(`M${n(dx - 30)} ${n(top + 44)}L${n(dx - 20)} ${n(collarY)}M${n(dx + 30)} ${n(top + 44)}L${n(dx + 20)} ${n(collarY)}`, detailStroke);
        break;
      case 'dress':
        torso += path(`M${n(dx - neckW)} ${n(collarY)}Q${n(dx)} ${n(collarY + 26)} ${n(dx + neckW)} ${n(collarY)}`, detailStroke);
        torso += path(`M${n(-waist)} ${n(top + m.torso * 0.58)}Q0 ${n(top + m.torso * 0.66)} ${n(waist)} ${n(top + m.torso * 0.58)}`, `stroke="${shade(o.topColor, -0.3)}" stroke-width="4" fill="none"`);
        break;
    }
  } else {
    // Costas: gola, capuz ou costura; nenhum detalhe frontal "vaza" para trás.
    if (o.top === 'hoodie') {
      torso += path(`M-44 ${n(collarY + 2)}Q0 ${n(collarY + 74)} 44 ${n(collarY + 2)}Z`, `fill="${shade(o.topColor, -0.14)}" ${topStroke}`);
    } else if (o.top === 'blazer' || o.top === 'coat') {
      torso += path(`M0 ${n(collarY + 12)}V4`, detailStroke);
    } else {
      torso += path(`M-24 ${n(collarY + 2)}Q0 ${n(collarY + 10)} 24 ${n(collarY + 2)}`, detailStroke);
    }
    if (accIds.includes('backpack')) {
      const bx = s * 8;
      torso += rect(bx - 44, top + 24, 88, m.torso * 0.66, `data-part="backpack" rx="20" fill="${acc('backpack')!.color}" ${topStroke}`);
      torso += rect(bx - 28, top + 66, 56, 40, `rx="9" fill="${shade(acc('backpack')!.color, -0.15)}" ${topStroke}`);
    }
  }
  if (showFront && accIds.includes('backpack')) {
    const c = acc('backpack')!.color;
    if (s === 0) torso += path(`M${n(-halfS * 0.6)} ${n(top + 12)}Q${n(-halfS * 0.72)} ${n(top + 70)} ${n(-halfS * 0.72)} ${n(top + 100)}M${n(halfS * 0.6)} ${n(top + 12)}Q${n(halfS * 0.72)} ${n(top + 70)} ${n(halfS * 0.72)} ${n(top + 100)}`, `fill="none" stroke="${c}" stroke-width="13"`);
    else torso += path(`M${n(s * 6)} ${n(top + 8)}Q${n(s * 26)} ${n(top + 60)} ${n(s * 14)} ${n(top + 108)}`, `fill="none" stroke="${c}" stroke-width="13"`);
  }
  // Acessórios de pescoço/peito, ancorados no lado do peito.
  if (showFront) {
    const dx = detailX;
    if (acc('tie')) torso += path(`M${n(dx - 9)} ${n(collarY + 12)}L${n(dx + 9)} ${n(collarY + 12)}L${n(dx + 6)} ${n(collarY + 26)}L${n(dx + 15)} ${n(collarY + 92)}L${n(dx)} ${n(collarY + 110)}L${n(dx - 15)} ${n(collarY + 92)}L${n(dx - 6)} ${n(collarY + 26)}Z`, `fill="${acc('tie')!.color}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"`);
    if (acc('bowtie')) torso += path(`M${n(dx)} ${n(collarY + 14)}L${n(dx - 24)} ${n(collarY + 2)}V${n(collarY + 28)}ZM${n(dx)} ${n(collarY + 14)}L${n(dx + 24)} ${n(collarY + 2)}V${n(collarY + 28)}Z`, `fill="${acc('bowtie')!.color}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"`);
    if (acc('necklace')) {
      torso += path(`M${n(dx - 24)} ${n(collarY + 2)}Q${n(dx)} ${n(collarY + 40)} ${n(dx + 24)} ${n(collarY + 2)}`, `fill="none" stroke="${acc('necklace')!.color}" stroke-width="3.5"`);
      torso += `<circle cx="${n(dx)}" cy="${n(collarY + 24)}" r="6" fill="${acc('necklace')!.color}" stroke="${ink}" stroke-width="2"/>`;
    }
  }
  if (acc('scarf')) {
    const c = acc('scarf')!.color;
    torso += path(`M${n(-halfS * 0.52)} ${n(top + 2)}Q0 ${n(top + 30)} ${n(halfS * 0.52)} ${n(top + 2)}L${n(halfS * 0.52)} ${n(top - 8)}L${n(-halfS * 0.52)} ${n(top - 8)}Z`, `fill="${c}" ${topStroke}`);
    if (showFront) torso += rect(detailX - 13, top + 18, 26, 64, `rx="4" fill="${shade(c, -0.08)}" ${topStroke}`);
  }

  // ---- saias / vestidos: por cima das coxas ----
  let skirt = '';
  const flare = (len: number, spread: number, color: string, topY: number, detail = false) => {
    const hw = halfH * 1.02;
    const bw = hw + spread;
    const bot = topY + len;
    const d = `M${n(-hw)} ${n(topY)}Q${n(-bw * 0.92)} ${n(topY + len * 0.5)} ${n(-bw)} ${n(bot)}Q0 ${n(bot + 12)} ${n(bw)} ${n(bot)}Q${n(bw * 0.92)} ${n(topY + len * 0.5)} ${n(hw)} ${n(topY)}Z`;
    return path(d, `data-part="skirt" fill="${color}" ${topStroke}`) +
      (detail ? path(`M${n(-bw * 0.5)} ${n(bot + 2)}L${n(-hw * 0.3)} ${n(topY + 8)}M${n(bw * 0.5)} ${n(bot + 2)}L${n(hw * 0.3)} ${n(topY + 8)}`, `stroke="${ink}" stroke-opacity=".3" stroke-width="2.4" fill="none"`) : '');
  };
  if (info.skirtFromTop) skirt = flare(m.thigh * 1.25 * (1 - sit * 0.3), 34 * bodyV.bodyWidth, info.topFill, -6, true);
  else if (o.bottom === 'skirt') skirt = flare(m.thigh * 0.85 * (1 - sit * 0.2), 22 * bodyV.bodyWidth, o.bottomColor, -2, true);
  else if (o.bottom === 'longskirt') skirt = flare((m.thigh + m.shin * 0.75) * (1 - sit * 0.35), 30 * bodyV.bodyWidth, o.bottomColor, -2, true);
  else if (o.top === 'coat') skirt = flare(m.thigh * 0.8 * (1 - sit * 0.3), 14 * bodyV.bodyWidth, o.topColor, -8);
  // Quadril: emenda calça/tronco.
  const pelvis = !info.skirtFromTop && o.bottom !== 'skirt' && o.bottom !== 'longskirt'
    ? path(`M${n(-halfH * 1.02)} -4Q0 6 ${n(halfH * 1.02)} -4L${n(Math.max(hipOff + m.legW * 0.55, halfH * 0.72))} 22L${n(-Math.max(hipOff + m.legW * 0.55, halfH * 0.72))} 22Z`, `fill="${o.bottomColor}" stroke="${ink}" stroke-width="${n(ow)}" stroke-linejoin="round"`)
    : '';

  // ---- cabeça ----
  const headLocalY = -m.torso - m.neck - m.ry * 0.8;
  const hair = renderHair({
    styleId: def.hair.style, color: def.hair.color, highlight: def.hair.highlight, ink, ow,
    rx: m.rx, ry: m.ry, view: headV, idPrefix: id,
  });
  const ears = renderEars({ def, rx: m.rx, ry: m.ry, view: headV });
  const headD = headOutline(def.face.headShape, m.rx, m.ry, headV);
  const face = renderFace({ id, def, rx: m.rx, ry: m.ry, view: headV, state: pose.face });
  const neckW = m.limbW * 1.15 * clamp(def.body.build, 0.8, 1.3);
  const neck = limb(`M${n(headV.facing * 6)} ${n(-m.torso - m.neck - 10)}L0 ${n(-m.torso + 8)}`, shade(skin, -0.08), ink, neckW, ow * 0.9);
  const accFront = renderHeadAccessories(def, headV, m, ink, ow);
  const headGroup =
    `<g data-part="head" data-view="${pose.headView}" transform="translate(0 ${n(headLocalY + rig.headNod)}) rotate(${n(rig.headTilt)} 0 ${n(m.ry * 0.8)})">` +
    hair.behindHead +
    ears.behind +
    path(headD, `data-part="head-shape" fill="${skin}" stroke="${ink}" stroke-width="${n(ow * 1.05)}" stroke-linejoin="round"`) +
    (headV.showsFace ? '' : path(headD, `fill="${shade(skin, -0.08)}" fill-opacity=".6"`)) +
    ears.over +
    `<g data-part="face">${face}</g>` +
    (acc('earrings') && headV.cls !== 'back' ? renderEarrings(def, headV, m, ink) : '') +
    hair.front +
    accFront +
    `</g>`;

  // ---- ordem por vista ----
  const armLBehind = limbNear(bodyV, 'L') < -0.2;
  const armRBehind = limbNear(bodyV, 'R') < -0.2;
  const legOrder: Array<'L' | 'R'> = limbNear(bodyV, 'L') <= limbNear(bodyV, 'R') ? ['L', 'R'] : ['R', 'L'];
  const lean = rig.torsoLean + (def.body.age === 'elder' ? (bodyV.facing || 0) * 4 : 0);

  const armsBehind = (armLBehind ? renderArm('L') : '') + (armRBehind ? renderArm('R') : '');
  const armsFront = (!armLBehind ? renderArm('L') : '') + (!armRBehind ? renderArm('R') : '');

  const torsoGroup =
    `<g data-part="torso-group" transform="translate(0 ${n(hipY)}) rotate(${n(lean)})">` +
    (hair.backBehindBody ? `<g transform="translate(0 ${n(headLocalY + rig.headNod)})">${hair.backBehindBody}</g>` : '') +
    armsBehind +
    pelvis +
    torso +
    neck +
    (hair.backOverBody ? `<g transform="translate(0 ${n(headLocalY + rig.headNod)})">${hair.backOverBody}</g>` : '') +
    armsFront +
    headGroup +
    `</g>`;

  const legs = renderLeg(legOrder[0]!) + renderLeg(legOrder[1]!);
  const svg =
    `<g data-part="root" data-body-view="${pose.bodyView}" data-head-view="${pose.headView}" transform="translate(0 ${n(-rig.bodyY)})">` +
    (info.defs ? `<defs>${info.defs}</defs>` : '') +
    legs +
    (skirt ? `<g transform="translate(0 ${n(hipY)})">${skirt}</g>` : '') +
    torsoGroup +
    `</g>`;

  // Posição aproximada das mãos, usada por objetos segurados e pelo gesto "apontar".
  const handPos = (name: 'L' | 'R'): Pt => {
    const g = armGeom(name);
    const a1 = rad(g.upperDeg);
    const a2 = rad(g.upperDeg + g.lowerDeg);
    const hx = g.x - Math.sin(a1) * m.upperArm - Math.sin(a2) * (m.forearm + handSize * 1.2);
    const hy = hipY + shoulderY + Math.cos(a1) * m.upperArm + Math.cos(a2) * (m.forearm + handSize * 1.2);
    return [hx, hy - rig.bodyY];
  };
  return {
    svg,
    handL: handPos('L'),
    handR: handPos('R'),
    head: [0, hipY + headLocalY - rig.bodyY],
    metrics: m,
  };
}

const lerpN = (a: number, b: number, t: number) => a + (b - a) * t;

function renderEarrings(def: CharacterDefinition, view: ViewInfo, m: BodyMetrics, ink: string): string {
  const color = def.accessories.find((a) => a.id === 'earrings')!.color;
  const y = m.ry * 0.38;
  const dot = (x: number) => `<circle data-part="earring" cx="${n(x)}" cy="${n(y)}" r="7.5" fill="${color}" stroke="${ink}" stroke-width="2"/>`;
  if (view.cls === 'front') return dot(-m.rx * 1.02) + dot(m.rx * 1.02);
  if (view.cls === 'profile') return dot(-view.facing * m.rx * 0.28);
  if (view.cls === 'quarter') return dot(-view.facing * m.rx * 0.82);
  return dot(view.facing * m.rx * 0.76);
}

function renderHeadAccessories(def: CharacterDefinition, view: ViewInfo, m: BodyMetrics, ink: string, ow: number): string {
  let out = '';
  const { rx, ry } = m;
  const s = view.facing;
  const stroke = `stroke="${ink}" stroke-width="${n(ow)}" stroke-linejoin="round"`;
  const eyeY = -ry * 0.04;
  const glassesId = ['glasses', 'squareglasses', 'sunglasses'].filter((g) => def.accessories.some((a) => a.id === g)).pop();
  if (glassesId && view.showsFace) {
    const a = def.accessories.find((x) => x.id === glassesId)!;
    const sun = glassesId === 'sunglasses';
    const square = glassesId === 'squareglasses';
    const E = 0.42 * def.face.eyeSpacing;
    const lens = (x: number, scale: number) => {
      const w = 34 * scale;
      const h = 30;
      const attrs = `fill="${sun ? '#1c1d26' : '#ffffff'}" fill-opacity="${sun ? 0.92 : 0.16}" stroke="${a.color}" stroke-width="5"`;
      return square ? rect(x - w, eyeY - h, w * 2, h * 2, `rx="7" ${attrs}`) : ellipse(x, eyeY, w, h + 3, attrs);
    };
    let frame = '';
    if (view.cls === 'front') {
      frame = lens(-E * rx, 1) + lens(E * rx, 1) + path(`M${n(-E * rx + 30)} ${n(eyeY - 4)}Q0 ${n(eyeY - 14)} ${n(E * rx - 30)} ${n(eyeY - 4)}`, `fill="none" stroke="${a.color}" stroke-width="5"`);
    } else if (view.cls === 'quarter') {
      const c = s * 0.34;
      const nx = (c - s * E * 0.72) * rx;
      const fx = (c + s * E * 0.72) * rx;
      frame = lens(nx, 1) + lens(fx, 0.74) + path(`M${n(nx + s * 32)} ${n(eyeY - 4)}L${n(fx - s * 24)} ${n(eyeY - 4)}M${n(nx - s * 32)} ${n(eyeY - 4)}L${n(-s * rx * 0.8)} ${n(eyeY + 2)}`, `fill="none" stroke="${a.color}" stroke-width="5"`);
    } else {
      const x = s * 0.52 * rx;
      frame = lens(x, 0.8) + path(`M${n(x - s * 27)} ${n(eyeY - 4)}L${n(-s * rx * 0.22)} ${n(eyeY + 6)}`, `fill="none" stroke="${a.color}" stroke-width="5"`);
    }
    out += `<g data-part="glasses">${frame}</g>`;
  }
  const headTopY = -ry * 0.72;
  for (const a of def.accessories) {
    const c = a.color;
    if (a.id === 'headband') {
      out += path(`M${n(-rx * 1.02)} ${n(-ry * 0.46)}Q0 ${n(-ry * 0.82)} ${n(rx * 1.02)} ${n(-ry * 0.46)}L${n(rx * 0.99)} ${n(-ry * 0.3)}Q0 ${n(-ry * 0.66)} ${n(-rx * 0.99)} ${n(-ry * 0.3)}Z`, `data-part="hat" fill="${c}" ${stroke}`);
    }
    if (a.id === 'beanie') {
      out += path(smoothPath([[-rx * 1.04, -ry * 0.38], [-rx * 0.92, -ry * 0.95], [0, -ry * 1.22], [rx * 0.92, -ry * 0.95], [rx * 1.04, -ry * 0.38]]) + 'Z', `data-part="hat" fill="${c}" ${stroke}`);
      out += rect(-rx * 1.08, -ry * 0.56, rx * 2.16, 32, `rx="12" fill="${shade(c, -0.15)}" ${stroke}`);
      out += `<circle cx="0" cy="${n(-ry * 1.28)}" r="17" fill="${shade(c, 0.25)}" ${stroke}/>`;
    }
    if (a.id === 'cap') {
      out += path(smoothPath([[-rx * 1.02, -ry * 0.48], [-rx * 0.88, -ry * 0.98], [0, -ry * 1.16], [rx * 0.88, -ry * 0.98], [rx * 1.02, -ry * 0.48]]) + 'Z', `data-part="hat" fill="${c}" ${stroke}`);
      if (view.cls === 'front') out += path(`M${n(-rx * 0.8)} ${n(-ry * 0.5)}Q0 ${n(-ry * 0.74)} ${n(rx * 0.8)} ${n(-ry * 0.5)}Q0 ${n(-ry * 0.2)} ${n(-rx * 0.8)} ${n(-ry * 0.5)}Z`, `fill="${shade(c, -0.2)}" ${stroke}`);
      else if (view.cls === 'quarter' || view.cls === 'profile') {
        const start = view.cls === 'profile' ? rx * 0.4 : rx * 0.08;
        out += path(`M${n(s * start)} ${n(-ry * 0.58)}Q${n(s * rx * 1.2)} ${n(-ry * 0.62)} ${n(s * rx * 1.5)} ${n(-ry * 0.38)}Q${n(s * rx * 1.1)} ${n(-ry * 0.34)} ${n(s * start)} ${n(-ry * 0.4)}Z`, `fill="${shade(c, -0.2)}" ${stroke}`);
      } else if (view.cls === 'back') {
        out += path(`M-22 ${n(-ry * 0.5)}Q0 ${n(-ry * 0.72)} 22 ${n(-ry * 0.5)}`, `fill="none" ${stroke}`);
      }
    }
    if (a.id === 'fedora') {
      out += path(smoothPath([[-rx * 1.5, -ry * 0.56], [-rx, -ry * 0.72], [rx, -ry * 0.72], [rx * 1.5, -ry * 0.56], [rx, -ry * 0.42], [-rx, -ry * 0.42]], true), `data-part="hat" fill="${c}" ${stroke}`);
      out += path(`M${n(-rx * 0.8)} ${n(-ry * 0.62)}Q${n(-rx * 0.75)} ${n(-ry * 1.3)} ${n(-rx * 0.2)} ${n(-ry * 1.18)}Q0 ${n(-ry * 1.08)} ${n(rx * 0.2)} ${n(-ry * 1.18)}Q${n(rx * 0.75)} ${n(-ry * 1.3)} ${n(rx * 0.8)} ${n(-ry * 0.62)}Z`, `fill="${c}" ${stroke}`);
      out += path(`M${n(-rx * 0.8)} ${n(-ry * 0.74)}L${n(rx * 0.8)} ${n(-ry * 0.74)}`, `stroke="${shade(c, -0.45)}" stroke-width="13"`);
    }
    if (a.id === 'tophat') {
      out += rect(-rx * 1.3, headTopY - 4, rx * 2.6, 22, `data-part="hat" rx="10" fill="${c}" ${stroke}`);
      out += rect(-rx * 0.72, headTopY - ry * 0.9, rx * 1.44, ry * 0.9 + 6, `rx="5" fill="${c}" ${stroke}`);
      out += rect(-rx * 0.72, headTopY - 26, rx * 1.44, 20, `fill="${shade(c, 0.5)}" ${stroke}`);
    }
  }
  return out;
}
