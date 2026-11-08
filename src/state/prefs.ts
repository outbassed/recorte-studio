/**
 * Preferências do aplicativo (não do projeto). Ficam no localStorage deste navegador.
 * Toda opção daqui tem efeito real: nenhuma é decorativa.
 */
import { create } from 'zustand';

export type ThemePref = 'dark' | 'light' | 'system';
export type StartupPref = 'home' | 'last';
export type ModePref = 'auto' | 'simple' | 'advanced';

export interface AppPrefs {
  theme: ThemePref;
  /** Escala da interface em %, aplicada ao tamanho base da fonte. */
  uiScale: 90 | 100 | 110 | 125;
  reduceMotion: boolean;
  startup: StartupPref;
  /** Modo da timeline ao abrir um projeto. "auto" = simples em telas estreitas. */
  defaultMode: ModePref;
  /** Volume da reprodução no editor (não afeta a exportação). */
  volume: number;
  muted: boolean;
  /** Limite de quadros por segundo da prévia durante a reprodução (0 = do monitor). */
  previewFps: 0 | 30 | 24;
  /** Miniaturas das cenas no painel Cenas (desligar alivia projetos grandes). */
  sceneThumbs: boolean;
  lastProjectId: string | null;
  /** Catálogo: favoritos de itens sem campo próprio (padrão, objetos e cenários) e recentes. */
  catalogFavorites: string[];
  catalogRecents: string[];
  catalogLayout: 'grid' | 'list';
}

export const DEFAULT_PREFS: AppPrefs = {
  theme: 'dark',
  uiScale: 100,
  reduceMotion: false,
  startup: 'home',
  defaultMode: 'auto',
  volume: 1,
  muted: false,
  previewFps: 0,
  sceneThumbs: true,
  lastProjectId: null,
  catalogFavorites: [],
  catalogRecents: [],
  catalogLayout: 'grid',
};

const KEY = 'recorte.prefs.v1';

function load(): AppPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw ? (JSON.parse(raw) as Partial<AppPrefs>) : {};
    const out = { ...DEFAULT_PREFS, ...v };
    if (![90, 100, 110, 125].includes(out.uiScale)) out.uiScale = 100;
    if (![0, 30, 24].includes(out.previewFps)) out.previewFps = 0;
    out.volume = Math.min(1, Math.max(0, Number(out.volume) || 0));
    const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 500) : []);
    out.catalogFavorites = strs(out.catalogFavorites);
    out.catalogRecents = strs(out.catalogRecents).slice(0, 24);
    if (out.catalogLayout !== 'list') out.catalogLayout = 'grid';
    return out;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export const usePrefs = create<AppPrefs>(() => load());

usePrefs.subscribe((s) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* sem armazenamento: as preferências valem só nesta sessão */
  }
  applyPrefs(s);
});

export const setPref = <K extends keyof AppPrefs>(key: K, value: AppPrefs[K]) => usePrefs.setState({ [key]: value } as Pick<AppPrefs, K>);
/** Restaura as opções; favoritos e recentes do catálogo são dados do usuário e ficam. */
export const resetPrefs = () => {
  const { lastProjectId, catalogFavorites, catalogRecents } = usePrefs.getState();
  usePrefs.setState({ ...DEFAULT_PREFS, lastProjectId, catalogFavorites, catalogRecents });
};

/** Tema efetivo (resolve "sistema"). */
export function effectiveTheme(p: AppPrefs = usePrefs.getState()): 'dark' | 'light' {
  if (p.theme !== 'system') return p.theme;
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyPrefs(p: AppPrefs = usePrefs.getState()): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = effectiveTheme(p);
  root.style.setProperty('--ui-scale', String(p.uiScale / 100));
  root.classList.toggle('reduce-motion', p.reduceMotion);
}

/** Volume efetivo do editor. */
export const editorVolume = () => {
  const p = usePrefs.getState();
  return p.muted ? 0 : p.volume;
};

/** Modo inicial da timeline ao abrir um projeto. */
export function initialSimpleMode(width: number = typeof window === 'undefined' ? 1366 : window.innerWidth): boolean | null {
  const m = usePrefs.getState().defaultMode;
  if (m === 'simple') return true;
  if (m === 'advanced') return false;
  return width < 768 ? true : null;
}

if (typeof window !== 'undefined' && typeof matchMedia === 'function') {
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => applyPrefs());
}
