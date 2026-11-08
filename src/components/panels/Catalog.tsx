/**
 * Catálogo: Elenco, Cenários e Objetos são três visões da MESMA lista (features/catalog).
 * Clique no cartão = inserir na cena (fluxo rápido de sempre). O botão de detalhes abre a
 * prévia com vistas/estados, informações e todas as ações válidas para a origem do item.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus, Clapperboard, Copy, Download, FileUp, ImagePlus, Info, LayoutGrid, Lightbulb, List, Pencil, Plus, Shapes, Star, Trash2, Type, UserPlus, Wand2,
} from 'lucide-react';
import { BackgroundSchema, CharacterDefinitionSchema, type CharacterDefinition, type CustomBackground, type Project, type ViewId } from '@/engine/model/schema';
import { createLightNode, createShapeNode, createTextNode, newCharacterDefinition } from '@/engine/model/factory';
import { deepClone, uid } from '@/engine/model/ids';
import { BUILTIN_CHARACTERS } from '@/engine/character/presets';
import { getProp } from '@/engine/world/props';
import { OBJECT_PREFIX, renderCustomObject } from '@/engine/world/pieces';
import { availableTimes, createCustomBackground, renderCustomBackground, TIME_LABELS } from '@/engine/world/customBackgrounds';
import { IMAGE_ACCEPT, previewAssetUrl } from '@/features/library/assets';
import type { ObjectBundle } from '@/features/library/bundles';
import {
  buildCatalog, categoriesOf, DEFAULT_QUERY, FILTER_LABELS, ORIGIN_LABELS, queryCatalog, sectionOf, SORT_LABELS, VIEW_LABELS,
  type CatalogEntry, type CatalogFilter, type CatalogQuery, type CatalogSort, type CatalogView,
} from '@/features/catalog/catalog';
import {
  canEdit, deleteEntry, duplicateEntry, editEntry, exportEntry, insertEntry, reloadLibrary, renameEntry, saveEntryToLibrary, toggleFavorite, useLibrary,
} from '@/state/catalogActions';
import { addNodeToScene, importImage } from '@/state/actions';
import { newCustomObject, newScenery } from '@/state/creatorActions';
import { commit, useCurrentScene, useProject } from '@/state/projectStore';
import { setPref, usePrefs } from '@/state/prefs';
import { promptDialog, toast, useUI } from '@/state/uiStore';
import { repo } from '@/storage/db';
import { IconButton, MoreButton, SearchBox } from '../controls/fields';
import { ScrollStrip } from '../controls/ScrollStrip';
import { reloadPacks, usePacks } from '@/state/packActions';
import { Modal } from '../dialogs/Modal';
import { HelpLink } from '../manual/HelpLink';
import { backgroundThumbUrl, CharacterThumb, PropThumb, sceneThumbUrl } from './thumbs';
import { CustomBackgroundCard } from './CustomBackgrounds';
import { animatedTemplate } from '@/features/catalog/animatedTemplates';

const MANNEQUIN = BUILTIN_CHARACTERS[0]!;
const PAGE = 60;
const FILTERS: CatalogFilter[] = ['all', 'builtin', 'packs', 'mine', 'favorites', 'recent', 'project'];
const ORIGIN_SHORT: Record<CatalogEntry['origin'], string> = { builtin: 'Padrão', project: 'Projeto', mine: 'Meu', pack: 'Pacote' };
const SEARCH_ID: Record<CatalogView, string> = { cast: 'char-search', scenery: 'bg-search', objects: 'prop-search' };
const PLACEHOLDER: Record<CatalogView, string> = { cast: 'Buscar personagem, pose…', scenery: 'Buscar cenário', objects: 'Buscar objeto' };

/** Busca, filtros e rolagem de cada aba sobrevivem à troca de aba. */
const memory = new Map<CatalogView, { q: CatalogQuery; variant: 'day' | 'night' }>();

/* ------------------------------ miniaturas ------------------------------ */
function pseudoProject(project: Project, b: ObjectBundle | { objects: ObjectBundle['objects']; assets: ObjectBundle['assets']; object?: ObjectBundle['object'] }): Project {
  const objs = [...(('object' in b && b.object) ? [b.object] : []), ...b.objects];
  return { ...project, customObjects: { ...project.customObjects, ...Object.fromEntries(objs.map((o) => [o.id, o])) }, assets: { ...project.assets, ...Object.fromEntries(b.assets.map((a) => [a.id, a])) } };
}

const ObjectThumb = memo(function ObjectThumb({ project, id, size, anim }: { project: Project; id: string; size: number; blobs: number; anim?: { clip: string; localMs: number } }) {
  const o = project.customObjects[id];
  const html = useMemo(() => { try { return renderCustomObject(project, OBJECT_PREFIX + id, previewAssetUrl, '', anim); } catch { return ''; } }, [project, id, anim?.clip, anim?.localMs]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return <span className="cat-icon" aria-hidden="true">?</span>;
  const s = Math.max(o.width, o.height);
  return <svg className="obj-thumb" width={size} height={size} viewBox={`${-s * 0.6 - o.pivotX} ${-s * 1.1 - o.pivotY} ${s * 1.2} ${s * 1.2}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
});

const CustomBgThumb = memo(function CustomBgThumb({ project, cb, time, width }: { project: Project; cb: CustomBackground; time?: string; width: number; blobs: number }) {
  const html = useMemo(() => {
    try {
      return renderCustomBackground(project, BackgroundSchema.parse({ presetId: `custom:${cb.id}`, timeOfDay: time ?? availableTimes(cb)[0] }), previewAssetUrl);
    } catch { return ''; }
  }, [project, cb, time]);
  return <svg className="bg-thumb" width={width} height={(width * 9) / 16} viewBox="-960 -540 1920 1080" preserveAspectRatio="xMidYMid slice" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
});

function SceneMoldThumb({ project, e, width }: { project: Project; e: CatalogEntry; width: number }) {
  const url = useMemo(() => {
    if (!e.sceneData) return '';
    try { return sceneThumbUrl({ ...project, characters: { ...project.characters, ...e.sceneData.characters } }, e.sceneData.scene); } catch { return ''; }
  }, [project, e.sceneData]);
  return url ? <img className="bg-thumb" src={url} alt="" width={width} /> : <span className="cat-icon" aria-hidden="true"><Clapperboard size={22} /></span>;
}

/** Prévia tocando a animação (só na interface; a cena e a exportação usam o tempo da timeline). */
function useClock(on: boolean): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = () => { setT(performance.now() - t0); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [on]);
  return t;
}

export function EntryThumb({ e, project, size = 64, variant = 'day', state, view, full, playMs }: { e: CatalogEntry; project: Project; size?: number; variant?: 'day' | 'night'; state?: string; view?: ViewId; full?: boolean; playMs?: number }) {
  const blobs = useLibrary((s) => s.blobs);
  const libProject = useMemo(() => {
    if (e.objectBundle) return pseudoProject(project, e.objectBundle);
    if (e.ref.type === 'builtin-object') {
      const o = animatedTemplate(e.ref.tplId);
      if (o) return { ...project, customObjects: { ...project.customObjects, [o.id]: o } };
    }
    if (e.backgroundBundle) {
      const b = e.backgroundBundle;
      return { ...pseudoProject(project, b), customBackgrounds: { ...project.customBackgrounds, [b.background.id]: b.background } };
    }
    return project;
  }, [project, e.objectBundle, e.backgroundBundle, e.ref]);
  if (e.broken) return <span className="cat-icon is-broken" aria-hidden="true">!</span>;
  const wide = Math.round(size * 1.6);
  switch (e.kind) {
    case 'character': return e.character ? <CharacterThumb def={e.character} size={size} view={view} portrait={!full} /> : null;
    case 'pose': return e.pose ? <CharacterThumb def={MANNEQUIN} rig={e.pose.rig} size={size} portrait={false} /> : null;
    case 'sequence': return <span className="cat-icon" aria-hidden="true"><Clapperboard size={22} /><small>{e.sequenceSteps} passo(s)</small></span>;
    case 'prop': return <PropThumb propId={(e.ref as { propId: string }).propId} size={size} state={state} />;
    case 'object': {
      const id = e.ref.type === 'project-object' ? e.ref.id : e.ref.type === 'builtin-object' ? animatedTemplate(e.ref.tplId)?.id ?? '' : e.objectBundle?.object.id ?? '';
      return <ObjectThumb project={libProject} id={id} size={size} blobs={blobs} anim={state !== undefined || playMs !== undefined ? { clip: state ?? '', localMs: Math.floor((playMs ?? 0) / 20) * 20 } : undefined} />;
    }
    case 'background': {
      if (e.ref.type === 'builtin-background') return <img className="bg-thumb" src={backgroundThumbUrl(e.ref.presetId, (state as 'day' | 'night') ?? variant)} alt="" loading="lazy" width={wide} />;
      const cb = e.ref.type === 'project-background' ? project.customBackgrounds[e.ref.id] : e.backgroundBundle?.background;
      return cb ? <CustomBgThumb project={libProject} cb={cb} time={state} width={wide} blobs={blobs} /> : null;
    }
    case 'scene': return <SceneMoldThumb project={project} e={e} width={wide} />;
  }
}

/* ------------------------------ cartão ------------------------------ */
/** Identificadores dos cartões antigos mantidos (testes e atalhos já os usam). */
function legacyTestId(e: CatalogEntry): string {
  switch (e.ref.type) {
    case 'builtin-character': return 'builtin-character';
    case 'project-character': return 'project-character';
    case 'builtin-prop': return 'prop-card';
    case 'builtin-background': return 'bg-card';
    case 'project-object': return 'my-object';
    case 'project-background': return 'custom-bg';
    case 'builtin-object': return 'tpl-object';
    case 'pack-item': return 'pack-item';
    case 'library': return e.kind === 'object' ? 'obj-lib-row' : e.kind === 'background' ? 'cbg-lib-row' : 'catalog-card';
  }
}

function menuOf(e: CatalogEntry, openDetails: () => void) {
  const items: Array<{ label: string; onSelect: () => void; danger?: boolean }> = [];
  if (!e.broken) items.push({ label: e.kind === 'pose' || e.kind === 'sequence' ? 'Aplicar ao personagem selecionado' : e.kind === 'background' ? 'Usar nesta cena' : 'Inserir na cena', onSelect: () => void insertEntry(e) });
  items.push({ label: 'Detalhes e prévia', onSelect: openDetails });
  if (canEdit(e)) items.push({ label: e.editable ? 'Editar' : 'Criar cópia editável', onSelect: () => void editEntry(e) });
  if (e.editable && !e.broken) items.push({ label: 'Duplicar', onSelect: () => void duplicateEntry(e) });
  if (e.origin === 'project' && e.kind !== 'pose') items.push({ label: e.libId ? 'Atualizar na minha biblioteca' : 'Salvar na minha biblioteca', onSelect: () => void saveEntryToLibrary(e) });
  items.push({ label: e.favorite ? 'Tirar dos favoritos' : 'Favoritar', onSelect: () => void toggleFavorite(e) });
  if (e.editable && !e.broken) items.push({ label: 'Exportar arquivo', onSelect: () => exportEntry(e) });
  if (e.editable) items.push({ label: 'Renomear', onSelect: () => void renameEntry(e) });
  if (e.editable) items.push({ label: e.origin === 'mine' ? 'Apagar da biblioteca' : 'Remover do projeto', danger: true, onSelect: () => void deleteEntry(e) });
  return items;
}

function CatalogCard({ e, project, list, variant, active, onDetails }: { e: CatalogEntry; project: Project; list: boolean; variant: 'day' | 'night'; active: boolean; onDetails: () => void }) {
  const tid = legacyTestId(e);
  const insertLabel = e.kind === 'pose' || e.kind === 'sequence' ? `Aplicar ${e.name} ao personagem selecionado` : e.kind === 'background' || e.kind === 'scene' ? `Usar ${e.name}` : `Inserir ${e.name} na cena`;
  const extra: Record<string, string> = {};
  if (e.ref.type === 'builtin-prop') extra['data-prop'] = e.ref.propId;
  if (e.ref.type === 'builtin-background') extra['data-bg'] = e.ref.presetId;
  return (
    <div className={`card cat-card${list ? ' is-row' : ''}${active ? ' is-active' : ''}${e.broken ? ' is-broken' : ''}`} data-testid={tid} data-name={e.name} data-key={e.key} data-origin={e.origin} data-kind={e.kind} {...extra}>
      <button type="button" className="card-main" aria-label={e.broken ? `${e.name}: indisponível` : insertLabel} aria-pressed={e.kind === 'background' ? active : undefined} onClick={() => (e.broken ? onDetails() : void insertEntry(e, { variant }))}>
        <EntryThumb e={e} project={project} size={list ? 40 : e.view === 'scenery' ? 70 : 64} variant={variant} />
        <span className="cat-name">{e.favorite && <Star size={10} fill="currentColor" aria-label="favorito" />} {e.name}</span>
        {list && <small className="cat-sub">{e.category} · {ORIGIN_SHORT[e.origin]}{e.usage ? ` · ${e.usage} em uso` : ''}</small>}
      </button>
      {!list && (e.origin !== 'builtin' || e.usage > 0) && <span className={`cat-badge is-${e.origin}`} aria-hidden="true">{e.origin !== 'builtin' ? ORIGIN_SHORT[e.origin] : ''}{e.origin !== 'builtin' && e.usage ? ' · ' : ''}{e.usage ? `${e.usage} em uso` : ''}</span>}
      {e.broken && <small className="lib-error" role="alert">Formato incompatível: {e.broken}</small>}
      <div className="card-actions">
        <IconButton label={`Detalhes de ${e.name}`} testId="catalog-details-open" onClick={onDetails}><Info size={14} /></IconButton>
        {e.broken && e.origin === 'mine' && <IconButton label={`Apagar ${e.name} da biblioteca`} danger onClick={() => void deleteEntry(e)}><Trash2 size={14} /></IconButton>}
        {canEdit(e) && (
          <IconButton
            label={e.editable ? `Editar ${e.name}` : `Criar cópia editável de ${e.name}`}
            testId={e.ref.type === 'project-character' ? 'edit-character' : e.ref.type === 'project-object' ? 'my-object-edit' : 'catalog-edit'}
            onClick={() => void editEntry(e)}
          >{e.editable ? <Pencil size={14} /> : <Copy size={14} />}</IconButton>
        )}
        <MoreButton label={`Opções de ${e.name}`} items={() => menuOf(e, onDetails)} />
      </div>
    </div>
  );
}

/* ------------------------------ detalhes ------------------------------ */
const VIEWS: Array<{ id: ViewId; label: string }> = [{ id: 'front', label: 'Frente' }, { id: 'left', label: 'Esquerda' }, { id: 'right', label: 'Direita' }, { id: 'back', label: 'Costas' }];

function DetailPreview({ e, project }: { e: CatalogEntry; project: Project }) {
  if (e.broken) return <p className="lib-error" role="alert">Indisponível: {e.broken} Você pode apagar este registro.</p>;
  if (e.kind === 'character') {
    return <div className="cat-views" data-testid="catalog-views">{VIEWS.map((v) => <figure key={v.id}><EntryThumb e={e} project={project} size={84} view={v.id} full /><figcaption>{v.label}</figcaption></figure>)}</div>;
  }
  if (e.ref.type === 'project-background') {
    const cb = project.customBackgrounds[e.ref.id];
    return cb ? <CustomBackgroundCard cb={cb} /> : null;
  }
  if (e.kind === 'background') {
    const states = e.ref.type === 'builtin-background' ? e.states.map((s) => ({ id: s.id, label: s.label })) : (e.times ?? []).map((t) => ({ id: t, label: TIME_LABELS[t as keyof typeof TIME_LABELS] ?? t }));
    return <div className="cat-views is-wide" data-testid="catalog-views">{states.map((s) => <figure key={s.id}><EntryThumb e={e} project={project} size={110} state={s.id} /><figcaption>{s.label}</figcaption></figure>)}</div>;
  }
  if (e.kind === 'prop' && e.states.length) {
    return <div className="cat-views" data-testid="catalog-views">{e.states.map((s) => <figure key={s.id}><EntryThumb e={e} project={project} size={96} state={s.id} /><figcaption>{s.label}</figcaption></figure>)}</div>;
  }
  if (e.kind === 'object' && e.states.length) return <AnimatedStates e={e} project={project} />;
  if (e.kind === 'sequence') return <p className="hint">Sequência de {e.sequenceSteps} passo(s). Selecione um personagem no palco e use "Aplicar": os passos entram a partir do tempo atual e ficam editáveis na timeline.</p>;
  return <div className="cat-views is-single" data-testid="catalog-views"><figure><EntryThumb e={e} project={project} size={150} /></figure></div>;
}

function AnimatedStates({ e, project }: { e: CatalogEntry; project: Project }) {
  const [playing, setPlaying] = useState(true);
  const t = useClock(playing);
  return (
    <>
      <div className="cat-views" data-testid="catalog-views">
        {e.states.map((s) => <figure key={s.id} data-clip={s.id}><EntryThumb e={e} project={project} size={110} state={s.id} playMs={t} /><figcaption>{s.label}</figcaption></figure>)}
      </div>
      <button type="button" className="btn btn-sm" data-testid="catalog-play" aria-pressed={playing} onClick={() => setPlaying(!playing)}>{playing ? 'Pausar prévia' : 'Tocar prévia'}</button>
      <p className="hint">As animações ficam salvas no objeto: cada cópia na cena anima sozinha, também no vídeo. Velocidade e defasagem se ajustam por cópia em Propriedades → Aparência.</p>
    </>
  );
}

function policyText(e: CatalogEntry): string {
  if (e.origin === 'builtin') return 'Item padrão do app: não muda nem some. Editar cria uma cópia sua, com identidade nova, guardada neste projeto.';
  if (e.origin === 'pack') return `Item do pacote "${e.packName}": protegido. Usar copia o item (com imagens) para o projeto, então desativar ou remover o pacote não muda o projeto. Editar cria uma cópia sua.`;
  if (e.origin === 'project') return `Guardado neste projeto. Editar muda este item em todas as cenas do projeto.${e.libId ? ' Também está na sua biblioteca: "Atualizar na minha biblioteca" grava a versão atual no mesmo registro.' : ' "Salvar na minha biblioteca" deixa o item disponível em todos os projetos deste navegador.'}`;
  return 'Na sua biblioteca, disponível em todos os projetos deste navegador. Ao usar, uma cópia completa (com imagens e objetos usados) entra no projeto: apagar daqui nunca quebra um projeto.';
}

function CatalogDetails({ e, project, variant, onClose }: { e: CatalogEntry; project: Project; variant: 'day' | 'night'; onClose: () => void }) {
  const useLabel = e.kind === 'pose' || e.kind === 'sequence' ? 'Aplicar ao selecionado' : e.kind === 'background' ? 'Usar nesta cena' : e.kind === 'scene' ? 'Adicionar como nova cena' : 'Inserir na cena';
  const prop = e.ref.type === 'builtin-prop' ? getProp(e.ref.propId) : undefined;
  return (
    <Modal title={e.name} onClose={onClose} testId="catalog-details" size="md" footer={(
      <div className="cat-detail-actions">
        {!e.broken && <button type="button" className="btn btn-primary" data-testid="catalog-insert" onClick={async () => { if (await insertEntry(e, { variant })) onClose(); }}>{useLabel}</button>}
        {canEdit(e) && <button type="button" className="btn" data-testid={e.editable ? 'catalog-detail-edit' : 'catalog-copy'} onClick={async () => { await editEntry(e); onClose(); }}>{e.editable ? <><Pencil size={14} /> Editar</> : <><Copy size={14} /> Criar cópia editável</>}</button>}
        {e.editable && !e.broken && <button type="button" className="btn" data-testid="catalog-duplicate" onClick={() => void duplicateEntry(e)}><Copy size={14} /> Duplicar</button>}
        {e.origin === 'project' && <button type="button" className="btn" data-testid="catalog-save-lib" onClick={() => void saveEntryToLibrary(e)}><BookmarkPlus size={14} /> {e.libId ? 'Atualizar na biblioteca' : 'Salvar na biblioteca'}</button>}
        <button type="button" className="btn" data-testid="catalog-favorite" aria-pressed={e.favorite} onClick={() => void toggleFavorite(e)}><Star size={14} fill={e.favorite ? 'currentColor' : 'none'} /> {e.favorite ? 'Favorito' : 'Favoritar'}</button>
        {e.editable && !e.broken && <button type="button" className="btn" data-testid="catalog-export" onClick={() => exportEntry(e)}><Download size={14} /> Exportar</button>}
        {e.editable && <button type="button" className="btn" data-testid="catalog-rename" onClick={() => void renameEntry(e)}>Renomear</button>}
        {e.editable && <button type="button" className="btn btn-danger" data-testid="catalog-delete" onClick={() => void deleteEntry(e)}><Trash2 size={14} /> {e.origin === 'mine' ? 'Apagar' : 'Remover'}</button>}
      </div>
    )}>
      <div className="cat-detail" data-key={e.key} data-origin={e.origin}>
        <DetailPreview e={e} project={project} />
        <dl className="cat-info">
          <dt>Categoria</dt><dd>{e.category}</dd>
          <dt>Origem</dt><dd data-testid="catalog-origin">{ORIGIN_LABELS[e.origin]}{e.libId ? ' · também na biblioteca' : ''}</dd>
          <dt>Neste projeto</dt><dd data-testid="catalog-usage">{e.usage ? `${e.usage} uso(s)` : 'Ainda não usado'}</dd>
          {prop?.states?.length ? <><dt>Estados</dt><dd>{prop.states.map((s) => s.label).join(', ')} (mude no painel Propriedades)</dd></> : null}
        </dl>
        <p className="hint" data-testid="catalog-policy">{policyText(e)}</p>
      </div>
    </Modal>
  );
}

/* ------------------------------ painel ------------------------------ */
function FooterFor({ view, onCreatedBackground }: { view: CatalogView; onCreatedBackground: (id: string) => void }) {
  const project = useProject();
  const charFile = useRef<HTMLInputElement>(null);
  const selected = useUI((s) => s.nodeIds);
  const scene = useCurrentScene();
  if (!project || !scene) return null;
  if (view === 'cast') {
    const selChar = selected.length === 1 && scene.nodes[selected[0]!]?.kind === 'character' ? scene.nodes[selected[0]!] : null;
    return (
      <footer className="panel-footer cat-footer">
        <button type="button" className="btn btn-primary" data-testid="create-character" onClick={() => {
          const def = newCharacterDefinition(`Personagem ${Object.keys(project.characters).length + 1}`, {});
          commit('Criar personagem', (d) => { d.characters[def.id] = def; });
          useUI.setState({ dialog: 'creator', creatorCharacterId: def.id });
        }}><UserPlus size={15} /> Criar personagem</button>
          <button type="button" className="btn btn-sm" data-testid="catalog-save-pose" disabled={!selChar} title={selChar ? undefined : 'Selecione um personagem no palco'} onClick={async () => {
            if (selChar?.kind !== 'character') return;
            const name = await promptDialog('Salvar pose', 'Nome da pose', `Pose de ${selChar.name}`);
            if (!name) return;
            await repo.putLibrary({ id: uid('lib'), kind: 'pose', name, favorite: 0, createdAt: Date.now(), updatedAt: Date.now(), data: { rig: deepClone(selChar.rig), handL: selChar.handL, handR: selChar.handR } });
            await reloadLibrary();
            toast(`Pose "${name}" salva em Elenco → Poses.`, 'success');
          }}>Salvar pose</button>
          <button type="button" className="btn btn-sm" onClick={() => charFile.current?.click()}><FileUp size={14} /> Importar</button>
        <input ref={charFile} hidden type="file" accept=".json" data-testid="character-input" onChange={async (ev) => {
          const f = ev.target.files?.[0];
          ev.target.value = '';
          if (!f) return;
          try {
            const raw = JSON.parse(await f.text()) as { format?: string; character?: unknown };
            if (raw.format !== 'recorte-studio-character') throw new Error('arquivo não é um personagem do Recorte Studio');
            const parsed = CharacterDefinitionSchema.parse(raw.character);
            const copy: CharacterDefinition = { ...parsed, id: uid('char'), builtinId: undefined, spriteAssetId: undefined };
            commit('Importar personagem', (d) => { d.characters[copy.id] = copy; });
            toast(`"${copy.name}" importado.`, 'success');
          } catch (err) {
            toast(`Não foi possível importar: ${err instanceof Error ? err.message : 'erro desconhecido'}`, 'error');
          }
        }} />
      </footer>
    );
  }
  if (view === 'scenery') {
    return (
      <footer className="panel-footer cat-footer">
        <button type="button" className="btn btn-primary" data-testid="scenery-new" onClick={() => void newScenery()}><Wand2 size={15} /> Criar cenário</button>
        <button type="button" className="btn btn-sm" data-testid="custom-bg-new" onClick={async () => {
          const name = await promptDialog('Novo cenário por imagem', 'Nome do cenário', 'Meu cenário');
          if (!name) return;
          let id = '';
          commit('Criar cenário', (d) => { id = createCustomBackground(d as Project, name).id; });
          onCreatedBackground(id);
          toast('Cenário criado. Escolha os horários e importe uma imagem para cada um que quiser.');
        }}><ImagePlus size={14} /> Por imagem</button>
      </footer>
    );
  }
  return (
    <footer className="panel-footer cat-footer">
      <button type="button" className="btn btn-primary" data-testid="object-new" onClick={() => void newCustomObject()}><Plus size={15} /> Criar objeto</button>
    </footer>
  );
}

export function CatalogPanel({ view }: { view: CatalogView }) {
  const project = useProject();
  const scene = useCurrentScene();
  const records = useLibrary((s) => s.records);
  const packs = usePacks((s) => s.packs);
  const loaded = useLibrary((s) => s.loaded);
  const libError = useLibrary((s) => s.error);
  const favorites = usePrefs((s) => s.catalogFavorites);
  const recents = usePrefs((s) => s.catalogRecents);
  const layout = usePrefs((s) => s.catalogLayout);
  const saved = memory.get(view);
  const [q, setQ] = useState<CatalogQuery>(saved?.q ?? DEFAULT_QUERY);
  const [variant, setVariant] = useState<'day' | 'night'>(saved?.variant ?? 'day');
  const [detailKey, setDetailKey] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  useEffect(() => { void reloadLibrary(); void reloadPacks(); }, []);
  useEffect(() => { memory.set(view, { q, variant }); setLimit(PAGE); }, [view, q, variant]);

  const favSet = useMemo(() => new Set(favorites), [favorites]);
  const entries = useMemo(() => (project ? buildCatalog({ project, library: records, favorites: favSet, packs }) : []), [project, records, favSet, packs]);
  // O filtro "Pacotes" só existe quando há pacote ativo com itens desta aba.
  const hasPacks = entries.some((x) => x.origin === 'pack' && x.view === view);
  useEffect(() => { if (!hasPacks && q.filter === 'packs') setQ((o) => ({ ...o, filter: 'all' })); }, [hasPacks, q.filter]);
  const list = useMemo(() => queryCatalog(entries, view, q, recents), [entries, view, q, recents]);
  const cats = useMemo(() => categoriesOf(entries, view), [entries, view]);

  // Carregamento progressivo: só desenha o que está perto da área visível.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= list.length) return;
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) setLimit((l) => l + PAGE); }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, list.length]);

  if (!project || !scene) return null;
  const set = (patch: Partial<CatalogQuery>) => setQ((old) => ({ ...old, ...patch }));
  const detail = detailKey ? entries.find((x) => x.key === detailKey) : undefined;
  const shown = list.slice(0, limit);
  const grouped = q.sort === 'default' && q.filter !== 'recent';
  const groups: Array<[string, CatalogEntry[]]> = [];
  if (grouped) for (const e of shown) {
    const g = sectionOf(e);
    const last = groups[groups.length - 1];
    if (last && last[0] === g) last[1].push(e);
    else groups.push([g, [e]]);
  } else groups.push(['', shown]);
  const activeBg = scene.background.presetId;
  const isActive = (e: CatalogEntry) => (e.ref.type === 'builtin-background' && activeBg === e.ref.presetId) || (e.ref.type === 'project-background' && activeBg === `custom:${e.ref.id}`);
  const isList = layout === 'list';
  const emptyText = q.text ? 'Nada encontrado com esse termo.' : q.filter === 'favorites' ? 'Nenhum favorito aqui ainda. Use a estrela nos detalhes de um item.' : q.filter === 'recent' ? 'Nada usado recentemente nesta aba.' : q.filter === 'mine' ? 'Você ainda não criou nem salvou nada aqui. Use o botão de criar abaixo.' : q.filter === 'project' ? 'Nada desta aba está em uso neste projeto.' : 'Nada nesta categoria.';

  return (
    <div className={`panel-col catalog is-${view}`} data-testid={view === 'cast' ? 'characters-panel' : view === 'scenery' ? 'backgrounds-panel' : 'objects-panel'} data-catalog={view}>
      <header className="panel-header">
        <h2>{VIEW_LABELS[view].toUpperCase()}</h2>
        <span className="count" data-testid="catalog-count" aria-label={`${list.length} itens`}>{list.length}</span>
        <span className="spacer" />
        <HelpLink chapter="catalogo" />
        <IconButton label={isList ? 'Ver em grade' : 'Ver em lista'} testId="catalog-layout" onClick={() => setPref('catalogLayout', isList ? 'grid' : 'list')}>{isList ? <LayoutGrid size={14} /> : <List size={14} />}</IconButton>
      </header>
      <div className="panel-sub cat-sub-head">
        <SearchBox value={q.text} onChange={(text) => set({ text })} placeholder={PLACEHOLDER[view]} testId={SEARCH_ID[view]} />
        <ScrollStrip className="chip-row" role="group" ariaLabel="Origem" testId="catalog-filters" watch={q.filter}>
          {FILTERS.filter((f) => f !== 'packs' || hasPacks).map((f) => (
            <button key={f} type="button" className={`chip${q.filter === f ? ' is-active' : ''}`} aria-pressed={q.filter === f} data-filter={f} onClick={() => set({ filter: f })}>{f === 'favorites' && <Star size={11} />}{FILTER_LABELS[f]}</button>
          ))}
        </ScrollStrip>
        <div className="cat-row2">
          <select className="cat-select" aria-label="Categoria" data-testid="catalog-category" value={q.category ?? ''} onChange={(ev) => set({ category: ev.target.value || null })}>
            <option value="">Todas as categorias</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.id} ({c.count})</option>)}
          </select>
          <select className="cat-select" aria-label="Ordenar" data-testid="catalog-sort" value={q.sort} onChange={(ev) => set({ sort: ev.target.value as CatalogSort })}>
            {(Object.keys(SORT_LABELS) as CatalogSort[]).map((s) => <option key={s} value={s}>{SORT_LABELS[s]}</option>)}
          </select>
          {view === 'scenery' && (
            <span className="chip-row" role="group" aria-label="Horário dos cenários padrão">
              <button type="button" className={`chip${variant === 'day' ? ' is-active' : ''}`} aria-pressed={variant === 'day'} onClick={() => setVariant('day')}>Dia</button>
              <button type="button" className={`chip${variant === 'night' ? ' is-active' : ''}`} aria-pressed={variant === 'night'} onClick={() => setVariant('night')}>Noite</button>
            </span>
          )}
        </div>
        {view === 'objects' && (
          <div className="cat-quick">
            <button type="button" className="btn btn-sm" data-testid="add-text" onClick={() => addNodeToScene(createTextNode('Seu texto'), 'Adicionar texto')}><Type size={14} /> Texto</button>
            <button type="button" className="btn btn-sm" onClick={() => addNodeToScene(createShapeNode('rect'), 'Adicionar forma')}><Shapes size={14} /> Forma</button>
            <button type="button" className="btn btn-sm" onClick={() => addNodeToScene(createLightNode(), 'Adicionar luz')}><Lightbulb size={14} /> Luz</button>
            <button type="button" className="btn btn-sm" data-testid="import-image" onClick={() => imgRef.current?.click()}><ImagePlus size={14} /> Imagem</button>
            <input ref={imgRef} hidden type="file" accept={IMAGE_ACCEPT} data-testid="image-input" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) void importImage(f); ev.target.value = ''; }} />
          </div>
        )}
      </div>
      <div className="panel-scroll" data-testid="catalog-scroll">
        {!loaded && <p className="hint" role="status">Carregando sua biblioteca…</p>}
        {libError && <p className="lib-error" role="alert">Não foi possível ler sua biblioteca neste navegador: {libError}. Os itens padrão e os do projeto continuam disponíveis.</p>}
        {groups.map(([g, items]) => (
          <section key={g || 'all'} className="cat-group">
            {g && <h3 className="group-title">{g}</h3>}
            <div className={isList ? 'cat-list' : `card-grid${view === 'scenery' ? ' is-wide' : ''}`}>
              {items.map((e) => <CatalogCard key={e.key} e={e} project={project} list={isList} variant={variant} active={isActive(e)} onDetails={() => setDetailKey(e.key)} />)}
            </div>
          </section>
        ))}
        {list.length === 0 && <p className="empty" data-testid="catalog-empty">{emptyText}</p>}
        {limit < list.length && <div ref={sentinel} className="cat-more"><button type="button" className="btn btn-sm" onClick={() => setLimit((l) => l + PAGE)}>Mostrar mais ({list.length - limit})</button></div>}
      </div>
      <FooterFor view={view} onCreatedBackground={(id) => setDetailKey(`project:background:${id}`)} />
      {detail && <CatalogDetails e={detail} project={project} variant={variant} onClose={() => setDetailKey(null)} />}
    </div>
  );
}

export const CastPanel = () => <CatalogPanel view="cast" />;
export const SceneryPanel = () => <CatalogPanel view="scenery" />;
export const ObjectsCatalogPanel = () => <CatalogPanel view="objects" />;
