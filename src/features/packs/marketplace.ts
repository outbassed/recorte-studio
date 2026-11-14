/**
 * Vitrine de itens oficiais ainda não instalados.
 * Consulta apenas os metadados do índice; o .rspack é baixado sob demanda para prévia/instalação.
 */
import type { CatalogQuery } from '@/features/catalog/catalog';
import { matchesSearch } from '@/features/library/search';
import type { OfficialEntry, OfficialIndex } from './official';

export type OfficialItemInfo = OfficialEntry['items'][number];
export interface MarketplaceItem { pack: OfficialEntry; item: OfficialItemInfo; key: string }

export function marketplaceItems(index: OfficialIndex | null, query: CatalogQuery): MarketplaceItem[] {
  if (!index || !['all', 'official'].includes(query.filter)) return [];
  const idQuery = query.text.trim().match(/^(?:id:|#)(.+)$/i)?.[1];
  return index.packs.flatMap((pack) => pack.items.flatMap((item) => {
    if (query.packId && query.packId !== pack.id) return [];
    if (query.kind && query.kind !== item.kind) return [];
    if (query.category && query.category !== (item.category || pack.category)) return [];
    if (query.subcategory && query.subcategory !== item.subcategory) return [];
    if (query.collection && query.collection !== pack.collection) return [];
    if (query.animated) return []; // O índice atual só traz contagem por pacote; não adivinhar animação por item.
    if (query.theme) {
      const tags = pack.tags.map((t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
      const theme = query.theme === 'series' ? 'serie' : query.theme === 'holiday' ? 'feriado' : 'evento';
      if (!tags.includes(theme) && !(query.theme === 'event' && pack.category === 'Festas')) return [];
    }
    if (idQuery ? item.id !== idQuery && pack.id !== idQuery
      : !matchesSearch(query.text, item.name, item.id, item.category, item.subcategory, pack.name, pack.id, pack.collection, pack.description, pack.tags)) return [];
    return [{ pack, item, key: `available:${pack.id}:${item.id}` }];
  }));
}

/** Identidades ativas, para não listar um item comprado duas vezes. */
export function installedMarketplaceIds(packs: ReadonlyArray<{ enabled: number; items: ReadonlyArray<{ id: string }> }>): Set<string> {
  return new Set(packs.filter((p) => p.enabled).flatMap((p) => p.items.map((i) => i.id)));
}
