/**
 * Estúdio de peças 2D, compartilhado pelo Criador de Objetos e pelo Criador de Cenários.
 * Prévia em cima (ou no centro), camadas e propriedades com campos numéricos precisos.
 * Arrastar no palco também move as peças. Tudo passa por commit(): Ctrl+Z funciona.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { FONT_OPTIONS } from '@/engine/render/fonts';
import {
  ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Copy, Eye, EyeOff, FlipHorizontal2, FlipVertical2, Group, ImagePlus, Pencil, Trash2, Ungroup,
  Type,
} from 'lucide-react';
import type { Piece, PieceKind, Project } from '@/engine/model/schema';
import { uid, deepClone } from '@/engine/model/ids';
import { createPiece, freezeCharacter, pieceCorners, pieceHit, PIECE_LABELS, renderPieces, selectionBox, transformPieces } from '@/engine/world/pieces';
import { PROPS, getProp } from '@/engine/world/props';
import { objectContains } from '@/features/library/bundles';
import { EXPRESSIONS } from '@/engine/character/expressions';
import { POSES, getPose, poseRig } from '@/engine/character/presets';
import { VIEW_LABELS, VIEW_ORDER } from '@/engine/character/views';
import { IMAGE_ACCEPT, importImageFile, previewAssetUrl, registerAssetBlob } from '@/features/library/assets';
import { doRedo, doUndo } from '@/state/actions';
import { promptDialog, toast } from '@/state/uiStore';
import { repo } from '@/storage/db';
import { ColorField, IconButton, SelectField, TextField, ToggleField } from '../controls/fields';
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
  /** Área exportada: com "Prévia final" ligada, a prévia mostra exatamente este retângulo. */
  finalBox?: { x: number; y: number; w: number; h: number };
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
  const groupBox = selectionBox(selected, p.project);
  const one = selected.length === 1 ? selected[0]! : null;

  /** Selecionar uma peça agrupada seleciona o grupo inteiro. */
  const select = (id: string | null, add = false) => {
    if (!id) return setSel([]);
    const piece = p.pieces.find((x) => x.id === id);
    const ids = piece?.group ? p.pieces.filter((x) => x.group === piece.group).map((x) => x.id) : [id];
    // Shift/Ctrl: alterna (tira do grupo de seleção se já estava nela).
    if (add && ids.every((x) => sel.includes(x))) setSel(sel.filter((x) => !ids.includes(x)));
    else setSel(add ? [...new Set([...sel, ...ids])] : ids);
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
      if (pc.visible && pieceHit(pc, p.project, x, y)) return pc.id;
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

  // Um objeto não pode conter a si mesmo, direta ou indiretamente (A → B → A).
  const allowedObjects = Object.values(p.project.customObjects).filter((o) => !p.excludeObjectId || !objectContains(p.project, o.id, p.excludeObjectId));
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
      <h4>Texto</h4>
      <button type="button" className="btn btn-sm" data-testid="add-text-piece" onClick={() => add(createPiece('text', { name: 'Texto', text: 'Texto', fontSize: 72, fill: '#23202b', stroke: '#ffffff', strokeWidth: 0, x: center.x, y: center.y }))}><Type size={14} /> Adicionar texto</button>
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
      {allowedObjects.length > 0 && (
        <SelectField label="Meus objetos" value="" testId="add-object" options={[{ id: '', label: 'Escolha…' }, ...allowedObjects.map((o) => ({ id: o.id, label: o.name }))]} onChange={(id) => {
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
      {one.kind === 'prop' || one.kind === 'object' || one.kind === 'character' || one.kind === 'text'
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
      {one.kind === 'text' && (
        <div className="studio-text" data-testid="piece-text-controls">
          <TextField label="Texto" multiline value={one.text} testId="piece-text" onChange={(v) => editSel('Texto', (pc) => { pc.text = v.slice(0, 500); }, `pc-${one.id}-txt`)} />
          <SelectField label="Fonte" value={one.fontFamily} testId="piece-font" options={FONT_OPTIONS} onChange={(v) => editSel('Fonte', (pc) => { pc.fontFamily = v as typeof pc.fontFamily; })} />
          <SliderNumberField label="Tamanho" unit="px" min={4} max={600} sliderMin={8} sliderMax={240} decimals={0} value={one.fontSize} testId="piece-font-size" onChange={(v) => editSel('Tamanho do texto', (pc) => { pc.fontSize = Math.max(4, Math.min(600, v)); }, `pc-${one.id}-fs`)} />
          <SelectField label="Peso" value={one.fontWeight} testId="piece-font-weight" options={[{ id: '400', label: 'Normal' }, { id: '700', label: 'Negrito' }, { id: '900', label: 'Extra negrito' }]} onChange={(v) => editSel('Peso do texto', (pc) => { pc.fontWeight = v as typeof pc.fontWeight; })} />
          <SelectField label="Alinhamento" value={one.align} testId="piece-align" options={[{ id: 'start', label: 'À esquerda' }, { id: 'middle', label: 'Centro' }, { id: 'end', label: 'À direita' }]} onChange={(v) => editSel('Alinhamento', (pc) => { pc.align = v as typeof pc.align; })} />
          <ToggleField label="Itálico" checked={one.italic} testId="piece-italic" onChange={(v) => editSel('Itálico', (pc) => { pc.italic = v; })} />
          <SliderNumberField label="Espaçamento" unit="px" min={-20} max={80} sliderMin={-10} sliderMax={40} value={one.letterSpacing} testId="piece-letter-spacing" onChange={(v) => editSel('Espaçamento', (pc) => { pc.letterSpacing = v; }, `pc-${one.id}-ls`)} />
          <ColorField label="Cor do texto" value={one.fill} testId="piece-text-color" onChange={(v) => editSel('Cor do texto', (pc) => { pc.fill = v; }, `pc-${one.id}-tf`)} />
          <ColorField label="Contorno" value={one.stroke} testId="piece-text-stroke" onChange={(v) => editSel('Contorno do texto', (pc) => { pc.stroke = v; }, `pc-${one.id}-ts`)} />
          <SliderNumberField label="Espessura do contorno" unit="px" min={0} max={40} sliderMin={0} sliderMax={20} value={one.strokeWidth} testId="piece-text-stroke-width" onChange={(v) => editSel('Contorno do texto', (pc) => { pc.strokeWidth = Math.max(0, v); }, `pc-${one.id}-tw`)} />
          <p className="hint">O texto continua editável depois de salvo (na biblioteca, em pacotes e no .jrec). Usa fontes do sistema, sem baixar nada.</p>
        </div>
      )}
      {one.kind === 'prop' && (
        <>
          <ColorField label="Cor principal" testId="piece-color-a" value={one.colorA || getProp(one.refId ?? '')?.a || '#888888'} onChange={(v) => editSel('Cor', (pc) => { pc.colorA = v; }, `pc-${one.id}-a`)} />
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
      {selected.length > 1 ? <GroupControls count={selected.length} hasGroup={selected.some((x) => x.group)} apply={(op) => p.edit('Transformar seleção', (list, proj) => transformPieces(list.filter((x) => sel.includes(x.id)), proj, op))} /> : <p className="empty">Toque numa peça na prévia ou em Camadas para editar posição, tamanho, rotação, cores e mais.</p>}
      {selected.length > 1 && <SliderNumberField label="Opacidade (todas)" unit="%" display={100} min={0} max={1} sliderMin={0} sliderMax={100} value={selected[0]!.opacity} onChange={(v) => editSel('Opacidade', (pc) => { pc.opacity = v; }, 'pc-multi-o')} />}
    </div>
  );

  const onKey = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (ctrl && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(p.pieces.filter((x) => x.visible).map((x) => x.id)); return; }
    if (!sel.length) return;
    if (ctrl && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); return; }
    const step = e.shiftKey ? 10 : 1;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const v = d[e.key];
    if (v) { e.preventDefault(); p.edit('Mover peças', (list, proj) => transformPieces(list.filter((x) => sel.includes(x.id)), proj, { dx: v[0], dy: v[1] }), `nudge-${sel.join(',')}`); }
  };
  const vb = finalView && p.finalBox ? p.finalBox : p.viewBox;
  const handle = Math.max(vb.w, vb.h) / 160;
  return (
    <div className="studio" data-testid={p.testId} onKeyDown={onKey}>
      <div className="studio-stage">
        <div className="studio-stage-bar">
          <ToggleField label="Prévia final" hint="" testId={`${p.testId}-final`} checked={finalView} onChange={setFinalView} />
          <small>{p.pieces.length} peça(s){sel.length ? ` · ${sel.length} selecionada(s)` : ''}</small>
        </div>
        <svg
          ref={svgRef}
          tabIndex={0}
          className="studio-svg"
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          role="img"
          aria-label="Prévia da composição"
          data-testid={`${p.testId}-canvas`}
          onPointerDown={(e) => {
            svgRef.current?.focus({ preventScroll: true });
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
          {finalView && p.finalBox && <clipPath id={`${p.testId}-final-clip`}><rect x={p.finalBox.x} y={p.finalBox.y} width={p.finalBox.w} height={p.finalBox.h} /></clipPath>}
          <g clipPath={finalView && p.finalBox ? `url(#${p.testId}-final-clip)` : undefined}>
            <g dangerouslySetInnerHTML={{ __html: p.underlay ?? '' }} />
            <g dangerouslySetInnerHTML={{ __html: body }} />
          </g>
          {!(finalView && p.finalBox) && <g dangerouslySetInnerHTML={{ __html: p.overlay ?? '' }} />}
          {!finalView && selected.map((pc) => (
            <polygon key={pc.id} data-testid="piece-outline" points={pieceCorners(pc, p.project).map((q) => `${q[0]},${q[1]}`).join(' ')} fill="none" stroke="#7fc8ff" strokeWidth={handle * 0.6} strokeDasharray={`${handle * 2} ${handle}`} pointerEvents="none" />
          ))}
          {!finalView && selected.length > 1 && groupBox && <rect data-testid="group-box" x={groupBox.x} y={groupBox.y} width={groupBox.w} height={groupBox.h} fill="none" stroke="#f2a65a" strokeWidth={handle * 0.7} strokeDasharray={`${handle * 4} ${handle * 1.5}`} pointerEvents="none" />}
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


/** Controles do bloco: mover, girar e escalar tudo junto, em torno do centro da caixa do grupo. */
function GroupControls({ count, hasGroup, apply }: { count: number; hasGroup: boolean; apply: (op: { rotate?: number; scale?: number; dx?: number; dy?: number }) => void }) {
  const [step, setStep] = useState('10');
  const [deg, setDeg] = useState('15');
  const [pct, setPct] = useState('10');
  const num = (v: string, fb: number) => { const n = Number(v.replace(',', '.')); return Number.isFinite(n) && n !== 0 ? n : fb; };
  const st = num(step, 10);
  const dg = num(deg, 15);
  const pc = Math.min(90, Math.abs(num(pct, 10)));
  return (
    <div className="group-controls" data-testid="group-controls">
      <p className="hint">{count} peças selecionadas{hasGroup ? ' (grupo)' : ''}. Mover, girar e escalar valem para o bloco todo, em torno do centro dele.</p>
      <div className="gc-row"><label>Passo <input className="input input-sm" inputMode="decimal" aria-label="Passo em pixels" value={step} onChange={(e) => setStep(e.target.value)} onKeyDown={(e) => e.stopPropagation()} /> px</label></div>
      <div className="gc-pad" role="group" aria-label="Mover o bloco">
        <button type="button" className="btn btn-sm" aria-label="Mover para cima" data-testid="group-up" onClick={() => apply({ dy: -st })}>↑</button>
        <button type="button" className="btn btn-sm" aria-label="Mover para a esquerda" data-testid="group-left" onClick={() => apply({ dx: -st })}>←</button>
        <button type="button" className="btn btn-sm" aria-label="Mover para a direita" data-testid="group-right" onClick={() => apply({ dx: st })}>→</button>
        <button type="button" className="btn btn-sm" aria-label="Mover para baixo" data-testid="group-down" onClick={() => apply({ dy: st })}>↓</button>
      </div>
      <div className="gc-row"><label>Girar <input className="input input-sm" inputMode="decimal" aria-label="Graus" value={deg} onChange={(e) => setDeg(e.target.value)} onKeyDown={(e) => e.stopPropagation()} /> °</label>
        <button type="button" className="btn btn-sm" data-testid="group-rot-left" onClick={() => apply({ rotate: -dg })}>⟲</button>
        <button type="button" className="btn btn-sm" data-testid="group-rot-right" onClick={() => apply({ rotate: dg })}>⟳</button></div>
      <div className="gc-row"><label>Escalar <input className="input input-sm" inputMode="decimal" aria-label="Porcentagem" value={pct} onChange={(e) => setPct(e.target.value)} onKeyDown={(e) => e.stopPropagation()} /> %</label>
        <button type="button" className="btn btn-sm" data-testid="group-shrink" onClick={() => apply({ scale: 1 - pc / 100 })}>−</button>
        <button type="button" className="btn btn-sm" data-testid="group-grow" onClick={() => apply({ scale: 1 + pc / 100 })}>+</button></div>
      <p className="hint">Teclado: setas movem (Shift: 10 px), Ctrl+A seleciona tudo, Ctrl+D duplica, Delete exclui.</p>
    </div>
  );
}
