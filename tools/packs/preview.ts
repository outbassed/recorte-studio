/** Desenho de itens como SVG independente: capas do índice e folhas de conferência visual. Só usa o renderizador do app. */
import { renderCharacter, bodyMetrics } from '@/engine/character/render';
import { createProject } from '@/engine/model/factory';
import { BackgroundSchema, RigSchema, type Project } from '@/engine/model/schema';
import { availableTimes, renderCustomBackground } from '@/engine/world/customBackgrounds';
import { customObjectBounds, OBJECT_PREFIX, renderCustomObject } from '@/engine/world/pieces';
import type { BuildItem } from '@/features/packs/format';
import { MANNEQUIN } from './mannequin';

const neutral = RigSchema.parse({});
const none = () => undefined;
const wrap = (vb: string, body: string, w = 240, h = 240) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}">${body}</svg>`;

type Data = Record<string, unknown>;

/** Projeto de mentira com o objeto (e os aninhados) para o renderizador. */
function projectFor(item: BuildItem): Project {
  const p = createProject('preview');
  const d = item.data as Data;
  const objs = [...(d.object ? [d.object] : []), ...((d.objects as Array<{ id: string }>) ?? [])] as Array<Project['customObjects'][string]>;
  for (const o of objs) p.customObjects[o.id] = o;
  if (d.background) { const b = d.background as Project['customBackgrounds'][string]; p.customBackgrounds[b.id] = b; }
  return p;
}

/** SVG de um item em `size` pixels (quadrado). Cenário usa 16:9. */
export function itemSvg(item: BuildItem, opts: { size?: number; time?: string; view?: 'front' | 'left' | 'back' | 'right'; animMs?: number } = {}): string {
  const size = opts.size ?? 240;
  const d = item.data as Data;
  switch (item.kind) {
    case 'object': {
      const p = projectFor(item);
      const id = (d.object as { id: string }).id;
      const body = renderCustomObject(p, OBJECT_PREFIX + id, none, '', opts.animMs !== undefined ? { clip: '', localMs: opts.animMs } : undefined);
      const b = customObjectBounds(p, OBJECT_PREFIX + id);
      const s = Math.max(b.w, b.h, 40) * 1.12;
      return wrap(`${b.x + b.w / 2 - s / 2} ${b.y + b.h / 2 - s / 2} ${s} ${s}`, body, size, size);
    }
    case 'background': {
      const p = projectFor(item);
      const cb = d.background as Project['customBackgrounds'][string];
      const time = (opts.time ?? availableTimes(cb)[0] ?? 'day') as 'day';
      const body = renderCustomBackground(p, BackgroundSchema.parse({ presetId: `custom:${cb.id}`, timeOfDay: time }), none);
      return wrap('-960 -540 1920 1080', body, size, Math.round((size * 9) / 16));
    }
    case 'character': {
      const def = d as never as Parameters<typeof renderCharacter>[0];
      const m = bodyMetrics(def);
      const v = opts.view ?? 'front';
      const svg = renderCharacter(def, { bodyView: v, headView: v, rig: neutral, handL: 'open', handR: 'open', face: { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 } }, 'pv').svg;
      return wrap(`-220 ${-m.totalHeight - 50} 440 ${m.totalHeight + 80}`, svg, size, Math.round(size * 1.5));
    }
    case 'pose': {
      const m = bodyMetrics(MANNEQUIN);
      const pose = d as unknown as { rig: unknown; handL: 'open' | 'fist' | 'point'; handR: 'open' | 'fist' | 'point' };
      const svg = renderCharacter(MANNEQUIN, { bodyView: 'front', headView: 'front', rig: RigSchema.parse(pose.rig), handL: pose.handL, handR: pose.handR, face: { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 } }, 'pv').svg;
      return wrap(`-220 ${-m.totalHeight - 50} 440 ${m.totalHeight + 80}`, svg, size, Math.round(size * 1.5));
    }
  }
}
