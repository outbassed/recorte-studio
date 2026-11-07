/**
 * Modelo de dados versionado do Recorte Studio (schemaVersion 1 = produto 1.0).
 *
 * Separação obrigatória:
 *  (A) CharacterDefinition  — identidade reutilizável (biblioteca do projeto)
 *  (B) CharacterNode        — instância em uma cena (posição, direção, emoção…)
 *  (C) Scene                — conteúdo independente de outras cenas
 *  (D) Project              — configurações, biblioteca interna, ordem
 *  (E) Track/Clip/Keyframe  — timeline
 *  (F) Estado de interface  — NÃO fica aqui; ver src/state/uiStore.ts
 *
 * Coordenadas: mundo com origem no CENTRO do quadro e Y para baixo. A altura do
 * quadro é sempre WORLD_HEIGHT unidades; a largura varia com a proporção. Assim
 * trocar 16:9 por 9:16 só recorta a moldura e nunca desloca os elementos.
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1;
export const WORLD_HEIGHT = 1080;
export const CAMERA_TARGET = 'camera';

const finite = z.number().finite();

export const ViewIdSchema = z.enum([
  'front',
  'front-left',
  'left',
  'back-left',
  'back',
  'back-right',
  'right',
  'front-right',
]);
export type ViewId = z.infer<typeof ViewIdSchema>;
export const ViewOrAutoSchema = z.union([ViewIdSchema, z.literal('auto')]);
export type ViewOrAuto = z.infer<typeof ViewOrAutoSchema>;

/* -------------------------------------------------------------------------- */
/* Personagem: identidade                                                      */
/* -------------------------------------------------------------------------- */

export const BodySchema = z.object({
  age: z.enum(['child', 'teen', 'adult', 'elder']).default('adult'),
  height: finite.default(1),
  build: finite.default(1),
  shoulders: finite.default(1),
  torsoLength: finite.default(1),
  armLength: finite.default(1),
  legLength: finite.default(1),
  headWidth: finite.default(1),
  headHeight: finite.default(1),
  belly: finite.default(0),
});

export const FaceSchema = z.object({
  headShape: z.string().default('oval'),
  ears: z.string().default('round'),
  eyes: z.string().default('round'),
  eyeSize: finite.default(1),
  eyeSpacing: finite.default(1),
  eyeColor: z.string().default('#2a2f3d'),
  brows: z.string().default('soft'),
  browColor: z.string().default('#3a2b28'),
  nose: z.string().default('button'),
  noseSize: finite.default(1),
  mouth: z.string().default('simple'),
  lipColor: z.string().default('#b4525c'),
  cheeks: z.boolean().default(false),
  freckles: z.boolean().default(false),
  wrinkles: z.boolean().default(false),
  lashes: z.boolean().default(false),
  mustache: z.string().default('none'),
  beard: z.string().default('none'),
  facialHairColor: z.string().default('#3a2b28'),
});

export const HairSchema = z.object({
  style: z.string().default('short'),
  color: z.string().default('#3a2b28'),
  highlight: z.string().default(''),
});

export const OutfitSchema = z.object({
  top: z.string().default('tshirt'),
  topColor: z.string().default('#5b8dbe'),
  topPattern: z.enum(['none', 'stripes', 'dots', 'floral', 'plaid']).default('none'),
  topPatternColor: z.string().default('#ffffff'),
  bottom: z.string().default('pants'),
  bottomColor: z.string().default('#3d4a66'),
  shoes: z.string().default('sneakers'),
  shoeColor: z.string().default('#2b2d3a'),
});

export const AccessorySchema = z.object({
  id: z.string(),
  color: z.string().default('#d65f5f'),
});

export const CharacterDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  builtinId: z.string().optional(),
  skin: z.string().default('#e8b48c'),
  outlineColor: z.string().default('#23202b'),
  outlineWidth: finite.default(4),
  body: BodySchema.prefault({}),
  face: FaceSchema.prefault({}),
  hair: HairSchema.prefault({}),
  outfit: OutfitSchema.prefault({}),
  accessories: z.array(AccessorySchema).default([]),
  /** Sprite importado (PNG/SVG) usado no lugar do rig: não é articulável. */
  spriteAssetId: z.string().optional(),
  notes: z.string().default(''),
  favorite: z.boolean().default(false),
});
export type CharacterDefinition = z.infer<typeof CharacterDefinitionSchema>;

export const AppearanceOverridesSchema = z
  .object({
    skin: z.string().optional(),
    hairColor: z.string().optional(),
    hairStyle: z.string().optional(),
    topColor: z.string().optional(),
    bottomColor: z.string().optional(),
    top: z.string().optional(),
    bottom: z.string().optional(),
  })
  .default({});
export type AppearanceOverrides = z.infer<typeof AppearanceOverridesSchema>;

/* -------------------------------------------------------------------------- */
/* Nós de cena                                                                 */
/* -------------------------------------------------------------------------- */

export const TransformSchema = z.object({
  x: finite.default(0),
  y: finite.default(0),
  scaleX: finite.default(1),
  scaleY: finite.default(1),
  rotationDeg: finite.default(0),
  pivotX: finite.default(0),
  pivotY: finite.default(0),
});
export type Transform = z.infer<typeof TransformSchema>;

export const ShadowSchema = z.object({
  enabled: z.boolean().default(true),
  opacity: finite.default(0.28),
  blur: finite.default(6),
  offsetX: finite.default(0),
  offsetY: finite.default(0),
  size: finite.default(1),
  color: z.string().default('#0b1020'),
});

export const MaskSchema = z.object({
  enabled: z.boolean().default(false),
  kind: z.enum(['rect', 'ellipse']).default('rect'),
  x: finite.default(-200),
  y: finite.default(-200),
  width: finite.default(400),
  height: finite.default(400),
});

const baseNode = {
  id: z.string(),
  name: z.string(),
  parentId: z.string().nullable().default(null),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  transform: TransformSchema.prefault({}),
  opacity: finite.default(1),
  parallax: finite.default(1),
  blur: finite.default(0),
  shadow: ShadowSchema.prefault({}),
  mask: MaskSchema.prefault({}),
  useDepthScale: z.boolean().default(false),
  /** Item criado pelo cenário: é trocado junto quando o cenário muda. */
  backgroundOwned: z.boolean().default(false),
};

export const RigSchema = z.object({
  armLUpper: finite.default(0),
  armLLower: finite.default(0),
  armRUpper: finite.default(0),
  armRLower: finite.default(0),
  legLUpper: finite.default(0),
  legLLower: finite.default(0),
  legRUpper: finite.default(0),
  legRLower: finite.default(0),
  torsoLean: finite.default(0),
  headTilt: finite.default(0),
  headNod: finite.default(0),
  bodyY: finite.default(0),
  sit: finite.default(0),
  /** Respiração (0–1): expansão sutil do tronco, usada pelo movimento secundário. */
  breath: finite.default(0),
});
export type Rig = z.infer<typeof RigSchema>;
export type RigKey = keyof Rig;

export const GazeSchema = z.object({
  mode: z.enum(['camera', 'node', 'point', 'manual', 'none']).default('camera'),
  targetId: z.string().nullable().default(null),
  x: finite.default(0),
  y: finite.default(0),
  /** Quanto as pupilas seguem o alvo (0–1). */
  strength: finite.default(1),
  /** Cabeça acompanha o alvo; só vale com headView = auto. */
  followHead: z.boolean().default(true),
  /** 0 = não vira, 0,5 = 3/4, 1 = perfil. */
  headStrength: finite.default(0.5),
});
export type Gaze = z.infer<typeof GazeSchema>;

/** Movimento secundário: vida sutil e determinística (função do tempo). */
export const SecondaryMotionSchema = z.object({
  enabled: z.boolean().default(false),
  breathing: finite.default(0.6),
  headSway: finite.default(0.5),
  eyeDarts: finite.default(0.5),
  posture: finite.default(0.4),
});
export type SecondaryMotion = z.infer<typeof SecondaryMotionSchema>;

export const CharacterNodeSchema = z.object({
  ...baseNode,
  kind: z.literal('character'),
  characterId: z.string(),
  bodyView: ViewOrAutoSchema.default('auto'),
  headView: ViewOrAutoSchema.default('auto'),
  gaze: GazeSchema.prefault({}),
  expression: z.string().default('neutral'),
  expressionIntensity: finite.default(1),
  mouthShape: z.string().default('auto'),
  blinkMode: z.enum(['auto', 'open', 'closed']).default('auto'),
  poseId: z.string().default('idle'),
  rig: RigSchema.prefault({}),
  handL: z.enum(['open', 'fist', 'point']).default('open'),
  handR: z.enum(['open', 'fist', 'point']).default('open'),
  appearanceOverrides: AppearanceOverridesSchema,
  secondary: SecondaryMotionSchema.prefault({}),
});
export type CharacterNode = z.infer<typeof CharacterNodeSchema>;

export const PropNodeSchema = z.object({
  ...baseNode,
  kind: z.literal('prop'),
  propId: z.string(),
  colorA: z.string().default(''),
  colorB: z.string().default(''),
  state: z.string().default(''),
  /** Personagem que segura o objeto: "nodeId:L" ou "nodeId:R". */
  heldBy: z.string().default(''),
});
export type PropNode = z.infer<typeof PropNodeSchema>;

export const ImageNodeSchema = z.object({
  ...baseNode,
  kind: z.literal('image'),
  assetId: z.string(),
  width: finite.default(400),
  height: finite.default(400),
});
export type ImageNode = z.infer<typeof ImageNodeSchema>;

export const TextNodeSchema = z.object({
  ...baseNode,
  kind: z.literal('text'),
  text: z.string().default('Texto'),
  fontSize: finite.default(64),
  fontWeight: z.enum(['400', '700', '900']).default('700'),
  fontFamily: z.enum(['sans', 'serif', 'hand', 'mono']).default('sans'),
  color: z.string().default('#ffffff'),
  strokeColor: z.string().default('#23202b'),
  strokeWidth: finite.default(6),
  align: z.enum(['start', 'middle', 'end']).default('middle'),
});
export type TextNode = z.infer<typeof TextNodeSchema>;

export const ShapeNodeSchema = z.object({
  ...baseNode,
  kind: z.literal('shape'),
  shape: z.enum(['rect', 'ellipse', 'triangle', 'star', 'burst']).default('rect'),
  width: finite.default(300),
  height: finite.default(200),
  fill: z.string().default('#f2a65a'),
  stroke: z.string().default('#23202b'),
  strokeWidth: finite.default(5),
  radius: finite.default(12),
});
export type ShapeNode = z.infer<typeof ShapeNodeSchema>;

export const LightNodeSchema = z.object({
  ...baseNode,
  kind: z.literal('light'),
  width: finite.default(700),
  height: finite.default(700),
  color: z.string().default('#ffe9b0'),
  intensity: finite.default(0.55),
  blend: z.enum(['screen', 'multiply', 'normal']).default('screen'),
});
export type LightNode = z.infer<typeof LightNodeSchema>;

export const GroupNodeSchema = z.object({
  ...baseNode,
  kind: z.literal('group'),
  children: z.array(z.string()).default([]),
});
export type GroupNode = z.infer<typeof GroupNodeSchema>;

export const SceneNodeSchema = z.discriminatedUnion('kind', [
  CharacterNodeSchema,
  PropNodeSchema,
  ImageNodeSchema,
  TextNodeSchema,
  ShapeNodeSchema,
  LightNodeSchema,
  GroupNodeSchema,
]);
export type SceneNode = z.infer<typeof SceneNodeSchema>;
export type NodeKind = SceneNode['kind'];

/* -------------------------------------------------------------------------- */
/* Timeline                                                                    */
/* -------------------------------------------------------------------------- */

export const InterpolationSchema = z.enum(['hold', 'linear', 'bezier']);
export const EasingSchema = z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'backOut', 'bounceOut']);
export type Interpolation = z.infer<typeof InterpolationSchema>;
export type Easing = z.infer<typeof EasingSchema>;

export const KeyframeSchema = z.object({
  id: z.string(),
  timeMs: z.number().int().min(0),
  value: z.union([finite, z.string(), z.boolean()]),
  interpolation: InterpolationSchema.default('linear'),
  easing: EasingSchema.default('easeInOut'),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;
export type KeyValue = Keyframe['value'];

const clipBase = {
  id: z.string(),
  startMs: z.number().int().min(0),
  durationMs: z.number().int().min(1),
};

export const ActionClipSchema = z.object({
  ...clipBase,
  kind: z.literal('action'),
  action: z.string(),
  label: z.string().default(''),
  intensity: finite.default(1),
  speed: finite.default(1),
  /** Lado do braço para gestos: auto escolhe o braço voltado ao alvo. */
  side: z.enum(['auto', 'L', 'R']).default('auto'),
  easing: EasingSchema.default('easeInOut'),
  /** Transição de entrada e saída; ausente usa o padrão da ação. */
  blendMs: z.number().int().min(0).max(5000).optional(),
});
export type ActionClip = z.infer<typeof ActionClipSchema>;

export const LipSyncModeSchema = z.enum(['text', 'amplitude', 'manual', 'off']);

export const DialogueClipSchema = z.object({
  ...clipBase,
  kind: z.literal('dialogue'),
  text: z.string().default(''),
  showBubble: z.boolean().default(true),
  showSubtitle: z.boolean().default(false),
  bubbleStyle: z.string().default('speech'),
  bubbleOffsetX: finite.default(0),
  bubbleOffsetY: finite.default(0),
  bubbleScale: finite.default(1),
  lipSync: LipSyncModeSchema.default('text'),
  /** Clip de áudio cuja amplitude comanda a boca no modo "amplitude". */
  audioClipId: z.string().nullable().default(null),
  sensitivity: finite.default(1),
});
export type DialogueClip = z.infer<typeof DialogueClipSchema>;

export const AudioClipSchema = z.object({
  ...clipBase,
  kind: z.literal('audio'),
  assetId: z.string(),
  offsetMs: z.number().int().min(0).default(0),
  volume: finite.default(1),
  fadeInMs: z.number().int().min(0).default(0),
  fadeOutMs: z.number().int().min(0).default(0),
  /** Personagem cuja boca reage ao áudio (lip-sync por amplitude). */
  lipSyncNodeId: z.string().nullable().default(null),
  sensitivity: finite.default(1),
});
export type AudioClip = z.infer<typeof AudioClipSchema>;

export const SubtitleClipSchema = z.object({
  ...clipBase,
  kind: z.literal('subtitle'),
  text: z.string().default(''),
  position: z.enum(['bottom', 'top', 'center']).default('bottom'),
  fontSize: finite.default(46),
  color: z.string().default('#ffffff'),
  background: z.boolean().default(true),
});
export type SubtitleClip = z.infer<typeof SubtitleClipSchema>;

export const EffectClipSchema = z.object({
  ...clipBase,
  kind: z.literal('effect'),
  effect: z.enum(['shake', 'flash', 'fadeBlack', 'fadeFromBlack', 'vignette', 'tint']).default('shake'),
  intensity: finite.default(1),
  color: z.string().default('#ffffff'),
});
export type EffectClip = z.infer<typeof EffectClipSchema>;

const trackBase = {
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  locked: z.boolean().default(false),
  muted: z.boolean().default(false),
  solo: z.boolean().default(false),
};

export const PropertyTrackSchema = z.object({
  ...trackBase,
  type: z.literal('property'),
  targetNodeId: z.string(),
  propertyPath: z.string(),
  keyframes: z.array(KeyframeSchema).default([]),
});
export type PropertyTrack = z.infer<typeof PropertyTrackSchema>;

export const ActionTrackSchema = z.object({
  ...trackBase,
  type: z.literal('action'),
  targetNodeId: z.string(),
  clips: z.array(ActionClipSchema).default([]),
});
export type ActionTrack = z.infer<typeof ActionTrackSchema>;

export const DialogueTrackSchema = z.object({
  ...trackBase,
  type: z.literal('dialogue'),
  targetNodeId: z.string(),
  clips: z.array(DialogueClipSchema).default([]),
});
export type DialogueTrack = z.infer<typeof DialogueTrackSchema>;

export const AudioTrackSchema = z.object({
  ...trackBase,
  type: z.literal('audio'),
  role: z.enum(['dialogue', 'voice', 'music', 'sfx', 'ambient']).default('sfx'),
  clips: z.array(AudioClipSchema).default([]),
});
export type AudioTrack = z.infer<typeof AudioTrackSchema>;

export const SubtitleTrackSchema = z.object({
  ...trackBase,
  type: z.literal('subtitle'),
  clips: z.array(SubtitleClipSchema).default([]),
});
export type SubtitleTrack = z.infer<typeof SubtitleTrackSchema>;

export const EffectTrackSchema = z.object({
  ...trackBase,
  type: z.literal('effect'),
  clips: z.array(EffectClipSchema).default([]),
});
export type EffectTrack = z.infer<typeof EffectTrackSchema>;

export const TrackSchema = z.discriminatedUnion('type', [
  PropertyTrackSchema,
  ActionTrackSchema,
  DialogueTrackSchema,
  AudioTrackSchema,
  SubtitleTrackSchema,
  EffectTrackSchema,
]);
export type Track = z.infer<typeof TrackSchema>;
export type TrackType = Track['type'];
export type AnyClip = ActionClip | DialogueClip | AudioClip | SubtitleClip | EffectClip;

/* -------------------------------------------------------------------------- */
/* Cena e projeto                                                              */
/* -------------------------------------------------------------------------- */

export const BackgroundSchema = z.object({
  presetId: z.string().default('sala'),
  variant: z.enum(['day', 'night']).default('day'),
  tone: z.enum(['normal', 'light', 'dark']).default('normal'),
  primary: z.string().default(''),
  secondary: z.string().default(''),
  floor: z.string().default(''),
  /** Parallax do fundo: 0 = infinito, 1 = acompanha a câmera. */
  parallax: finite.default(0.55),
  blur: finite.default(0),
  transparent: z.boolean().default(false),
  /** Horário de um cenário personalizado (presetId = "custom:<id>"). */
  timeOfDay: z.enum(['morning', 'day', 'afternoon', 'sunset', 'night']).optional(),
});
export type Background = z.infer<typeof BackgroundSchema>;

export const CameraSchema = z.object({
  x: finite.default(0),
  y: finite.default(0),
  zoom: finite.default(1),
  rotationDeg: finite.default(0),
  followNodeId: z.string().nullable().default(null),
  followStrength: finite.default(0),
  followSmoothMs: finite.default(400),
});
export type Camera = z.infer<typeof CameraSchema>;

export const TransitionSchema = z.object({
  kind: z.enum(['cut', 'fade', 'crossfade', 'wipe', 'slide']).default('cut'),
  durationMs: z.number().int().min(0).default(500),
});
export type Transition = z.infer<typeof TransitionSchema>;

export const PerspectiveSchema = z.object({
  enabled: z.boolean().default(false),
  /** Y do mundo em que a escala é 100%. */
  refY: finite.default(420),
  /** Variação de escala por unidade de Y. */
  strength: finite.default(0.0012),
});

export const SceneSchema = z.object({
  id: z.string(),
  name: z.string(),
  durationMs: z.number().int().min(100),
  background: BackgroundSchema.prefault({}),
  camera: CameraSchema.prefault({}),
  perspective: PerspectiveSchema.prefault({}),
  nodes: z.record(z.string(), SceneNodeSchema).default({}),
  /** Nós raiz, do FUNDO (índice 0) para a FRENTE (último). */
  layerOrder: z.array(z.string()).default([]),
  tracks: z.array(TrackSchema).default([]),
  transitionIn: TransitionSchema.prefault({}),
  transitionOut: TransitionSchema.prefault({}),
  notes: z.string().default(''),
  thumbnailCacheKey: z.string().default(''),
});
export type Scene = z.infer<typeof SceneSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  kind: z.enum(['image', 'svg', 'audio']),
  name: z.string(),
  mime: z.string(),
  size: z.number().min(0),
  width: finite.optional(),
  height: finite.optional(),
  durationMs: finite.optional(),
  /** Picos normalizados (0–1) a cada PEAK_WINDOW_MS, para onda e lip-sync. */
  peaks: z.array(finite).optional(),
  createdAt: z.number().default(0),
  /** Biblioteca de áudio: voz, música, efeitos ou ambiente. */
  category: z.enum(['voice', 'music', 'sfx', 'ambient']).optional(),
  /** SHA-256 do conteúdo, quando conhecido. */
  hash: z.string().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const TIMES_OF_DAY = ['morning', 'day', 'afternoon', 'sunset', 'night'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

export const CustomVariantSchema = z.object({
  assetId: z.string(),
  fit: z.enum(['cover', 'contain']).default('cover'),
});

/** Cenário do usuário: qualquer subconjunto de horários, cada um com a própria imagem. */
export const CustomBackgroundSchema = z.object({
  id: z.string(),
  name: z.string(),
  variants: z.object({
    morning: CustomVariantSchema.optional(),
    day: CustomVariantSchema.optional(),
    afternoon: CustomVariantSchema.optional(),
    sunset: CustomVariantSchema.optional(),
    night: CustomVariantSchema.optional(),
  }).prefault({}),
  createdAt: z.number().default(0),
});
export type CustomBackground = z.infer<typeof CustomBackgroundSchema>;

export const SettingsSchema = z.object({
  width: z.number().int().min(16).default(1920),
  height: z.number().int().min(16).default(1080),
  fps: z.number().int().min(1).max(120).default(30),
  aspectRatio: z.string().default('16:9'),
  backgroundColor: z.string().default('#14161c'),
  audioSampleRate: z.number().int().default(48000),
  paperTexture: finite.default(0.35),
  masterVolume: finite.default(1),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  format: z.literal('recorte-studio').default('recorte-studio'),
  schemaVersion: z.literal(SCHEMA_VERSION),
  title: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  settings: SettingsSchema.prefault({}),
  sceneOrder: z.array(z.string()),
  scenes: z.record(z.string(), SceneSchema),
  characters: z.record(z.string(), CharacterDefinitionSchema).default({}),
  assets: z.record(z.string(), AssetSchema).default({}),
  customBackgrounds: z.record(z.string(), CustomBackgroundSchema).default({}),
  currentSceneId: z.string().nullable().default(null),
  metadata: z
    .object({
      importedFrom: z.string().optional(),
      archived: z.boolean().default(false),
      description: z.string().default(''),
    })
    .prefault({}),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ASPECT_PRESETS: Array<{ id: string; label: string; w: number; h: number }> = [
  { id: '16:9', label: '16:9 Horizontal', w: 1920, h: 1080 },
  { id: '9:16', label: '9:16 Vertical', w: 1080, h: 1920 },
  { id: '1:1', label: '1:1 Quadrado', w: 1080, h: 1080 },
  { id: '4:3', label: '4:3 Clássico', w: 1440, h: 1080 },
  { id: '3:4', label: '3:4 Retrato', w: 1080, h: 1440 },
];

/** Dimensão do quadro exportável em unidades de mundo. */
export function frameSize(settings: Pick<Settings, 'width' | 'height'>): { w: number; h: number } {
  return { w: (settings.width / settings.height) * WORLD_HEIGHT, h: WORLD_HEIGHT };
}

export function validateProject(data: unknown): Project {
  return ProjectSchema.parse(data);
}
