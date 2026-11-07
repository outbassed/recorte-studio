/** Tela de projetos: criar, abrir, renomear, duplicar, arquivar, excluir, importar. */
import { useEffect, useRef, useState } from 'react';
import { Archive, ArchiveRestore, Copy, FilePlus2, FileUp, Pencil, Trash2 } from 'lucide-react';
import { createProject } from '@/engine/model/factory';
import { PROJECT_TEMPLATES, createDemoProject, createFromProjectTemplate } from '@/features/templates/projects';
import { matchesSearch } from '@/features/library/search';
import { createAndOpen, duplicateProject, importFile, openProjectById } from '@/features/projects/session';
import { confirmDialog, promptDialog, toast } from '@/state/uiStore';
import { repo, type ProjectRecord } from '@/storage/db';
import { IconButton, SearchBox } from '../controls/fields';
import { formatTime } from '../timeline/Timeline';

type Row = Omit<ProjectRecord, 'data'>;

export function ProjectsScreen() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'alpha'>('recent');
  const [archived, setArchived] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const reload = () => void repo.listProjects().then(setRows);
  useEffect(reload, []);

  const visible = (rows ?? [])
    .filter((r) => !!r.archived === archived && matchesSearch(query, r.title))
    .sort((a, b) => (sort === 'recent' ? b.updatedAt - a.updatedAt : a.title.localeCompare(b.title, 'pt-BR')));

  const onImport = async (f: File) => {
    try {
      await importFile(f);
    } catch (e) {
      toast(`Não foi possível importar: ${e instanceof Error ? e.message : 'erro desconhecido'}`, 'error');
    }
  };

  return (
    <main className="projects" data-testid="projects-screen">
      <header className="projects-top">
        <div className="brand"><span className="brand-mark" aria-hidden="true" /> Recorte <em>Studio</em></div>
        <div className="projects-actions">
          <button type="button" className="btn" data-testid="import-project" onClick={() => fileRef.current?.click()}><FileUp size={15} /> Importar projeto</button>
          <button type="button" className="btn btn-primary" data-testid="new-project" onClick={() => void createAndOpen(createProject('Novo projeto'))}><FilePlus2 size={15} /> Novo projeto</button>
          <input ref={fileRef} hidden type="file" accept=".json,.zip,application/json,application/zip" data-testid="project-input" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = '';
          }} />
        </div>
      </header>
      <section className="projects-section">
        <h2>Começar de um modelo</h2>
        <div className="tpl-strip">
          <button type="button" className="tpl-card is-demo" data-testid="demo-project" onClick={() => void createAndOpen(createDemoProject())}>
            <strong>Exemplo: Você sabe dançar?</strong><small>Nina e Zeca conversando, com fala, olhar e dança.</small>
          </button>
          {PROJECT_TEMPLATES.map((t) => (
            <button key={t.id} type="button" className="tpl-card" data-testid="project-template-card" data-template={t.id} onClick={() => void createAndOpen(createFromProjectTemplate(t.id))}>
              <strong>{t.name}</strong><small>{t.description}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="projects-section">
        <div className="projects-filter">
          <h2>{archived ? 'Arquivados' : 'Meus projetos'}</h2>
          <SearchBox value={query} onChange={setQuery} placeholder="Buscar projeto" testId="project-search" />
          <select className="input input-sm" aria-label="Ordenar projetos" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="recent">Recentes</option>
            <option value="alpha">Nome (A–Z)</option>
          </select>
          <button type="button" className={`chip${archived ? ' is-active' : ''}`} aria-pressed={archived} onClick={() => setArchived(!archived)}><Archive size={12} /> Arquivados</button>
        </div>
        {rows === null && <div className="skeleton-grid" aria-label="Carregando projetos">{[0, 1, 2].map((i) => <div key={i} className="skeleton" />)}</div>}
        {rows !== null && visible.length === 0 && <p className="empty">{query ? 'Nenhum projeto com esse nome.' : archived ? 'Nenhum projeto arquivado.' : 'Você ainda não tem projetos. Crie um novo ou comece por um modelo.'}</p>}
        <div className="project-grid">
          {visible.map((r) => (
            <article key={r.id} className="project-card" data-testid="project-card" data-title={r.title}>
              <button type="button" className="project-open" aria-label={`Abrir ${r.title}`} onClick={() => void openProjectById(r.id)}>
                {r.thumbnail ? <img src={r.thumbnail} alt="" loading="lazy" /> : <span className="thumb-empty" />}
                <strong>{r.title}</strong>
                <small>{new Date(r.updatedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · {r.sceneCount} cena(s) · {formatTime(r.durationMs).slice(0, 5)}</small>
              </button>
              <div className="project-tools">
                <IconButton label={`Renomear ${r.title}`} onClick={async () => {
                  const v = await promptDialog('Renomear projeto', 'Nome', r.title);
                  if (!v) return;
                  const p = await repo.loadProject(r.id);
                  if (p) await repo.saveProject({ ...p, title: v, updatedAt: Date.now() });
                  reload();
                }}><Pencil size={15} /></IconButton>
                <IconButton label={`Duplicar ${r.title}`} testId="project-duplicate" onClick={async () => { await duplicateProject(r.id); reload(); }}><Copy size={15} /></IconButton>
                <IconButton label={r.archived ? `Restaurar ${r.title}` : `Arquivar ${r.title}`} onClick={async () => {
                  const p = await repo.loadProject(r.id);
                  if (p) await repo.saveProject({ ...p, metadata: { ...p.metadata, archived: !r.archived } });
                  reload();
                }}>{r.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}</IconButton>
                <IconButton label={`Excluir ${r.title}`} danger testId="project-delete" onClick={async () => {
                  const ok = await confirmDialog({ title: 'Excluir projeto', message: `Excluir "${r.title}" definitivamente deste navegador? Isto não pode ser desfeito. Exporte um backup antes, se precisar.`, confirmLabel: 'Excluir definitivamente', danger: true });
                  if (ok) {
                    await repo.deleteProject(r.id);
                    reload();
                  }
                }}><Trash2 size={15} /></IconButton>
              </div>
            </article>
          ))}
        </div>
      </section>
      <p className="hint projects-note">Tudo fica salvo apenas neste navegador, sem conta e sem envio de dados. Faça backups em Exportar. Importa também arquivos das versões 0.3 e 0.4.</p>
    </main>
  );
}
