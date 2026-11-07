/**
 * Migração 0.3/0.4 → 1.0. Não destrutiva: o JSON original é guardado à parte pelo
 * chamador e nada é descartado em silêncio: tudo vai para o relatório.
 *
 * Principais adaptações:
 *  - atores globais viram DEFINIÇÕES + uma INSTÂNCIA por cena;
 *  - objetos e camadas (globais na 0.4) são copiados para cada cena, com IDs próprios;
 *  - x normalizado (0–1) vira coordenada de mundo; y em % vira pixels;
 *  - cues viram clips de ação, de fala e keyframes de posição.
 */
import { z } from 'zod';
import { uid } from '@/engine/model/ids';
import { createCharacterNode, createPropNode, createProject, newCharacterDefinition } from '@/engine/model/factory';
import { addDialogue, ensurePropertyTrack, getOrCreateActionTrack, setKeyframe } from '@/engine/model/ops';
import { ActionClipSchema, SceneSchema, type Project, type Scene, type ViewOrAuto, ProjectSchema } from '@/engine/model/schema';
import { FLOOR_Y, LEGACY_BACKGROUNDS } from '@/engine/world/backgrounds';
import { safeColor } from '@/engine/render/svg';

export interface MigrationReport {
  sourceVersion: string;
  counts: { scenes: number; characters: number; objects: number; dialogues: number; actions: number; keyframes: number };
  adapted: string[];
  incompatible: string[];
}

const Actor04 = z.object({
  id: z.string().optional(), name: z.string().optional(), x: z.number().optional(), y: z.number().optional(), scale: z.number().optional(),
  rotation: z.number().optional(), skin: z.string().optional(), shirt: z.string().optional(), pants: z.string().optional(), hair: z.string().optional(),
  hairstyle: z.string().optional(), clothes: z.string().optional(), mood: z.string().optional(), view: z.string().optional(), bodyView: z.string().optional(),
  look: z.string().optional(), headTilt: z.number().optional(), opacity: z.number().optional(),
}).loose();
const Cue04 = z.object({
  id: z.string().optional(), actor: z.string().optional(), kind: z.string().optional(), start: z.number().optional(), end: z.number().optional(),
  text: z.string().optional(), label: z.string().optional(), from: z.number().optional(), to: z.number().optional(),
}).loose();
const Scene04 = z.object({ id: z.string().optional(), name: z.string().optional(), background: z.string().optional(), duration: z.number().optional(), cues: z.array(Cue04).optional() }).loose();
const Object04 = z.object({ id: z.string().optional(), name: z.string().optional(), type: z.string().optional(), color: z.string().optional(), x: z.number().optional(), y: z.number().optional(), size: z.number().optional(), rotation: z.number().optional() }).loose();
export const Project04Schema = z.object({
  version: z.number().optional(), projectName: z.string().optional(),
  actors: z.array(Actor04).min(1), objects: z.array(Object04).optional(), scenes: z.array(Scene04).min(1),
  layers: z.array(z.object({ kind: z.string(), id: z.string() }).loose()).optional(), activeScene: z.string().optional(),
}).loose();

const MOOD: Record<string, string> = {
  neutra: 'neutral', feliz: 'happy', brava: 'angry', triste: 'sad', surpresa: 'surprised', desconfiada: 'suspicious', assustada: 'scared', rindo: 'laughing',
  chorando: 'crying', envergonhada: 'ashamed', entediada: 'bored', apaixonada: 'love', cansada: 'tired', pensativa: 'thinking',
};
const VIEW: Record<string, ViewOrAuto> = {
  auto: 'auto', front: 'front', 'three-left': 'front-left', left: 'left', 'back-left': 'back-left', back: 'back', 'back-right': 'back-right', right: 'right', 'three-right': 'front-right',
};
const HAIR: Record<string, string> = {
  short: 'short', medium: 'medium', long: 'long', bob: 'bob', curly: 'curly', afro: 'afro', wavy: 'wavy', ponytail: 'ponytail', bun: 'bun', fade: 'fade', mohawk: 'mohawk', bald: 'bald',
};
const TOP: Record<string, string> = { camiseta: 'tshirt', camisa: 'shirt', blazer: 'blazer', moletom: 'hoodie' };
const PROP: Record<string, string> = {
  table: 'table', chair: 'chair', sofa: 'sofa', tv: 'tv', plant: 'plant', phone: 'phone', car: 'car', mug: 'mug', door: 'door', lamp: 'lamp', window: 'window', book: 'book', picture: 'picture', cube: 'box',
};
const CUE_ACTION: Record<string, string> = { wave: 'wave', dance: 'dance', surprise: 'react', laugh: 'laugh', cry: 'cry', sit: 'sit', angry: 'shakeHead' };

const toWorldX = (x: number) => (x - 0.5) * 1920;

export function migrate04(raw: unknown): { project: Project; report: MigrationReport } {
  const src = Project04Schema.parse(raw);
  const report: MigrationReport = {
    sourceVersion: `0.${src.version ?? 4}`,
    counts: { scenes: 0, characters: 0, objects: 0, dialogues: 0, actions: 0, keyframes: 0 },
    adapted: [],
    incompatible: [],
  };
  const project = createProject(src.projectName || 'Projeto importado da 0.4');
  project.scenes = {};
  project.sceneOrder = [];
  project.metadata.importedFrom = report.sourceVersion;

  // Definições
  const defByActor = new Map<string, string>();
  src.actors.forEach((a, i) => {
    const key = a.id ?? `ator-${i}`;
    const hair = HAIR[a.hairstyle ?? 'short'];
    if (a.hairstyle && !hair) report.incompatible.push(`Cabelo "${a.hairstyle}" de ${a.name}: substituído por "Curto".`);
    const top = TOP[a.clothes ?? 'camiseta'];
    if (a.clothes && !top) report.incompatible.push(`Roupa "${a.clothes}" de ${a.name}: substituída por camiseta.`);
    const def = newCharacterDefinition(a.name || `Personagem ${i + 1}`, {
      skin: safeColor(a.skin, '#e8b48c'),
      hair: { style: hair ?? 'short', color: safeColor(a.hair, '#3a2b28'), highlight: '' },
      outfit: { top: top ?? 'tshirt', topColor: safeColor(a.shirt, '#5b8dbe'), topPattern: 'none', topPatternColor: '#ffffff', bottom: 'pants', bottomColor: safeColor(a.pants, '#3d4a66'), shoes: 'sneakers', shoeColor: '#2b2d3a' },
    });
    def.face.browColor = def.hair.color;
    project.characters[def.id] = def;
    defByActor.set(key, def.id);
    report.counts.characters++;
  });
  report.adapted.push('Atores globais viraram personagens de biblioteca, com uma instância independente por cena.');

  const objects = src.objects ?? [];
  if (objects.length && src.scenes.length > 1) {
    report.adapted.push(`${objects.length} objeto(s) eram globais na 0.4: foram copiados para cada cena e agora são independentes.`);
  }
  const unknownCues = new Set<string>();

  src.scenes.forEach((s04, sceneIndex) => {
    const durationMs = Math.max(1000, Math.round((s04.duration ?? 10) * 1000));
    const presetId = LEGACY_BACKGROUNDS[s04.background ?? 'sala'];
    if (s04.background && !presetId) report.incompatible.push(`Cenário "${s04.background}" da cena "${s04.name}": substituído pelo neutro.`);
    const scene: Scene = SceneSchema.parse({ id: uid('cena'), name: s04.name || `Cena ${sceneIndex + 1}`, durationMs, background: { presetId: presetId ?? 'neutro' } });

    // Instâncias
    const nodeByActor = new Map<string, string>();
    src.actors.forEach((a, i) => {
      const key = a.id ?? `ator-${i}`;
      const node = createCharacterNode(defByActor.get(key)!, a.name || `Personagem ${i + 1}`, {
        x: toWorldX(a.x ?? 0.5),
        y: FLOOR_Y - ((a.y ?? 0) / 100) * 1080,
        scale: a.scale ?? 0.85,
        headView: VIEW[a.view ?? 'auto'] ?? 'auto',
        bodyView: a.bodyView && a.bodyView !== 'front' ? (VIEW[a.bodyView] ?? 'auto') : 'auto',
      });
      node.transform.rotationDeg = a.rotation ?? 0;
      node.opacity = Math.min(1, Math.max(0, (a.opacity ?? 100) / 100));
      node.expression = MOOD[a.mood ?? 'neutra'] ?? 'neutral';
      if (a.mood && !MOOD[a.mood]) report.incompatible.push(`Expressão "${a.mood}" de ${a.name}: substituída por Neutro.`);
      node.rig.headTilt = a.headTilt ?? 0;
      scene.nodes[node.id] = node;
      nodeByActor.set(key, node.id);
    });
    // Olhar depois: depende de todos os nós existirem
    src.actors.forEach((a, i) => {
      const nodeId = nodeByActor.get(a.id ?? `ator-${i}`)!;
      const node = scene.nodes[nodeId];
      if (node?.kind !== 'character') return;
      const look = a.look ?? 'camera';
      if (look === 'camera') node.gaze.mode = 'camera';
      else if (look === 'left' || look === 'right') {
        node.gaze.mode = 'manual';
        node.gaze.x = look === 'left' ? -200 : 200;
      } else if (look === 'auto') {
        const others = src.actors.map((b, j) => ({ b, j })).filter(({ j }) => j !== i).sort((p, q) => Math.abs((p.b.x ?? 0) - (a.x ?? 0)) - Math.abs((q.b.x ?? 0) - (a.x ?? 0)));
        const nearest = others[0];
        if (nearest) {
          node.gaze.mode = 'node';
          node.gaze.targetId = nodeByActor.get(nearest.b.id ?? `ator-${nearest.j}`) ?? null;
        }
      } else if (nodeByActor.has(look)) {
        node.gaze.mode = 'node';
        node.gaze.targetId = nodeByActor.get(look)!;
      } else {
        report.incompatible.push(`Alvo de olhar "${look}" de ${a.name} não existe: voltou para a câmera.`);
      }
    });

    // Objetos: cópia própria por cena
    const nodeByObject = new Map<string, string>();
    objects.forEach((o, i) => {
      const propId = PROP[o.type ?? ''];
      if (!propId) report.incompatible.push(`Objeto "${o.name}" (tipo ${o.type}): virou caixa.`);
      const node = createPropNode(propId ?? 'box', {
        name: o.name, x: toWorldX(o.x ?? 0.5), y: FLOOR_Y - 8 - ((o.y ?? 0) / 100) * 1080, scale: (o.size ?? 0.8) * 1.4, colorA: safeColor(o.color, ''),
      });
      node.transform.rotationDeg = o.rotation ?? 0;
      scene.nodes[node.id] = node;
      nodeByObject.set(o.id ?? `obj-${i}`, node.id);
      if (sceneIndex === 0) report.counts.objects++;
    });

    // Ordem de camadas
    const order: string[] = [];
    for (const L of src.layers ?? []) {
      const id = L.kind === 'actor' ? nodeByActor.get(L.id) : nodeByObject.get(L.id);
      if (id) order.push(id);
    }
    for (const id of Object.keys(scene.nodes)) if (!order.includes(id)) order.push(id);
    scene.layerOrder = order;

    // Cues
    const walkedActors = new Set<string>();
    for (const q of s04.cues ?? []) {
      const nodeId = q.actor ? nodeByActor.get(q.actor) : undefined;
      if (!nodeId) {
        report.incompatible.push(`Ação "${q.label ?? q.kind}" da cena "${s04.name}" aponta para um personagem inexistente.`);
        continue;
      }
      const start = Math.max(0, Math.round((q.start ?? 0) * 1000));
      const dur = Math.max(100, Math.round(((q.end ?? (q.start ?? 0) + 1) - (q.start ?? 0)) * 1000));
      if (q.kind === 'talk') {
        addDialogue(scene, nodeId, q.text ?? '', start, dur, { showBubble: true });
        report.counts.dialogues++;
      } else if (q.kind === 'walk') {
        const base = scene.nodes[nodeId]!;
        const fromX = Number.isFinite(q.from) ? toWorldX(q.from!) : base.transform.x;
        const toX = Number.isFinite(q.to) ? toWorldX(q.to!) : base.transform.x;
        const track = ensurePropertyTrack(scene, nodeId, 'transform.x');
        // Na 0.4 o ator ficava em `from` antes do primeiro walk: o key inicial reproduz isso.
        setKeyframe(track, start, fromX, { interpolation: 'linear' });
        setKeyframe(track, start + dur, toX, { interpolation: 'linear' });
        report.counts.keyframes += 2;
        walkedActors.add(nodeId);
        getOrCreateActionTrack(scene, nodeId).clips.push(ActionClipSchema.parse({ id: uid('clip'), kind: 'action', action: 'walk', label: q.label ?? 'Andar', startMs: start, durationMs: dur }));
        report.counts.actions++;
      } else if (q.kind && CUE_ACTION[q.kind]) {
        getOrCreateActionTrack(scene, nodeId).clips.push(ActionClipSchema.parse({ id: uid('clip'), kind: 'action', action: CUE_ACTION[q.kind], label: q.label ?? '', startMs: start, durationMs: dur }));
        if (q.kind === 'angry') {
          const track = ensurePropertyTrack(scene, nodeId, 'expression');
          setKeyframe(track, start, 'angry');
          setKeyframe(track, start + dur, (scene.nodes[nodeId] as { expression?: string }).expression ?? 'neutral');
          report.counts.keyframes += 2;
        }
        report.counts.actions++;
      } else {
        unknownCues.add(String(q.kind));
      }
    }
    project.scenes[scene.id] = scene;
    project.sceneOrder.push(scene.id);
    report.counts.scenes++;
    if (s04.id === src.activeScene) project.currentSceneId = scene.id;
  });
  if (!project.currentSceneId || !project.scenes[project.currentSceneId]) project.currentSceneId = project.sceneOrder[0] ?? null;
  for (const k of unknownCues) report.incompatible.push(`Tipo de ação "${k}" não reconhecido: ignorado (preservado no backup).`);
  report.adapted.push('Posições em porcentagem foram convertidas para o sistema único de coordenadas (origem no centro do quadro).');
  report.adapted.push('A ação "bravo" virou a expressão Bravo (keyframes) + balançar a cabeça.');
  return { project: ProjectSchema.parse(project), report };
}
