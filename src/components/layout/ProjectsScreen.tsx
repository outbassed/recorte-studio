/**
 * Tela inicial do Recorte Studio: Início, Meus projetos, Modelos, Manual e Configurações.
 * Navegação lateral no computador e barra inferior no celular.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ScrollStrip } from '../controls/ScrollStrip';
import {
  Archive, ArchiveRestore, BookOpen, Clapperboard, Copy, Download, Eye, FilePlus2, FileUp, FolderOpen, Home, LayoutTemplate, Link2, Pencil, Settings, Sparkles, Trash2,
} from 'lucide-react';
import { createProject } from '@/engine/model/factory';
import type { Project } from '@/engine/model/schema';
import { PROJECT_TEMPLATES, createDemoProject, createFromProjectTemplate } from '@/features/templates/projects';
import { matchesSearch } from '@/features/library/search';
import { createAndOpen, duplicateProject, openProjectById } from '@/features/projects/session';
import { APP_VERSION } from '@/features/projects/jrec';
import { importAnything, saveProjectByIdWithChecks } from '@/state/mediaActions';
import { copyProjectLink } from '@/features/projects/urls';
import { confirmDialog, openManual, promptDialog, toast, useUI, type HomeSection } from '@/state/uiStore';
import { repo, type ProjectRow } from '@/storage/db';
import { IconButton, SearchBox } from '../controls/fields';
import { formatTime } from '../timeline/Timeline';
import { sceneThumbUrl } from '../panels/thumbs';
import { Modal } from '../dialogs/Modal';
import { ManualView } from '../manual/ManualView';
import { SettingsView } from '../settings/SettingsView';
import { PROJECT_ACCEPT } from './Editor';

export function Logo({ size = 32 }: { size?: number }) {
  return <img className="logo" src="favicon.svg" width={size} height={size} alt="" aria-hidden="true" />;
}

/* ----------------------------- modelos ----------------------------- */
export type TemplateCategory = 'Formatos' | 'Ambientes' | 'Técnicos';
export interface TemplateInfo { id: string; name: string; description: string; make: () => Project; demo?: boolean; category: TemplateCategory; whatToTest?: string[] }
export const TEMPLATES: TemplateInfo[] = [
  { id: 'demo', name: 'Exemplo: Você sabe dançar?', description: 'Nina e Zeca conversando, com fala, olhar e dança. Bom para conhecer o editor.', make: createDemoProject, demo: true, category: 'Formatos' },
  ...PROJECT_TEMPLATES.map((t) => ({ id: t.id, name: t.name, description: t.description, category: t.category ?? 'Formatos', whatToTest: t.whatToTest, make: () => createFromProjectTemplate(t.id) })),
];
const TEMPLATE_CATEGORIES: Array<TemplateCategory | 'Todos'> = ['Todos', 'Ambientes', 'Técnicos', 'Formatos'];
interface TemplateInfoCache { thumbs: string[]; names: string[]; format: string; scenes: number; durationMs: number }
const previewCache = new Map<string, TemplateInfoCache>();
/**
 * Miniaturas reais: um quadro de CADA cena do modelo (na ordem), desenhado pelo mesmo renderizador
 * da exportação. São imagens estáticas, não uma reprodução. Calculado uma vez por modelo.
 */
export function templatePreview(t: TemplateInfo): TemplateInfoCache {
  let v = previewCache.get(t.id);
  if (!v) {
    const p = t.make();
    const scenes = p.sceneOrder.map((id) => p.scenes[id]!).filter(Boolean);
    const { width: w, height: h } = p.settings;
    v = {
      thumbs: scenes.map((s) => sceneThumbUrl(p, s)),
      names: scenes.map((s) => s.name),
      format: w > h ? `${ratio(w, h)} horizontal` : w < h ? `${ratio(w, h)} vertical` : '1:1 quadrado',
      scenes: scenes.length,
      durationMs: scenes.reduce((n, s) => n + s.durationMs, 0),
    };
    previewCache.set(t.id, v);
  }
  return v;
}
function ratio(w: number, h: number) {
  const r = w / h;
  if (Math.abs(r - 16 / 9) < 0.02) return '16:9';
  if (Math.abs(r - 9 / 16) < 0.02) return '9:16';
  if (Math.abs(r - 4 / 3) < 0.02) return '4:3';
  if (Math.abs(r - 1) < 0.02) return '1:1';
  return `${w}×${h}`;
}

function TemplateCard({ t, compact }: { t: TemplateInfo; compact?: boolean }) {
  const [preview, setPreview] = useState(false);
  const info = useMemo(() => templatePreview(t), [t]);
  return (
    <article className={`tpl-card${t.demo ? ' is-demo' : ''}${compact ? ' is-compact' : ''}`}>
      <button type="button" className="tpl-open" data-testid={t.demo ? 'demo-project' : 'project-template-card'} data-template={t.demo ? undefined : t.id} onClick={() => void createAndOpen(t.make())}>
        <span className="tpl-thumb"><img src={info.thumbs[0]} alt="" /></span>
        <span className="tpl-text">
          <strong>{t.name}</strong>
          <small>{t.description}</small>
          <span className="tpl-meta">{info.format} · {info.scenes} cena(s) · {formatTime(info.durationMs).slice(0, 5)}</span>
        </span>
      </button>
      {!compact && (
        <div className="tpl-actions">
          <button type="button" className="btn btn-sm" data-testid="template-preview-open" aria-haspopup="dialog" onClick={() => setPreview(true)}><Eye size={14} /> Prévia</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => void createAndOpen(t.make())}><FilePlus2 size={14} /> Criar projeto</button>
        </div>
      )}
      {preview && (
        <Modal title={t.name} testId="template-preview" onClose={() => setPreview(false)} footer={<button type="button" className="btn btn-primary" data-testid="template-preview-create" onClick={() => { setPreview(false); void createAndOpen(t.make()); }}>Criar projeto com este modelo</button>}>
          <p className="hint">{t.description} {info.format}, {info.scenes} cena(s), {formatTime(info.durationMs).slice(0, 5)}. As imagens são um quadro de cada cena, não uma reprodução.</p>
          {t.whatToTest?.length ? (
            <div className="tpl-test" data-testid="template-what-to-test">
              <strong>O que testar neste modelo</strong>
              <ul>{t.whatToTest.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          ) : null}
          <ol className="tpl-preview-grid" data-testid="template-preview-scenes">
            {info.thumbs.map((u, i) => (
              <li key={i} data-testid="template-preview-scene">
                <img src={u} alt={`Cena ${i + 1}: ${info.names[i]}`} decoding="sync" />
                <span>{i + 1}. {info.names[i]}</span>
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </article>
  );
}

/* ----------------------------- projetos ----------------------------- */
function useProjects() {
  const [rows, setRows] = useState<ProjectRow[] | null>(null);
  const reload = useCallback(() => void repo.listProjects().then(setRows), []);
  useEffect(reload, [reload]);
  return { rows, reload };
}

function ProjectCard({ r, reload }: { r: ProjectRow; reload: () => void }) {
  const aspect = `${r.width} / ${r.height}`;
  return (
    <article className="project-card" data-testid="project-card" data-title={r.title}>
      <button type="button" className="project-open" aria-label={`Abrir ${r.title}`} onClick={() => void openProjectById(r.id)}>
        <span className="project-thumb">
          {r.thumbnail ? <img src={r.thumbnail} alt="" loading="lazy" style={{ aspectRatio: aspect }} /> : <span className="thumb-empty"><Clapperboard size={26} /></span>}
          {r.height > r.width && <span className="badge">Vertical</span>}
        </span>
        <strong>{r.title}</strong>
        <small>
          {new Date(r.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {r.sceneCount} cena(s) · {formatTime(r.durationMs).slice(0, 5)}
        </small>
      </button>
      <div className="project-tools">
        <IconButton label={`Salvar ${r.title} como .jrec`} testId="project-jrec" onClick={() => void saveProjectByIdWithChecks(r.id)}><Download size={15} /></IconButton>
        <IconButton label={`Copiar link local de ${r.title}`} onClick={async () => {
          try {
            await copyProjectLink(r);
            toast('Link copiado. Ele abre este projeto só neste navegador, não em outros aparelhos.', 'success');
          } catch { toast('Não foi possível copiar. Verifique a permissão de copiar.', 'error'); }
        }}><Link2 size={15} /></IconButton>
        <IconButton label={`Renomear ${r.title}`} testId="project-rename" onClick={async () => {
          const v = await promptDialog('Renomear projeto', 'Nome', r.title);
          if (!v) return;
          const p = await repo.loadProject(r.id);
          if (p) await repo.saveProject({ ...p, title: v, updatedAt: Date.now() });
          reload();
        }}><Pencil size={15} /></IconButton>
        <IconButton label={`Duplicar ${r.title}`} testId="project-duplicate" onClick={async () => { await duplicateProject(r.id); reload(); }}><Copy size={15} /></IconButton>
        <IconButton label={r.archived ? `Desarquivar ${r.title}` : `Arquivar ${r.title}`} testId="project-archive" onClick={async () => {
          const p = await repo.loadProject(r.id);
          if (p) await repo.saveProject({ ...p, metadata: { ...p.metadata, archived: !r.archived } });
          toast(r.archived ? `"${r.title}" voltou para Meus projetos.` : `"${r.title}" foi para Arquivados.`, 'success');
          reload();
        }}>{r.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}</IconButton>
        <IconButton label={`Excluir ${r.title}`} danger testId="project-delete" onClick={async () => {
          const ok = await confirmDialog({ title: 'Excluir projeto', message: `Excluir "${r.title}" definitivamente deste navegador? Isto não pode ser desfeito. Salve um .jrec antes, se precisar.`, confirmLabel: 'Excluir definitivamente', danger: true });
          if (ok) {
            await repo.deleteProject(r.id);
            reload();
          }
        }}><Trash2 size={15} /></IconButton>
      </div>
    </article>
  );
}

type Sort = 'recent' | 'created' | 'alpha' | 'duration';
type Filter = 'all' | 'week' | 'horizontal' | 'vertical' | 'archived';

function ProjectsPage({ rows, reload, onNew, onImport }: { rows: ProjectRow[] | null; reload: () => void; onNew: () => void; onImport: () => void }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [filter, setFilter] = useState<Filter>('all');
  const weekAgo = Date.now() - 7 * 864e5;
  const visible = (rows ?? [])
    .filter((r) => (filter === 'archived' ? !!r.archived : !r.archived))
    .filter((r) => filter !== 'week' || r.updatedAt >= weekAgo)
    .filter((r) => filter !== 'horizontal' || r.width >= r.height)
    .filter((r) => filter !== 'vertical' || r.height > r.width)
    .filter((r) => matchesSearch(query, r.title))
    .sort((a, b) => (sort === 'recent' ? b.updatedAt - a.updatedAt : sort === 'created' ? b.createdAt - a.createdAt : sort === 'duration' ? b.durationMs - a.durationMs : a.title.localeCompare(b.title, 'pt-BR')));
  const archivedCount = (rows ?? []).filter((r) => r.archived).length;
  const FILTERS: Array<[Filter, string]> = [['all', 'Todos'], ['week', 'Últimos 7 dias'], ['horizontal', 'Horizontais'], ['vertical', 'Verticais'], ['archived', `Arquivados${archivedCount ? ` (${archivedCount})` : ''}`]];
  return (
    <div className="home-page">
      <header className="page-head">
        <div><h1>Meus projetos</h1><p>Tudo fica salvo neste navegador. Use .jrec para levar um projeto para outro aparelho.</p></div>
        <div className="page-actions">
          <button type="button" className="btn" onClick={onImport}><FileUp size={15} /> Importar</button>
          <button type="button" className="btn btn-primary" onClick={onNew}><FilePlus2 size={15} /> Novo projeto</button>
        </div>
      </header>
      <div className="projects-filter">
        <SearchBox value={query} onChange={setQuery} placeholder="Buscar projeto" testId="project-search" />
        <select className="input input-sm" aria-label="Ordenar projetos" data-testid="project-sort" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          <option value="recent">Modificados recentemente</option>
          <option value="created">Criados recentemente</option>
          <option value="alpha">Nome (A–Z)</option>
          <option value="duration">Mais longos</option>
        </select>
        <div className="chip-row is-wrap" role="group" aria-label="Filtrar projetos">
          {FILTERS.map(([id, label]) => <button key={id} type="button" className={`chip${filter === id ? ' is-active' : ''}`} aria-pressed={filter === id} data-testid={`project-filter-${id}`} onClick={() => setFilter(id)}>{label}</button>)}
        </div>
      </div>
      {rows === null && <div className="project-grid" aria-label="Carregando projetos">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton project-skeleton" />)}</div>}
      {rows !== null && visible.length === 0 && (
        query || filter !== 'all' ? <p className="empty">{query ? 'Nenhum projeto com esse nome.' : filter === 'archived' ? 'Nenhum projeto arquivado.' : 'Nenhum projeto neste filtro.'}</p> : <EmptyProjects onNew={onNew} onImport={onImport} />
      )}
      <div className="project-grid">{visible.map((r) => <ProjectCard key={r.id} r={r} reload={reload} />)}</div>
    </div>
  );
}

function EmptyProjects({ onNew, onImport }: { onNew: () => void; onImport: () => void }) {
  return (
    <div className="empty-state" data-testid="projects-empty">
      <Clapperboard size={40} aria-hidden="true" />
      <h2>Seu primeiro projeto começa aqui</h2>
      <p>Crie um projeto em branco, comece por um modelo ou importe um arquivo .jrec de outro aparelho.</p>
      <div className="page-actions">
        <button type="button" className="btn btn-primary" onClick={onNew}><FilePlus2 size={15} /> Novo projeto</button>
        <button type="button" className="btn" onClick={() => useUI.setState({ homeSection: 'templates' })}><LayoutTemplate size={15} /> Ver modelos</button>
        <button type="button" className="btn" onClick={onImport}><FileUp size={15} /> Importar</button>
      </div>
    </div>
  );
}

function HomePage({ rows, reload, onNew, onImport }: { rows: ProjectRow[] | null; reload: () => void; onNew: () => void; onImport: () => void }) {
  const recent = (rows ?? []).filter((r) => !r.archived).slice(0, 4);
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-text">
          <Logo size={56} />
          <h1>Recorte <em>Studio</em></h1>
          <p>Conte histórias com personagens de recorte: cenas, falas, áudio, câmera e vídeo, direto no navegador e sem internet.</p>
          <div className="page-actions">
            <button type="button" className="btn btn-primary btn-lg" data-testid="new-project" onClick={onNew}><FilePlus2 size={17} /> Novo projeto</button>
            <button type="button" className="btn btn-lg" data-testid="import-project" onClick={onImport}><FileUp size={17} /> Importar projeto</button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <img src={templatePreview(TEMPLATES[0]!).thumbs[0]} alt="" />
        </div>
      </section>

      <section className="home-section">
        <div className="home-head"><h2>Projetos recentes</h2>{(rows?.length ?? 0) > 0 && <button type="button" className="link-btn" onClick={() => useUI.setState({ homeSection: 'projects' })}>Ver todos</button>}</div>
        {rows === null && <div className="project-grid">{[0, 1, 2].map((i) => <div key={i} className="skeleton project-skeleton" />)}</div>}
        {rows !== null && recent.length === 0 && <EmptyProjects onNew={onNew} onImport={onImport} />}
        <div className="project-grid">{recent.map((r) => <ProjectCard key={r.id} r={r} reload={reload} />)}</div>
      </section>

      <section className="home-section">
        <div className="home-head"><h2>Comece por um modelo</h2><button type="button" className="link-btn" onClick={() => useUI.setState({ homeSection: 'templates' })}>Todos os modelos</button></div>
        <div className="tpl-grid">{TEMPLATES.slice(0, 4).map((t) => <TemplateCard key={t.id} t={t} compact />)}</div>
      </section>

      <section className="home-section home-learn">
        <button type="button" className="learn-card" onClick={() => openManual('primeiro-projeto')}><BookOpen size={20} /><span><strong>Primeiro projeto</strong><small>Do zero ao vídeo em poucos passos</small></span></button>
        <button type="button" className="learn-card" onClick={() => openManual('timeline-simples')}><Sparkles size={20} /><span><strong>Modo simples</strong><small>Falas e ações como uma lista de passos</small></span></button>
        <button type="button" className="learn-card" onClick={() => openManual('jrec')}><FolderOpen size={20} /><span><strong>Arquivos .jrec</strong><small>Backup e levar para outro aparelho</small></span></button>
      </section>

      <footer className="home-foot">
        <span>Versão {APP_VERSION}</span>
        <button type="button" className="link-btn" onClick={() => openManual('novidades')}>Novidades desta versão</button>
        <span>Os projetos ficam só neste navegador. Faça backups em .jrec.</span>
      </footer>
    </div>
  );
}

function TemplatesPage() {
  const [cat, setCat] = useState<TemplateCategory | 'Todos'>('Todos');
  const list = TEMPLATES.filter((t) => cat === 'Todos' || t.category === cat);
  return (
    <div className="home-page">
      <header className="page-head"><div><h1>Modelos</h1><p>Cada modelo vira um projeto NOVO e seu, editável; o projeto aberto não muda. As miniaturas são as cenas reais do modelo.</p></div></header>
      <ScrollStrip className="chip-row" role="group" ariaLabel="Categoria dos modelos" testId="template-categories" watch={cat}>
        {TEMPLATE_CATEGORIES.map((c) => (
          <button key={c} type="button" className={`chip${cat === c ? ' is-active' : ''}`} aria-pressed={cat === c} data-category={c} onClick={() => setCat(c)}>{c}</button>
        ))}
      </ScrollStrip>
      <div className="tpl-grid is-large">{list.map((t) => <TemplateCard key={t.id} t={t} />)}</div>
    </div>
  );
}

const NAV: Array<{ id: HomeSection; label: string; icon: ReactNode }> = [
  { id: 'home', label: 'Início', icon: <Home size={18} /> },
  { id: 'projects', label: 'Meus projetos', icon: <FolderOpen size={18} /> },
  { id: 'templates', label: 'Modelos', icon: <LayoutTemplate size={18} /> },
  { id: 'manual', label: 'Manual', icon: <BookOpen size={18} /> },
  { id: 'settings', label: 'Configurações', icon: <Settings size={18} /> },
];

export function ProjectsScreen() {
  const section = useUI((s) => s.homeSection);
  const { rows, reload } = useProjects();
  const fileRef = useRef<HTMLInputElement>(null);
  const onNew = () => void createAndOpen(createProject('Novo projeto'));
  const onImport = () => fileRef.current?.click();
  useEffect(() => {
    if (section === 'projects' || section === 'home') reload();
  }, [section, reload]);

  return (
    <div className="home" data-testid="projects-screen">
      <nav className="home-nav" aria-label="Seções">
        <div className="home-brand"><Logo size={30} /><span>Recorte <em>Studio</em></span></div>
        {NAV.map((n) => (
          <button key={n.id} type="button" className={`home-nav-btn${section === n.id ? ' is-active' : ''}`} aria-current={section === n.id ? 'page' : undefined} data-testid={`home-nav-${n.id}`} onClick={() => useUI.setState({ homeSection: n.id })}>
            {n.icon}<span>{n.label}</span>
          </button>
        ))}
        <div className="home-nav-foot">v{APP_VERSION}</div>
      </nav>
      <main className="home-main" key={section}>
        {section === 'home' && <HomePage rows={rows} reload={reload} onNew={onNew} onImport={onImport} />}
        {section === 'projects' && <ProjectsPage rows={rows} reload={reload} onNew={onNew} onImport={onImport} />}
        {section === 'templates' && <TemplatesPage />}
        {section === 'manual' && <ManualView />}
        {section === 'settings' && <SettingsView />}
      </main>
      <input ref={fileRef} hidden type="file" accept={PROJECT_ACCEPT} data-testid="project-input" onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (f) void importAnything(f, false).catch((err: unknown) => toast(`Não foi possível importar: ${err instanceof Error ? err.message : 'erro desconhecido'}`, 'error'));
      }} />
    </div>
  );
}
