/**
 * Templates de cena: cada um CONSTRÓI nós, trilhas, clips e keys reais, com IDs
 * próprios. Tudo continua editável depois de inserido.
 */
import { createLightNode, createPropNode, createScene, createShapeNode, createTextNode, ensureBuiltinCharacter, createCharacterNode } from '@/engine/model/factory';
import {
  actorInsertIndex, addDialogue, addEffect, addNode, addSubtitle, applyBackground, applyPose, ensurePropertyTrack, faceEachOther, insertAction, setKeyframe, type ActionParams,
} from '@/engine/model/ops';
import { CAMERA_TARGET, type CharacterNode, type Project, type Scene, type ViewId } from '@/engine/model/schema';
import { FLOOR_Y } from '@/engine/world/backgrounds';

export interface SceneTemplate {
  id: string;
  name: string;
  category: 'Conversa' | 'Humor' | 'Escola e trabalho' | 'TV e mídia' | 'Ação' | 'Estrutura';
  keywords: string[];
  background: string;
  durationMs: number;
  build: (b: Builder) => void;
}

export class Builder {
  constructor(public project: Project, public scene: Scene) {}
  actor(builtinId: string, x: number, o: { y?: number; scale?: number; view?: ViewId; pose?: string; expression?: string; layer?: 'top' | 'bottom' | number } = {}): string {
    const def = ensureBuiltinCharacter(this.project, builtinId);
    if (!def) throw new Error(`Personagem embutido inexistente: ${builtinId}`);
    const node = createCharacterNode(def.id, def.name, { x, y: o.y ?? FLOOR_Y, scale: o.scale, bodyView: o.view, headView: o.view });
    if (o.pose) applyPose(node, o.pose);
    if (o.expression) node.expression = o.expression;
    addNode(this.scene, node, o.layer ?? actorInsertIndex(this.scene));
    return node.id;
  }
  prop(propId: string, x: number, y = FLOOR_Y - 40, o: { scale?: number; colorA?: string; colorB?: string; state?: string; front?: boolean } = {}): string {
    return addNode(this.scene, createPropNode(propId, { x, y, ...o }), o.front ? 'top' : undefined);
  }
  face(a: string, b: string): void { faceEachOther(this.scene, a, b); }
  say(id: string, text: string, at: number, dur?: number, extra: Parameters<typeof addDialogue>[5] = {}): number {
    const c = addDialogue(this.scene, id, text, at, dur, extra);
    return at + c.durationMs;
  }
  act(id: string, action: string, at: number, p: ActionParams = {}): number {
    return at + insertAction(this.project, this.scene, id, action, at, p);
  }
  expr(id: string, expression: string, at: number): void {
    setKeyframe(ensurePropertyTrack(this.scene, id, 'expression'), at, expression, { interpolation: 'hold' });
  }
  zoom(from: number, to: number, at: number, dur: number): void {
    const t = ensurePropertyTrack(this.scene, CAMERA_TARGET, 'zoom');
    setKeyframe(t, at, from);
    setKeyframe(t, at + dur, to);
  }
  camX(from: number, to: number, at: number, dur: number): void {
    const t = ensurePropertyTrack(this.scene, CAMERA_TARGET, 'x');
    setKeyframe(t, at, from);
    setKeyframe(t, at + dur, to);
  }
  node(id: string): CharacterNode { return this.scene.nodes[id] as CharacterNode; }
}

export const SCENE_TEMPLATES: SceneTemplate[] = [
  {
    id: 'sofa', name: 'Conversa no sofá', category: 'Conversa', keywords: ['conversa', 'sofa', 'sala'], background: 'sala', durationMs: 9000,
    build: (b) => {
      const n = b.actor('nina', -130, { y: 260, pose: 'sit' });
      const z = b.actor('zeca', 130, { y: 260, pose: 'sit' });
      b.face(n, z);
      const e = b.say(n, 'Você viu o que aconteceu ontem?', 500);
      const e2 = b.say(z, 'Não vi! Me conta tudo.', e + 300);
      b.expr(n, 'mocking', e2 + 100);
      b.say(n, 'Melhor você nem saber…', e2 + 300);
    },
  },
  {
    id: 'discussao', name: 'Discussão frente a frente', category: 'Conversa', keywords: ['discussao', 'briga'], background: 'cozinha', durationMs: 8000,
    build: (b) => {
      const n = b.actor('nina', -290, { expression: 'angry' });
      const z = b.actor('zeca', 290, { expression: 'worried' });
      b.face(n, z);
      const e = b.say(n, 'Quem comeu o meu bolo?!', 400, undefined, { bubbleStyle: 'shout' });
      b.act(n, 'point', 500, { durationMs: 1500 });
      const e2 = b.say(z, 'O bolo fugiu sozinho!', e + 200);
      b.act(z, 'shrug', e + 200);
      b.act(n, 'crossArms', e2 + 100, { durationMs: 2000 });
      b.zoom(1, 1.2, e2, 1800);
    },
  },
  {
    id: 'entrevista', name: 'Entrevista', category: 'TV e mídia', keywords: ['entrevista', 'jornalista'], background: 'estudio', durationMs: 9000,
    build: (b) => {
      const o = b.actor('otavio', -330, { y: 300 });
      const h = b.actor('helena', 330, { y: 300 });
      b.face(o, h);
      const e = b.say(o, 'Qual é o seu maior talento?', 500);
      const e2 = b.say(h, 'Consigo dormir em pé.', e + 300);
      b.act(o, 'laugh', e2 + 100);
      b.say(o, 'Impressionante!', e2 + 400);
    },
  },
  {
    id: 'apresentacao', name: 'Apresentação de TV', category: 'TV e mídia', keywords: ['tv', 'apresentador', 'programa'], background: 'estudio', durationMs: 7000,
    build: (b) => {
      const o = b.actor('otavio', -330, { y: 340 });
      b.node(o).gaze.mode = 'camera';
      b.act(o, 'wave', 300, { durationMs: 1200 });
      const e = b.say(o, 'Boa noite! Começa agora o seu programa favorito.', 500);
      b.act(o, 'gesture', e - 1800, { durationMs: 1800 });
      b.zoom(1, 1.15, 0, 3000);
    },
  },
  {
    id: 'aula', name: 'Aula', category: 'Escola e trabalho', keywords: ['aula', 'professor', 'escola', 'alunos'], background: 'salaaula', durationMs: 10000,
    build: (b) => {
      const p = b.actor('marta', -720, { y: 300, scale: 0.95 });
      const a1 = b.actor('caio', -440, { y: 340 });
      const a2 = b.actor('luma', 40, { y: 340 });
      const a3 = b.actor('bia', 470, { y: 340 });
      b.node(a1).gaze.mode = 'node'; b.node(a1).gaze.targetId = p;
      b.node(a2).gaze.mode = 'node'; b.node(a2).gaze.targetId = p;
      b.node(a3).gaze.mode = 'node'; b.node(a3).gaze.targetId = p;
      const e = b.say(p, 'Alguém sabe a resposta?', 500);
      b.act(p, 'point', 700, { durationMs: 1400 });
      b.act(a2, 'wave', e + 200, { durationMs: 1300 });
      const e2 = b.say(a2, 'Eu sei! É quarenta e dois!', e + 700);
      b.expr(p, 'surprised', e2 + 100);
    },
  },
  {
    id: 'corredor', name: 'Corredor escolar', category: 'Escola e trabalho', keywords: ['corredor', 'escola', 'colega'], background: 'corredor', durationMs: 8000,
    build: (b) => {
      const c = b.actor('bia', -760);
      const r = b.actor('rafa', 300);
      b.act(c, 'walk', 200, { targetX: -220, durationMs: 1900 });
      b.face(c, r);
      const e = b.say(r, 'Fez a lição de matemática?', 2300);
      b.expr(c, 'worried', e);
      b.say(c, 'Tinha lição?!', e + 200);
    },
  },
  {
    id: 'telefonema', name: 'Telefonema', category: 'Conversa', keywords: ['telefone', 'ligacao', 'celular'], background: 'quarto', durationMs: 8000,
    build: (b) => {
      const z = b.actor('zeca', -240);
      const phone = b.prop('phone', -240, 200);
      (b.scene.nodes[phone] as { heldBy: string }).heldBy = `${z}:R`;
      b.act(z, 'phone', 200, { durationMs: 7400, side: 'R' });
      const e = b.say(z, 'Alô? Quem está falando?', 500);
      b.expr(z, 'surprised', e + 900);
      b.say(z, 'Como assim, EU MESMO?!', e + 1000, undefined, { bubbleStyle: 'shout' });
    },
  },
  {
    id: 'reacao', name: 'Reação engraçada', category: 'Humor', keywords: ['reacao', 'engracado', 'comedia'], background: 'bar', durationMs: 7000,
    build: (b) => {
      const z = b.actor('zeca', -260, { y: 460 });
      const n = b.actor('nina', 260, { y: 460 });
      b.face(z, n);
      const e = b.say(z, 'Eu ganhei na loteria!', 400);
      b.act(n, 'react', e + 100);
      b.zoom(1, 1.5, e + 100, 300);
      b.camX(0, 200, e + 100, 300);
      b.say(n, 'Você tá brincando?!', e + 500, undefined, { bubbleStyle: 'shout' });
    },
  },
  {
    id: 'susto', name: 'Susto', category: 'Humor', keywords: ['susto', 'assustar', 'medo'], background: 'rua', durationMs: 6000,
    build: (b) => {
      const n = b.actor('nina', 120, { view: 'front-right' });
      const z = b.actor('zeca', -760);
      b.act(z, 'walk', 200, { targetX: -160, durationMs: 1700 });
      b.say(z, 'BU!', 2000, 700, { bubbleStyle: 'shout' });
      b.act(n, 'react', 2100);
      b.expr(n, 'scared', 2100);
      addEffect(b.scene, 'shake', 2100, 500);
      b.say(n, 'Você me assustou!', 3300);
    },
  },
  {
    id: 'pensando', name: 'Personagem pensando', category: 'Humor', keywords: ['pensando', 'duvida', 'ideia'], background: 'escritorio', durationMs: 7000,
    build: (b) => {
      const o = b.actor('otavio', -140, {});
      b.act(o, 'think', 200, { durationMs: 3800 });
      b.say(o, 'Se eu trocar o almoço pelo jantar…', 600, 3000, { bubbleStyle: 'thought' });
      b.expr(o, 'excited', 4300);
      b.act(o, 'jump', 4300);
      b.say(o, 'Tive uma ideia!', 4500, undefined, { bubbleStyle: 'shout' });
    },
  },
  {
    id: 'entrando', name: 'Personagem entrando na sala', category: 'Ação', keywords: ['entrar', 'chegar', 'porta'], background: 'sala', durationMs: 7000,
    build: (b) => {
      const door = b.prop('door', 640, 180, { state: 'closed' });
      const h = b.actor('helena', 700);
      setKeyframe(ensurePropertyTrack(b.scene, door, 'state'), 300, 'open');
      b.act(h, 'walk', 500, { targetX: 150, durationMs: 2300 });
      setKeyframe(ensurePropertyTrack(b.scene, door, 'state'), 2300, 'closed');
      b.act(h, 'wave', 3000, { durationMs: 1200 });
      b.say(h, 'Cheguei! Tem café?', 3100);
    },
  },
  {
    id: 'saindo', name: 'Saindo de casa', category: 'Ação', keywords: ['sair', 'casa', 'tchau'], background: 'entrada', durationMs: 7000,
    build: (b) => {
      const r = b.actor('rafa', 0, { y: 230, scale: 0.92 });
      const door = Object.values(b.scene.nodes).find((x) => x.kind === 'prop' && x.propId === 'door');
      if (door) {
        setKeyframe(ensurePropertyTrack(b.scene, door.id, 'state'), 200, 'open');
        setKeyframe(ensurePropertyTrack(b.scene, door.id, 'state'), 1800, 'closed');
      }
      b.say(r, 'Fui! Volto antes da janta!', 400);
      b.act(r, 'wave', 500, { durationMs: 1100 });
      b.act(r, 'walk', 2600, { targetX: 1400, durationMs: 3400 });
    },
  },
  {
    id: 'perseguicao', name: 'Perseguição 2D', category: 'Ação', keywords: ['perseguicao', 'correr', 'fuga'], background: 'centro', durationMs: 7000,
    build: (b) => {
      const r = b.actor('rafa', -500);
      const n = b.actor('nuno', -1000);
      b.act(r, 'run', 200, { targetX: 1500, durationMs: 5800 });
      b.act(n, 'run', 800, { targetX: 1100, durationMs: 5800 });
      b.camX(-300, 700, 200, 5800);
      b.expr(r, 'scared', 200);
      b.expr(n, 'angry', 200);
      b.say(n, 'Parado aí!', 1500, undefined, { bubbleStyle: 'shout' });
    },
  },
  {
    id: 'praca', name: 'Encontro na praça', category: 'Conversa', keywords: ['praca', 'encontro'], background: 'praca', durationMs: 8000,
    build: (b) => {
      const t = b.actor('tiao', -40, { y: 200, pose: 'sit' });
      const l = b.actor('dona-lurdes', 800);
      b.act(l, 'walk', 300, { targetX: 280, durationMs: 2500 });
      b.face(t, l);
      b.say(l, 'Tião! Quanto tempo!', 3000);
      b.expr(t, 'happy', 3200);
      b.say(t, 'Lurdes, você não mudou nada.', 5100);
    },
  },
  {
    id: 'rua', name: 'Conversa na rua', category: 'Conversa', keywords: ['rua', 'vizinho'], background: 'rua', durationMs: 7000,
    build: (b) => {
      const a = b.actor('zeca', -280);
      const c = b.actor('nina', 280);
      b.face(a, c);
      const e = b.say(a, 'Bom dia, vizinha!', 400);
      b.act(a, 'wave', 400, { durationMs: 1200 });
      b.say(c, 'Bom dia! Seu cachorro comeu meu chinelo.', e + 300);
    },
  },
  {
    id: 'jantar', name: 'Jantar em família', category: 'Conversa', keywords: ['jantar', 'familia', 'mesa'], background: 'restaurante', durationMs: 9000,
    build: (b) => {
      const t = b.actor('tiao', -460, {});
      const n = b.actor('nina', -130, {});
      const c = b.actor('caio', 190, {});
      const l = b.actor('dona-lurdes', 460, {});
      b.face(t, l);
      b.node(n).gaze.mode = 'node'; b.node(n).gaze.targetId = c;
      b.node(c).gaze.mode = 'node'; b.node(c).gaze.targetId = n;
      const e = b.say(l, 'Quem quer repetir?', 500);
      b.act(c, 'wave', e + 100, { durationMs: 1000 });
      b.say(c, 'Eu! Eu! Eu!', e + 300);
      b.act(t, 'laugh', e + 1200);
    },
  },
  {
    id: 'urgente', name: 'Notícia urgente', category: 'TV e mídia', keywords: ['noticia', 'urgente', 'plantao', 'telejornal'], background: 'estudio', durationMs: 7000,
    build: (b) => {
      const o = b.actor('helena', -330, { y: 340 });
      const bar = addNode(b.scene, createShapeNode('rect', { name: 'Faixa', width: 2200, height: 110, fill: '#c23b3b', strokeWidth: 0, radius: 0, transform: { x: 0, y: 460, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      const txt = addNode(b.scene, createTextNode('URGENTE: gato assume prefeitura', { name: 'Texto da faixa', fontSize: 58, color: '#ffffff', strokeWidth: 0, transform: { x: 0, y: 480, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      void bar; void txt;
      b.say(o, 'Interrompemos a programação para uma notícia urgente!', 400);
      b.act(o, 'gesture', 400, { durationMs: 3200 });
      b.zoom(1, 1.2, 0, 4500);
      addEffect(b.scene, 'flash', 100, 260);
    },
  },
  {
    id: 'video', name: 'Videoconferência', category: 'Escola e trabalho', keywords: ['video', 'reuniao', 'online', 'call'], background: 'neutro', durationMs: 8000,
    build: (b) => {
      const frames: Array<[number, string]> = [[-360, '#3d4a66'], [360, '#58a59a']];
      for (const [x, col] of frames) addNode(b.scene, createShapeNode('rect', { name: 'Janela da chamada', width: 660, height: 840, fill: col, radius: 22, transform: { x, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      const o = b.actor('otavio', -360, { y: 620, scale: 1.25 });
      const m = b.actor('marta', 360, { y: 620, scale: 1.25 });
      // Máscara 2D: o corpo é recortado na borda inferior da janela da chamada.
      for (const id of [o, m]) b.scene.nodes[id]!.mask = { enabled: true, kind: 'rect', x: -400, y: -1000, width: 800, height: 840 };
      const e = b.say(o, 'Você está no mudo…', 500);
      b.say(m, 'E agora, consegue me ouvir?', e + 500);
    },
  },
  {
    id: 'tensao', name: 'Cena de tensão', category: 'Ação', keywords: ['tensao', 'drama', 'suspense'], background: 'delegacia', durationMs: 9000,
    build: (b) => {
      const s = b.actor('nuno', -300, { expression: 'suspicious' });
      const r = b.actor('rafa', 300, { expression: 'worried' });
      b.face(s, r);
      b.scene.background.tone = 'dark';
      addNode(b.scene, createLightNode({ name: 'Luz da lâmpada', width: 1100, height: 900, intensity: 0.5, transform: { x: 0, y: -60, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      b.zoom(1, 1.3, 500, 6000);
      const e = b.say(s, 'Onde você estava às oito?', 1000);
      b.say(r, 'Eu… dormindo.', e + 800, undefined, { bubbleStyle: 'whisper' });
    },
  },
  {
    id: 'quarto', name: 'Diálogo no quarto', category: 'Conversa', keywords: ['quarto', 'amigas', 'segredo'], background: 'quarto', durationMs: 8000,
    build: (b) => {
      const bia = b.actor('bia', 120, { y: 240, pose: 'sit' });
      const n = b.actor('nina', -320, {});
      b.face(bia, n);
      const e = b.say(n, 'Posso te contar um segredo?', 500, undefined, { bubbleStyle: 'whisper' });
      b.expr(bia, 'excited', e);
      b.say(bia, 'Conta! Conta agora!', e + 200);
    },
  },
  {
    id: 'abertura', name: 'Abertura de episódio', category: 'Estrutura', keywords: ['abertura', 'intro', 'episodio'], background: 'neutro', durationMs: 4000,
    build: (b) => {
      b.scene.background.primary = '#2b2d5a';
      b.scene.background.floor = '#2b2d5a';
      const burst = addNode(b.scene, createShapeNode('burst', { name: 'Explosão', width: 1200, height: 800, fill: '#f2a65a', strokeWidth: 6 }));
      const title = addNode(b.scene, createTextNode('MEU EPISÓDIO', { name: 'Título', fontSize: 130, fontWeight: '900', color: '#fffdf6', strokeWidth: 10, transform: { x: 0, y: 40, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      for (const id of [burst, title]) {
        const t = ensurePropertyTrack(b.scene, id, 'transform.scaleX');
        const u = ensurePropertyTrack(b.scene, id, 'transform.scaleY');
        for (const tr of [t, u]) {
          setKeyframe(tr, 0, 0.1, { easing: 'backOut', interpolation: 'bezier' });
          setKeyframe(tr, 700, 1);
        }
      }
      const r = ensurePropertyTrack(b.scene, burst, 'transform.rotationDeg');
      setKeyframe(r, 0, 0, { interpolation: 'linear' });
      setKeyframe(r, 4000, 60, { interpolation: 'linear' });
      addEffect(b.scene, 'fadeBlack', 3500, 500);
    },
  },
  {
    id: 'encerramento', name: 'Encerramento', category: 'Estrutura', keywords: ['encerramento', 'creditos', 'fim'], background: 'neutro', durationMs: 5000,
    build: (b) => {
      b.scene.background.primary = '#1c1d26';
      b.scene.background.floor = '#1c1d26';
      const title = addNode(b.scene, createTextNode('FIM', { name: 'Fim', fontSize: 170, fontWeight: '900', transform: { x: 0, y: -60, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      addNode(b.scene, createTextNode('Obrigado por assistir!', { name: 'Agradecimento', fontSize: 58, strokeWidth: 0, transform: { x: 0, y: 70, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      const op = ensurePropertyTrack(b.scene, title, 'opacity');
      setKeyframe(op, 0, 0);
      setKeyframe(op, 800, 1);
      addEffect(b.scene, 'fadeFromBlack', 0, 700);
      addEffect(b.scene, 'fadeBlack', 4300, 700);
    },
  },
  {
    id: 'monologo', name: 'Monólogo', category: 'Conversa', keywords: ['monologo', 'discurso', 'sozinho'], background: 'noturno', durationMs: 9000,
    build: (b) => {
      const h = b.actor('rafa', 0, { y: FLOOR_Y + 10, scale: 1.1 });
      b.zoom(1, 1.35, 0, 8000);
      const e = b.say(h, 'Às vezes eu penso…', 500);
      b.expr(h, 'thinking', 500);
      const e2 = b.say(h, 'E se o pombo também pensa em mim?', e + 500);
      b.expr(h, 'confused', e2);
    },
  },
  {
    id: 'comparacao', name: 'Comparação lado a lado', category: 'Estrutura', keywords: ['comparacao', 'antes', 'depois'], background: 'neutro', durationMs: 7000,
    build: (b) => {
      addNode(b.scene, createShapeNode('rect', { name: 'Metade esquerda', width: 960, height: 1400, fill: '#d97f6a', strokeWidth: 0, radius: 0, transform: { x: -480, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      addNode(b.scene, createShapeNode('rect', { name: 'Metade direita', width: 960, height: 1400, fill: '#74b28d', strokeWidth: 0, radius: 0, transform: { x: 480, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      addNode(b.scene, createTextNode('ANTES', { name: 'Antes', fontSize: 90, fontWeight: '900', transform: { x: -480, y: -400, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      addNode(b.scene, createTextNode('DEPOIS', { name: 'Depois', fontSize: 90, fontWeight: '900', transform: { x: 480, y: -400, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      b.actor('otavio', -480, { expression: 'tired' });
      const d = b.actor('otavio', 480, { expression: 'happy' });
      b.act(d, 'dance', 800, { durationMs: 5000 });
    },
  },
  {
    id: 'tela-dividida', name: 'Tela dividida', category: 'Estrutura', keywords: ['tela dividida', 'split', 'duas cenas'], background: 'neutro', durationMs: 8000,
    build: (b) => {
      addNode(b.scene, createShapeNode('rect', { name: 'Metade superior', width: 2400, height: 540, fill: '#5b8dbe', strokeWidth: 0, radius: 0, transform: { x: 0, y: -270, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      addNode(b.scene, createShapeNode('rect', { name: 'Metade inferior', width: 2400, height: 540, fill: '#e0b04c', strokeWidth: 0, radius: 0, transform: { x: 0, y: 270, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 } }));
      const a = b.actor('zeca', -320, { y: -6, scale: 0.75 });
      const c = b.actor('nina', 320, { y: 520, scale: 0.75 });
      const e = b.say(a, 'Oi, tá me ouvindo?', 500);
      b.say(c, 'Tô! Onde você está?', e + 300);
      addSubtitle(b.scene, 'Enquanto isso, do outro lado da cidade…', 0, 1800);
    },
  },
];

export const getSceneTemplate = (id: string) => SCENE_TEMPLATES.find((t) => t.id === id);

/** Constrói a cena do template. Só acrescenta personagens à biblioteca do projeto. */
export function buildTemplateScene(project: Project, templateId: string, name?: string): Scene {
  const t = getSceneTemplate(templateId);
  if (!t) throw new Error(`Template inexistente: ${templateId}`);
  const scene = createScene(name ?? t.name, t.durationMs, t.background);
  applyBackground(scene, t.background);
  t.build(new Builder(project, scene));
  return scene;
}
