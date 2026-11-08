/**
 * Ciclo de vida dos pacotes: instalar (transacional), atualizar, ativar/desativar, remover, exportar.
 * Usar um item de pacote COPIA o item (com imagens) para o projeto: desativar ou remover o pacote
 * nunca muda nem quebra um projeto. Itens de pacote são protegidos: editar cria cópia.
 */
import { create } from 'zustand';
import { buildPack, compareVersions, PACK_EXT, readPack } from '@/features/packs/format';
import { buildDemoPack } from '@/features/packs/demo';
import { registerAssetBlob } from '@/features/library/assets';
import { db, repo, StorageQuotaError, type PackRecord } from '@/storage/db';
import { confirmDialog, toast } from './uiStore';

interface PacksState { packs: PackRecord[]; loaded: boolean }
export const usePacks = create<PacksState>(() => ({ packs: [], loaded: false }));

export async function reloadPacks(): Promise<void> {
  try {
    const packs = await repo.listPacks();
    usePacks.setState({ packs: packs.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), loaded: true });
    // Miniaturas e inserção usam as imagens já guardadas.
    for (const p of packs) for (const a of p.assets) {
      const blob = await repo.getBlob(a.id).catch(() => undefined);
      if (blob) try { registerAssetBlob(a.id, blob); } catch { /* imagem ilegível: a miniatura mostra o aviso de imagem ausente */ }
    }
  } catch {
    usePacks.setState({ loaded: true });
  }
}

export type InstallResult = { ok: true; id: string; updated: boolean } | { ok: false; reason: string };

/** Valida tudo antes; grava mídias e o registro; desfaz o que gravou se algo falhar no meio. */
export async function installPackBytes(bytes: Uint8Array): Promise<InstallResult> {
  const read = await readPack(bytes);
  if (!read.ok) return read;
  const { manifest, items, media, size } = read.pack;
  for (const d of manifest.dependencies) {
    const dep = await repo.getPack(d.id);
    if (!dep) return { ok: false, reason: `Este pacote precisa do pacote "${d.id}" (${d.version} ou mais novo). Instale-o antes.` };
    if (compareVersions(dep.version, d.version) < 0) return { ok: false, reason: `Este pacote precisa de "${dep.name}" ${d.version} ou mais novo (instalado: ${dep.version}).` };
  }
  const existing = await repo.getPack(manifest.id);
  if (existing) {
    const c = compareVersions(manifest.version, existing.version);
    if (c === 0) return { ok: false, reason: `"${existing.name}" ${existing.version} já está instalado.` };
    if (c < 0) return { ok: false, reason: `Já existe uma versão mais nova de "${existing.name}" instalada (${existing.version}).` };
  }
  const est = await repo.storageEstimate().catch(() => null);
  if (est && est.quota && est.usage + size * 2 > est.quota) return { ok: false, reason: 'Não há espaço suficiente no armazenamento do navegador para este pacote.' };
  const added: string[] = [];
  try {
    for (const m of media) {
      if (await repo.hasBlob(m.asset.id)) continue;
      await repo.putBlob(m.asset.id, new Blob([m.bytes as Uint8Array<ArrayBuffer>], { type: m.asset.mime }), m.asset.name);
      added.push(m.asset.id);
    }
    await repo.putPack({
      id: manifest.id, name: manifest.name, version: manifest.version, enabled: existing ? existing.enabled : 1,
      installedAt: Date.now(), size, manifest, items, assets: media.map((m) => m.asset),
    });
  } catch (e) {
    // Reverte: nenhuma mídia órfã de uma instalação pela metade.
    await db.blobs.bulkDelete(added).catch(() => undefined);
    return { ok: false, reason: e instanceof StorageQuotaError ? e.message : `Falha ao gravar o pacote: ${e instanceof Error ? e.message : 'erro'}` };
  }
  await reloadPacks();
  return { ok: true, id: manifest.id, updated: !!existing };
}

export async function installPackFile(file: File): Promise<InstallResult> {
  if (!/\.(rspack|zip)$/i.test(file.name)) return { ok: false, reason: `Escolha um arquivo ${PACK_EXT}.` };
  return installPackBytes(new Uint8Array(await file.arrayBuffer()));
}

export const installDemoPack = async (version?: string) => installPackBytes(await buildDemoPack(version));

export function reportInstall(r: InstallResult): void {
  if (r.ok) {
    const p = usePacks.getState().packs.find((x) => x.id === r.id);
    toast(`${r.updated ? 'Pacote atualizado' : 'Pacote instalado'}: ${p?.name ?? r.id} ${p?.version ?? ''}. Os itens aparecem no catálogo com o selo Pacote.`, 'success');
  } else toast(`Não foi possível instalar: ${r.reason}`, 'error');
}

export async function setPackEnabled(id: string, enabled: boolean): Promise<void> {
  // Interface responde na hora; o banco grava logo em seguida (e recarrega se falhar).
  usePacks.setState((st) => ({ packs: st.packs.map((x) => (x.id === id ? { ...x, enabled: enabled ? 1 : 0 } : x)) }));
  const p = await repo.getPack(id);
  if (!p) { await reloadPacks(); return; }
  await repo.putPack({ ...p, enabled: enabled ? 1 : 0 });
  await reloadPacks();
  toast(enabled ? `"${p.name}" ativado.` : `"${p.name}" desativado: some das opções de inserção. Projetos que já usam os itens dele não mudam.`);
}

export async function removePack(id: string): Promise<boolean> {
  const p = await repo.getPack(id);
  if (!p) return false;
  const dependents = (await repo.listPacks()).filter((x) => x.manifest.dependencies.some((d) => d.id === id));
  if (dependents.length) {
    toast(`"${p.name}" é usado por: ${dependents.map((d) => d.name).join(', ')}. Remova esses pacotes antes.`, 'error');
    return false;
  }
  const ok = await confirmDialog({
    title: 'Remover pacote',
    message: `Remover "${p.name}" ${p.version} deste navegador? Os projetos que já usam itens dele guardam a própria cópia (com as imagens) e continuam iguais. Para usar de novo, importe o pacote outra vez.`,
    confirmLabel: 'Remover pacote', danger: true,
  });
  if (!ok) return false;
  await repo.deletePack(id);
  // Só apaga imagens que nenhum projeto, biblioteca ou outro pacote usa.
  await repo.collectOrphanBlobs();
  await reloadPacks();
  toast(`"${p.name}" removido.`);
  return true;
}

/** Reempacota um pacote instalado (para levar a outro navegador). */
export async function exportPackBytes(id: string): Promise<{ name: string; bytes: Uint8Array } | null> {
  const p = await repo.getPack(id);
  if (!p) return null;
  const media: Array<{ bytes: Uint8Array; mime: string; ext: string }> = [];
  for (const a of p.assets) {
    const blob = await repo.getBlob(a.id);
    if (!blob) { toast(`A imagem ${a.name} não está mais neste navegador; não dá para exportar o pacote.`, 'error'); return null; }
    media.push({ bytes: new Uint8Array(await blob.arrayBuffer()), mime: a.mime, ext: a.mime === 'image/svg+xml' ? 'svg' : a.mime.split('/')[1] ?? 'bin' });
  }
  const { format: _f, formatVersion: _v, items: _i, media: _m, ...meta } = p.manifest;
  const bytes = await buildPack(meta, p.items.map((it) => ({ id: it.id, kind: it.kind, name: it.name, data: it.data })), media);
  return { name: `${p.id}-${p.version}${PACK_EXT}`, bytes };
}

export async function exportPack(id: string): Promise<void> {
  const out = await exportPackBytes(id);
  if (!out) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([out.bytes as Uint8Array<ArrayBuffer>], { type: 'application/zip' }));
  a.download = out.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
