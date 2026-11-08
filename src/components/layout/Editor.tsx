/**
 * Editor: dois layouts realmente diferentes.
 *  Desktop: esquerda/centro/direita + timeline embaixo, tudo ancorado ao viewport.
 *  Mobile: palco e timeline priorizados, dock fixo no rodapé e popup ACIMA dele.
 */
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { LibraryHome } from '../library/LibraryHome';
import {
  AlertTriangle, Check, Keyboard, Music, Save, ListChecks, Workflow, ChevronLeft, ChevronsUpDown, Clapperboard, Download, Expand, FileUp, Film, FolderOpen, HelpCircle, Layers, Link2, Loader2, Minimize, Package, Redo2, Settings, Shapes, SlidersHorizontal, Sparkles, Trees, Undo2, Users, X, Video,
} from 'lucide-react';
import { useProjectStore, useCurrentScene, useProject, commit, currentScene } from '@/state/projectStore';
import { useSession, leaveEditor, saveNow } from '@/features/projects/session';
import { copyProjectLink } from '@/features/projects/urls';
import { closeDialog, clearSelection, closeOverlay, openAppSettings, openDialog, openManual, selectNodes, useUI, useFeedback, toast, type LeftTab, type MobilePanel } from '@/state/uiStore';
import { ManualView } from '../manual/ManualView';
import { ObjectCreator, SceneCreator } from '../creators/Creators';
import { quickActions, runQuick, type QuickAction } from './quickActions';
import { findClip } from '@/engine/model/ops';
import { SettingsView } from '../settings/SettingsView';
import { Logo } from './ProjectsScreen';
import { pause, seek, togglePlay, transport, useTransport } from '@/state/transport';
import { copySelectedKey, deleteSelection, doRedo, doUndo, duplicateSelection, pasteKey } from '@/state/actions';
import { addKeyAtTime, readProperty, sceneOf, writeProperty } from '@/engine/model/ops';
import { IconButton, MoreButton } from '../controls/fields';
import { Stage } from '../stage/Stage';
import { Timeline } from '../timeline/Timeline';
import { Inspector } from '../panels/Inspector';
import { LEFT_TABS, ScenesPanel, LayersPanel, CharactersPanel, BackgroundsPanel, ObjectsPanel, TemplatesPanel, LibraryPanel, DirectionPanel } from '../panels/LeftPanels';
import { CreatorDialog } from '../dialogs/CreatorDialog';
import { ExportDialog } from '../dialogs/ExportDialog';
import { ImportReportDialog, SettingsDialog, ShortcutsDialog } from '../dialogs/OtherDialogs';
import { importAnything, saveProjectWithChecks } from '@/state/mediaActions';
import { MediaPanel } from '../panels/MediaPanel';
import { SimpleTimeline } from '../timeline/SimpleTimeline';
import type { Project } from '@/engine/model/schema';

/* ----------------- modo de layout por espaço real ----------------- */
const sub = (cb: () => void) => {
  window.addEventListener('resize', cb);
  window.addEventListener('orientationchange', cb);
  return () => {
    window.removeEventListener('resize', cb);
    window.removeEventListener('orientationchange', cb);
  };
};
const snapshot = () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w < 900 || h < 520) return w > h && h < 520 ? 'mobile-landscape' : 'mobile';
  return 'desktop';
};
export const useLayoutMode = () => useSyncExternalStore(sub, snapshot, () => 'desktop');

/* ----------------- atalhos ----------------- */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable;
      const ctrl = e.ctrlKey || e.metaKey;
      const fb = useFeedback.getState();
      if (fb.confirm || fb.prompt || fb.context) return;
      const ui = useUI.getState();
      if (e.key === 'F1') {
        e.preventDefault();
        openManual(ui.overlay?.kind === 'manual' ? 'inicio' : 'editor');
        return;
      }
      // Manual ou Configurações por cima do editor: as teclas não mexem no projeto.
      if (ui.overlay) {
        if (e.key === 'Escape') closeOverlay();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault();
        if (e.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'y' && !typing) {
        e.preventDefault();
        doRedo();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveNow();
        return;
      }
      if (typing || ui.dialog) {
        if (e.key === 'Escape' && ui.dialog) closeDialog();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        duplicateSelection();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'c') {
        copySelectedKey();
        return;
      }
      if (ctrl && e.key.toLowerCase() === 'v') {
        pasteKey();
        return;
      }
      if (ctrl) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          void deleteSelection();
          break;
        case 'Escape':
          if (ui.mobilePanel) useUI.setState({ mobilePanel: null });
          else clearSelection();
          break;
        case 'f':
        case 'F':
          useUI.setState({ stageZoom: 'fit', stagePanX: 0, stagePanY: 0 });
          break;
        case 'g':
        case 'G':
          useUI.setState({ showGrid: !ui.showGrid });
          break;
        case 'q':
        case 'Q':
          useUI.setState({ frameOnly: !ui.frameOnly });
          break;
        case '?':
          openDialog('shortcuts');
          break;
        case 'k':
        case 'K': {
          const id = ui.nodeIds[0];
          if (id) {
            const s = currentScene();
            const time = transport.getState().timeMs;
            commit('Criar keyframes', (d) => {
              const sc = sceneOf(d as Project, s.id);
              addKeyAtTime(sc, id, 'transform.x', time);
              addKeyAtTime(sc, id, 'transform.y', time);
            });
            toast('Keyframes de posição criados.');
          }
          break;
        }
        case ',':
        case '.': {
          pause();
          const p = useProjectStore.getState().project;
          const fps = p?.settings.fps ?? 30;
          seek(transport.getState().timeMs + ((e.key === '.' ? 1 : -1) * 1000) / fps);
          break;
        }
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown': {
          if (ui.nodeIds.length === 0) return;
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          const s = currentScene();
          const time = transport.getState().timeMs;
          const axis = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? 'x' : 'y';
          const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? step : -step;
          commit('Mover', (d) => {
            const sc = sceneOf(d as Project, s.id);
            for (const id of ui.nodeIds) {
              if (s.nodes[id]?.locked) continue;
              const base = readProperty(sc as never, id, `transform.${axis}`, time) as number;
              writeProperty(sc, id, `transform.${axis}`, base + dir, time);
            }
          }, { coalesce: `arrows-${axis}` });
          break;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/* ----------------- barra superior ----------------- */
export const PROJECT_ACCEPT = '.jrec,.json,.zip,.7z,.rar,.tar,.gz,.tgz,.xz,.txz,.bz2,.tbz2,application/json,application/zip';

function ModeToggle({ compact }: { compact?: boolean }) {
  const simple = useUI((s) => s.simpleMode);
  return (
    <div className="mode-toggle" role="group" aria-label="Modo de edição">
      <button type="button" className={simple ? 'is-active' : ''} aria-pressed={simple} data-testid="mode-simple" title="Modo simples: passos com quem, o quê e quando" onClick={() => useUI.setState({ simpleMode: true })}><ListChecks size={14} />{!compact && ' Simples'}</button>
      <button type="button" className={!simple ? 'is-active' : ''} aria-pressed={!simple} data-testid="mode-advanced" title="Modo avançado: timeline, trilhas e keyframes" onClick={() => useUI.setState({ simpleMode: false })}><Workflow size={14} />{!compact && ' Avançado'}</button>
    </div>
  );
}

function SaveBadge() {
  const { status, error } = useSession();
  const map = {
    idle: { icon: <Check size={13} />, text: 'Salvo' },
    saved: { icon: <Check size={13} />, text: 'Salvo' },
    dirty: { icon: <Loader2 size={13} />, text: 'Alterações pendentes' },
    saving: { icon: <Loader2 size={13} className="spin" />, text: 'Salvando…' },
    error: { icon: <AlertTriangle size={13} />, text: 'Erro ao salvar' },
  } as const;
  const m = map[status];
  return <span className={`save-badge is-${status}`} data-testid="save-status" title={error || m.text} role="status">{m.icon}<span className="save-text">{m.text}</span></span>;
}

function TopBar({ compact }: { compact?: boolean }) {
  const project = useProject();
  const canUndo = useProjectStore((s) => s.past.length > 0);
  const canRedo = useProjectStore((s) => s.future.length > 0);
  const scene = useCurrentScene();
  const fileRef = useRef<HTMLInputElement>(null);
  if (!project) return null;
  return (
    <header className={`topbar${compact ? ' is-compact' : ''}`}>
      <IconButton label="Voltar aos projetos" testId="back-projects" onClick={() => void leaveEditor()}><ChevronLeft size={18} /></IconButton>
      {!compact && <div className="brand is-small"><Logo size={20} /> Recorte <em>Studio</em></div>}
      <div className="top-title">
        <strong data-testid="project-name" title={project.title}>{project.title}</strong>
        {!compact && <small>{scene?.name}</small>}
      </div>
      <SaveBadge />
      <span className="tl-spacer" />
      {compact ? (
        <>
          <IconButton label="Desfazer (Ctrl+Z)" testId="undo" disabled={!canUndo} onClick={doUndo}><Undo2 size={17} /></IconButton>
          <IconButton label="Refazer (Ctrl+Shift+Z)" testId="redo" disabled={!canRedo} onClick={doRedo}><Redo2 size={17} /></IconButton>
          <MoreButton label="Mais opções do projeto" testId="top-more" items={() => [
            { label: 'Refazer', onSelect: doRedo, disabled: !canRedo },
            { label: 'Copiar link local deste projeto', onSelect: () => void copyProjectLink(project).then(() => toast('Link copiado. Ele abre o projeto só neste navegador.', 'success')).catch(() => toast('Não foi possível copiar o link.', 'error')) },
            { label: 'Configurações do projeto', onSelect: () => openDialog('settings') },
            { label: 'Configurações do aplicativo', onSelect: () => openAppSettings() },
            { label: 'Manual', onSelect: () => openManual('celular') },
            { label: 'Importar arquivo', onSelect: () => fileRef.current?.click() },
          ]} />
          <input ref={fileRef} hidden type="file" accept={PROJECT_ACCEPT} onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importAnything(f, true);
            e.target.value = '';
          }} />
        </>
      ) : (
        <>
      <IconButton label="Copiar link deste projeto" onClick={async () => {
        try {
          await copyProjectLink(project);
          toast('Link do projeto copiado. Ele funciona neste navegador.', 'success');
        } catch { toast('Não foi possível copiar o link.', 'error'); }
      }}><Link2 size={17} /></IconButton>
      <IconButton label="Desfazer (Ctrl+Z)" testId="undo" disabled={!canUndo} onClick={doUndo}><Undo2 size={17} /></IconButton>
      <IconButton label="Refazer (Ctrl+Shift+Z)" testId="redo" disabled={!canRedo} onClick={doRedo}><Redo2 size={17} /></IconButton>
      {!compact && <IconButton label="Importar projeto" testId="top-import" onClick={() => fileRef.current?.click()}><FileUp size={17} /></IconButton>}
      <input ref={fileRef} hidden type="file" accept={PROJECT_ACCEPT} onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void importAnything(f, true);
        e.target.value = '';
      }} />
      <IconButton label="Configurações do projeto" testId="open-settings" onClick={() => openDialog('settings')}><Settings size={17} /></IconButton>
      {!compact && <IconButton label="Atalhos de teclado (?)" testId="open-shortcuts" onClick={() => openDialog('shortcuts')}><Keyboard size={17} /></IconButton>}
      <IconButton label="Manual (F1)" testId="open-manual" onClick={() => openManual('editor')}><HelpCircle size={17} /></IconButton>
      {!compact && <IconButton label="Configurações do aplicativo" testId="open-app-settings" onClick={() => openAppSettings()}><SlidersHorizontal size={17} /></IconButton>}
        </>
      )}
      <ModeToggle compact={compact} />
      <button type="button" className="btn btn-save" data-testid="save-project" title="Baixar o projeto editável com todas as mídias (.jrec)" onClick={() => void saveProjectWithChecks()}><Save size={15} />{compact ? '' : ' Salvar projeto'}</button>
      <button type="button" className="btn btn-primary btn-export" data-testid="open-export" title="Exportar vídeo ou imagens" onClick={() => openDialog('export')}><Download size={15} />{!compact && ' Exportar vídeo/imagem'}</button>
    </header>
  );
}

/* ----------------- painéis ----------------- */
const PANEL_COMPONENTS: Record<LeftTab, () => React.ReactElement | null> = {
  characters: CharactersPanel,
  backgrounds: BackgroundsPanel,
  objects: ObjectsPanel,
  templates: TemplatesPanel,
  scenes: ScenesPanel,
  layers: LayersPanel,
  library: LibraryPanel,
  media: MediaPanel,
  direction: DirectionPanel,
};

const TAB_ICONS: Record<LeftTab, React.ReactNode> = {
  characters: <Users size={17} />, backgrounds: <Trees size={17} />, objects: <Shapes size={17} />, templates: <Clapperboard size={17} />,
  scenes: <Film size={17} />, layers: <Layers size={17} />, library: <Package size={17} />, media: <Music size={17} />, direction: <Sparkles size={17} />,
};

function Dialogs() {
  const dialog = useUI((s) => s.dialog);
  return (
    <>
      {dialog === 'export' && <ExportDialog />}
      {dialog === 'settings' && <SettingsDialog />}
      {dialog === 'shortcuts' && <ShortcutsDialog />}
      {dialog === 'creator' && <CreatorDialog />}
      {dialog === 'import-report' && <ImportReportDialog />}
      {dialog === 'object-creator' && <ObjectCreator />}
      {dialog === 'scene-creator' && <SceneCreator />}
    </>
  );
}

/* ----------------- divisores ----------------- */
function Divider({ axis, label, value, min, max, onChange, invert, testId }: { axis: 'x' | 'y'; label: string; value: number; min: number; max: number; onChange: (v: number) => void; invert?: boolean; testId?: string }) {
  const start = useRef<{ p: number; v: number } | null>(null);
  return (
    <div
      className={`divider is-${axis}`}
      role="separator"
      aria-orientation={axis === 'x' ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      data-testid={testId}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = { p: axis === 'x' ? e.clientX : e.clientY, v: value };
      }}
      onPointerMove={(e) => {
        if (!start.current) return;
        const d = (axis === 'x' ? e.clientX : e.clientY) - start.current.p;
        onChange(Math.min(max, Math.max(min, start.current.v + (invert ? -d : d))));
      }}
      onPointerUp={() => { start.current = null; }}
      onKeyDown={(e) => {
        const delta = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -16 : e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 16 : 0;
        if (delta) {
          e.preventDefault();
          e.stopPropagation();
          onChange(Math.min(max, Math.max(min, value + (invert ? -delta : delta))));
        }
      }}
    />
  );
}

/* ----------------- desktop ----------------- */
function DesktopEditor() {
  const ui = useUI();
  const Panel = PANEL_COMPONENTS[ui.leftTab];
  const tlMax = Math.max(180, window.innerHeight - 320);
  const tlHeight = Math.min(ui.timelineHeight, tlMax);
  return (
    <div className="editor-desktop" data-testid="editor-desktop" style={{ gridTemplateColumns: `${ui.leftWidth}px 6px minmax(0,1fr) 6px ${ui.rightWidth}px`, gridTemplateRows: `auto minmax(0,1fr) 6px ${tlHeight}px` }}>
      <div className="grid-top"><TopBar /></div>
      <aside className="left-area" aria-label="Biblioteca e cena">
        <nav className="left-rail" role="tablist" aria-label="Painéis">
          {LEFT_TABS.map((t) => (
            <button key={t.id} type="button" role="tab" aria-selected={ui.leftTab === t.id} className={`rail-btn${ui.leftTab === t.id ? ' is-active' : ''}`} data-testid={`tab-${t.id}`} title={t.label} onClick={() => useUI.setState({ leftTab: t.id })}>
              {TAB_ICONS[t.id]}<span>{t.short}</span>
            </button>
          ))}
        </nav>
        <div className="left-panel"><Panel /></div>
      </aside>
      <Divider axis="x" label="Largura do painel esquerdo" value={ui.leftWidth} min={250} max={520} onChange={(v) => useUI.setState({ leftWidth: v })} testId="divider-left" />
      <main className="center-area"><Stage /></main>
      <Divider axis="x" label="Largura do painel de propriedades" invert value={ui.rightWidth} min={250} max={480} onChange={(v) => useUI.setState({ rightWidth: v })} />
      <aside className="right-area" aria-label="Propriedades">
        <header className="panel-header"><h2>PROPRIEDADES</h2></header>
        <div className="panel-scroll is-padded"><Inspector /></div>
      </aside>
      <Divider axis="y" label="Altura da timeline" invert value={tlHeight} min={140} max={tlMax} onChange={(v) => useUI.setState({ timelineHeight: v })} testId="divider-timeline" />
      <div className="bottom-area">{ui.simpleMode ? <SimpleTimeline /> : <Timeline />}</div>
    </div>
  );
}

/* ----------------- mobile ----------------- */
/** Dock do celular: o caminho de uma história (cenas → elenco → cenário → áudio → câmera → editar). */
const DOCK: Array<{ id: Exclude<MobilePanel, null> | 'camera'; label: string; icon: React.ReactNode }> = [
  { id: 'scenes', label: 'Cenas', icon: <Film size={19} /> },
  { id: 'characters', label: 'Elenco', icon: <Users size={19} /> },
  { id: 'backgrounds', label: 'Cenários', icon: <Trees size={19} /> },
  { id: 'media', label: 'Áudio', icon: <Music size={19} /> },
  { id: 'camera', label: 'Câmera', icon: <Video size={19} /> },
  { id: 'properties', label: 'Editar', icon: <SlidersHorizontal size={19} /> },
];
const EXTRA: Array<{ id: LeftTab; label: string }> = [
  { id: 'objects', label: 'Objetos e meus objetos' }, { id: 'layers', label: 'Camadas' }, { id: 'templates', label: 'Modelos de cena' }, { id: 'library', label: 'Biblioteca' }, { id: 'direction', label: 'Direção (comandos)' },
];

/**
 * Barra rápida do celular. As ações mudam com o que está selecionado (personagem, objeto, texto,
 * câmera, clip) e com o estado dele no tempo atual (ex.: "Editar fala" se já está falando).
 */
function QuickBar() {
  const ui = useUI();
  const scene = useCurrentScene();
  const time = useTransport((t) => (t.playing ? -1 : t.timeMs));
  if (!scene) return null;
  const nodeId = ui.nodeIds.length === 1 ? ui.nodeIds[0]! : null;
  const node = nodeId ? scene.nodes[nodeId] : undefined;
  let title = '';
  let actions: QuickAction[] = [];
  if (ui.timeline?.clipId) {
    const f = findClip(scene, ui.timeline.clipId);
    if (f) {
      title = f.track.name;
      actions = quickActions(scene, { kind: 'clip', clipId: f.clip.id }, time < 0 ? 0 : time);
    }
  } else if (ui.camera) {
    title = 'Câmera';
    actions = quickActions(scene, { kind: 'camera' }, time < 0 ? 0 : time);
  } else if (node) {
    title = node.name;
    actions = quickActions(scene, { kind: 'node', node }, time < 0 ? transport.getState().timeMs : time);
  }
  if (!actions.length) return null;
  return (
    <nav className="m-quick" aria-label={`Ações rápidas: ${title}`} data-testid="mobile-quick">
      <strong>{title}</strong>
      {actions.map((a) => (
        <button key={a.key} type="button" className={`chip${a.key === 'delete' ? ' is-danger' : ''}`} data-testid={`quick-${a.key}`} onClick={() => runQuick(a, node?.kind === 'character' ? node.characterId : undefined)}>{a.label}</button>
      ))}
    </nav>
  );
}

function MobileEditor({ landscape }: { landscape: boolean }) {
  const ui = useUI();
  const [more, setMore] = useState(false);
  const panel = ui.mobilePanel;
  const label = panel === 'properties' ? 'Propriedades' : LEFT_TABS.find((t) => t.id === panel)?.label ?? '';
  const Panel = panel && panel !== 'properties' ? PANEL_COMPONENTS[panel] : null;
  const open = (id: Exclude<MobilePanel, null> | 'camera') => {
    if (id === 'camera') {
      // Câmera = seleção da câmera + propriedades (Enquadramento, Movimento, Seguir).
      const opened = ui.camera && panel === 'properties';
      useUI.setState(opened ? { mobilePanel: null } : { camera: true, nodeIds: [], timeline: null, mobilePanel: 'properties', mobilePanelExpanded: false });
      return;
    }
    useUI.setState({ mobilePanel: panel === id ? null : id, mobilePanelExpanded: false });
  };
  // Selecionar um elemento no palco não abre popup sozinho, mas o botão Editar destaca.
  const hasSel = ui.nodeIds.length > 0 || !!ui.timeline || ui.camera;
  return (
    <div className={`editor-mobile${landscape ? ' is-landscape' : ''}${ui.previewFocus ? ' is-focus' : ''}${panel ? ' has-popup' : ''}${panel && ui.mobilePanelExpanded ? ' is-expanded' : ''}`} data-testid="editor-mobile">
      <TopBar compact />
      <div className="m-stage">
        <Stage />
        {!ui.previewFocus && !panel && <QuickBar />}
        <IconButton label={ui.previewFocus ? 'Sair do modo foco' : 'Modo foco no palco'} className="m-focus-btn" testId="focus-mode" onClick={() => useUI.setState({ previewFocus: !ui.previewFocus, mobilePanel: null })}>{ui.previewFocus ? <Minimize size={17} /> : <Expand size={17} />}</IconButton>
      </div>
      {!ui.previewFocus && <div className="m-timeline">{ui.simpleMode ? <SimpleTimeline /> : <Timeline compact />}</div>}
      {panel && (
        <section className="m-popup" role="dialog" aria-label={label} data-testid="mobile-popup">
          <header className="m-popup-head">
            <strong>{label}</strong>
            <span className="tl-spacer" />
            <IconButton label={ui.mobilePanelExpanded ? 'Recolher painel' : 'Expandir painel'} testId="popup-expand" onClick={() => useUI.setState({ mobilePanelExpanded: !ui.mobilePanelExpanded })}><ChevronsUpDown size={17} /></IconButton>
            <IconButton label="Fechar painel" testId="popup-close" onClick={() => useUI.setState({ mobilePanel: null })}><X size={18} /></IconButton>
          </header>
          <div className="m-popup-body">
            {Panel ? <Panel /> : <div className="panel-scroll is-padded"><Inspector /></div>}
          </div>
        </section>
      )}
      {more && (
        <div className="m-more" role="menu" data-testid="mobile-more">
          {EXTRA.map((x) => <button key={x.id} type="button" role="menuitem" data-testid={`more-${x.id}`} onClick={() => { setMore(false); open(x.id); }}>{x.label}</button>)}
        </div>
      )}
      <nav className="m-dock" aria-label="Ferramentas" data-testid="mobile-dock">
        {DOCK.map((d) => (
          <button key={d.id} type="button" className={`dock-btn${(d.id === 'camera' ? ui.camera && panel === 'properties' : panel === d.id && !(d.id === 'properties' && ui.camera)) ? ' is-active' : ''}${d.id === 'properties' && hasSel ? ' has-dot' : ''}`} aria-pressed={d.id === 'camera' ? ui.camera && panel === 'properties' : panel === d.id} data-testid={`dock-${d.id}`} onClick={() => open(d.id)}>
            {d.icon}<span>{d.label}</span>
          </button>
        ))}
        <button type="button" className={`dock-btn${more ? ' is-active' : ''}`} aria-expanded={more} data-testid="dock-more" onClick={() => setMore(!more)}><FolderOpen size={19} /><span>Mais</span></button>
      </nav>
    </div>
  );
}

export function Editor() {
  useShortcuts();
  const mode = useLayoutMode();
  return (
    <>
      {mode === 'desktop' ? <DesktopEditor /> : <MobileEditor landscape={mode === 'mobile-landscape'} />}
      <Dialogs />
      <EditorOverlay />
    </>
  );
}

/** Manual e Configurações abertos por cima do editor: o projeto continua aberto embaixo. */
function EditorOverlay() {
  const overlay = useUI((s) => s.overlay);
  if (!overlay) return null;
  return (
    <div className="editor-overlay" role="dialog" aria-modal="true" aria-label={overlay.kind === 'manual' ? 'Manual' : overlay.kind === 'library' ? 'Biblioteca' : 'Configurações'} data-testid="editor-overlay">
      {overlay.kind === 'manual' ? <ManualView onClose={closeOverlay} /> : overlay.kind === 'library' ? <LibraryHome inEditor /> : <SettingsView onClose={closeOverlay} />}
    </div>
  );
}

export const selectFromMobile = selectNodes;
