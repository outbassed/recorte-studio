/**
 * Biblioteca principal (tela inicial e sobreposição no editor). Mesmo catálogo e armazenamento das
 * abas do Studio: o que se salva lá aparece aqui e vice-versa. Gerencia itens individuais e pacotes.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Copy, Download, FileUp, LayoutGrid, Library, List, Package, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import { createProject } from '@/engine/model/factory';
import type { Project } from '@/engine/model/schema';
import {
  buildCatalog, categoriesOf, DEFAULT_QUERY, FILTER_LABELS, KIND_LABELS, ORIGIN_LABELS, queryCatalog, SORT_LABELS,
  type CatalogEntry, type CatalogFilter, type CatalogKind, type CatalogQuery, type CatalogSort,
} from '@/features/catalog/catalog';
import { canEdit, insertEntry, reloadLibrary, saveEntryToLibrary, toggleFavorite, useLibrary } from '@/state/catalogActions';
import {
  copyToMyLibrary, createInLibrary, deleteRecord, duplicateRecord, editInLibrary, exportRecords, importLibraryJson, recordBytes, renameRecord, storageError,
} from '@/state/libraryHomeActions';
import { reloadPacks, usePacks } from '@/state/packActions';
import { setPref, usePrefs } from '@/state/prefs';
import { useProject } from '@/state/projectStore';
import { closeOverlay, toast } from '@/state/uiStore';
import { IconButton, SearchBox } from '../controls/fields';
import { ScrollStrip } from '../controls/ScrollStrip';
import { DetailPreview, EntryThumb, policyText } from '../panels/Catalog';
import { inspectPackFile, inspectDemoPack, PacksTab, type Inspected } from './PackPage';

const ORIGINS: CatalogFilter[] = ['all', 'builtin', 'packs', 'mine', 'favorites', 'recent', 'project'];
const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
const COMPAT: Record<CatalogKind, string> = {
  character: 'Personagem do Criador de Personagens (8 vistas, rig humano padrão)',
  pose: 'Personagens com o rig humano padrão',
  sequence: 'Qualquer personagem selecionado (passos editáveis na timeline)',
  prop: 'Objeto pronto do app (cores e estados)',
  object: 'Objeto montado (formato de biblioteca v2, com imagens e objetos usados)',
  background: 'Cenário personalizado (horários, formato v2)',
  scene: 'Cena completa com o elenco dela',
};

/** Metadados exibidos nos detalhes, conforme a origem. */
function metaOf(e: CatalogEntry, packs: ReturnType<typeof usePacks.getState>['packs'], records: ReturnType<typeof useLibrary.getState>['records']) {
  const pack = e.ref.type === 'pack-item' ? packs.find((p) => p.id === (e.ref as { packId: string }).packId) : undefined;
  const rec = e.ref.type === 'library' ? records.find((r) => r.id === (e.ref as { libId: string }).libId) : undefined;
  const assets = (e.objectBundle?.assets ?? e.backgroundBundle?.assets ?? []).reduce((s, a) => s + (a.size || 0), 0);
  const creator = e.origin === 'builtin' ? 'Recorte Studio' : e.origin === 'pack' ? pack?.manifest.author || pack?.name || 'Pacote' : e.origin === 'mine' ? 'Você' : 'Este projeto';
  const license = e.origin === 'builtin' ? 'Original do Recorte Studio (livre nos seus projetos)' : e.origin === 'pack' ? pack?.manifest.license ?? '—' : 'Sua criação';
  const version = e.origin === 'pack' ? `${pack?.version ?? '—'} (pacote)` : e.origin === 'builtin' ? 'Embutido no app' : e.updatedAt ? `Atualizado em ${new Date(e.updatedAt).toLocaleDateString('pt-BR')}` : '—';
  const size = e.origin === 'builtin' ? 'Embutido no app' : fmtSize(recordBytes(rec?.data ?? e.objectBundle ?? e.backgroundBundle ?? e.character ?? e.sceneData ?? {}, assets));
  const anims = e.kind === 'object' && e.states.length ? e.states.map((s) => s.label).join(', ') : e.kind === 'prop' && e.states.length ? `Estados: ${e.states.map((s) => s.label).join(', ')}` : 'Nenhuma';
  const views = e.kind === 'character' ? '8 vistas (frente, lados, costas e diagonais)' : e.kind === 'background' ? (e.ref.type === 'builtin-background' ? 'Dia e noite' : `Horários: ${(e.times ?? []).length || 'nenhum'}`) : e.kind === 'pose' ? 'Frente (aplicável em qualquer vista)' : 'Uma vista';
  return { creator, license, version, size, anims, views };
}

function ItemDetail({ e, project, inEditor, onClose }: { e: CatalogEntry; project: Project; inEditor: boolean; onClose: () => void }) {
  const packs = usePacks((s) => s.packs);
  const records = useLibrary((s) => s.records);
  const m = metaOf(e, packs, records);
  const libId = e.ref.type === 'library' ? e.ref.libId : null;
  const copyable = !e.editable && !e.broken && ['builtin-character', 'builtin-prop', 'builtin-object', 'pack-item'].includes(e.ref.type);
  return (
    <aside className="libh-detail" data-testid="library-detail" data-key={e.key} aria-label={`Detalhes de ${e.name}`}>
      <header className="libh-detail-head">
        <div><h2>{e.name}</h2><small>{KIND_LABELS[e.kind]} · {ORIGIN_LABELS[e.origin]}{e.packName ? ` · ${e.packName}` : ''}</small></div>
        <IconButton label="Fechar detalhes" testId="library-detail-close" onClick={onClose}><X size={16} /></IconButton>
      </header>
      <div className="libh-detail-body">
        <DetailPreview e={e} project={project} />
        <dl className="cat-info" data-testid="library-meta">
          <dt>Tipo</dt><dd>{KIND_LABELS[e.kind]}</dd>
          <dt>Categoria</dt><dd>{e.category}</dd>
          <dt>Origem</dt><dd data-testid="library-origin">{ORIGIN_LABELS[e.origin]}</dd>
          <dt>Criador</dt><dd>{m.creator}</dd>
          <dt>Licença</dt><dd data-testid="library-license">{m.license}</dd>
          <dt>Versão</dt><dd>{m.version}</dd>
          <dt>Compatível com</dt><dd>{COMPAT[e.kind]}</dd>
          <dt>Tamanho</dt><dd>{m.size}</dd>
          <dt>Animações</dt><dd data-testid="library-anims">{m.anims}</dd>
          <dt>Vistas</dt><dd>{m.views}</dd>
          {e.keywords.filter(Boolean).length > 0 && <><dt>Palavras-chave</dt><dd>{[...new Set(e.keywords.filter(Boolean))].slice(0, 8).join(', ')}</dd></>}
        </dl>
        <p className="hint">{policyText(e)}</p>
        {e.broken && <p className="lib-error" role="alert">Formato incompatível: {e.broken}</p>}
      </div>
      <footer className="libh-actions">
        {inEditor && !e.broken && <button type="button" className="btn btn-primary" data-testid="library-insert" onClick={async () => { if (await insertEntry(e)) closeOverlay(); }}>Inserir na cena</button>}
        {canEdit(e) && <button type="button" className="btn" data-testid="library-edit" onClick={() => void editInLibrary(e)}><Pencil size={14} /> {e.editable ? 'Editar' : 'Editar uma cópia'}</button>}
        {copyable && <button type="button" className="btn" data-testid="library-copy" onClick={() => void copyToMyLibrary(e)}><Copy size={14} /> Copiar para minha biblioteca</button>}
        {inEditor && e.origin === 'project' && <button type="button" className="btn" data-testid="library-save" onClick={() => void saveEntryToLibrary(e)}>{e.libId ? 'Atualizar na biblioteca' : 'Salvar na biblioteca'}</button>}
        <button type="button" className="btn" data-testid="library-favorite" aria-pressed={e.favorite} onClick={() => void toggleFavorite(e)}><Star size={14} fill={e.favorite ? 'currentColor' : 'none'} /> {e.favorite ? 'Favorito' : 'Favoritar'}</button>
        {libId && <>
          <button type="button" className="btn" data-testid="library-duplicate" onClick={() => void duplicateRecord(libId)}>Duplicar</button>
          <button type="button" className="btn" data-testid="library-rename" onClick={() => void renameRecord(libId)}>Renomear</button>
          <button type="button" className="btn" data-testid="library-export" onClick={() => { const r = records.find((x) => x.id === libId); if (r) exportRecords([r], `${r.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'item'}.biblioteca.json`); }}><Download size={14} /> Exportar</button>
          <button type="button" className="btn btn-danger" data-testid="library-delete" onClick={async () => { if (await deleteRecord(libId)) onClose(); }}><Trash2 size={14} /> Apagar</button>
        </>}
      </footer>
    </aside>
  );
}

export function LibraryHome({ inEditor = false }: { inEditor?: boolean }) {
  const project = useProject();
  const empty = useMemo(() => createProject('Biblioteca'), []);
  const base = inEditor && project ? project : empty;
  const records = useLibrary((s) => s.records);
  const loaded = useLibrary((s) => s.loaded);
  const libError = useLibrary((s) => s.error);
  const packs = usePacks((s) => s.packs);
  const favorites = usePrefs((s) => s.catalogFavorites);
  const recents = usePrefs((s) => s.catalogRecents);
  const layout = usePrefs((s) => s.catalogLayout);
  const [tab, setTab] = useState<'items' | 'packs'>('items');
  const [q, setQ] = useState<CatalogQuery>(DEFAULT_QUERY);
  const [detail, setDetail] = useState<string | null>(null);
  const [inspected, setInspected] = useState<Inspected | null>(null);
  const [busy, setBusy] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void reloadLibrary(); void reloadPacks(); }, []);
  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const entries = useMemo(() => buildCatalog({ project: base, library: records, favorites: favSet, packs }), [base, records, favSet, packs]);
  const list = useMemo(() => queryCatalog(entries, 'all', q, recents), [entries, q, recents]);
  const cats = useMemo(() => categoriesOf(entries, 'all'), [entries]);
  const kinds = useMemo(() => [...new Set(entries.map((e) => e.kind))] as CatalogKind[], [entries]);
  const hasPacks = entries.some((e) => e.origin === 'pack');
  const [limit, setLimit] = useState(80);
  useEffect(() => setLimit(80), [q]);
  const set = (p: Partial<CatalogQuery>) => setQ((o) => ({ ...o, ...p }));
  const sel = detail ? entries.find((e) => e.key === detail) : undefined;
  const isList = layout === 'list';

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
      const r = await importLibraryJson(await f.text());
      toast(`${r.created} item(ns) novo(s), ${r.updated} atualizado(s)${r.skipped ? `, ${r.skipped} ilegível(is) ignorado(s)` : ''}.`, 'success');
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
        <button type="button" role="tab" aria-selected={tab === 'items'} className={tab === 'items' ? 'is-active' : ''} data-testid="library-tab-items" onClick={() => { setTab('items'); setInspected(null); }}>Itens <span className="count">{entries.filter((e) => !e.shadowed).length}</span></button>
        <button type="button" role="tab" aria-selected={tab === 'packs'} className={tab === 'packs' ? 'is-active' : ''} data-testid="library-tab-packs" onClick={() => setTab('packs')}><Package size={14} /> Pacotes <span className="count">{packs.length}</span></button>
      </ScrollStrip>
      {busy && <p className="hint" role="status" data-testid="library-busy">{busy}</p>}
      {tab === 'packs' ? (
        <PacksTab inspected={inspected} setInspected={setInspected} onInspectDemo={async () => { setBusy('Montando o pacote de demonstração…'); try { setInspected(await inspectDemoPack()); } finally { setBusy(''); } }} />
      ) : (
        <>
          <div className="libh-filters">
            <SearchBox value={q.text} onChange={(text) => set({ text })} placeholder="Buscar por nome, categoria, tipo ou palavra-chave" testId="library-search" />
            <ScrollStrip className="chip-row" role="group" ariaLabel="Tipo" testId="library-kinds" watch={q.kind}>
              <button type="button" className={`chip${!q.kind ? ' is-active' : ''}`} aria-pressed={!q.kind} data-kind="" onClick={() => set({ kind: null, category: null })}>Todos os tipos</button>
              {kinds.map((k) => <button key={k} type="button" className={`chip${q.kind === k ? ' is-active' : ''}`} aria-pressed={q.kind === k} data-kind={k} onClick={() => set({ kind: k, category: null })}>{KIND_LABELS[k]}</button>)}
            </ScrollStrip>
            <ScrollStrip className="chip-row" role="group" ariaLabel="Origem" testId="library-origins" watch={q.filter}>
              {ORIGINS.filter((f) => (f !== 'packs' || hasPacks) && (f !== 'project' || inEditor)).map((f) => (
                <button key={f} type="button" className={`chip${q.filter === f ? ' is-active' : ''}`} aria-pressed={q.filter === f} data-filter={f} onClick={() => set({ filter: f })}>{f === 'favorites' && <Star size={11} />}{FILTER_LABELS[f]}</button>
              ))}
            </ScrollStrip>
            <div className="cat-row2">
              <select className="cat-select" aria-label="Categoria" data-testid="library-category" value={q.category ?? ''} onChange={(ev) => set({ category: ev.target.value || null })}>
                <option value="">Todas as categorias</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.id} ({c.count})</option>)}
              </select>
              <select className="cat-select" aria-label="Ordenar" data-testid="library-sort" value={q.sort} onChange={(ev) => set({ sort: ev.target.value as CatalogSort })}>
                {(Object.keys(SORT_LABELS) as CatalogSort[]).map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
              </select>
              <IconButton label={isList ? 'Ver em grade' : 'Ver em lista'} testId="library-layout" onClick={() => setPref('catalogLayout', isList ? 'grid' : 'list')}>{isList ? <LayoutGrid size={16} /> : <List size={16} />}</IconButton>
              <span className="hint" data-testid="library-count">{list.length} item(ns)</span>
            </div>
          </div>
          {!loaded && <p className="hint" role="status">Carregando sua biblioteca…</p>}
          {libError && <p className="lib-error" role="alert">Não foi possível ler sua biblioteca neste navegador: {libError}. Os itens padrão continuam disponíveis.</p>}
          <div className={`libh-body${sel ? ' has-detail' : ''}`}>
            <div className={isList ? 'libh-list' : 'libh-grid'} data-testid="library-results">
              {list.slice(0, limit).map((e) => (
                <button key={e.key} type="button" className={`libh-card${detail === e.key ? ' is-active' : ''}${e.broken ? ' is-broken' : ''}`} data-testid="library-item" data-key={e.key} data-name={e.name} data-origin={e.origin} data-kind={e.kind} aria-pressed={detail === e.key} onClick={() => setDetail(e.key)}>
                  <span className="libh-thumb"><EntryThumb e={e} project={base} size={isList ? 44 : 104} /></span>
                  <span className="libh-name">{e.favorite && <Star size={11} fill="currentColor" aria-label="favorito" />} {e.name}</span>
                  <small className="libh-sub">{KIND_LABELS[e.kind]} · {e.origin === 'pack' ? e.packName : ORIGIN_LABELS[e.origin]}{e.kind === 'object' && e.states.length ? ' · animado' : ''}</small>
                </button>
              ))}
              {list.length === 0 && <p className="empty" data-testid="library-empty">{q.text ? 'Nada encontrado com esse termo.' : q.filter === 'mine' ? 'Você ainda não salvou nada. Crie um item acima ou salve pelo Studio (detalhes → Salvar na biblioteca).' : q.filter === 'favorites' ? 'Nenhum favorito ainda.' : 'Nada aqui.'}</p>}
              {limit < list.length && <div className="cat-more"><button type="button" className="btn btn-sm" onClick={() => setLimit((l) => l + 80)}>Mostrar mais ({list.length - limit})</button></div>}
            </div>
            {sel && <ItemDetail e={sel} project={base} inEditor={inEditor} onClose={() => setDetail(null)} />}
          </div>
        </>
      )}
    </div>
  );
}
