/** Estado de interface: nunca entra no projeto nem no histórico. */
import { create } from 'zustand';
import { registerSelectionProvider } from './projectStore';

export type LeftTab = 'characters' | 'backgrounds' | 'objects' | 'templates' | 'scenes' | 'layers' | 'library' | 'direction';
export type MobilePanel = LeftTab | 'properties' | null;
export type TimelineSelection = { trackId: string; clipId?: string; keyId?: string } | null;

export interface Selection {
  nodeIds: string[];
  timeline: TimelineSelection;
  camera: boolean;
}

export type Screen = 'projects' | 'editor';
export type DialogKind = null | 'export' | 'settings' | 'shortcuts' | 'creator' | 'import-report';

interface UIState extends Selection {
  screen: Screen;
  dialog: DialogKind;
  creatorCharacterId: string | null;
  leftTab: LeftTab;
  mobilePanel: MobilePanel;
  mobilePanelExpanded: boolean;
  previewFocus: boolean;
  leftWidth: number;
  rightWidth: number;
  timelineHeight: number;
  timelineZoom: number;
  stageZoom: number | 'fit';
  stagePanX: number;
  stagePanY: number;
  showGrid: boolean;
  showSafe: boolean;
  showRulers: boolean;
  snapStage: boolean;
  snapTimeline: boolean;
  frameOnly: boolean;
  checker: boolean;
  gazeArrows: boolean;
  expandedTracks: Record<string, boolean>;
}

const PREF_KEY = 'recorte.ui.v1';
const prefKeys = ['leftWidth', 'rightWidth', 'timelineHeight', 'timelineZoom', 'showGrid', 'showSafe', 'showRulers', 'snapStage', 'snapTimeline', 'checker'] as const;

function loadPrefs(): Partial<UIState> {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? (JSON.parse(raw) as Partial<UIState>) : {};
  } catch {
    return {};
  }
}

export const useUI = create<UIState>(() => ({
  screen: 'projects',
  dialog: null,
  creatorCharacterId: null,
  nodeIds: [],
  timeline: null,
  camera: false,
  leftTab: 'characters',
  mobilePanel: null,
  mobilePanelExpanded: false,
  previewFocus: false,
  leftWidth: 318,
  rightWidth: 322,
  timelineHeight: 268,
  timelineZoom: 90,
  stageZoom: 'fit',
  stagePanX: 0,
  stagePanY: 0,
  showGrid: false,
  showSafe: false,
  showRulers: false,
  snapStage: true,
  snapTimeline: true,
  frameOnly: false,
  checker: false,
  gazeArrows: false,
  expandedTracks: {},
  ...loadPrefs(),
}));

let saveTimer: ReturnType<typeof setTimeout> | undefined;
useUI.subscribe((s) => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const out: Record<string, unknown> = {};
    for (const k of prefKeys) out[k] = s[k];
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(out));
    } catch {
      /* preferências são opcionais */
    }
  }, 300);
});

registerSelectionProvider({
  get: () => {
    const s = useUI.getState();
    return { nodeIds: s.nodeIds, timeline: s.timeline, camera: s.camera } satisfies Selection;
  },
  set: (v) => useUI.setState(v as Selection),
});

export const selectNodes = (nodeIds: string[]) => useUI.setState({ nodeIds, timeline: null, camera: false });
export const selectTimeline = (timeline: TimelineSelection) => useUI.setState({ timeline, nodeIds: [], camera: false });
export const selectCamera = () => useUI.setState({ camera: true, nodeIds: [], timeline: null });
export const clearSelection = () => useUI.setState({ nodeIds: [], timeline: null, camera: false });
export const openDialog = (dialog: DialogKind) => useUI.setState({ dialog });
export const closeDialog = () => useUI.setState({ dialog: null });

/** Toasts e confirmações ficam aqui para qualquer módulo poder usá-los. */
export interface Toast { id: number; text: string; kind: 'info' | 'error' | 'success'; action?: { label: string; run: () => void } }
export interface ConfirmRequest { title: string; message: string; confirmLabel: string; danger?: boolean; alt?: { label: string; value: string }; resolve: (v: boolean | string) => void }
interface FeedbackState { toasts: Toast[]; confirm: ConfirmRequest | null; prompt: PromptRequest | null; context: ContextMenuState | null }
export interface PromptRequest { title: string; label: string; value: string; resolve: (v: string | null) => void }
export interface ContextMenuItem { label: string; onSelect: () => void; danger?: boolean; disabled?: boolean }
export interface ContextMenuState { x: number; y: number; items: ContextMenuItem[]; title?: string }

export const useFeedback = create<FeedbackState>(() => ({ toasts: [], confirm: null, prompt: null, context: null }));
let toastId = 1;
export function toast(text: string, kind: Toast['kind'] = 'info', action?: Toast['action']): void {
  const id = toastId++;
  useFeedback.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind, action }] }));
  setTimeout(() => useFeedback.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), action ? 7000 : kind === 'error' ? 7000 : 3200);
}
export function confirmDialog(o: Omit<ConfirmRequest, 'resolve'>): Promise<boolean | string> {
  return new Promise((resolve) => useFeedback.setState({ confirm: { ...o, resolve } }));
}
export function promptDialog(title: string, label: string, value: string): Promise<string | null> {
  return new Promise((resolve) => useFeedback.setState({ prompt: { title, label, value, resolve } }));
}
export const openContextMenu = (context: ContextMenuState) => useFeedback.setState({ context });
export const closeContextMenu = () => useFeedback.setState({ context: null });
