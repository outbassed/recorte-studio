/** Fase 3b: roupas e cabelos criados — formato, compatibilidade, renderização presa ao corpo, catálogo e biblioteca. */
import { describe, expect, it } from 'vitest';
import { CharacterDefinitionSchema, ProjectSchema, WearableSchema, WEAR_ANCHORS } from '@/engine/model/schema';
import { MANNEQUINS, newWearable, WEAR_STARTERS, wearOn, BASE_COVER, anchorGuide } from '@/engine/character/wear';
import { renderCharacter } from '@/engine/character/render';
import { poseRig } from '@/engine/character/presets';
import { VIEW_ORDER } from '@/engine/character/views';
import { createPiece } from '@/engine/world/pieces';
import { deepClone } from '@/engine/model/ids';
import { createDemoProject } from '@/features/templates/projects';
import { buildCatalog } from '@/features/catalog/catalog';
import type { CharacterDefinition, ViewId } from '@/engine/model/schema';

const face = { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 };
const svgOf = (def: CharacterDefinition, view: ViewId, pose = 'idle') => renderCharacter(def, { bodyView: view, headView: view, rig: poseRig(pose), handL: 'open', handR: 'open', face }, 't').svg;
const dressed = (w: ReturnType<typeof newWearable>, base = MANNEQUINS[0]!.def) => { const d = deepClone(base); wearOn(d, w); return d; };

describe('formato e compatibilidade', () => {
  it('personagens e projetos antigos ganham listas vazias (nada muda no desenho)', () => {
    const c = CharacterDefinitionSchema.parse({ id: 'a', name: 'A' });
    expect(c.wear).toEqual([]);
    const demo = createDemoProject();
    const raw = JSON.parse(JSON.stringify(demo));
    delete raw.wearables;
    for (const ch of Object.values(raw.characters) as Array<Record<string, unknown>>) delete ch.wear;
    const p = ProjectSchema.parse(raw);
    expect(p.wearables).toEqual({});
    const nina = Object.values(p.characters)[0]!;
    expect(svgOf(nina, 'front')).toBe(svgOf(Object.values(demo.characters)[0]!, 'front'));
    expect(svgOf(nina, 'front')).not.toContain('data-wear-layer');
  });
  it('todos os pontos de partida geram peças válidas, com camadas presas a partes do corpo', () => {
    for (const s of WEAR_STARTERS) {
      const w = newWearable(s.kind, s.label, s.id);
      expect(WearableSchema.safeParse(w).success, s.id).toBe(true);
      for (const l of w.layers) expect(WEAR_ANCHORS).toContain(l.anchor);
    }
  });
  it('limites: no máximo 12 peças por personagem e 40 camadas por peça', () => {
    const w = newWearable('clothing', 'x', 'tshirt');
    expect(WearableSchema.safeParse({ ...w, layers: Array.from({ length: 41 }, () => w.layers[0]) }).success).toBe(false);
    expect(CharacterDefinitionSchema.safeParse({ id: 'a', name: 'A', wear: Array.from({ length: 13 }, () => w) }).success).toBe(false);
  });
  it('guia de cada parte do corpo existe (para desenhar por cima)', () => {
    for (const a of WEAR_ANCHORS) expect(anchorGuide(a).box.w).toBeGreaterThan(0);
  });
});

describe('acompanha o corpo', () => {
  const shirt = newWearable('clothing', 'Camisa', 'shirt');
  shirt.layers[0]!.pieces.push(createPiece('text', { text: 'TRAQUINA', fontSize: 28 }));
  it('aparece nas 8 vistas; texto só nas vistas em que a camada é visível', () => {
    const d = dressed(shirt);
    for (const v of VIEW_ORDER) expect(svgOf(d, v), v).toContain('data-wear-layer');
    expect(svgOf(d, 'front')).toContain('TRAQUINA');
    // Botões da frente (camada só de frente) somem de costas.
    const front = shirt.layers.find((l) => l.side === 'front')!;
    expect(svgOf(d, 'front')).toContain(`data-wear-layer="${front.id}"`);
    expect(svgOf(d, 'back')).not.toContain(`data-wear-layer="${front.id}"`);
  });
  it('acompanha a pose: mangas mudam de posição quando o braço se move', () => {
    const d = dressed(shirt);
    const sleeve = (svg: string) => svg.match(/data-wear-layer="[^"]+" transform="[^"]+"/g)?.join('|');
    expect(sleeve(svgOf(d, 'front', 'idle'))).toBeTruthy();
    expect(svgOf(d, 'front', 'hands-up')).not.toBe(svgOf(d, 'front', 'idle'));
  });
  it('ajusta ao corpo: escala diferente em criança e adulto', () => {
    const scaleOf = (svg: string) => svg.match(/data-wear-layer="[^"]+" transform="translate\([^)]+\) scale\(([\d.]+)/)?.[1];
    const child = MANNEQUINS.find((m) => m.id === 'crianca')!.def;
    expect(scaleOf(svgOf(dressed(shirt, child), 'front'))).not.toBe(scaleOf(svgOf(dressed(shirt), 'front')));
  });
  it('cabelo criado substitui o estilo do personagem e troca o outro cabelo criado', () => {
    const nina = deepClone(Object.values(createDemoProject().characters)[0]!);
    const h1 = newWearable('hair', 'A', 'hair-short');
    const h2 = newWearable('hair', 'B', 'hair-long');
    wearOn(nina, h1);
    wearOn(nina, h2);
    expect(nina.wear.map((w) => w.name)).toEqual(['B']);
    const long = h2.layers.find((l) => l.depth === 'behindBody');
    expect(long).toBeTruthy();
    expect(svgOf(nina, 'back')).toContain(`data-wear-layer="${long!.id}"`);
  });
});

describe('privacidade do manequim', () => {
  it('sem roupa: peito e quadril com cobertura neutra opaca em todas as vistas', () => {
    for (const m of MANNEQUINS) {
      expect(m.def.outfit.top).toBe('base');
      expect(m.def.outfit.bottom).toBe('base');
      for (const v of VIEW_ORDER) expect(svgOf(m.def, v), `${m.id} ${v}`).toContain(BASE_COVER);
    }
  });
  it('peça que substitui a parte de cima/baixo deixa a base neutra por baixo (nunca descoberto)', () => {
    const nina = deepClone(Object.values(createDemoProject().characters)[0]!);
    const d = newWearable('clothing', 'Vestido', 'dress');
    wearOn(nina, d);
    expect(svgOf(nina, 'front')).toContain(BASE_COVER);
  });
});

describe('catálogo e biblioteca', () => {
  it('peças do projeto e da biblioteca viram itens individuais (sem duplicar a mesma identidade)', () => {
    const p = createDemoProject();
    const w = newWearable('clothing', 'Jaqueta', 'coat');
    const h = newWearable('hair', 'Coque', 'hair-bun');
    p.wearables[w.id] = w;
    const nina = Object.values(p.characters)[0]!;
    wearOn(nina, w);
    const library = [
      { id: 'lib1', kind: 'wearable' as const, name: 'Jaqueta', favorite: 0, createdAt: 1, data: deepClone(w) },
      { id: 'lib2', kind: 'wearable' as const, name: 'Coque', favorite: 0, createdAt: 1, data: deepClone(h) },
      { id: 'lib3', kind: 'wearable' as const, name: 'Quebrada', favorite: 0, createdAt: 1, data: { nope: true } },
    ];
    const cat = buildCatalog({ project: p, library, favorites: new Set() }).filter((e) => e.kind === 'wearable');
    const jaq = cat.filter((e) => e.name === 'Jaqueta');
    expect(jaq).toHaveLength(1);
    expect(jaq[0]!.origin).toBe('project');
    expect(jaq[0]!.usage).toBe(1);
    expect(jaq[0]!.libId).toBe('lib1');
    expect(jaq[0]!.category).toBe('Roupas');
    const coque = cat.find((e) => e.name === 'Coque')!;
    expect(coque.origin).toBe('mine');
    expect(coque.category).toBe('Cabelos');
    expect(cat.find((e) => e.name === 'Quebrada')!.broken).toBeTruthy();
  });
  it('projeto com peças sobrevive a salvar e abrir (JSON do .jrec)', () => {
    const p = createDemoProject();
    const w = newWearable('clothing', 'Macacão', 'overalls');
    p.wearables[w.id] = w;
    wearOn(Object.values(p.characters)[0]!, w);
    const back = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    expect(back.wearables[w.id]!.name).toBe('Macacão');
    expect(Object.values(back.characters)[0]!.wear[0]!.id).toBe(w.id);
  });
});
