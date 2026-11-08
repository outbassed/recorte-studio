/**
 * Modelos de ambiente e técnicos (assets originais do Recorte Studio). Cada um cria um projeto
 * novo e independente; os objetos padrão usados entram no projeto com identidade estável (tpl_*).
 */
import { addNode, addScene, applyBackground, ensurePropertyTrack, groupNodes, setKeyframe } from '@/engine/model/ops';
import { createLightNode, createPropNode, createScene, createTextNode } from '@/engine/model/factory';
import { deepClone } from '@/engine/model/ids';
import type { Piece, Project, Scene } from '@/engine/model/schema';
import { applyCustomBackground, createCustomBackground } from '@/engine/world/customBackgrounds';
import { createPiece, OBJECT_PREFIX } from '@/engine/world/pieces';
import { animatedTemplate } from '@/features/catalog/animatedTemplates';
import { Builder } from './scenes';

export interface ShowcaseTemplate {
  id: string;
  name: string;
  description: string;
  category: 'Ambientes' | 'Técnicos';
  whatToTest: string[];
  aspect: string;
  width: number;
  height: number;
  build: (p: Project) => void;
}

/** Objeto padrão no projeto (uma vez) e o propId para usar em nós. */
function ensureObj(p: Project, tplId: string): string {
  const o = animatedTemplate(tplId);
  if (!o) throw new Error(`Objeto padrão inexistente: ${tplId}`);
  if (!p.customObjects[o.id]) p.customObjects[o.id] = deepClone(o);
  return OBJECT_PREFIX + o.id;
}
function obj(p: Project, s: Scene, tplId: string, x: number, y: number, o: { scale?: number; name?: string; offsetMs?: number; speed?: number; clip?: string; top?: boolean } = {}): string {
  const node = createPropNode(ensureObj(p, tplId), { x, y, scale: o.scale, name: o.name ?? animatedTemplate(tplId)!.name });
  node.clipOffsetMs = o.offsetMs ?? 0;
  node.clipSpeed = o.speed ?? 1;
  node.clip = o.clip ?? '';
  return addNode(s, node, o.top ? 'top' : undefined);
}
function keys(s: Scene, id: string, path: string, list: Array<[number, number]>): void {
  const t = ensurePropertyTrack(s, id, path);
  for (const [at, v] of list) setKeyframe(t, at, v);
}
function label(s: Scene, text: string, x: number, y: number, size = 34): string {
  const t = createTextNode(text, { name: `Rótulo: ${text}` });
  t.transform.x = x;
  t.transform.y = y;
  (t as { fontSize: number }).fontSize = size;
  return addNode(s, t, 'top');
}
const P = (kind: Piece['kind'], name: string, o: Partial<Piece>) => createPiece(kind, { name, ...o });
const finish = (p: Project, scenes: Scene[]) => {
  p.scenes = {};
  p.sceneOrder = [];
  for (const s of scenes) addScene(p, s);
  p.currentSceneId = p.sceneOrder[0] ?? null;
};

/* ------------------------------ A) Mar e Barco ------------------------------ */
function seaAndBoat(p: Project): void {
  const scene = createScene('Mar e barco', 9000, 'neutro');
  const waves = ensureObj(p, 'ondas').slice(OBJECT_PREFIX.length);
  const cb = createCustomBackground(p, 'Mar aberto');
  // Céu, sol, nuvens, mar e duas faixas de ondas animadas DENTRO do cenário.
  cb.compositions.day = {
    sky: '#8fd3f2',
    pieces: [
      P('ellipse', 'Sol', { x: 640, y: -330, w: 150, h: 150, fill: '#ffd76a', stroke: 'none', strokeWidth: 0 }),
      P('ellipse', 'Nuvem 1', { x: -560, y: -360, w: 260, h: 80, fill: '#ffffff', stroke: 'none', strokeWidth: 0 }),
      P('ellipse', 'Nuvem 2', { x: -470, y: -395, w: 170, h: 70, fill: '#ffffff', stroke: 'none', strokeWidth: 0 }),
      P('ellipse', 'Nuvem 3', { x: 180, y: -300, w: 220, h: 60, fill: '#f4fbff', stroke: 'none', strokeWidth: 0 }),
      P('rect', 'Mar', { x: 0, y: 290, w: 2300, h: 700, fill: '#2f86c0', stroke: 'none', strokeWidth: 0 }),
      P('rect', 'Horizonte', { x: 0, y: -50, w: 2300, h: 22, fill: '#5aa8d8', stroke: 'none', strokeWidth: 0 }),
      P('object', 'Ondas ao fundo', { refId: waves, x: 0, y: 60, scale: 0.8, opacity: 0.7 }),
      P('object', 'Ondas no meio', { refId: waves, x: 60, y: 190, scale: 1 }),
    ],
  };
  applyCustomBackground(scene, cb, 'day');
  const b = new Builder(p, scene);
  // Passageiros atrás do casco (as pernas ficam dentro do barco).
  const nina = b.actor('nina', -190, { y: 345, scale: 0.72 });
  const zeca = b.actor('zeca', -20, { y: 345, scale: 0.72 });
  const boat = obj(p, scene, 'barco', 0, 350, { top: true, scale: 1.35 });
  const gid = groupNodes(scene, [nina, zeca, boat], 'Barco com passageiros')!;
  const g = scene.nodes[gid]!;
  // Pivô perto do casco, na linha d'água: o balanço gira em volta dele (e a bolinha fica ali).
  g.transform.pivotX = 0;
  g.transform.pivotY = 330;
  keys(scene, gid, 'transform.y', [[0, 0], [1500, -14], [3000, 0], [4500, -14], [6000, 0], [7500, -14], [9000, 0]]);
  keys(scene, gid, 'transform.rotationDeg', [[0, -3], [1500, 3], [3000, -3], [4500, 3], [6000, -3], [7500, 3], [9000, -3]]);
  // Ondas na frente cobrem a parte de baixo do casco: o barco "toca" a água.
  obj(p, scene, 'ondas', 0, 366, { top: true, offsetMs: 120, name: 'Ondas na frente' });
  b.say(nina, 'Que mar bonito hoje!', 500, 1700);
  b.act(zeca, 'wave', 2400, { durationMs: 2200 });
  b.say(zeca, 'Segura firme!', 5200, 1500);
  finish(p, [scene]);
}

/* ------------------------------ B) Acampamento ------------------------------ */
function camping(p: Project): void {
  const scene = createScene('Acampamento à noite', 10000, 'parque');
  applyBackground(scene, 'parque', { variant: 'night' }, false);
  const b = new Builder(p, scene);
  b.prop('tree', -700, 190, { scale: 1.1 });
  b.prop('tree', 720, 180, { scale: 0.95 });
  obj(p, scene, 'barraca', -440, 380);
  const bia = b.actor('bia', -170, { y: 410, pose: 'sit' });
  const caio = b.actor('caio', 400, { y: 410, pose: 'sit' });
  b.face(bia, caio);
  obj(p, scene, 'pedras', 110, 438, { top: true, scale: 0.9 });
  obj(p, scene, 'fogueira', 110, 425, { top: true });
  const light = createLightNode({ name: 'Luz da fogueira', color: '#ffb35a', intensity: 0.6, width: 1000, height: 760 });
  light.transform.x = 110;
  light.transform.y = 300;
  addNode(scene, light, 'top');
  keys(scene, light.id, 'opacity', [[0, 1], [500, 0.82], [900, 1], [1400, 0.86], [2000, 1], [2600, 0.84], [3200, 1], [10000, 1]]);
  const e = b.say(caio, 'E aí, quem conta a primeira história?', 600, 2200);
  b.say(bia, 'Eu conto! Era uma noite assim…', e + 400, 2400);
  b.expr(caio, 'surprised', e + 3200);
  finish(p, [scene]);
}

/* ------------------------------ C a H ------------------------------ */
function beach(p: Project): void {
  const scene = createScene('Praia', 8000, 'praia');
  applyBackground(scene, 'praia', {}, false);
  const b = new Builder(p, scene);
  obj(p, scene, 'palmeira', 720, 420, { scale: 1.1 });
  obj(p, scene, 'guardasol', -480, 430);
  const nina = b.actor('nina', -250);
  const bia = b.actor('bia', 260);
  b.face(nina, bia);
  const e = b.say(bia, 'Bora pro mar?', 500);
  b.say(nina, 'Só depois do protetor!', e + 300);
  b.act(bia, 'jump', e + 2200, { durationMs: 900 });
  finish(p, [scene]);
}

function city(p: Project): void {
  const scene = createScene('Rua da cidade', 8000, 'centro');
  applyBackground(scene, 'centro');
  const b = new Builder(p, scene);
  b.prop('car', 330, 400, { front: true });
  const zeca = b.actor('zeca', -900);
  keys(scene, zeca, 'transform.x', [[0, -900], [3200, -250]]);
  b.act(zeca, 'walk', 0, { durationMs: 3200 });
  const otavio = b.actor('otavio', 0, { view: 'left' });
  b.say(zeca, 'Ei! Esse carro é seu?', 3400);
  b.act(otavio, 'shrug', 5200, { durationMs: 1200 });
  finish(p, [scene]);
}

function bedroom(p: Project): void {
  const scene = createScene('Quarto', 8000, 'quarto');
  applyBackground(scene, 'quarto');
  const b = new Builder(p, scene);
  b.prop('tv', -300, 250, { scale: 0.7 });
  const luma = b.actor('luma', -120, { pose: 'sit', y: 300 });
  const rafa = b.actor('rafa', 420);
  b.face(luma, rafa);
  const e = b.say(rafa, 'Você viu meu carregador?', 400);
  b.say(luma, 'Tá embaixo da cama.', e + 300);
  b.act(rafa, 'facepalm', e + 2600, { durationMs: 1400 });
  finish(p, [scene]);
}

function forest(p: Project): void {
  const scene = createScene('Floresta', 9000, 'parque');
  applyBackground(scene, 'parque', {}, false);
  const b = new Builder(p, scene);
  b.prop('tree', -760, 170, { scale: 1.25 });
  b.prop('tree', -360, 150, { scale: 0.85 });
  b.prop('tree', 420, 160, { scale: 1.05 });
  b.prop('tree', 780, 190, { scale: 1.3 });
  obj(p, scene, 'pedras', 120, 430, { top: true });
  b.prop('plant', -560, 430, { front: true, scale: 0.9 });
  const helena = b.actor('helena', -900);
  keys(scene, helena, 'transform.x', [[0, -900], [4000, -150]]);
  b.act(helena, 'walk', 0, { durationMs: 4000 });
  b.say(helena, 'Acho que é por aqui…', 4300);
  b.act(helena, 'think', 6200, { durationMs: 1800 });
  finish(p, [scene]);
}

function classroom(p: Project): void {
  const scene = createScene('Sala de aula', 10000, 'salaaula');
  applyBackground(scene, 'salaaula');
  const b = new Builder(p, scene);
  const prof = b.actor('marta', -700, { view: 'right' });
  const alunos = [b.actor('rafa', -470, { y: 340, scale: 0.85 }), b.actor('luma', 0, { y: 340, scale: 0.85 }), b.actor('caio', 470, { y: 340, scale: 0.85 })];
  // Carteiras do cenário na frente dos alunos.
  for (const id of scene.layerOrder.filter((x) => scene.nodes[x]?.kind === 'prop' && (scene.nodes[x] as { propId: string }).propId === 'schooldesk')) {
    scene.layerOrder = [...scene.layerOrder.filter((x) => x !== id), id];
  }
  const e = b.say(prof, 'Bom dia, turma! Quem fez a lição?', 500, 2400);
  b.act(alunos[1]!, 'wave', e + 200, { durationMs: 1600 });
  b.say(alunos[1]!, 'Eu fiz!', e + 400);
  b.act(alunos[0]!, 'facepalm', e + 1800, { durationMs: 1400 });
  b.act(alunos[2]!, 'laugh', e + 2600, { durationMs: 1600 });
  finish(p, [scene]);
}

function animationLab(p: Project): void {
  const scene = createScene('Laboratório de animação', 12000, 'estudio');
  applyBackground(scene, 'neutro');
  // Fogos iguais com defasagens diferentes: mesmo objeto, quadros diferentes no mesmo instante.
  obj(p, scene, 'fogueira', -720, 250, { name: 'Fogo (defasagem 0)' });
  obj(p, scene, 'fogueira', -500, 250, { offsetMs: 110, name: 'Fogo (defasagem 110 ms)' });
  obj(p, scene, 'fogueira', -280, 250, { offsetMs: 220, speed: 0.5, name: 'Fogo (metade da velocidade)' });
  label(scene, 'Mesmo objeto, defasagem e velocidade', -500, 300, 26);
  obj(p, scene, 'ventilador', 120, 250, { clip: 'girando', name: 'Ventilador girando' });
  obj(p, scene, 'ventilador', 380, 250, { clip: 'devagar', name: 'Ventilador devagar' });
  label(scene, 'Duas animações do mesmo objeto', 250, 300, 26);
  // Grupo com keyframes de escala e giro: selecione e use a bolinha laranja.
  const box = addNode(scene, createPropNode('box', { x: 700, y: 250 }));
  const plant = addNode(scene, createPropNode('plant', { x: 760, y: 140, scale: 0.6 }));
  const gid = groupNodes(scene, [box, plant], 'Grupo de teste')!;
  scene.nodes[gid]!.transform.pivotX = 730;
  scene.nodes[gid]!.transform.pivotY = 250;
  keys(scene, gid, 'transform.scaleX', [[0, 1], [3000, 1.25], [6000, 1]]);
  keys(scene, gid, 'transform.scaleY', [[0, 1], [3000, 1.25], [6000, 1]]);
  keys(scene, gid, 'transform.rotationDeg', [[6000, 0], [9000, 12], [12000, 0]]);
  label(scene, 'Grupo: escala e giro por keyframe', 730, 300, 26);
  label(scene, 'Laboratório de animação', 0, -380, 54);
  finish(p, [scene]);
}

const HD = { aspect: '16:9', width: 1920, height: 1080 };
export const SHOWCASE_TEMPLATES: ShowcaseTemplate[] = [
  {
    id: 'mar-barco', name: 'Mar e Barco', category: 'Ambientes', ...HD, build: seaAndBoat,
    description: 'Barco com dois passageiros vinculados, boiando e balançando num mar com ondas animadas.',
    whatToTest: ['Em Camadas, selecione "Barco com passageiros" e arraste a bolinha laranja no palco: barco, Nina e Zeca vão juntos.', 'Toque a cena: o grupo balança (keyframes do grupo) enquanto o Zeca acena e a Nina fala.', 'Exporte um quadro: a bolinha não aparece.'],
  },
  {
    id: 'acampamento', name: 'Acampamento', category: 'Ambientes', ...HD, build: camping,
    description: 'Noite no parque com barraca, árvores, pedras e uma fogueira animada por quadros.',
    whatToTest: ['A fogueira anima sozinha, sem keyframes na cena (Propriedades → Aparência → Animação do objeto).', 'Busque instantes diferentes na timeline: o quadro do fogo muda e é o mesmo no vídeo.', 'A luz da fogueira tremula por keyframes de opacidade.'],
  },
  {
    id: 'praia', name: 'Praia', category: 'Ambientes', ...HD, build: beach,
    description: 'Areia, mar, palmeira e guarda-sol, com duas amigas conversando.',
    whatToTest: ['Palmeira e guarda-sol são objetos montados: edite no Criador de Objetos (cria cópia se vier do padrão).', 'Pulo da Bia como ação na timeline.'],
  },
  {
    id: 'cidade', name: 'Cidade e rua', category: 'Ambientes', ...HD, build: city,
    description: 'Centro urbano com carro, poste e alguém atravessando a rua.',
    whatToTest: ['Andar: posição X por keyframes junto com a ação Andar.', 'Carro na frente das pessoas (Camadas).'],
  },
  {
    id: 'quarto', name: 'Quarto', category: 'Ambientes', ...HD, build: bedroom,
    description: 'Quarto com cama, TV e uma conversa curta.',
    whatToTest: ['Personagem sentado (pose) e outro em pé conversando.', 'Ação "mão na testa" na timeline.'],
  },
  {
    id: 'floresta', name: 'Floresta', category: 'Ambientes', ...HD, build: forest,
    description: 'Árvores de vários tamanhos, plantas e pedras, com uma caminhada.',
    whatToTest: ['Profundidade por tamanho das árvores e ordem das camadas.', 'Caminhada com keyframes de posição.'],
  },
  {
    id: 'sala-aula', name: 'Sala de aula', category: 'Ambientes', ...HD, build: classroom,
    description: 'Professora e três alunos atrás das carteiras, cada um com uma reação.',
    whatToTest: ['Elenco maior na mesma cena, com ações simultâneas.', 'Carteiras do cenário na frente dos alunos.'],
  },
  {
    id: 'laboratorio', name: 'Laboratório de animação', category: 'Técnicos', ...HD, build: animationLab,
    description: 'Demonstração técnica: quadros, defasagem, velocidade, duas animações do mesmo objeto e grupo com keyframes.',
    whatToTest: ['Três fogos iguais em quadros diferentes no mesmo instante (defasagem e velocidade por cópia).', 'Ventilador com duas animações do mesmo objeto.', 'Selecione "Grupo de teste" e use a bolinha; o grupo também escala e gira por keyframes.'],
  },
];
