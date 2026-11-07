/**
 * Palco. O SVG de cena usa o MESMO plano da exportação; guias, máscara e gizmos ficam
 * em um segundo SVG por cima, que nunca entra em arquivo nenhum.
 * Zoom e pan do editor alteram só o viewBox, nunca a câmera exportada.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Camera, Focus, Grid3x3, Maximize, Pause, Ruler, Scan, Shield, ZoomIn, ZoomOut } from 'lucide-react';
import { evaluateScene } from '@/engine/animation/evaluate';
import { cameraTransform, nodeLocalBounds, planFrame } from '@/engine/render/plan';
import { buildMontage, planMontageFrame } from '@/engine/render/montage';
import { frameSize, type SceneNode } from '@/engine/model/schema';
import { getPath } from '@/engine/model/properties';
import { readProperty, sceneOf, writeProperty } from '@/engine/model/ops';
import { n } from '@/engine/render/svg';
import { previewAssetUrl } from '@/features/library/assets';
import { beginGroup, commit, endGroup, useCurrentScene, useProject, useProjectStore } from '@/state/projectStore';
import { transport, useTransport } from '@/state/transport';
import { clearSelection, openContextMenu, selectCamera, selectNodes, useUI } from '@/state/uiStore';
import { deleteSelection, duplicateSelection } from '@/state/actions';
import { moveLayer } from '@/engine/model/ops';
import { IconButton } from '../controls/fields';
import { StageRenderer } from './StageRenderer';

const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3];

/** Transforma um ponto local do nó em coordenadas do palco, igual ao renderizador. */
export function nodeMatrix(node: SceneNode, cam: Parameters<typeof cameraTransform>[0]): DOMMatrix {
  const m = new DOMMatrix();
  const camT = cameraTransform(cam, node.parallax);
  const t = node.transform;
  const parts = camT.match(/(rotate|scale|translate)\(([^)]+)\)/g) ?? [];
  for (const p of parts) {
    const [, fn, args] = p.match(/(rotate|scale|translate)\(([^)]+)\)/)!;
    const v = args!.trim().split(/[\s,]+/).map(Number);
    if (fn === 'rotate') m.rotateSelf(v[0]!);
    if (fn === 'scale') m.scaleSelf(v[0]!, v[1] ?? v[0]!);
    if (fn === 'translate') m.translateSelf(v[0]!, v[1] ?? 0);
  }
  m.translateSelf(t.x, t.y);
  if (t.rotationDeg) m.rotateSelf(t.rotationDeg);
  m.scaleSelf(t.scaleX, t.scaleY);
  return m;
}

type Drag =
  | { kind: 'move'; start: { x: number; y: number }; origin: Array<{ id: string; x: number; y: number }>; k: number }
  | { kind: 'scale'; id: string; centerX: number; centerY: number; startDist: number; sx: number; sy: number }
  | { kind: 'rotate'; id: string; centerX: number; centerY: number; startAngle: number; rot: number }
  | { kind: 'pan'; startX: number; startY: number; px: number; py: number };

export function Stage() {
  const scene = useCurrentScene();
  const project = useProject();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const rendererRef = useRef<StageRenderer | null>(null);
  const [size, setSize] = useState({ w: 800, h: 450 });
  const ui = useUI();
  const playing = useTransport((s) => s.playing);
  const projectMode = useTransport((s) => s.projectMode);
  const drag = useRef<Drag | null>(null);
  const overlayDirty = useRef<(() => void) | null>(null);
  const lastPlaying = useRef(false);
  const movedRef = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);
  const [snapLines, setSnapLines] = useState<{ x?: number; y?: number }>({});

  const frame = project ? frameSize(project.settings) : { w: 1920, h: 1080 };
  const fit = Math.min(size.w / frame.w, size.h / frame.h) * (ui.frameOnly ? 1 : 0.9);
  const scale = ui.stageZoom === 'fit' ? fit : ui.stageZoom;
  const vbW = size.w / scale;
  const vbH = size.h / scale;
  const vbX = -vbW / 2 + ui.stagePanX;
  const vbY = -vbH / 2 + ui.stagePanY;
  const viewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;
  const toWorld = useCallback((clientX: number, clientY: number) => {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / scale + vbX, y: (clientY - r.top) / scale + vbY };
  }, [scale, vbX, vbY]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: Math.max(40, el.clientWidth), h: Math.max(40, el.clientHeight) }));
    ro.observe(el);
    setSize({ w: Math.max(40, el.clientWidth), h: Math.max(40, el.clientHeight) });
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    if (!svgRef.current) return;
    rendererRef.current = new StageRenderer(svgRef.current);
    return () => rendererRef.current?.dispose();
  }, []);

  // Render: sempre em função de (projeto, cena, tempo), e só quando algo muda.
  useEffect(() => {
    const draw = () => {
      const { project: p } = useProjectStore.getState();
      if (!p || !rendererRef.current) return;
      const t = transport.getState();
      const sc = p.scenes[p.currentSceneId ?? p.sceneOrder[0]!];
      if (!sc) return;
      if (t.projectMode) {
        const { segments } = buildMontage(p);
        rendererRef.current.update(planMontageFrame(p, segments, t.projectTimeMs, previewAssetUrl));
      } else {
        rendererRef.current.update(planFrame(p, sc, t.timeMs, previewAssetUrl));
      }
      drawOverlay();
    };
    // Na reprodução o overlay fica oculto: nada de re-renderizar React a cada quadro.
    const drawOverlay = () => {
      if (!transport.getState().playing || lastPlaying.current) overlayDirty.current?.();
      lastPlaying.current = transport.getState().playing;
    };
    draw();
    const un1 = transport.subscribe(draw);
    const un2 = useProjectStore.subscribe((s, prev) => {
      if (s.project !== prev.project) draw();
    });
    return () => {
      un1();
      un2();
    };
  }, []);

  const [, forceOverlay] = useState(0);
  useEffect(() => {
    let raf = 0;
    overlayDirty.current = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => forceOverlay((v) => v + 1));
    };
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!project || !scene) return null;

  const timeMs = transport.getState().timeMs;
  const resolved = evaluateScene(project, scene, timeMs);
  const selected = ui.nodeIds.map((id) => resolved.nodes[id]).filter(Boolean) as SceneNode[];
  const one = selected.length === 1 ? selected[0]! : null;

  const px = 1 / scale;

  const commitTransform = (id: string, path: string, value: number) => {
    const t = transport.getState().timeMs;
    commit('Mover no palco', (d) => {
      writeProperty(sceneOf(d as never, scene.id), id, path, value, t);
    });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (playing) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: scale };
      drag.current = null;
      endGroup();
      return;
    }
    if (e.button === 1 || (e.altKey && e.button === 0)) {
      drag.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, px: ui.stagePanX, py: ui.stagePanY };
      return;
    }
    if (e.button !== 0) return;
    const target = e.target as Element;
    const handle = target.closest('[data-handle]');
    const w = toWorld(e.clientX, e.clientY);
    if (handle && one) {
      const box = nodeMatrix(one, resolved.camera);
      const cx = box.e;
      const cy = box.f;
      const kind = handle.getAttribute('data-handle');
      beginGroup(`gizmo-${one.id}`);
      if (kind === 'rotate') {
        drag.current = { kind: 'rotate', id: one.id, centerX: cx, centerY: cy, startAngle: Math.atan2(w.y - cy, w.x - cx), rot: one.transform.rotationDeg };
      } else {
        drag.current = { kind: 'scale', id: one.id, centerX: cx, centerY: cy, startDist: Math.max(1, Math.hypot(w.x - cx, w.y - cy)), sx: one.transform.scaleX, sy: one.transform.scaleY };
      }
      return;
    }
    // Seleção no palco: o elemento clicado de cima para baixo.
    const svgHit = document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.closest?.('[data-node-id]'));
    const hit = svgHit?.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
    if (!hit) {
      clearSelection();
      drag.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, px: ui.stagePanX, py: ui.stagePanY };
      if (ui.stageZoom === 'fit' && e.pointerType === 'touch') drag.current = null;
      return;
    }
    const node = scene.nodes[hit];
    if (!node) return;
    let nextSel = ui.nodeIds;
    if (e.shiftKey) nextSel = ui.nodeIds.includes(hit) ? ui.nodeIds.filter((x) => x !== hit) : [...ui.nodeIds, hit];
    else if (!ui.nodeIds.includes(hit)) nextSel = [hit];
    selectNodes(nextSel);
    if (node.locked) return;
    const origin = nextSel.filter((id) => !scene.nodes[id]?.locked).map((id) => ({
      id,
      x: readProperty(scene, id, 'transform.x', timeMs) as number,
      y: readProperty(scene, id, 'transform.y', timeMs) as number,
    }));
    beginGroup(`move-${hit}`);
    drag.current = { kind: 'move', start: w, origin, k: Math.max(0.05, resolved.camera.zoom) };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      useUI.setState({ stageZoom: Math.min(6, Math.max(0.1, pinch.current.zoom * (d / pinch.current.dist))) });
      return;
    }
    const dr = drag.current;
    if (!dr) return;
    const w = toWorld(e.clientX, e.clientY);
    if (dr.kind === 'pan') {
      useUI.setState({ stagePanX: dr.px - (e.clientX - dr.startX) / scale, stagePanY: dr.py - (e.clientY - dr.startY) / scale });
      return;
    }
    if (dr.kind === 'move') {
      let dx = (w.x - dr.start.x) / dr.k;
      const dy = (w.y - dr.start.y) / dr.k;
      // Tremor de dedo não é arraste.
      if (!movedRef.current && Math.hypot(dx, dy) * scale < 4) return;
      movedRef.current = true;
      const lines: { x?: number } = {};
      if (ui.snapStage && dr.origin.length === 1) {
        const o = dr.origin[0]!;
        const candidates = [0, -frame.w / 6, frame.w / 6];
        for (const c of candidates) {
          if (Math.abs(o.x + dx - c) < 8 / scale) {
            dx = c - o.x;
            lines.x = c;
          }
        }
      }
      setSnapLines(lines);
      for (const o of dr.origin) {
        commitTransform(o.id, 'transform.x', o.x + dx);
        commitTransform(o.id, 'transform.y', o.y + dy);
      }
      return;
    }
    if (dr.kind === 'scale') {
      const k = Math.hypot(w.x - dr.centerX, w.y - dr.centerY) / dr.startDist;
      commitTransform(dr.id, 'transform.scaleX', Math.max(0.02, dr.sx * k));
      commitTransform(dr.id, 'transform.scaleY', Math.max(0.02, dr.sy * k));
      return;
    }
    if (dr.kind === 'rotate') {
      const a = Math.atan2(w.y - dr.centerY, w.x - dr.centerX);
      let deg = dr.rot + ((a - dr.startAngle) * 180) / Math.PI;
      if (e.shiftKey) deg = Math.round(deg / 15) * 15;
      commitTransform(dr.id, 'transform.rotationDeg', Math.round(deg * 10) / 10);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const finished = drag.current;
    if (finished?.kind === 'move' && !movedRef.current && window.innerWidth < 900) useUI.setState({ mobilePanel: 'properties' });
    movedRef.current = false;
    if (pointers.current.size < 2) pinch.current = null;
    if (drag.current && drag.current.kind !== 'pan') endGroup();
    drag.current = null;
    setSnapLines({});
  };

  const onWheel = (e: React.WheelEvent) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const next = Math.min(6, Math.max(0.1, scale * (e.deltaY < 0 ? 1.1 : 0.9)));
    useUI.setState({ stageZoom: next });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const hit = (document.elementsFromPoint(e.clientX, e.clientY).find((el) => el.closest?.('[data-node-id]'))?.closest('[data-node-id]'))?.getAttribute('data-node-id');
    if (!hit) return;
    selectNodes([hit]);
    const mv = (how: 'up' | 'down' | 'top' | 'bottom', label: string) => ({ label, onSelect: () => commit('Mover camada', (d) => void moveLayer(sceneOf(d as never, scene.id), hit, how)) });
    openContextMenu({ x: e.clientX, y: e.clientY, title: scene.nodes[hit]?.name, items: [
      { label: 'Duplicar', onSelect: duplicateSelection },
      mv('up', 'Subir uma camada'), mv('down', 'Descer uma camada'), mv('top', 'Trazer para a frente'), mv('bottom', 'Enviar para o fundo'),
      { label: 'Excluir', danger: true, onSelect: () => void deleteSelection() },
    ] });
  };

  // ---------- overlay ----------
  const fw = frame.w;
  const fh = frame.h;
  const outer = `M${vbX - 10} ${vbY - 10}h${vbW + 20}v${vbH + 20}h${-vbW - 20}Z`;
  const inner = `M${-fw / 2} ${-fh / 2}v${fh}h${fw}v${-fh}Z`;
  const showOverlay = !playing;
  const gizmo = (() => {
    if (!showOverlay || projectMode || selected.length === 0) return null;
    return selected.map((node) => {
      const m = nodeMatrix(node, resolved.camera);
      const b = nodeLocalBounds(node, project);
      const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => m.transformPoint(new DOMPoint(x, y)));
      const d = corners.map((c, i) => `${i ? 'L' : 'M'}${n(c.x)} ${n(c.y)}`).join('') + 'Z';
      const topMid = { x: (corners[0]!.x + corners[1]!.x) / 2, y: (corners[0]!.y + corners[1]!.y) / 2 };
      const cx = (corners[0]!.x + corners[2]!.x) / 2;
      const cy = (corners[0]!.y + corners[2]!.y) / 2;
      const dl = Math.max(1, Math.hypot(topMid.x - cx, topMid.y - cy));
      const rotH = { x: topMid.x + ((topMid.x - cx) / dl) * 30 * px, y: topMid.y + ((topMid.y - cy) / dl) * 30 * px };
      const size = 10 * px;
      const canEdit = selected.length === 1 && !node.locked;
      return (
        <g key={node.id} data-testid="selection-box" data-node={node.id}>
          <path d={d} fill="none" stroke="#7fc8ff" strokeWidth={1.6 * px} strokeDasharray={`${6 * px} ${4 * px}`} />
          {node.locked && <text x={corners[0]!.x + 4 * px} y={corners[0]!.y - 6 * px} fontSize={13 * px} fill="#ffd08a">Bloqueada</text>}
          {canEdit && corners.map((c, i) => (
            <rect key={i} data-handle="scale" x={c.x - size / 2} y={c.y - size / 2} width={size} height={size} rx={2 * px} fill="#fff" stroke="#1d7fd1" strokeWidth={1.5 * px} style={{ cursor: i % 2 ? 'nesw-resize' : 'nwse-resize', pointerEvents: 'all' }} />
          ))}
          {canEdit && (
            <>
              <line x1={topMid.x} y1={topMid.y} x2={rotH.x} y2={rotH.y} stroke="#7fc8ff" strokeWidth={1.4 * px} />
              <circle data-handle="rotate" cx={rotH.x} cy={rotH.y} r={7 * px} fill="#fff" stroke="#1d7fd1" strokeWidth={1.5 * px} style={{ cursor: 'grab', pointerEvents: 'all' }} />
            </>
          )}
        </g>
      );
    });
  })();

  const guides: React.ReactNode[] = [];
  if (ui.showGrid) {
    for (const k of [1, 2]) {
      guides.push(<line key={`gv${k}`} x1={-fw / 2 + (fw * k) / 3} x2={-fw / 2 + (fw * k) / 3} y1={-fh / 2} y2={fh / 2} stroke="#fff" strokeOpacity=".55" strokeWidth={px} />);
      guides.push(<line key={`gh${k}`} y1={-fh / 2 + (fh * k) / 3} y2={-fh / 2 + (fh * k) / 3} x1={-fw / 2} x2={fw / 2} stroke="#fff" strokeOpacity=".55" strokeWidth={px} />);
    }
    guides.push(<path key="center" d={`M-14 0H14M0 -14V14`} stroke="#ffd08a" strokeWidth={1.5 * px} />);
  }
  if (ui.showSafe) {
    guides.push(<rect key="s1" x={-fw * 0.45} y={-fh * 0.45} width={fw * 0.9} height={fh * 0.9} fill="none" stroke="#9be58a" strokeWidth={px} strokeDasharray={`${8 * px}`} />);
    guides.push(<rect key="s2" x={-fw * 0.4} y={-fh * 0.4} width={fw * 0.8} height={fh * 0.8} fill="none" stroke="#ffd08a" strokeWidth={px} strokeDasharray={`${4 * px}`} />);
  }
  const rulers: React.ReactNode[] = [];
  if (ui.showRulers) {
    const step = scale > 0.8 ? 100 : scale > 0.35 ? 200 : 500;
    rulers.push(<rect key="rt" x={vbX} y={vbY} width={vbW} height={18 * px} fill="#10121a" fillOpacity=".85" />);
    rulers.push(<rect key="rl" x={vbX} y={vbY} width={30 * px} height={vbH} fill="#10121a" fillOpacity=".85" />);
    for (let x = Math.ceil(vbX / step) * step; x < vbX + vbW; x += step) rulers.push(<text key={`tx${x}`} x={x + 2 * px} y={vbY + 13 * px} fontSize={10 * px} fill="#c8ccd8">{x}</text>);
    for (let y = Math.ceil(vbY / step) * step; y < vbY + vbH; y += step) rulers.push(<text key={`ty${y}`} x={vbX + 2 * px} y={y} fontSize={10 * px} fill="#c8ccd8">{y}</text>);
  }

  const gazeArrows = ui.gazeArrows ? Object.entries(resolved.characters).map(([id, c]) => {
    const dir = c.gaze.headView.includes('right') ? 1 : c.gaze.headView.includes('left') ? -1 : 0;
    const x2 = c.headX + (dir || c.gaze.gazeX) * 170;
    return <line key={id} data-testid={`gaze-arrow-${id}`} x1={c.headX} y1={c.headY} x2={x2} y2={c.headY} stroke="#ff5a6a" strokeWidth={4 * px} markerEnd="url(#rs-arrow)" />;
  }) : null;

  const pct = Math.round(scale * 100);

  return (
    <div className="stage-wrap">
      <div className={`stage${ui.checker ? ' is-checker' : ''}`} ref={containerRef} data-testid="stage" data-playing={playing}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onWheel={onWheel} onContextMenu={onContextMenu}>
        <svg ref={svgRef} className="stage-svg" data-testid="stage-svg" viewBox={viewBox} width={size.w} height={size.h} preserveAspectRatio="none" />
        <svg ref={overlayRef} className="stage-overlay" data-testid="stage-overlay" viewBox={viewBox} width={size.w} height={size.h} preserveAspectRatio="none">
          <defs><marker id="rs-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6Z" fill="#ff5a6a" /></marker></defs>
          <path d={`${outer}${inner}`} fillRule="evenodd" fill="#07080c" fillOpacity={ui.frameOnly ? 1 : 0.62} data-testid="frame-mask" />
          <rect x={-fw / 2} y={-fh / 2} width={fw} height={fh} fill="none" stroke="#fff" strokeOpacity=".75" strokeWidth={1.4 * px} data-testid="frame-border" />
          {!ui.frameOnly && <text x={-fw / 2} y={-fh / 2 - 8 * px} fontSize={12 * px} fill="#c8ccd8">QUADRO EXPORTÁVEL · {project.settings.aspectRatio}</text>}
          {!ui.frameOnly && vbX < -fw / 2 - 90 * px && <text x={-fw / 2 - 8 * px} y={0} textAnchor="end" fontSize={12 * px} fill="#878da0">FORA DO QUADRO</text>}
          {guides}
          {snapLines.x !== undefined && <line x1={snapLines.x} x2={snapLines.x} y1={vbY} y2={vbY + vbH} stroke="#ff5ab8" strokeWidth={1.2 * px} />}
          {gazeArrows}
          {gizmo}
          {rulers}
        </svg>
        <div className={`stage-mode${playing ? ' is-playing' : ''}`} data-testid="stage-mode">{playing ? <><Pause size={12} /> Reproduzindo</> : 'Edição'}</div>
      </div>
      <div className="stage-tools" role="toolbar" aria-label="Ferramentas do palco">
        <IconButton label="Diminuir zoom do editor" onClick={() => useUI.setState({ stageZoom: Math.max(0.1, scale / 1.25) })}><ZoomOut size={16} /></IconButton>
        <select className="input input-sm" aria-label="Zoom do editor" data-testid="stage-zoom" value={ui.stageZoom === 'fit' ? 'fit' : ZOOMS.includes(ui.stageZoom) ? String(ui.stageZoom) : 'custom'} onChange={(e) => useUI.setState({ stageZoom: e.target.value === 'fit' ? 'fit' : Number(e.target.value), stagePanX: 0, stagePanY: 0 })}>
          <option value="fit">Ajustar</option>
          {ui.stageZoom !== 'fit' && !ZOOMS.includes(ui.stageZoom) && <option value="custom">{pct}%</option>}
          {ZOOMS.map((z) => <option key={z} value={z}>{z * 100}%</option>)}
        </select>
        <IconButton label="Aumentar zoom do editor" onClick={() => useUI.setState({ stageZoom: Math.min(6, scale * 1.25) })}><ZoomIn size={16} /></IconButton>
        <IconButton label="Editar câmera da cena" active={ui.camera} testId="select-camera" onClick={selectCamera}><Camera size={16} /></IconButton>
        <IconButton label="Centralizar palco (F)" testId="stage-center" onClick={() => useUI.setState({ stageZoom: 'fit', stagePanX: 0, stagePanY: 0 })}><Maximize size={16} /></IconButton>
        <span className="tools-sep" />
        <IconButton label="Grade de terços (G)" active={ui.showGrid} testId="toggle-grid" onClick={() => useUI.setState({ showGrid: !ui.showGrid })}><Grid3x3 size={16} /></IconButton>
        <IconButton label="Áreas seguras" active={ui.showSafe} onClick={() => useUI.setState({ showSafe: !ui.showSafe })}><Shield size={16} /></IconButton>
        <IconButton label="Réguas" active={ui.showRulers} onClick={() => useUI.setState({ showRulers: !ui.showRulers })}><Ruler size={16} /></IconButton>
        <IconButton label="Ver somente o quadro exportável" active={ui.frameOnly} testId="toggle-frame-only" onClick={() => useUI.setState({ frameOnly: !ui.frameOnly })}><Scan size={16} /></IconButton>
        <IconButton label="Encaixe ao arrastar" active={ui.snapStage} onClick={() => useUI.setState({ snapStage: !ui.snapStage })}><Focus size={16} /></IconButton>
        <label className="tools-check"><input type="checkbox" checked={ui.gazeArrows} data-testid="toggle-gaze" onChange={(e) => useUI.setState({ gazeArrows: e.target.checked })} /> Olhares</label>
        <label className="tools-check"><input type="checkbox" checked={ui.checker} onChange={(e) => useUI.setState({ checker: e.target.checked })} /> Xadrez</label>
      </div>
    </div>
  );
}

export { getPath };
