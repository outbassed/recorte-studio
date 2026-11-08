/**
 * Estúdio de peças 2D, compartilhado pelo Criador de Objetos e pelo Criador de Cenários.
 * Prévia em cima (ou no centro), camadas e propriedades com campos numéricos precisos.
 * Arrastar no palco também move as peças. Tudo passa por commit(): Ctrl+Z funciona.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Copy, Eye, EyeOff, FlipHorizontal2, FlipVertical2, Group, ImagePlus, Pencil, Trash2, Ungroup,
} from 'lucide-react';
import type { Piece, PieceKind, Project } from '@/engine/model/schema';
import { uid, deepClone } from '@/engine/model/ids';
import { createPiece, freezeCharacter, pieceBox, PIECE_LABELS, renderPieces } from '@/engine/world/pieces';
import { PROPS, getProp } from '@/engine/world/props';
import { EXPRESSIONS } from '@/engine/character/expressions';
import { POSES, getPose, poseRig } from '@/engine/character/presets';
import { VIEW_LABELS, VIEW_ORDER } from '@/engine/character/views';
import { IMAGE_ACCEPT, importImageFile, previewAssetUrl, registerAssetBlob } from '@/features/library/assets';
import { doRedo, doUndo } from '@/state/actions';
import { promptDialog, toast } from '@/state/uiStore';
import { repo } from '@/storage/db';
import { ColorField, IconButton, SelectField, ToggleField } from '../controls/fields';
import { SliderNumberField } from '../controls/SliderNumberField';

export interface StudioProps {
  project: Project;
  pieces: Piece[];
  /** Aplica uma mudança na lista de peças dentro de um commit (com Undo). */
  edit: (label: string, fn: (pieces: Piece[], project: Project) => void, coalesce?: string) => void;
  viewBox: { x: number; y: number; w: number; h: number };
  /** Desenho de fundo da área (céu, caixa do objeto, guias). */
  underlay?: string;
  overlay?: string;
  allowCharacters?: boolean;
  /** Peças extras no menu "Adicionar" (paredes, piso…). */
  presets?: Array<{ label: string; make: () => Piece }>;
  excludeObjectId?: string;
  testId: string;
}

type Tab = 'add' | 'layers' | 'props';

export function PieceStudio(p: StudioProps) {
  const [sel, setSel] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>('add');
  const [finalView, setFinalView] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; id: string; moved: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const url = (id: string) => previewAssetUrl(id);
  const body = useMemo(() => renderPieces(p.pieces, { project: p.project, url, idPrefix: p.testId }), [p.pieces, p.project]); // eslint-disable-line react-hooks/exhaustive-deps
  const selected = p.pieces.filter((x) => sel.includes(x.id));
  const one = selected.length === 1 ? selected[0]! : null;

  /** Selecionar uma peça agrupada seleciona o grupo inteiro. */
  const select = (id: string | null, add = false) => {
    if (!id) return setSel([]);
    const piece = p.pieces.find((x) => x.id === id);
    const ids = piece?.group ? p.pieces.filter((x) => x.group === piece.group).map((x) => x.id) : [id];
    setSel(add ? [...new Set([...sel, ...ids])] : ids);
  };
  const editSel = (label: string, fn: (pc: Piece) => void, coalesce?: string) =>
    p.edit(label, (list) => { for (const pc of list) if (sel.includes(pc.id)) fn(pc); }, coalesce);
  const add = (piece: Piece) => {
    p.edit(`Adicionar ${piece.name}`, (list) => { list.push(piece); });
    setSel([piece.id]);
    setTab('props');
  };
  const center = { x: p.viewBox.x + p.viewBox.w / 2, y: p.viewBox.y + p.viewBox.h / 2 };

  const toWorld = (e: React.PointerEvent) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };
  const hit = (x: number, y: number) => {
    for (let i = p.pieces.length - 1; i >= 0; i--) {
      const pc = p.pieces[i]!;
      if (!pc.visible) continue;
      const b = pieceBox(pc, p.project);
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return pc.id;
    }
    return null;
  };

  const move = (how: 'up' | 'down' | 'top' | 'bottom') => p.edit('Ordem das camadas', (list) => {
    const picked = list.filter((x) => sel.includes(x.id));
    const rest = list.filter((x) => !sel.includes(x.id));
    if (how === 'top') return void list.splice(0, list.length, ...rest, ...picked);
    if (how === 'bottom') return void list.splice(0, list.length, ...picked, ...rest);
    const idx = list.findIndex((x) => sel.includes(x.id));
    const last = list.length - 1 - [...list].reverse().findIndex((x) => sel.includes(x.id));
    if (how === 'up' && last < list.length - 1) {
      const next = list[last + 1]!;
      list.splice(list.indexOf(next), 1);
      list.splice(idx, 0, next);
    }
    if (how === 'down' && idx > 0) {
      const prev = list[idx - 1]!;
      list.splice(idx - 1, 1);
      list.splice(last, 0, prev);
    }
  });
  const duplicate = () => {
    const groups = new Map<string, string>();
    const copies = selected.map((pc) => ({ ...deepClone(pc), id: uid('pc'), name: `${pc.name} (cópia)`, x: pc.x + 30, y: pc.y + 30, group: pc.group ? groups.get(pc.group) ?? (groups.set(pc.group, uid('grp')), groups.get(pc.group)) : undefined }));
    p.edit('Duplicar peças', (list) => { list.push(...copies); });
    setSel(copies.map((c) => c.id));
  };
  const remove = () => {
    p.edit('Excluir peças', (list) => { list.splice(0, list.length, ...list.filter((x) => !sel.includes(x.id))); });
    setSel([]);
  };

  const onImage = async (f: File) => {
    try {
      const { asset } = await importImageFile(f);
      const blob = await repo.getBlob(asset.id);
      if (blob) registerAssetBlob(asset.id, blob);
      const k = Math.min(1, (p.viewBox.w * 0.6) / (asset.width ?? 400), (p.viewBox.h * 0.6) / (asset.height ?? 400));
      const piece = createPiece('image', { name: asset.name, assetId: asset.id, w: Math.round((asset.width ?? 400) * k), h: Math.round((asset.height ?? 400) * k), x: center.x, y: center.y });
      p.edit('Adicionar imagem', (list, proj) => { proj.assets[asset.id] = asset; list.push(piece); });
      setSel([piece.id]);
      setTab('props');
    } catch (e) {
      toast(`Não foi possível usar a imagem: ${e instanceof Error ? e.message : 'erro'}`, 'error');
    }
  };

  const shapes: Array<[PieceKind, Partial<Piece>]> = [
    ['rect', { w: 240, h: 160 }], ['ellipse', { w: 200, h: 200, fill: '#7fc8ff' }], ['triangle', { w: 220, h: 190, fill: '#6fce8e' }],
    ['polygon', { w: 200, h: 200, sides: 6, fill: '#c9a0e8' }], ['star', { w: 200, h: 200, sides: 5, fill: '#f2c95c' }], ['line', { w: 300, h: 10, strokeWidth: 10 }],
  ];

  const addPanel = (
    <div className="studio-add" data-testid={`${p.testId}-add`}>
      <h4>Formas</h4>
      <div className="studio-chips">
        {shapes.map(([k, o]) => <button key={k} type="button" className="chip" data-testid={`add-${k}`} onClick={() => add(createPiece(k, { ...o, x: center.x, y: center.y }))}>{PIECE_LABELS[k]}</button>)}
      </div>
      {p.presets && p.presets.length > 0 && (
        <>
          <h4>Estrutura</h4>
          <div className="studio-chips">{p.presets.map((x) => <button key={x.label} type="button" className="chip" data-testid={`add-preset-${x.label}`} onClick={() => add(x.make())}>{x.label}</button>)}</div>
        </>
      )}
      <h4>Imagem (SVG, PNG, JPEG, WebP)</h4>
      <button type="button" className="btn btn-sm" data-testid="add-image" onClick={() => fileRef.current?.click()}><ImagePlus size={14} /> Importar imagem</button>
      <input ref={fileRef} hidden type="file" accept={IMAGE_ACCEPT} data-testid={`${p.testId}-image-input`} onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) void onImage(f);
      }} />
      <h4>Objetos prontos</h4>
      <SelectField label="Objeto" value="" testId="add-prop" options={[{ id: '', label: 'Escolha…' }, ...PROPS.map((x) => ({ id: x.id, label: x.label }))]} onChange={(id) => {
        if (!id) return;
        const d = getProp(id);
        add(createPiece('prop', { name: d?.label ?? id, refId: id, x: center.x, y: center.y + (d?.h ?? 100) / 2, state: d?.defaultState ?? '' }));
      }} />
      {Object.values(p.project.customObjects).filter((o) => o.id !== p.excludeObjectId).length > 0 && (
        <SelectField label="Meus objetos" value="" testId="add-object" options={[{ id: '', label: 'Escolha…' }, ...Object.values(p.project.customObjects).filter((o) => o.id !== p.excludeObjectId).map((o) => ({ id: o.id, label: o.name }))]} onChange={(id) => {
          const o = p.project.customObjects[id];
          if (o) add(createPiece('object', { name: o.name, refId: o.id, x: center.x, y: center.y + o.height / 2 }));
        }} />
      )}
      {p.allowCharacters && (
        <>
          <h4>Personagens estáticos</h4>
          <p className="hint">Fazem parte do cenário: não recebem falas nem ações na timeline. A aparência fica congelada aqui.</p>
          <SelectField label="Personagem" value="" testId="add-character" options={[{ id: '', label: 'Escolha…' }, ...Object.values(p.project.characters).map((c) => ({ id: c.id, label: c.name }))]} onChange={(id) => {
            const def = p.project.characters[id];
            if (def) add(createPiece('character', { name: def.name, character: freezeCharacter(def), x: center.x, y: center.y + 260, scale: 0.8 }));
          }} />
        </>
      )}
    </div>
  );

  const layersPanel = (
    <div className="studio-layers" data-testid={`${p.testId}-layers`}>
      {p.pieces.length === 0 && <p className="empty">Nenhuma peça ainda. Use Adicionar.</p>}
      <ol>
        {[...p.pieces].reverse().map((pc) => (
          <li key={pc.id} className={sel.includes(pc.id) ? 'is-active' : ''} data-testid="studio-layer" data-name={pc.name}>
            <button type="button" className="studio-layer-name" onClick={(e) => select(pc.id, e.shiftKey || e.ctrlKey)}>
              {pc.group && <span className="badge-dot" title="Agrupada" aria-label="Agrupada" />}
              <span>{pc.name}</span><small>{PIECE_LABELS[pc.kind]}</small>
            </button>
            <IconButton label={pc.visible ? `Ocultar ${pc.name}` : `Mostrar ${pc.name}`} onClick={() => p.edit('Visibilidade', (list) => { const x = list.find((y) => y.id === pc.id); if (x) x.visible = !x.visible; })}>{pc.visible ? <Eye size={14} /> : <EyeOff size={14} />}</IconButton>
          </li>
        ))}
      </ol>
      <div className="btn-row">
        <IconButton label="Subir camada" disabled={!sel.length} onClick={() => move('up')}><ArrowUp size={15} /></IconButton>
        <IconButton label="Descer camada" disabled={!sel.length} onClick={() => move('down')}><ArrowDown size={15} /></IconButton>
        <IconButton label="Trazer para o topo" disabled={!sel.length} onClick={() => move('top')}><ChevronsUp size={15} /></IconButton>
        <IconButton label="Enviar para o fundo" disabled={!sel.length} onClick={() => move('bottom')}><ChevronsDown size={15} /></IconButton>
        <IconButton label="Agrupar" testId="studio-group" disabled={sel.length < 2} onClick={() => { const g = uid('grp'); editSel('Agrupar', (pc) => { pc.group = g; }); }}><Group size={15} /></IconButton>
        <IconButton label="Desagrupar" testId="studio-ungroup" disabled={!selected.some((x) => x.group)} onClick={() => editSel('Desagrupar', (pc) => { pc.group = undefined; })}><Ungroup size={15} /></IconButton>
        <IconButton label="Duplicar" testId="studio-duplicate" disabled={!sel.length} onClick={duplicate}><Copy size={15} /></IconButton>
        <IconButton label="Excluir" danger testId="studio-delete" disabled={!sel.length} onClick={remove}><Trash2 size={15} /></IconButton>
      </div>
    </div>
  );

  const num = (label: string, key: 'x' | 'y' | 'w' | 'h' | 'rotation', min?: number, max?: number) => (
    <SliderNumberField label={label} unit={key === 'rotation' ? '°' : 'px'} min={min} max={max} sliderMin={key === 'rotation' ? -180 : key === 'x' ? p.viewBox.x : key === 'y' ? p.viewBox.y : 1} sliderMax={key === 'rotation' ? 180 : key === 'x' ? p.viewBox.x + p.viewBox.w : key === 'y' ? p.viewBox.y + p.viewBox.h : Math.max(p.viewBox.w, p.viewBox.h)} decimals={0}
      testId={`piece-${key}`} value={one![key]} onChange={(v) => editSel(label, (pc) => { pc[key] = v; }, `pc-${one!.id}-${key}`)} />
  );
  const propsPanel = one ? (
    <div className="studio-props" data-testid={`${p.testId}-props`}>
      <div className="studio-props-head">
        <strong>{one.name}</strong>
        <IconButton label="Renomear peça" testId="piece-rename" onClick={async () => { const v = await promptDialog('Renomear peça', 'Nome', one.name); if (v) editSel('Renomear', (pc) => { pc.name = v; }); }}><Pencil size={14} /></IconButton>
      </div>
      {num('X', 'x')}
      {num('Y', 'y')}
      {one.kind === 'prop' || one.kind === 'object' || one.kind === 'character'
        ? <SliderNumberField label="Escala" unit="%" display={100} min={0.05} max={10} sliderMin={10} sliderMax={300} value={one.scale} testId="piece-scale" onChange={(v) => editSel('Escala', (pc) => { pc.scale = v; }, `pc-${one.id}-s`)} />
        : <>{num('Largura', 'w', 1)}{num('Altura', 'h', 1)}</>}
      {num('Rotação', 'rotation')}
      <SliderNumberField label="Opacidade" unit="%" display={100} min={0} max={1} sliderMin={0} sliderMax={100} value={one.opacity} testId="piece-opacity" onChange={(v) => editSel('Opacidade', (pc) => { pc.opacity = v; }, `pc-${one.id}-o`)} />
      <div className="btn-row">
        <button type="button" className="btn btn-sm" data-testid="piece-flipx" aria-pressed={one.flipX} onClick={() => editSel('Espelhar', (pc) => { pc.flipX = !pc.flipX; })}><FlipHorizontal2 size={14} /> Espelhar</button>
        <button type="button" className="btn btn-sm" aria-pressed={one.flipY} onClick={() => editSel('Virar', (pc) => { pc.flipY = !pc.flipY; })}><FlipVertical2 size={14} /> Virar</button>
      </div>
      {['rect', 'ellipse', 'triangle', 'polygon', 'star', 'line'].includes(one.kind) && (
        <>
          {one.kind !== 'line' && <ColorField label="Preenchimento" value={one.fill} testId="piece-fill" onChange={(v) => editSel('Cor', (pc) => { pc.fill = v; }, `pc-${one.id}-f`)} />}
          <ColorField label="Contorno" value={one.stroke} onChange={(v) => editSel('Contorno', (pc) => { pc.stroke = v; }, `pc-${one.id}-st`)} />
          <SliderNumberField label="Espessura do contorno" unit="px" min={0} max={80} sliderMin={0} sliderMax={30} value={one.strokeWidth} onChange={(v) => editSel('Contorno', (pc) => { pc.strokeWidth = v; }, `pc-${one.id}-sw`)} />
          {one.kind === 'rect' && <SliderNumberField label="Cantos" unit="px" min={0} sliderMin={0} sliderMax={120} value={one.radius} onChange={(v) => editSel('Cantos', (pc) => { pc.radius = v; }, `pc-${one.id}-r`)} />}
          {(one.kind === 'polygon' || one.kind === 'star') && <SliderNumberField label={one.kind === 'star' ? 'Pontas' : 'Lados'} min={3} max={12} sliderMin={3} sliderMax={12} decimals={0} value={one.sides} onChange={(v) => editSel('Lados', (pc) => { pc.sides = Math.round(Math.min(12, Math.max(3, v))); }, `pc-${one.id}-n`)} />}
        </>
      )}
      {one.kind === 'prop' && (
        <>
          <ColorField label="Cor principal" value={one.colorA || getProp(one.refId ?? '')?.a || '#888888'} onChange={(v) => editSel('Cor', (pc) => { pc.colorA = v; }, `pc-${one.id}-a`)} />
          <ColorField label="Cor secundária" value={one.colorB || getProp(one.refId ?? '')?.b || '#888888'} onChange={(v) => editSel('Cor', (pc) => { pc.colorB = v; }, `pc-${one.id}-b`)} />
          {getProp(one.refId ?? '')?.states && <SelectField label="Estado" value={one.state} options={getProp(one.refId ?? '')!.states!} onChange={(v) => editSel('Estado', (pc) => { pc.state = v; })} />}
        </>
      )}
      {one.kind === 'character' && one.character && (
        <>
          <p className="hint">Cópia congelada de {one.character.def.name}: mudanças no elenco não alteram este cenário.</p>
          <SelectField label="Vista" value={one.character.view} testId="piece-char-view" options={VIEW_ORDER.map((v) => ({ id: v, label: VIEW_LABELS[v] }))} onChange={(v) => editSel('Vista', (pc) => { if (pc.character) pc.character.view = v as typeof pc.character.view; })} />
          <SelectField label="Expressão" value={one.character.expression} testId="piece-char-expression" options={EXPRESSIONS.map((e) => ({ id: e.id, label: e.label }))} onChange={(v) => editSel('Expressão', (pc) => { if (pc.character) pc.character.expression = v; })} />
          <SelectField label="Pose" value={one.character.poseId} testId="piece-char-pose" options={POSES.map((x) => ({ id: x.id, label: x.label }))} onChange={(v) => editSel('Pose', (pc) => {
            if (!pc.character) return;
            const pose = getPose(v);
            pc.character.poseId = v;
            pc.character.rig = poseRig(v);
            pc.character.handL = pose?.handL ?? 'open';
            pc.character.handR = pose?.handR ?? 'open';
            pc.character.limbDepth = { armL: 'auto', handL: 'auto', armR: 'auto', handR: 'auto', ...(pose?.limbDepth ?? {}) };
          })} />
          <button type="button" className="btn btn-sm" onClick={() => {
            const src = one.character?.sourceId ? p.project.characters[one.character.sourceId] : undefined;
            if (!src) return toast('O personagem original não está mais no elenco deste projeto.', 'error');
            editSel('Atualizar aparência', (pc) => { if (pc.character) pc.character.def = deepClone(src); });
            toast('Aparência atualizada a partir do elenco.', 'success');
          }}>Atualizar aparência pelo elenco</button>
        </>
      )}
      <ToggleField label="Visível" checked={one.visible} onChange={(v) => editSel('Visibilidade', (pc) => { pc.visible = v; })} />
    </div>
  ) : (
    <div className="studio-props">
      {selected.length > 1 ? <p className="hint">{selected.length} peças selecionadas. Use Camadas para agrupar, duplicar, ordenar ou excluir.</p> : <p className="empty">Toque numa peça na prévia ou em Camadas para editar posição, tamanho, rotação, cores e mais.</p>}
      {selected.length > 1 && <SliderNumberField label="Opacidade (todas)" unit="%" display={100} min={0} max={1} sliderMin={0} sliderMax={100} value={selected[0]!.opacity} onChange={(v) => editSel('Opacidade', (pc) => { pc.opacity = v; }, 'pc-multi-o')} />}
    </div>
  );

  const vb = p.viewBox;
  const handle = Math.max(vb.w, vb.h) / 160;
  return (
    <div className="studio" data-testid={p.testId}>
      <div className="studio-stage">
        <div className="studio-stage-bar">
          <ToggleField label="Prévia final" hint="" testId={`${p.testId}-final`} checked={finalView} onChange={setFinalView} />
          <small>{p.pieces.length} peça(s){sel.length ? ` · ${sel.length} selecionada(s)` : ''}</small>
        </div>
        <svg
          ref={svgRef}
          className="studio-svg"
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          role="img"
          aria-label="Prévia da composição"
          data-testid={`${p.testId}-canvas`}
          onPointerDown={(e) => {
            const w = toWorld(e);
            const id = hit(w.x, w.y);
            if (!id) return select(null);
            if (!sel.includes(id)) select(id, e.shiftKey);
            drag.current = { ...w, id, moved: false };
            (e.currentTarget as Element).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const w = toWorld(e);
            const dx = w.x - d.x;
            const dy = w.y - d.y;
            if (!d.moved && Math.hypot(dx, dy) < handle) return;
            d.moved = true;
            d.x = w.x;
            d.y = w.y;
            editSel('Mover peças', (pc) => { pc.x = Math.round(pc.x + dx); pc.y = Math.round(pc.y + dy); }, `drag-${d.id}`);
          }}
          onPointerUp={() => { drag.current = null; }}
        >
          <g dangerouslySetInnerHTML={{ __html: p.underlay ?? '' }} />
          <g dangerouslySetInnerHTML={{ __html: body }} />
          <g dangerouslySetInnerHTML={{ __html: p.overlay ?? '' }} />
          {!finalView && selected.map((pc) => {
            const b = pieceBox(pc, p.project);
            return <rect key={pc.id} x={b.x} y={b.y} width={b.w} height={b.h} fill="none" stroke="#7fc8ff" strokeWidth={handle * 0.6} strokeDasharray={`${handle * 2} ${handle}`} pointerEvents="none" />;
          })}
        </svg>
      </div>
      <div className="studio-tools">
        <div className="studio-tabs" role="tablist" aria-label="Ferramentas">
          {([['add', 'Adicionar'], ['layers', `Camadas (${p.pieces.length})`], ['props', 'Propriedades']] as Array<[Tab, string]>).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? 'is-active' : ''} data-testid={`${p.testId}-tab-${id}`} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
        <div className="studio-tool-body">
          {tab === 'add' && addPanel}
          {tab === 'layers' && layersPanel}
          {tab === 'props' && propsPanel}
        </div>
      </div>
    </div>
  );
}

export function StudioShell({ title, children, actions, onClose, testId }: { title: ReactNode; children: ReactNode; actions?: ReactNode; onClose: () => void; testId: string }) {
  return (
    <div className="creator-shell" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : 'Criador'} data-testid={testId} onKeyDown={(e) => {
      const t = e.target as HTMLElement;
      const typing = t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT';
      if (e.key === 'Escape') onClose();
      // Desfazer/refazer dentro do criador (o atalho global fica bloqueado aqui).
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) { e.preventDefault(); if (e.shiftKey) doRedo(); else doUndo(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y' && !typing) { e.preventDefault(); doRedo(); }
      e.stopPropagation();
    }}>
      <header className="creator-head">
        <div className="creator-title">{title}</div>
        <div className="creator-actions">{actions}<button type="button" className="btn btn-primary" data-testid={`${testId}-close`} onClick={onClose}>Concluir</button></div>
      </header>
      {children}
    </div>
  );
}

