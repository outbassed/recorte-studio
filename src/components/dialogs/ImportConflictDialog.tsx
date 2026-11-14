/**
 * Conflito de ID detectado ao importar um .rspack. Mostra, para cada conflito, o item existente e o importado
 * (ID, origem, pacote) e oferece: novo ID automático (recomendado), ID manual validado, ou não importar.
 * Nada é gravado aqui: o diálogo só devolve as escolhas.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { canSkipItem, describeHolder, type ItemConflict, type Resolutions } from '@/features/packs/conflicts';
import { innerIdOf } from '@/features/packs/format';
import { validateItemId, ITEM_ID_MAX } from '@/features/library/itemIds';
import type { ImportConflictRequest } from '@/state/uiStore';
import { Modal } from './Modal';

type Mode = 'new-id' | 'manual-id' | 'skip';
const KIND_TEXT: Record<string, string> = { object: 'Objeto', background: 'Cenário', character: 'Personagem', pose: 'Pose', prop: 'Objeto pronto' };
const REASON: Record<ItemConflict['reason'], string> = {
  'different-content': 'O ID é o mesmo, mas o conteúdo é diferente. Para não sobrescrever nada, este item precisa de outra identidade.',
  builtin: 'Este ID pertence a um item padrão do Recorte Studio, que é protegido e nunca é substituído.',
  'different-kind': 'O ID é o mesmo de um item de outro tipo. Para não confundir os dois, este item precisa de outra identidade.',
};

export function ImportConflictDialog({ req, onClose }: { req: ImportConflictRequest; onClose: () => void }) {
  const { prepared } = req;
  const { analysis, pack } = prepared;
  const [modes, setModes] = useState<Record<string, Mode>>(() => Object.fromEntries(analysis.conflicts.map((c) => [c.itemId, 'new-id' as Mode])));
  const [manual, setManual] = useState<Record<string, string>>({});
  const dupIds = useMemo(() => new Set(analysis.duplicates.map((d) => d.itemId)), [analysis]);
  const skipOk = useMemo(() => Object.fromEntries(analysis.conflicts.map((c) => [c.itemId, canSkipItem(pack.items.filter((i) => !dupIds.has(i.id)), c.itemId)])), [analysis, pack, dupIds]);
  const conflictIds = useMemo(() => new Set(analysis.conflicts.map((c) => c.itemId)), [analysis]);
  // IDs que o pacote mantém sem mudança: um ID manual não pode repetir nenhum deles.
  const keptIds = useMemo(() => new Set(pack.items.filter((i) => !conflictIds.has(i.id) && !dupIds.has(i.id)).map(innerIdOf)), [pack, conflictIds, dupIds]);

  const checkManual = (itemId: string) => {
    const raw = manual[itemId] ?? '';
    return validateItemId(raw, (id) => {
      const h = analysis.holders.get(id)?.[0];
      if (h) return h.name;
      if (keptIds.has(id)) return 'outro item deste pacote';
      for (const c of analysis.conflicts) if (c.itemId !== itemId && modes[c.itemId] === 'manual-id' && manual[c.itemId] === id) return 'outro item deste pacote';
      return undefined;
    });
  };
  const invalid = analysis.conflicts.filter((c) => modes[c.itemId] === 'manual-id' && !checkManual(c.itemId).ok);
  const skipped = analysis.conflicts.filter((c) => modes[c.itemId] === 'skip').length;

  const finish = (resolveAll: boolean) => {
    const resolutions: Resolutions = {};
    for (const c of analysis.conflicts) {
      const m = modes[c.itemId]!;
      resolutions[c.itemId] = m === 'manual-id' ? { action: 'manual-id', id: manual[c.itemId] ?? '' } : m === 'skip' ? { action: 'skip' } : { action: 'new-id' };
    }
    req.resolve({ resolutions, resolveAll });
    onClose();
  };
  const cancel = () => { req.resolve(null); onClose(); };

  return (
    <Modal title="Conflito de ID detectado" size="lg" testId="import-conflict-dialog" onClose={cancel} footer={<>
      <button type="button" className="btn" data-testid="conflict-cancel" onClick={cancel}>Cancelar importação</button>
      <button type="button" className="btn" data-testid="conflict-all-auto" onClick={() => finish(true)}>Resolver todos automaticamente</button>
      <button type="button" className="btn btn-primary" data-testid="conflict-confirm" disabled={invalid.length > 0} onClick={() => finish(false)}>Importar com estas escolhas</button>
    </>}>
      <div className="conf">
        <p className="conf-intro" role="alert"><AlertTriangle size={16} aria-hidden="true" /> <span><strong>{analysis.conflicts.length} item(ns)</strong> de “{pack.manifest.name}”{pack.manifest.version ? ` ${pack.manifest.version}` : ''} usam um ID que já existe na sua Biblioteca. Nada será sobrescrito: a troca de ID vale só para a cópia importada e o arquivo do pacote não é alterado.</span></p>
        {analysis.conflicts.map((c) => {
          const mode = modes[c.itemId]!;
          const check = mode === 'manual-id' ? checkManual(c.itemId) : null;
          const can = skipOk[c.itemId]!;
          return (
            <section key={c.itemId} className="conf-card" data-testid="conflict-item" data-id={c.innerId}>
              <h3>{c.name} <small>{KIND_TEXT[c.kind] ?? c.kind}</small></h3>
              <div className="conf-pair">
                <div data-testid="conflict-existing">
                  <strong>Item existente</strong>
                  <span>{c.existing.name} · {KIND_TEXT[c.existing.kind] ?? c.existing.kind}</span>
                  <span>Origem: {describeHolder(c.existing)}</span>
                  <span>ID: <code>{c.innerId}</code></span>
                </div>
                <div data-testid="conflict-incoming">
                  <strong>Item importado</strong>
                  <span>{c.name} · {KIND_TEXT[c.kind] ?? c.kind}</span>
                  <span>{pack.manifest.version ? 'Pacote' : 'Arquivo'}: {pack.manifest.name} {pack.manifest.version}</span>
                  <span>ID: <code>{c.innerId}</code></span>
                </div>
              </div>
              {c.holders.length > 1 && <p className="hint">Mais {c.holders.length - 1} item(ns) já usam este mesmo ID.</p>}
              <p className="hint">{REASON[c.reason]}</p>
              <div className="conf-opts" role="radiogroup" aria-label={`O que fazer com ${c.name}`}>
                <label><input type="radio" name={`m-${c.itemId}`} data-testid="conflict-mode-new" checked={mode === 'new-id'} onChange={() => setModes((m) => ({ ...m, [c.itemId]: 'new-id' }))} /> <span><strong>Gerar novo ID automaticamente</strong> <em>(recomendado)</em><br /><small>Cria outro UUID livre e atualiza as referências internas do pacote.</small></span></label>
                <label><input type="radio" name={`m-${c.itemId}`} data-testid="conflict-mode-manual" checked={mode === 'manual-id'} onChange={() => setModes((m) => ({ ...m, [c.itemId]: 'manual-id' }))} /> <span><strong>Definir ID manualmente</strong><br /><small>De 1 a {ITEM_ID_MAX} caracteres: letras sem acento, números e hífen. Maiúsculas e minúsculas são IDs diferentes.</small></span></label>
                {mode === 'manual-id' && (
                  <div className="conf-manual">
                    <input className="input" data-testid="conflict-manual-input" aria-label={`Novo ID para ${c.name}`} aria-invalid={check ? !check.ok : undefined} value={manual[c.itemId] ?? ''} maxLength={ITEM_ID_MAX + 20} autoFocus spellCheck={false} onChange={(e) => setManual((m) => ({ ...m, [c.itemId]: e.target.value }))} />
                    <small className={check?.ok ? 'conf-ok' : 'lib-error'} data-testid="conflict-manual-status" role="status">{(manual[c.itemId] ?? '') === '' ? 'Digite o novo ID.' : check?.ok ? 'ID disponível.' : check && !check.ok ? check.message : ''}</small>
                  </div>
                )}
                <label className={can.ok ? '' : 'is-off'}><input type="radio" name={`m-${c.itemId}`} data-testid="conflict-mode-skip" disabled={!can.ok} checked={mode === 'skip'} onChange={() => setModes((m) => ({ ...m, [c.itemId]: 'skip' }))} /> <span><strong>Não importar este item</strong><br /><small>{can.ok ? 'Os demais itens do pacote continuam funcionando.' : `Indisponível: ${can.reason}`}</small></span></label>
              </div>
            </section>
          );
        })}
        {skipped > 0 && <p className="hint">{skipped} item(ns) não serão importados.</p>}
        {analysis.duplicates.length > 0 && <p className="hint" data-testid="conflict-duplicates">{analysis.duplicates.length} item(ns) já existem com o mesmo ID e o mesmo conteúdo e serão reconhecidos como duplicata (não são importados de novo).</p>}
        {analysis.sameNameOtherId.length > 0 && <p className="hint">{analysis.sameNameOtherId.length} item(ns) têm o mesmo nome de itens existentes, mas IDs diferentes: entram normalmente.</p>}
      </div>
    </Modal>
  );
}
