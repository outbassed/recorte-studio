/**
 * Corpos-base e poses. Os corpos são personagens com proporções diferentes e ROUPA NEUTRA (camiseta e bermuda cinza):
 * o app não desenha corpo sem roupa, então não há nudez nem manequim sem proteção. As poses usam o rig humano padrão
 * (mesmos ângulos de articulação do motor), valem para qualquer personagem e vista.
 */
import type { PackSource } from '../lib';
import { AUTHOR, LICENSE_ORIGINAL } from '../lib';
import { character, pose } from '../dsl';

const NEUTRAL = { skin: '#cdd2d8', outfit: { top: 'tshirt', topColor: '#9aa3ad', bottom: 'shorts', bottomColor: '#6b7684', shoes: 'sneakers', shoeColor: '#4a5360' }, hair: { style: 'bald', color: '#6b7684' }, face: { headShape: 'oval', eyes: 'round', brows: 'soft', nose: 'button', mouth: 'simple' } };
const body = (id: string, name: string, sub: string, desc: string, b: Record<string, number | string>, tags: string[] = []) =>
  character({ id: `rs-corpo-${id}`, name, sub, tags: ['corpo-base', ...tags], desc, def: { ...NEUTRAL, body: b as never } });

const corpos = () => [
  body('magro', 'Corpo magro', 'Biotipos', 'Corpo esguio, ombros estreitos. Aplique roupas, cabelos e cores.', { age: 'adult', build: 0.7, shoulders: 0.85 }, ['magro']),
  body('medio', 'Corpo médio', 'Biotipos', 'Proporção média: é também o corpo adulto padrão e o ponto de partida para a maioria dos personagens.', { age: 'adult', build: 1 }, ['médio', 'adulto']),
  body('robusto', 'Corpo robusto', 'Biotipos', 'Mais largo e encorpado, com um pouco de barriga.', { age: 'adult', build: 1.25, belly: 0.4 }, ['robusto']),
  body('musculoso', 'Corpo musculoso', 'Biotipos', 'Ombros largos e braços longos, cintura mais fina.', { age: 'adult', build: 1.15, shoulders: 1.4, armLength: 1.1 }, ['musculoso', 'forte']),
  body('corpulento', 'Corpo corpulento', 'Biotipos', 'Bem largo, com barriga pronunciada.', { age: 'adult', build: 1.5, belly: 1.0, shoulders: 1.1 }, ['corpulento', 'gordo']),
  body('atletico', 'Corpo atlético', 'Biotipos', 'Alto, ombros largos e pernas longas.', { age: 'adult', height: 1.08, build: 0.95, shoulders: 1.25, legLength: 1.1 }, ['atlético']),
  body('esguio-alto', 'Corpo alto e esguio', 'Biotipos', 'Muito alto e fino, pernas e tronco longos.', { age: 'adult', height: 1.25, build: 0.65, legLength: 1.2, torsoLength: 1.1 }, ['alto']),
  body('baixo-largo', 'Corpo baixo e largo', 'Biotipos', 'Baixo e encorpado, pernas curtas.', { age: 'adult', height: 0.82, build: 1.3, legLength: 0.85 }, ['baixo']),
  body('infantil', 'Corpo infantil', 'Idades', 'Proporção de criança: cabeça grande, corpo pequeno.', { age: 'child', height: 1, build: 0.9 }, ['criança']),
  body('adolescente', 'Corpo adolescente', 'Idades', 'Proporção de adolescente, mais alto e esguio.', { age: 'teen', height: 1.08, build: 0.92 }, ['adolescente']),
  body('idoso', 'Corpo idoso', 'Idades', 'Mais baixo e curvado, com a barriga um pouco maior.', { age: 'elder', height: 0.92, build: 1.05, belly: 0.3 }, ['idoso']),
  body('cabecudo', 'Corpo cabeçudo', 'Proporções', 'Cabeça muito maior que o corpo (estilo cartum).', { age: 'adult', height: 0.85, build: 0.9, headWidth: 1.45, headHeight: 1.4 }, ['cabeçudo', 'cartum']),
  body('caricatural', 'Corpo caricatural', 'Proporções', 'Cabeça pequena, corpo e braços enormes.', { age: 'adult', build: 1.4, shoulders: 1.5, armLength: 1.25, headWidth: 0.8, headHeight: 0.85 }, ['caricatura']),
  body('chibi', 'Corpo chibi', 'Proporções', 'Cabeça gigante e corpo minúsculo.', { age: 'child', height: 0.75, build: 0.8, headWidth: 1.6, headHeight: 1.55 }, ['chibi', 'cartum']),
  body('pernalonga', 'Corpo pernalonga', 'Proporções', 'Pernas muito longas e tronco curto.', { age: 'adult', height: 1.2, build: 0.75, legLength: 1.65, torsoLength: 0.75 }, ['pernas longas']),
  body('bracos-longos', 'Corpo de braços longos', 'Proporções', 'Braços compridos até os joelhos.', { age: 'adult', build: 0.95, armLength: 1.45 }, ['braços longos']),
  body('barrigudo', 'Corpo barrigudo', 'Proporções', 'Barriga grande e pernas finas.', { age: 'adult', build: 1.1, belly: 1.3, legLength: 0.95 }, ['barrigudo']),
];

const POSES = () => [
  pose({ id: 'rs-pose-continencia', name: 'Continência', rig: { armRUpper: 100, armRLower: 140 }, tags: ['gesto', 'militar'] }),
  pose({ id: 'rs-pose-coracao', name: 'Mão no coração', rig: { armLUpper: 25, armLLower: 130 }, tags: ['gesto', 'emoção'] }),
  pose({ id: 'rs-pose-chamando', name: 'Chamando com a mão', rig: { armLUpper: 70, armLLower: 45 }, tags: ['gesto'] }),
  pose({ id: 'rs-pose-pare', name: 'Mão em "pare"', rig: { armRUpper: 95, armRLower: 4 }, tags: ['gesto'] }),
  pose({ id: 'rs-pose-soco-ar', name: 'Punho para cima', rig: { armRUpper: 160, armRLower: 10 }, handR: 'fist', tags: ['gesto', 'comemoração'] }),
  pose({ id: 'rs-pose-ola-duplo', name: 'Acenando com as duas mãos', rig: { armLUpper: 135, armLLower: 30, armRUpper: 135, armRLower: 30 }, tags: ['gesto'] }),
  pose({ id: 'rs-pose-bracos-abertos', name: 'Braços abertos', rig: { armLUpper: 85, armRUpper: 85 }, tags: ['gesto', 'recepção'] }),
  pose({ id: 'rs-pose-abracando', name: 'Abraçando', rig: { armLUpper: 70, armLLower: 75, armRUpper: 70, armRLower: 75 }, tags: ['gesto', 'carinho'] }),
  pose({ id: 'rs-pose-correndo', name: 'Correndo', rig: { legLUpper: 42, legLLower: -8, legRUpper: -30, legRLower: 62, armLUpper: -45, armLLower: 70, armRUpper: 55, armRLower: 70, torsoLean: 10, bodyY: -6 }, tags: ['ação', 'esporte'] }),
  pose({ id: 'rs-pose-andando-rapido', name: 'Andando depressa', rig: { legLUpper: 26, legRUpper: -22, legRLower: 24, armLUpper: -24, armRUpper: 24, armRLower: 20, torsoLean: 5 }, tags: ['ação'] }),
  pose({ id: 'rs-pose-pulando', name: 'Pulando', rig: { legLUpper: 30, legLLower: 55, legRUpper: 30, legRLower: 55, armLUpper: 150, armRUpper: 150, bodyY: -50 }, tags: ['ação', 'comemoração'] }),
  pose({ id: 'rs-pose-chutando', name: 'Chutando', rig: { legRUpper: 75, legRLower: 0, legLUpper: -6, armLUpper: 60, armRUpper: -30, torsoLean: -8 }, tags: ['ação', 'futebol'] }),
  pose({ id: 'rs-pose-dancando', name: 'Dançando', rig: { armLUpper: 150, armLLower: 25, armRUpper: 40, armRLower: 60, legLUpper: 14, legRUpper: -10, legRLower: 20, headTilt: 8, torsoLean: -4 }, tags: ['ação', 'festa'] }),
  pose({ id: 'rs-pose-guarda-boxe', name: 'Guarda de boxe', rig: { armLUpper: 55, armLLower: 120, armRUpper: 55, armRLower: 120, torsoLean: 4 }, handL: 'fist', handR: 'fist', tags: ['ação', 'luta'] }),
  pose({ id: 'rs-pose-soco', name: 'Dando um soco', rig: { armRUpper: 88, armRLower: 0, armLUpper: 50, armLLower: 115, torsoLean: 8 }, handL: 'fist', handR: 'fist', tags: ['ação', 'luta'] }),
  pose({ id: 'rs-pose-ajoelhado', name: 'Ajoelhado', rig: { sit: 0.85, torsoLean: 2, armLUpper: 20, armRUpper: 20 }, tags: ['ação'] }),
  pose({ id: 'rs-pose-cansado', name: 'Cansado', rig: { torsoLean: 14, headNod: 16, armLUpper: 8, armLLower: 14, armRUpper: 8, armRLower: 14, bodyY: 4 }, tags: ['emoção'] }),
  pose({ id: 'rs-pose-triste', name: 'Triste', rig: { headNod: 20, torsoLean: 6, armLUpper: 4, armRUpper: 4 }, tags: ['emoção'] }),
  pose({ id: 'rs-pose-bravo', name: 'Bravo, punhos cerrados', rig: { armLUpper: 14, armLLower: 28, armRUpper: 14, armRLower: 28, headNod: 6, torsoLean: 4 }, handL: 'fist', handR: 'fist', tags: ['emoção'] }),
  pose({ id: 'rs-pose-timido', name: 'Tímido', rig: { armLUpper: 22, armLLower: 105, armRUpper: 22, armRLower: 105, headNod: 12, headTilt: -6 }, tags: ['emoção'] }),
  pose({ id: 'rs-pose-orando', name: 'Mãos juntas', rig: { armLUpper: 42, armLLower: 138, armRUpper: 42, armRLower: 138, headNod: 8 }, tags: ['gesto', 'religioso'] }),
  pose({ id: 'rs-pose-bandeja', name: 'Segurando bandeja', rig: { armRUpper: 75, armRLower: 105, armLUpper: -18 }, tags: ['trabalho', 'garçom'] }),
  pose({ id: 'rs-pose-telefone', name: 'Ao telefone', rig: { armRUpper: 38, armRLower: 150, headTilt: -5 }, tags: ['trabalho', 'celular'] }),
  pose({ id: 'rs-pose-lendo', name: 'Lendo', rig: { armLUpper: 42, armLLower: 105, armRUpper: 42, armRLower: 105, headNod: 14 }, tags: ['escola', 'livro'] }),
  pose({ id: 'rs-pose-digitando', name: 'Sentado digitando', rig: { sit: 1, armLUpper: 40, armLLower: 85, armRUpper: 40, armRLower: 85, headNod: 8 }, tags: ['trabalho', 'computador'] }),
  pose({ id: 'rs-pose-dirigindo', name: 'Dirigindo', rig: { sit: 1, armLUpper: 58, armLLower: 52, armRUpper: 58, armRLower: 52 }, handL: 'fist', handR: 'fist', tags: ['trabalho', 'carro'] }),
  pose({ id: 'rs-pose-sentado-relax', name: 'Sentado relaxado', rig: { sit: 1, torsoLean: -6, armLUpper: 12, armRUpper: 12 }, tags: ['descanso'] }),
  pose({ id: 'rs-pose-carregando', name: 'Carregando uma caixa', rig: { armLUpper: 62, armLLower: 82, armRUpper: 62, armRLower: 82, torsoLean: -4 }, tags: ['trabalho'] }),
  pose({ id: 'rs-pose-apresentando', name: 'Apresentando', rig: { armLUpper: 105, armLLower: 12, armRUpper: 18, headTilt: 6 }, tags: ['gesto', 'palestra'] }),
  pose({ id: 'rs-pose-encolhido', name: 'Encolhido de medo', rig: { sit: 0.35, armLUpper: 80, armLLower: 130, armRUpper: 80, armRLower: 130, headNod: 14, torsoLean: 12 }, tags: ['emoção', 'medo'] }),
  pose({ id: 'rs-pose-heroi', name: 'Pose de herói', rig: { armLUpper: 42, armLLower: -95, armRUpper: 42, armRLower: -95, legLUpper: 9, legRUpper: -9, torsoLean: -3 }, handL: 'fist', handR: 'fist', tags: ['gesto', 'confiante'] }),
  pose({ id: 'rs-pose-surpreso', name: 'Surpreso, braços abertos', rig: { armLUpper: 70, armLLower: 25, armRUpper: 70, armRLower: 25, torsoLean: -6, headNod: -4 }, tags: ['emoção'] }),
  pose({ id: 'rs-pose-espreguicando', name: 'Espreguiçando', rig: { armLUpper: 172, armRUpper: 172, torsoLean: -9, headNod: -6 }, tags: ['descanso'] }),
  pose({ id: 'rs-pose-cuidado', name: 'Na ponta dos pés', rig: { legLUpper: 10, legRUpper: -12, legRLower: 14, armLUpper: 20, armRUpper: -10, torsoLean: 8, headNod: 6, bodyY: -6 }, tags: ['ação', 'sorrateiro'] }),
  pose({ id: 'rs-pose-brindando', name: 'Brindando', rig: { armRUpper: 120, armRLower: 40, armLUpper: 14 }, tags: ['festa'] }),
];

const META = { author: AUTHOR, license: LICENSE_ORIGINAL, dependencies: [] as Array<{ id: string; version: string }> };
export const BODY_POSE_SOURCES: Array<() => Promise<PackSource>> = [
  async () => ({ meta: { ...META, id: 'corpos-1', name: 'Corpos · Base 1', version: '1.0.0', category: 'Corpos', collection: 'Corpos', volume: 1, tags: ['corpo', 'base'], description: 'Dezessete corpos-base com biotipos, idades e proporções (magro, robusto, musculoso, infantil, idoso, cabeçudo, chibi…). Vêm com roupa neutra cinza: aplique roupas, cabelos e cores no Criador.' }, items: corpos() }),
  async () => ({ meta: { ...META, id: 'poses-1', name: 'Poses · Gestos e Ações 1', version: '1.0.0', category: 'Poses', collection: 'Poses', volume: 1, tags: ['pose'], description: 'Trinta e cinco poses reutilizáveis para o rig humano padrão: gestos, emoções, ações, esporte e trabalho. Selecione um personagem e aplique.' }, items: POSES() }),
];
