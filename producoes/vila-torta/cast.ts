/**
 * Elenco. Os sete personagens oficiais entram EXATAMENTE como exportados da biblioteca
 * (nenhum campo é alterado). Os secundários são originais e novos.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CharacterDefinitionSchema, type CharacterDefinition } from '@/engine/model/schema';
import { newCharacterDefinition } from '@/engine/model/factory';

const dir = fileURLToPath(new URL('./personagens/', import.meta.url));
export const OFFICIAL_FILES: Record<string, string> = {
  bia: 'beatriz', rafa: 'rafael', caique: 'ca-que', samuca: 'samuca', lari: 'larissa', gaivota: 'senhor-gaivota', pinote: 'doutor-pinote',
};

export function loadOfficial(): Record<string, CharacterDefinition> {
  const out: Record<string, CharacterDefinition> = {};
  for (const [key, file] of Object.entries(OFFICIAL_FILES)) {
    const j = JSON.parse(readFileSync(`${dir}${file}.biblioteca.json`, 'utf8'));
    if (j.format !== 'recorte-studio-library' || j.items?.length !== 1 || j.items[0].kind !== 'character') throw new Error(`Arquivo inesperado: ${file}`);
    out[key] = CharacterDefinitionSchema.parse(j.items[0].data);
  }
  return out;
}

type Def = Parameters<typeof newCharacterDefinition>[1];
const mk = (name: string, d: Def) => newCharacterDefinition(name, d);

/** Secundários originais (nomes e visual próprios; nada dos oficiais é copiado ou alterado). */
export function secondaryCast(): Record<string, CharacterDefinition> {
  const c: Record<string, CharacterDefinition> = {};
  c.marta = mk('Dona Marta', { skin: '#c98f6a', body: { age: 'elder', height: 0.9, build: 1.15, belly: 0.4 }, face: { headShape: 'round', eyes: 'small', brows: 'thin', nose: 'bulb', mouth: 'small', wrinkles: true, cheeks: true, browColor: '#8a8680', lashes: true }, hair: { style: 'bun', color: '#8a8680' }, outfit: { top: 'dress', topColor: '#d27ba6', topPattern: 'floral', topPatternColor: '#fff7e6', shoes: 'sandals', shoeColor: '#7c5a44' }, accessories: [{ id: 'glasses', color: '#7c5a44' }, { id: 'necklace', color: '#f2c95c' }], notes: 'Eleitora fiel do Gaivota (laranja). Secundário original.' });
  c.agenor = mk('Seu Agenor', { skin: '#a8714e', body: { age: 'elder', height: 0.98, build: 0.95 }, face: { headShape: 'long', eyes: 'sleepy', brows: 'bushy', nose: 'hook', mouth: 'wide', mustache: 'thick', facialHairColor: '#cfcdc8', browColor: '#cfcdc8', wrinkles: true }, hair: { style: 'baldtop', color: '#cfcdc8' }, outfit: { top: 'shirt', topColor: '#6a97d4', bottom: 'pants', bottomColor: '#4a4f66', shoes: 'dress', shoeColor: '#2b2d3a' }, accessories: [{ id: 'cap', color: '#3b6fb6' }], notes: 'Apoiador do Pinote (azul). Secundário original.' });
  c.motorista = mk('Motorista', { skin: '#d49a6e', body: { age: 'adult', height: 1.04, build: 1.1 }, face: { headShape: 'square', eyes: 'round', brows: 'thick', nose: 'round', mouth: 'wide', beard: 'stubble', facialHairColor: '#3a2b28', browColor: '#3a2b28' }, hair: { style: 'short', color: '#3a2b28' }, outfit: { top: 'polo', topColor: '#5b8dbe', bottom: 'jeans', bottomColor: '#3d5a86', shoes: 'sneakers', shoeColor: '#f4f1ea' }, notes: 'Dono do carro que quebra a suspensão. Secundário original.' });
  c.assessor = mk('Assessor do Gaivota', { skin: '#e8b48c', body: { age: 'adult', height: 1.08, build: 0.8, shoulders: 0.9 }, face: { headShape: 'long', eyes: 'oval', brows: 'thin', nose: 'pointy', mouth: 'thin', browColor: '#3a2b28' }, hair: { style: 'sidepart', color: '#3a2b28' }, outfit: { top: 'shirt', topColor: '#fff7e6', bottom: 'pants', bottomColor: '#2b2d3a', shoes: 'dress', shoeColor: '#1c1d26' }, accessories: [{ id: 'squareglasses', color: '#2b2d3a' }, { id: 'tie', color: '#e98f4e' }], notes: 'Assessor cansado do Gaivota. Secundário original.' });
  c.assessora = mk('Assessora do Pinote', { skin: '#b97f55', body: { age: 'adult', height: 1.02, build: 0.92 }, face: { headShape: 'heart', eyes: 'almond', brows: 'arched', nose: 'small', mouth: 'lips', lipColor: '#8a2c3f', lashes: true, browColor: '#17141a' }, hair: { style: 'ponytail', color: '#17141a' }, outfit: { top: 'blazer', topColor: '#8e6fc1', bottom: 'pants', bottomColor: '#2b2d3a', shoes: 'heels', shoeColor: '#2b2d3a' }, accessories: [{ id: 'earrings', color: '#f2c95c' }], notes: 'Assessora sensata do Pinote. Secundário original.' });
  c.apresentador = mk('Apresentador', { skin: '#d9ab76', body: { age: 'adult', height: 1.05, build: 1.0 }, face: { headShape: 'oval', eyes: 'round', brows: 'arched', nose: 'long', mouth: 'simple', browColor: '#2b2d3a' }, hair: { style: 'sidepart', color: '#2b2d3a' }, outfit: { top: 'blazer', topColor: '#4a4f66', bottom: 'pants', bottomColor: '#23232d', shoes: 'dress', shoeColor: '#1c1d26' }, accessories: [{ id: 'tie', color: '#e0b04c' }], notes: 'Mediador do debate. Secundário original.' });
  c.dono = mk('Dono da gráfica', { skin: '#e8b48c', body: { age: 'adult', height: 0.98, build: 1.2, belly: 0.5 }, face: { headShape: 'wide', eyes: 'small', brows: 'bushy', nose: 'bulb', mouth: 'wide', mustache: 'handlebar', facialHairColor: '#3a2b28', browColor: '#3a2b28' }, hair: { style: 'baldtop', color: '#3a2b28' }, outfit: { top: 'apron', topColor: '#58a56d', bottom: 'pants', bottomColor: '#3d4a66', shoes: 'boots', shoeColor: '#2b2d3a' }, notes: 'Empresário sem lado. Secundário original.' });
  c.func1 = mk('Funcionário da prefeitura A', { skin: '#9a6443', body: { age: 'adult', height: 1.06, build: 1.1, shoulders: 1.1 }, face: { headShape: 'square', eyes: 'sleepy', brows: 'thick', nose: 'wide', mouth: 'simple', browColor: '#17141a' }, hair: { style: 'crew', color: '#17141a' }, outfit: { top: 'tshirt', topColor: '#e98f4e', bottom: 'pants', bottomColor: '#3d4a66', shoes: 'boots', shoeColor: '#5b3a24' }, accessories: [{ id: 'cap', color: '#e98f4e' }], notes: 'Equipe da prefeitura. Secundário original.' });
  c.func2 = mk('Funcionário da prefeitura B', { skin: '#f0c5a0', body: { age: 'adult', height: 0.96, build: 0.85 }, face: { headShape: 'pear', eyes: 'wide', brows: 'soft', nose: 'button', mouth: 'small', browColor: '#5c3b28' }, hair: { style: 'messy', color: '#5c3b28' }, outfit: { top: 'tshirt', topColor: '#e98f4e', bottom: 'pants', bottomColor: '#3d4a66', shoes: 'boots', shoeColor: '#5b3a24' }, accessories: [{ id: 'cap', color: '#e98f4e' }], notes: 'Equipe da prefeitura. Secundário original.' });
  c.vendedor = mk('Vendedor ambulante', { skin: '#b97f55', body: { age: 'adult', height: 1.0, build: 0.95 }, face: { headShape: 'oval', eyes: 'round', brows: 'arched', nose: 'round', mouth: 'wide', mustache: 'pencil', facialHairColor: '#17141a', browColor: '#17141a' }, hair: { style: 'curly', color: '#17141a' }, outfit: { top: 'tank', topColor: '#f2c95c', bottom: 'shorts', bottomColor: '#7c5a44', shoes: 'sandals', shoeColor: '#5b3a24' }, accessories: [{ id: 'necklace', color: '#cfcdc8' }], notes: 'Vende para os dois lados. Secundário original.' });
  // Eleitores: camisetas e bonés trocam por instância (appearanceOverrides).
  const eleitores: Array<[string, string, Def]> = [
    ['e1', 'Eleitora 1', { skin: '#e8b48c', body: { age: 'adult' }, face: { headShape: 'round', eyes: 'round', mouth: 'wide', lashes: true }, hair: { style: 'wavy', color: '#5c3b28' }, outfit: { top: 'tshirt', bottom: 'jeans', shoes: 'sneakers' } }],
    ['e2', 'Eleitor 2', { skin: '#7a4a30', body: { age: 'adult', build: 1.15 }, face: { headShape: 'square', eyes: 'small', mouth: 'wide', beard: 'full', facialHairColor: '#17141a' }, hair: { style: 'crew', color: '#17141a' }, outfit: { top: 'tshirt', bottom: 'pants', shoes: 'sneakers' } }],
    ['e3', 'Eleitora 3', { skin: '#d49a6e', body: { age: 'adult', height: 0.95 }, face: { headShape: 'heart', eyes: 'almond', mouth: 'lips', lashes: true }, hair: { style: 'ponytail', color: '#b5502f' }, outfit: { top: 'tank', bottom: 'shorts', shoes: 'sandals' } }],
    ['e4', 'Eleitor 4', { skin: '#fbe0c8', body: { age: 'elder', build: 1.2, belly: 0.6 }, face: { headShape: 'wide', eyes: 'sleepy', mouth: 'simple', mustache: 'walrus', facialHairColor: '#e6e3dc', wrinkles: true }, hair: { style: 'baldtop', color: '#e6e3dc' }, outfit: { top: 'polo', bottom: 'pants', shoes: 'dress' } }],
    ['e5', 'Eleitora 5', { skin: '#5a3524', body: { age: 'adult', height: 1.02 }, face: { headShape: 'oval', eyes: 'big', mouth: 'full', lashes: true }, hair: { style: 'afro', color: '#17141a' }, outfit: { top: 'sweater', bottom: 'jeans', shoes: 'sneakers' } }],
    ['e6', 'Eleitor 6', { skin: '#b97f55', body: { age: 'adult', height: 1.08, build: 0.85 }, face: { headShape: 'long', eyes: 'oval', mouth: 'thin', mustache: 'thin', facialHairColor: '#3a2b28' }, hair: { style: 'sidepart', color: '#3a2b28' }, outfit: { top: 'shirt', bottom: 'pants', shoes: 'dress' } }],
  ];
  for (const [k, name, d] of eleitores) c[k] = mk(name, { ...d, notes: 'Figurante original (multidão).' });
  return c;
}
