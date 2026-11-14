/**
 * Biblioteca principal (tela inicial e sobreposição no editor). Mesmo catálogo e armazenamento das
 * abas do Studio: o que se salva lá aparece aqui e vice-versa. Gerencia itens individuais e pacotes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, FileUp, LayoutGrid, Library, List, Package, Plus, Star } from 'lucide-react';
import { createProject } from '@/engine/model/factory';
import {
  buildCatalog, categoriesOf, subcategoriesOf, DEFAULT_QUERY, FILTER_LABELS, KIND_LABELS, ORIGIN_LABELS, queryCatalog, SORT_LABELS, themesOf, THEME_LABELS,
  type CatalogFilter, type CatalogKind, type CatalogQuery, type CatalogSort, type CatalogTheme,
} from '@/features/catalog/catalog';
import { reloadLibrary, useLibrary } from '@/state/catalogActions';
import { createInLibrary, importLibraryJson, storageError } from '@/state/libraryHomeActions';
import { loadOfficialIndex, reloadPacks, useOfficial, usePacks } from '@/state/packActions';
import { setPref, usePrefs } from '@/state/prefs';
import { useProject } from '@/state/projectStore';
import { closeOverlay, toast } from '@/state/uiStore';
import { IconButton, SearchBox } from '../controls/fields';
import { ScrollStrip } from '../controls/ScrollStrip';
import { EntryThumb } from '../panels/Catalog';
import { ItemDetailPopup } from './ItemDetail';
import { inspectPackFile, inspectDemoPack, PacksTab, type Inspected } from './PackPage';
import { installedMarketplaceIds, marketplaceItems } from '@/features/packs/marketplace';
import { MarketplaceItemCard } from './MarketplaceItemCard';

const ORIGINS: CatalogFilter[] = ['all', 'builtin', 'official', 'packs', 'mine', 'favorites', 'recent', 'project'];
export function LibraryHome({ inEditor = false }: { inEditor?: boolean }) {
  const project = useProject();
  const empty = useMemo(() => createProject('Biblioteca'), []);
  const base = inEditor && project ? project : empty;
  const records = useLibrary((s) => s.records);
  const loaded = useLibrary((s) => s.loaded);
  const libError = useLibrary((s) => s.error);
  const packs = usePacks((s) => s.packs);
  const officialIndex = useOfficial((s) => s.index);
  const officialLoading = useOfficial((s) => s.loading);
  const officialError = useOfficial((s) => s.error);
  const favorites = usePrefs((s) => s.catalogFavorites);
  const recents = usePrefs((s) => s.catalogRecents);
  const layout = usePrefs((s) => s.catalogLayout);
  const [tab, setTab] = useState<'items' | 'packs'>('items');
  const [q, setQ] = useState<CatalogQuery>(DEFAULT_QUERY);
  const [detail, setDetail] = useState<string | null>(null);
  const [inspected, setInspected] = useState<Inspected | null>(null);
  const [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void reloadLibrary(); void reloadPacks(); void loadOfficialIndex(); }, []);
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const entries = useMemo(() => buildCatalog({ project: base, library: records, favorites: favSet, packs }), [base, records, favSet, packs]);
  const list = useMemo(() => queryCatalog(entries, 'all', q, recents), [entries, q, recents]);
  const cats = useMemo(() => {
    const groups = new Map(categoriesOf(entries, 'all').map((c) => [c.id, c.count]));
    const known = new Set(entries.map((e) => e.id));
    for (const p of officialIndex?.packs ?? []) for (const i of p.items) {
      if (known.has(i.id)) continue;
      const category = i.category || p.category;
      groups.set(category, (groups.get(category) ?? 0) + 1);
    }
    return [...groups].map(([id, count]) => ({ id, count })).sort((a, b) => a.id.localeCompare(b.id, 'pt-BR'));
  }, [entries, officialIndex]);
  const subs = useMemo(() => {
    if (!q.category) return [];
    const groups = new Map(subcategoriesOf(entries, q.category).map((c) => [c.id, c.count]));
    const known = new Set(entries.map((e) => e.id));
    for (const p of officialIndex?.packs ?? []) for (const i of p.items) {
      if (known.has(i.id) || (i.category || p.category) !== q.category || !i.subcategory) continue;
      groups.set(i.subcategory, (groups.get(i.subcategory) ?? 0) + 1);
    }
    return [...groups].map(([id, count]) => ({ id, count })).sort((a, b) => a.id.localeCompare(b.id, 'pt-BR'));
  }, [entries, officialIndex, q.category]);
  const kinds = useMemo(() => [...new Set([...entries.map((e) => e.kind), ...(officialIndex?.packs ?? []).flatMap((p) => p.items.map((i) => i.kind))])] as CatalogKind[], [entries, officialIndex]);
  const hasPacks = entries.some((e) => e.origin === 'pack');
  const hasOfficial = !!officialIndex?.packs.length || entries.some((e) => e.origin === 'pack' && e.official);
  const themes = useMemo(() => (['series', 'holiday', 'event'] as CatalogTheme[]).filter((t) =>
    entries.some((e) => themesOf(e).includes(t)) ||
    (officialIndex?.packs ?? []).some((p) => p.tags.some((tag) => {
      const n = tag.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return t === 'series' ? n === 'serie' : t === 'holiday' ? n === 'feriado' : n === 'evento';
    }))
  ), [entries, officialIndex]);
  const collections = useMemo(() => [...new Set([...entries.map((e) => e.collection), ...(officialIndex?.packs ?? []).map((p) => p.collection)].filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [entries, officialIndex]);
  const packOptions = useMemo(() => [...new Map([...packs.filter((p) => p.enabled).map((p) => ({ id: p.id, name: p.name })), ...(officialIndex?.packs ?? []).map((p) => ({ id: p.id, name: p.name }))].map((p) => [p.id, p] as const)).values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [packs, officialIndex]);
  const activeExtra = Number(!!q.theme) + Number(!!q.animated) + Number(!!q.collection) + Number(!!q.packId);
  const [moreOpen, setMoreOpen] = useState(() => typeof matchMedia === 'function' && matchMedia('(min-width: 760px)').matches);
  const [limit, setLimit] = useState(80);
  useEffect(() => setLimit(80), [q]);
  const set = (p: Partial<CatalogQuery>) => setQ((o) => ({ ...o, ...p }));
  const sel = detail ? entries.find((e) => e.key === detail) : undefined;
  const isList = layout === 'list';
  // Um único grid: os assets oficiais não instalados têm cards próprios, intercalados com os locais.
  const available = useMemo(() => {
    const installed = installedMarketplaceIds(packs);
    const known = new Set(entries.map((e) => e.id));
    return marketplaceItems(officialIndex, q).filter(({ item }) => !installed.has(item.id) && !known.has(item.id));
  }, [packs, entries, officialIndex, q]);
  const shelf = useMemo(() => {
    const both = [
      ...list.map((entry) => ({ source: 'local' as const, key: entry.key, name: entry.name, category: entry.category, entry })),
      ...available.map(({ pack, item, key }) => ({ source: 'available' as const, key, name: item.name, category: item.category || pack.category, pack, item })),
    ];
    if (q.sort === 'updated' || q.sort === 'favorites') return both;
    return both.sort((a, b) => a.category.localeCompare(b.category, 'pt-BR') || a.name.localeCompare(b.name, 'pt-BR'));
  }, [list, available, q.sort]);
  const totalInStore = useMemo(() => {
    const known = new Set(entries.map((e) => e.id));
    return entries.filter((e) => !e.shadowed).length + (officialIndex?.packs ?? []).reduce((sum, p) => sum + p.items.filter((i) => !known.has(i.id)).length, 0);
  }, [entries, officialIndex]);

  const onFile = async (f: File) => {
    if (/\.(rspack|zip)$/i.test(f.name)) {
      setBusy('Verificando pacote…');
      try {
        const r = await inspectPackFile(f, (d, t) => setBusy(`Verificando pacote… ${d} de ${t}`));
        if (r) { setInspected(r); setTab('packs'); }
      } finally { setBusy(''); }
      return;
    }
    try {
      const r = await importLibraryJson(await f.text(), f.name);
      if (r.cancelled) return;
      const extra = [r.duplicates ? `${r.duplicates} duplicata(s) reconhecida(s)` : '', r.renamed ? `${r.renamed} com ID novo` : '', r.notImported ? `${r.notImported} não importado(s)` : '', r.skipped ? `${r.skipped} ilegível(is) ignorado(s)` : ''].filter(Boolean).join(', ');
      toast(`${r.created} item(ns) novo(s)${extra ? ` (${extra})` : ''}.`, 'success');
    } catch (e) {
      toast(e instanceof SyntaxError ? 'Não foi possível importar: o arquivo não é JSON válido.' : storageError(e, 'Não foi possível importar'), 'error');
    }
  };

  return (
    <div className={`libh${inEditor ? ' is-overlay' : ''}`} data-testid="library-home">
      <header className="libh-head">
        <div className="libh-title">
          {inEditor && <IconButton label="Voltar ao editor" testId="library-close" onClick={closeOverlay}><ArrowLeft size={18} /></IconButton>}
          <Library size={22} aria-hidden="true" />
          <div><h1>Biblioteca</h1><p>Itens padrão, seus e de pacotes, em todos os projetos deste navegador.</p></div>
        </div>
        <div className="libh-head-actions">
          <button type="button" className="btn btn-sm" data-testid="library-create-object" onClick={() => void createInLibrary('object')}><Plus size={14} /> Objeto</button>
          <button type="button" className="btn btn-sm" data-testid="library-create-background" onClick={() => void createInLibrary('background')}><Plus size={14} /> Cenário</button>
          <button type="button" className="btn btn-sm" data-testid="library-create-character" onClick={() => void createInLibrary('character')}><Plus size={14} /> Personagem</button>
          <button type="button" className="btn btn-sm btn-primary" data-testid="library-import" disabled={!!busy} onClick={() => fileRef.current?.click()}><FileUp size={14} /> Importar</button>
          <input ref={fileRef} hidden type="file" accept=".json,.rspack,.zip" data-testid="library-input" onChange={(ev) => { const f = ev.target.files?.[0]; ev.target.value = ''; if (f) void onFile(f); }} />
        </div>
      </header>
      <ScrollStrip className="libh-tabs" role="tablist" ariaLabel="Seções da biblioteca" watch={tab}>
        <button type="button" role="tab" aria-selected={tab === 'items'} className={tab === 'items' ? 'is-active' : ''} data-testid="library-tab-items" onClick={() => { setTab('items'); setInspected(null); }}>Itens <span className="count">{totalInStore}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'packs'} className={tab === 'packs' ? 'is-active' : ''} data-testid="library-tab-packs" onClick={() => setTab('packs')}><Package size={14} /> Pacotes <span className="count">{packs.length}</span></button>
      </ScrollStrip>
      {busy && <p className="hint" role="status" data-testid="library-busy">{busy}</p>}
      {tab === 'packs' ? (
        <PacksTab onBrowse={(b) => { setTab('items'); setInspected(null); setQ({ ...DEFAULT_QUERY, filter: b.showOfficial ? 'official' : b.filter ?? 'all', kind: b.kind ?? null, packId: b.packId ?? null }); }} onBackToCatalog={() => { setTab('items'); setQ({ ...DEFAULT_QUERY, filter: 'official' }); }} inspected={inspected} setInspected={setInspected} onInspectDemo={async () => { setBusy('Montando o pacote de demonstração…'); try { setInspected(await inspectDemoPack()); } finally { setBusy(''); } }} />
      ) : (
        <>
          <div className="libh-filters">
            <SearchBox value={q.text} onChange={(text) => set({ text })} placeholder="Buscar por nome, ID, tipo, categoria, tag, pacote ou coleção" testId="library-search" />
            <ScrollStrip className="chip-row" role="group" ariaLabel="Origem" testId="library-origins" watch={q.filter}>
              {ORIGINS.filter((f) => (f !== 'packs' || hasPacks) && (f !== 'official' || hasOfficial) && (f !== 'project' || inEditor)).map((f) => (
                <button key={f} type="button" className={`chip${q.filter === f ? ' is-active' : ''}`} aria-pressed={q.filter === f} data-filter={f} onClick={() => set({ filter: f })}>{f === 'favorites' && <Star size={11} />}{FILTER_LABELS[f]}</button>
              ))}
            </ScrollStrip>
            <ScrollStrip className="chip-row" role="group" ariaLabel="Tipo" testId="library-kinds" watch={q.kind}>
              <button type="button" className={`chip${!q.kind ? ' is-active' : ''}`} aria-pressed={!q.kind} data-kind="" onClick={() => set({ kind: null, category: null })}>Todos os tipos</button>
              {kinds.map((k) => <button key={k} type="button" className={`chip${q.kind === k ? ' is-active' : ''}`} aria-pressed={q.kind === k} data-kind={k} onClick={() => set({ kind: k, category: null })}>{KIND_LABELS[k]}</button>)}
            </ScrollStrip>
            <details className="libh-more" open={moreOpen} onToggle={(ev) => setMoreOpen((ev.currentTarget as HTMLDetailsElement).open)}>
              <summary data-testid="library-more">Mais filtros{activeExtra > 0 ? ` (${activeExtra} ativo${activeExtra > 1 ? 's' : ''})` : ''}</summary>
              <div className="libh-more-body">
                {themes.length > 0 && (
                  <ScrollStrip className="chip-row" role="group" ariaLabel="Tema" testId="library-themes" watch={q.theme ?? ''}>
                    <button type="button" className={`chip${!q.theme ? ' is-active' : ''}`} aria-pressed={!q.theme} data-theme="" onClick={() => set({ theme: null })}>Todos os temas</button>
                    {themes.map((t) => <button key={t} type="button" className={`chip${q.theme === t ? ' is-active' : ''}`} aria-pressed={q.theme === t} data-theme={t} onClick={() => set({ theme: t })}>{THEME_LABELS[t]}</button>)}
                  </ScrollStrip>
                )}
                <div className="cat-row2">
                  <label className="anim-check"><input type="checkbox" data-testid="library-animated" checked={!!q.animated} onChange={(ev) => set({ animated: ev.target.checked })} /> Só animados</label>
                  {collections.length > 0 && (
                    <select className="cat-select" aria-label="Coleção" data-testid="library-collection-filter" value={q.collection ?? ''} onChange={(ev) => set({ collection: ev.target.value || null })}>
                      <option value="">Todas as coleções</option>
                      {collections.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {packOptions.length > 0 && (
                    <select className="cat-select" aria-label="Pacote" data-testid="library-pack-filter" value={q.packId ?? ''} onChange={(ev) => set({ packId: ev.target.value || null })}>
                      <option value="">Todos os pacotes</option>
                      {packOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </details>
            <div className="cat-row2">
              <select className="cat-select" aria-label="Categoria" data-testid="library-category" value={q.category ?? ''} onChange={(ev) => set({ category: ev.target.value || null, subcategory: null })}>
                <option value="">Todas as categorias</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.id} ({c.count})</option>)}
              </select>
              {subs.length > 0 && (
                <select className="cat-select" aria-label="Subcategoria" data-testid="library-subcategory" value={q.subcategory ?? ''} onChange={(ev) => set({ subcategory: ev.target.value || null })}>
                  <option value="">Todas as subcategorias</option>
                  {subs.map((c) => <option key={c.id} value={c.id}>{c.id} ({c.count})</option>)}
                </select>
              )}
              <select className="cat-select" aria-label="Ordenar" data-testid="library-sort" value={q.sort} onChange={(ev) => set({ sort: ev.target.value as CatalogSort })}>
                {(Object.keys(SORT_LABELS) as CatalogSort[]).map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
              </select>
              <IconButton label={isList ? 'Ver em grade' : 'Ver em lista'} testId="library-layout" onClick={() => setPref('catalogLayout', isList ? 'grid' : 'list')}>{isList ? <LayoutGrid size={16} /> : <List size={16} />}</IconButton>
              <span className="hint" data-testid="library-count">{shelf.length} item(ns)</span>
            </div>
          </div>
          {!loaded && <p className="hint" role="status">Carregando sua biblioteca…</p>}
          {libError && <p className="lib-error" role="alert">Não foi possível ler sua biblioteca neste navegador: {libError}. Os itens padrão continuam disponíveis.</p>}
          {officialLoading && <p className="hint" role="status">Carregando itens oficiais disponíveis…</p>}
          {officialError && <p className="lib-error" role="alert">Não foi possível carregar os itens oficiais: {officialError}. Os já baixados continuam disponíveis.</p>}
          <div className="libh-body">
            <div className={isList ? 'libh-list' : 'libh-grid'} data-testid="library-results">
              {shelf.slice(0, limit).map((s) => s.source === 'available'
                ? <MarketplaceItemCard key={s.key} pack={s.pack} item={s.item} />
                : <button key={s.key} type="button" className={`libh-card${detail === s.entry.key ? ' is-active' : ''}${s.entry.broken ? ' is-broken' : ''}`} data-testid="library-item" data-key={s.entry.key} data-name={s.entry.name} data-origin={s.entry.origin} data-kind={s.entry.kind} aria-haspopup="dialog" onClick={() => setDetail(s.entry.key)}>
                    <span className="libh-thumb"><EntryThumb e={s.entry} project={base} size={isList ? 44 : 104} /></span>
                    <span className="libh-name">{s.entry.favorite && <Star size={11} fill="currentColor" aria-label="favorito" />} {s.entry.name}</span>
                    <small className="libh-sub">{KIND_LABELS[s.entry.kind]} · {s.entry.origin === 'pack' ? s.entry.packName : ORIGIN_LABELS[s.entry.origin]}{s.entry.kind === 'object' && s.entry.states.length ? ' · animado' : ''}</small>
                  </button>
              )}
              {shelf.length === 0 && <p className="empty" data-testid="library-empty">{q.text ? 'Nada encontrado com esse termo.' : q.filter === 'mine' ? 'Você ainda não salvou nada. Crie um item acima ou salve pelo Studio (detalhes → Salvar na biblioteca).' : q.filter === 'favorites' ? 'Nenhum favorito ainda.' : 'Nada aqui.'}</p>}
              {limit < shelf.length && <div className="cat-more"><button type="button" className="btn btn-sm" onClick={() => setLimit((l) => l + 80)}>Mostrar mais ({shelf.length - limit})</button></div>}
            </div>
            {sel && <ItemDetailPopup e={sel} project={base} inEditor={inEditor} onClose={() => setDetail(null)} />}
          </div>

        </>
      )}
    </div>
  );
}
