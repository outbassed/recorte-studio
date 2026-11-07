/** Painéis da esquerda (e dos popups no celular). */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Copy, Eye, EyeOff, FileUp, Group, ImagePlus, Lightbulb, Lock, LockOpen, Pencil, Plus, Shapes, Sparkles, Star, Trash2, Type, Ungroup, UserPlus,
} from 'lucide-react';
import { createLightNode, createProject, createScene, createShapeNode, createTextNode, newCharacterDefinition } from '@/engine/model/factory';
import { applySequence, type Sequence } from '@/engine/model/ops';
import { addScene as addSceneOp, applyBackground, characterUsage, countSceneActions, deleteCharacter, deleteNode, duplicateNode, groupNodes, moveLayer, moveScene, pasteSceneContent, replaceSceneContent, sceneOf, ungroup } from '@/engine/model/ops';
import { uid, deepClone } from '@/engine/model/ids';
import { CharacterDefinitionSchema, type CharacterDefinition, type Project, type Scene, type SceneNode } from '@/engine/model/schema';
import { BACKGROUNDS } from '@/engine/world/backgrounds';
import { PROPS, PROP_CATEGORY_LABELS, type PropDef } from '@/engine/world/props';
import { BUILTIN_CHARACTERS } from '@/engine/character/presets';
import { applyPlan, describePlan, type Plan } from '@/features/ai/plan';
import { listOllamaModels, ollamaAdapter, proxyAdapter, quickAdapter, AIError, type AIAdapter } from '@/features/ai/adapters';
import { matchesSearch } from '@/features/library/search';
import { IMAGE_ACCEPT } from '@/features/library/assets';
import { SCENE_TEMPLATES, buildTemplateScene } from '@/features/templates/scenes';
import { PROJECT_TEMPLATES, createFromProjectTemplate } from '@/features/templates/projects';
import { createAndOpen } from '@/features/projects/session';
import { addNodeToScene, addScene, importImage, placeBuiltin, placeCharacter, placeProp, requestDeleteScene, switchScene } from '@/state/actions';
import { commit, currentProject, useCurrentScene, useProject } from '@/state/projectStore';
import { seek, transport } from '@/state/transport';
import { confirmDialog, openContextMenu, promptDialog, selectNodes, toast, useUI } from '@/state/uiStore';
import { repo, type LibraryRecord } from '@/storage/db';
import { IconButton, MoreButton, SearchBox, SelectField, TextField, useLongPress, VirtualList } from '../controls/fields';
import { backgroundThumbUrl, CharacterThumb, PropThumb, SceneThumb } from './thumbs';
import { formatTime } from '../timeline/Timeline';
import { MediaPanel } from './MediaPanel';
import { CustomBackgroundsSection } from './CustomBackgrounds';

/* ---------------------------------- CENAS ---------------------------------- */
let sceneClipboard: Scene | null = null;

function SceneRow({ id, index, project, current, order }: { id: string; index: number; project: Project; current: Scene; order: string[] }) {
    const scene = project.scenes[id];
    const lp = useLongPress((x, y) => openContextMenu({ x, y, title: scene?.name, items: menu() }));
    if (!scene) return null;
    const menu = () => [
      { label: 'Renomear', onSelect: async () => {
        const v = await promptDialog('Renomear cena', 'Nome', scene.name);
        if (v) commit('Renomear cena', (d) => { sceneOf(d as Project, id).name = v; });
      } },
      { label: 'Duplicar', onSelect: () => { switchScene(id); addScene('duplicate'); } },
      { label: 'Copiar conteúdo', onSelect: () => { sceneClipboard = deepClone(scene); toast('Conteúdo copiado.'); } },
      { label: 'Colar conteúdo aqui', disabled: !sceneClipboard, onSelect: () => { const c = sceneClipboard; if (c) commit('Colar conteúdo', (d) => pasteSceneContent(d as Project, id, c)); } },
      { label: 'Subir', disabled: index === 0, onSelect: () => commit('Mover cena', (d) => void moveScene(d as Project, id, -1)) },
      { label: 'Descer', disabled: index === order.length - 1, onSelect: () => commit('Mover cena', (d) => void moveScene(d as Project, id, 1)) },
      { label: 'Excluir', danger: true, disabled: order.length <= 1, onSelect: () => void requestDeleteScene(id) },
    ];
    const active = id === current.id;
    return (
      <div className={`scene-row${active ? ' is-active' : ''}`} data-testid="scene-row" data-scene-id={id} aria-current={active ? 'true' : undefined} onContextMenu={(e) => { e.preventDefault(); openContextMenu({ x: e.clientX, y: e.clientY, title: scene.name, items: menu() }); }} {...lp}>
        <button type="button" className="scene-open" aria-label={`Abrir cena ${index + 1}: ${scene.name}`} onClick={() => switchScene(id)}>
          <span className="scene-index">{index + 1}</span>
          <SceneThumb project={project} scene={scene} />
          <span className="scene-info">
            <strong>{scene.name}</strong>
            <small>{formatTime(scene.durationMs).slice(0, 5)} · {countSceneActions(scene)} ações</small>
          </span>
        </button>
        <div className="scene-actions">
          <IconButton label="Mover cena para cima" testId="scene-up" disabled={index === 0} onClick={() => commit('Mover cena', (d) => void moveScene(d as Project, id, -1))}><ArrowUp size={15} /></IconButton>
          <IconButton label="Mover cena para baixo" testId="scene-down" disabled={index === order.length - 1} onClick={() => commit('Mover cena', (d) => void moveScene(d as Project, id, 1))}><ArrowDown size={15} /></IconButton>
          <IconButton label="Excluir cena" testId="scene-delete" danger disabled={order.length <= 1} onClick={() => void requestDeleteScene(id)}><Trash2 size={15} /></IconButton>
          <MoreButton label={`Opções da cena ${scene.name}`} items={menu} />
        </div>
      </div>
    );
}

export function ScenesPanel() {
  const project = useProject();
  const current = useCurrentScene();
  const itemH = 84;
  if (!project || !current) return null;
  const order = project.sceneOrder;
  return (
    <div className="panel-col" data-testid="scenes-panel">
      <header className="panel-header">
        <h2>CENAS DO PROJETO</h2>
        <span className="count" data-testid="scene-count">{order.length}</span>
      </header>
      <VirtualList
        className="panel-scroll"
        testId="scene-list"
        items={order}
        itemHeight={itemH}
        keyOf={(id) => id}
        renderItem={(id, i) => <SceneRow id={id} index={i} project={project} current={current} order={order} />}
      />
      <footer className="panel-footer" data-testid="scene-footer">
        <button type="button" className="btn btn-block" data-testid="duplicate-scene" onClick={() => addScene('duplicate')}><Copy size={15} /> + Duplicar cena atual</button>
        <button type="button" className="btn btn-primary btn-block" data-testid="empty-scene" onClick={() => addScene('empty')}><Plus size={15} /> + Criar cena vazia</button>
      </footer>
    </div>
  );
}

/* ---------------------------------- CAMADAS ---------------------------------- */
function LayerRow({ id, scene, selection, mv, setNode, del }: { id: string; scene: Scene; selection: string[]; mv: (id: string, how: 'up' | 'down' | 'top' | 'bottom') => void; setNode: (id: string, label: string, fn: (n: SceneNode) => void) => void; del: (id: string) => Promise<void> }) {
    const node = scene.nodes[id]!;
    const i = scene.layerOrder.indexOf(id);
    const top = i === scene.layerOrder.length - 1;
    const bottom = i === 0;
    const menu = () => [
      { label: 'Renomear', onSelect: async () => {
        const v = await promptDialog('Renomear camada', 'Nome', node.name);
        if (v) setNode(id, 'Renomear', (n) => { n.name = v; });
      } },
      { label: 'Duplicar', onSelect: async () => {
        let nid: string | null = null;
        commit('Duplicar camada', (d) => { nid = duplicateNode(sceneOf(d as Project, scene.id), id); });
        if (nid) selectNodes([nid]);
      } },
      { label: 'Trazer para a frente', disabled: top, onSelect: () => mv(id, 'top') },
      { label: 'Enviar para o fundo', disabled: bottom, onSelect: () => mv(id, 'bottom') },
      ...(node.kind === 'group' ? [{ label: 'Desagrupar', onSelect: () => commit('Desagrupar', (d) => void ungroup(sceneOf(d as Project, scene.id), id)) }] : []),
      { label: 'Excluir', danger: true, onSelect: () => void del(id) },
    ];
    const lp = useLongPress((x, y) => openContextMenu({ x, y, title: node.name, items: menu() }));
    const selected = selection.includes(id);
    return (
      <div className={`layer-row${selected ? ' is-selected' : ''}${node.visible ? '' : ' is-hidden'}`} data-testid="layer-row" data-node-name={node.name} aria-selected={selected} onContextMenu={(e) => { e.preventDefault(); openContextMenu({ x: e.clientX, y: e.clientY, title: node.name, items: menu() }); }} {...lp}>
        <button type="button" className="layer-name" title={node.name} onClick={(e) => selectNodes(e.shiftKey ? (selected ? selection.filter((x) => x !== id) : [...selection, id]) : [id])}>
          {selected && <span className="sel-mark" aria-hidden="true">●</span>}
          <span>{node.name}</span>
          {node.locked && <small> (bloqueada)</small>}
        </button>
        <IconButton label={node.visible ? 'Ocultar camada' : 'Mostrar camada'} testId="layer-visible" active={!node.visible} onClick={() => setNode(id, 'Visibilidade', (n) => { n.visible = !n.visible; })}>{node.visible ? <Eye size={15} /> : <EyeOff size={15} />}</IconButton>
        <IconButton label={node.locked ? 'Desbloquear camada' : 'Bloquear camada'} testId="layer-lock" active={node.locked} onClick={() => setNode(id, 'Bloqueio', (n) => { n.locked = !n.locked; })}>{node.locked ? <Lock size={15} /> : <LockOpen size={15} />}</IconButton>
        <IconButton label="Subir camada uma posição" testId="layer-up" disabled={top} onClick={() => mv(id, 'up')}><ArrowUp size={15} /></IconButton>
        <IconButton label="Descer camada uma posição" testId="layer-down" disabled={bottom} onClick={() => mv(id, 'down')}><ArrowDown size={15} /></IconButton>
        <IconButton label="Excluir camada" testId="layer-delete" danger onClick={() => void del(id)}><Trash2 size={15} /></IconButton>
        <MoreButton label={`Opções de ${node.name}`} items={menu} />
      </div>
    );
}

export function LayersPanel() {
  const scene = useCurrentScene();
  const selection = useUI((s) => s.nodeIds);
  const [query, setQuery] = useState('');
  if (!scene) return null;
  const order = [...scene.layerOrder].reverse().filter((id) => scene.nodes[id]);
  const filtered = order.filter((id) => matchesSearch(query, scene.nodes[id]?.name));
  const mv = (id: string, how: 'up' | 'down' | 'top' | 'bottom') => commit('Mover camada', (d) => void moveLayer(sceneOf(d as Project, scene.id), id, how));
  const setNode = (id: string, label: string, fn: (n: SceneNode) => void) => commit(label, (d) => {
    const n = sceneOf(d as Project, scene.id).nodes[id];
    if (n) fn(n);
  });
  const del = async (id: string) => {
    const name = scene.nodes[id]?.name;
    const ok = await confirmDialog({ title: 'Excluir camada', message: `Excluir "${name}"? Ctrl+Z desfaz.`, confirmLabel: 'Excluir', danger: true });
    if (!ok) return;
    commit('Excluir camada', (d) => void deleteNode(sceneOf(d as Project, scene.id), id));
    useUI.setState({ nodeIds: selection.filter((x) => x !== id) });
  };
  return (
    <div className="panel-col" data-testid="layers-panel">
      <header className="panel-header">
        <h2>CAMADAS</h2>
        <span className="count" data-testid="layer-count">{order.length}</span>
      </header>
      <div className="panel-sub">
        <p className="hint">O topo da lista fica na FRENTE. A exportação usa esta mesma ordem.</p>
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar camada" />
      </div>
      <div className="panel-scroll" data-testid="layer-list">
        {filtered.length === 0 && <p className="empty">{order.length ? 'Nada encontrado.' : 'Cena vazia. Adicione personagens ou objetos pelas outras abas.'}</p>}
        {filtered.map((id) => <LayerRow key={id} id={id} scene={scene} selection={selection} mv={mv} setNode={setNode} del={del} />)}
      </div>
      <footer className="panel-footer is-row">
        <button type="button" className="btn btn-sm" title="Trazer selecionada para a frente" disabled={selection.length !== 1} onClick={() => mv(selection[0]!, 'top')}><ChevronsUp size={14} /> Frente</button>
        <button type="button" className="btn btn-sm" title="Enviar selecionada para o fundo" disabled={selection.length !== 1} onClick={() => mv(selection[0]!, 'bottom')}><ChevronsDown size={14} /> Fundo</button>
        <button type="button" className="btn btn-sm" disabled={selection.length < 2} onClick={() => {
          let gid: string | null = null;
          commit('Agrupar', (d) => { gid = groupNodes(sceneOf(d as Project, scene.id), selection); });
          if (gid) selectNodes([gid]);
        }}><Group size={14} /> Agrupar</button>
        <button type="button" className="btn btn-sm" disabled={!(selection.length === 1 && scene.nodes[selection[0]!]?.kind === 'group')} onClick={() => {
          const id = selection[0]!;
          commit('Desagrupar', (d) => void ungroup(sceneOf(d as Project, scene.id), id));
          selectNodes([]);
        }}><Ungroup size={14} /> Separar</button>
      </footer>
    </div>
  );
}

/* ---------------------------------- PERSONAGENS ---------------------------------- */
export function CharactersPanel() {
  const project = useProject();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites'>('all');
  const [userLib, setUserLib] = useState<LibraryRecord[]>([]);
  const charFile = useRef<HTMLInputElement>(null);
  useEffect(() => { void repo.listLibrary('character').then(setUserLib); }, []);
  if (!project) return null;
  const projectChars = Object.values(project.characters).filter((c) => matchesSearch(query, c.name) && (filter === 'all' || c.favorite));
  const builtins = BUILTIN_CHARACTERS.filter((b) => !Object.values(project.characters).some((c) => c.builtinId === b.builtinId)).filter((c) => matchesSearch(query, c.name, c.hair.style, c.outfit.top));
  const create = () => {
    const def = newCharacterDefinition(`Personagem ${Object.keys(project.characters).length + 1}`, {});
    commit('Criar personagem', (d) => { d.characters[def.id] = def; });
    useUI.setState({ dialog: 'creator', creatorCharacterId: def.id });
  };
  const menu = (c: CharacterDefinition) => [
    { label: 'Colocar na cena', onSelect: () => placeCharacter(c.id) },
    { label: 'Editar no criador', onSelect: () => useUI.setState({ dialog: 'creator', creatorCharacterId: c.id }) },
    { label: 'Duplicar', onSelect: () => {
      const copy: CharacterDefinition = { ...deepClone(c), id: uid('char'), name: `${c.name} (cópia)`, builtinId: undefined };
      commit('Duplicar personagem', (d) => { d.characters[copy.id] = copy; });
    } },
    { label: c.favorite ? 'Tirar dos favoritos' : 'Favoritar', onSelect: () => commit('Favoritar', (d) => { d.characters[c.id]!.favorite = !c.favorite; }) },
    { label: 'Salvar na minha biblioteca', onSelect: async () => {
      await repo.putLibrary({ id: uid('lib'), kind: 'character', name: c.name, favorite: 0, createdAt: Date.now(), data: { ...deepClone(c), builtinId: undefined } });
      setUserLib(await repo.listLibrary('character'));
      toast('Salvo na sua biblioteca, disponível em todos os projetos.', 'success');
    } },
    { label: 'Remover do projeto', danger: true, onSelect: async () => {
      const used = characterUsage(currentProject(), c.id);
      if (used > 0) {
        toast(`"${c.name}" está em uso em ${used} instância(s). Exclua as instâncias nas cenas antes de remover.`, 'error');
        return;
      }
      const ok = await confirmDialog({ title: 'Remover personagem', message: `Remover "${c.name}" da biblioteca do projeto?`, confirmLabel: 'Remover', danger: true });
      if (ok) commit('Remover personagem', (d) => void deleteCharacter(d as Project, c.id));
    } },
  ];
  return (
    <div className="panel-col" data-testid="characters-panel">
      <header className="panel-header"><h2>PERSONAGENS</h2><span className="count">{Object.keys(project.characters).length + builtins.length}</span></header>
      <div className="panel-sub">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar personagem" testId="char-search" />
        <div className="chip-row">
          <button type="button" className={`chip${filter === 'all' ? ' is-active' : ''}`} onClick={() => setFilter('all')}>Todos</button>
          <button type="button" className={`chip${filter === 'favorites' ? ' is-active' : ''}`} onClick={() => setFilter('favorites')}><Star size={12} /> Favoritos</button>
        </div>
      </div>
      <div className="panel-scroll">
        {projectChars.length > 0 && <h3 className="group-title">Neste projeto</h3>}
        <div className="card-grid">
          {projectChars.map((c) => (
            <div key={c.id} className="card" data-testid="project-character" data-name={c.name}>
              <button type="button" className="card-main" aria-label={`Colocar ${c.name} na cena`} onClick={() => placeCharacter(c.id)}>
                <CharacterThumb def={c} size={72} />
                <span>{c.favorite && <Star size={10} fill="currentColor" />} {c.name}</span>
              </button>
              <div className="card-actions">
                <IconButton label={`Editar ${c.name}`} testId="edit-character" onClick={() => useUI.setState({ dialog: 'creator', creatorCharacterId: c.id })}><Pencil size={14} /></IconButton>
                <MoreButton label={`Opções de ${c.name}`} items={() => menu(c)} />
              </div>
            </div>
          ))}
        </div>
        {userLib.length > 0 && <h3 className="group-title">Minha biblioteca</h3>}
        <div className="card-grid">
          {userLib.filter((r) => matchesSearch(query, r.name)).map((r) => {
            const def = r.data as CharacterDefinition;
            return (
              <div key={r.id} className="card">
                <button type="button" className="card-main" aria-label={`Trazer ${r.name} para o projeto`} onClick={() => {
                  const copy: CharacterDefinition = { ...deepClone(def), id: uid('char') };
                  commit('Trazer da biblioteca', (d) => { d.characters[copy.id] = copy; });
                  placeCharacter(copy.id);
                }}><CharacterThumb def={def} size={72} /><span>{r.name}</span></button>
                <div className="card-actions">
                  <IconButton label={`Apagar ${r.name} da biblioteca`} danger onClick={async () => {
                    const ok = await confirmDialog({ title: 'Apagar da biblioteca', message: `Apagar "${r.name}"? Os projetos que já o usam não mudam.`, confirmLabel: 'Apagar', danger: true });
                    if (ok) {
                      await repo.deleteLibrary(r.id);
                      setUserLib(await repo.listLibrary('character'));
                    }
                  }}><Trash2 size={14} /></IconButton>
                </div>
              </div>
            );
          })}
        </div>
        {builtins.length > 0 && <h3 className="group-title">Elenco pronto</h3>}
        <div className="card-grid">
          {builtins.map((c) => (
            <button key={c.builtinId} type="button" className="card card-main" data-testid="builtin-character" data-name={c.name} aria-label={`Colocar ${c.name} na cena`} onClick={() => placeBuiltin(c.builtinId!)}>
              <CharacterThumb def={c} size={72} />
              <span>{c.name}</span>
            </button>
          ))}
        </div>
      </div>
      <footer className="panel-footer">
        <button type="button" className="btn btn-primary btn-block" data-testid="create-character" onClick={create}><UserPlus size={15} /> Criar personagem</button>
        <button type="button" className="btn btn-sm btn-block" onClick={() => charFile.current?.click()}><FileUp size={14} /> Importar personagem (.json)</button>
        <input ref={charFile} hidden type="file" accept=".json" data-testid="character-input" onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
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
    </div>
  );
}

/* ---------------------------------- CENÁRIOS ---------------------------------- */
export function BackgroundsPanel() {
  const scene = useCurrentScene();
  const [query, setQuery] = useState('');
  const [variant, setVariant] = useState<'day' | 'night'>('day');
  if (!scene) return null;
  const list = BACKGROUNDS.filter((b) => matchesSearch(query, b.label, b.keywords, b.group));
  const groups = [...new Set(list.map((b) => b.group))];
  return (
    <div className="panel-col" data-testid="backgrounds-panel">
      <header className="panel-header"><h2>CENÁRIOS</h2><span className="count">{BACKGROUNDS.length}</span></header>
      <div className="panel-sub">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar cenário" testId="bg-search" />
        <div className="chip-row">
          <button type="button" className={`chip${variant === 'day' ? ' is-active' : ''}`} onClick={() => setVariant('day')}>Dia</button>
          <button type="button" className={`chip${variant === 'night' ? ' is-active' : ''}`} onClick={() => setVariant('night')}>Noite</button>
        </div>
      </div>
      <div className="panel-scroll">
        <CustomBackgroundsSection />
        {groups.map((g) => (
          <div key={g}>
            <h3 className="group-title">{g}</h3>
            <div className="card-grid is-wide">
              {list.filter((b) => b.group === g).map((b) => (
                <button key={b.id} type="button" className={`card card-main${scene.background.presetId === b.id ? ' is-active' : ''}`} data-testid="bg-card" data-bg={b.id} aria-pressed={scene.background.presetId === b.id} onClick={() => {
                  commit('Trocar cenário', (d) => applyBackground(sceneOf(d as Project, scene.id), b.id, { variant }));
                  toast(`Cenário: ${b.label}. Móveis viraram camadas editáveis.`);
                }}>
                  <img src={backgroundThumbUrl(b.id, variant)} alt="" loading="lazy" className="bg-thumb" />
                  <span>{b.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="empty">Nenhum cenário com esse termo.</p>}
      </div>
    </div>
  );
}

/* ---------------------------------- OBJETOS ---------------------------------- */
export function ObjectsPanel() {
  const [query, setQuery] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const list = PROPS.filter((p) => matchesSearch(query, p.label, p.keywords, PROP_CATEGORY_LABELS[p.category]));
  const cats = [...new Set(list.map((p) => p.category))] as PropDef['category'][];
  return (
    <div className="panel-col" data-testid="objects-panel">
      <header className="panel-header"><h2>OBJETOS</h2><span className="count">{PROPS.length}</span></header>
      <div className="panel-sub">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar objeto" testId="prop-search" />
        <div className="btn-row">
          <button type="button" className="btn btn-sm" data-testid="add-text" onClick={() => addNodeToScene(createTextNode('Seu texto'), 'Adicionar texto')}><Type size={14} /> Texto</button>
          <button type="button" className="btn btn-sm" onClick={() => addNodeToScene(createShapeNode('rect'), 'Adicionar forma')}><Shapes size={14} /> Forma</button>
          <button type="button" className="btn btn-sm" onClick={() => addNodeToScene(createLightNode(), 'Adicionar luz')}><Lightbulb size={14} /> Luz</button>
          <button type="button" className="btn btn-sm" data-testid="import-image" onClick={() => fileRef.current?.click()}><ImagePlus size={14} /> Imagem</button>
        </div>
        <input ref={fileRef} hidden type="file" accept={IMAGE_ACCEPT} data-testid="image-input" onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void importImage(f);
          e.target.value = '';
        }} />
      </div>
      <div className="panel-scroll">
        {cats.map((cat) => (
          <div key={cat}>
            <h3 className="group-title">{PROP_CATEGORY_LABELS[cat]}</h3>
            <div className="card-grid">
              {list.filter((p) => p.category === cat).map((p) => (
                <button key={p.id} type="button" className="card card-main" data-testid="prop-card" data-prop={p.id} aria-label={`Adicionar ${p.label}`} onClick={() => placeProp(p.id)}>
                  <PropThumb propId={p.id} size={58} />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="empty">Nenhum objeto com esse termo.</p>}
      </div>
    </div>
  );
}

/* ---------------------------------- TEMPLATES ---------------------------------- */
export function TemplatesPanel() {
  const project = useProject();
  const current = useCurrentScene();
  const [query, setQuery] = useState('');
  if (!project || !current) return null;
  const list = SCENE_TEMPLATES.filter((t) => matchesSearch(query, t.name, t.keywords, t.category));
  const addFromTemplate = (id: string) => {
    let name = '';
    commit('Adicionar cena do template', (d) => {
      const scene = buildTemplateScene(d as Project, id);
      name = scene.name;
      addSceneOp(d as Project, scene, (d as Project).currentSceneId);
    });
    seek(0);
    toast(`Cena "${name}" adicionada.`);
  };
  const replaceCurrent = async (id: string) => {
    const ok = await confirmDialog({ title: 'Substituir cena atual', message: `Isto troca o conteúdo de "${current.name}" pelo template. Ctrl+Z desfaz.`, confirmLabel: 'Substituir', danger: true });
    if (!ok) return;
    commit('Substituir cena pelo template', (d) => {
      const scene = buildTemplateScene(d as Project, id);
      replaceSceneContent(d as Project, current.id, scene);
    });
    useUI.setState({ nodeIds: [], timeline: null });
    seek(0);
  };
  const newProject = async (id: string) => {
    const name = SCENE_TEMPLATES.find((t) => t.id === id)?.name ?? 'Novo projeto';
    const p = createProject(name, { width: project.settings.width, height: project.settings.height, aspect: project.settings.aspectRatio });
    const scene = buildTemplateScene(p, id);
    p.scenes = { [scene.id]: scene };
    p.sceneOrder = [scene.id];
    p.currentSceneId = scene.id;
    await createAndOpen(p);
  };
  const cats = [...new Set(list.map((t) => t.category))];
  return (
    <div className="panel-col" data-testid="templates-panel">
      <header className="panel-header"><h2>TEMPLATES</h2><span className="count">{SCENE_TEMPLATES.length}</span></header>
      <div className="panel-sub">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar template" testId="template-search" />
      </div>
      <div className="panel-scroll">
        {cats.map((cat) => (
          <div key={cat}>
            <h3 className="group-title">{cat}</h3>
            {list.filter((t) => t.category === cat).map((t) => (
              <div key={t.id} className="tpl-row" data-testid="template-row" data-template={t.id}>
                <img src={backgroundThumbUrl(t.background)} alt="" loading="lazy" className="tpl-thumb" />
                <div className="tpl-body">
                  <strong>{t.name}</strong>
                  <small>{(t.durationMs / 1000).toLocaleString('pt-BR')} s</small>
                  <div className="btn-row">
                    <button type="button" className="btn btn-sm btn-primary" data-testid="template-add" onClick={() => addFromTemplate(t.id)}>Adicionar cena</button>
                    <MoreButton label={`Mais opções de ${t.name}`} items={() => [
                      { label: 'Substituir cena atual', onSelect: () => void replaceCurrent(t.id) },
                      { label: 'Criar projeto novo', onSelect: () => void newProject(t.id) },
                    ]} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <h3 className="group-title">Modelos de projeto</h3>
        {PROJECT_TEMPLATES.filter((t) => matchesSearch(query, t.name, t.description)).map((t) => (
          <div key={t.id} className="tpl-row" data-testid="project-template">
            <div className="tpl-body">
              <strong>{t.name}</strong>
              <small>{t.description} ({t.aspect})</small>
              <button type="button" className="btn btn-sm" onClick={() => void createAndOpen(createFromProjectTemplate(t.id))}>Criar projeto novo</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- BIBLIOTECA ---------------------------------- */
export function LibraryPanel() {
  const project = useProject();
  const scene = useCurrentScene();
  const [items, setItems] = useState<LibraryRecord[]>([]);
  const [query, setQuery] = useState('');
  const reload = () => void repo.listLibrary().then(setItems);
  useEffect(reload, []);
  const fileRef = useRef<HTMLInputElement>(null);
  if (!project || !scene) return null;
  const filtered = items.filter((i) => matchesSearch(query, i.name, i.kind)).sort((a, b) => b.favorite - a.favorite || b.createdAt - a.createdAt);
  const label = { character: 'Personagem', scene: 'Cena', pose: 'Pose', background: 'Cenário', animation: 'Sequência', prop: 'Objeto', audio: 'Áudio' } as const;
  const saveScene = async () => {
    await repo.putLibrary({ id: uid('lib'), kind: 'scene', name: scene.name, favorite: 0, createdAt: Date.now(), data: { scene: deepClone(scene), characters: deepClone(project.characters) } });
    reload();
    toast('Cena salva na sua biblioteca.', 'success');
  };
  const savePose = async () => {
    const id = useUI.getState().nodeIds[0];
    const n = id ? scene.nodes[id] : undefined;
    if (n?.kind !== 'character') {
      toast('Selecione um personagem para salvar a pose dele.', 'error');
      return;
    }
    const name = await promptDialog('Salvar pose', 'Nome da pose', 'Minha pose');
    if (!name) return;
    await repo.putLibrary({ id: uid('lib'), kind: 'pose', name, favorite: 0, createdAt: Date.now(), data: { rig: deepClone(n.rig), handL: n.handL, handR: n.handR } });
    reload();
  };
  const use = (r: LibraryRecord) => {
    if (r.kind === 'character') {
      const copy = { ...deepClone(r.data as CharacterDefinition), id: uid('char') };
      commit('Trazer da biblioteca', (d) => { d.characters[copy.id] = copy; });
      placeCharacter(copy.id);
    } else if (r.kind === 'scene') {
      const data = r.data as { scene: Scene; characters: Project['characters'] };
      commit('Inserir cena da biblioteca', (d) => {
        for (const [id, c] of Object.entries(data.characters)) if (!d.characters[id]) d.characters[id] = deepClone(c);
        const s = createScene(data.scene.name);
        addSceneOp(d as Project, s, (d as Project).currentSceneId);
        replaceSceneContent(d as Project, s.id, data.scene);
      });
      seek(0);
    } else if (r.kind === 'animation') {
      const id = useUI.getState().nodeIds[0];
      const n = id ? scene.nodes[id] : undefined;
      if (n?.kind !== 'character') {
        toast('Selecione um personagem para aplicar a sequência.', 'error');
        return;
      }
      let count = 0;
      commit('Aplicar sequência', (d) => { count = applySequence(sceneOf(d as Project, scene.id), n.id, r.data as Sequence, transport.getState().timeMs); });
      toast(`${count} passo(s) aplicados a ${n.name} a partir do tempo atual. Todos editáveis na timeline.`, 'success');
    } else if (r.kind === 'pose') {
      const id = useUI.getState().nodeIds[0];
      const n = id ? scene.nodes[id] : undefined;
      if (n?.kind !== 'character') {
        toast('Selecione um personagem para aplicar a pose.', 'error');
        return;
      }
      const data = r.data as { rig: Extract<SceneNode, { kind: 'character' }>['rig']; handL: 'open'; handR: 'open' };
      commit('Aplicar pose', (d) => {
        const m = sceneOf(d as Project, scene.id).nodes[n.id];
        if (m?.kind === 'character') {
          m.rig = deepClone(data.rig);
          m.handL = data.handL;
          m.handR = data.handR;
        }
      });
    }
  };
  const exportLib = () => {
    const blob = new Blob([JSON.stringify({ format: 'recorte-studio-library', version: 1, items }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'biblioteca-recorte-studio.json';
    a.click();
  };
  const importLib = async (f: File) => {
    try {
      const parsed = JSON.parse(await f.text()) as { format?: string; items?: LibraryRecord[] };
      if (parsed.format !== 'recorte-studio-library' || !Array.isArray(parsed.items)) throw new Error('Formato inválido');
      for (const it of parsed.items) await repo.putLibrary({ ...it, id: uid('lib') });
      reload();
      toast(`${parsed.items.length} item(ns) importado(s).`, 'success');
    } catch (e) {
      toast(`Não foi possível importar: ${e instanceof Error ? e.message : ''}`, 'error');
    }
  };
  return (
    <div className="panel-col" data-testid="library-panel">
      <header className="panel-header"><h2>MINHA BIBLIOTECA</h2><span className="count">{items.length}</span></header>
      <div className="panel-sub">
        <p className="hint">Recursos próprios, disponíveis em todos os projetos deste navegador.</p>
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar na biblioteca" />
        <div className="btn-row">
          <button type="button" className="btn btn-sm" data-testid="lib-save-scene" onClick={() => void saveScene()}>Salvar cena</button>
          <button type="button" className="btn btn-sm" onClick={() => void savePose()}>Salvar pose</button>
          <button type="button" className="btn btn-sm" onClick={exportLib}>Exportar</button>
          <button type="button" className="btn btn-sm" onClick={() => fileRef.current?.click()}><FileUp size={14} /> Importar</button>
        </div>
        <input ref={fileRef} hidden type="file" accept=".json" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importLib(f); e.target.value = ''; }} />
      </div>
      <div className="panel-scroll">
        {filtered.length === 0 && <p className="empty">Nada salvo ainda. Salve cenas, poses e personagens para reutilizar em outros projetos.</p>}
        {filtered.map((r) => (
          <div key={r.id} className="lib-row">
            <button type="button" className="lib-main" onClick={() => use(r)}><strong>{r.favorite ? '★ ' : ''}{r.name}</strong><small>{label[r.kind]}</small></button>
            <IconButton label={r.favorite ? 'Tirar dos favoritos' : 'Favoritar'} active={!!r.favorite} onClick={async () => { await repo.putLibrary({ ...r, favorite: r.favorite ? 0 : 1 }); reload(); }}><Star size={14} /></IconButton>
            <IconButton label={`Apagar ${r.name}`} danger onClick={async () => {
              const ok = await confirmDialog({ title: 'Apagar da biblioteca', message: `Apagar "${r.name}"?`, confirmLabel: 'Apagar', danger: true });
              if (ok) { await repo.deleteLibrary(r.id); reload(); }
            }}><Trash2 size={14} /></IconButton>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------- DIREÇÃO (comandos e IA) ---------------------------------- */
const AI_PREFS = 'recorte.ai.v1';
interface AIPrefs { mode: 'quick' | 'ollama' | 'proxy'; ollamaUrl: string; ollamaModel: string; proxyUrl: string; proxyModel: string }
const defaultAI: AIPrefs = { mode: 'quick', ollamaUrl: 'http://localhost:11434', ollamaModel: '', proxyUrl: '', proxyModel: '' };
const loadAI = (): AIPrefs => {
  try { return { ...defaultAI, ...(JSON.parse(localStorage.getItem(AI_PREFS) ?? '{}') as Partial<AIPrefs>) }; } catch { return defaultAI; }
};

const EXAMPLES = [
  'Coloque cabelo branco na Nina',
  'Faça Zeca olhar para Nina e virar o nariz na direção dela',
  'Crie uma cena de sala de aula com 3 alunos e professor',
  'Deixe a câmera aproximar lentamente durante a fala',
  'Crie uma cena vertical de 15 segundos para TikTok',
  'Adicione uma nova cena sem alterar as anteriores',
];

export function DirectionPanel() {
  const project = useProject();
  const scene = useCurrentScene();
  const selection = useUI((s) => s.nodeIds);
  const [text, setText] = useState('');
  const [prefs, setPrefs] = useState<AIPrefs>(loadAI);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => { localStorage.setItem(AI_PREFS, JSON.stringify(prefs)); }, [prefs]);
  const adapter: AIAdapter | null = useMemo(() => {
    if (prefs.mode === 'quick') return quickAdapter;
    if (prefs.mode === 'ollama') return prefs.ollamaModel ? ollamaAdapter({ baseUrl: prefs.ollamaUrl, model: prefs.ollamaModel }) : null;
    return prefs.proxyUrl ? proxyAdapter({ endpoint: prefs.proxyUrl, model: prefs.proxyModel || 'default' }) : null;
  }, [prefs]);
  if (!project || !scene) return null;
  const selectedName = selection[0] ? scene.nodes[selection[0]]?.name : undefined;
  const generate = async () => {
    if (!adapter) {
      setError('Configure o serviço de IA abaixo antes de enviar.');
      return;
    }
    setBusy(true);
    setError('');
    setPlan(null);
    setWarnings([]);
    abort.current = new AbortController();
    try {
      const p = await adapter.generatePlan(text, { project, sceneId: scene.id, selectedName, timeMs: transport.getState().timeMs }, abort.current.signal);
      setPlan(p);
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setError('Cancelado.');
      else setError(e instanceof AIError ? e.message : `Falha: ${e instanceof Error ? e.message : 'desconhecida'}`);
    } finally {
      setBusy(false);
    }
  };
  const apply = () => {
    if (!plan) return;
    let warns: string[] = [];
    let applied = 0;
    let target: string | null = null;
    commit(prefs.mode === 'quick' ? 'Comando rápido' : 'Plano da IA', (d) => {
      const r = applyPlan(d as Project, plan, { sceneId: scene.id, selectedNodeId: selection[0] ?? null, timeMs: transport.getState().timeMs });
      warns = r.warnings;
      applied = r.applied;
      target = r.sceneId;
      (d as Project).currentSceneId = r.sceneId;
    });
    if (target !== scene.id) seek(0);
    setWarnings(warns);
    setPlan(null);
    toast(applied ? `${applied} alteração(ões) aplicada(s). Ctrl+Z desfaz.` : 'Nada foi alterado.', applied ? 'success' : 'info');
  };
  return (
    <div className="panel-col" data-testid="direction-panel">
      <header className="panel-header"><h2>DIREÇÃO</h2></header>
      <div className="panel-scroll is-padded">
        <SelectField label="Modo" value={prefs.mode} testId="ai-mode" options={[{ id: 'quick', label: 'Comandos rápidos (regras, sem IA)' }, { id: 'ollama', label: 'IA local (Ollama)' }, { id: 'proxy', label: 'IA online (endpoint próprio)' }]} onChange={(v) => { setPrefs({ ...prefs, mode: v as AIPrefs['mode'] }); setPlan(null); setError(''); }} />
        {prefs.mode === 'quick' && <p className="hint" data-testid="quick-note">Interpretador por regras: funciona offline e entende frases simples. Não é IA e não cria arte nova.</p>}
        {prefs.mode === 'ollama' && (
          <div className="ai-config">
            <TextField label="Endereço do Ollama" value={prefs.ollamaUrl} onChange={(v) => setPrefs({ ...prefs, ollamaUrl: v })} />
            <button type="button" className="btn btn-sm" onClick={async () => {
              setError('');
              try {
                const list = await listOllamaModels(prefs.ollamaUrl);
                setModels(list);
                if (list.length === 0) setError('Conectei, mas não há modelos instalados no Ollama.');
                else if (!prefs.ollamaModel) setPrefs({ ...prefs, ollamaModel: list[0]! });
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Falha ao conectar.');
              }
            }}>Testar conexão e listar modelos</button>
            {models.length > 0 ? <SelectField label="Modelo" value={prefs.ollamaModel} options={models.map((m) => ({ id: m, label: m }))} onChange={(v) => setPrefs({ ...prefs, ollamaModel: v })} /> : <TextField label="Modelo" value={prefs.ollamaModel} placeholder="Ex.: nome do modelo instalado" onChange={(v) => setPrefs({ ...prefs, ollamaModel: v })} />}
            <p className="hint">Nada está conectado até você testar. O desempenho depende do seu computador. Pode ser preciso liberar esta origem em OLLAMA_ORIGINS.</p>
          </div>
        )}
        {prefs.mode === 'proxy' && (
          <div className="ai-config">
            <TextField label="URL do seu endpoint" value={prefs.proxyUrl} placeholder="https://seu-servidor/v1/chat/completions" onChange={(v) => setPrefs({ ...prefs, proxyUrl: v })} />
            <TextField label="Modelo" value={prefs.proxyModel} onChange={(v) => setPrefs({ ...prefs, proxyModel: v })} />
            <p className="hint">Use um backend seu, compatível com o formato de chat, que guarde a chave. O app não salva nem embute chaves. O texto do pedido e os nomes da cena são enviados para esse endereço.</p>
          </div>
        )}
        <TextField label="O que deve acontecer?" multiline value={text} testId="direction-input" placeholder='Ex.: Coloque cabelo branco na Nina' onChange={setText} />
        <div className="chip-row is-wrap">
          {EXAMPLES.map((ex) => <button key={ex} type="button" className="chip" onClick={() => setText(ex)}>{ex}</button>)}
        </div>
        <div className="btn-row">
          <button type="button" className="btn btn-primary" data-testid="direction-run" disabled={!text.trim() || busy} onClick={() => void generate()}><Sparkles size={15} /> {busy ? 'Gerando…' : 'Gerar plano'}</button>
          {busy && <button type="button" className="btn" onClick={() => abort.current?.abort()}>Cancelar</button>}
        </div>
        {error && <p className="error-box" role="alert">{error}</p>}
        {plan && (
          <div className="plan-box" data-testid="plan-box">
            <h3>Plano para revisar</h3>
            {plan.summary && <p className="hint">{plan.summary}</p>}
            <ol>{describePlan(plan).map((line, i) => <li key={i}>{line}</li>)}</ol>
            <div className="btn-row">
              <button type="button" className="btn btn-primary" data-testid="plan-apply" onClick={apply}>Aplicar</button>
              <button type="button" className="btn" data-testid="plan-cancel" onClick={() => setPlan(null)}>Cancelar</button>
            </div>
          </div>
        )}
        {warnings.length > 0 && <div className="warn-box" role="status"><strong>Avisos:</strong><ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul></div>}
      </div>
    </div>
  );
}

export const LEFT_TABS = [
  { id: 'characters', label: 'Personagens', short: 'Elenco', panel: CharactersPanel },
  { id: 'backgrounds', label: 'Cenários', short: 'Cenários', panel: BackgroundsPanel },
  { id: 'objects', label: 'Objetos', short: 'Objetos', panel: ObjectsPanel },
  { id: 'media', label: 'Mídias e áudio', short: 'Mídias', panel: MediaPanel },
  { id: 'templates', label: 'Templates', short: 'Modelos', panel: TemplatesPanel },
  { id: 'scenes', label: 'Cenas', short: 'Cenas', panel: ScenesPanel },
  { id: 'layers', label: 'Camadas', short: 'Camadas', panel: LayersPanel },
  { id: 'library', label: 'Biblioteca', short: 'Biblioteca', panel: LibraryPanel },
  { id: 'direction', label: 'Direção', short: 'Direção', panel: DirectionPanel },
] as const;
