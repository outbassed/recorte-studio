/**
 * Documento + histórico. O histórico guarda PATCHES do Immer (transações
 * estruturadas), nunca snapshots de blobs. Seleção e interface ficam em uiStore.
 */
import { create } from 'zustand';
import { applyPatches, enablePatches, produceWithPatches, type Draft, type Patch } from 'immer';
import type { Project, Scene } from '@/engine/model/schema';

enablePatches();

export interface HistoryEntry {
  label: string;
  patches: Patch[];
  inverse: Patch[];
  coalesceKey?: string;
  at: number;
  selectionBefore?: unknown;
  selectionAfter?: unknown;
}

export const HISTORY_LIMIT = 300;
const COALESCE_WINDOW_MS = 800;

interface ProjectState {
  project: Project | null;
  past: HistoryEntry[];
  future: HistoryEntry[];
  /** muda a cada alteração persistível */
  revision: number;
  /** grupo aberto: mudanças viram UMA entrada (gesto de slider, arraste…) */
  openGroup: string | null;
}

export const useProjectStore = create<ProjectState>(() => ({ project: null, past: [], future: [], revision: 0, openGroup: null }));

let selectionProvider: { get: () => unknown; set: (v: unknown) => void } = { get: () => null, set: () => {} };
export const registerSelectionProvider = (p: typeof selectionProvider) => {
  selectionProvider = p;
};

export function loadProject(project: Project): void {
  useProjectStore.setState({ project, past: [], future: [], revision: 0, openGroup: null });
}

export function closeProject(): void {
  useProjectStore.setState({ project: null, past: [], future: [], revision: 0, openGroup: null });
}

export function currentProject(): Project {
  const p = useProjectStore.getState().project;
  if (!p) throw new Error('Nenhum projeto aberto');
  return p;
}

export function currentScene(): Scene {
  const p = currentProject();
  return p.scenes[p.currentSceneId ?? p.sceneOrder[0]!]!;
}

/** Aplica uma transação. `coalesce` funde alterações seguidas da mesma propriedade. */
export function commit(label: string, recipe: (draft: Draft<Project>) => void, opts: { coalesce?: string; silent?: boolean } = {}): void {
  const state = useProjectStore.getState();
  const project = state.project;
  if (!project) return;
  const selectionBefore = selectionProvider.get();
  const [next, patches, inverse] = produceWithPatches(project, recipe);
  if (patches.length === 0) return;
  const stamped = { ...next, updatedAt: Date.now() } as Project;
  if (opts.silent) {
    useProjectStore.setState({ project: stamped, revision: state.revision + 1 });
    return;
  }
  const at = Date.now();
  const coalesceKey = state.openGroup ?? opts.coalesce;
  const last = state.past[state.past.length - 1];
  const canMerge = !!(coalesceKey && last && last.coalesceKey === coalesceKey && (state.openGroup !== null || at - last.at < COALESCE_WINDOW_MS));
  let past: HistoryEntry[];
  if (canMerge && last) {
    past = [...state.past.slice(0, -1), { ...last, patches: [...last.patches, ...patches], inverse: [...inverse, ...last.inverse], at, selectionAfter: selectionProvider.get() }];
  } else {
    past = [...state.past, { label, patches, inverse, coalesceKey, at, selectionBefore, selectionAfter: selectionProvider.get() }];
    if (past.length > HISTORY_LIMIT) past = past.slice(past.length - HISTORY_LIMIT);
  }
  useProjectStore.setState({ project: stamped, past, future: [], revision: state.revision + 1 });
}

/** Abre um grupo: tudo até `endGroup` vira uma única entrada do histórico. */
export function beginGroup(key: string): void {
  useProjectStore.setState({ openGroup: `${key}:${Date.now()}` });
}
export function endGroup(): void {
  useProjectStore.setState({ openGroup: null });
}

export function undo(): string | null {
  const { project, past, future, revision } = useProjectStore.getState();
  const entry = past[past.length - 1];
  if (!project || !entry) return null;
  const next = applyPatches(project, entry.inverse);
  useProjectStore.setState({ project: next, past: past.slice(0, -1), future: [...future, entry], revision: revision + 1, openGroup: null });
  if (entry.selectionBefore !== undefined) selectionProvider.set(entry.selectionBefore);
  return entry.label;
}

export function redo(): string | null {
  const { project, past, future, revision } = useProjectStore.getState();
  const entry = future[future.length - 1];
  if (!project || !entry) return null;
  const next = applyPatches(project, entry.patches);
  useProjectStore.setState({ project: next, past: [...past, entry], future: future.slice(0, -1), revision: revision + 1, openGroup: null });
  if (entry.selectionAfter !== undefined) selectionProvider.set(entry.selectionAfter);
  return entry.label;
}

export const useProject = (): Project | null => useProjectStore((s) => s.project);
export const useCurrentScene = (): Scene | null =>
  useProjectStore((s) => (s.project ? (s.project.scenes[s.project.currentSceneId ?? s.project.sceneOrder[0]!] ?? null) : null));
