/**
 * Timeline da cena atual. Linhas são virtualizadas; a agulha é atualizada direto no DOM
 * para que a reprodução não re-renderize a árvore inteira.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, Diamond, Eye, EyeOff, Headphones, Lock, LockOpen, Magnet, Music, Pause, Play, Plus, Repeat, RotateCcw, Scissors, SkipBack, Square, Subtitles, Upload, Volume2, VolumeX, ZoomIn, ZoomOut, Film,
} from 'lucide-react';
import {
  addEffect, addSubtitle, deleteTrack, findClip, moveKeyframe, sceneOf, splitClip,
} from '@/engine/model/ops';
import { CAMERA_TARGET, type AnyClip, type Project, type Scene, type Track } from '@/engine/model/schema';
import { getPropertyDef, formatKeyValue } from '@/engine/model/properties';
import { PEAK_WINDOW_MS } from '@/engine/animation/lipsync';
import { beginGroup, commit, endGroup, useCurrentScene, useProject } from '@/state/projectStore';
import { pause, seek, setProjectMode, setRate, stop, togglePlay, transport, useTransport } from '@/state/transport';
import { openContextMenu, promptDialog, selectCamera, selectNodes, selectTimeline, toast, useUI, type ContextMenuItem } from '@/state/uiStore';
import { AUDIO_ACCEPT } from '@/features/library/assets';
import { AUDIO_CATEGORIES, importAudioToLibrary, placeAudioInScene } from '@/state/mediaActions';
import type { AudioCategory } from '@/features/library/assets';
import { IconButton, MoreButton } from '../controls/fields';
import { parseNumberInput } from '../controls/SliderNumberField';
import { buildMontage } from '@/engine/render/montage';

const ROW_H = 30;
const LABEL_W_DESKTOP = 176;
const LABEL_W_MOBILE = 96;

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.round(ms));
  const m = Math.floor(total / 60000);
  const s = Math.floor((total % 60000) / 1000);
  const mm = total % 1000;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(mm).padStart(3, '0')}`;
}

type Row =
  | { kind: 'group'; id: string; label: string; target: string; hasChildren: boolean; expanded: boolean; keyTimes: number[] }
  | { kind: 'track'; id: string; track: Track; indent: boolean };

function buildRows(scene: Scene, expanded: Record<string, boolean>): Row[] {
  const rows: Row[] = [];
  const byTarget = new Map<string, Track[]>();
  const globals: Track[] = [];
  for (const t of scene.tracks) {
    if (t.type === 'property' || t.type === 'action' || t.type === 'dialogue') {
      const list = byTarget.get(t.targetNodeId) ?? [];
      list.push(t);
      byTarget.set(t.targetNodeId, list);
    } else globals.push(t);
  }
  const pushGroup = (target: string, label: string) => {
    const tracks = byTarget.get(target) ?? [];
    const propTracks = tracks.filter((t) => t.type === 'property');
    const main = tracks.filter((t) => t.type !== 'property');
    const isOpen = !!expanded[target];
    rows.push({ kind: 'group', id: `g-${target}`, target, label, hasChildren: propTracks.length > 0, expanded: isOpen, keyTimes: propTracks.flatMap((t) => (t.type === 'property' ? t.keyframes.map((k) => k.timeMs) : [])) });
    for (const t of main) rows.push({ kind: 'track', id: t.id, track: t, indent: true });
    if (isOpen) for (const t of propTracks) rows.push({ kind: 'track', id: t.id, track: t, indent: true });
  };
  pushGroup(CAMERA_TARGET, 'Câmera');
  for (const id of [...scene.layerOrder].reverse()) {
    const node = scene.nodes[id];
    if (node && !node.backgroundOwned) pushGroup(id, node.name);
    else if (node && byTarget.has(id)) pushGroup(id, node.name);
  }
  for (const t of globals) rows.push({ kind: 'track', id: t.id, track: t, indent: false });
  return rows;
}

const CLIP_COLORS: Record<string, string> = { action: '#7a5fd0', dialogue: '#2f9e8f', audio: '#3b78c4', subtitle: '#b98a2e', effect: '#c2556d' };

function clipLabel(c: AnyClip, project: Project): string {
  switch (c.kind) {
    case 'action': return c.label || c.action;
    case 'dialogue': return c.text || 'Fala';
    case 'audio': return project.assets[c.assetId]?.name ?? 'Áudio';
    case 'subtitle': return c.text || 'Legenda';
    case 'effect': return { shake: 'Tremor', flash: 'Flash', fadeBlack: 'Fade p/ preto', fadeFromBlack: 'Fade do preto', vignette: 'Vinheta', tint: 'Tinta' }[c.effect];
  }
}

const Waveform = memo(function Waveform({ peaks, offsetMs, durationMs }: { peaks: number[]; offsetMs: number; durationMs: number }) {
  const d = useMemo(() => {
    const start = Math.floor(offsetMs / PEAK_WINDOW_MS);
    const count = Math.ceil(durationMs / PEAK_WINDOW_MS);
    const step = Math.max(1, Math.floor(count / 400));
    let out = '';
    for (let i = 0; i < count; i += step) {
      const v = peaks[start + i] ?? 0;
      const x = (i / count) * 100;
      out += `M${x.toFixed(2)} ${(50 - v * 48).toFixed(1)}V${(50 + v * 48).toFixed(1)}`;
    }
    return out;
  }, [peaks, offsetMs, durationMs]);
  return <svg className="waveform" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={d} stroke="#cfe3ff" strokeOpacity=".75" strokeWidth=".35" vectorEffect="non-scaling-stroke" fill="none" /></svg>;
});

type Interaction =
  | { kind: 'clip-move'; clipId: string; startX: number; startMs: number }
  | { kind: 'clip-left' | 'clip-right'; clipId: string; startX: number; startMs: number; durMs: number; offsetMs: number }
  | { kind: 'key'; trackId: string; keyId: string; startX: number; startMs: number };

export function Timeline({ compact = false }: { compact?: boolean }) {
  const project = useProject();
  const scene = useCurrentScene();
  const ui = useUI();
  const playing = useTransport((s) => s.playing);
  const loop = useTransport((s) => s.loop);
  const rate = useTransport((s) => s.rate);
  const projectMode = useTransport((s) => s.projectMode);
  const rangeStart = useTransport((s) => s.rangeStart);
  const rangeEnd = useTransport((s) => s.rangeEnd);
  const scrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const clockRef = useRef<HTMLSpanElement>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewH, setViewH] = useState(200);
  const interaction = useRef<Interaction | null>(null);
  const audioInput = useRef<HTMLInputElement>(null);
  const audioCategory = useRef<AudioCategory>('voice');
  const pxPerSec = ui.timelineZoom;
  const labelW = compact ? LABEL_W_MOBILE : LABEL_W_DESKTOP;

  const rows = useMemo(() => (scene ? buildRows(scene, ui.expandedTracks) : []), [scene, ui.expandedTracks]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewH(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Agulha, relógio e auto-rolagem por assinatura direta.
  useEffect(() => {
    const paint = () => {
      const s = transport.getState();
      const x = (s.timeMs / 1000) * pxPerSec;
      if (playheadRef.current) playheadRef.current.style.transform = `translateX(${x}px)`;
      if (clockRef.current) clockRef.current.textContent = formatTime(s.timeMs);
      if (timeInputRef.current && document.activeElement !== timeInputRef.current) timeInputRef.current.value = (s.timeMs / 1000).toFixed(3).replace('.', ',');
      const el = scrollRef.current;
      if (el && s.playing) {
        const viewW = el.clientWidth - labelW;
        if (x - el.scrollLeft > viewW - 30 || x < el.scrollLeft) el.scrollLeft = Math.max(0, x - 40);
      }
    };
    paint();
    return transport.subscribe(paint);
  }, [pxPerSec, labelW]);

  if (!project || !scene) return null;
  const durationMs = scene.durationMs;
  const contentW = Math.max((scrollRef.current?.clientWidth ?? 800) - labelW, (durationMs / 1000) * pxPerSec + 80);

  const snapTime = (ms: number, excludeId?: string): number => {
    if (!ui.snapTimeline) return Math.round(ms);
    const points: number[] = [0, durationMs, transport.getState().timeMs];
    for (const t of scene.tracks) {
      if (t.type === 'property') for (const k of t.keyframes) { if (k.id !== excludeId) points.push(k.timeMs); }
      else for (const c of t.clips as AnyClip[]) if (c.id !== excludeId) points.push(c.startMs, c.startMs + c.durationMs);
    }
    const threshold = (8 / pxPerSec) * 1000;
    let best = ms;
    let bestD = threshold;
    for (const p of points) {
      const d = Math.abs(p - ms);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best === ms) {
      // Grade de quadro: tempo sempre em quadros inteiros quando o encaixe está ativo.
      const frameMs = 1000 / project.settings.fps;
      return Math.round(Math.round(ms / frameMs) * frameMs);
    }
    return Math.round(best);
  };

  const scrub = (clientX: number) => {
    const el = scrollRef.current!;
    const r = el.getBoundingClientRect();
    const x = clientX - r.left - labelW + el.scrollLeft;
    seek(snapTime((x / pxPerSec) * 1000));
  };

  const onRulerDown = (e: React.PointerEvent) => {
    pause();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    scrub(e.clientX);
  };

  const startInteraction = (e: React.PointerEvent, it: Interaction, label: string) => {
    e.stopPropagation();
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    interaction.current = it;
    beginGroup(label);
  };

  const onInteractionMove = (e: React.PointerEvent) => {
    const it = interaction.current;
    if (!it) return;
    const dMs = ((e.clientX - it.startX) / pxPerSec) * 1000;
    if (it.kind === 'key') {
      const t = snapTime(it.startMs + dMs, it.keyId);
      commit('Mover keyframe', (d) => {
        const tr = sceneOf(d as Project, scene.id).tracks.find((x) => x.id === it.trackId);
        if (tr?.type === 'property') moveKeyframe(tr, it.keyId, Math.max(0, Math.min(durationMs, t)));
      });
      return;
    }
    commit('Editar clip', (d) => {
      const s = sceneOf(d as Project, scene.id);
      const f = findClip(s, it.clipId);
      if (!f) return;
      const clip = f.clip;
      if (it.kind === 'clip-move') {
        clip.startMs = Math.max(0, Math.min(durationMs - 10, snapTime(it.startMs + dMs, it.clipId)));
      } else if (it.kind === 'clip-right') {
        const end = snapTime(it.startMs + it.durMs + dMs, it.clipId);
        clip.durationMs = Math.max(50, end - clip.startMs);
      } else {
        const start = Math.max(0, Math.min(it.startMs + it.durMs - 50, snapTime(it.startMs + dMs, it.clipId)));
        clip.startMs = start;
        clip.durationMs = it.startMs + it.durMs - start;
        if (clip.kind === 'audio') clip.offsetMs = Math.max(0, it.offsetMs + (start - it.startMs));
      }
    });
  };

  const onInteractionEnd = () => {
    if (interaction.current) endGroup();
    interaction.current = null;
  };

  const trackMenu = (t: Track): ContextMenuItem[] => {
    const set = (label: string, fn: (tr: Track) => void) => commit(label, (d) => {
      const tr = sceneOf(d as Project, scene.id).tracks.find((x) => x.id === t.id);
      if (tr) fn(tr);
    });
    const items: ContextMenuItem[] = [
      { label: 'Renomear', onSelect: async () => {
        const v = await promptDialog('Renomear trilha', 'Nome', t.name);
        if (v) set('Renomear trilha', (tr) => { tr.name = v; });
      } },
      { label: t.enabled ? 'Desabilitar' : 'Habilitar', onSelect: () => set('Habilitar trilha', (tr) => { tr.enabled = !tr.enabled; }) },
      { label: t.locked ? 'Desbloquear' : 'Bloquear', onSelect: () => set('Bloquear trilha', (tr) => { tr.locked = !tr.locked; }) },
    ];
    if (t.type === 'audio') {
      items.push({ label: t.muted ? 'Tirar do mudo' : 'Mudo', onSelect: () => set('Mudo', (tr) => { tr.muted = !tr.muted; }) });
      items.push({ label: t.solo ? 'Tirar do solo' : 'Solo', onSelect: () => set('Solo', (tr) => { tr.solo = !tr.solo; }) });
    }
    items.push({ label: 'Excluir trilha', danger: true, onSelect: () => commit('Excluir trilha', (d) => deleteTrack(sceneOf(d as Project, scene.id), t.id)) });
    return items;
  };

  const first = Math.max(0, Math.floor(scrollTop / ROW_H) - 4);
  const last = Math.min(rows.length, Math.ceil((scrollTop + viewH) / ROW_H) + 4);

  const tickStep = pxPerSec >= 150 ? 0.5 : pxPerSec >= 60 ? 1 : pxPerSec >= 25 ? 2 : 5;
  const ticks: number[] = [];
  for (let t = 0; t <= durationMs / 1000 + 1e-6; t += tickStep) ticks.push(Number(t.toFixed(3)));

  const selectedKey = ui.timeline?.keyId;
  const selectedClip = ui.timeline?.clipId;

  const renderTrackLane = (t: Track) => {
    if (t.type === 'property') {
      const def = getPropertyDef(t.targetNodeId === CAMERA_TARGET ? 'camera' : (scene.nodes[t.targetNodeId]?.kind ?? 'character'), t.propertyPath);
      return t.keyframes.map((k) => (
        <button
          key={k.id}
          type="button"
          className={`tl-key${selectedKey === k.id ? ' is-selected' : ''}${k.interpolation === 'hold' ? ' is-hold' : ''}`}
          style={{ left: (k.timeMs / 1000) * pxPerSec }}
          title={`${(k.timeMs / 1000).toLocaleString('pt-BR')} s · ${formatKeyValue(k.value, def)}`}
          aria-label={`Keyframe de ${t.name} em ${(k.timeMs / 1000).toLocaleString('pt-BR')} segundos`}
          data-testid="tl-key"
          disabled={t.locked}
          onPointerDown={(e) => {
            selectTimeline({ trackId: t.id, keyId: k.id });
            pause();
            seek(k.timeMs);
            startInteraction(e, { kind: 'key', trackId: t.id, keyId: k.id, startX: e.clientX, startMs: k.timeMs }, `key-${k.id}`);
          }}
          onPointerMove={onInteractionMove}
          onPointerUp={onInteractionEnd}
          onPointerCancel={onInteractionEnd}
        />
      ));
    }
    return (t.clips as AnyClip[]).map((c) => {
      const peaks = c.kind === 'audio' ? project.assets[c.assetId]?.peaks : undefined;
      const left = (c.startMs / 1000) * pxPerSec;
      const width = Math.max(4, (c.durationMs / 1000) * pxPerSec);
      return (
        <div
          key={c.id}
          role="button"
          tabIndex={0}
          className={`tl-clip${selectedClip === c.id ? ' is-selected' : ''}${t.locked ? ' is-locked' : ''}`}
          style={{ left, width, background: CLIP_COLORS[c.kind] }}
          data-testid={`tl-clip-${c.kind}`}
          title={clipLabel(c, project)}
          onPointerDown={(e) => {
            selectTimeline({ trackId: t.id, clipId: c.id });
            if (!t.locked) startInteraction(e, { kind: 'clip-move', clipId: c.id, startX: e.clientX, startMs: c.startMs }, `clip-${c.id}`);
          }}
          onPointerMove={onInteractionMove}
          onPointerUp={onInteractionEnd}
          onPointerCancel={onInteractionEnd}
          onKeyDown={(e) => {
            if (e.key === 'Enter') selectTimeline({ trackId: t.id, clipId: c.id });
          }}
        >
          {peaks && <Waveform peaks={peaks} offsetMs={c.kind === 'audio' ? c.offsetMs : 0} durationMs={c.durationMs} />}
          <span className="tl-clip-label">{clipLabel(c, project)}</span>
          {!t.locked && (
            <>
              <span className="tl-trim is-left" onPointerDown={(e) => startInteraction(e, { kind: 'clip-left', clipId: c.id, startX: e.clientX, startMs: c.startMs, durMs: c.durationMs, offsetMs: c.kind === 'audio' ? c.offsetMs : 0 }, `trim-${c.id}`)} onPointerMove={onInteractionMove} onPointerUp={onInteractionEnd} />
              <span className="tl-trim is-right" onPointerDown={(e) => startInteraction(e, { kind: 'clip-right', clipId: c.id, startX: e.clientX, startMs: c.startMs, durMs: c.durationMs, offsetMs: 0 }, `trim-${c.id}`)} onPointerMove={onInteractionMove} onPointerUp={onInteractionEnd} />
            </>
          )}
        </div>
      );
    });
  };

  const addMenu = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const t = transport.getState().timeMs;
    openContextMenu({ x: r.left, y: r.top - 8, title: 'Adicionar à timeline', items: [
      { label: 'Legenda', onSelect: () => commit('Adicionar legenda', (d) => void addSubtitle(sceneOf(d as Project, scene.id), 'Legenda', t, 2000)) },
      { label: 'Efeito: tremor', onSelect: () => commit('Adicionar efeito', (d) => void addEffect(sceneOf(d as Project, scene.id), 'shake', t, 500)) },
      { label: 'Efeito: flash', onSelect: () => commit('Adicionar efeito', (d) => void addEffect(sceneOf(d as Project, scene.id), 'flash', t, 300)) },
      { label: 'Efeito: fade para preto', onSelect: () => commit('Adicionar efeito', (d) => void addEffect(sceneOf(d as Project, scene.id), 'fadeBlack', t, 800)) },
      { label: 'Efeito: fade do preto', onSelect: () => commit('Adicionar efeito', (d) => void addEffect(sceneOf(d as Project, scene.id), 'fadeFromBlack', t, 800)) },
      { label: 'Efeito: vinheta', onSelect: () => commit('Adicionar efeito', (d) => void addEffect(sceneOf(d as Project, scene.id), 'vignette', t, 3000)) },
    ] });
  };

  return (
    <section className={`timeline${compact ? ' is-compact' : ''}`} aria-label="Linha do tempo" data-testid="timeline">
      <div className="tl-transport">
        <IconButton label="Voltar ao início" onClick={() => seek(0)}><SkipBack size={16} /></IconButton>
        <button type="button" className="play-btn" aria-label={playing ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'} title={playing ? 'Pausar (Espaço)' : 'Reproduzir (Espaço)'} data-testid="play" onClick={togglePlay}>
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <IconButton label="Parar" testId="stop" onClick={stop}><Square size={15} /></IconButton>
        <div className="tl-clock" aria-live="off">
          <span ref={clockRef} data-testid="clock">00:00:000</span>
          <small>/ {formatTime(durationMs)}</small>
        </div>
        <label className="tl-time-input">
          <span className="sr-only">Tempo atual em segundos</span>
          <input ref={timeInputRef} className="input input-sm" inputMode="decimal" data-testid="time-input" defaultValue="0" aria-label="Tempo atual em segundos"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                const v = parseNumberInput(e.currentTarget.value);
                if (v !== null) seek(v * 1000);
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              const v = parseNumberInput(e.currentTarget.value);
              if (v !== null) seek(v * 1000);
            }}
          />
          <small>s</small>
        </label>
        {!compact && <span className="tl-fps">{project.settings.fps} fps</span>}
        <span className="tl-spacer" />
        <IconButton label="Repetir" active={loop} testId="loop" onClick={() => transport.setState({ loop: !loop })}><Repeat size={16} /></IconButton>
        {!compact && (
          <>
            <IconButton label={rangeStart === null ? 'Marcar início do trecho' : 'Limpar início do trecho'} active={rangeStart !== null} onClick={() => transport.setState({ rangeStart: rangeStart === null ? transport.getState().timeMs : null })}><span className="txt-icon">[</span></IconButton>
            <IconButton label={rangeEnd === null ? 'Marcar fim do trecho' : 'Limpar fim do trecho'} active={rangeEnd !== null} onClick={() => transport.setState({ rangeEnd: rangeEnd === null ? transport.getState().timeMs : null })}><span className="txt-icon">]</span></IconButton>
          </>
        )}
        <select className="input input-sm" aria-label="Velocidade de reprodução (não afeta a exportação)" value={rate} onChange={(e) => setRate(Number(e.target.value))} data-testid="speed">
          {[0.25, 0.5, 1, 1.5, 2].map((v) => <option key={v} value={v}>{String(v).replace('.', ',')}×</option>)}
        </select>
        <IconButton label="Reproduzir o projeto inteiro (montagem com transições)" active={projectMode} testId="project-mode" onClick={() => setProjectMode(!projectMode)}><Film size={16} /></IconButton>
        <IconButton label="Encaixe na timeline" active={ui.snapTimeline} onClick={() => useUI.setState({ snapTimeline: !ui.snapTimeline })}><Magnet size={16} /></IconButton>
        <IconButton label="Diminuir zoom da timeline" testId="tl-zoom-out" onClick={() => useUI.setState({ timelineZoom: Math.max(12, ui.timelineZoom / 1.3) })}><ZoomOut size={16} /></IconButton>
        <IconButton label="Aumentar zoom da timeline" testId="tl-zoom-in" onClick={() => useUI.setState({ timelineZoom: Math.min(500, ui.timelineZoom * 1.3) })}><ZoomIn size={16} /></IconButton>
        <IconButton label="Cortar clip na agulha" disabled={!selectedClip} onClick={() => {
          if (!selectedClip) return;
          commit('Cortar clip', (d) => void splitClip(sceneOf(d as Project, scene.id), selectedClip, transport.getState().timeMs));
        }}><Scissors size={16} /></IconButton>
        <button type="button" className="btn btn-sm tl-audio-btn" data-testid="tl-import-audio" title="Importar áudio e colocar na trilha certa, no tempo da agulha" onClick={(e) => {
          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
          openContextMenu({ x: r.left, y: r.top - 8, title: 'Importar áudio como…', items: AUDIO_CATEGORIES.map((c) => ({ label: c.label, onSelect: () => { audioCategory.current = c.id; audioInput.current?.click(); } })) });
        }}><Music size={14} />{!compact && ' Áudio'}</button>
        <IconButton label="Adicionar legenda ou efeito" testId="tl-add" onClick={addMenu}><Plus size={16} /></IconButton>
        <input ref={audioInput} hidden type="file" multiple accept={AUDIO_ACCEPT} data-testid="audio-input" onChange={async (e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          const assets = await importAudioToLibrary(files, audioCategory.current);
          for (const a of assets) placeAudioInScene(a.id);
        }} />
      </div>
      {projectMode && <ProjectModeBar />}
      <div className="tl-scroll" ref={scrollRef} data-testid="tl-scroll"
        onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            useUI.setState({ timelineZoom: Math.min(500, Math.max(12, ui.timelineZoom * (e.deltaY < 0 ? 1.1 : 0.9))) });
          }
        }}>
        <div className="tl-canvas" style={{ width: contentW + labelW }}>
          <div className="tl-ruler-row">
            <div className="tl-corner" style={{ width: labelW }}>Trilhas</div>
            <div className="tl-ruler" style={{ width: contentW }} data-testid="tl-ruler" onPointerDown={onRulerDown} onPointerMove={(e) => { if (e.buttons) scrub(e.clientX); }}>
              {ticks.map((t) => <span key={t} className="tl-tick" style={{ left: t * pxPerSec }}>{Number.isInteger(t) ? `${t}s` : ''}</span>)}
              <div className="tl-end" style={{ left: (durationMs / 1000) * pxPerSec }} />
              {rangeStart !== null && <div className="tl-range" style={{ left: (rangeStart / 1000) * pxPerSec, width: (((rangeEnd ?? durationMs) - rangeStart) / 1000) * pxPerSec }} />}
            </div>
          </div>
          <div className="tl-rows" style={{ height: rows.length * ROW_H, width: contentW + labelW }}>
            {rows.slice(first, last).map((row, i) => {
              const top = (first + i) * ROW_H;
              if (row.kind === 'group') {
                const sel = row.target === CAMERA_TARGET ? ui.camera : ui.nodeIds.includes(row.target);
                return (
                  <div key={row.id} className={`tl-row is-group${sel ? ' is-selected' : ''}`} style={{ top }}>
                    <div className="tl-label" style={{ width: labelW }}>
                      {row.hasChildren ? (
                        <button type="button" className="tl-expander" aria-expanded={row.expanded} aria-label={`${row.expanded ? 'Recolher' : 'Expandir'} propriedades de ${row.label}`} onClick={() => useUI.setState({ expandedTracks: { ...ui.expandedTracks, [row.target]: !row.expanded } })}>
                          {row.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        </button>
                      ) : <span className="tl-expander-space" />}
                      <button type="button" className="tl-label-name" title={row.label} onClick={() => (row.target === CAMERA_TARGET ? selectCamera() : selectNodes([row.target]))}>{row.label}</button>
                    </div>
                    <div className="tl-lane" style={{ width: contentW }} data-group-lane>
                      {[...new Set(row.keyTimes)].map((k) => <span key={k} className="tl-dot" style={{ left: (k / 1000) * pxPerSec }} />)}
                    </div>
                  </div>
                );
              }
              const t = row.track;
              return (
                <div key={row.id} className={`tl-row${t.enabled ? '' : ' is-off'}`} style={{ top }} data-track-type={t.type}>
                  <div className={`tl-label${row.indent ? ' is-indent' : ''}`} style={{ width: labelW }} onContextMenu={(e) => { e.preventDefault(); openContextMenu({ x: e.clientX, y: e.clientY, title: t.name, items: trackMenu(t) }); }}>
                    <span className="tl-track-icon" aria-hidden="true">{t.type === 'audio' ? <Music size={12} /> : t.type === 'subtitle' ? <Subtitles size={12} /> : t.type === 'property' ? <Diamond size={11} /> : null}</span>
                    <span className="tl-track-name" title={t.name}>{t.name}</span>
                    {!compact && t.type === 'audio' && (
                      <>
                        <button type="button" className={`tl-mini${t.muted ? ' is-active' : ''}`} aria-pressed={t.muted} aria-label={`Mudo em ${t.name}`} onClick={() => commit('Mudo', (d) => { const tr = sceneOf(d as Project, scene.id).tracks.find((x) => x.id === t.id); if (tr) tr.muted = !tr.muted; })}>{t.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}</button>
                        <button type="button" className={`tl-mini${t.solo ? ' is-active' : ''}`} aria-pressed={t.solo} aria-label={`Solo em ${t.name}`} onClick={() => commit('Solo', (d) => { const tr = sceneOf(d as Project, scene.id).tracks.find((x) => x.id === t.id); if (tr) tr.solo = !tr.solo; })}><Headphones size={12} /></button>
                      </>
                    )}
                    {!compact && (
                      <button type="button" className={`tl-mini${!t.enabled ? ' is-active' : ''}`} aria-pressed={!t.enabled} aria-label={`${t.enabled ? 'Desabilitar' : 'Habilitar'} ${t.name}`} onClick={() => commit('Habilitar trilha', (d) => { const tr = sceneOf(d as Project, scene.id).tracks.find((x) => x.id === t.id); if (tr) tr.enabled = !tr.enabled; })}>{t.enabled ? <Eye size={12} /> : <EyeOff size={12} />}</button>
                    )}
                    {!compact && (
                      <button type="button" className={`tl-mini${t.locked ? ' is-active' : ''}`} aria-pressed={t.locked} aria-label={`${t.locked ? 'Desbloquear' : 'Bloquear'} ${t.name}`} onClick={() => commit('Bloquear trilha', (d) => { const tr = sceneOf(d as Project, scene.id).tracks.find((x) => x.id === t.id); if (tr) tr.locked = !tr.locked; })}>{t.locked ? <Lock size={12} /> : <LockOpen size={12} />}</button>
                    )}
                    <MoreButton label={`Opções de ${t.name}`} items={() => trackMenu(t)} />
                  </div>
                  <div className="tl-lane" style={{ width: contentW }}>{renderTrackLane(t)}</div>
                </div>
              );
            })}
          </div>
          <div className="tl-playhead-layer" style={{ left: labelW }}>
            <div className="tl-playhead" ref={playheadRef} data-testid="playhead" />
          </div>
        </div>
      </div>
    </section>
  );
}

function ProjectModeBar() {
  const project = useProject();
  const pt = useTransport((s) => s.projectTimeMs);
  if (!project) return null;
  const { segments, totalMs } = buildMontage(project);
  const idx = segments.findIndex((s, i) => pt >= s.startMs && (i === segments.length - 1 || pt < segments[i + 1]!.startMs));
  return (
    <div className="tl-project-bar" data-testid="project-bar">
      <RotateCcw size={13} aria-hidden="true" /> Montagem: cena {idx + 1} de {segments.length} · {formatTime(pt)} / {formatTime(totalMs)}
      <div className="tl-project-track"><div style={{ width: `${(pt / Math.max(1, totalMs)) * 100}%` }} /></div>
    </div>
  );
}

export { Upload, toast };
