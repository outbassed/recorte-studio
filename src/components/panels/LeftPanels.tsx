/** Painéis da esquerda (e dos popups no celular). */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, ChevronsDown, ChevronsUp, Copy, Eye, EyeOff, Group, Lock, LockOpen, Plus, Sparkles, Trash2, Ungroup,
} from 'lucide-react';
import { createProject } from '@/engine/model/factory';
import { addScene as addSceneOp, countSceneActions, deleteNode, duplicateNode, groupNodes, moveLayer, moveScene, pasteSceneContent, replaceSceneContent, sceneOf, ungroup } from '@/engine/model/ops';
import { deepClone } from '@/engine/model/ids';
import { type Project, type Scene, type SceneNode } from '@/engine/model/schema';
import { applyPlan, describePlan, type Plan } from '@/features/ai/plan';
import { listOllamaModels, ollamaAdapter, proxyAdapter, quickAdapter, AIError, type AIAdapter } from '@/features/ai/adapters';
import { matchesSearch } from '@/features/library/search';
import { SCENE_TEMPLATES, buildTemplateScene } from '@/features/templates/scenes';
import { PROJECT_TEMPLATES, createFromProjectTemplate } from '@/features/templates/projects';
import { createAndOpen } from '@/features/projects/session';
import { addScene, requestDeleteScene, switchScene } from '@/state/actions';
import { commit, useCurrentScene, useProject } from '@/state/projectStore';
import { seek, transport } from '@/state/transport';
import { confirmDialog, openContextMenu, promptDialog, selectNodes, toast, useUI } from '@/state/uiStore';
import { IconButton, MoreButton, SearchBox, SelectField, TextField, useLongPress, VirtualList } from '../controls/fields';
import { usePrefs } from '@/state/prefs';
import { backgroundThumbUrl, SceneThumb } from './thumbs';
import { formatTime } from '../timeline/Timeline';
import { MediaPanel } from './MediaPanel';
import { CastPanel, ObjectsCatalogPanel, SceneryPanel, ToolboxPanel } from './Catalog';

/* ---------------------------------- CENAS ---------------------------------- */
let sceneClipboard: Scene | null = null;

function SceneRow({ id, index, project, current, order }: { id: string; index: number; project: Project; current: Scene; order: string[] }) {
  const thumbsOn = usePrefs((p) => p.sceneThumbs);
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
          {thumbsOn ? <SceneThumb project={project} scene={scene} /> : <span className="scene-thumb is-off" aria-hidden="true" />}
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
      <div className={`layer-row${selected ? ' is-selected' : ''}${node.visible ? '' : ' is-hidden'}`} data-testid="layer-row" data-node-id={id} data-node-name={node.name} aria-selected={selected} onContextMenu={(e) => { e.preventDefault(); openContextMenu({ x: e.clientX, y: e.clientY, title: node.name, items: menu() }); }} {...lp}>
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

/* ------------------- ELENCO, CENÁRIOS E OBJETOS: visões do catálogo unificado ------------------- */
export const CharactersPanel = CastPanel;
export const BackgroundsPanel = SceneryPanel;
export const ObjectsPanel = ObjectsCatalogPanel;

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

/* ------------------------- BIBLIOTECA: Toolbox compacta do Studio ------------------------- */
export const LibraryPanel = ToolboxPanel;

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
