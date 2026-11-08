/** Elenco original do Recorte Studio e poses reutilizáveis. */
import { CharacterDefinitionSchema, RigSchema, type CharacterDefinition, type Rig } from '../model/schema';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? Partial<T[K]> : T[K] };

const ch = (builtinId: string, name: string, data: DeepPartial<CharacterDefinition>, accessories: Array<[string, string]> = []): CharacterDefinition =>
  CharacterDefinitionSchema.parse({
    id: builtinId,
    builtinId,
    name,
    ...data,
    accessories: accessories.map(([id, color]) => ({ id, color })),
  });

export const BUILTIN_CHARACTERS: CharacterDefinition[] = [
  ch('nina', 'Nina', {
    skin: '#f2c9a5',
    body: { height: 0.96, build: 0.92, shoulders: 0.92 },
    face: { headShape: 'oval', eyes: 'big', brows: 'thin', nose: 'small', mouth: 'lips', lipColor: '#c4556a', lashes: true, freckles: true, browColor: '#3a2333' },
    hair: { style: 'bob', color: '#3a2333' },
    outfit: { top: 'sweater', topColor: '#e98f4e', bottom: 'skirt', bottomColor: '#3d4a66', shoes: 'sneakers', shoeColor: '#f4f1ea' },
  }, [['earrings', '#f2c95c']]),
  ch('zeca', 'Zeca', {
    skin: '#b97f55',
    body: { height: 1.04, build: 1, shoulders: 1.05 },
    face: { headShape: 'square', eyes: 'round', eyeSize: 0.92, brows: 'thick', nose: 'round', mouth: 'wide', ears: 'big', browColor: '#1d1a22', facialHairColor: '#1d1a22', beard: 'stubble' },
    hair: { style: 'curly', color: '#1d1a22' },
    outfit: { top: 'shirt', topColor: '#6dad6f', bottom: 'jeans', bottomColor: '#3d5a86', shoes: 'boots', shoeColor: '#6b4a33' },
  }),
  ch('dona-lurdes', 'Dona Lurdes', {
    skin: '#e8b48c',
    body: { age: 'elder', height: 0.86, build: 1.1, belly: 0.4 },
    face: { headShape: 'round', eyes: 'small', brows: 'thin', nose: 'bulb', mouth: 'small', wrinkles: true, cheeks: true, browColor: '#cfcdc8' },
    hair: { style: 'bun', color: '#d9d6cf' },
    outfit: { top: 'dress', topColor: '#8e6fc1', topPattern: 'floral', topPatternColor: '#f2c95c', shoes: 'dress', shoeColor: '#2b2d3a' },
  }, [['glasses', '#7c5a44'], ['necklace', '#f4f1ea']]),
  ch('tiao', 'Seu Tião', {
    skin: '#9a6443',
    body: { age: 'elder', height: 0.92, build: 1.28, belly: 0.9, shoulders: 1.05 },
    face: { headShape: 'wide', eyes: 'sleepy', brows: 'bushy', browColor: '#e6e3dc', nose: 'bulb', mouth: 'simple', mustache: 'walrus', facialHairColor: '#e6e3dc', wrinkles: true },
    hair: { style: 'baldtop', color: '#e6e3dc' },
    outfit: { top: 'shirt', topColor: '#f2c95c', topPattern: 'floral', topPatternColor: '#d65f5f', bottom: 'shorts', bottomColor: '#7c5a44', shoes: 'sandals', shoeColor: '#5b3a24' },
  }),
  ch('bia', 'Bia', {
    skin: '#7a4a30',
    body: { age: 'teen', height: 1, build: 0.88 },
    face: { headShape: 'heart', eyes: 'almond', brows: 'arched', nose: 'flat', mouth: 'full', lipColor: '#8a2c3f', lashes: true, browColor: '#17141a' },
    hair: { style: 'afro', color: '#17141a' },
    outfit: { top: 'hoodie', topColor: '#d27ba6', bottom: 'jeans', bottomColor: '#2b2d3a', shoes: 'sneakers', shoeColor: '#f2c95c' },
  }, [['earrings', '#f4f1ea']]),
  ch('caio', 'Caio', {
    skin: '#fbe0c8',
    body: { age: 'child', height: 1, build: 0.92 },
    face: { headShape: 'round', eyes: 'big', brows: 'short', nose: 'upturned', mouth: 'cute', freckles: true, cheeks: true, browColor: '#b5502f' },
    hair: { style: 'messy', color: '#b5502f' },
    outfit: { top: 'tshirt', topColor: '#5b8dbe', topPattern: 'stripes', topPatternColor: '#f4f1ea', bottom: 'shorts', bottomColor: '#6dad6f', shoes: 'sneakers', shoeColor: '#d65f5f' },
  }, [['backpack', '#d65f5f']]),
  ch('marta', 'Dra. Marta', {
    skin: '#d49a6e',
    body: { height: 1.02, build: 0.96 },
    face: { headShape: 'long', eyes: 'almond', brows: 'straight', nose: 'pointy', mouth: 'thin', browColor: '#17141a' },
    hair: { style: 'ponytail', color: '#17141a' },
    outfit: { top: 'scrubs', topColor: '#58a59a', bottom: 'pants', bottomColor: '#58a59a', shoes: 'sneakers', shoeColor: '#f4f1ea' },
  }, [['squareglasses', '#2b2d3a']]),
  ch('otavio', 'Otávio', {
    skin: '#f2c9a5',
    body: { height: 1.14, build: 0.82, shoulders: 0.9, legLength: 1.1 },
    face: { headShape: 'diamond', eyes: 'oval', brows: 'soft', nose: 'long', mouth: 'simple', beard: 'goatee', facialHairColor: '#5c3b28', browColor: '#5c3b28' },
    hair: { style: 'sidepart', color: '#5c3b28' },
    outfit: { top: 'blazer', topColor: '#3d4a66', bottom: 'pants', bottomColor: '#2b2d3a', shoes: 'dress', shoeColor: '#1c1d26' },
  }, [['tie', '#d65f5f']]),
  ch('rafa', 'Rafa', {
    skin: '#b97f55',
    body: { age: 'teen', height: 1.05, build: 0.94 },
    face: { headShape: 'pear', eyes: 'wide', brows: 'soft', nose: 'wide', mouth: 'wide', browColor: '#17141a' },
    hair: { style: 'mohawk', color: '#58a56d' },
    outfit: { top: 'jacket', topColor: '#2b2d3a', bottom: 'jeans', bottomColor: '#3d5a86', shoes: 'boots', shoeColor: '#2b2d3a' },
  }, [['necklace', '#cfcdc8']]),
  ch('helena', 'Helena', {
    skin: '#e8b48c',
    body: { height: 1, build: 1.08, belly: 0.2 },
    face: { headShape: 'heart', eyes: 'cat', brows: 'arched', nose: 'button', mouth: 'full', lipColor: '#b0344a', lashes: true, browColor: '#b5502f' },
    hair: { style: 'wavy', color: '#b5502f', highlight: '#e6c478' },
    outfit: { top: 'polo', topColor: '#f4f1ea', bottom: 'longskirt', bottomColor: '#6c4a8a', shoes: 'heels', shoeColor: '#d65f5f' },
  }, [['sunglasses', '#2b2d3a']]),
  ch('nuno', 'Sargento Nuno', {
    skin: '#d49a6e',
    body: { height: 1.08, build: 1.22, shoulders: 1.15, belly: 0.3 },
    face: { headShape: 'square', eyes: 'small', brows: 'thick', nose: 'hook', mouth: 'simple', mustache: 'thick', facialHairColor: '#17141a', browColor: '#17141a' },
    hair: { style: 'crew', color: '#17141a' },
    outfit: { top: 'police', topColor: '#3a5a8a', bottom: 'pants', bottomColor: '#21222c', shoes: 'boots', shoeColor: '#17141a' },
  }, [['cap', '#21222c']]),
  ch('luma', 'Luma', {
    skin: '#5a3524',
    body: { age: 'child', height: 1.08, build: 0.88 },
    face: { headShape: 'oval', eyes: 'big', brows: 'soft', nose: 'small', mouth: 'cute', cheeks: true, browColor: '#17141a' },
    hair: { style: 'braids', color: '#17141a' },
    outfit: { top: 'tank', topColor: '#f2c95c', bottom: 'skirt', bottomColor: '#d65f5f', shoes: 'sandals', shoeColor: '#7c5a44' },
  }),
];

export const getBuiltinCharacter = (id: string): CharacterDefinition | undefined =>
  BUILTIN_CHARACTERS.find((c) => c.builtinId === id);

export interface PosePreset { id: string; label: string; rig: Partial<Rig>; handL?: 'open' | 'fist' | 'point'; handR?: 'open' | 'fist' | 'point'; keywords?: string[]; limbDepth?: Partial<Record<'armL' | 'handL' | 'armR' | 'handR', 'auto' | 'front' | 'behind'>> }

export const POSES: PosePreset[] = [
  { id: 'idle', label: 'Em pé', rig: {} },
  { id: 'hands-up', label: 'Mãos para o alto', rig: { armLUpper: 150, armRUpper: 150, armLLower: 15, armRLower: 15 } },
  { id: 'arms-crossed', label: 'Braços cruzados', rig: { armLUpper: -10, armRUpper: -10, armLLower: 125, armRLower: 125 }, handL: 'fist', handR: 'fist', keywords: ['cruzado'] },
  { id: 'hips', label: 'Mãos na cintura', rig: { armLUpper: 42, armRUpper: 42, armLLower: -95, armRLower: -95 }, handL: 'fist', handR: 'fist', keywords: ['cintura'] },
  { id: 'point-L', label: 'Apontando (esq.)', rig: { armLUpper: 92, armLLower: 3 }, handL: 'point', keywords: ['apontar'] },
  { id: 'point-R', label: 'Apontando (dir.)', rig: { armRUpper: 92, armRLower: 3 }, handR: 'point' },
  { id: 'wave-L', label: 'Acenando', rig: { armLUpper: 135, armLLower: 30 }, keywords: ['acenar'] },
  { id: 'think', label: 'Pensando', rig: { armLUpper: 28, armLLower: 135, headTilt: 7 }, handL: 'fist', keywords: ['pensar'] },
  { id: 'shrug', label: 'Dando de ombros', rig: { armLUpper: 40, armLLower: 70, armRUpper: 40, armRLower: 70, headTilt: -5 }, keywords: ['ombros'] },
  { id: 'sit', label: 'Sentado', rig: { sit: 1 }, keywords: ['sentar'] },
  { id: 'sit-talk', label: 'Sentado gesticulando', rig: { sit: 1, armLUpper: 40, armLLower: 62 } },
  { id: 'crouch', label: 'Abaixado', rig: { sit: 0.62, torsoLean: 8 }, keywords: ['abaixar'] },
  { id: 'scared', label: 'Assustado', rig: { armLUpper: 60, armLLower: 105, armRUpper: 60, armRLower: 105, torsoLean: -4 } },
  { id: 'victory', label: 'Vitória', rig: { armLUpper: 165, armRUpper: 165 }, handL: 'fist', handR: 'fist' },
  { id: 'facepalm', label: 'Mão na testa', rig: { armLUpper: 42, armLLower: 142, headTilt: 10 } },
  { id: 'hands-behind-head', label: 'Mãos atrás da cabeça', rig: { armLUpper: 150, armLLower: 120, armRUpper: 150, armRLower: 120 }, keywords: ['relaxar', 'nuca'], limbDepth: { armL: 'behind', handL: 'behind', armR: 'behind', handR: 'behind' } },
  { id: 'hands-face', label: 'Mãos no rosto', rig: { armLUpper: 90, armLLower: 125, armRUpper: 90, armRLower: 125 }, keywords: ['surpresa', 'rosto'] },
  { id: 'step', label: 'Passo à frente', rig: { legLUpper: 18, legRUpper: -14, legRLower: 12, armLUpper: -14, armRUpper: 14 } },
];

export const getPose = (id: string): PosePreset | undefined => POSES.find((p) => p.id === id);

export function poseRig(id: string): Rig {
  return RigSchema.parse({ ...(getPose(id)?.rig ?? {}) });
}
