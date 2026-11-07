/** Fábricas com defaults válidos para todo o modelo. */
import { getBuiltinCharacter } from '../character/presets';
import { FLOOR_Y, getBackground } from '../world/backgrounds';
import { getProp } from '../world/props';
import { deepClone, uid } from './ids';
import {
  CharacterDefinitionSchema, CharacterNodeSchema, GroupNodeSchema, ImageNodeSchema, KeyframeSchema, LightNodeSchema, ProjectSchema,
  PropNodeSchema, SCHEMA_VERSION, SceneSchema, ShapeNodeSchema, TextNodeSchema,
  type CharacterDefinition, type CharacterNode, type GroupNode, type ImageNode, type Keyframe, type KeyValue, type LightNode, type Project,
  type PropNode, type Scene, type ShapeNode, type TextNode, type ViewOrAuto,
} from './schema';

export function createScene(name = 'Nova cena', durationMs = 8000, presetId = 'neutro'): Scene {
  return SceneSchema.parse({ id: uid('cena'), name, durationMs, background: { presetId } });
}

export function createProject(title = 'Meu projeto', opts: { width?: number; height?: number; aspect?: string; fps?: number } = {}): Project {
  const scene = createScene('Cena 1', 8000, 'sala');
  const now = Date.now();
  return ProjectSchema.parse({
    id: uid('proj'),
    schemaVersion: SCHEMA_VERSION,
    title,
    createdAt: now,
    updatedAt: now,
    settings: { width: opts.width ?? 1920, height: opts.height ?? 1080, aspectRatio: opts.aspect ?? '16:9', fps: opts.fps ?? 30 },
    sceneOrder: [scene.id],
    scenes: { [scene.id]: scene },
    currentSceneId: scene.id,
  });
}

/** Copia uma definição embutida para a biblioteca do projeto, se necessário. */
export function ensureBuiltinCharacter(project: Project, builtinId: string): CharacterDefinition | undefined {
  const existing = Object.values(project.characters).find((c) => c.builtinId === builtinId);
  if (existing) return existing;
  const b = getBuiltinCharacter(builtinId);
  if (!b) return undefined;
  const copy: CharacterDefinition = { ...deepClone(b), id: uid('char') };
  project.characters[copy.id] = copy;
  return copy;
}

export function newCharacterDefinition(name: string, data: Partial<CharacterDefinition> = {}): CharacterDefinition {
  return CharacterDefinitionSchema.parse({ id: uid('char'), name, ...data });
}

export function createCharacterNode(characterId: string, name: string, o: { x?: number; y?: number; scale?: number; bodyView?: ViewOrAuto; headView?: ViewOrAuto } = {}): CharacterNode {
  return CharacterNodeSchema.parse({
    id: uid('node'),
    kind: 'character',
    name,
    characterId,
    bodyView: o.bodyView ?? 'auto',
    headView: o.headView ?? 'auto',
    transform: { x: o.x ?? 0, y: o.y ?? FLOOR_Y, scaleX: o.scale ?? 1, scaleY: o.scale ?? 1 },
  });
}

export function createPropNode(propId: string, o: { x?: number; y?: number; scale?: number; colorA?: string; colorB?: string; state?: string; name?: string; backgroundOwned?: boolean } = {}): PropNode {
  const def = getProp(propId);
  return PropNodeSchema.parse({
    id: uid('node'),
    kind: 'prop',
    name: o.name ?? def?.label ?? 'Objeto',
    propId,
    colorA: o.colorA ?? '',
    colorB: o.colorB ?? '',
    state: o.state ?? def?.defaultState ?? '',
    backgroundOwned: o.backgroundOwned ?? false,
    transform: { x: o.x ?? 0, y: o.y ?? (def?.handheld ? 200 : FLOOR_Y - 40), scaleX: o.scale ?? 1, scaleY: o.scale ?? 1 },
  });
}

export const createTextNode = (text: string, o: Partial<TextNode> = {}): TextNode =>
  TextNodeSchema.parse({ id: uid('node'), kind: 'text', name: 'Texto', text, ...o });
export const createShapeNode = (shape: ShapeNode['shape'], o: Partial<ShapeNode> = {}): ShapeNode =>
  ShapeNodeSchema.parse({ id: uid('node'), kind: 'shape', name: 'Forma', shape, ...o });
export const createLightNode = (o: Partial<LightNode> = {}): LightNode =>
  LightNodeSchema.parse({ id: uid('node'), kind: 'light', name: 'Luz', ...o });
export const createImageNode = (assetId: string, name: string, width: number, height: number): ImageNode =>
  ImageNodeSchema.parse({ id: uid('node'), kind: 'image', name, assetId, width, height });
export const createGroupNode = (name: string, children: string[]): GroupNode =>
  GroupNodeSchema.parse({ id: uid('node'), kind: 'group', name, children });

export function createKeyframe(timeMs: number, value: KeyValue, o: Partial<Keyframe> = {}): Keyframe {
  return KeyframeSchema.parse({ id: uid('key'), timeMs: Math.max(0, Math.round(timeMs)), value, ...o });
}

export const backgroundSpots = (presetId: string): number[] => getBackground(presetId).spots;
