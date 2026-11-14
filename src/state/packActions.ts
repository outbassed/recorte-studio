/**
 * Ciclo de vida dos pacotes: instalar (transacional), atualizar, ativar/desativar, remover, exportar.
 * Usar um item de pacote COPIA o item (com imagens) para o projeto: desativar ou remover o pacote
 * nunca muda nem quebra um projeto. Itens de pacote são protegidos: editar cria cópia.
 */
import { create } from 'zustand';
import { buildPack, compareVersions, PACK_EXT, readPack, type PackManifest, type ParsedPack } from '@/features/packs/format';
import { buildDemoPack } from '@/features/packs/demo';
import { analyzeImport, planImport, separatePackId, type ImportAnalysis, type PackSource, type PlanResult, type Resolutions } from '@/features/packs/conflicts';
import { builtinIds } from '@/features/packs/builtinIds';
import { registerAssetBlob } from '@/features/library/assets';
import { sha256Hex } from '@/features/library/media';
import { db, repo, StorageQuotaError, type PackRecord } from '@/storage/db';
import { askImportConflicts, confirmDialog, toast } from './uiStore';

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

export interface InstallSummary { items: number; autoIds: number; duplicates: number; skipped: number; separate: boolean }
export type InstallResult =
  | { ok: true; id: string; updated: boolean; summary: InstallSummary }
  | { ok: false; reason: string; cancelled?: boolean; /** Há conflitos de ID que precisam de uma escolha. */ analysis?: ImportAnalysis };

export interface PreparedInstall { pack: ParsedPack; bytes: Uint8Array; sha256: string; source: PackSource; analysis: ImportAnalysis; asSeparatePack: boolean }
export type PrepareResult = { ok: true; prepared: PreparedInstall } | { ok: false; reason: string };

export interface InstallOptions {
  /** 'official' só quando o arquivo veio do catálogo do app e o sha256 conferiu com o índice. */
  source?: PackSource;
  asSeparatePack?: boolean;
  resolutions?: Resolutions;
  /** Opção D: conflitos sem escolha ganham um novo ID automático. */
  resolveAll?: boolean;
}

/**
 * Lê e valida o pacote e analisa os IDs, sem gravar nada. Recusa na hora o que não tem conserto por escolha do usuário
 * (arquivo inválido, dependência ausente, versão igual ou mais velha da já instalada).
 */
export async function prepareInstall(bytes: Uint8Array, opts: InstallOptions = {}, onProgress?: (done: number, total: number) => void): Promise<PrepareResult> {
  const read = await readPack(bytes, onProgress);
  if (!read.ok) return read;
  const { manifest } = read.pack;
  for (const d of manifest.dependencies) {
    const dep = await repo.getPack(d.id);
    if (!dep) return { ok: false, reason: `Este pacote precisa do pacote "${d.id}" (${d.version} ou mais novo). Instale-o antes.` };
    if (compareVersions(dep.version, d.version) < 0) return { ok: false, reason: `Este pacote precisa de "${dep.name}" ${d.version} ou mais novo (instalado: ${dep.version}).` };
  }
  const sha256 = (await sha256Hex(bytes)) ?? '';
  const source: PackSource = opts.source ?? 'imported';
  const [packs, library] = await Promise.all([repo.listPacks(), repo.listLibrary()]);
  const analysis = analyzeImport(read.pack, { packs, library, builtin: builtinIds(), incomingSource: source, incomingSha256: sha256, asSeparatePack: opts.asSeparatePack });
  const ex = analysis.existingPack;
  if (ex && !analysis.packConflict) {
    if (analysis.status === 'older') return { ok: false, reason: `Já existe uma versão mais nova de "${ex.name}" instalada (${ex.version}).` };
    if (analysis.status === 'identical') return { ok: false, reason: `"${ex.name}" ${ex.version} já está instalado.` };
  }
  if (ex && analysis.status === 'older') return { ok: false, reason: `Já existe uma versão mais nova de "${ex.name}" instalada (${ex.version}).` };
  return { ok: true, prepared: { pack: read.pack, bytes, sha256, source, analysis, asSeparatePack: !!opts.asSeparatePack } };
}

/** Grava o plano: mídias e registro, tudo ou nada. */
export async function commitInstall(prepared: PreparedInstall, plan: Extract<PlanResult, { ok: true }>): Promise<InstallResult> {
  const { pack, analysis } = prepared;
  const manifestId = prepared.asSeparatePack ? separatePackId(pack.manifest.id) : pack.manifest.id;
  const existing = analysis.existingPack;
  if (plan.items.length === 0) return { ok: false, reason: 'Nenhum item restou para instalar (todos eram duplicatas ou foram pulados).' };
  // Só entram as imagens usadas pelos itens mantidos.
  const used = new Set(plan.items.flatMap((it) => (it.kind === 'object' || it.kind === 'background' ? it.data.assets.map((a) => a.id) : [])));
  const media = pack.media.filter((m) => used.has(m.asset.id));
  const est = await repo.storageEstimate().catch(() => null);
  if (est && est.quota && est.usage + prepared.bytes.length * 2 > est.quota) return { ok: false, reason: 'Não há espaço suficiente no armazenamento do navegador para este pacote.' };
  const keepIds = new Set(plan.items.map((it) => it.id));
  const renamed = new Map(Object.entries(plan.idMap));
  const manifest: PackManifest = {
    ...pack.manifest, id: manifestId,
    // Os itens do manifesto guardado seguem o que foi instalado (IDs finais); file/sha256 continuam os do arquivo de origem.
    items: pack.manifest.items.filter((i) => keepIds.has(i.id) || keepIds.has(renamed.get(i.id) ?? '')).map((i) => ({ ...i, id: renamed.get(i.id) ?? i.id })),
  };
  const added: string[] = [];
  try {
    for (const m of media) {
      if (await repo.hasBlob(m.asset.id)) continue;
      await repo.putBlob(m.asset.id, new Blob([m.bytes as Uint8Array<ArrayBuffer>], { type: m.asset.mime }), m.asset.name);
      added.push(m.asset.id);
    }
    await repo.putPack({
      id: manifestId, name: pack.manifest.name, version: pack.manifest.version, enabled: existing ? existing.enabled : 1,
      installedAt: Date.now(), size: prepared.bytes.length, manifest, items: plan.items, assets: media.map((m) => m.asset),
      source: prepared.source, fileSha256: prepared.sha256, idMap: Object.keys(plan.idMap).length ? plan.idMap : undefined,
    });
  } catch (e) {
    // Reverte: nenhuma mídia órfã de uma instalação pela metade.
    await db.blobs.bulkDelete(added).catch(() => undefined);
    return { ok: false, reason: e instanceof StorageQuotaError ? e.message : `Falha ao gravar o pacote: ${e instanceof Error ? e.message : 'erro'}` };
  }
  await reloadPacks();
  return { ok: true, id: manifestId, updated: !!existing, summary: { items: plan.items.length, autoIds: plan.autoIds, duplicates: plan.duplicates.length, skipped: plan.skipped.length, separate: prepared.asSeparatePack } };
}

/**
 * Instalação NÃO interativa (testes, automação): sem conflitos instala direto; com conflitos só segue se vierem
 * `resolutions` ou `resolveAll`. Caso contrário recusa e devolve a análise. Nunca sobrescreve em silêncio.
 */
export async function installPackBytes(bytes: Uint8Array, opts: InstallOptions = {}): Promise<InstallResult> {
  const p = await prepareInstall(bytes, opts);
  if (!p.ok) return p;
  const { prepared } = p;
  if (prepared.analysis.packConflict && !opts.asSeparatePack) {
    return { ok: false, reason: 'Conflito de ID de pacote: já existe um pacote com este ID e origem diferente (ou mesma versão com conteúdo diferente). Instale como pacote separado ou cancele.', analysis: prepared.analysis };
  }
  const { analysis } = prepared;
  if (analysis.conflicts.length && !opts.resolutions && !opts.resolveAll) {
    return { ok: false, reason: `Conflito de ID detectado em ${analysis.conflicts.length} item(ns). Escolha o que fazer com cada um.`, analysis };
  }
  const plan = planImport(prepared.pack, analysis, opts.resolutions ?? {}, { resolveAll: opts.resolveAll });
  if (!plan.ok) return { ok: false, reason: plan.errors.join(' '), analysis };
  return commitInstall(prepared, plan);
}

/** Instalação interativa: mostra os diálogos de conflito e instala o que o usuário escolher. */
export async function installInteractive(bytes: Uint8Array, opts: InstallOptions = {}): Promise<InstallResult> {
  let p = await prepareInstall(bytes, opts);
  if (!p.ok) return p;
  if (p.prepared.analysis.packConflict) {
    const c = p.prepared.analysis.packConflict;
    const ok = await confirmDialog({
      title: 'Conflito de ID de pacote',
      message: c.kind === 'origin-mismatch'
        ? `Já existe um pacote com o ID "${p.prepared.analysis.packId}" (${c.existing.name} ${c.existing.version}, origem: ${c.existing.source === 'official' ? 'oficial' : 'importado'}), mas este arquivo é ${c.incoming.source === 'official' ? 'oficial' : 'importado'}. Não vou misturar os dois. Quer instalar este como um pacote separado, com outro ID de pacote? O original continua como está.`
        : `O pacote "${p.prepared.analysis.packId}" ${c.existing.version} já está instalado, mas este arquivo tem a mesma versão com conteúdo diferente. Quer instalar este como um pacote separado, com outro ID de pacote? O instalado continua como está.`,
      confirmLabel: 'Instalar como pacote separado',
    });
    if (ok !== true) return { ok: false, reason: 'Instalação cancelada.', cancelled: true };
    p = await prepareInstall(bytes, { ...opts, asSeparatePack: true });
    if (!p.ok) return p;
  }
  const { prepared } = p;
  let resolutions: Resolutions = opts.resolutions ?? {};
  let resolveAll = !!opts.resolveAll;
  if (prepared.analysis.conflicts.length && !resolveAll && !opts.resolutions) {
    const answer = await askImportConflicts(prepared);
    if (!answer) return { ok: false, reason: 'Instalação cancelada.', cancelled: true };
    resolutions = answer.resolutions;
    resolveAll = answer.resolveAll;
  }
  const plan = planImport(prepared.pack, prepared.analysis, resolutions, { resolveAll });
  if (!plan.ok) return { ok: false, reason: plan.errors.join(' ') };
  return commitInstall(prepared, plan);
}

export async function installPackFile(file: File): Promise<InstallResult> {
  if (!/\.(rspack|zip)$/i.test(file.name)) return { ok: false, reason: `Escolha um arquivo ${PACK_EXT}.` };
  return installInteractive(new Uint8Array(await file.arrayBuffer()));
}

export const installDemoPack = async (version?: string, opts?: InstallOptions) => installPackBytes(await buildDemoPack(version), opts);

export function reportInstall(r: InstallResult): void {
  if (r.ok) {
    const p = usePacks.getState().packs.find((x) => x.id === r.id);
    const sm = r.summary;
    const extra = [sm.autoIds ? `${sm.autoIds} ID(s) novo(s) gerado(s)` : '', sm.duplicates ? `${sm.duplicates} duplicata(s) reconhecida(s)` : '', sm.skipped ? `${sm.skipped} item(ns) pulado(s)` : ''].filter(Boolean).join(', ');
    toast(`${r.updated ? 'Pacote atualizado' : 'Pacote instalado'}: ${p?.name ?? r.id} ${p?.version ?? ''}. ${sm.items} item(ns) no catálogo${extra ? ` (${extra})` : ''}.`, 'success');
  } else if (!r.cancelled) toast(`Não foi possível instalar: ${r.reason}`, 'error');
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
  const bytes = await buildPack(meta, p.items.map((it) => ({ id: it.id, kind: it.kind, name: it.name, data: it.kind === 'object' || it.kind === 'background' ? it.data : it.data, meta: it.meta })), media);
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
