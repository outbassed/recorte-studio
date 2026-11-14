/**
 * Pacotes na Biblioteca principal: lista dos instalados, página de detalhes (capa, metadados, TODOS os
 * itens com miniatura e animações, busca, dependências) e inspeção de um .rspack ANTES de instalar.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Download, FileUp, Package, RefreshCw, Trash2 } from 'lucide-react';
import { createProject } from '@/engine/model/factory';
import { entryForPackItem, type CatalogEntry } from '@/features/catalog/catalog';
import { compareVersions, readPack, type PackItemData, type PackManifest, type ParsedPack } from '@/features/packs/format';
import { buildDemoPack, DEMO_PACK_ID } from '@/features/packs/demo';
import { matchesSearch } from '@/features/library/search';
import { registerAssetBlob } from '@/features/library/assets';
import { exportPack, installInteractive, installOfficial, loadOfficialIndex, removePack, reportInstall, setPackEnabled, useOfficial, usePacks } from '@/state/packActions';
import { officialStatus, type OfficialEntry } from '@/features/packs/official';
import { BACKGROUNDS } from '@/engine/world/backgrounds';
import { BUILTIN_CHARACTERS } from '@/engine/character/presets';
import { PROPS } from '@/engine/world/props';
import { ANIMATED_TEMPLATES } from '@/features/catalog/animatedTemplates';
import { Cover, OfficialCatalog } from './OfficialCatalog';
import { toast } from '@/state/uiStore';
import type { Asset } from '@/engine/model/schema';
import { SearchBox } from '../controls/fields';
import { EntryThumb } from '../panels/Catalog';

export interface Inspected { pack: ParsedPack; bytes: Uint8Array; fileName: string; source?: 'official' | 'imported' }
const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
const MAX_FILE = 60 * 1024 * 1024;

async function inspectBytes(bytes: Uint8Array, fileName: string, onProgress?: (done: number, total: number) => void, source?: 'official' | 'imported'): Promise<Inspected | null> {
  const r = await readPack(bytes, onProgress);
  if (!r.ok) { toast(`Pacote recusado: ${r.reason}`, 'error'); return null; }
  // Miniaturas da inspeção: imagens só na memória desta aba (nada é gravado antes de confirmar).
  for (const m of r.pack.media) registerAssetBlob(m.asset.id, new Blob([m.bytes as Uint8Array<ArrayBuffer>], { type: m.asset.mime }));
  return { pack: r.pack, bytes, fileName, source };
}
export async function inspectPackFile(f: File, onProgress?: (done: number, total: number) => void): Promise<Inspected | null> {
  if (f.size > MAX_FILE) { toast('Pacote maior que 60 MB.', 'error'); return null; }
  return inspectBytes(new Uint8Array(await f.arrayBuffer()), f.name, onProgress);
}
/** Mostra o conteúdo de um pacote oficial já baixado (e conferido pelo sha256), sem instalar. */
export const inspectOfficialBytes = (entry: OfficialEntry, bytes: Uint8Array) => inspectBytes(bytes, entry.name, undefined, 'official');
export const inspectDemoPack = async () => inspectBytes(await buildDemoPack(), 'Kit Cozinha Retrô (demonstração)');

/** Item de pacote no formato do catálogo (para as mesmas miniaturas e prévias). */
const emptyProject = createProject('Pacote');
function entryOf(packId: string, packName: string, category: string, it: PackItemData): CatalogEntry {
  const manifest = { category, tags: [], dependencies: [] } as unknown as PackManifest;
  return entryForPackItem({ id: packId, name: packName, manifest, installedAt: 0 }, it, emptyProject);
}

function PackPage({ manifest, items, size, assets, inspected, onBack, onBrowse }: { manifest: PackManifest; items: PackItemData[]; size: number; assets: Asset[]; inspected?: Inspected; onBack: () => void; onBrowse?: (p: { packId: string }) => void }) {
  const packs = usePacks((s) => s.packs);
  const installed = packs.find((p) => p.id === manifest.id);
  const project = useMemo(() => createProject('Pacote'), []);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const entries = useMemo(() => items.map((it) => entryOf(manifest.id, manifest.name, manifest.category, it)), [items, manifest]);
  const shown = entries.filter((e) => matchesSearch(text, e.name, e.states.map((s) => s.label), e.kind === 'object' ? 'objeto' : 'cenario'));
  const counts = { object: items.filter((i) => i.kind === 'object').length, background: items.filter((i) => i.kind === 'background').length, character: items.filter((i) => i.kind === 'character').length, pose: items.filter((i) => i.kind === 'pose').length, animated: entries.filter((e) => e.kind === 'object' && e.states.length).length };
  const official = useOfficial((st) => st.index?.packs.find((p) => p.id === manifest.id));
  useEffect(() => { void loadOfficialIndex(); }, []);
  const update = installed?.source === 'official' && official && officialStatus(official, packs) === 'update' ? official : undefined;
  const deps = manifest.dependencies.map((d) => {
    const have = packs.find((p) => p.id === d.id);
    return { ...d, status: !have ? 'ausente' : compareVersions(have.version, d.version) < 0 ? `versão ${have.version} é antiga` : 'instalada' };
  });
  const depProblem = deps.some((d) => d.status !== 'instalada');
  const cmp = installed ? compareVersions(manifest.version, installed.version) : 1;
  const cover = entries.find((e) => e.kind === 'object') ?? entries[0];
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  return (
    <section className="pack-page" data-testid="pack-page" data-pack={manifest.id} data-mode={inspected ? 'inspect' : 'installed'} aria-busy={busy}>
      <button type="button" className="btn btn-sm" data-testid="pack-back" onClick={onBack}><ArrowLeft size={14} /> Pacotes</button>
      {inspected && <p className="pack-inspect-note" role="status" data-testid="pack-inspect-note">Inspecionando <strong>{inspected.fileName}</strong>: nada foi instalado ainda. Confira o conteúdo e confirme abaixo.</p>}
      <div className="pack-hero">
        <div className="pack-cover">{cover ? <EntryThumb e={cover} project={project} size={150} /> : <Package size={48} />}</div>
        <div className="pack-info">
          <h2 data-testid="pack-name">{manifest.name}</h2>
          <p>{manifest.description || 'Sem descrição.'}</p>
          <dl className="cat-info">
            <dt>Categoria</dt><dd>{manifest.category}</dd>
            <dt>Autor</dt><dd>{manifest.author || '—'}</dd>
            <dt>Licença</dt><dd data-testid="pack-license">{manifest.license}</dd>
            <dt>Versão</dt><dd data-testid="pack-version">{manifest.version}{installed && inspected ? ` (instalada: ${installed.version})` : ''}</dd>
            <dt>Tamanho</dt><dd>{fmtSize(size)} · {assets.length} imagem(ns)</dd>
            <dt>Conteúdo</dt><dd data-testid="pack-counts">{counts.object} objeto(s), {counts.background} cenário(s){counts.character ? `, ${counts.character} personagem(ns)` : ''}{counts.pose ? `, ${counts.pose} pose(s)` : ''}{counts.animated ? `, ${counts.animated} animado(s)` : ''}</dd>
            {manifest.collection && <><dt>Coleção</dt><dd data-testid="pack-collection">{manifest.collection}{manifest.volume ? ` · volume ${manifest.volume}` : ''}</dd></>}
            <dt>ID do pacote</dt><dd><code>{manifest.id}</code></dd>
            <dt>Compatibilidade</dt><dd data-testid="pack-compat">Recorte Studio 1.2 ou mais novo · formato .rspack v1</dd>
            <dt>Origem</dt><dd data-testid="pack-source">{(installed?.source ?? inspected?.source) === 'official' ? 'Oficial do Recorte Studio' : 'Importado de arquivo'}</dd>
            <dt>Estado</dt><dd data-testid="pack-state">{!installed ? 'Não instalado' : installed.enabled ? 'Instalado e ativo' : 'Instalado e desativado'}</dd>
          </dl>
          {deps.length > 0 && (
            <div className="pack-deps" data-testid="pack-deps">
              <strong>Dependências</strong>
              <ul>{deps.map((d) => <li key={d.id} className={d.status === 'instalada' ? '' : 'is-bad'}>{d.id} {d.version}+: {d.status}</li>)}</ul>
            </div>
          )}
          {depProblem && <p className="lib-error" role="alert">Incompatível agora: falta instalar ou atualizar as dependências acima.</p>}
          <div className="libh-actions">
            {inspected && (!installed || cmp > 0) && (
              <button type="button" className="btn btn-primary" data-testid="pack-install" disabled={busy || depProblem} onClick={() => void run(async () => {
                const r = await installInteractive(inspected.bytes, { source: inspected.source });
                reportInstall(r);
                if (r.ok) onBack();
              })}>{installed ? `Atualizar para ${manifest.version}` : 'Instalar pacote'}</button>
            )}
            {inspected && installed && cmp <= 0 && <span className="hint" data-testid="pack-same">{cmp === 0 ? 'Esta versão já está instalada.' : `Uma versão mais nova (${installed.version}) já está instalada.`}</span>}
            {!inspected && installed && <>
              <label className="anim-check"><input type="checkbox" data-testid="pack-enabled" checked={!!installed.enabled} disabled={busy} onChange={(ev) => void run(() => setPackEnabled(installed.id, ev.target.checked))} /> Ativo</label>
              <button type="button" className="btn" data-testid="pack-export" onClick={() => void exportPack(installed.id)}><Download size={14} /> Exportar</button>
              {onBrowse && <button type="button" className="btn" data-testid="pack-browse" onClick={() => onBrowse({ packId: installed.id })}>Ver no catálogo</button>}
              {update && <button type="button" className="btn btn-primary" data-testid="pack-update" disabled={busy} onClick={() => void run(async () => { reportInstall(await installOfficial(update)); })}><RefreshCw size={14} /> Atualizar para {update.version}</button>}
              <button type="button" className="btn btn-danger" data-testid="pack-remove" disabled={busy} onClick={() => void run(async () => { if (await removePack(installed.id)) onBack(); })}><Trash2 size={14} /> Remover</button>
            </>}
          </div>
        </div>
      </div>
      <div className="pack-items-head">
        <h3>Itens do pacote ({items.length})</h3>
        <SearchBox value={text} onChange={setText} placeholder="Buscar neste pacote" testId="pack-search" />
      </div>
      <ul className="libh-grid" data-testid="pack-items">
        {shown.map((e) => (
          <li key={e.key} className="libh-card is-static" data-testid="pack-page-item" data-name={e.name}>
            <span className="libh-thumb"><EntryThumb e={e} project={project} size={96} /></span>
            <span className="libh-name">{e.name}</span>
            <small className="libh-sub">{({ object: 'Objeto', background: 'Cenário', character: 'Personagem', pose: 'Pose' } as Record<string, string>)[e.kind] ?? e.kind} · <code>{e.id}</code>{e.states.length ? ` · animações: ${e.states.map((s) => s.label).join(', ')}` : ''}</small>
          </li>
        ))}
        {shown.length === 0 && <li className="empty">Nenhum item com esse termo.</li>}
      </ul>
    </section>
  );
}

/** Conteúdo essencial: vem com o programa, está sempre ativo e não pode ser removido (editar gera uma cópia sua). */
const ESSENTIAL = [
  { id: 'cast', name: 'Elenco padrão', n: () => BUILTIN_CHARACTERS.length, what: 'personagens prontos', kind: 'character' as const },
  { id: 'objects', name: 'Objetos padrão', n: () => PROPS.length + ANIMATED_TEMPLATES.length, what: 'objetos (alguns animados)', kind: null },
  { id: 'scenery', name: 'Cenários padrão', n: () => BACKGROUNDS.length, what: 'cenários com dia e noite', kind: 'background' as const },
];

type PacksView = 'installed' | 'official';
export function PacksTab({ inspected, setInspected, onInspectDemo, onBrowse }: { inspected: Inspected | null; setInspected: (i: Inspected | null) => void; onInspectDemo: () => Promise<void>; onBrowse?: (p: { packId?: string; filter?: 'builtin'; kind?: 'character' | 'background' | null }) => void }) {
  const packs = usePacks((s) => s.packs);
  const loaded = usePacks((s) => s.loaded);
  const index = useOfficial((s) => s.index);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState('');
  const [view, setView] = useState<PacksView>('installed');
  const fileRef = useRef<HTMLInputElement>(null);
  const project = useMemo(() => createProject('Pacotes'), []);
  useEffect(() => { void loadOfficialIndex(); }, []);
  if (inspected) return <PackPage manifest={inspected.pack.manifest} items={inspected.pack.items} size={inspected.pack.size} assets={inspected.pack.media.map((m) => m.asset)} inspected={inspected} onBack={() => { setInspected(null); setOpen(inspected.pack.manifest.id); }} />;
  const rec = open ? packs.find((p) => p.id === open) : undefined;
  if (rec) return <PackPage manifest={rec.manifest} items={rec.items} size={rec.size} assets={rec.assets} onBack={() => setOpen(null)} onBrowse={onBrowse} />;
  return (
    <section className="packs-tab" data-testid="packs-tab">
      <p className="hint">Pacotes são conjuntos de itens (.rspack): objetos, cenários, personagens e poses. Abra um arquivo para ver tudo o que ele traz antes de instalar, ou escolha no catálogo oficial. Itens de pacotes ativos aparecem em Itens e nas abas do Studio. Projetos guardam a própria cópia do que usam: desativar ou remover nunca muda um projeto.</p>
      <div className="btn-row">
        <button type="button" className="btn btn-primary" data-testid="pack-open-file" disabled={!!busy} onClick={() => fileRef.current?.click()}><FileUp size={14} /> Abrir arquivo de pacote…</button>
        {!packs.some((p) => p.id === DEMO_PACK_ID) && <button type="button" className="btn" data-testid="pack-demo" disabled={!!busy} onClick={() => void onInspectDemo()}>Ver pacote de demonstração</button>}
      </div>
      <div className="libh-tabs" role="tablist" aria-label="Pacotes">
        <button type="button" role="tab" aria-selected={view === 'installed'} className={view === 'installed' ? 'is-active' : ''} data-testid="packs-view-installed" onClick={() => setView('installed')}>Instalados <span className="count">{packs.length}</span></button>
        <button type="button" role="tab" aria-selected={view === 'official'} className={view === 'official' ? 'is-active' : ''} data-testid="packs-view-official" onClick={() => setView('official')}>Catálogo oficial {index && <span className="count">{index.packs.length}</span>}</button>
      </div>
      <input ref={fileRef} hidden type="file" accept=".rspack,.zip" data-testid="pack-input" onChange={async (ev) => {
        const f = ev.target.files?.[0];
        ev.target.value = '';
        if (!f) return;
        setBusy('Verificando pacote…');
        try { const r = await inspectPackFile(f, (d, t) => setBusy(`Verificando pacote… ${d} de ${t}`)); if (r) setInspected(r); } finally { setBusy(''); }
      }} />
      {busy && <p className="hint" role="status" data-testid="pack-busy">{busy}</p>}
      {view === 'official' ? <OfficialCatalog onInspect={async (entry, bytes) => { const r = await inspectOfficialBytes(entry, bytes); if (r) setInspected(r); }} /> : (
        <>
          <div className="off-group" data-testid="essential-packs">
            <header className="off-group-head"><div><h3>Conteúdo essencial</h3><small>Vem com o programa, sempre ativo, não pode ser removido. Editar um item cria uma cópia sua.</small></div></header>
            <div className="libh-grid is-packs">
              {ESSENTIAL.map((x) => (
                <article key={x.id} className="libh-card is-static" data-testid="essential-pack" data-essential={x.id}>
                  <span className="libh-thumb"><Package size={40} /></span>
                  <span className="libh-name">{x.name}</span>
                  <small className="libh-sub">{x.n()} {x.what}</small>
                  <small className="off-state is-installed">Essencial · sempre ativo</small>
                  {onBrowse && <button type="button" className="btn btn-sm" data-testid="essential-browse" onClick={() => onBrowse({ filter: 'builtin', kind: x.kind })}>Ver itens</button>}
                </article>
              ))}
            </div>
          </div>
          {!loaded && <p className="hint" role="status">Lendo pacotes…</p>}
          {loaded && packs.length === 0 && <p className="empty" data-testid="packs-empty">Nenhum pacote instalado. Veja o <button type="button" className="linklike" onClick={() => setView('official')}>catálogo oficial</button>.</p>}
          <div className="libh-grid is-packs">
            {packs.map((p) => {
              const first = p.items.find((i) => i.kind === 'object') ?? p.items[0];
              const off = index?.packs.find((x) => x.id === p.id);
              const hasUpdate = p.source === 'official' && off && officialStatus(off, packs) === 'update';
              return (
                <button key={p.id} type="button" className={`libh-card${p.enabled ? '' : ' is-off'}`} data-testid="pack-card" data-pack={p.id} data-enabled={p.enabled ? '1' : '0'} onClick={() => setOpen(p.id)}>
                  <span className="libh-thumb">{off?.coverSvg ? <Cover svg={off.coverSvg} size={104} /> : first ? <EntryThumb e={entryOf(p.id, p.name, p.manifest.category, first)} project={project} size={104} /> : <Package size={40} />}</span>
                  <span className="libh-name">{p.name}</span>
                  <small className="libh-sub">v{p.version} · {p.items.length} item(ns) · {p.enabled ? 'ativo' : 'desativado'}</small>
                  <small className="libh-sub">{p.source === 'official' ? 'Oficial' : 'Importado'}{p.manifest.collection ? ` · ${p.manifest.collection}` : ''}{p.manifest.volume ? ` · vol. ${p.manifest.volume}` : ''}</small>
                  {hasUpdate && <small className="off-state is-update" data-testid="pack-update-badge">Atualização disponível ({off!.version})</small>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
