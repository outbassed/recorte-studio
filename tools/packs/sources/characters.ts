/**
 * Personagens pré-prontos do Recorte Studio: definições completas do Criador de Personagens (8 vistas, rig humano,
 * rosto, cabelo, roupa e acessórios). São indivíduos originais e fictícios, não retratam pessoas reais.
 * Corpos-base (roupa neutra) ficam em corpos.ts.
 */
import type { PackSource } from '../lib';
import { AUTHOR, LICENSE_ORIGINAL } from '../lib';
import { character, type Ch } from '../dsl';

const SKIN = ['#fbe0c8', '#f2c9a5', '#e8b48c', '#d49a6e', '#b97f55', '#9a6443', '#7a4a30', '#5a3524', '#3f261b'];
const HAIR = { preto: '#17141a', cast: '#3a2b28', cast2: '#5c3b28', mel: '#8a5a33', louro: '#c58a45', loiro: '#e6c478', ruivo: '#b5502f', grisalho: '#cfcdc8', branco: '#f4f1ea' };
export const HC = HAIR;
type Age = 'child' | 'teen' | 'adult' | 'elder';
interface X { fn?: Record<string, number>; sk?: string; f?: Partial<Record<'h' | 'e' | 'br' | 'n' | 'm' | 'ear' | 'mu' | 'be' | 'lip' | 'eye' | 'brc' | 'fc', string>>; fl?: Array<'fr' | 'ch' | 'la' | 'wr'>; b?: Record<string, number>; a?: Array<[string, string]>; t?: string[]; d?: string; hl?: string }

/**
 * Uma linha = um personagem. [idade, índice de pele (0 clara … 8 escura), altura, corpo], cabelo [estilo, cor],
 * de cima [roupa, cor, estampa?, cor da estampa?], de baixo [roupa, cor], sapato [tipo, cor].
 */
const P = (id: string, name: string, sub: string, ab: [Age, number, number, number], hair: [string, string], top: [string, string, string?, string?], bottom: [string, string], shoes: [string, string], x: X = {}): ReturnType<typeof character> => {
  const f = x.f ?? {};
  const c: Ch = {
    id: `rs-${id}`, name, sub, tags: [{ child: 'criança', teen: 'adolescente', adult: 'adulto', elder: 'idoso' }[ab[0]], ...(x.t ?? [])], desc: x.d,
    def: {
      skin: x.sk ?? SKIN[ab[1]], body: { age: ab[0], height: ab[2], build: ab[3], ...x.b },
      face: {
        headShape: f.h ?? 'oval', eyes: f.e ?? 'round', brows: f.br ?? 'soft', nose: f.n ?? 'button', mouth: f.m ?? 'simple', ears: f.ear ?? 'round',
        mustache: f.mu ?? 'none', beard: f.be ?? 'none', lipColor: f.lip ?? '#b4525c', eyeColor: f.eye ?? '#2a2f3d', browColor: f.brc ?? hair[1], facialHairColor: f.fc ?? hair[1],
        ...x.fn, freckles: !!x.fl?.includes('fr'), cheeks: !!x.fl?.includes('ch'), lashes: !!x.fl?.includes('la'), wrinkles: !!x.fl?.includes('wr'),
      },
      hair: { style: hair[0], color: hair[1], highlight: x.hl ?? '' },
      outfit: { top: top[0], topColor: top[1], topPattern: (top[2] ?? 'none') as 'none', topPatternColor: top[3] ?? '#ffffff', bottom: bottom[0], bottomColor: bottom[1], shoes: shoes[0], shoeColor: shoes[1] },
      accessories: x.a,
    },
  };
  return character(c);
};

const META = { author: AUTHOR, license: LICENSE_ORIGINAL, collection: 'Personagens', tags: ['personagem', 'pré-pronto'], dependencies: [] as Array<{ id: string; version: string }> };

/* ------------------------------ crianças ------------------------------ */
const criancas = () => [
  P('crianca-pedro', 'Pedro', 'Crianças', ['child', 2, 1, 0.95], ['messy', HAIR.cast2], ['tshirt', '#e98f4e', 'stripes', '#f4f1ea'], ['shorts', '#3d4a66'], ['sneakers', '#f4f1ea'], { f: { h: 'round', e: 'big', n: 'upturned', m: 'cute' }, fl: ['fr', 'ch'], t: ['menino'] }),
  P('crianca-julia', 'Júlia', 'Crianças', ['child', 3, 1, 0.9], ['pigtails', HAIR.cast], ['tshirt', '#d27ba6', 'dots', '#f4f1ea'], ['skirt', '#8e6fc1'], ['sneakers', '#f4f1ea'], { f: { h: 'heart', e: 'big', n: 'small', m: 'cute' }, fl: ['ch', 'la'], t: ['menina'] }),
  P('crianca-davi', 'Davi', 'Crianças', ['child', 6, 1.02, 0.95], ['curly', HAIR.preto], ['hoodie', '#5b8dbe'], ['shorts', '#2b2d3a'], ['sneakers', '#d65f5f'], { f: { h: 'round', e: 'round', n: 'button', m: 'wide' }, fl: ['ch'], t: ['menino'] }),
  P('crianca-alice', 'Alice', 'Crianças', ['child', 1, 0.98, 0.88], ['bob', HAIR.loiro], ['dress', '#f2c95c', 'floral', '#d65f5f'], ['skirt', '#f2c95c'], ['sandals', '#7c5a44'], { f: { h: 'oval', e: 'big', n: 'small', m: 'cute', eye: '#4e7bd0' }, fl: ['ch', 'la'], t: ['menina'] }),
  P('crianca-miguel', 'Miguel', 'Crianças', ['child', 4, 1.05, 1], ['short', HAIR.preto], ['tshirt', '#6dad6f'], ['jeans', '#3d5a86'], ['sneakers', '#2b2d3a'], { f: { h: 'square', e: 'round', br: 'thick', n: 'round', m: 'simple' }, t: ['menino'] }),
  P('crianca-laura', 'Laura', 'Crianças', ['child', 7, 1, 0.9], ['puffs', HAIR.preto], ['tshirt', '#f2c95c', 'stripes', '#d65f5f'], ['skirt', '#3d4a66'], ['sneakers', '#f4f1ea'], { f: { h: 'round', e: 'big', n: 'small', m: 'cute' }, fl: ['ch', 'la'], t: ['menina'] }),
  P('crianca-theo', 'Théo', 'Crianças', ['child', 0, 0.97, 0.92], ['sidepart', HAIR.louro], ['shirt', '#f4f1ea'], ['shorts', '#3d4a66'], ['dress', '#2b2d3a'], { f: { h: 'oval', e: 'oval', n: 'pointy', m: 'thin', eye: '#4e7bd0' }, a: [['bowtie', '#d65f5f']], t: ['menino', 'elegante'] }),
  P('crianca-sofia', 'Sofia', 'Crianças', ['child', 2, 0.96, 0.9], ['braids', HAIR.cast2], ['sweater', '#8e6fc1'], ['jeans', '#324451'], ['boots', '#7c5a44'], { f: { h: 'heart', e: 'almond', n: 'button', m: 'full' }, fl: ['ch'], t: ['menina'] }),
  P('crianca-enzo', 'Enzo', 'Crianças', ['child', 3, 1.04, 1.05], ['spiky', HAIR.cast], ['tshirt', '#d65f5f', 'stripes', '#f4f1ea'], ['shorts', '#324451'], ['sneakers', '#f2c95c'], { f: { h: 'pear', e: 'wide', br: 'thick', n: 'wide', m: 'wide' }, fl: ['fr'], t: ['menino', 'travesso'] }),
  P('crianca-manu', 'Manuela', 'Crianças', ['child', 5, 0.99, 0.9], ['curlylong', HAIR.preto], ['dress', '#58a59a'], ['skirt', '#58a59a'], ['sandals', '#f2c95c'], { f: { h: 'round', e: 'big', n: 'small', m: 'cute' }, fl: ['ch', 'la'], a: [['headband', '#f2c95c']], t: ['menina'] }),
  P('crianca-bento', 'Bento', 'Crianças', ['child', 1, 1, 1.08], ['buzz', HAIR.louro], ['tank', '#5b8dbe'], ['shorts', '#9aa3ad'], ['sneakers', '#2b2d3a'], { f: { h: 'wide', e: 'small', n: 'bulb', m: 'wide' }, fl: ['fr'], b: { belly: 0.2 }, t: ['menino', 'gordinho'] }),
  P('crianca-helo', 'Heloísa', 'Crianças', ['child', 4, 1.01, 0.9], ['ponytail', HAIR.cast2], ['hoodie', '#d27ba6'], ['pants', '#2b2d3a'], ['sneakers', '#f4f1ea'], { f: { h: 'oval', e: 'cat', n: 'upturned', m: 'cute' }, fl: ['la'], a: [['backpack', '#5b8dbe']], t: ['menina', 'escola'] }),
  P('crianca-gael', 'Gael', 'Crianças', ['child', 8, 1.03, 0.95], ['fade', HAIR.preto], ['tshirt', '#f2c95c'], ['shorts', '#d65f5f'], ['sneakers', '#f4f1ea'], { f: { h: 'round', e: 'round', n: 'wide', m: 'wide' }, fl: ['ch'], t: ['menino'] }),
  P('crianca-yasmin', 'Yasmin', 'Crianças', ['child', 3, 0.97, 0.88], ['wavy', HAIR.preto], ['tshirt', '#6dad6f', 'dots', '#f4f1ea'], ['skirt', '#e98f4e'], ['sneakers', '#f4f1ea'], { f: { h: 'heart', e: 'big', n: 'small', m: 'lips', eye: '#5c3b28' }, fl: ['ch', 'la'], t: ['menina'] }),
];

/* ------------------------------ adolescentes ------------------------------ */
const adolescentes = () => [
  P('teen-lucas', 'Lucas', 'Adolescentes', ['teen', 2, 1.08, 0.95], ['curtains', HAIR.cast2], ['hoodie', '#2b2d3a'], ['jeans', '#324451'], ['sneakers', '#f4f1ea'], { f: { h: 'oval', e: 'oval', br: 'straight', n: 'long', m: 'simple' }, a: [['backpack', '#d65f5f']], t: ['escola'] }),
  P('teen-camila', 'Camila', 'Adolescentes', ['teen', 3, 1.04, 0.9], ['long', HAIR.cast], ['tshirt', '#f4f1ea', 'stripes', '#d65f5f'], ['jeans', '#3d5a86'], ['sneakers', '#f4f1ea'], { f: { h: 'heart', e: 'almond', br: 'arched', n: 'small', m: 'lips', lip: '#c4556a' }, fl: ['la'], a: [['earrings', '#f2c95c']] }),
  P('teen-rodrigo', 'Rodrigo', 'Adolescentes', ['teen', 6, 1.12, 1.02], ['fade', HAIR.preto], ['polo', '#d65f5f'], ['shorts', '#324451'], ['sneakers', '#f4f1ea'], { f: { h: 'square', e: 'round', br: 'thick', n: 'wide', m: 'wide' }, t: ['esporte'] }),
  P('teen-bianca', 'Bianca', 'Adolescentes', ['teen', 1, 1.03, 0.88], ['ponytail', HAIR.loiro], ['tank', '#58a59a'], ['shorts', '#3d4a66'], ['sneakers', '#f2c95c'], { f: { h: 'oval', e: 'big', n: 'upturned', m: 'cute', eye: '#4e7bd0' }, fl: ['fr', 'la'], t: ['esporte'] }),
  P('teen-felipe', 'Felipe', 'Adolescentes', ['teen', 4, 1.1, 0.96], ['messy', HAIR.cast], ['tshirt', '#6dad6f'], ['pants', '#2b2d3a'], ['sneakers', '#d65f5f'], { f: { h: 'diamond', e: 'sleepy', br: 'soft', n: 'round', m: 'simple' }, a: [['squareglasses', '#2b2d3a']], t: ['nerd'] }),
  P('teen-isabela', 'Isabela', 'Adolescentes', ['teen', 7, 1.05, 0.9], ['afro', HAIR.preto], ['sweater', '#e98f4e'], ['jeans', '#2b2d3a'], ['boots', '#7c5a44'], { f: { h: 'round', e: 'big', br: 'arched', n: 'flat', m: 'full', lip: '#8a2c3f' }, fl: ['la'], a: [['earrings', '#f4f1ea']] }),
  P('teen-vinicius', 'Vinícius', 'Adolescentes', ['teen', 0, 1.13, 0.88], ['sidepart', HAIR.ruivo], ['shirt', '#5b8dbe', 'plaid', '#f4f1ea'], ['pants', '#3d4a66'], ['dress', '#2b2d3a'], { f: { h: 'long', e: 'oval', br: 'soft', n: 'pointy', m: 'thin' }, fl: ['fr'] }),
  P('teen-ana-clara', 'Ana Clara', 'Adolescentes', ['teen', 5, 1.04, 0.92], ['braids', HAIR.preto], ['tshirt', '#8e6fc1'], ['skirt', '#2b2d3a'], ['sneakers', '#f4f1ea'], { f: { h: 'oval', e: 'cat', br: 'thin', n: 'small', m: 'cute' }, fl: ['la'], a: [['necklace', '#f2c95c']] }),
  P('teen-gustavo', 'Gustavo', 'Adolescentes', ['teen', 3, 1.14, 1.08], ['crew', HAIR.preto], ['tshirt', '#2b2d3a'], ['sweatpants', '#9aa3ad'], ['sneakers', '#f4f1ea'], { f: { h: 'wide', e: 'small', br: 'thick', n: 'bulb', m: 'wide' }, b: { shoulders: 1.1 }, t: ['esporte'] }),
  P('teen-leticia', 'Letícia', 'Adolescentes', ['teen', 2, 1.02, 0.87], ['bob', HAIR.preto], ['jacket', '#d65f5f'], ['jeans', '#3d5a86'], ['sneakers', '#f4f1ea'], { f: { h: 'heart', e: 'almond', br: 'arched', n: 'button', m: 'lips' }, fl: ['la'], a: [['sunglasses', '#2b2d3a']] }),
  P('teen-matheus', 'Matheus', 'Adolescentes', ['teen', 8, 1.15, 1], ['buzz', HAIR.preto], ['tshirt', '#f2c95c'], ['shorts', '#2b2d3a'], ['sneakers', '#f4f1ea'], { f: { h: 'square', e: 'round', br: 'straight', n: 'wide', m: 'wide' }, t: ['esporte'] }),
  P('teen-nicole', 'Nicole', 'Adolescentes', ['teen', 1, 1.03, 0.88], ['curlylong', HAIR.ruivo], ['dress', '#3d4a66', 'dots', '#f4f1ea'], ['skirt', '#3d4a66'], ['boots', '#17141a'], { f: { h: 'oval', e: 'big', n: 'upturned', m: 'full' }, fl: ['fr', 'la'], a: [['headband', '#d65f5f']] }),
  P('teen-henrique', 'Henrique', 'Adolescentes', ['teen', 4, 1.11, 0.94], ['mohawk', '#4e7bd0'], ['jacket', '#2b2d3a'], ['jeans', '#324451'], ['boots', '#2b2d3a'], { f: { h: 'pear', e: 'wide', br: 'thick', n: 'hook', m: 'wide' }, a: [['necklace', '#cfcdc8']], t: ['punk'] }),
  P('teen-marina', 'Marina', 'Adolescentes', ['teen', 3, 1.04, 0.9], ['wavy', HAIR.mel], ['longsleeve', '#58a59a'], ['jeans', '#3d5a86'], ['sneakers', '#f4f1ea'], { f: { h: 'oval', e: 'oval', br: 'soft', n: 'small', m: 'lips' }, fl: ['la'], a: [['glasses', '#7c5a44']], t: ['escola'] }),
];

/* ------------------------------ adultos ------------------------------ */
const adultos = () => [
  P('adulto-carlos', 'Carlos Mendes', 'Adultos', ['adult', 3, 1.04, 1.05], ['sidepart', HAIR.cast], ['shirt', '#f4f1ea'], ['pants', '#2b2d3a'], ['dress', '#17141a'], { f: { h: 'square', e: 'small', br: 'thick', n: 'long', m: 'simple', mu: 'thin' }, a: [['tie', '#3d4a66']], t: ['escritório'] }),
  P('adulto-patricia', 'Patrícia Rocha', 'Adultos', ['adult', 2, 1, 0.95], ['medium', HAIR.cast2], ['blazer', '#8e6fc1'], ['pants', '#2b2d3a'], ['heels', '#2b2d3a'], { f: { h: 'heart', e: 'almond', br: 'arched', n: 'small', m: 'lips', lip: '#a8473c' }, fl: ['la'], a: [['earrings', '#f2c95c']], t: ['escritório'] }),
  P('adulto-andre', 'André Souza', 'Adultos', ['adult', 5, 1.08, 1.1], ['fade', HAIR.preto], ['polo', '#58a59a'], ['jeans', '#324451'], ['sneakers', '#f4f1ea'], { f: { h: 'wide', e: 'round', br: 'thick', n: 'wide', m: 'wide', be: 'stubble' } }),
  P('adulto-renata', 'Renata Lima', 'Adultos', ['adult', 7, 1, 0.92], ['afro', HAIR.preto], ['dress', '#d65f5f'], ['skirt', '#d65f5f'], ['heels', '#17141a'], { f: { h: 'round', e: 'big', br: 'arched', n: 'flat', m: 'full', lip: '#8a2c3f' }, fl: ['la'], a: [['earrings', '#f2c95c'], ['necklace', '#f2c95c']] }),
  P('adulto-bruno', 'Bruno Alves', 'Adultos', ['adult', 1, 1.1, 1.3], ['receding', HAIR.louro], ['tshirt', '#5b8dbe', 'stripes', '#f4f1ea'], ['shorts', '#7c5a44'], ['sandals', '#7c5a44'], { f: { h: 'wide', e: 'sleepy', br: 'bushy', n: 'bulb', m: 'wide', be: 'full' }, b: { belly: 0.7 }, t: ['churrasco'] }),
  P('adulto-fernanda', 'Fernanda Costa', 'Adultos', ['adult', 4, 1.02, 0.95], ['ponytail', HAIR.preto], ['tank', '#d27ba6'], ['pants', '#2b2d3a'], ['sneakers', '#f4f1ea'], { f: { h: 'oval', e: 'cat', n: 'small', m: 'lips' }, fl: ['la'], t: ['esporte'] }),
  P('adulto-ricardo', 'Ricardo Dias', 'Adultos', ['adult', 2, 1.12, 0.85], ['slick', HAIR.preto], ['blazer', '#3d4a66'], ['pants', '#3d4a66'], ['dress', '#17141a'], { f: { h: 'long', e: 'oval', br: 'straight', n: 'pointy', m: 'thin', mu: 'pencil' }, a: [['tie', '#d65f5f'], ['watch', '#f2c95c']], t: ['executivo'] }),
  P('adulto-luciana', 'Luciana Prado', 'Adultos', ['adult', 3, 0.98, 1.1], ['curly', HAIR.cast], ['sweater', '#e98f4e'], ['jeans', '#3d5a86'], ['boots', '#7c5a44'], { f: { h: 'round', e: 'big', br: 'soft', n: 'button', m: 'full' }, fl: ['ch'], a: [['glasses', '#c75c8c']] }),
  P('adulto-marcos', 'Marcos Tavares', 'Adultos', ['adult', 6, 1.07, 1.12], ['buzz', HAIR.preto], ['longsleeve', '#2b2d3a'], ['pants', '#2b2d3a'], ['boots', '#17141a'], { f: { h: 'square', e: 'small', br: 'thick', n: 'wide', m: 'thin', be: 'goatee' }, b: { shoulders: 1.1 } }),
  P('adulto-juliana', 'Juliana Freitas', 'Adultos', ['adult', 1, 1.01, 0.9], ['long', HAIR.loiro], ['shirt', '#f4f1ea', 'plaid', '#5b8dbe'], ['jeans', '#324451'], ['sneakers', '#f4f1ea'], { f: { h: 'oval', e: 'big', n: 'upturned', m: 'lips', eye: '#4e7bd0' }, fl: ['fr', 'la'] }),
  P('adulto-eduardo', 'Eduardo Pires', 'Adultos', ['adult', 3, 1.05, 1], ['messy', HAIR.cast2], ['hoodie', '#6dad6f'], ['jeans', '#324451'], ['sneakers', '#2b2d3a'], { f: { h: 'diamond', e: 'sleepy', br: 'bushy', n: 'long', m: 'simple', be: 'stubble' }, a: [['beanie', '#2b2d3a']], t: ['casual'] }),
  P('adulto-tatiana', 'Tatiana Campos', 'Adultos', ['adult', 5, 1, 0.98], ['braids', HAIR.preto], ['tshirt', '#f2c95c'], ['longskirt', '#58a59a'], ['sandals', '#7c5a44'], { f: { h: 'heart', e: 'almond', br: 'arched', n: 'small', m: 'full' }, fl: ['la'], a: [['earrings', '#d65f5f']] }),
  P('adulto-sergio', 'Sérgio Barros', 'Adultos', ['adult', 4, 1.06, 1.15], ['baldtop', HAIR.cast], ['shirt', '#d65f5f', 'plaid', '#f4f1ea'], ['pants', '#7c5a44'], ['dress', '#5b3a24'], { f: { h: 'wide', e: 'small', br: 'thick', n: 'bulb', m: 'wide', mu: 'thick' }, b: { belly: 0.4 } }),
  P('adulto-viviane', 'Viviane Moura', 'Adultos', ['adult', 2, 1.03, 0.88], ['bun', HAIR.cast2], ['blazer', '#f4f1ea'], ['longskirt', '#2b2d3a'], ['heels', '#2b2d3a'], { f: { h: 'long', e: 'almond', br: 'thin', n: 'pointy', m: 'thin', lip: '#8a2c3f' }, a: [['squareglasses', '#2b2d3a']], t: ['escritório'] }),
  P('adulto-paulo', 'Paulo Henrique', 'Adultos', ['adult', 7, 1.09, 1.05], ['crew', HAIR.preto], ['tshirt', '#3d4a66'], ['jeans', '#324451'], ['sneakers', '#f4f1ea'], { f: { h: 'square', e: 'round', br: 'straight', n: 'wide', m: 'simple', mu: 'pencil' } }),
  P('adulto-daniela', 'Daniela Ribeiro', 'Adultos', ['adult', 3, 1, 1.15], ['wavy', HAIR.ruivo], ['dress', '#58a59a', 'floral', '#f4f1ea'], ['skirt', '#58a59a'], ['sandals', '#f2c95c'], { f: { h: 'round', e: 'big', br: 'soft', n: 'button', m: 'full' }, fl: ['ch', 'fr'], b: { belly: 0.3 } }),
  P('adulto-leandro', 'Leandro Nunes', 'Adultos', ['adult', 0, 1.1, 0.8], ['sidepart', HAIR.loiro], ['jacket', '#7c5a44'], ['jeans', '#3d5a86'], ['boots', '#5b3a24'], { f: { h: 'long', e: 'oval', br: 'soft', n: 'long', m: 'thin', be: 'chinstrap' }, a: [['scarf', '#d65f5f']], t: ['viajante'] }),
  P('adulto-simone', 'Simone Araújo', 'Adultos', ['adult', 6, 1.01, 1.05], ['medium', HAIR.preto], ['sweater', '#8e6fc1'], ['pants', '#2b2d3a'], ['sneakers', '#f4f1ea'], { f: { h: 'oval', e: 'cat', br: 'arched', n: 'flat', m: 'lips', lip: '#8a2c3f' }, fl: ['la'], a: [['glasses', '#7c5a44']] }),
  P('adulto-otavio-j', 'Otávio Junqueira', 'Adultos', ['adult', 3, 1.08, 1.0], ['curtains', HAIR.cast2], ['tshirt', '#e98f4e'], ['shorts', '#324451'], ['sandals', '#7c5a44'], { f: { h: 'diamond', e: 'round', n: 'round', m: 'wide', be: 'stubble' }, a: [['sunglasses', '#2b2d3a']], t: ['praia'] }),
  P('adulto-cristina', 'Cristina Vaz', 'Adultos', ['adult', 4, 0.99, 1.0], ['pigtails', HAIR.preto], ['hoodie', '#f2c95c'], ['jeans', '#324451'], ['sneakers', '#d65f5f'], { f: { h: 'heart', e: 'big', n: 'small', m: 'cute' }, fl: ['ch'], t: ['casual'] }),
  P('adulto-wagner', 'Wagner Lopes', 'Adultos', ['adult', 8, 1.12, 1.25], ['bald', HAIR.preto], ['tshirt', '#d65f5f'], ['shorts', '#2b2d3a'], ['sneakers', '#f4f1ea'], { f: { h: 'wide', e: 'round', br: 'thick', n: 'wide', m: 'wide', be: 'full' }, b: { shoulders: 1.2, belly: 0.3 } }),
  P('adulto-elaine', 'Elaine Martins', 'Adultos', ['adult', 2, 1, 0.9], ['bobfringe', HAIR.cast], ['longsleeve', '#d65f5f'], ['longskirt', '#3d4a66'], ['boots', '#17141a'], { f: { h: 'round', e: 'oval', br: 'soft', n: 'button', m: 'simple' }, a: [['necklace', '#f4f1ea']] }),
];

/* ------------------------------ idosos ------------------------------ */
const idosos = () => [
  P('idoso-seu-joaquim', 'Seu Joaquim', 'Idosos', ['elder', 3, 0.94, 1.1], ['baldtop', HAIR.branco], ['shirt', '#5b8dbe', 'stripes', '#f4f1ea'], ['pants', '#7c5a44'], ['dress', '#5b3a24'], { f: { h: 'wide', e: 'sleepy', br: 'bushy', n: 'bulb', m: 'simple', mu: 'walrus' }, fl: ['wr'], b: { belly: 0.5 }, a: [['glasses', '#7c5a44']] }),
  P('idoso-dona-neide', 'Dona Neide', 'Idosos', ['elder', 2, 0.88, 1.12], ['bun', HAIR.branco], ['dress', '#d27ba6', 'floral', '#f4f1ea'], ['longskirt', '#d27ba6'], ['sandals', '#7c5a44'], { f: { h: 'round', e: 'small', br: 'thin', n: 'bulb', m: 'small' }, fl: ['wr', 'ch'], b: { belly: 0.3 }, a: [['glasses', '#7c5a44'], ['necklace', '#f4f1ea']] }),
  P('idoso-vovo-zeca', 'Vovô Aurélio', 'Idosos', ['elder', 5, 0.93, 1], ['receding', HAIR.grisalho], ['sweater', '#7c5a44'], ['pants', '#2b2d3a'], ['boots', '#5b3a24'], { f: { h: 'long', e: 'sleepy', br: 'bushy', n: 'long', m: 'thin', be: 'goatee' }, fl: ['wr'], a: [['fedora', '#7c5a44']] }),
  P('idoso-vovo-iara', 'Vovó Iara', 'Idosos', ['elder', 6, 0.87, 1.05], ['curly', HAIR.branco], ['sweater', '#8e6fc1'], ['longskirt', '#2b2d3a'], ['sandals', '#7c5a44'], { f: { h: 'round', e: 'big', br: 'soft', n: 'flat', m: 'full' }, fl: ['wr', 'ch'], a: [['earrings', '#f2c95c']] }),
  P('idoso-dr-benedito', 'Seu Benedito', 'Idosos', ['elder', 7, 0.95, 0.95], ['short', HAIR.grisalho], ['polo', '#f4f1ea'], ['pants', '#3d4a66'], ['dress', '#17141a'], { f: { h: 'square', e: 'small', br: 'thick', n: 'wide', m: 'simple', mu: 'thin' }, fl: ['wr'], a: [['watch', '#9aa3ad']] }),
  P('idoso-dona-cida', 'Dona Cida', 'Idosos', ['elder', 1, 0.86, 1.2], ['medium', HAIR.grisalho], ['shirt', '#58a59a', 'dots', '#f4f1ea'], ['pants', '#2b2d3a'], ['sneakers', '#f4f1ea'], { f: { h: 'round', e: 'small', br: 'thin', n: 'round', m: 'small' }, fl: ['wr'], b: { belly: 0.5 }, a: [['glasses', '#d65f5f']] }),
  P('idoso-seu-armando', 'Seu Armando', 'Idosos', ['elder', 2, 0.96, 0.9], ['bald', HAIR.branco], ['coat', '#7c5a44'], ['pants', '#2b2d3a'], ['dress', '#17141a'], { f: { h: 'long', e: 'sleepy', br: 'bushy', n: 'hook', m: 'thin', mu: 'handlebar', fc: '#cfcdc8', brc: '#cfcdc8' }, fl: ['wr'], a: [['fedora', '#2b2d3a']] }),
  P('idoso-dona-ofelia', 'Dona Ofélia', 'Idosos', ['elder', 0, 0.88, 0.9], ['bob', HAIR.branco], ['sweater', '#58a59a'], ['longskirt', '#3d4a66'], ['boots', '#7c5a44'], { f: { h: 'heart', e: 'almond', br: 'thin', n: 'pointy', m: 'thin' }, fl: ['wr'], a: [['squareglasses', '#2b2d3a'], ['scarf', '#d65f5f']] }),
  P('idoso-seu-tonico', 'Seu Tonico', 'Idosos', ['elder', 4, 0.92, 1.18], ['baldtop', HAIR.grisalho], ['tank', '#f4f1ea'], ['shorts', '#3d5a86'], ['sandals', '#5b3a24'], { f: { h: 'wide', e: 'sleepy', br: 'bushy', n: 'bulb', m: 'wide', mu: 'thick' }, fl: ['wr'], b: { belly: 0.8 }, a: [['cap', '#d65f5f']], t: ['bonachão'] }),
  P('idoso-dona-lourdes-m', 'Dona Marlene', 'Idosos', ['elder', 5, 0.89, 1], ['puffs', HAIR.grisalho], ['dress', '#e98f4e', 'stripes', '#f4f1ea'], ['longskirt', '#e98f4e'], ['sandals', '#f2c95c'], { f: { h: 'round', e: 'big', br: 'arched', n: 'button', m: 'full' }, fl: ['wr', 'ch'], a: [['earrings', '#d65f5f']] }),
  P('idoso-prof-honorio', 'Professor Honório', 'Idosos', ['elder', 1, 0.97, 0.85], ['receding', HAIR.branco], ['blazer', '#7c5a44'], ['pants', '#3d4a66'], ['dress', '#17141a'], { f: { h: 'long', e: 'oval', br: 'bushy', n: 'long', m: 'thin', be: 'full', fc: '#f4f1ea', brc: '#cfcdc8' }, fl: ['wr'], a: [['glasses', '#2b2d3a'], ['bowtie', '#d65f5f']], t: ['sábio'] }),
  P('idoso-dona-geni', 'Dona Geni', 'Idosos', ['elder', 3, 0.87, 0.95], ['topknot', HAIR.grisalho], ['longsleeve', '#8e6fc1'], ['pants', '#2b2d3a'], ['sneakers', '#f4f1ea'], { f: { h: 'oval', e: 'small', br: 'thin', n: 'small', m: 'small' }, fl: ['wr'], a: [['necklace', '#f2c95c']] }),
];

export const CHARACTER_SOURCES_1: Array<() => Promise<PackSource>> = [
  async () => ({ meta: { ...META, id: 'personagens-criancas-1', name: 'Personagens · Crianças 1', version: '1.0.0', category: 'Personagens', volume: 1, description: 'Quatorze crianças originais, meninos e meninas de várias idades, aparências e roupas, prontas para animar nas 8 vistas.' }, items: criancas() }),
  async () => ({ meta: { ...META, id: 'personagens-adolescentes-1', name: 'Personagens · Adolescentes 1', version: '1.0.0', category: 'Personagens', volume: 1, description: 'Quatorze adolescentes originais: estudantes, esportistas e estilos variados.' }, items: adolescentes() }),
  async () => ({ meta: { ...META, id: 'personagens-adultos-1', name: 'Personagens · Adultos 1', version: '1.0.0', category: 'Personagens', volume: 1, description: 'Vinte e dois adultos originais, de escritório a casual, com corpos, rostos, cabelos e barbas variados.' }, items: adultos() }),
  async () => ({ meta: { ...META, id: 'personagens-idosos-1', name: 'Personagens · Idosos 1', version: '1.0.0', category: 'Personagens', volume: 1, description: 'Doze idosos originais, com rugas, cabelos brancos, óculos e chapéus.' }, items: idosos() }),
];
export { P as personagem, META as PERSONAGEM_META };
