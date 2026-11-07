/** Ações de mídia da 1.1: biblioteca de áudio, revincular, remover com aviso, salvar .jrec. */
import { addAudioClip, addAudioTrack, assetUsage, deleteNode, sceneOf } from '@/engine/model/ops';
import { createImageNode } from '@/engine/model/factory';
import { frameSize, WORLD_HEIGHT, type Asset, type AudioTrack, type Project } from '@/engine/model/schema';
import { uid, deepClone } from '@/engine/model/ids';
import { AssetError, importAudioFile, importImageFile, registerAssetBlob, type AudioCategory } from '@/features/library/assets';
import { SvgRejectedError } from '@/features/library/sanitizeSvg';
import { remapAssetRefs, MissingMediaError } from '@/features/projects/jrec';
import { importFile, saveProjectFile, type MediaOnlyImport } from '@/features/projects/session';
import { forgetBuffer } from '@/features/audio/engine';
import { repo, StorageQuotaError } from '@/storage/db';
import { commit, currentProject, currentScene } from './projectStore';
import { transport } from './transport';
import { confirmDialog, selectNodes, toast, useUI } from './uiStore';

export const AUDIO_CATEGORIES: Array<{ id: AudioCategory; label: string; role: AudioTrack['role'] }> = [
  { id: 'voice', label: 'Voz', role: 'voice' },
  { id: 'music', label: 'Música', role: 'music' },
  { id: 'sfx', label: 'Efeitos sonoros', role: 'sfx' },
  { id: 'ambient', label: 'Ambiente', role: 'ambient' },
];

const explain = (e: unknown) => (e instanceof AssetError || e instanceof SvgRejectedError || e instanceof StorageQuotaError || e instanceof Error ? e.message : 'Erro desconhecido.');

/** Importa para a biblioteca do projeto. Não insere na cena: o usuário escolhe quando usar. */
export async function importAudioToLibrary(files: File[], category: AudioCategory): Promise<Asset[]> {
  const out: Asset[] = [];
  for (const file of files) {
    try {
      toast(`Lendo "${file.name}"…`);
      const asset = await importAudioFile(file, category);
      const existing = currentProject().assets[asset.id];
      commit('Importar áudio', (d) => {
        // Mesmo arquivo já importado: reaproveita, não duplica.
        d.assets[asset.id] = existing ? { ...existing, category: existing.category ?? category } : asset;
      });
      out.push(asset);
      toast(existing ? `"${file.name}" já estava na biblioteca: reaproveitado.` : `"${file.name}" adicionado à biblioteca de áudio.`, 'success');
    } catch (e) {
      toast(`Não foi possível importar "${file.name}": ${explain(e)}`, 'error');
    }
  }
  return out;
}

/** Coloca um áudio da biblioteca na cena atual, na trilha da categoria, no tempo da agulha. */
export function placeAudioInScene(assetId: string): void {
  const p = currentProject();
  const asset = p.assets[assetId];
  if (!asset) return;
  const scene = currentScene();
  const role = AUDIO_CATEGORIES.find((c) => c.id === asset.category)?.role ?? 'sfx';
  const start = Math.round(transport.getState().timeMs);
  let clipId = '';
  let trackId = '';
  commit('Usar áudio na cena', (d) => {
    const s = sceneOf(d as Project, scene.id);
    const track = s.tracks.find((t) => t.type === 'audio' && t.role === role) ?? addAudioTrack(s, role);
    trackId = track.id;
    clipId = addAudioClip(s, track.id, assetId, start, asset.durationMs ?? 1000)?.id ?? '';
  });
  useUI.setState({ timeline: { trackId, clipId }, nodeIds: [], camera: false });
  toast(`"${asset.name}" na trilha ${AUDIO_CATEGORIES.find((c) => c.role === role)?.label ?? ''} em ${(start / 1000).toLocaleString('pt-BR')} s.`, 'success');
}

export function placeImageInScene(assetId: string): void {
  const a = currentProject().assets[assetId];
  if (!a) return;
  const fs = frameSize(currentProject().settings);
  const k = Math.min(1, (WORLD_HEIGHT * 0.6) / (a.height ?? 400), (fs.w * 0.6) / (a.width ?? 400));
  const node = createImageNode(assetId, a.name, (a.width ?? 400) * k, (a.height ?? 400) * k);
  const scene = currentScene();
  commit('Inserir imagem', (d) => {
    const s = sceneOf(d as Project, scene.id);
    s.nodes[node.id] = node;
    s.layerOrder.push(node.id);
  });
  selectNodes([node.id]);
}

export const mediaUsage = (p: Project, id: string): number =>
  assetUsage(p, id) + Object.values(p.customBackgrounds).reduce((n, b) => n + Object.values(b.variants).filter((v) => v?.assetId === id).length, 0);

/** Remove a mídia do projeto. Se estiver em uso, pede confirmação e remove os usos (com Undo). */
export async function removeMedia(assetId: string): Promise<void> {
  const p = currentProject();
  const a = p.assets[assetId];
  if (!a) return;
  const used = mediaUsage(p, assetId);
  const ok = await confirmDialog({
    title: 'Remover mídia',
    message: used
      ? `"${a.name}" está em uso ${used} vez(es). Remover também tira esses usos das cenas e cenários. Ctrl+Z desfaz.`
      : `Remover "${a.name}" da biblioteca deste projeto? Ctrl+Z desfaz.`,
    confirmLabel: used ? 'Remover mídia e usos' : 'Remover',
    danger: true,
  });
  if (!ok) return;
  commit('Remover mídia', (d) => {
    const proj = d as Project;
    for (const s of Object.values(proj.scenes)) {
      for (const n of Object.values(s.nodes)) if (n.kind === 'image' && n.assetId === assetId) deleteNode(s, n.id);
      for (const t of s.tracks) if (t.type === 'audio') t.clips = t.clips.filter((c) => c.assetId !== assetId);
    }
    for (const c of Object.values(proj.characters)) if (c.spriteAssetId === assetId) c.spriteAssetId = undefined;
    for (const b of Object.values(proj.customBackgrounds)) for (const key of Object.keys(b.variants) as Array<keyof typeof b.variants>) if (b.variants[key]?.assetId === assetId) delete b.variants[key];
    delete proj.assets[assetId];
  });
  forgetBuffer(assetId);
}

/** Troca o arquivo de uma mídia (inclusive ausente) mantendo todos os usos. */
export async function relinkMedia(assetId: string, file: File): Promise<void> {
  const old = currentProject().assets[assetId];
  if (!old) return;
  try {
    let fresh: Asset;
    if (old.kind === 'audio') fresh = await importAudioFile(file, old.category ?? 'sfx');
    else {
      fresh = (await importImageFile(file)).asset;
      const blob = await repo.getBlob(fresh.id);
      if (blob) registerAssetBlob(fresh.id, blob);
    }
    commit('Substituir arquivo da mídia', (d) => {
      const proj = d as Project;
      proj.assets[assetId] = { ...fresh, name: old.name, category: old.category ?? fresh.category, id: assetId };
      if (fresh.id !== assetId) remapAssetRefs(proj, new Map([[assetId, fresh.id]]));
    });
    forgetBuffer(assetId);
    toast(`Arquivo de "${old.name}" substituído. Todos os usos foram mantidos.`, 'success');
  } catch (e) {
    toast(`Não foi possível substituir: ${explain(e)}`, 'error');
  }
}

export function renameMedia(assetId: string, name: string): void {
  if (!name.trim()) return;
  commit('Renomear mídia', (d) => {
    const a = d.assets[assetId];
    if (a) a.name = name.trim();
  });
}

export async function saveMediaToUserLibrary(assetId: string): Promise<void> {
  const a = currentProject().assets[assetId];
  if (!a) return;
  await repo.putLibrary({ id: uid('lib'), kind: 'audio', name: a.name, favorite: 0, createdAt: Date.now(), data: { assetId: a.id, asset: deepClone(a) } });
  toast(`"${a.name}" salvo na sua biblioteca, para usar em outros projetos.`, 'success');
}

/** Traz um áudio da biblioteca do usuário sem copiar o arquivo (mesmo blob). */
export async function bringAudioFromUserLibrary(asset: Asset): Promise<boolean> {
  if (!(await repo.hasBlob(asset.id))) {
    toast(`O arquivo de "${asset.name}" não está mais neste navegador.`, 'error');
    return false;
  }
  commit('Trazer áudio da biblioteca', (d) => {
    d.assets[asset.id] = deepClone(asset);
  });
  return true;
}

/** Salvar projeto (.jrec), com tratamento claro de mídia ausente. */
export async function saveProjectWithChecks(): Promise<void> {
  const p = currentProject();
  try {
    toast('Preparando o arquivo .jrec…');
    const r = await saveProjectFile(p);
    toast(`Projeto salvo em .jrec (${(r.size / 1048576).toFixed(1).replace('.', ',')} MB), com todas as mídias.`, 'success');
  } catch (e) {
    if (!(e instanceof MissingMediaError)) {
      toast(`Não foi possível salvar: ${explain(e)}`, 'error');
      return;
    }
    const answer = await confirmDialog({
      title: 'Mídia ausente',
      message: `${e.missing.length} mídia(s) não estão neste navegador: ${e.missing.map((m) => m.name).join(', ')}. Revincule em Mídias para um backup completo, ou salve um arquivo marcado como incompleto.`,
      confirmLabel: 'Abrir Mídias',
      alt: { label: 'Salvar incompleto', value: 'partial' },
    });
    if (answer === true) useUI.setState({ leftTab: 'media', mobilePanel: 'media' });
    if (answer === 'partial') {
      const r = await saveProjectFile(p, { allowMissing: true });
      toast(`Salvo INCOMPLETO: faltam ${r.missing} mídia(s). O arquivo tem "-incompleto" no nome.`, 'error');
    }
  }
}

/** Importa qualquer arquivo; se só tiver mídias, oferece levá-las para o projeto aberto. */
export async function importAnything(file: File, inEditor: boolean): Promise<void> {
  let media: MediaOnlyImport | null;
  try {
    media = await importFile(file);
  } catch (e) {
    toast(`Não foi possível importar: ${explain(e)}`, 'error');
    return;
  }
  if (!media) return;
  if (!inEditor) {
    toast(`"${file.name}" não tem projeto, só ${media.files.length} mídia(s). Abra um projeto e importe por Mídias.`, 'error');
    return;
  }
  const ok = await confirmDialog({ title: 'Importar mídias', message: `"${file.name}" não contém um projeto, mas tem ${media.files.length} imagem(ns)/áudio(s). Adicionar à biblioteca deste projeto?`, confirmLabel: 'Importar mídias' });
  if (!ok) return;
  for (const f of media.files) {
    const asFile = new File([f.data as Uint8Array<ArrayBuffer>], f.name, { type: f.mime });
    if (f.kind === 'audio') await importAudioToLibrary([asFile], 'sfx');
    else {
      try {
        const { asset } = await importImageFile(asFile);
        const blob = await repo.getBlob(asset.id);
        if (blob) registerAssetBlob(asset.id, blob);
        commit('Importar imagem', (d) => { d.assets[asset.id] = asset; });
      } catch (e) {
        toast(`"${f.name}": ${explain(e)}`, 'error');
      }
    }
  }
}
