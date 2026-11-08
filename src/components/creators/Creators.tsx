/** Criador de Objetos e Criador de Cenários: estúdios dentro do estúdio. */
import { useEffect, useState } from 'react';
import { BookmarkPlus, Copy, ImagePlus, LayoutTemplate, Plus, Trash2, Wand2 } from 'lucide-react';
import { TIMES_OF_DAY, type Composition, type CustomBackground, type Piece, type Project, type TimeOfDay } from '@/engine/model/schema';
import { CUSTOM_RECT, TIME_LABELS } from '@/engine/world/customBackgrounds';
import { BACKGROUNDS } from '@/engine/world/backgrounds';
import { n } from '@/engine/render/svg';
import { IMAGE_ACCEPT } from '@/features/library/assets';
import { commit, useProject } from '@/state/projectStore';
import { closeDialog, promptDialog, toast, useUI } from '@/state/uiStore';
import {
  SCENERY_PRESETS, SCENERY_TEMPLATES, applySceneryToScene, insertCustomObject, removeTime, saveObjectToLibrary, startComposition, startCompositionFromFile,
} from '@/state/creatorActions';
import { repo, type LibraryRecord } from '@/storage/db';
import { uid, deepClone } from '@/engine/model/ids';
import { SelectField, TextField } from '../controls/fields';
import { SliderNumberField } from '../controls/SliderNumberField';
import { HelpLink } from '../manual/HelpLink';
import { PieceStudio, StudioShell } from './PieceStudio';

/* ------------------------------ objetos ------------------------------ */
export function ObjectCreator() {
  const project = useProject();
  const id = useUI((s) => s.objectCreatorId);
  const obj = project && id ? project.customObjects[id] : undefined;
  if (!project || !obj) return null;
  type Obj = NonNullable<typeof obj>;
  const set = (label: string, fn: (o: Obj) => void, coalesce?: string) => commit(label, (d) => {
    const o = (d as Project).customObjects[obj.id];
    if (o) { fn(o); o.updatedAt = Date.now(); }
  }, coalesce ? { coalesce } : {});
  const size = Math.max(obj.width, obj.height) * 1.5 + 80;
  const box = `<rect x="${n(-obj.width / 2)}" y="${n(-obj.height)}" width="${n(obj.width)}" height="${n(obj.height)}" fill="none" stroke="#7b8192" stroke-width="${n(size / 400)}" stroke-dasharray="${n(size / 80)} ${n(size / 120)}"/>` +
    `<path d="M${n(-size)} 0H${n(size)}" stroke="#7b819255" stroke-width="${n(size / 500)}"/>`;
  const pivot = `<g transform="translate(${n(obj.pivotX)} ${n(obj.pivotY)})"><circle r="${n(size / 90)}" fill="none" stroke="#e8616a" stroke-width="${n(size / 400)}"/><path d="M${n(-size / 50)} 0H${n(size / 50)}M0 ${n(-size / 50)}V${n(size / 50)}" stroke="#e8616a" stroke-width="${n(size / 500)}"/></g>`;
  return (
    <StudioShell testId="object-creator" onClose={closeDialog}
      title={<><strong>Criador de Objetos</strong><TextField label="Nome" value={obj.name} testId="object-name" onChange={(v) => set('Renomear objeto', (o) => { o.name = v || 'Objeto'; }, 'obj-name')} /><HelpLink chapter="criador-objetos" /></>}
      actions={<>
        <button type="button" className="btn btn-sm" data-testid="object-save-lib" onClick={() => void saveObjectToLibrary(obj.id)}><BookmarkPlus size={14} /> Biblioteca</button>
        <button type="button" className="btn btn-sm" data-testid="object-insert" onClick={() => { insertCustomObject(obj.id); closeDialog(); }}><Plus size={14} /> Inserir na cena</button>
      </>}
    >
      <div className="creator-strip">
        <SliderNumberField label="Largura" unit="px" min={10} max={4000} sliderMin={20} sliderMax={1200} decimals={0} testId="object-width" value={obj.width} onChange={(v) => set('Largura', (o) => { o.width = Math.max(10, Math.round(v)); }, 'obj-w')} />
        <SliderNumberField label="Altura" unit="px" min={10} max={4000} sliderMin={20} sliderMax={1200} decimals={0} testId="object-height" value={obj.height} onChange={(v) => set('Altura', (o) => { o.height = Math.max(10, Math.round(v)); }, 'obj-h')} />
        <SliderNumberField label="Pivô X" unit="px" sliderMin={-600} sliderMax={600} decimals={0} value={obj.pivotX} onChange={(v) => set('Pivô', (o) => { o.pivotX = Math.round(v); }, 'obj-px')} />
        <SliderNumberField label="Pivô Y" unit="px" sliderMin={-1200} sliderMax={200} decimals={0} value={obj.pivotY} onChange={(v) => set('Pivô', (o) => { o.pivotY = Math.round(v); }, 'obj-py')} />
        <p className="hint">A caixa tracejada é o tamanho do objeto; a base fica na linha do chão. O pivô (vermelho) é o ponto de giro e escala na cena.</p>
      </div>
      <PieceStudio
        project={project}
        pieces={obj.pieces}
        testId="obj-studio"
        excludeObjectId={obj.id}
        viewBox={{ x: -size / 2, y: -size * 0.8, w: size, h: size }}
        underlay={box}
        overlay={pivot}
        edit={(label, fn, coalesce) => set(label, (o) => fn(o.pieces, project), coalesce)}
      />
    </StudioShell>
  );
}

/* ------------------------------ cenários ------------------------------ */
function StartPanel({ cb, time }: { cb: CustomBackground; time: TimeOfDay }) {
  const [lib, setLib] = useState<LibraryRecord[]>([]);
  useEffect(() => { void repo.listLibrary('background').then(setLib); }, []);
  const others = TIMES_OF_DAY.filter((t) => t !== time && cb.compositions[t]);
  const libComps = lib.flatMap((r) => {
    const bg = (r.data as { background?: CustomBackground; assets?: Project['assets'][string][] }).background;
    return bg ? TIMES_OF_DAY.filter((t) => bg.compositions?.[t]).map((t) => ({ id: `${r.id}:${t}`, label: `${r.name} · ${TIME_LABELS[t]}`, comp: bg.compositions[t] as Composition, assets: (r.data as { assets?: Project['assets'][string][] }).assets })) : [];
  });
  const [file, setFile] = useState<HTMLInputElement | null>(null);
  return (
    <div className="creator-start" data-testid="scene-start">
      <h3>{TIME_LABELS[time]}: este horário ainda não tem composição</h3>
      <p className="hint">Cada horário é opcional e tem a própria composição (não é só um filtro de cor). Escolha como começar:</p>
      <div className="creator-start-grid">
        <button type="button" className="learn-card" data-testid="start-empty" onClick={() => void startComposition(cb.id, time, { kind: 'empty' })}><Plus size={20} /><span><strong>Tela vazia</strong><small>Só o céu, para montar do zero</small></span></button>
        <button type="button" className="learn-card" data-testid="start-file" onClick={() => file?.click()}><ImagePlus size={20} /><span><strong>Imagem importada</strong><small>SVG, PNG, JPEG ou WebP como base editável</small></span></button>
        {cb.variants[time] && <button type="button" className="learn-card" data-testid="start-variant" onClick={() => void startComposition(cb.id, time, { kind: 'image-variant' })}><ImagePlus size={20} /><span><strong>Imagem já cadastrada</strong><small>Usar a imagem deste horário como base</small></span></button>}
        {others.map((t) => <button key={t} type="button" className="learn-card" data-testid={`start-copy-${t}`} onClick={() => void startComposition(cb.id, time, { kind: 'copy', from: t })}><Copy size={20} /><span><strong>Copiar de {TIME_LABELS[t]}</strong><small>Cópia editável, independente</small></span></button>)}
      </div>
      <input ref={setFile} hidden type="file" accept={IMAGE_ACCEPT} data-testid="start-file-input" onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) void startCompositionFromFile(cb.id, time, f);
      }} />
      <div className="creator-start-row">
        <SelectField label="A partir de um modelo" value="" testId="start-template" options={[{ id: '', label: 'Escolha…' }, ...SCENERY_TEMPLATES.map((t) => ({ id: t.id, label: t.label }))]} onChange={(v) => v && void startComposition(cb.id, time, { kind: 'template', id: v })} />
        <SelectField label="A partir de um cenário pronto" value="" testId="start-builtin" options={[{ id: '', label: 'Escolha…' }, ...BACKGROUNDS.filter((b) => b.id !== 'none').map((b) => ({ id: b.id, label: b.label }))]} onChange={(v) => v && void startComposition(cb.id, time, { kind: 'builtin', presetId: v, variant: time === 'night' ? 'night' : 'day' })} />
        {libComps.length > 0 && <SelectField label="Composição salva" value="" options={[{ id: '', label: 'Escolha…' }, ...libComps.map((c) => ({ id: c.id, label: c.label }))]} onChange={(v) => { const c = libComps.find((x) => x.id === v); if (c) void startComposition(cb.id, time, { kind: 'library', composition: c.comp, assets: c.assets }); }} />}
      </div>
    </div>
  );
}

export function SceneCreator() {
  const project = useProject();
  const id = useUI((s) => s.sceneCreatorId);
  const time = useUI((s) => s.sceneCreatorTime);
  const cb = project && id ? project.customBackgrounds[id] : undefined;
  if (!project || !cb) return null;
  const comp = cb.compositions[time];
  const R = CUSTOM_RECT;
  const setTime = (t: TimeOfDay) => useUI.setState({ sceneCreatorTime: t });
  const editComp = (label: string, fn: (pieces: Piece[], c: Composition) => void, coalesce?: string) => commit(label, (d) => {
    const c = (d as Project).customBackgrounds[cb.id]?.compositions[time];
    if (c) fn(c.pieces, c);
  }, coalesce ? { coalesce } : {});
  const frame = `<rect x="-960" y="-540" width="1920" height="1080" fill="none" stroke="#ffffffcc" stroke-width="5" stroke-dasharray="26 16"/><text x="-948" y="-552" font-size="30" font-family="Arial,sans-serif" fill="#ffffffcc">Quadro 16:9</text>`;
  return (
    <StudioShell testId="scene-creator" onClose={closeDialog}
      title={<><strong>Criador de Cenários</strong><TextField label="Nome" value={cb.name} testId="scenery-name" onChange={(v) => commit('Renomear cenário', (d) => { const c = d.customBackgrounds[cb.id]; if (c) c.name = v || 'Cenário'; }, { coalesce: 'cb-name' })} /><HelpLink chapter="criador-cenarios" /></>}
      actions={<>
        <button type="button" className="btn btn-sm" data-testid="scenery-save-lib" onClick={async () => {
          const assets = Object.values(cb.compositions).flatMap((c) => c?.pieces ?? []).flatMap((pc) => (pc.assetId && project.assets[pc.assetId] ? [project.assets[pc.assetId]!] : []));
          const variantAssets = Object.values(cb.variants).flatMap((v) => (v && project.assets[v.assetId] ? [project.assets[v.assetId]!] : []));
          await repo.putLibrary({ id: uid('lib'), kind: 'background', name: cb.name, favorite: 0, createdAt: Date.now(), data: { background: deepClone(cb), assets: deepClone([...assets, ...variantAssets]) } });
          toast(`"${cb.name}" salvo na sua biblioteca.`, 'success');
        }}><BookmarkPlus size={14} /> Biblioteca</button>
        <button type="button" className="btn btn-sm" data-testid="scenery-apply" disabled={!comp && !cb.variants[time]} onClick={() => { applySceneryToScene(cb, time); closeDialog(); }}><Wand2 size={14} /> Usar nesta cena</button>
      </>}
    >
      <div className="creator-strip creator-times" role="tablist" aria-label="Horários">
        {TIMES_OF_DAY.map((t) => {
          const has = cb.compositions[t] ? 'composição' : cb.variants[t] ? 'imagem' : 'vazio';
          return (
            <button key={t} type="button" role="tab" aria-selected={t === time} className={`time-tab${t === time ? ' is-active' : ''} is-${has === 'vazio' ? 'empty' : 'set'}`} data-testid={`scenery-time-${t}`} onClick={() => setTime(t)}>
              <strong>{TIME_LABELS[t]}</strong><small>{has}</small>
            </button>
          );
        })}
        {(comp || cb.variants[time]) && <button type="button" className="btn btn-sm btn-danger-ghost" data-testid="scenery-remove-time" onClick={() => void removeTime(cb.id, time)}><Trash2 size={14} /> Remover {TIME_LABELS[time]}</button>}
        {comp && <span className="creator-sky"><span>Céu</span><input type="color" aria-label="Cor do céu" value={/^#[0-9a-fA-F]{6}$/.test(comp.sky) ? comp.sky : '#9fd3f0'} onChange={(e) => editComp('Cor do céu', (_p, c) => { c.sky = e.target.value; }, 'sky')} /></span>}
      </div>
      {comp ? (
        <PieceStudio
          project={project}
          pieces={comp.pieces}
          testId="scene-studio"
          allowCharacters
          presets={SCENERY_PRESETS}
          viewBox={R}
          underlay={`<rect x="${R.x}" y="${R.y}" width="${R.w}" height="${R.h}" fill="${/^#[0-9a-fA-F]{3,8}$/.test(comp.sky) ? comp.sky : '#9fd3f0'}"/>`}
          overlay={frame}
          edit={(label, fn, coalesce) => editComp(label, (pieces) => fn(pieces, project), coalesce)}
        />
      ) : <StartPanel cb={cb} time={time} />}
    </StudioShell>
  );
}

/** Botão para abrir o criador a partir de listas. */
export function NewSceneryButton({ onCreate }: { onCreate: () => void }) {
  return <button type="button" className="btn btn-sm" data-testid="scenery-new" onClick={onCreate}><LayoutTemplate size={13} /> Criar no estúdio</button>;
}

export async function renameObjectPrompt(project: Project, objId: string) {
  const o = project.customObjects[objId];
  if (!o) return;
  const v = await promptDialog('Renomear objeto', 'Nome', o.name);
  if (v) commit('Renomear objeto', (d) => { const x = d.customObjects[objId]; if (x) x.name = v; });
}
