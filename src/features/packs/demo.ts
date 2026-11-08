/**
 * Pacote de DEMONSTRAÇÃO, original do Recorte Studio (CC0): serve para testar instalar, desativar,
 * reativar, atualizar, remover e reimportar. Montado em memória e instalado pelo MESMO caminho
 * de um arquivo .rspack (validação, hashes e tudo).
 */
import { strToU8 } from 'fflate';
import { CustomBackgroundSchema, CustomObjectSchema, type Asset } from '@/engine/model/schema';
import { createPiece } from '@/engine/world/pieces';
import { mediaIdFor } from '@/features/library/media';
import { buildPack } from './format';

export const DEMO_PACK_ID = 'recorte.cozinha-retro';

const TILE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#f4f1ea"/><path d="M0 100H200M100 0V200" stroke="#5aa8d8" stroke-width="10"/><circle cx="100" cy="100" r="34" fill="#d65f5f"/><circle cx="0" cy="0" r="22" fill="#e0b04c"/><circle cx="200" cy="200" r="22" fill="#e0b04c"/></svg>';

export async function buildDemoPack(version = '1.0.0'): Promise<Uint8Array> {
  const tile = strToU8(TILE_SVG);
  const { id: tileId } = await mediaIdFor(tile);
  const tileAsset: Asset = { id: tileId, kind: 'svg', name: 'azulejo.svg', mime: 'image/svg+xml', size: tile.length, width: 200, height: 200, createdAt: 0 } as Asset;
  const P = createPiece;
  const pot = CustomObjectSchema.parse({
    id: 'pk_panela', name: 'Panela', width: 240, height: 150,
    pieces: [
      P('rect', { id: 'cabo-e', name: 'Cabo E', x: -130, y: -95, w: 50, h: 14, radius: 7, fill: '#23202b' }),
      P('rect', { id: 'cabo-d', name: 'Cabo D', x: 130, y: -95, w: 50, h: 14, radius: 7, fill: '#23202b' }),
      P('rect', { id: 'corpo', name: 'Corpo', x: 0, y: -60, w: 210, h: 120, radius: 18, fill: '#c9574b' }),
      P('rect', { id: 'tampa', name: 'Tampa', x: 0, y: -126, w: 220, h: 16, radius: 8, fill: '#a8473c' }),
    ],
  });
  const steam = (k: number) => [0, 1, 2].map((i) => P('ellipse', { id: `vapor-${i}`, name: `Vapor ${i + 1}`, x: -40 + i * 40 + (k % 2 ? 8 : -8), y: -210 - ((i + k) % 3) * 22, w: 34, h: 50, fill: '#ffffff', stroke: 'none', strokeWidth: 0, opacity: 0.75 }));
  const kettleBody = [
    P('ellipse', { id: 'corpo', name: 'Corpo', x: 0, y: -70, w: 200, h: 140, fill: '#4f86b5' }),
    P('rect', { id: 'bico', name: 'Bico', x: 110, y: -110, w: 70, h: 20, rotation: -30, radius: 8, fill: '#4f86b5' }),
    P('rect', { id: 'alca', name: 'Alça', x: 0, y: -160, w: 120, h: 18, radius: 9, fill: '#23202b' }),
  ];
  const kettle = CustomObjectSchema.parse({
    id: 'pk_chaleira', name: 'Chaleira', width: 260, height: 260, pieces: kettleBody,
    clips: [{ id: 'fervendo', name: 'Fervendo', mode: 'loop', frames: [0, 1, 2].map((k) => ({ id: `f${k}`, durationMs: 180, pieces: [...kettleBody, ...steam(k)] })) }],
    defaultClip: 'fervendo',
  });
  const tileObj = CustomObjectSchema.parse({
    id: 'pk_azulejo', name: 'Painel de azulejos', width: 400, height: 200,
    pieces: [P('image', { id: 'a1', name: 'Azulejo 1', assetId: tileId, x: -100, y: -100, w: 200, h: 200 }), P('image', { id: 'a2', name: 'Azulejo 2', assetId: tileId, x: 100, y: -100, w: 200, h: 200 })],
  });
  const wall = CustomBackgroundSchema.parse({
    id: 'pk_parede', name: 'Parede de azulejos',
    compositions: { day: { sky: '#f1e3c4', pieces: [
      ...[-3, -2, -1, 0, 1, 2, 3].flatMap((c) => [-1, 0].map((r) => P('image', { id: `t${c}${r}`, name: 'Azulejo', assetId: tileId, x: c * 200, y: r * 200 - 100, w: 200, h: 200 }))),
      P('rect', { id: 'bancada', name: 'Bancada', x: 0, y: 330, w: 2300, h: 220, fill: '#8c6a4f' }),
    ] } },
  });
  return buildPack(
    { id: DEMO_PACK_ID, name: 'Kit Cozinha Retrô (demonstração)', version, description: 'Pacote de exemplo original: panela, chaleira fervendo (animada), painel de azulejos e uma parede de azulejos.', author: 'Recorte Studio', license: 'CC0 1.0 — conteúdo original do Recorte Studio', category: 'Cozinha', dependencies: [] },
    [
      { id: 'panela', kind: 'object', name: 'Panela', data: { bundle: 2, object: pot, objects: [], assets: [] } },
      { id: 'chaleira', kind: 'object', name: 'Chaleira', data: { bundle: 2, object: kettle, objects: [], assets: [] } },
      { id: 'azulejos', kind: 'object', name: 'Painel de azulejos', data: { bundle: 2, object: tileObj, objects: [], assets: [tileAsset] } },
      { id: 'parede', kind: 'background', name: 'Parede de azulejos', data: { bundle: 2, background: wall, objects: [], assets: [tileAsset] } },
    ],
    [{ bytes: tile, mime: 'image/svg+xml', ext: 'svg' }],
  );
}
