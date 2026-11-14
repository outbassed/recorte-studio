/**
 * Catálogo oficial de pacotes: coleções com volumes, capa, contagem real, estado e instalação (individual ou da coleção).
 * O índice é pequeno e carrega na hora; o arquivo de cada pacote só é baixado ao ver o conteúdo ou instalar.
 */
import { useEffect, useMemo, useState } from 'react';
import { Check, Download, Eye, Package, RefreshCw } from 'lucide-react';
import { groupByCollection, officialStatus, type OfficialEntry } from '@/features/packs/official';
import { matchesSearch } from '@/features/library/search';
import { downloadOfficial, installCollection, installOfficial, loadOfficialIndex, reportInstall, usePacks, useOfficial } from '@/state/packActions';
import { toast } from '@/state/uiStore';
import { SearchBox } from '../controls/fields';

const KIND_TEXT: Record<string, [string, string]> = { object: ['objeto', 'objetos'], background: ['cenário', 'cenários'], character: ['personagem', 'personagens'], pose: ['pose', 'poses'] };
export const countsText = (e: Pick<OfficialEntry, 'counts' | 'animated'>): string => {
  const parts = Object.entries(e.counts).filter(([, n]) => n).map(([k, n]) => `${n} ${KIND_TEXT[k]?.[n === 1 ? 0 : 1] ?? k}`);
  return parts.join(', ') + (e.animated ? ` (${e.animated} animado${e.animated > 1 ? 's' : ''})` : '');
};
const fmtSize = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);
const STATUS_TEXT = { available: 'Não instalado', installed: 'Instalado', update: 'Atualização disponível', disabled: 'Instalado (desativado)' } as const;

export function Cover({ svg, size = 96 }: { svg?: string; size?: number }) {
  if (!svg) return <Package size={size / 2.4} aria-hidden="true" />;
  return <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`} alt="" width={size} height={size} loading="lazy" draggable={false} style={{ objectFit: 'contain' }} />;
}

export function OfficialCatalog({ onInspect }: { onInspect: (entry: OfficialEntry, bytes: Uint8Array) => Promise<void> }) {
  const { index, loading, error } = useOfficial();
  const installed = usePacks((s) => s.packs);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('');
  const [busy, setBusy] = useState<string>('');
  useEffect(() => { void loadOfficialIndex(); }, []);
  const all = useMemo(() => index?.packs ?? [], [index]);
  const categories = useMemo(() => [...new Set(all.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [all]);
  const shown = useMemo(() => all.filter((p) => (!category || p.category === category) && matchesSearch(text, p.name, p.description, p.category, p.collection, p.tags, p.items.map((i) => i.name), p.id)), [all, text, category]);
  const groups = useMemo(() => groupByCollection(shown), [shown]);

  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } finally { setBusy(''); } };
  const view = (p: OfficialEntry) => run(`v:${p.id}`, async () => { const bytes = await downloadOfficial(p); if (bytes) await onInspect(p, bytes); });
  const install = (p: OfficialEntry) => run(`i:${p.id}`, async () => reportInstall(await installOfficial(p, all)));
  const installAll = (name: string, packs: OfficialEntry[]) => run(`c:${name}`, async () => {
    const r = await installCollection(packs, all);
    if (r.cancelled) toast(`Instalação da coleção interrompida (${r.installed} pacote(s) instalado(s)).`);
    else if (r.failed.length) toast(`Coleção ${name}: ${r.installed} instalado(s); falhou: ${r.failed.join(' | ')}`, 'error');
    else toast(`Coleção ${name}: ${r.installed} pacote(s) instalado(s).`, 'success');
  });

  return (
    <section className="off" data-testid="official-catalog" aria-busy={loading}>
      <p className="hint">Pacotes oficiais do Recorte Studio. Cada volume é pequeno e independente: veja o conteúdo antes e instale só o que quiser. Depois de instalado, funciona offline e os itens aparecem misturados no catálogo (Personagens, Objetos, Cenários…), com o selo do pacote.</p>
      {loading && <p className="hint" role="status">Carregando o catálogo oficial…</p>}
      {error && (
        <div className="lib-error" role="alert" data-testid="official-error">
          Não foi possível carregar o catálogo oficial: {error}. Os pacotes já instalados continuam funcionando offline.{' '}
          <button type="button" className="btn btn-sm" data-testid="official-retry" onClick={() => void loadOfficialIndex(true)}><RefreshCw size={13} /> Tentar de novo</button>
        </div>
      )}
      {index && (
        <>
          <div className="off-tools">
            <SearchBox value={text} onChange={setText} placeholder="Buscar pacote, coleção ou item" testId="official-search" />
            <select className="cat-select" aria-label="Categoria do pacote" data-testid="official-category" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Todas as categorias</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="hint" data-testid="official-count">{shown.length} pacote(s) · {shown.reduce((s, p) => s + p.itemCount, 0)} item(ns)</span>
          </div>
          {groups.length === 0 && <p className="empty">Nenhum pacote com esse filtro.</p>}
          {groups.map((g) => {
            const todo = g.packs.filter((p) => ['available', 'update'].includes(officialStatus(p, installed)));
            return (
              <div key={g.name} className="off-group" data-testid="official-collection" data-collection={g.name}>
                <header className="off-group-head">
                  <div><h3>{g.name}</h3><small>{g.packs.length} pacote(s) · {g.items} item(ns)</small></div>
                  {g.packs.length > 1 && (todo.length > 0
                    ? <button type="button" className="btn btn-sm btn-primary" data-testid="official-install-collection" disabled={!!busy} onClick={() => void installAll(g.name, g.packs)}><Download size={13} /> Instalar a coleção ({todo.length})</button>
                    : <span className="hint"><Check size={13} /> Coleção instalada</span>)}
                </header>
                <div className="libh-grid is-packs">
                  {g.packs.map((p) => {
                    const st = officialStatus(p, installed);
                    return (
                      <article key={p.id} className={`libh-card off-card is-static${st === 'installed' ? ' is-done' : ''}`} data-testid="official-pack" data-pack={p.id} data-status={st}>
                        <span className="libh-thumb"><Cover svg={p.coverSvg} size={112} /></span>
                        <span className="libh-name" title={p.name}>{p.name}</span>
                        <small className="libh-sub">{p.volume ? `Vol. ${p.volume} · ` : ''}{p.category} · {p.itemCount} item(ns) · {fmtSize(p.size)}</small>
                        <small className="off-counts" data-testid="official-counts">{countsText(p)}</small>
                        <small className={`off-state is-${st}`} data-testid="official-state">{STATUS_TEXT[st]} · v{p.version}</small>
                        <div className="off-actions">
                          <button type="button" className="btn btn-sm" data-testid="official-view" disabled={!!busy} onClick={() => void view(p)}><Eye size={13} /> Ver conteúdo</button>
                          {(st === 'available' || st === 'update') && <button type="button" className="btn btn-sm btn-primary" data-testid="official-install" disabled={!!busy} onClick={() => void install(p)}>{st === 'update' ? <><RefreshCw size={13} /> Atualizar</> : <><Download size={13} /> Instalar</>}</button>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
