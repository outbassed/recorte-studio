/** Gerenciar pacotes opcionais (aba Biblioteca): importar, ativar/desativar, exportar e remover. */
import { useEffect, useRef, useState } from 'react';
import { Download, FileUp, Package, Trash2 } from 'lucide-react';
import { PACK_EXT } from '@/features/packs/format';
import { DEMO_PACK_ID } from '@/features/packs/demo';
import { exportPack, installDemoPack, installPackFile, reloadPacks, removePack, reportInstall, setPackEnabled, usePacks } from '@/state/packActions';
import { IconButton } from '../controls/fields';

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

export function PacksSection() {
  const packs = usePacks((s) => s.packs);
  const loaded = usePacks((s) => s.loaded);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => { void reloadPacks(); }, []);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const hasDemo = packs.some((p) => p.id === DEMO_PACK_ID);
  return (
    <section className="packs" data-testid="packs-section" aria-busy={busy}>
      <h3 className="group-title"><Package size={12} /> Pacotes opcionais</h3>
      <p className="hint">Conjuntos de objetos e cenários que você instala neste navegador ({PACK_EXT}). Ativos aparecem no catálogo com o selo Pacote. Projetos guardam a própria cópia do que usam: desativar ou remover não muda nenhum projeto.</p>
      <div className="btn-row">
        <button type="button" className="btn btn-sm" data-testid="pack-import" disabled={busy} onClick={() => file.current?.click()}><FileUp size={14} /> Importar pacote</button>
        {!hasDemo && <button type="button" className="btn btn-sm" data-testid="pack-demo" disabled={busy} onClick={() => void run(async () => reportInstall(await installDemoPack()))}>Instalar pacote de demonstração</button>}
      </div>
      <input ref={file} hidden type="file" accept=".rspack,.zip" data-testid="pack-input" onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) void run(async () => reportInstall(await installPackFile(f)));
      }} />
      {!loaded && <p className="hint" role="status">Lendo pacotes…</p>}
      {loaded && packs.length === 0 && <p className="empty">Nenhum pacote instalado.</p>}
      <ul className="pack-list">
        {packs.map((p) => (
          <li key={p.id} className={`pack-row${p.enabled ? '' : ' is-off'}`} data-testid="pack-row" data-pack={p.id} data-enabled={p.enabled ? '1' : '0'}>
            <div className="pack-main">
              <strong>{p.name}</strong>
              <small>v{p.version} · {p.items.length} item(ns) · {kb(p.size)} · {p.manifest.category}</small>
              <small>Licença: {p.manifest.license}{p.manifest.author ? ` · ${p.manifest.author}` : ''}</small>
              {p.manifest.dependencies.length > 0 && <small>Depende de: {p.manifest.dependencies.map((d) => `${d.id} ${d.version}+`).join(', ')}</small>}
            </div>
            <label className="anim-check"><input type="checkbox" data-testid="pack-enabled" checked={!!p.enabled} disabled={busy} onChange={(e) => void run(() => setPackEnabled(p.id, e.target.checked))} /> Ativo</label>
            <IconButton label={`Exportar ${p.name}`} testId="pack-export" onClick={() => void exportPack(p.id)}><Download size={14} /></IconButton>
            <IconButton label={`Remover ${p.name}`} danger testId="pack-remove" onClick={() => void run(async () => { await removePack(p.id); })}><Trash2 size={14} /></IconButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
