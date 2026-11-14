import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DEFAULT_QUERY } from '@/features/catalog/catalog';
import { marketplaceItems, installedMarketplaceIds } from '@/features/packs/marketplace';
import { OfficialIndexSchema } from '@/features/packs/official';

const index = OfficialIndexSchema.parse(JSON.parse(readFileSync(resolve('public/packs/index.json'), 'utf8')));
const search = (text: string) => marketplaceItems(index, { ...DEFAULT_QUERY, text });

describe('loja de assets oficiais', () => {
  it('os 875 itens são produtos individuais do índice, sem precisar instalar o kit', () => {
    const items = search('');
    expect(items).toHaveLength(875);
    expect(items.filter((x) => x.pack.id === 'acessorios-1')).toHaveLength(22);
    expect(items.find((x) => x.item.name === 'Lon Ruan')?.pack.collection).toBe('Vila Torta');
  });
  it('a pesquisa usa nome, ID sensível a caixa, coleção e categoria', () => {
    expect(search('id:rs-acess-oculos-redondos').map((x) => x.item.name)).toEqual(['Óculos redondos']);
    expect(search('id:RS-ACESS-OCULOS-REDONDOS')).toHaveLength(0);
    expect(search('Vila Torta').length).toBe(95);
    expect(marketplaceItems(index, { ...DEFAULT_QUERY, kind: 'character' }).length).toBeGreaterThan(100);
    expect(marketplaceItems(index, { ...DEFAULT_QUERY, collection: 'Natal' }).length).toBe(50);
  });
  it('filtros de origem e animação não mostram itens indevidos', () => {
    expect(marketplaceItems(index, { ...DEFAULT_QUERY, filter: 'mine' })).toHaveLength(0);
    expect(marketplaceItems(index, { ...DEFAULT_QUERY, animated: true }).length).toBe(63);
    expect(marketplaceItems(index, { ...DEFAULT_QUERY, theme: 'series' }).length).toBe(95);
  });
  it('itens instalados são identificados independentemente do nome do pacote', () => {
    const ids = installedMarketplaceIds([
      { enabled: 1, items: [{ id: 'um' }, { id: 'dois' }] },
      { enabled: 0, items: [{ id: 'tres' }] },
    ]);
    expect([...ids].sort()).toEqual(['dois', 'um']);
    expect(ids.has('tres')).toBe(false);
  });
});
