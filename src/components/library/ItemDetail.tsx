/**
 * Popup de detalhes de um item da Biblioteca (substitui o painel lateral). Reutilizável por todos os tipos de item:
 * personagem, objeto, cenário, pose, sequência e cena, de qualquer origem (padrão, meu, pacote).
 * Desktop: popup centralizado (até ~950 px, 85% da altura, rolagem interna). Celular: ocupa a tela.
 * Fecha pelo X, pela tecla Esc e por clique fora; o foco é preso no popup e volta ao cartão de origem.
 */
import { useState } from 'react';
import { Copy, Download, Pencil, Star, Trash2 } from 'lucide-react';
import type { Project } from '@/engine/model/schema';
import { KIND_LABELS, ORIGIN_LABELS, type CatalogEntry, type CatalogKind } from '@/features/catalog/catalog';
import { isLegacyItemId, isUuidV4 } from '@/features/library/itemIds';
import { canEdit, insertEntry, saveEntryToLibrary, toggleFavorite, useLibrary } from '@/state/catalogActions';
import { changeItemId, copyToMyLibrary, deleteRecord, duplicateRecord, editInLibrary, exportRecords, recordBytes, renameRecord } from '@/state/libraryHomeActions';
import { usePacks } from '@/state/packActions';
import { closeOverlay, toast } from '@/state/uiStore';
import { Modal } from '../dialogs/Modal';
import { DetailPreview, policyText } from '../panels/Catalog';

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${Math.round(n / 1024)} KB` : `${(n / 1024 / 1024).toFixed(1).replace('.', ',')} MB`);

export const COMPAT: Record<CatalogKind, string> = {
  character: 'Criador de Personagens (8 vistas, rig humano padrão). Recorte Studio 1.2 ou mais novo',
  pose: 'Personagens com o rig humano padrão',
  sequence: 'Qualquer personagem selecionado (passos editáveis na timeline)',
  prop: 'Objeto pronto do app (cores e estados)',
  object: 'Objeto montado (formato de biblioteca v2, com imagens e objetos usados)',
  background: 'Cenário personalizado (horários, formato v2)',
  scene: 'Cena completa com o elenco dela',
};

type Packs = ReturnType<typeof usePacks.getState>['packs'];
type Records = ReturnType<typeof useLibrary.getState>['records'];

/** Dependências do item: objetos e imagens que ele traz junto e pacotes exigidos pelo pacote de origem. */
export function dependenciesOf(e: CatalogEntry, packs: Packs): string[] {
  const out: string[] = [];
  const nested = e.objectBundle?.objects ?? e.backgroundBundle?.objects ?? [];
  if (nested.length) out.push(`Objetos usados (já vêm junto): ${nested.map((o) => o.name).join(', ')}`);
  const imgs = (e.objectBundle?.assets ?? e.backgroundBundle?.assets ?? []).length;
  if (imgs) out.push(`${imgs} imagem(ns) embutida(s) no item`);
  const pack = e.packId ? packs.find((p) => p.id === e.packId) : undefined;
  for (const d of pack?.manifest.dependencies ?? []) out.push(`Pacote ${d.id} ${d.version} ou mais novo (${packs.some((p) => p.id === d.id) ? 'instalado' : 'ausente'})`);
  return out;
}

/** Metadados exibidos, conforme a origem. */
export function metaOf(e: CatalogEntry, packs: Packs, records: Records) {
  const pack = e.packId ? packs.find((p) => p.id === e.packId) : undefined;
  const rec = e.ref.type === 'library' ? records.find((r) => r.id === (e.ref as { libId: string }).libId) : undefined;
  const assets = (e.objectBundle?.assets ?? e.backgroundBundle?.assets ?? []).reduce((s, a) => s + (a.size || 0), 0);
  const creator = e.origin === 'builtin' ? 'Recorte Studio' : e.origin === 'pack' ? pack?.manifest.author || pack?.name || 'Pacote' : e.origin === 'mine' ? 'Você' : 'Este projeto';
  const license = e.origin === 'builtin' ? 'Original do Recorte Studio (livre nos seus projetos)' : e.origin === 'pack' ? pack?.manifest.license ?? '—' : 'Sua criação';
  const version = e.origin === 'pack' ? `${pack?.version ?? '—'} (pacote)` : e.origin === 'builtin' ? 'Embutido no app' : e.updatedAt ? `Atualizado em ${new Date(e.updatedAt).toLocaleDateString('pt-BR')}` : '—';
  const size = e.origin === 'builtin' ? 'Embutido no app' : fmtSize(recordBytes(rec?.data ?? e.objectBundle ?? e.backgroundBundle ?? e.character ?? e.pose ?? e.sceneData ?? {}, assets));
  const anims = e.kind === 'object' && e.states.length ? e.states.map((s) => s.label).join(', ') : e.kind === 'prop' && e.states.length ? `Estados: ${e.states.map((s) => s.label).join(', ')}` : 'Nenhuma';
  const views = e.kind === 'character' ? '8 vistas (frente, lados, costas e diagonais)' : e.kind === 'background' ? (e.ref.type === 'builtin-background' ? 'Dia e noite' : `Horários: ${(e.times ?? []).length || 'nenhum'}`) : e.kind === 'pose' ? 'Frente (aplicável em qualquer vista)' : 'Uma vista';
  const packLine = pack ? `${pack.name} ${pack.version}${pack.source === 'official' ? ' · oficial' : ' · importado'}` : '—';
  return { creator, license, version, size, anims, views, packLine, pack };
}

function IdLine({ id }: { id: string }) {
  const kind = isUuidV4(id) ? 'UUID v4' : isLegacyItemId(id) ? 'ID legado (mantido por compatibilidade)' : 'ID personalizado';
  return (
    <span className="libd-id">
      <code data-testid="library-id">{id}</code>
      <span className="libd-badge">{kind}</span>
      <button type="button" className="btn btn-sm" data-testid="library-copy-id" onClick={() => { void navigator.clipboard?.writeText(id).then(() => toast('ID copiado.', 'success'), () => toast('Não foi possível copiar o ID.', 'error')); }}>Copiar</button>
    </span>
  );
}

export function ItemDetailPopup({ e, project, inEditor, onClose }: { e: CatalogEntry; project: Project; inEditor: boolean; onClose: () => void }) {
  const packs = usePacks((s) => s.packs);
  const records = useLibrary((s) => s.records);
  const [busy, setBusy] = useState(false);
  const m = metaOf(e, packs, records);
  const deps = dependenciesOf(e, packs);
  const libId = e.ref.type === 'library' ? e.ref.libId : null;
  const copyable = !e.editable && !e.broken && ['builtin-character', 'builtin-prop', 'builtin-object', 'pack-item'].includes(e.ref.type);
  const tags = [...new Set([...(e.tags ?? []), ...e.keywords].filter(Boolean))].slice(0, 12);
  const run = async (fn: () => Promise<unknown>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const useLabel = e.kind === 'pose' || e.kind === 'sequence' ? 'Aplicar ao selecionado' : e.kind === 'background' ? 'Usar nesta cena' : e.kind === 'scene' ? 'Adicionar como nova cena' : 'Inserir na cena';
  return (
    <Modal title={e.name} size="xl" backdrop="soft" testId="library-detail" closeTestId="library-detail-close" onClose={onClose} footer={(
      <div className="libd-foot" data-testid="library-actions">
        {inEditor && !e.broken && <button type="button" className="btn btn-primary" data-testid="library-insert" disabled={busy} onClick={() => void run(async () => { if (await insertEntry(e)) { onClose(); closeOverlay(); } })}>{useLabel}</button>}
        {canEdit(e) && <button type="button" className="btn" data-testid="library-edit" disabled={busy} onClick={() => void editInLibrary(e)}><Pencil size={14} /> {e.editable ? 'Editar' : 'Editar uma cópia'}</button>}
        {copyable && <button type="button" className="btn" data-testid="library-copy" disabled={busy} onClick={() => void run(async () => { if (await copyToMyLibrary(e)) onClose(); })}><Copy size={14} /> Copiar para minha biblioteca</button>}
        {inEditor && e.origin === 'project' && <button type="button" className="btn" data-testid="library-save" disabled={busy} onClick={() => void saveEntryToLibrary(e)}>{e.libId ? 'Atualizar na biblioteca' : 'Salvar na biblioteca'}</button>}
        <button type="button" className="btn" data-testid="library-favorite" aria-pressed={e.favorite} onClick={() => void toggleFavorite(e)}><Star size={14} fill={e.favorite ? 'currentColor' : 'none'} /> {e.favorite ? 'Favorito' : 'Favoritar'}</button>
        {libId && <>
          <button type="button" className="btn" data-testid="library-duplicate" disabled={busy} onClick={() => void run(() => duplicateRecord(libId))}>Duplicar</button>
          <button type="button" className="btn" data-testid="library-rename" disabled={busy} onClick={() => void renameRecord(libId)}>Renomear</button>
          <button type="button" className="btn" data-testid="library-change-id" disabled={busy} onClick={() => void changeItemId(libId)}>Alterar ID</button>
          <button type="button" className="btn" data-testid="library-export" onClick={() => { const r = records.find((x) => x.id === libId); if (r) exportRecords([r], `${r.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'item'}.biblioteca.json`); }}><Download size={14} /> Exportar</button>
          <button type="button" className="btn btn-danger" data-testid="library-delete" disabled={busy} onClick={async () => { if (await deleteRecord(libId)) onClose(); }}><Trash2 size={14} /> Apagar</button>
        </>}
      </div>
    )}>
      <div className="libd" data-key={e.key} data-testid="library-detail-body" aria-label={`Detalhes de ${e.name}`}>
        <div className="libd-preview"><DetailPreview e={e} project={project} /></div>
        <div className="libd-info">
          <p className="libd-sub">{KIND_LABELS[e.kind]} · {ORIGIN_LABELS[e.origin]}{e.packName ? ` · ${e.packName}` : ''}</p>
          {e.description && <p data-testid="library-description">{e.description}</p>}
          <dl className="cat-info" data-testid="library-meta">
            <dt>Nome</dt><dd data-testid="library-name">{e.name}</dd>
            <dt>ID</dt><dd><IdLine id={e.id} /></dd>
            <dt>Tipo</dt><dd>{KIND_LABELS[e.kind]}</dd>
            <dt>Categoria</dt><dd>{e.category}{e.subcategory ? ` › ${e.subcategory}` : ''}</dd>
            <dt>Origem</dt><dd data-testid="library-origin">{ORIGIN_LABELS[e.origin]}{e.official ? ' (oficial)' : ''}</dd>
            <dt>Pacote</dt><dd data-testid="library-pack">{m.packLine}</dd>
            <dt>Coleção</dt><dd data-testid="library-collection">{e.collection ?? '—'}</dd>
            <dt>Criador</dt><dd>{m.creator}</dd>
            <dt>Licença</dt><dd data-testid="library-license">{m.license}</dd>
            <dt>Versão</dt><dd>{m.version}</dd>
            <dt>Compatibilidade</dt><dd>{COMPAT[e.kind]}</dd>
            <dt>Tamanho</dt><dd>{m.size}</dd>
            <dt>Vistas</dt><dd>{m.views}</dd>
            <dt>Animações</dt><dd data-testid="library-anims">{m.anims}</dd>
            <dt>Dependências</dt><dd data-testid="library-deps">{deps.length ? <ul>{deps.map((d) => <li key={d}>{d}</li>)}</ul> : 'Nenhuma: o item é autossuficiente.'}</dd>
          </dl>
          {tags.length > 0 && <div className="libd-tags" aria-label="Palavras-chave">{tags.map((t) => <span key={t}>{t}</span>)}</div>}
          <p className="hint">{policyText(e)}</p>
          {e.broken && <p className="lib-error" role="alert">Formato incompatível: {e.broken}</p>}
        </div>
      </div>
    </Modal>
  );
}
