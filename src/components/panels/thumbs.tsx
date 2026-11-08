/** Miniaturas reais: SVG gerado pelo mesmo renderizador, com cache por identidade. */
import { memo, useId, useMemo } from 'react';
import type { CharacterDefinition, Project, Scene, ViewId } from '@/engine/model/schema';
import { renderCharacter, bodyMetrics } from '@/engine/character/render';
import { RigSchema } from '@/engine/model/schema';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { getBackground, renderBackground } from '@/engine/world/backgrounds';
import { BackgroundSchema } from '@/engine/model/schema';
import { getProp, propBounds, renderProp } from '@/engine/world/props';
import { previewAssetUrl } from '@/features/library/assets';

const neutralRig = RigSchema.parse({});

export function characterSvg(def: CharacterDefinition, view: ViewId, id: string, expression = 'neutral', rig = neutralRig): string {
  return renderCharacter(def, { bodyView: view, headView: view, rig, handL: 'open', handR: 'open', face: { expression, intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 } }, id).svg;
}

export const CharacterThumb = memo(function CharacterThumb({ def, view = 'front', size = 56, portrait = true }: { def: CharacterDefinition; view?: ViewId; size?: number; portrait?: boolean }) {
  const uid = useId().replace(/[^a-z0-9]/gi, '');
  const html = useMemo(() => characterSvg(def, view, `th${uid}`), [def, view, uid]);
  const m = bodyMetrics(def);
  const top = -m.totalHeight - 30;
  const vb = portrait ? `${-m.rx * 1.45} ${top - 20} ${m.rx * 2.9} ${m.rx * 2.9}` : `-220 ${top - 20} 440 ${m.totalHeight + 80}`;
  return <svg className="char-thumb" width={size} height={portrait ? size : size * 1.5} viewBox={vb} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
});

const sceneThumbCache = new WeakMap<Scene, { deps: unknown[]; aspect: string; url: string }>();
/** Tudo que, fora da cena, muda o desenho dela: elenco, objetos, cenários e mídias. */
const depsOf = (p: Project): unknown[] => [p.characters, p.customObjects, p.customBackgrounds, p.assets];

export function sceneThumbUrl(project: Project, scene: Scene): string {
  const cached = sceneThumbCache.get(scene);
  const aspect = `${project.settings.width}x${project.settings.height}`;
  const deps = depsOf(project);
  if (cached && cached.aspect === aspect && cached.deps.every((d, i) => d === deps[i])) return cached.url;
  const w = 192;
  const h = Math.round((w * project.settings.height) / project.settings.width);
  const svg = planToSvgString(planFrame(project, scene, Math.min(scene.durationMs - 1, 1200), previewAssetUrl), w, h);
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  sceneThumbCache.set(scene, { deps, aspect, url });
  return url;
}

export const SceneThumb = memo(function SceneThumb({ project, scene }: { project: Project; scene: Scene }) {
  const url = useMemo(() => sceneThumbUrl(project, scene), [project, scene]);
  return <img className="scene-thumb" src={url} alt="" loading="lazy" draggable={false} />;
});

const bgThumbCache = new Map<string, string>();
export function backgroundThumbUrl(presetId: string, variant: 'day' | 'night' = 'day'): string {
  const key = `${presetId}:${variant}`;
  const hit = bgThumbCache.get(key);
  if (hit) return hit;
  const def = getBackground(presetId);
  const layers = renderBackground(BackgroundSchema.parse({ presetId, variant }), `th-${key}-`);
  let furn = '';
  for (const f of def.furniture) {
    const p = getProp(f.propId);
    if (!p) continue;
    furn += `<g transform="translate(${f.x} ${f.y}) scale(${f.scale ?? 1})">${renderProp(f.propId, f.colorA ?? '', f.colorB ?? '', f.state ?? '')}</g>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90" viewBox="-960 -540 1920 1080"><rect x="-960" y="-540" width="1920" height="1080" fill="#14161c"/>${layers.sky}${layers.mid}${layers.ground}${layers.overlay}${furn}</svg>`;
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  bgThumbCache.set(key, url);
  return url;
}

export const PropThumb = memo(function PropThumb({ propId, size = 56 }: { propId: string; size?: number }) {
  const def = getProp(propId);
  const html = useMemo(() => renderProp(propId, '', '', ''), [propId]);
  if (!def) return null;
  const b = propBounds(def);
  const pad = Math.max(b.w, b.h) * 0.08;
  const s = Math.max(b.w, b.h) + pad * 2;
  const vb = `${b.x + b.w / 2 - s / 2} ${b.y + b.h / 2 - s / 2} ${s} ${s}`;
  return <svg width={size} height={size} viewBox={vb} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
});
