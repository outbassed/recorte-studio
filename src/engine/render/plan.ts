/**
 * Renderizador único. Preview e exportação consomem o MESMO plano (`FramePlan`):
 *  - o preview reconcilia os grupos no DOM (StageRenderer);
 *  - a exportação serializa o plano para SVG e rasteriza em canvas (toSvgString).
 * Guias, seleção, gizmos e máscara fora do quadro NUNCA fazem parte do plano.
 */
import { customObjectBounds, isCustomObjectId, renderCustomObject } from '../world/pieces';
import { frameSize, type Project, type Scene, type SceneNode, WORLD_HEIGHT } from '../model/schema';
import { evaluateScene, type ResolvedScene } from '../animation/evaluate';
import { renderCharacter, type CharacterRenderResult } from '../character/render';
import { getBackground, FLOOR_Y, renderBackground } from '../world/backgrounds';
import { isCustomPreset, renderCustomBackground } from '../world/customBackgrounds';
import { getProp, propBounds, renderProp } from '../world/props';
import { clamp, ellipse, esc, n, path, rad, rect, safeColor, seeded, shade } from './svg';
import { bubbleLayout, renderBubble, renderSubtitle } from './bubbles';

export interface PlanEntry {
  key: string;
  nodeId?: string;
  transform: string;
  opacity: number;
  filter: string;
  clip: string;
  blend: string;
  inner: string;
}

export interface PlanGroup {
  key: string;
  opacity: number;
  transform: string;
  clip: string;
  entries: PlanEntry[];
}

export interface FramePlan {
  frameW: number;
  frameH: number;
  defs: string;
  background: string | null;
  groups: PlanGroup[];
  /** por cima de tudo, em coordenadas de tela */
  screen: string;
}

export type AssetResolver = (assetId: string) => string | undefined;

export interface NodeBox { x: number; y: number; w: number; h: number }

/** Caixa local de um nó (coordenadas do próprio nó). Usada por seleção e gizmos. */
export function nodeLocalBounds(node: SceneNode, project: Project): NodeBox {
  switch (node.kind) {
    case 'character': {
      const def = project.characters[node.characterId];
      if (!def) return { x: -90, y: -420, w: 180, h: 420 };
      const r = renderCharacterBox(def);
      return r;
    }
    case 'prop': {
      if (isCustomObjectId(node.propId)) return customObjectBounds(project, node.propId);
      const p = getProp(node.propId);
      return p ? propBounds(p) : { x: -50, y: -100, w: 100, h: 100 };
    }
    case 'image':
    case 'shape':
      return { x: -node.width / 2, y: -node.height / 2, w: node.width, h: node.height };
    case 'light':
      return { x: -node.width / 2, y: -node.height / 2, w: node.width, h: node.height };
    case 'text': {
      const lines = node.text.split('\n');
      const w = Math.max(...lines.map((l) => l.length)) * node.fontSize * 0.56;
      return { x: node.align === 'start' ? 0 : node.align === 'end' ? -w : -w / 2, y: -node.fontSize, w, h: lines.length * node.fontSize * 1.2 };
    }
    case 'group':
      return { x: -60, y: -60, w: 120, h: 120 };
  }
}

import { bodyMetrics } from '../character/render';
function renderCharacterBox(def: Project['characters'][string]): NodeBox {
  const m = bodyMetrics(def);
  const w = Math.max(m.rx * 2.1, m.shoulderW + m.upperArm * 0.9);
  return { x: -w / 2, y: -m.totalHeight, w, h: m.totalHeight + 24 };
}

const blurFilter = (v: number) => `rs-blur-${String(Math.round(v * 2) / 2).replace('.', '_')}`;

const paperCache = new Map<number, { defs: string; overlay: string }>();

function paperPattern(strength: number): { defs: string; overlay: string } {
  if (strength <= 0.001) return { defs: '', overlay: '' };
  const hit = paperCache.get(strength);
  if (hit) return hit;
  const rnd = seeded(77);
  let specks = '';
  for (let i = 0; i < 90; i++) {
    const x = rnd() * 512;
    const y = rnd() * 512;
    const a = rnd() * Math.PI;
    const l = 4 + rnd() * 16;
    const dark = rnd() > 0.5;
    specks += `<path d="M${n(x)} ${n(y)}l${n(Math.cos(a) * l)} ${n(Math.sin(a) * l)}" stroke="${dark ? '#000' : '#fff'}" stroke-opacity="${n(0.3 + rnd() * 0.5)}" stroke-width="1.3"/>`;
  }
  const defs = `<pattern id="rs-paper" width="512" height="512" patternUnits="userSpaceOnUse">${specks}</pattern>`;
  const out = { defs, overlay: `<rect x="-3000" y="-2000" width="6000" height="4000" fill="url(#rs-paper)" opacity="${(clamp(strength, 0, 1) * 0.5).toFixed(3)}" pointer-events="none"/>` };
  if (paperCache.size > 40) paperCache.clear();
  paperCache.set(strength, out);
  return out;
}

export function cameraTransform(cam: ResolvedScene['camera'], parallax: number): string {
  const p = parallax;
  const z = 1 + (cam.zoom - 1) * Math.max(0, Math.min(1.5, p));
  const x = (cam.x + cam.shakeX) * p;
  const y = (cam.y + cam.shakeY) * p;
  const parts: string[] = [];
  if (cam.rotationDeg) parts.push(`rotate(${n(cam.rotationDeg)})`);
  if (z !== 1) parts.push(`scale(${z.toFixed(4)})`);
  if (x !== 0 || y !== 0) parts.push(`translate(${n(-x)} ${n(-y)})`);
  return parts.join(' ');
}

interface NodeRenderCtx {
  project: Project;
  scene: Scene;
  resolved: ResolvedScene;
  assets: AssetResolver;
  charCache: Map<string, CharacterRenderResult>;
}

function nodeTransform(node: SceneNode, scene: Scene, overrideXY?: { x: number; y: number }): string {
  const t = node.transform;
  const x = overrideXY?.x ?? t.x;
  const y = overrideXY?.y ?? t.y;
  let sx = t.scaleX;
  let sy = t.scaleY;
  if (node.useDepthScale && scene.perspective.enabled) {
    const k = clamp(1 + (y - scene.perspective.refY) * scene.perspective.strength, 0.1, 4);
    sx *= k;
    sy *= k;
  }
  const px = t.pivotX;
  const py = t.pivotY;
  let out = `translate(${n(x)} ${n(y)})`;
  if (t.rotationDeg) out += ` rotate(${n(t.rotationDeg)}${px || py ? ` ${n(px)} ${n(py)}` : ''})`;
  if (sx !== 1 || sy !== 1) out += ` scale(${sx.toFixed(4)} ${sy.toFixed(4)})`;
  return out;
}

function shadowFor(node: SceneNode, ctx: NodeRenderCtx): string {
  if (!node.shadow.enabled) return '';
  const s = node.shadow;
  const color = safeColor(s.color, '#0b1020');
  if (node.kind === 'character') {
    const m = ctx.charCache.get(node.id)?.metrics;
    const w = (m ? Math.max(m.hipW * 0.9, 80) : 90) * s.size;
    const liftY = ctx.resolved.characters[node.id]?.pose.rig.bodyY ?? 0;
    const k = clamp(1 - liftY / 500, 0.45, 1);
    return ellipse(s.offsetX, 20 + s.offsetY, w * k, 15 * k * s.size, `data-part="shadow" fill="${color}" fill-opacity="${s.opacity}"`);
  }
  if (node.kind === 'prop') {
    if (isCustomObjectId(node.propId)) {
      const b = customObjectBounds(ctx.project, node.propId);
      return node.heldBy ? '' : ellipse(s.offsetX, 2 + s.offsetY, b.w * 0.5 * s.size, Math.min(26, b.w * 0.08) * s.size, `fill="${color}" fill-opacity="${s.opacity}"`);
    }
    const def = getProp(node.propId);
    if (!def || def.wall || def.handheld || node.heldBy) return '';
    return ellipse(s.offsetX, 2 + s.offsetY, def.w * 0.5 * s.size, Math.min(26, def.w * 0.08) * s.size, `fill="${color}" fill-opacity="${s.opacity}"`);
  }
  return '';
}

function renderShape(node: Extract<SceneNode, { kind: 'shape' }>): string {
  const w = node.width;
  const h = node.height;
  const attrs = `fill="${safeColor(node.fill)}" stroke="${safeColor(node.stroke)}" stroke-width="${n(node.strokeWidth)}" stroke-linejoin="round"`;
  switch (node.shape) {
    case 'rect':
      return rect(-w / 2, -h / 2, w, h, `rx="${n(node.radius)}" ${attrs}`);
    case 'ellipse':
      return ellipse(0, 0, w / 2, h / 2, attrs);
    case 'triangle':
      return path(`M0 ${n(-h / 2)}L${n(w / 2)} ${n(h / 2)}H${n(-w / 2)}Z`, attrs);
    case 'star':
    case 'burst': {
      const count = node.shape === 'star' ? 5 : 12;
      const innerK = node.shape === 'star' ? 0.45 : 0.72;
      let d = '';
      for (let i = 0; i < count * 2; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / count;
        const k = i % 2 === 0 ? 1 : innerK;
        d += `${i ? 'L' : 'M'}${n((Math.cos(a) * w * k) / 2)} ${n((Math.sin(a) * h * k) / 2)}`;
      }
      return path(`${d}Z`, attrs);
    }
  }
}

const FONT_STACKS: Record<string, string> = {
  sans: "'Trebuchet MS','Segoe UI',Arial,sans-serif",
  serif: "Georgia,'Times New Roman',serif",
  hand: "'Comic Sans MS','Segoe Print','Trebuchet MS',cursive",
  mono: "Consolas,'Courier New',monospace",
};

const propCache = new Map<string, string>();
function cachedProp(id: string, a: string, b: string, state: string): string {
  const key = `${id}|${a}|${b}|${state}`;
  let v = propCache.get(key);
  if (v === undefined) {
    v = renderProp(id, a, b, state);
    if (propCache.size > 500) propCache.clear();
    propCache.set(key, v);
  }
  return v;
}

function renderNodeInner(node: SceneNode, ctx: NodeRenderCtx): string {
  switch (node.kind) {
    case 'character': {
      const def = ctx.resolved.characters[node.id]?.def;
      if (def?.spriteAssetId) {
        const url = ctx.assets(def.spriteAssetId);
        const m = bodyMetrics(def);
        if (url) return `<image href="${esc(url)}" x="${n(-m.totalHeight * 0.35)}" y="${n(-m.totalHeight)}" width="${n(m.totalHeight * 0.7)}" height="${n(m.totalHeight)}" preserveAspectRatio="xMidYMax meet"/>`;
      }
      return ctx.charCache.get(node.id)?.svg ?? '';
    }
    case 'prop':
      if (isCustomObjectId(node.propId)) return renderCustomObject(ctx.project, node.propId, ctx.assets, node.id);
      return cachedProp(node.propId, safeColor(node.colorA, ''), safeColor(node.colorB, ''), node.state);
    case 'image': {
      const url = ctx.assets(node.assetId);
      if (!url) {
        return rect(-node.width / 2, -node.height / 2, node.width, node.height, `fill="#3a3f4b" stroke="#d65f5f" stroke-width="6" stroke-dasharray="16 12"`) +
          `<text text-anchor="middle" font-size="26" font-family="Arial,sans-serif" fill="#fff">Imagem indisponível</text>`;
      }
      return `<image href="${esc(url)}" x="${n(-node.width / 2)}" y="${n(-node.height / 2)}" width="${n(node.width)}" height="${n(node.height)}" preserveAspectRatio="none"/>`;
    }
    case 'text': {
      const fam = FONT_STACKS[node.fontFamily] ?? FONT_STACKS.sans!;
      const lines = node.text.split('\n');
      const stroke = node.strokeWidth > 0 ? `stroke="${safeColor(node.strokeColor)}" stroke-width="${n(node.strokeWidth)}" paint-order="stroke" stroke-linejoin="round"` : '';
      return `<text text-anchor="${node.align}" font-family="${fam.replace(/"/g, '')}" font-size="${n(node.fontSize)}" font-weight="${node.fontWeight}" fill="${safeColor(node.color)}" ${stroke}>${lines.map((l, i) => `<tspan x="0" dy="${i ? n(node.fontSize * 1.2) : 0}">${esc(l)}</tspan>`).join('')}</text>`;
    }
    case 'shape':
      return renderShape(node);
    case 'light': {
      const gid = `${node.id}-glow`;
      const col = safeColor(node.color);
      return `<radialGradient id="${gid}"><stop offset="0" stop-color="${col}" stop-opacity="${clamp(node.intensity, 0, 1).toFixed(3)}"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient>` +
        ellipse(0, 0, node.width / 2, node.height / 2, `fill="url(#${gid})"`);
    }
    case 'group': {
      let out = '';
      for (const childId of node.children) {
        const child = ctx.resolved.nodes[childId];
        if (!child || !child.visible) continue;
        out += `<g data-node-id="${esc(child.id)}" transform="${nodeTransform(child, ctx.scene)}" opacity="${child.opacity}">${shadowFor(child, ctx)}${renderNodeInner(child, ctx)}</g>`;
      }
      return out;
    }
  }
}

const poseCache = new Map<string, { key: string; def: unknown; json: string; result: CharacterRenderResult }>();

function collectCharacters(ctx: NodeRenderCtx): void {
  for (const id of Object.keys(ctx.resolved.characters)) {
    const rc = ctx.resolved.characters[id]!;
    const key = JSON.stringify(rc.pose);
    const hit = poseCache.get(id);
    // Identidade só vale para objetos congelados pelo Immer; o resto compara pelo conteúdo.
    if (hit && hit.key === key && ((hit.def === rc.def && Object.isFrozen(rc.def)) || hit.json === JSON.stringify(rc.def))) {
      ctx.charCache.set(id, hit.result);
      continue;
    }
    const result = renderCharacter(rc.def, rc.pose, id);
    if (poseCache.size > 400) poseCache.clear();
    poseCache.set(id, { key, def: rc.def, json: JSON.stringify(rc.def), result });
    ctx.charCache.set(id, result);
  }
}

function heldPosition(node: Extract<SceneNode, { kind: 'prop' }>, ctx: NodeRenderCtx): { x: number; y: number } | null {
  if (!node.heldBy) return null;
  const [ownerId, side] = node.heldBy.split(':');
  const owner = ownerId ? ctx.resolved.nodes[ownerId] : undefined;
  const r = ownerId ? ctx.charCache.get(ownerId) : undefined;
  if (!owner || !r) return null;
  const [hx, hy] = side === 'R' ? r.handR : r.handL;
  const ot = owner.transform;
  const c = Math.cos(rad(ot.rotationDeg));
  const s = Math.sin(rad(ot.rotationDeg));
  const sx = hx * ot.scaleX;
  const sy = hy * ot.scaleY;
  return { x: ot.x + sx * c - sy * s, y: ot.y + sx * s + sy * c };
}

function planEntry(node: SceneNode, ctx: NodeRenderCtx, filters: Set<number>): PlanEntry | null {
  if (!node.visible) return null;
  const parallax = node.parallax;
  const held = node.kind === 'prop' ? heldPosition(node, ctx) : null;
  const camT = cameraTransform(ctx.resolved.camera, parallax);
  const inner = shadowFor(node, ctx) + renderNodeInner(node, ctx);
  const blur = node.blur > 0.01 ? node.blur : 0;
  if (blur) filters.add(Math.round(blur * 2) / 2);
  let clip = '';
  let maskDef = '';
  if (node.mask.enabled) {
    const id = `${node.id}-mask`;
    const m = node.mask;
    maskDef = `<clipPath id="${id}">${m.kind === 'ellipse' ? ellipse(m.x + m.width / 2, m.y + m.height / 2, m.width / 2, m.height / 2, '') : rect(m.x, m.y, m.width, m.height, '')}</clipPath>`;
    clip = id;
  }
  const nodeT = nodeTransform(node, ctx.scene, held ?? undefined);
  const body = clip ? `${maskDef}<g clip-path="url(#${clip})">${inner}</g>` : inner;
  return {
    key: node.id,
    nodeId: node.id,
    transform: `${camT} ${nodeT}`.trim(),
    opacity: clamp(node.opacity, 0, 1),
    filter: blur ? blurFilter(blur) : '',
    clip: '',
    blend: node.kind === 'light' ? node.blend : '',
    inner: body,
  };
}

const bgCache = new WeakMap<object, { prefix: string; layers: ReturnType<typeof renderBackground> }>();
function cachedBackground(bg: Scene['background'], sceneId: string) {
  // Só objetos congelados (documento do Immer) são imutáveis com certeza.
  if (!Object.isFrozen(bg)) return renderBackground(bg, `${sceneId}-`);
  const hit = bgCache.get(bg);
  if (hit && hit.prefix === sceneId) return hit.layers;
  const layers = renderBackground(bg, `${sceneId}-`);
  bgCache.set(bg, { prefix: sceneId, layers });
  return layers;
}

/** Monta os grupos de uma cena em um instante. */
export function planScene(project: Project, scene: Scene, timeMs: number, assets: AssetResolver, opts: { transparentBg?: boolean } = {}): { group: PlanGroup; defs: string; screen: string; resolved: ResolvedScene } {
  const resolved = evaluateScene(project, scene, timeMs);
  const ctx: NodeRenderCtx = { project, scene, resolved, assets, charCache: new Map() };
  collectCharacters(ctx);
  const entries: PlanEntry[] = [];
  const filters = new Set<number>();
  const cam = resolved.camera;
  const bg = scene.background;
  const transparent = opts.transparentBg || bg.transparent;
  if (!transparent && isCustomPreset(bg.presetId)) {
    // Cenário do usuário: uma imagem por horário, no mesmo retângulo do mundo.
    const blur = bg.blur > 0.01 ? bg.blur : 0;
    if (blur) filters.add(Math.round(blur * 2) / 2);
    entries.push({ key: 'bg-custom', transform: cameraTransform(cam, bg.parallax), opacity: 1, filter: blur ? blurFilter(blur) : '', clip: '', blend: '', inner: renderCustomBackground(project, bg, assets) });
  } else if (!transparent) {
    const layers = cachedBackground(bg, scene.id);
    const def = getBackground(bg.presetId);
    const p = bg.parallax;
    const blur = bg.blur > 0.01 ? bg.blur : 0;
    if (blur) filters.add(Math.round(blur * 2) / 2);
    const push = (key: string, inner: string, par: number) => {
      if (inner) entries.push({ key: `bg-${key}`, transform: cameraTransform(cam, par), opacity: 1, filter: blur ? blurFilter(blur) : '', clip: '', blend: '', inner });
    };
    push('sky', layers.sky, p * 0.25);
    push('mid', layers.mid, def.outdoor ? p * 0.7 : p);
    push('ground', layers.ground, def.outdoor ? p + (1 - p) * 0.6 : p);
    push('overlay', layers.overlay, 0);
  }
  for (const id of scene.layerOrder) {
    const node = resolved.nodes[id];
    if (!node) continue;
    const e = planEntry(node, ctx, filters);
    if (e) entries.push(e);
  }

  const { w: frameW } = frameSize(project.settings);
  let screen = '';
  for (const b of resolved.bubbles) {
    const headInfo = resolved.characters[b.nodeId];
    const node = resolved.nodes[b.nodeId];
    if (!headInfo || !node || !node.visible) continue;
    const layout = bubbleLayout({ text: b.clip.text, style: b.clip.bubbleStyle, scale: b.clip.bubbleScale, offsetX: b.clip.bubbleOffsetX, offsetY: b.clip.bubbleOffsetY, frameW, frameH: WORLD_HEIGHT, headX: (headInfo.headX - cam.x) * cam.zoom, headY: (headInfo.headY - cam.y) * cam.zoom, headR: 120 * Math.abs(node.transform.scaleY) * cam.zoom });
    screen += renderBubble(layout);
  }
  for (const s of resolved.subtitles) screen += renderSubtitle(s.clip.text, s.clip.position, s.clip.fontSize, s.clip.color, s.clip.background, frameW);
  for (const s of resolved.dialogueSubtitles) screen += renderSubtitle(s.text, 'bottom', 46, '#ffffff', true, frameW);

  for (const { clip, progress } of resolved.effects) {
    const col = safeColor(clip.color, '#ffffff');
    const box = `x="-3000" y="-2000" width="6000" height="4000"`;
    if (clip.effect === 'flash') screen += `<rect ${box} fill="${col}" opacity="${n(clamp((1 - progress) * clip.intensity, 0, 1))}"/>`;
    if (clip.effect === 'fadeBlack') screen += `<rect ${box} fill="#000" opacity="${clamp(progress * clip.intensity, 0, 1).toFixed(3)}"/>`;
    if (clip.effect === 'fadeFromBlack') screen += `<rect ${box} fill="#000" opacity="${clamp((1 - progress) * clip.intensity, 0, 1).toFixed(3)}"/>`;
    if (clip.effect === 'tint') screen += `<rect ${box} fill="${col}" opacity="${clamp(0.35 * clip.intensity, 0, 1).toFixed(3)}"/>`;
    if (clip.effect === 'vignette') {
      screen += `<radialGradient id="${clip.id}-vg" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${clamp(0.75 * clip.intensity, 0, 1).toFixed(3)}"/></radialGradient><rect x="${n(-frameW / 2)}" y="-540" width="${n(frameW)}" height="1080" fill="url(#${clip.id}-vg)"/>`;
    }
  }

  let defs = '';
  for (const v of filters) defs += `<filter id="${blurFilter(v)}" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="${v}"/></filter>`;
  return {
    group: { key: scene.id, opacity: 1, transform: '', clip: '', entries },
    defs,
    screen,
    resolved,
  };
}

export function planFrame(project: Project, scene: Scene, timeMs: number, assets: AssetResolver, opts: { transparentBg?: boolean } = {}): FramePlan {
  const { w, h } = frameSize(project.settings);
  const p = planScene(project, scene, timeMs, assets, opts);
  const paper = paperPattern(project.settings.paperTexture);
  return {
    frameW: w,
    frameH: h,
    defs: p.defs + paper.defs,
    background: opts.transparentBg ? null : safeColor(project.settings.backgroundColor, '#14161c'),
    groups: [p.group],
    screen: paper.overlay + p.screen,
  };
}

/** Serializa o plano: SOMENTE o quadro exportável. */
export function planToSvgString(plan: FramePlan, width: number, height: number): string {
  const { frameW: w, frameH: h } = plan;
  let body = '';
  if (plan.background) body += `<rect x="${n(-w / 2 - 10)}" y="${n(-h / 2 - 10)}" width="${n(w + 20)}" height="${n(h + 20)}" fill="${plan.background}"/>`;
  for (const g of plan.groups) {
    const attrs = `${g.transform ? ` transform="${g.transform}"` : ''}${g.opacity < 1 ? ` opacity="${g.opacity.toFixed(3)}"` : ''}${g.clip ? ` clip-path="url(#${g.clip})"` : ''}`;
    body += `<g${attrs}>`;
    for (const e of g.entries) body += entryToString(e);
    body += '</g>';
  }
  body += plan.screen;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="${n(-w / 2)} ${n(-h / 2)} ${n(w)} ${n(h)}" preserveAspectRatio="xMidYMid slice"><defs>${plan.defs}</defs>${body}</svg>`;
}

export function entryToString(e: PlanEntry): string {
  const style = e.blend ? ` style="mix-blend-mode:${e.blend}"` : '';
  return `<g${e.nodeId ? ` data-node-id="${esc(e.nodeId)}"` : ''}${e.transform ? ` transform="${e.transform}"` : ''}${e.opacity < 1 ? ` opacity="${e.opacity.toFixed(3)}"` : ''}${e.filter ? ` filter="url(#${e.filter})"` : ''}${style}>${e.inner}</g>`;
}

export const STAGE_FLOOR_Y = FLOOR_Y;
export { shade };
