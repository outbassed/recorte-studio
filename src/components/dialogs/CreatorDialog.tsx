/**
 * Criador de personagens. Edita a DEFINIÇÃO da biblioteca do projeto (reflete em todas
 * as instâncias) e mostra as 8 vistas reais, geradas pelo mesmo renderizador do palco.
 */
import { useMemo, useRef, useState } from 'react';
import { RotateCcw, Upload } from 'lucide-react';
import type { CharacterDefinition, Project, ViewId } from '@/engine/model/schema';
import { CharacterDefinitionSchema, RigSchema } from '@/engine/model/schema';
import { ACCESSORIES, AGE_OPTIONS, BEARD_OPTIONS, BOTTOMS, BROW_OPTIONS, CLOTH_PALETTE, EAR_OPTIONS, EYE_OPTIONS, HAIR_PALETTE, HEAD_SHAPES, MOUTH_OPTIONS, MUSTACHE_OPTIONS, NOSE_OPTIONS, outfitConflicts, PATTERNS, SHOES, SKIN_PALETTE, TOPS } from '@/engine/character/catalog';
import { EXPRESSIONS } from '@/engine/character/expressions';
import { getHairStyle, HAIR_STYLES, hairCollidesWithHats } from '@/engine/character/hair';
import { POSES, poseRig } from '@/engine/character/presets';
import { bodyMetrics, renderCharacter } from '@/engine/character/render';
import { VIEW_LABELS, VIEW_ORDER } from '@/engine/character/views';
import { characterUsage } from '@/engine/model/ops';
import { deepClone, uid } from '@/engine/model/ids';
import { IMAGE_ACCEPT, importImageFile, registerAssetBlob } from '@/features/library/assets';
import { matchesSearch } from '@/features/library/search';
import { downloadBlob } from '@/features/projects/session';
import { commit, useProject } from '@/state/projectStore';
import { placeCharacter } from '@/state/actions';
import { closeDialog, confirmDialog, toast, useUI } from '@/state/uiStore';
import { repo } from '@/storage/db';
import { ColorField, SearchBox, SelectField, TextField, ToggleField } from '../controls/fields';
import { SliderNumberField } from '../controls/SliderNumberField';
import { Modal } from './Modal';
import { drawSvgToCanvas } from '@/features/export/pipeline';
import { applyWearable, newWearableInProject, openWearCreator, removeWearable } from '@/state/wearActions';

/** Roupas ou cabelos criados no projeto (Fase 3b): vestir, tirar, editar e criar. */
function CreatedWear({ project, def, kind }: { project: Project; def: CharacterDefinition; kind: 'clothing' | 'hair' }) {
  const items = Object.values(project.wearables ?? {}).filter((w) => w.kind === kind);
  const hair = kind === 'hair';
  return (
    <section className="created-wear" data-testid={`created-wear-${kind}`} aria-label={hair ? 'Cabelos criados' : 'Roupas criadas'}>
      <h4>{hair ? 'Cabelos criados' : 'Roupas criadas'}</h4>
      {items.length === 0 && <p className="hint">{hair ? 'Nenhum cabelo criado neste projeto ainda.' : 'Nenhuma roupa criada neste projeto ainda.'}</p>}
      {items.map((w) => {
        const on = def.wear.some((x) => x.id === w.id);
        return (
          <div key={w.id} className="acc-row" data-testid="created-wear-row" data-wear={w.id}>
            <ToggleField label={w.name} testId="created-wear-toggle" checked={on} onChange={(v) => (v ? applyWearable(def.id, w.id) : removeWearable(def.id, w.id))} />
            <button type="button" className="btn btn-sm" onClick={() => openWearCreator(w.id)}>Editar</button>
          </div>
        );
      })}
      {def.wear.filter((x) => x.kind === kind && !project.wearables?.[x.id]).map((x) => (
        <div key={x.id} className="acc-row"><ToggleField label={`${x.name} (cópia no personagem)`} checked onChange={() => removeWearable(def.id, x.id)} /></div>
      ))}
      <button type="button" className="btn btn-sm" data-testid={`created-wear-new-${kind}`} onClick={async () => {
        const id = await newWearableInProject(kind, hair ? 'hair-short' : 'tshirt');
        if (id) applyWearable(def.id, id);
      }}>{hair ? '+ Criar cabelo' : '+ Criar roupa'}</button>
      <p className="hint">{hair ? 'O cabelo criado substitui o estilo acima enquanto estiver vestido.' : 'Peças criadas ficam por cima das roupas acima; quando cobrem tronco ou pernas, a roupa padrão vira base neutra.'}</p>
    </section>
  );
}

type Tab = 'corpo' | 'rosto' | 'cabelo' | 'roupas' | 'acessorios' | 'identidade';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'corpo', label: 'Corpo' }, { id: 'rosto', label: 'Rosto' }, { id: 'cabelo', label: 'Cabelo' }, { id: 'roupas', label: 'Roupas' }, { id: 'acessorios', label: 'Acessórios' }, { id: 'identidade', label: 'Identidade' },
];

function charSvgDoc(def: CharacterDefinition, view: ViewId, expression: string, poseId: string, idPrefix: string): { html: string; vb: string } {
  const res = renderCharacter(def, { bodyView: view, headView: view, rig: poseRig(poseId), handL: POSES.find((p) => p.id === poseId)?.handL ?? 'open', handR: POSES.find((p) => p.id === poseId)?.handR ?? 'open', face: { expression, intensity: 1, viseme: null, visemeAmount: 0, blink: 0, gazeX: 0, gazeY: 0 } }, idPrefix);
  const m = bodyMetrics(def);
  const pad = 60;
  const h = m.totalHeight + pad * 2 + 80;
  const w = Math.max(h * 0.68, m.rx * 3.6);
  return { html: res.svg, vb: `${-w / 2} ${-m.totalHeight - pad - 70} ${w} ${h}` };
}

export function CreatorDialog() {
  const project = useProject();
  const id = useUI((s) => s.creatorCharacterId);
  const def = id ? project?.characters[id] : undefined;
  const [view, setView] = useState<ViewId>('front');
  const [expression, setExpression] = useState('neutral');
  const [pose, setPose] = useState('idle');
  const [tab, setTab] = useState<Tab>('corpo');
  const [hairQuery, setHairQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const large = useMemo(() => (def ? charSvgDoc(def, view, expression, pose, 'creator') : null), [def, view, expression, pose]);
  if (!project || !def || !large) return null;
  const set = (label: string, fn: (d: CharacterDefinition) => void, coalesce?: string) => commit(label, (draft) => {
    const c = (draft as Project).characters[def.id];
    if (c) fn(c);
  }, coalesce ? { coalesce: `char-${def.id}-${coalesce}` } : {});

  const usage = characterUsage(project, def.id);
  const hairTall = hairCollidesWithHats(def.hair.style);
  const conflicts = outfitConflicts(def.outfit.top, def.outfit.bottom, def.accessories.map((a) => a.id), hairTall);
  const defaults = CharacterDefinitionSchema.parse({ id: 'x', name: 'x' });

  const resetPart = async (part: 'body' | 'face' | 'hair' | 'outfit' | 'accessories') => {
    const ok = await confirmDialog({ title: 'Restaurar seção', message: 'Restaurar apenas esta seção ao padrão? Ctrl+Z desfaz.', confirmLabel: 'Restaurar' });
    if (!ok) return;
    set('Restaurar seção', (c) => {
      if (part === 'body') c.body = deepClone(defaults.body);
      if (part === 'face') c.face = deepClone(defaults.face);
      if (part === 'hair') c.hair = deepClone(defaults.hair);
      if (part === 'outfit') c.outfit = deepClone(defaults.outfit);
      if (part === 'accessories') c.accessories = [];
    });
  };
  const num = (label: string, value: number, onChange: (v: number) => void, min: number, max: number, key: string, testId?: string) => (
    <SliderNumberField label={label} value={value} display={100} unit="%" min={min} max={max} sliderMin={min * 100} sliderMax={max * 100} step={1} decimals={0} testId={testId} onChange={(v) => { onChange(v); }} key={key} />
  );

  const exportSvg = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${large.vb}">${large.html}</svg>`;
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `${def.name}.svg`);
  };
  const exportPng = async () => {
    const [x, y, w, h] = large.vb.split(' ').map(Number);
    const W = 800;
    const H = Math.round((800 * h!) / w!);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x} ${y} ${w} ${h}">${large.html}</svg>`;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    await drawSvgToCanvas(svg, canvas.getContext('2d')!, W, H);
    canvas.toBlob((b) => b && downloadBlob(b, `${def.name}.png`));
  };
  const exportJson = () => downloadBlob(new Blob([JSON.stringify({ format: 'recorte-studio-character', version: 1, character: def }, null, 2)], { type: 'application/json' }), `${def.name}.json`);

  return (
    <Modal title={`Criador de personagens · ${def.name}`} size="full" testId="creator" onClose={closeDialog}
      footer={<>
        <span className="hint">{usage > 0 ? `Em uso em ${usage} instância(s): mudanças valem em todas as cenas.` : 'Ainda não está em nenhuma cena.'}</span>
        <span className="tl-spacer" />
        <button type="button" className="btn" data-testid="creator-place" onClick={() => { placeCharacter(def.id); closeDialog(); }}>Colocar na cena atual</button>
        <button type="button" className="btn btn-primary" data-testid="creator-done" onClick={closeDialog}>Concluir</button>
      </>}>
      <div className="creator">
        <div className="creator-preview">
          <svg className="creator-stage" data-testid="creator-preview" viewBox={large.vb} dangerouslySetInnerHTML={{ __html: large.html }} />
          <div className="view-strip" role="group" aria-label="Vistas do personagem">
            {VIEW_ORDER.map((v) => {
              const mini = charSvgDoc(def, v, 'neutral', 'idle', `mini${v}`);
              return (
                <button key={v} type="button" className={`view-btn${v === view ? ' is-active' : ''}`} aria-pressed={v === view} aria-label={VIEW_LABELS[v]} title={VIEW_LABELS[v]} data-testid={`view-${v}`} onClick={() => setView(v)}>
                  <svg viewBox={mini.vb} width="44" height="64" dangerouslySetInnerHTML={{ __html: mini.html }} />
                </button>
              );
            })}
          </div>
          <div className="creator-preview-row">
            <SelectField label="Testar expressão" value={expression} options={EXPRESSIONS.map((e) => ({ id: e.id, label: e.label }))} onChange={setExpression} />
            <SelectField label="Testar pose" value={pose} options={POSES.map((p) => ({ id: p.id, label: p.label }))} onChange={setPose} />
          </div>
        </div>
        <div className="creator-controls">
          <div className="tabs" role="tablist">
            {TABS.map((t) => <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' is-active' : ''}`} data-testid={`creator-tab-${t.id}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
          </div>
          <div className="creator-scroll">
            {tab === 'corpo' && (
              <>
                <SelectField label="Idade aparente" value={def.body.age} testId="c-age" options={AGE_OPTIONS} onChange={(v) => set('Idade', (c) => { c.body.age = v as CharacterDefinition['body']['age']; })} />
                <ColorField label="Tom de pele" value={def.skin} palette={SKIN_PALETTE} testId="c-skin" onChange={(v) => set('Pele', (c) => { c.skin = v; }, 'skin')} />
                {num('Altura', def.body.height, (v) => set('Altura', (c) => { c.body.height = v; }, 'h'), 0.6, 1.4, 'h', 'c-height')}
                {num('Massa corporal', def.body.build, (v) => set('Massa', (c) => { c.body.build = v; }, 'b'), 0.65, 1.7, 'b', 'c-build')}
                {num('Ombros', def.body.shoulders, (v) => set('Ombros', (c) => { c.body.shoulders = v; }, 's'), 0.7, 1.4, 's')}
                {num('Barriga', def.body.belly, (v) => set('Barriga', (c) => { c.body.belly = v; }, 'be'), 0, 1.4, 'be')}
                {num('Tronco', def.body.torsoLength, (v) => set('Tronco', (c) => { c.body.torsoLength = v; }, 't'), 0.7, 1.4, 't')}
                {num('Comprimento dos braços', def.body.armLength, (v) => set('Braços', (c) => { c.body.armLength = v; }, 'a'), 0.7, 1.4, 'a')}
                {num('Comprimento das pernas', def.body.legLength, (v) => set('Pernas', (c) => { c.body.legLength = v; }, 'l'), 0.6, 1.5, 'l')}
                {num('Largura da cabeça', def.body.headWidth, (v) => set('Cabeça', (c) => { c.body.headWidth = v; }, 'hw'), 0.7, 1.35, 'hw')}
                {num('Altura da cabeça', def.body.headHeight, (v) => set('Cabeça', (c) => { c.body.headHeight = v; }, 'hh'), 0.7, 1.35, 'hh')}
                {num('Contorno', def.outlineWidth / 10, (v) => set('Contorno', (c) => { c.outlineWidth = v * 10; }, 'ow'), 0.1, 1, 'ow')}
                <button type="button" className="btn btn-sm" onClick={() => void resetPart('body')}><RotateCcw size={13} /> Restaurar corpo</button>
              </>
            )}
            {tab === 'rosto' && (
              <>
                <SelectField label="Formato da cabeça" value={def.face.headShape} testId="c-head" options={HEAD_SHAPES} onChange={(v) => set('Cabeça', (c) => { c.face.headShape = v; })} />
                <SelectField label="Olhos" value={def.face.eyes} testId="c-eyes" options={EYE_OPTIONS} onChange={(v) => set('Olhos', (c) => { c.face.eyes = v; })} />
                {num('Tamanho dos olhos', def.face.eyeSize, (v) => set('Olhos', (c) => { c.face.eyeSize = v; }, 'es'), 0.6, 1.4, 'es')}
                {num('Distância entre olhos', def.face.eyeSpacing, (v) => set('Olhos', (c) => { c.face.eyeSpacing = v; }, 'esp'), 0.7, 1.3, 'esp')}
                <ColorField label="Cor dos olhos" value={def.face.eyeColor} onChange={(v) => set('Olhos', (c) => { c.face.eyeColor = v; }, 'ec')} />
                <SelectField label="Sobrancelhas" value={def.face.brows} options={BROW_OPTIONS} onChange={(v) => set('Sobrancelhas', (c) => { c.face.brows = v; })} />
                <ColorField label="Cor das sobrancelhas" value={def.face.browColor} onChange={(v) => set('Sobrancelhas', (c) => { c.face.browColor = v; }, 'bc')} />
                <SelectField label="Nariz" value={def.face.nose} testId="c-nose" options={NOSE_OPTIONS} onChange={(v) => set('Nariz', (c) => { c.face.nose = v; })} />
                {num('Tamanho do nariz', def.face.noseSize, (v) => set('Nariz', (c) => { c.face.noseSize = v; }, 'ns'), 0.5, 1.6, 'ns')}
                <SelectField label="Boca" value={def.face.mouth} options={MOUTH_OPTIONS} onChange={(v) => set('Boca', (c) => { c.face.mouth = v; })} />
                <ColorField label="Cor dos lábios" value={def.face.lipColor} onChange={(v) => set('Boca', (c) => { c.face.lipColor = v; }, 'lc')} />
                <SelectField label="Orelhas" value={def.face.ears} options={EAR_OPTIONS} onChange={(v) => set('Orelhas', (c) => { c.face.ears = v; })} />
                <SelectField label="Bigode" value={def.face.mustache} testId="c-mustache" options={MUSTACHE_OPTIONS} onChange={(v) => set('Bigode', (c) => { c.face.mustache = v; })} />
                <SelectField label="Barba" value={def.face.beard} testId="c-beard" options={BEARD_OPTIONS} onChange={(v) => set('Barba', (c) => { c.face.beard = v; })} />
                <ColorField label="Cor dos pelos faciais" value={def.face.facialHairColor} onChange={(v) => set('Pelos', (c) => { c.face.facialHairColor = v; }, 'fh')} />
                <ToggleField label="Bochechas" checked={def.face.cheeks} onChange={(v) => set('Bochechas', (c) => { c.face.cheeks = v; })} />
                <ToggleField label="Sardas" checked={def.face.freckles} onChange={(v) => set('Sardas', (c) => { c.face.freckles = v; })} />
                <ToggleField label="Rugas" checked={def.face.wrinkles} onChange={(v) => set('Rugas', (c) => { c.face.wrinkles = v; })} />
                <ToggleField label="Cílios" checked={def.face.lashes} onChange={(v) => set('Cílios', (c) => { c.face.lashes = v; })} />
                <button type="button" className="btn btn-sm" onClick={() => void resetPart('face')}><RotateCcw size={13} /> Restaurar rosto</button>
              </>
            )}
            {tab === 'cabelo' && (
              <>
                <ColorField label="Cor do cabelo" value={def.hair.color} palette={HAIR_PALETTE} testId="c-hair-color" onChange={(v) => set('Cor do cabelo', (c) => { c.hair.color = v; }, 'hc')} />
                <ToggleField label="Mechas" checked={!!def.hair.highlight} onChange={(v) => set('Mechas', (c) => { c.hair.highlight = v ? '#e6c478' : ''; })} />
                {def.hair.highlight && <ColorField label="Cor das mechas" value={def.hair.highlight} onChange={(v) => set('Mechas', (c) => { c.hair.highlight = v; }, 'hl')} />}
                <SearchBox value={hairQuery} onChange={setHairQuery} placeholder="Buscar estilo de cabelo" />
                <div className="hair-grid" role="group" aria-label="Estilos de cabelo">
                  {HAIR_STYLES.filter((h) => matchesSearch(hairQuery, h.label, h.keywords)).map((h) => {
                    const mini = charSvgDoc({ ...def, hair: { ...def.hair, style: h.id }, accessories: [] }, view, 'neutral', 'idle', `hair${h.id}`);
                    const [x, y, w] = mini.vb.split(' ').map(Number);
                    return (
                      <button key={h.id} type="button" className={`hair-card${def.hair.style === h.id ? ' is-active' : ''}`} aria-pressed={def.hair.style === h.id} data-testid="hair-card" data-hair={h.id} onClick={() => set('Estilo de cabelo', (c) => { c.hair.style = h.id; })}>
                        <svg viewBox={`${x! + w! * 0.14} ${y} ${w! * 0.72} ${w! * 0.72}`} width="64" height="64" dangerouslySetInnerHTML={{ __html: mini.html }} />
                        <span>{h.label}</span>
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="btn btn-sm" onClick={() => void resetPart('hair')}><RotateCcw size={13} /> Restaurar cabelo</button>
                <CreatedWear project={project} def={def} kind="hair" />
              </>
            )}
            {tab === 'roupas' && (
              <>
                <SelectField label="Parte de cima" value={def.outfit.top} testId="c-top" options={TOPS} onChange={(v) => set('Roupa', (c) => { c.outfit.top = v; })} />
                <ColorField label="Cor (cima)" value={def.outfit.topColor} palette={CLOTH_PALETTE} testId="c-top-color" onChange={(v) => set('Cor da roupa', (c) => { c.outfit.topColor = v; }, 'tc')} />
                <SelectField label="Estampa" value={def.outfit.topPattern} testId="c-pattern" options={PATTERNS} onChange={(v) => set('Estampa', (c) => { c.outfit.topPattern = v as CharacterDefinition['outfit']['topPattern']; })} />
                {def.outfit.topPattern !== 'none' && <ColorField label="Cor da estampa" value={def.outfit.topPatternColor} onChange={(v) => set('Estampa', (c) => { c.outfit.topPatternColor = v; }, 'pc')} />}
                <SelectField label="Parte de baixo" value={def.outfit.bottom} options={BOTTOMS} onChange={(v) => set('Roupa', (c) => { c.outfit.bottom = v; })} />
                <ColorField label="Cor (baixo)" value={def.outfit.bottomColor} palette={CLOTH_PALETTE} onChange={(v) => set('Cor da roupa', (c) => { c.outfit.bottomColor = v; }, 'bc2')} />
                <SelectField label="Sapatos" value={def.outfit.shoes} options={SHOES} onChange={(v) => set('Sapatos', (c) => { c.outfit.shoes = v; })} />
                <ColorField label="Cor dos sapatos" value={def.outfit.shoeColor} palette={CLOTH_PALETTE} onChange={(v) => set('Sapatos', (c) => { c.outfit.shoeColor = v; }, 'sc')} />
                {conflicts.length > 0 && <div className="warn-box" data-testid="conflicts" role="status"><strong>Atenção:</strong><ul>{conflicts.map((m) => <li key={m}>{m}</li>)}</ul></div>}
                <button type="button" className="btn btn-sm" onClick={() => void resetPart('outfit')}><RotateCcw size={13} /> Restaurar roupas</button>
                <CreatedWear project={project} def={def} kind="clothing" />
              </>
            )}
            {tab === 'acessorios' && (
              <>
                {ACCESSORIES.map((a) => {
                  const cur = def.accessories.find((x) => x.id === a.id);
                  return (
                    <div key={a.id} className="acc-row">
                      <ToggleField label={a.label} testId={`acc-${a.id}`} checked={!!cur} onChange={(v) => set('Acessório', (c) => {
                        if (v) c.accessories.push({ id: a.id, color: '#d65f5f' });
                        else c.accessories = c.accessories.filter((x) => x.id !== a.id);
                      })} />
                      {cur && <input type="color" aria-label={`Cor de ${a.label}`} value={cur.color} onChange={(e) => set('Cor do acessório', (c) => { const it = c.accessories.find((x) => x.id === a.id); if (it) it.color = e.target.value; }, `acc-${a.id}`)} />}
                    </div>
                  );
                })}
                {conflicts.length > 0 && <div className="warn-box" role="status"><ul>{conflicts.map((m) => <li key={m}>{m}</li>)}</ul></div>}
                <button type="button" className="btn btn-sm" onClick={() => void resetPart('accessories')}><RotateCcw size={13} /> Remover todos</button>
              </>
            )}
            {tab === 'identidade' && (
              <>
                <TextField label="Nome" value={def.name} testId="c-name" onChange={(v) => set('Renomear personagem', (c) => { c.name = v; }, 'name')} />
                <TextField label="Anotações" multiline value={def.notes} onChange={(v) => set('Anotações', (c) => { c.notes = v; }, 'notes')} />
                <p className="field-label">Exportar este personagem</p>
                <div className="btn-row">
                  <button type="button" className="btn btn-sm" data-testid="c-export-svg" onClick={exportSvg}>SVG</button>
                  <button type="button" className="btn btn-sm" onClick={() => void exportPng()}>PNG</button>
                  <button type="button" className="btn btn-sm" onClick={exportJson}>Arquivo (.json)</button>
                  <button type="button" className="btn btn-sm" onClick={async () => {
                    await repo.putLibrary({ id: uid('lib'), kind: 'character', name: def.name, favorite: 0, createdAt: Date.now(), data: { ...deepClone(def), builtinId: undefined } });
                    toast('Salvo na sua biblioteca.', 'success');
                  }}>Salvar na biblioteca</button>
                </div>
                <p className="field-label">Sprite próprio</p>
                <p className="hint">Um PNG/SVG importado substitui o desenho, mas <strong>não é articulável</strong>: sem vistas, sem boca e sem rig. Ele apenas se move, escala e gira como um recorte estático.</p>
                <div className="btn-row">
                  <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}><Upload size={13} /> Importar sprite</button>
                  {def.spriteAssetId && <button type="button" className="btn btn-sm" onClick={() => set('Remover sprite', (c) => { c.spriteAssetId = undefined; })}>Voltar ao rig</button>}
                </div>
                <input ref={fileRef} hidden type="file" accept={IMAGE_ACCEPT} onChange={async (e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (!f) return;
                  try {
                    const { asset } = await importImageFile(f);
                    const blob = await repo.getBlob(asset.id);
                    if (blob) registerAssetBlob(asset.id, blob);
                    commit('Importar sprite', (d) => {
                      d.assets[asset.id] = asset;
                      const c = (d as Project).characters[def.id];
                      if (c) c.spriteAssetId = asset.id;
                    });
                  } catch (err) {
                    toast(err instanceof Error ? err.message : 'Falha ao importar.', 'error');
                  }
                }} />
                <p className="hint">Cabelo atual: {getHairStyle(def.hair.style).label}. Vistas 2D são desenhos por template: não há modelo 3D.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export const _rig = RigSchema;
