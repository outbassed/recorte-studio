/**
 * Criador de Roupas e Cabelos (Fase 3b). A peça é editada camada por camada, no tamanho do corpo de
 * referência, com o contorno da parte do corpo por baixo; a prévia mostra o manequim (ou um personagem
 * do projeto) VESTINDO a peça, pelo mesmo renderizador do palco e da exportação, em qualquer vista e pose.
 * O manequim é só referência: nada aqui muda o corpo de ninguém.
 */
import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, BookmarkPlus, Copy, Shirt, Trash2, UserCheck } from 'lucide-react';
import { WEAR_ANCHORS, type CharacterDefinition, type Wearable, type WearAnchor, type WearLayer } from '@/engine/model/schema';
import { deepClone, uid } from '@/engine/model/ids';
import { ANCHOR_LABELS, anchorGuide, MANNEQUINS, WEAR_STARTERS, wearOn } from '@/engine/character/wear';
import { bodyMetrics, renderCharacter } from '@/engine/character/render';
import { POSES, poseRig } from '@/engine/character/presets';
import { VIEW_LABELS, VIEW_ORDER } from '@/engine/character/views';
import type { ViewId } from '@/engine/model/schema';
import { useProject, useCurrentScene } from '@/state/projectStore';
import { closeDialog, confirmDialog, useUI } from '@/state/uiStore';
import { applyWearable, editWearable, saveWearableToLibrary } from '@/state/wearActions';
import { IconButton, SelectField, TextField, ToggleField } from '../controls/fields';
import { ScrollStrip } from '../controls/ScrollStrip';
import { HelpLink } from '../manual/HelpLink';
import { PieceStudio, StudioShell } from './PieceStudio';

const QUICK_VIEWS: ViewId[] = ['front', 'left', 'right', 'back'];
const face = { expression: 'neutral', intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 };

/** SVG do corpo vestindo (ou não) a peça. */
function dressed(base: CharacterDefinition, w: Wearable, tryOn: boolean): CharacterDefinition {
  if (!tryOn) return base;
  const d = deepClone(base);
  wearOn(d, w);
  return d;
}
function bodySvg(def: CharacterDefinition, view: ViewId, poseId: string, id: string): string {
  const pose = POSES.find((p) => p.id === poseId);
  return renderCharacter(def, { bodyView: view, headView: view, rig: poseRig(poseId), handL: pose?.handL ?? 'open', handR: pose?.handR ?? 'open', face }, id).svg;
}
function viewBoxFor(def: CharacterDefinition, focus: 'body' | 'head', zoom: number): string {
  const m = bodyMetrics(def);
  if (focus === 'head') {
    const s = (m.rx * 4.2) / zoom;
    return `${-s / 2} ${m.headCenterY - s * 0.55} ${s} ${s}`;
  }
  const h = (m.totalHeight + 160) / zoom;
  const w = h * 0.7;
  return `${-w / 2} ${-m.totalHeight - 80 + (m.totalHeight + 160 - h) / 2} ${w} ${h}`;
}

export function WearCreator() {
  const project = useProject();
  const scene = useCurrentScene();
  const id = useUI((s) => s.wearCreatorId);
  const w = project && id ? project.wearables[id] : undefined;
  const [layerId, setLayerId] = useState<string | null>(null);
  const [model, setModel] = useState('mq:adulto');
  const [view, setView] = useState<ViewId>('front');
  const [poseId, setPoseId] = useState('idle');
  const [tryOn, setTryOn] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [focus, setFocus] = useState<'body' | 'head' | null>(null);
  const base = useMemo<CharacterDefinition | null>(() => {
    if (!project) return null;
    if (model.startsWith('mq:')) return MANNEQUINS.find((m) => `mq:${m.id}` === model)?.def ?? MANNEQUINS[0]!.def;
    return project.characters[model.slice(3)] ?? MANNEQUINS[0]!.def;
  }, [model, project]);
  const shown = useMemo(() => (w && base ? dressed(base, w, tryOn) : null), [w, base, tryOn]);
  const fcs = focus ?? (w?.kind === 'hair' ? 'head' : 'body');
  const big = useMemo(() => (shown ? bodySvg(shown, view, poseId, 'wearbig') : ''), [shown, view, poseId]);
  const strip = useMemo(() => (shown ? VIEW_ORDER.map((v) => ({ v, svg: bodySvg(shown, v, poseId, `wv${v}`) })) : []), [shown, poseId]);
  if (!project || !w || !base || !shown) return null;
  const layer = w.layers.find((l) => l.id === layerId) ?? w.layers[0];
  const set = (label: string, fn: (x: Wearable) => void, coalesce?: string) => editWearable(w.id, label, fn, coalesce);
  const setLayer = (label: string, fn: (l: WearLayer) => void, coalesce?: string) => set(label, (x) => { const l = x.layers.find((y) => y.id === layer?.id); if (l) fn(l); }, coalesce);
  const guide = layer ? anchorGuide(layer.anchor) : null;
  const sceneChar = (() => {
    const nid = useUI.getState().nodeIds[0];
    const n = nid && scene ? scene.nodes[nid] : undefined;
    return n?.kind === 'character' ? project.characters[n.characterId] : undefined;
  })();
  const label = w.kind === 'hair' ? 'Criador de Cabelos' : 'Criador de Roupas';
  const idx = layer ? w.layers.findIndex((l) => l.id === layer.id) : -1;

  return (
    <StudioShell testId="wear-creator" onClose={closeDialog}
      title={<><strong>{label}</strong><TextField label="Nome" value={w.name} testId="wear-name" onChange={(v) => set('Renomear', (x) => { x.name = v || (w.kind === 'hair' ? 'Cabelo' : 'Roupa'); }, 'name')} /><HelpLink chapter="criador-roupas" /></>}
      actions={<>
        <button type="button" className="btn btn-sm" data-testid="wear-save-lib" onClick={() => void saveWearableToLibrary(w.id)}><BookmarkPlus size={14} /> Biblioteca</button>
        <button type="button" className="btn btn-sm" data-testid="wear-apply" disabled={!sceneChar} title={sceneChar ? undefined : 'Selecione um personagem no palco antes de abrir o criador'} onClick={() => { if (sceneChar) applyWearable(sceneChar.id, w.id); }}><UserCheck size={14} /> {sceneChar ? `Vestir em ${sceneChar.name}` : 'Vestir (selecione um personagem)'}</button>
      </>}
    >
      <div className="creator-strip wear-strip">
        <SelectField label="Tipo" value={w.category} testId="wear-category" options={[{ id: '', label: 'Sem tipo' }, ...[...new Set(WEAR_STARTERS.filter((s) => s.kind === w.kind && s.category).map((s) => s.category)), ...(w.category && !WEAR_STARTERS.some((s) => s.category === w.category) ? [w.category] : [])].map((c) => ({ id: c, label: c }))]} onChange={(v) => set('Tipo', (x) => { x.category = v; })} />
        <SelectField label="Recomeçar com" value="" testId="wear-starter" options={[{ id: '', label: 'Escolha…' }, ...WEAR_STARTERS.filter((s) => s.kind === w.kind).map((s) => ({ id: s.id, label: s.label }))]} onChange={async (sid) => {
          const st = WEAR_STARTERS.find((s) => s.id === sid);
          if (!st) return;
          if (w.layers.some((l) => l.pieces.length) && !(await confirmDialog({ title: 'Recomeçar', message: `Trocar todas as camadas por "${st.label}"? Ctrl+Z desfaz.`, confirmLabel: 'Recomeçar' }))) return;
          const made = st.make(w.kind === 'hair' ? '#3a2b28' : '#5b8dbe');
          set('Recomeçar', (x) => { x.layers = made.layers; x.hides = made.hides; if (st.category) x.category = st.category; });
          setLayerId(made.layers[0]?.id ?? null);
        }} />
        {w.kind === 'clothing' ? <>
          <ToggleField label="Substitui a parte de cima" checked={w.hides.top} testId="wear-hides-top" onChange={(v) => set('Substitui', (x) => { x.hides.top = v; })} />
          <ToggleField label="Substitui a parte de baixo" checked={w.hides.bottom} testId="wear-hides-bottom" onChange={(v) => set('Substitui', (x) => { x.hides.bottom = v; })} />
        </> : <ToggleField label="Substitui o cabelo do personagem" checked={w.hides.hair} testId="wear-hides-hair" onChange={(v) => set('Substitui', (x) => { x.hides.hair = v; })} />}
        <p className="hint">Cada camada fica presa a uma parte do corpo e acompanha pose, vista e animação. O que é substituído vira cobertura neutra (nunca fica descoberto).</p>
      </div>

      <div className="wear-layers" data-testid="wear-layers">
        <ScrollStrip className="chip-row" role="tablist" ariaLabel="Camadas" testId="wear-layer-list" watch={layer?.id}>
          {w.layers.map((l, i) => (
            <button key={l.id} type="button" role="tab" aria-selected={l.id === layer?.id} className={`chip${l.id === layer?.id ? ' is-active' : ''}`} data-testid="wear-layer" data-index={i} data-anchor={l.anchor} onClick={() => setLayerId(l.id)}>
              {l.name} <small>· {ANCHOR_LABELS[l.anchor]}</small>
            </button>
          ))}
        </ScrollStrip>
        <div className="wear-layer-tools">
          <SelectField label="Nova camada em" value="" testId="wear-add-layer" options={[{ id: '', label: '+ Camada…' }, ...WEAR_ANCHORS.map((a) => ({ id: a, label: ANCHOR_LABELS[a] }))]} onChange={(a) => {
            if (!a) return;
            const nl: WearLayer = { id: uid('wl'), name: ANCHOR_LABELS[a as WearAnchor], anchor: a as WearAnchor, depth: 'front', side: 'both', followTurn: false, mirror: false, pieces: [] };
            set('Nova camada', (x) => { x.layers.push(nl); });
            setLayerId(nl.id);
          }} />
          {layer && <>
            <IconButton label="Duplicar camada" testId="wear-layer-dup" onClick={() => { const c = { ...deepClone(layer), id: uid('wl'), name: `${layer.name} (cópia)` }; set('Duplicar camada', (x) => { x.layers.splice(idx + 1, 0, c); }); setLayerId(c.id); }}><Copy size={14} /></IconButton>
            <IconButton label="Camada para trás" testId="wear-layer-down" disabled={idx <= 0} onClick={() => set('Ordem da camada', (x) => { const [l] = x.layers.splice(idx, 1); x.layers.splice(idx - 1, 0, l!); })}><ArrowDown size={14} /></IconButton>
            <IconButton label="Camada para a frente" testId="wear-layer-up" disabled={idx >= w.layers.length - 1} onClick={() => set('Ordem da camada', (x) => { const [l] = x.layers.splice(idx, 1); x.layers.splice(idx + 1, 0, l!); })}><ArrowUp size={14} /></IconButton>
            <IconButton label="Excluir camada" danger testId="wear-layer-del" disabled={w.layers.length <= 1} onClick={() => { set('Excluir camada', (x) => { x.layers = x.layers.filter((l) => l.id !== layer.id); }); setLayerId(null); }}><Trash2 size={14} /></IconButton>
          </>}
        </div>
        {layer && (
          <div className="wear-layer-props" data-testid="wear-layer-props">
            <TextField label="Nome da camada" value={layer.name} testId="wear-layer-name" onChange={(v) => setLayer('Nome da camada', (l) => { l.name = v || 'Camada'; }, `ln-${layer.id}`)} />
            <SelectField label="Presa em" value={layer.anchor} testId="wear-layer-anchor" options={WEAR_ANCHORS.map((a) => ({ id: a, label: ANCHOR_LABELS[a] }))} onChange={(v) => setLayer('Parte do corpo', (l) => { l.anchor = v as WearAnchor; })} />
            {layer.anchor === 'head' && <SelectField label="Profundidade" value={layer.depth} testId="wear-layer-depth" options={[{ id: 'front', label: 'Na frente do rosto' }, { id: 'behindHead', label: 'Atrás da cabeça' }, { id: 'behindBody', label: 'Atrás do corpo (comprimento)' }]} onChange={(v) => setLayer('Profundidade', (l) => { l.depth = v as WearLayer['depth']; })} />}
            <SelectField label="Aparece em" value={layer.side} testId="wear-layer-side" options={[{ id: 'both', label: 'Todas as vistas' }, { id: 'front', label: 'Só de frente, 3/4 e perfil' }, { id: 'back', label: 'Só de costas' }]} onChange={(v) => setLayer('Vistas', (l) => { l.side = v as WearLayer['side']; })} />
            <ToggleField label="Desliza ao virar" checked={layer.followTurn} testId="wear-layer-turn" onChange={(v) => setLayer('Desliza ao virar', (l) => { l.followTurn = v; })} />
            <ToggleField label="Espelha virado à esquerda" checked={layer.mirror} testId="wear-layer-mirror" onChange={(v) => setLayer('Espelhar', (l) => { l.mirror = v; })} />
          </div>
        )}
      </div>

      <div className="wear-main">
        <section className="wear-preview" aria-label="Prévia no manequim" data-testid="wear-preview">
          <div className="wear-preview-tools">
            <SelectField label="Corpo" value={model} testId="wear-model" options={[...MANNEQUINS.map((m) => ({ id: `mq:${m.id}`, label: `Manequim ${m.label.toLowerCase()}` })), ...Object.values(project.characters).map((c) => ({ id: `ch:${c.id}`, label: `${c.name} (do projeto)` }))]} onChange={setModel} />
            <SelectField label="Pose" value={poseId} testId="wear-pose" options={POSES.map((p) => ({ id: p.id, label: p.label }))} onChange={setPoseId} />
            <SelectField label="Vista" value={view} testId="wear-view" options={VIEW_ORDER.map((v) => ({ id: v, label: VIEW_LABELS[v] }))} onChange={(v) => setView(v as ViewId)} />
          </div>
          <div className="btn-row wear-quick">
            {QUICK_VIEWS.map((v) => <button key={v} type="button" className={`chip${view === v ? ' is-active' : ''}`} aria-pressed={view === v} data-testid={`wear-view-${v}`} onClick={() => setView(v)}>{VIEW_LABELS[v].replace('Perfil ', '')}</button>)}
            <button type="button" className={`chip${tryOn ? ' is-active' : ''}`} aria-pressed={tryOn} data-testid="wear-tryon" onClick={() => setTryOn(!tryOn)}><Shirt size={12} /> {tryOn ? 'Vestido' : 'Sem a peça'}</button>
            <button type="button" className={`chip${fcs === 'head' ? ' is-active' : ''}`} aria-pressed={fcs === 'head'} data-testid="wear-focus-head" onClick={() => setFocus(fcs === 'head' ? 'body' : 'head')}>Foco na cabeça</button>
            <label className="anim-check">Zoom <input type="range" min={1} max={3} step={0.25} value={zoom} data-testid="wear-zoom" aria-label="Zoom da prévia" onChange={(e) => setZoom(Number(e.target.value))} /></label>
          </div>
          <svg className="wear-big" data-testid="wear-big" data-view={view} viewBox={viewBoxFor(shown, fcs, zoom)} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: big }} />
          <ol className="wear-views" data-testid="wear-views" aria-label="Todas as vistas">
            {strip.map(({ v, svg }) => (
              <li key={v}><button type="button" className={view === v ? 'is-active' : ''} aria-label={VIEW_LABELS[v]} aria-pressed={view === v} onClick={() => setView(v)}><svg viewBox={viewBoxFor(shown, fcs, 1)} dangerouslySetInnerHTML={{ __html: svg }} /></button></li>
            ))}
          </ol>
        </section>
        {layer && guide && (
          <section className="wear-edit" aria-label={`Peças da camada ${layer.name}`}>
            <p className="hint">Editando <strong>{layer.name}</strong> ({ANCHOR_LABELS[layer.anchor]}). O tracejado é a parte do corpo de referência: desenhe por cima dele.</p>
            <PieceStudio
              key={layer.id}
              project={project}
              pieces={layer.pieces}
              testId="wear-studio"
              vectorOnly
              viewBox={guide.box}
              underlay={guide.svg}
              edit={(lbl, fn, coalesce) => setLayer(lbl, (l) => fn(l.pieces, project), coalesce)}
            />
          </section>
        )}
      </div>
    </StudioShell>
  );
}

