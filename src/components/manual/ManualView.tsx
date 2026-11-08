/** Manual do Recorte Studio: página inicial, índice, busca, capítulos com capturas reais anotadas. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Lightbulb, AlertTriangle, Search } from 'lucide-react';
import { CHAPTERS, GROUPS, chapterById, searchManual, type Block, type Chapter } from '@/features/manual/content';
import { SHORTCUTS } from '@/features/shortcuts';
import { APP_VERSION } from '@/features/projects/jrec';
import { useUI } from '@/state/uiStore';
import { Logo } from '../layout/ProjectsScreen';
import { MARKS } from '@/features/manual/marks.generated';

const go = (id: string) => useUI.setState({ manualChapter: id });

/** Texto com **negrito** e [links](#capitulo) entre capítulos. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(#[a-z0-9-]+\))/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
        const m = /^\[([^\]]+)\]\(#([a-z0-9-]+)\)$/.exec(p);
        if (m) return <a key={i} href={`#${m[2]}`} className="man-link" onClick={(e) => { e.preventDefault(); go(m[2]!); }}>{m[1]}</a>;
        return p;
      })}
    </>
  );
}

function Figure({ b }: { b: Extract<Block, { img: string }> }) {
  return (
    <figure className="man-fig">
      <div className="man-shot">
        <img src={`manual/${b.img}`} alt={b.alt} loading="lazy" />
        {(b.marks ?? MARKS[b.img] ?? []).map((m) => <span key={m.n} className="man-mark" style={{ left: `${m.x}%`, top: `${m.y}%` }} aria-hidden="true">{m.n}</span>)}
      </div>
      {b.legend && <ol className="man-legend">{b.legend.map((l, i) => <li key={i}><Inline text={l} /></li>)}</ol>}
      {b.caption && <figcaption><Inline text={b.caption} /></figcaption>}
    </figure>
  );
}

function BlockView({ b }: { b: Block }) {
  if ('p' in b) return <p><Inline text={b.p} /></p>;
  if ('h' in b) return <h3>{b.h}</h3>;
  if ('steps' in b) return <ol className="man-steps">{b.steps.map((s, i) => <li key={i}><Inline text={s} /></li>)}</ol>;
  if ('list' in b) return <ul className="man-list">{b.list.map((s, i) => <li key={i}><Inline text={s} /></li>)}</ul>;
  if ('tip' in b) return <aside className="man-tip"><Lightbulb size={16} aria-hidden="true" /><p><Inline text={b.tip} /></p></aside>;
  if ('warn' in b) return <aside className="man-warn"><AlertTriangle size={16} aria-hidden="true" /><p><Inline text={b.warn} /></p></aside>;
  if ('img' in b) return <Figure b={b} />;
  if ('glossary' in b) return <dl className="man-gloss">{b.glossary.map(([t, d]) => <div key={t}><dt>{t}</dt><dd><Inline text={d} /></dd></div>)}</dl>;
  if ('shortcuts' in b) return <dl className="shortcuts">{SHORTCUTS.map((s) => <div key={s.keys}><dt><kbd>{s.keys}</kbd></dt><dd>{s.action}</dd></div>)}</dl>;
  if ('table' in b) return <table className="man-table"><thead><tr>{b.table[0]!.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{b.table.slice(1).map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}><Inline text={c} /></td>)}</tr>)}</tbody></table>;
  return null;
}

function ChapterPage({ c }: { c: Chapter }) {
  const i = CHAPTERS.indexOf(c);
  const prev = CHAPTERS[i - 1];
  const next = CHAPTERS[i + 1];
  return (
    <article className="man-article" data-testid="manual-chapter" data-chapter={c.id}>
      <p className="man-crumb"><button type="button" className="link-btn" onClick={() => go('inicio')}>Manual</button> / {GROUPS.find((g) => g.id === c.group)?.label}</p>
      <h1>{c.title}</h1>
      <p className="man-lead">{c.summary}</p>
      {c.blocks.map((b, k) => <BlockView key={k} b={b} />)}
      {c.related && c.related.length > 0 && (
        <nav className="man-related" aria-label="Veja também">
          <h3>Veja também</h3>
          {c.related.map((id) => { const r = chapterById(id); return r ? <button key={id} type="button" className="chip" onClick={() => go(id)}>{r.title}</button> : null; })}
        </nav>
      )}
      <nav className="man-pager" aria-label="Capítulos vizinhos">
        {prev ? <button type="button" className="btn" onClick={() => go(prev.id)}><ArrowLeft size={15} /> {prev.title}</button> : <span />}
        {next && <button type="button" className="btn" data-testid="manual-next" onClick={() => go(next.id)}>{next.title} <ArrowRight size={15} /></button>}
      </nav>
    </article>
  );
}

function ManualHome() {
  return (
    <article className="man-article man-home" data-testid="manual-home">
      <header className="man-hero">
        <Logo size={64} />
        <div>
          <h1>Manual do Recorte Studio</h1>
          <p className="man-lead">Tudo o que o editor faz, com capturas reais da versão {APP_VERSION}. Funciona offline.</p>
        </div>
      </header>
      <div className="man-start">
        <button type="button" className="learn-card" onClick={() => go('primeiro-projeto')}><BookOpen size={20} /><span><strong>Comece aqui</strong><small>Seu primeiro projeto, passo a passo</small></span></button>
        <button type="button" className="learn-card" onClick={() => go('problemas')}><AlertTriangle size={20} /><span><strong>Solução de problemas</strong><small>Quando algo não sai como esperado</small></span></button>
      </div>
      {GROUPS.map((g) => (
        <section key={g.id} className="man-group">
          <h2>{g.label}</h2>
          <div className="man-cards">
            {CHAPTERS.filter((c) => c.group === g.id && c.id !== 'inicio').map((c) => (
              <button key={c.id} type="button" className="man-card" data-testid="manual-card" data-chapter={c.id} onClick={() => go(c.id)}>
                <strong>{c.title}</strong><small>{c.summary}</small>
              </button>
            ))}
          </div>
        </section>
      ))}
    </article>
  );
}

export function ManualView({ onClose }: { onClose?: () => void }) {
  const chapterId = useUI((s) => s.manualChapter);
  const [q, setQ] = useState('');
  const results = useMemo(() => (q.trim() ? searchManual(q) : []), [q]);
  const chapter = chapterById(chapterId);
  const scroller = useRef<HTMLDivElement>(null);
  const [indexOpen, setIndexOpen] = useState(false);
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
    setIndexOpen(false);
  }, [chapterId]);
  const index: ReactNode = GROUPS.map((g) => (
    <div key={g.id} className="man-index-group">
      <h4>{g.label}</h4>
      {CHAPTERS.filter((c) => c.group === g.id).map((c) => (
        <button key={c.id} type="button" className={c.id === chapterId ? 'is-active' : ''} aria-current={c.id === chapterId ? 'page' : undefined} onClick={() => { setQ(''); go(c.id); }}>{c.title}</button>
      ))}
    </div>
  ));
  return (
    <div className="manual" data-testid="manual">
      <aside className={`man-side${indexOpen ? ' is-open' : ''}`}>
        <div className="man-search">
          <Search size={15} aria-hidden="true" />
          <input className="input" type="search" placeholder="Buscar no manual" aria-label="Buscar no manual" data-testid="manual-search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        </div>
        <button type="button" className="btn btn-sm man-index-toggle" aria-expanded={indexOpen} onClick={() => setIndexOpen(!indexOpen)}>Índice</button>
        <nav className="man-index" aria-label="Índice do manual">
          {q.trim() ? (
            <div className="man-index-group" data-testid="manual-results">
              <h4>{results.length} resultado(s)</h4>
              {results.map((r) => <button key={r.id} type="button" onClick={() => { setQ(''); go(r.id); }}><span>{r.title}</span><small>{r.snippet}</small></button>)}
            </div>
          ) : index}
        </nav>
      </aside>
      <div className="man-main" ref={scroller}>
        {onClose && <div className="man-back"><button type="button" className="btn btn-primary" data-testid="overlay-close" onClick={onClose}><ArrowLeft size={15} /> Voltar ao editor</button></div>}
        {chapter && chapter.id !== 'inicio' ? <ChapterPage c={chapter} /> : <ManualHome />}
      </div>
    </div>
  );
}

