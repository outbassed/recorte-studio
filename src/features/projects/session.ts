/**
 * Sessão do projeto aberto: autosave transacional com debounce, status honesto,
 * abertura, importação (com backup do original) e download de arquivos.
 */
import { initialSimpleMode, setPref } from '@/state/prefs';
import { create } from 'zustand';
import { uid } from '@/engine/model/ids';
import { characterUsage } from '@/engine/model/ops';
import type { Project } from '@/engine/model/schema';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { previewAssetUrl, preloadAssetUrls, releaseAssetUrls } from '@/features/library/assets';
import { ImportError, importProjectJson, type MigrationReport } from '@/migrations';
import { resetAudio } from '@/features/audio/engine';
import { ArchiveError, detectKind, extractArchive, LIMITS } from './archive';
import { buildJrec, commitParsedProject, parseEntries, type ParsedMediaOnly, type ParsedProject } from './jrec';
import { closeProject, loadProject, useProjectStore } from '@/state/projectStore';
import { resetTransport } from '@/state/transport';
import { clearSelection, toast, useUI } from '@/state/uiStore';
import { repo, StorageQuotaError } from '@/storage/db';
import { getProjectIdFromUrl, projectSlug, updateProjectUrl, updateProjectsUrl, type RouteMode } from './urls';

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved' | 'error';

interface SessionState {
  status: SaveStatus;
  error: string;
  lastSavedAt: number;
  report: MigrationReport | null;
}

export const useSession = create<SessionState>(() => ({ status: 'idle', error: '', lastSavedAt: 0, report: null }));

let timer: ReturnType<typeof setTimeout> | undefined;
/** Última versão gravada com sucesso, por projeto: nunca mistura projetos. */
let saved = { projectId: '', revision: -1 };
let inflight: Promise<void> | null = null;
let failures = 0;
let lastErrorMessage = '';

export const SAVE_DEBOUNCE_MS = 700;
/** Espera crescente após erro: 2 s, 4 s, 8 s… até 60 s. Nada de laço rápido. */
export const retryDelay = (n: number): number => Math.min(60_000, 2000 * 2 ** Math.max(0, n - 1));

const isSaved = (projectId: string, revision: number) => saved.projectId === projectId && saved.revision === revision;

/** Estado interno exposto só para testes. */
export const saveInternals = () => ({ saved: { ...saved }, failures, pending: !!timer, inflight: !!inflight });

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

/**
 * Grava o projeto aberto. Reentrante: se já houver gravação em andamento, espera e
 * grava de novo só se algo mudou. Grava uma FOTO (projeto + revisão), então trocar
 * de projeto no meio não salva um com os dados do outro.
 */
export async function saveNow(): Promise<void> {
  clearTimeout(timer);
  timer = undefined;
  while (inflight) await inflight;
  const { project, revision } = useProjectStore.getState();
  if (!project || isSaved(project.id, revision)) return;
  const snapshot = { project, revision };
  useSession.setState({ status: 'saving' });
  inflight = (async () => {
    try {
      await repo.saveProject(snapshot.project, projectThumbnail(snapshot.project));
      await repo.setMeta('lastProjectId', snapshot.project.id);
      saved = { projectId: snapshot.project.id, revision: snapshot.revision };
      failures = 0;
      lastErrorMessage = '';
      const cur = useProjectStore.getState();
      if (cur.project?.id === snapshot.project.id) {
        useSession.setState({ status: cur.revision === snapshot.revision ? 'saved' : 'dirty', error: '', lastSavedAt: Date.now() });
      }
    } catch (e) {
      failures++;
      const quota = e instanceof StorageQuotaError;
      const msg = quota
        ? 'Armazenamento cheio. Salve o projeto em .jrec e libere espaço (apague projetos antigos ou mídias).'
        : `Erro ao salvar: ${e instanceof Error ? e.message : 'desconhecido'}. Salve o projeto em .jrec por segurança.`;
      if (useProjectStore.getState().project?.id === snapshot.project.id) {
        useSession.setState({ status: 'error', error: `${msg} Nova tentativa em ${Math.round(retryDelay(failures) / 1000)} s.` });
      }
      // Avisa uma vez por tipo de erro, não a cada tentativa.
      if (msg !== lastErrorMessage) toast(msg, 'error');
      lastErrorMessage = msg;
    }
  })();
  try {
    await inflight;
  } finally {
    inflight = null;
  }
  const cur = useProjectStore.getState();
  if (cur.project && !isSaved(cur.project.id, cur.revision)) scheduleSave();
}

function scheduleSave(): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    void saveNow();
  }, failures ? retryDelay(failures) : SAVE_DEBOUNCE_MS);
}

/** Espera qualquer gravação pendente terminar (troca de projeto, saída). */
export async function flushSaves(): Promise<void> {
  if (timer || inflight) await saveNow();
  while (inflight) await inflight;
}

useProjectStore.subscribe((s, prev) => {
  if (s.revision !== prev.revision && s.project) {
    if (useSession.getState().status !== 'error') useSession.setState({ status: 'dirty' });
    // Com erro persistente, editar não força nova tentativa imediata: respeita a espera.
    if (!timer || !failures) scheduleSave();
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
  // O projeto anterior termina de gravar antes de qualquer troca.
  await flushSaves();
  resetAudio();
  releaseAssetUrls();
  await preloadAssetUrls(project);
  saved = { projectId: project.id, revision: 0 };
  failures = 0;
  lastErrorMessage = '';
  loadProject(project);
  resetTransport();
  clearSelection();
  useSession.setState({ status: 'saved', error: '', lastSavedAt: project.updatedAt });
  await repo.setMeta('lastProjectId', project.id);
  updateProjectUrl(project, routeMode);
  setPref('lastProjectId', project.id);
  const simple = initialSimpleMode();
  useUI.setState({ screen: 'editor', dialog: null, overlay: null, stageZoom: 'fit', stagePanX: 0, stagePanY: 0, ...(simple === null ? {} : { simpleMode: simple }) });
}

export async function createAndOpen(project: Project): Promise<void> {
  await repo.saveProject(project, projectThumbnail(project));
  await openProjectObject(project);
}

export async function openProjectById(id: string, routeMode: RouteMode = 'push'): Promise<boolean> {
  await flushSaves();
  const p = await repo.loadProject(id);
  if (!p) return false;
  await openProjectObject(p, routeMode);
  return true;
}

export async function leaveEditor(routeMode: RouteMode = 'push'): Promise<void> {
  await flushSaves();
  resetAudio();
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

/** Resultado de uma importação que só tinha mídias, para o editor oferecer a biblioteca. */
export type MediaOnlyImport = ParsedMediaOnly;

/**
 * Importa qualquer formato suportado. Projetos (.jrec, .recorte.zip, .json, ou dentro
 * de 7z/RAR/TAR...) viram um projeto NOVO e o original fica como backup.
 * Retorna as mídias quando o arquivo não contém projeto.
 */
export async function importFile(file: File): Promise<MediaOnlyImport | null> {
  if (file.size > LIMITS.inputBytes) throw new ImportError(`O arquivo é grande demais (limite de ${Math.round(LIMITS.inputBytes / 1048576)} MB).`);
  const head = new Uint8Array(await file.slice(0, 600).arrayBuffer());
  if (detectKind(head) === 'json') {
    const text = await file.text();
    const { project, report } = importProjectJson(text);
    // JSON não carrega mídia: a referência só vale se o arquivo já existir neste navegador.
    const present = new Set<string>();
    for (const id of Object.keys(project.assets)) if (await repo.hasBlob(id)) present.add(id);
    const parsed: ParsedProject = { kind: 'project', project, report, media: [], warnings: [], raw: text, missing: [] };
    const fresh = await commitParsedProject(parsed, repo.putBlob, repo.hasBlob, present);
    await finishImport(fresh, text, file.name, report, [], Object.keys(project.assets).length - present.size);
    return null;
  }
  let extracted;
  try {
    extracted = await extractArchive(file);
  } catch (err) {
    if (err instanceof ArchiveError) throw new ImportError(err.message);
    throw err;
  }
  const parsed = await parseEntries(extracted.entries);
  if (parsed.kind === 'media') return parsed;
  const fresh = await commitParsedProject(parsed, repo.putBlob, repo.hasBlob);
  await finishImport(fresh, parsed.raw, file.name, parsed.report, parsed.warnings, parsed.missing.length);
  return null;
}

async function finishImport(project: Project, raw: string, fileName: string, report: MigrationReport | null, warnings: string[], missingCount: number): Promise<void> {
  await repo.addBackup(project.id, `Original: ${fileName}`, raw);
  await createAndOpen(project);
  useSession.setState({ report });
  if (report) useUI.setState({ dialog: 'import-report' });
  for (const w of warnings.slice(0, 3)) toast(w, 'info');
  if (missingCount > 0) toast(`${missingCount} mídia(s) não vieram no arquivo e aparecem como ausentes. Revincule em Mídias.`, 'error');
}

/** Baixa o projeto como .jrec. Lança MissingMediaError se faltar mídia (a menos que allowMissing). */
export async function saveProjectFile(project: Project, opts: { allowMissing?: boolean; onProgress?: (d: number, t: number) => void } = {}): Promise<{ size: number; missing: number }> {
  await flushSaves();
  const { blob, manifest } = await buildJrec(project, { getBlob: repo.getBlob, allowMissing: opts.allowMissing, onProgress: opts.onProgress });
  downloadBlob(blob, `${projectSlug(project.title)}${manifest.missing.length ? '-incompleto' : ''}.jrec`);
  return { size: blob.size, missing: manifest.missing.length };
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
