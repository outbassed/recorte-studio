/** Cartão de asset oficial não instalado: miniatura real, detalhes e instalação avulsa ou do volume. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CloudDownload, Download, Package } from 'lucide-react';
import type { OfficialEntry } from '@/features/packs/official';
import type { OfficialItemInfo } from '@/features/packs/marketplace';
import { loadMarketplacePreview, marketplacePreviewEntry, previewProject } from '@/features/packs/marketplacePreview';
import { installOfficial, installOfficialItem, reportInstall, usePacks } from '@/state/packActions';
import { toast } from '@/state/uiStore';
import { Modal } from '../dialogs/Modal';
import { EntryThumb } from '../panels/Catalog';
import { Cover } from './OfficialCatalog';

const KIND: Record<string, string> = { object: 'Objeto', background: 'Cenário', character: 'Personagem', pose: 'Pose' };

export function MarketplaceItemCard({ pack, item }: { pack: OfficialEntry; item: OfficialItemInfo }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof marketplacePreviewEntry>>>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const packs = usePacks((s) => s.packs);
  const disabledPack = packs.find((p) => !p.enabled && p.items.some((it) => it.id === item.id));

  useEffect(() => {
    if (item.thumbSvg) return; // Miniatura no índice: nenhum pacote precisa ser transferido para mostrar o card.
    let live = true;
    const load = () => {
      void loadMarketplacePreview(pack).then((p) => {
        if (!live) return;
        setPreview(marketplacePreviewEntry(pack, p, item.id));
      }).catch((e: unknown) => { if (live) setPreviewError(e instanceof Error ? e.message : 'Prévia indisponível'); });
    };
    const node = ref.current;
    if (node && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((changes) => {
        if (changes.some((c) => c.isIntersecting)) { observer.disconnect(); load(); }
      }, { rootMargin: '300px' });
      observer.observe(node);
      return () => { live = false; observer.disconnect(); };
    }
    load();
    return () => { live = false; };
  }, [pack, item.id, item.thumbSvg]);

  const kindText = KIND[item.kind] || item.kind;
  const thumb = useMemo(() => preview
    ? <EntryThumb e={preview} project={previewProject} size={104} />
    : item.thumbSvg
      ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.thumbSvg)}`} alt="" width={104} height={104} loading="lazy" className="marketplace-thumb" />
      : <Cover svg={pack.coverSvg} size={104} />, [preview, pack.coverSvg, item.thumbSvg]);

  const run = async (act: () => ReturnType<typeof installOfficialItem>) => {
    setBusy(true);
    try {
      reportInstall(await act());
    } catch (e) {
      toast(`Não foi possível instalar "${item.name}": ${e instanceof Error ? e.message : 'erro desconhecido'}.`, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button ref={ref} type="button" className="libh-card marketplace-card" data-testid="marketplace-item"
        data-name={item.name} data-pack={pack.id} data-kind={item.kind} data-item-id={item.id}
        aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span className="libh-thumb">{thumb}</span>
        <span className="libh-name">{item.name}</span>
        <small className="libh-sub">{kindText} · {item.category || pack.category}</small>
        <small className="libh-sub">{pack.collection || pack.name} · Disponível</small>
        <span className="marketplace-download"><CloudDownload size={14} /> Baixar</span>
      </button>
      {open && (
        <Modal title={item.name} size="lg" testId="marketplace-detail" closeTestId="marketplace-close" onClose={() => setOpen(false)}
          footer={<div className="libd-foot">
            <button type="button" className="btn btn-primary" data-testid="marketplace-install-item"
              disabled={busy || !!disabledPack} onClick={() => void run(() => installOfficialItem(pack, item.id))}>
              <Download size={15} /> {busy ? 'Instalando…' : 'Baixar somente este item'}
            </button>
            <button type="button" className="btn" data-testid="marketplace-install-pack"
              disabled={busy} onClick={() => void run(() => installOfficial(pack))}>
              <Package size={15} /> Instalar pacote completo ({pack.itemCount})
            </button>
          </div>}>
          <div className="libd">
            <div className="libd-preview">{preview
              ? <EntryThumb e={preview} project={previewProject} size={220} />
              : item.thumbSvg
                ? <img src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(item.thumbSvg)}`} alt="" width={240} height={240} className="marketplace-thumb is-large" />
                : <Cover svg={pack.coverSvg} size={180} />}
            </div>
            <div className="libd-info">
              <p className="libd-sub">{kindText} · Não instalado · {pack.name}</p>
              <dl className="cat-info">
                <dt>ID</dt><dd><code>{item.id}</code></dd>
                <dt>Categoria</dt><dd>{item.category || pack.category}{item.subcategory ? ` › ${item.subcategory}` : ''}</dd>
                <dt>Pacote</dt><dd>{pack.name} · v{pack.version}</dd>
                <dt>Coleção</dt><dd>{pack.collection || 'Avulsos'}</dd>
                <dt>Autor</dt><dd>{pack.author || 'Recorte Studio'}</dd>
                <dt>Licença</dt><dd>{pack.license}</dd>
              </dl>
              {disabledPack && <p className="hint">Você já baixou este item, mas o pacote está desativado. Ative-o na aba Pacotes.</p>}
              {previewError && <p className="hint">A prévia individual não carregou: {previewError}. A instalação pode ser tentada normalmente com conexão.</p>}
              <p className="hint">Baixar somente este item mantém os outros conteúdos do pacote fora da sua Biblioteca. O arquivo individual é verificado por SHA-256 antes de ser instalado.</p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
