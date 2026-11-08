/**
 * Histórias de teste grandes, montadas só com o motor (sem mídia binária):
 * várias cenas, cenário próprio com dezenas de peças, objetos aninhados,
 * personagens estáticos (multidão) em dois horários e um objeto personalizado em cena.
 */
import { CustomObjectSchema, type Project } from '@/engine/model/schema';
import { createPropNode } from '@/engine/model/factory';
import { sceneOf } from '@/engine/model/ops';
import { createPiece, freezeCharacter, OBJECT_PREFIX } from '@/engine/world/pieces';
import { createCustomBackground } from '@/engine/world/customBackgrounds';
import { createFromProjectTemplate } from '@/features/templates/projects';

export const SKY = { day: '#9fd3f0', night: '#1d2747' } as const;

export interface StoryOptions {
  /** Id do modelo de projeto: 'episodio' (16:9, 5 cenas) ou 'vertical' (9:16, 1 cena). */
  template?: 'episodio' | 'vertical';
  crowd?: number;
  buildings?: number;
}

export function bigStory(o: StoryOptions = {}): Project {
  const p = createFromProjectTemplate(o.template ?? 'episodio');
  const vertical = p.settings.height > p.settings.width;
  const spread = vertical ? 0.33 : 1;

  // Objeto aninhado: Letreiro (2 peças) dentro de Banca (usa Letreiro).
  p.customObjects.obj_letreiro = CustomObjectSchema.parse({
    id: 'obj_letreiro', name: 'Letreiro', width: 260, height: 120,
    pieces: [createPiece('rect', { x: 0, y: -60, w: 240, h: 100, fill: '#f2c95c', radius: 14 }), createPiece('star', { x: 0, y: -60, w: 60, h: 60, fill: '#e8616a' })],
  });
  p.customObjects.obj_banca = CustomObjectSchema.parse({
    id: 'obj_banca', name: 'Banca', width: 300, height: 320,
    pieces: [createPiece('rect', { x: 0, y: -80, w: 280, h: 160, fill: '#8a5a3c' }), createPiece('object', { refId: 'obj_letreiro', x: 0, y: -210, scale: 0.9 })],
  });

  const cb = createCustomBackground(p, 'Praça da história');
  const cast = Object.values(p.characters);
  const make = (night: boolean) => {
    const pieces = [
      createPiece('rect', { name: 'Chão', x: 0, y: 420, w: 2208, h: 400, fill: night ? '#2c3a2e' : '#69b05c', strokeWidth: 0 }),
    ];
    for (let i = 0; i < (o.buildings ?? 40); i++) {
      const w = 90 + ((i * 37) % 70);
      const h = 200 + ((i * 53) % 260);
      pieces.push(createPiece('rect', { name: `Prédio ${i + 1}`, x: Math.round((-1050 + i * 54) * spread), y: Math.round(230 - h / 2), w, h, fill: night ? '#2a3050' : ['#c9b8a6', '#b8a898', '#d4c4b0', '#a89888'][i % 4], strokeWidth: 3 }));
    }
    for (let i = 0; i < 12; i++) pieces.push(createPiece('ellipse', { name: `Luz ${i + 1}`, x: Math.round((-900 + i * 170) * spread), y: -120 + (i % 3) * 30, w: 18, h: 18, fill: night ? '#ffe08a' : '#ffffff', strokeWidth: 0, opacity: night ? 1 : 0.4 }));
    for (let i = 0; i < 6; i++) pieces.push(createPiece('prop', { name: `Árvore ${i + 1}`, refId: 'tree', x: Math.round((-800 + i * 330) * spread), y: 232, scale: 0.7 }));
    pieces.push(createPiece('object', { name: 'Banca', refId: 'obj_banca', x: Math.round(-300 * spread), y: 232 }));
    const views = ['front', 'front-left', 'front-right', 'left', 'right'] as const;
    for (let i = 0; i < (o.crowd ?? 6) && cast.length; i++) {
      const def = cast[i % cast.length]!;
      pieces.push(createPiece('character', {
        name: `Figurante ${i + 1}`, x: Math.round((-500 + i * 190) * spread), y: 232 + (i % 2) * 14, scale: 0.55,
        character: freezeCharacter(def, { view: views[i % views.length]!, expression: i % 2 ? 'happy' : 'neutral', poseId: i % 3 === 0 ? 'wave-L' : 'idle' }),
      }));
    }
    return { sky: night ? SKY.night : SKY.day, pieces };
  };
  cb.compositions.day = make(false);
  cb.compositions.night = make(true);

  const ids = p.sceneOrder;
  ids.forEach((id, i) => {
    const s = sceneOf(p, id);
    // Cenas pares: cenário próprio de dia; ímpares alternadas: de noite.
    if (i % 2 === 0) {
      s.background = { ...s.background, presetId: `custom:${cb.id}`, timeOfDay: i % 4 === 0 ? 'day' : 'night' };
    }
  });
  const target = sceneOf(p, ids[Math.min(1, ids.length - 1)]!);
  const prop = createPropNode(OBJECT_PREFIX + 'obj_banca', { name: 'Banca', x: Math.round(300 * spread), y: 232 });
  target.nodes[prop.id] = prop;
  target.layerOrder.push(prop.id);
  return p;
}
