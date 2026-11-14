/**
 * Prévia sob demanda para a loja: cache em memória do pacote verificado.
 * NÃO instala nem grava os outros itens no IndexedDB.
 */
import { entryForPackItem } from '@/features/catalog/catalog';
import { createProject } from '@/engine/model/factory';
import { readPack, type ParsedPack } from './format';
import { fetchOfficialPack, type OfficialEntry } from './official';
import { registerAssetBlob } from '@/features/library/assets';

const cache = new Map<string, Promise<ParsedPack>>();
const previewProject = createProject('Prévia da Biblioteca');
export { previewProject };

export function loadMarketplacePreview(p: OfficialEntry): Promise<ParsedPack> {
  const key = `${p.id}:${p.sha256}`;
  let running = cache.get(key);
  if (!running) {
    running = fetchOfficialPack(p).then(readPack).then((r) => {
      if (!r.ok) throw Error(r.reason);
      for (const m of r.pack.media) {
        registerAssetBlob(m.asset.id, new Blob([m.bytes as Uint8Array<ArrayBuffer>], { type: m.asset.mime }));
      }
      return r.pack;
    }).catch((error: unknown) => {
      cache.delete(key);
      throw error;
    });
    cache.set(key, running);
  }
  return running;
}

export function marketplacePreviewEntry(p: OfficialEntry, parsed: ParsedPack, id: string) {
  const it = parsed.items.find((i) => i.id === id);
  if (!it) return null;
  return entryForPackItem({ id: p.id, name: p.name, manifest: parsed.manifest, installedAt: 0, source: 'official' }, it, previewProject);
}
