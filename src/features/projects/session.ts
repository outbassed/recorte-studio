/**
 * Sessão do projeto aberto: autosave transacional com debounce, status honesto,
 * abertura, importação (com backup do original) e download de arquivos.
 */
import { create } from 'zustand';
import { strFromU8, unzipSync } from 'fflate';
import { uid } from '@/engine/model/ids';
import { characterUsage } from '@/engine/model/ops';
import type { Project } from '@/engine/model/schema';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { previewAssetUrl, preloadAssetUrls, releaseAssetUrls } from '@/features/library/assets';
import { ImportError, importProjectData, importProjectJson, withFreshProjectId, type MigrationReport } from '@/migrations';
import { closeProject, loadProject, useProjectStore } from '@/state/projectStore';
import { resetTransport } from '@/state/transport';
import { clearSelection, toast, useUI } from '@/state/uiStore';
import { repo, StorageQuotaError } from '@/storage/db';
import { getProjectIdFromUrl, updateProjectUrl, updateProjectsUrl, type RouteMode } from './urls';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface SessionState {
  status: SaveStatus;
  error: string;
  lastSavedAt: number;
  report: MigrationReport | null;
}

export const useSession = create<SessionState>(() => ({ status: 'idle', error: '', lastSavedAt: 0, report: null }));

let timer: ReturnType<typeof setTimeout> | undefined;
let savedRevision = -1;
let saving = false;

export function projectThumbnail(project: Project): string | undefined {
  const sceneId = project.currentSceneId ?? project.sceneOrder[0];
  const scene = sceneId ? project.scenes[sceneId] : undefined;
  if (!scene) return undefined;
  try {
    const svg = planToSvgString(planFrame(project, scene, Math.min(1500, scene.durationMs / 2), previewAssetUrl), 320, Math.round((320 * project.settings.height) / project.settings.width));
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  } catch {
    return undefined;
  }
}

export async function saveNow(): Promise<void> {
  clearTimeout(timer);
  const { project, revision } = useProjectStore.getState();
  if (!project || saving || revision === savedRevision) return;
  saving = true;
  useSession.setState({ status: 'saving' });
  try {
    await repo.saveProject(project, projectThumbnail(project));
    await repo.setMeta('lastProjectId', project.id);
    savedRevision = revision;
    useSession.setState({ status: 'saved', error: '', lastSavedAt: Date.now() });
  } catch (e) {
    const quota = e instanceof StorageQuotaError;
    const msg = quota ? 'Armazenamento cheio. Exporte um backup e libere espaço (apague projetos antigos ou mídia).' : `Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}. Exporte um backup.`;
    useSession.setState({ status: 'error', error: msg });
    toast(msg, 'error');
  } finally {
    saving = false;
    if (useProjectStore.getState().revision !== savedRevision) scheduleSave();
  }
}

function scheduleSave(): void {
  clearTimeout(timer);
  timer = setTimeout(() => void saveNow(), 700);
}

useProjectStore.subscribe((s, prev) => {
  if (s.revision !== prev.revision && s.project) {
    useSession.setState({ status: 'dirty' });
    scheduleSave();
  }
  if (s.project && s.project.id === prev.project?.id && s.project.title !== prev.project.title) {
    updateProjectUrl(s.project, 'replace');
  }
});

// Salvamento "ao sair" não é garantido, por isso o debounce acima é a defesa real.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void saveNow();
  });
  window.addEventListener('beforeunload', (e) => {
    const st = useSession.getState().status;
    if (st === 'dirty' || st === 'saving' || st === 'error') {
      void saveNow();
      e.preventDefault();
    }
  });
}

export async function openProjectObject(project: Project, routeMode: RouteMode = 'push'): Promise<void> {
  releaseAssetUrls();
  await preloadAssetUrls(project);
  savedRevision = 0;
  loadProject(project);
  resetTransport();
  clearSelection();
  useSession.setState({ status: 'saved', error: '', lastSavedAt: project.updatedAt });
  await repo.setMeta('lastProjectId', project.id);
  updateProjectUrl(project, routeMode);
  useUI.setState({ screen: 'editor', dialog: null, stageZoom: 'fit', stagePanX: 0, stagePanY: 0 });
}

export async function createAndOpen(project: Project): Promise<void> {
  await repo.saveProject(project, projectThumbnail(project));
  await openProjectObject(project);
}

export async function openProjectById(id: string, routeMode: RouteMode = 'push'): Promise<boolean> {
  const p = await repo.loadProject(id);
  if (!p) return false;
  if (useProjectStore.getState().project?.id !== id) await saveNow();
  await openProjectObject(p, routeMode);
  return true;
}

export async function leaveEditor(routeMode: RouteMode = 'push'): Promise<void> {
  await saveNow();
  resetTransport();
  closeProject();
  releaseAssetUrls();
  updateProjectsUrl(routeMode);
  useUI.setState({ screen: 'projects', dialog: null });
}

/** Abre o projeto da URL após recarregar, ou mostra a biblioteca na página inicial. */
export async function restoreProjectFromUrl(): Promise<boolean> {
  const id = getProjectIdFromUrl();
  if (!id) return false;
  try {
    if (await openProjectById(id, 'replace')) return true;
  } catch { /* Link inválido ou registro não disponível neste navegador. */ }
  updateProjectsUrl('replace');
  toast('Este projeto não está salvo neste navegador. Importe um backup para abri-lo.', 'error');
  return false;
}

export async function duplicateProject(id: string): Promise<void> {
  const p = await repo.loadProject(id);
  if (!p) return;
  const copy: Project = { ...p, id: uid('proj'), title: `${p.title} (cópia)`, createdAt: Date.now(), updatedAt: Date.now() };
  const list = await repo.listProjects();
  await repo.saveProject(copy, list.find((x) => x.id === id)?.thumbnail);
}

/** Importa .json (qualquer versão) ou pacote .zip. Guarda sempre o original como backup. */
export async function importFile(file: File): Promise<void> {
  if (/\.zip$/i.test(file.name) || file.type.includes('zip')) {
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const json = entries['project.json'];
    if (!json) throw new ImportError('Pacote inválido: project.json não encontrado.');
    const raw = strFromU8(json);
    const { project, report } = importProjectData(JSON.parse(raw));
    const fresh = withFreshProjectId(project);
    for (const [path, data] of Object.entries(entries)) {
      if (!path.startsWith('assets/') || data.length === 0) continue;
      const id = path.slice('assets/'.length);
      const meta = fresh.assets[id];
      // Só mídia declarada no projeto entra: nomes estranhos no zip são ignorados.
      if (meta) await repo.putBlob(id, new Blob([data as Uint8Array<ArrayBuffer>], { type: meta.mime }), meta.name);
    }
    await repo.addBackup(fresh.id, `Pacote original: ${file.name}`, raw);
    await createAndOpen(fresh);
    useSession.setState({ report });
    if (report) useUI.setState({ dialog: 'import-report' });
    return;
  }
  const text = await file.text();
  const { project, report } = importProjectJson(text);
  const fresh = withFreshProjectId(project);
  await repo.addBackup(fresh.id, `Original: ${file.name}`, text);
  await createAndOpen(fresh);
  useSession.setState({ report });
  if (report) useUI.setState({ dialog: 'import-report' });
}

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export { characterUsage };
