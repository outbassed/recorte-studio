/**
 * Plano estruturado: o ÚNICO formato que comandos e modelos de IA podem produzir.
 * É validado por schema e aplicado como transação determinística, com Undo.
 * Nunca há eval, HTML, SVG ou JS vindo de modelo.
 */
import { z } from 'zod';
import { uid } from '@/engine/model/ids';
import { createCharacterNode, createPropNode, createScene, ensureBuiltinCharacter, newCharacterDefinition } from '@/engine/model/factory';
import {
  actorInsertIndex, addDialogue, addNode, addScene, applyBackground, ensurePropertyTrack, insertAction, moveLayer, setKeyframe, writeProperty,
} from '@/engine/model/ops';
import { ASPECT_PRESETS, CAMERA_TARGET, type CharacterDefinition, type CharacterNode, type Project, type Scene } from '@/engine/model/schema';
import { getBackground, BACKGROUNDS, FLOOR_Y } from '@/engine/world/backgrounds';
import { getProp } from '@/engine/world/props';
import { getExpression, EXPRESSIONS } from '@/engine/character/expressions';
import { getHairStyle } from '@/engine/character/hair';
import { normalizeText } from '@/features/library/search';
import { getAction } from '@/engine/animation/actions';
import { getBuiltinCharacter } from '@/engine/character/presets';
import { safeColor } from '@/engine/render/svg';

const ref = z.string().min(1).max(80);
const ms = z.number().min(0).max(36_000_000);

const Appearance = z.object({
  age: z.enum(['child', 'teen', 'adult', 'elder']).optional(),
  height: z.number().min(0.4).max(1.6).optional(),
  build: z.number().min(0.5).max(1.8).optional(),
  belly: z.number().min(0).max(1.5).optional(),
  skin: z.string().optional(),
  hairStyle: z.string().optional(),
  hairColor: z.string().optional(),
  mustache: z.string().optional(),
  beard: z.string().optional(),
  top: z.string().optional(),
  topColor: z.string().optional(),
  topPattern: z.enum(['none', 'stripes', 'dots', 'floral', 'plaid']).optional(),
  bottom: z.string().optional(),
  bottomColor: z.string().optional(),
  accessories: z.array(z.string()).max(8).optional(),
});
export type Appearance = z.infer<typeof Appearance>;

export const PlanActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('createCharacter'), ref: ref.optional(), name: ref, appearance: Appearance.default({}), addToScene: z.boolean().default(true), x: z.number().optional() }),
  z.object({ type: z.literal('updateCharacter'), character: ref, appearance: Appearance }),
  z.object({ type: z.literal('addCharacter'), character: ref, x: z.number().optional(), scale: z.number().optional() }),
  z.object({ type: z.literal('createScene'), name: ref, background: z.string().optional(), durationMs: ms.optional() }),
  z.object({ type: z.literal('setBackground'), background: z.string(), variant: z.enum(['day', 'night']).optional() }),
  z.object({ type: z.literal('setFormat'), aspect: z.string() }),
  z.object({ type: z.literal('addProp'), prop: z.string(), ref: ref.optional(), x: z.number().optional(), y: z.number().optional(), scale: z.number().optional() }),
  z.object({ type: z.literal('transform'), node: ref, x: z.number().optional(), y: z.number().optional(), scale: z.number().optional(), rotation: z.number().optional(), opacity: z.number().min(0).max(1).optional() }),
  z.object({ type: z.literal('layer'), node: ref, position: z.enum(['front', 'back', 'inFrontOf', 'behind']), relativeTo: ref.optional() }),
  z.object({ type: z.literal('action'), node: ref, action: z.string(), atMs: ms.optional(), durationMs: ms.optional(), targetX: z.number().optional(), targetNode: ref.optional(), fromRight: z.boolean().optional(), view: z.string().optional() }),
  z.object({ type: z.literal('say'), node: ref, text: z.string().min(1).max(600), atMs: ms.optional(), durationMs: ms.optional() }),
  z.object({ type: z.literal('look'), node: ref, target: ref, atMs: ms.optional(), turnHead: z.boolean().default(true) }),
  z.object({ type: z.literal('expression'), node: ref, expression: z.string(), atMs: ms.optional() }),
  z.object({ type: z.literal('camera'), zoom: z.number().min(0.1).max(10).optional(), x: z.number().optional(), y: z.number().optional(), atMs: ms.optional(), durationMs: ms.optional() }),
  z.object({ type: z.literal('note'), text: z.string().max(500) }),
]);
export type PlanAction = z.infer<typeof PlanActionSchema>;

export const PlanSchema = z.object({
  summary: z.string().max(400).default(''),
  actions: z.array(PlanActionSchema).max(120),
});
export type Plan = z.infer<typeof PlanSchema>;

export interface ApplyContext {
  sceneId: string;
  selectedNodeId?: string | null;
  timeMs: number;
}

export interface ApplyResult { applied: number; warnings: string[]; sceneId: string }

const nameKey = normalizeText;

export function findNodeByName(scene: Scene, name: string): string | null {
  if (scene.nodes[name]) return name;
  const q = nameKey(name);
  const nodes = Object.values(scene.nodes);
  const exact = nodes.find((n) => nameKey(n.name) === q);
  if (exact) return exact.id;
  const partial = nodes.find((n) => nameKey(n.name).includes(q) || q.includes(nameKey(n.name)));
  return partial?.id ?? null;
}

function findCharacterDef(p: Project, name: string): CharacterDefinition | undefined {
  const q = nameKey(name);
  return Object.values(p.characters).find((c) => nameKey(c.name) === q || c.id === name);
}

function resolveCharacter(p: Project, name: string): CharacterDefinition | undefined {
  const found = findCharacterDef(p, name);
  if (found) return found;
  const q = nameKey(name);
  const builtin = ['nina', 'zeca', 'dona-lurdes', 'tiao', 'bia', 'caio', 'marta', 'otavio', 'rafa', 'helena', 'nuno', 'luma'].find((id) => nameKey(getBuiltinCharacter(id)?.name ?? '').includes(q) || id === q);
  return builtin ? ensureBuiltinCharacter(p, builtin) : undefined;
}

function applyAppearance(def: CharacterDefinition, a: Appearance, warnings: string[]): void {
  if (a.age) def.body.age = a.age;
  if (a.height !== undefined) def.body.height = a.height;
  if (a.build !== undefined) def.body.build = a.build;
  if (a.belly !== undefined) def.body.belly = a.belly;
  if (a.skin) def.skin = safeColor(a.skin, def.skin);
  if (a.hairStyle) {
    if (getHairStyle(a.hairStyle).id === a.hairStyle) def.hair.style = a.hairStyle;
    else warnings.push(`Cabelo "${a.hairStyle}" não existe na biblioteca; mantive o atual.`);
  }
  if (a.hairColor) {
    def.hair.color = safeColor(a.hairColor, def.hair.color);
    def.face.browColor = def.hair.color;
    if (def.face.mustache !== 'none' || def.face.beard !== 'none') def.face.facialHairColor = def.hair.color;
  }
  if (a.mustache) def.face.mustache = a.mustache;
  if (a.beard) def.face.beard = a.beard;
  if (a.mustache || a.beard) def.face.facialHairColor = def.hair.color;
  if (a.top) def.outfit.top = a.top;
  if (a.topColor) def.outfit.topColor = safeColor(a.topColor, def.outfit.topColor);
  if (a.topPattern) def.outfit.topPattern = a.topPattern;
  if (a.bottom) def.outfit.bottom = a.bottom;
  if (a.bottomColor) def.outfit.bottomColor = safeColor(a.bottomColor, def.outfit.bottomColor);
  if (a.accessories) def.accessories = a.accessories.map((id) => ({ id, color: '#d65f5f' }));
}

const cleanActionId = (id: string) => id.trim();

const COMPOSITE = new Set(['walk', 'run', 'stop', 'enter', 'exit', 'talk', 'turn', 'look', 'lookAway', 'blink', 'openDoor', 'closeDoor', 'cameraZoom', 'cameraPan']);

/**
 * Aplica o plano sobre um rascunho. Tudo acontece em UMA transação do histórico.
 * O que não pode ser feito vira aviso; o plano nunca falha pela metade em silêncio.
 */
export function applyPlan(p: Project, plan: Plan, ctx: ApplyContext): ApplyResult {
  const warnings: string[] = [];
  let sceneId = ctx.sceneId;
  let applied = 0;
  const refs = new Map<string, string>();
  const scene = () => p.scenes[sceneId]!;
  const nodeRef = (name: string): string | null => {
    if (refs.has(name)) return refs.get(name)!;
    const q = nameKey(name);
    if ((q === 'selecionado' || q === 'personagem' || q === 'selected') && ctx.selectedNodeId && scene().nodes[ctx.selectedNodeId]) return ctx.selectedNodeId;
    return findNodeByName(scene(), name);
  };
  const addCharacterToScene = (def: CharacterDefinition, x?: number, scale?: number): string => {
    const count = Object.values(scene().nodes).filter((n) => n.kind === 'character').length;
    const spots = getBackground(scene().background.presetId).spots;
    const node = createCharacterNode(def.id, def.name, { x: x ?? spots[count % spots.length] ?? 0, y: FLOOR_Y, scale });
    addNode(scene(), node, actorInsertIndex(scene()));
    return node.id;
  };
  const time = (v: number | undefined) => v ?? ctx.timeMs;

  for (const a of plan.actions) {
    switch (a.type) {
      case 'createCharacter': {
        const def = newCharacterDefinition(a.name);
        applyAppearance(def, a.appearance, warnings);
        p.characters[def.id] = def;
        if (a.addToScene) {
          const id = addCharacterToScene(def, a.x);
          refs.set(a.ref ?? a.name, id);
          refs.set(a.name, id);
        }
        applied++;
        break;
      }
      case 'updateCharacter': {
        const nodeId = nodeRef(a.character);
        const fromNode = nodeId ? scene().nodes[nodeId] : undefined;
        const def = fromNode?.kind === 'character' ? p.characters[fromNode.characterId] : resolveCharacter(p, a.character);
        if (!def) {
          warnings.push(`Personagem "${a.character}" não encontrado.`);
          break;
        }
        applyAppearance(def, a.appearance, warnings);
        applied++;
        break;
      }
      case 'addCharacter': {
        const def = resolveCharacter(p, a.character);
        if (!def) {
          warnings.push(`Personagem "${a.character}" não existe na biblioteca.`);
          break;
        }
        const id = addCharacterToScene(def, a.x, a.scale);
        refs.set(a.character, id);
        applied++;
        break;
      }
      case 'createScene': {
        const bg = a.background && BACKGROUNDS.some((b) => b.id === a.background) ? a.background : 'neutro';
        if (a.background && bg !== a.background) warnings.push(`Cenário "${a.background}" não existe; usei o neutro.`);
        const s = createScene(a.name, a.durationMs ?? 8000, bg);
        applyBackground(s, bg);
        addScene(p, s, sceneId);
        sceneId = s.id;
        applied++;
        break;
      }
      case 'setBackground': {
        if (!BACKGROUNDS.some((b) => b.id === a.background)) {
          warnings.push(`Cenário "${a.background}" não existe.`);
          break;
        }
        applyBackground(scene(), a.background, a.variant ? { variant: a.variant } : {});
        applied++;
        break;
      }
      case 'setFormat': {
        const preset = ASPECT_PRESETS.find((x) => x.id === a.aspect);
        if (!preset) {
          warnings.push(`Formato "${a.aspect}" desconhecido.`);
          break;
        }
        p.settings.aspectRatio = preset.id;
        p.settings.width = preset.w;
        p.settings.height = preset.h;
        applied++;
        break;
      }
      case 'addProp': {
        const def = getProp(a.prop);
        if (!def) {
          warnings.push(`Objeto "${a.prop}" não existe na biblioteca.`);
          break;
        }
        const node = createPropNode(a.prop, { x: a.x, y: a.y, scale: a.scale });
        addNode(scene(), node);
        refs.set(a.ref ?? a.prop, node.id);
        refs.set(def.label, node.id);
        applied++;
        break;
      }
      case 'transform': {
        const id = nodeRef(a.node);
        if (!id) {
          warnings.push(`Elemento "${a.node}" não encontrado nesta cena.`);
          break;
        }
        const t = ctx.timeMs;
        if (a.x !== undefined) writeProperty(scene(), id, 'transform.x', a.x, t);
        if (a.y !== undefined) writeProperty(scene(), id, 'transform.y', a.y, t);
        if (a.scale !== undefined) {
          writeProperty(scene(), id, 'transform.scaleX', a.scale, t);
          writeProperty(scene(), id, 'transform.scaleY', a.scale, t);
        }
        if (a.rotation !== undefined) writeProperty(scene(), id, 'transform.rotationDeg', a.rotation, t);
        if (a.opacity !== undefined) writeProperty(scene(), id, 'opacity', a.opacity, t);
        applied++;
        break;
      }
      case 'layer': {
        const id = nodeRef(a.node);
        if (!id) {
          warnings.push(`Camada "${a.node}" não encontrada.`);
          break;
        }
        const s = scene();
        if (a.position === 'front') moveLayer(s, id, 'top');
        else if (a.position === 'back') moveLayer(s, id, 'bottom');
        else {
          const other = a.relativeTo ? nodeRef(a.relativeTo) : null;
          if (!other) {
            warnings.push(`Referência de camada "${a.relativeTo}" não encontrada.`);
            break;
          }
          s.layerOrder = s.layerOrder.filter((x) => x !== id);
          const idx = s.layerOrder.indexOf(other);
          s.layerOrder.splice(a.position === 'inFrontOf' ? idx + 1 : idx, 0, id);
        }
        applied++;
        break;
      }
      case 'action': {
        const id = nodeRef(a.node);
        if (!id) {
          warnings.push(`Elemento "${a.node}" não encontrado para a ação "${a.action}".`);
          break;
        }
        const act = cleanActionId(a.action);
        if (!COMPOSITE.has(act) && !getAction(act)) {
          warnings.push(`Ação "${a.action}" não existe; nada foi inserido para ela.`);
          break;
        }
        const targetNodeId = a.targetNode ? nodeRef(a.targetNode) : null;
        let targetX = a.targetX;
        if (targetNodeId && targetX === undefined && (act === 'walk' || act === 'run' || act === 'enter')) {
          const target = scene().nodes[targetNodeId]!;
          targetX = target.transform.x;
        }
        insertAction(p, scene(), id, act, time(a.atMs), { durationMs: a.durationMs, targetX, targetNodeId, fromRight: a.fromRight, view: a.view as CharacterNode['bodyView'] & 'front' });
        applied++;
        break;
      }
      case 'say': {
        const id = nodeRef(a.node);
        if (!id) {
          warnings.push(`Personagem "${a.node}" não encontrado para falar.`);
          break;
        }
        addDialogue(scene(), id, a.text, time(a.atMs), a.durationMs);
        applied++;
        break;
      }
      case 'look': {
        const id = nodeRef(a.node);
        const target = nodeRef(a.target);
        const node = id ? scene().nodes[id] : undefined;
        if (!node || node.kind !== 'character' || !target) {
          warnings.push(`Não consegui fazer "${a.node}" olhar para "${a.target}".`);
          break;
        }
        if (a.atMs === undefined || a.atMs === 0) {
          node.gaze.mode = 'node';
          node.gaze.targetId = target;
          node.gaze.followHead = a.turnHead;
          if (a.turnHead) node.headView = 'auto';
        } else {
          setKeyframe(ensurePropertyTrack(scene(), id!, 'gaze.mode'), a.atMs, 'node');
          setKeyframe(ensurePropertyTrack(scene(), id!, 'gaze.targetId'), a.atMs, target);
        }
        applied++;
        break;
      }
      case 'expression': {
        const id = nodeRef(a.node);
        const node = id ? scene().nodes[id] : undefined;
        if (!node || node.kind !== 'character') {
          warnings.push(`Personagem "${a.node}" não encontrado para a expressão.`);
          break;
        }
        if (getExpression(a.expression).id !== a.expression) {
          warnings.push(`Expressão "${a.expression}" não existe.`);
          break;
        }
        if (a.atMs === undefined) node.expression = a.expression;
        else setKeyframe(ensurePropertyTrack(scene(), id!, 'expression'), a.atMs, a.expression, { interpolation: 'hold' });
        applied++;
        break;
      }
      case 'camera': {
        const at = time(a.atMs);
        const dur = a.durationMs ?? 0;
        const anim = (path: string, value: number | undefined) => {
          if (value === undefined) return;
          if (dur > 0) {
            const track = ensurePropertyTrack(scene(), CAMERA_TARGET, path);
            const base = (scene().camera as unknown as Record<string, number>)[path] ?? 0;
            const existing = track.keyframes.length ? undefined : base;
            setKeyframe(track, at, existing ?? base);
            setKeyframe(track, at + dur, value);
          } else writeProperty(scene(), CAMERA_TARGET, path, value, at);
        };
        anim('zoom', a.zoom);
        anim('x', a.x);
        anim('y', a.y);
        applied++;
        break;
      }
      case 'note':
        warnings.push(a.text);
        break;
    }
  }
  return { applied, warnings, sceneId };
}

const ACTION_LABELS: Record<string, string> = {
  walk: 'andar', run: 'correr', enter: 'entrar em cena', exit: 'sair de cena', sit: 'sentar', point: 'apontar', wave: 'acenar',
};

/** Descrição legível das alterações, mostrada antes de aplicar. */
export function describePlan(plan: Plan): string[] {
  return plan.actions.map((a) => {
    switch (a.type) {
      case 'createCharacter': return `Criar personagem "${a.name}"${a.addToScene ? ' e colocá-lo na cena' : ''}`;
      case 'updateCharacter': return `Alterar a identidade de "${a.character}" (vale para todas as cenas)`;
      case 'addCharacter': return `Colocar "${a.character}" na cena`;
      case 'createScene': return `Nova cena "${a.name}" (${getBackground(a.background ?? 'neutro').label}, ${((a.durationMs ?? 8000) / 1000).toLocaleString('pt-BR')} s)`;
      case 'setBackground': return `Trocar o cenário para ${getBackground(a.background).label}`;
      case 'setFormat': return `Mudar o formato de saída para ${a.aspect}`;
      case 'addProp': return `Adicionar objeto: ${getProp(a.prop)?.label ?? a.prop}`;
      case 'transform': return `Ajustar "${a.node}"${a.scale !== undefined ? ` · escala ${Math.round(a.scale * 100)}%` : ''}${a.x !== undefined ? ` · X ${a.x}` : ''}`;
      case 'layer': return `Camada: "${a.node}" ${a.position === 'front' ? 'para a frente de tudo' : a.position === 'back' ? 'para o fundo' : a.position === 'inFrontOf' ? `na frente de "${a.relativeTo}"` : `atrás de "${a.relativeTo}"`}`;
      case 'action': return `"${a.node}": ${ACTION_LABELS[a.action] ?? getAction(a.action)?.label ?? a.action}${a.atMs !== undefined ? ` aos ${(a.atMs / 1000).toLocaleString('pt-BR')} s` : ''}`;
      case 'say': return `"${a.node}" fala: “${a.text}”`;
      case 'look': return `"${a.node}" olha para "${a.target}"${a.turnHead ? ' e vira a cabeça' : ''}`;
      case 'expression': return `"${a.node}": expressão ${getExpression(a.expression).label}${a.atMs !== undefined ? ` aos ${(a.atMs / 1000).toLocaleString('pt-BR')} s` : ''}`;
      case 'camera': return `Câmera${a.zoom !== undefined ? ` · zoom ${Math.round(a.zoom * 100)}%` : ''}${a.durationMs ? ` em ${(a.durationMs / 1000).toLocaleString('pt-BR')} s` : ''}`;
      case 'note': return `Observação: ${a.text}`;
    }
  });
}

/** Tabela compacta de IDs válidos, enviada ao modelo como contexto. */
export function planVocabulary(): string {
  return JSON.stringify({
    backgrounds: BACKGROUNDS.map((b) => b.id),
    expressions: EXPRESSIONS.map((e) => e.id),
    aspects: ASPECT_PRESETS.map((a) => a.id),
  });
}

export const newPlanId = () => uid('plan');
