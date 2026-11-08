/** Configurações do aplicativo, por categoria. Só opções com efeito real e persistidas. */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Gauge, HardDrive, Info, Keyboard, Monitor, Palette, PenTool, Volume2 } from 'lucide-react';
import changelog from '../../../CHANGELOG.md?raw';
import { APP_VERSION, JREC_VERSION } from '@/features/projects/jrec';
import { SHORTCUTS } from '@/features/shortcuts';
import { matchesSearch } from '@/features/library/search';
import { resetPrefs, setPref, usePrefs, type AppPrefs } from '@/state/prefs';
import { confirmDialog, openManual, toast, useUI } from '@/state/uiStore';
import { repo } from '@/storage/db';
import { SearchBox, SelectField, ToggleField } from '../controls/fields';
import { SliderNumberField } from '../controls/SliderNumberField';

export const SETTINGS_SECTIONS: Array<{ id: string; label: string; icon: ReactNode }> = [
  { id: 'geral', label: 'Geral', icon: <Monitor size={16} /> },
  { id: 'aparencia', label: 'Aparência', icon: <Palette size={16} /> },
  { id: 'editor', label: 'Editor', icon: <PenTool size={16} /> },
  { id: 'audio', label: 'Áudio', icon: <Volume2 size={16} /> },
  { id: 'desempenho', label: 'Desempenho', icon: <Gauge size={16} /> },
  { id: 'armazenamento', label: 'Armazenamento', icon: <HardDrive size={16} /> },
  { id: 'atalhos', label: 'Atalhos', icon: <Keyboard size={16} /> },
  { id: 'sobre', label: 'Sobre', icon: <Info size={16} /> },
];

const mb = (n: number) => `${(n / 1048576).toLocaleString('pt-BR', { maximumFractionDigits: n < 10485760 ? 1 : 0 })} MB`;

function Group({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="set-group">
      <h3>{title}</h3>
      {hint && <p className="hint">{hint}</p>}
      <div className="set-fields">{children}</div>
    </section>
  );
}

function General({ p }: { p: AppPrefs }) {
  return (
    <>
      <Group title="Idioma">
        <p className="set-static">Português (Brasil). É o único idioma disponível nesta versão.</p>
      </Group>
      <Group title="Ao abrir o Recorte Studio">
        <SelectField label="Começar em" testId="pref-startup" value={p.startup} options={[{ id: 'home', label: 'Tela inicial' }, { id: 'last', label: 'Último projeto aberto' }]} onChange={(v) => setPref('startup', v as AppPrefs['startup'])} />
        <p className="hint">Um link de projeto (?projeto=…) sempre abre aquele projeto.</p>
      </Group>
      <Group title="Ao abrir um projeto">
        <SelectField label="Modo da timeline" testId="pref-mode" value={p.defaultMode} options={[{ id: 'auto', label: 'Automático: simples no celular, avançado no computador' }, { id: 'simple', label: 'Sempre simples (passos)' }, { id: 'advanced', label: 'Sempre avançado (trilhas e keyframes)' }]} onChange={(v) => setPref('defaultMode', v as AppPrefs['defaultMode'])} />
      </Group>
      <Group title="Restaurar">
        <button type="button" className="btn btn-sm" onClick={async () => {
          const ok = await confirmDialog({ title: 'Restaurar configurações', message: 'Voltar todas as configurações do aplicativo ao padrão? Seus projetos não são afetados.', confirmLabel: 'Restaurar' });
          if (ok) { resetPrefs(); toast('Configurações restauradas.', 'success'); }
        }}>Restaurar padrões</button>
      </Group>
    </>
  );
}

function Appearance({ p }: { p: AppPrefs }) {
  return (
    <>
      <Group title="Tema">
        <div className="seg" role="radiogroup" aria-label="Tema">
          {([['dark', 'Escuro'], ['light', 'Claro'], ['system', 'Do sistema']] as const).map(([id, label]) => (
            <button key={id} type="button" role="radio" aria-checked={p.theme === id} data-testid={`pref-theme-${id}`} className={p.theme === id ? 'is-active' : ''} onClick={() => setPref('theme', id)}>{label}</button>
          ))}
        </div>
      </Group>
      <Group title="Tamanho do texto da interface" hint="Não muda o vídeo exportado nem o texto dos balões.">
        <div className="seg" role="radiogroup" aria-label="Tamanho do texto">
          {([90, 100, 110, 125] as const).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={p.uiScale === v} data-testid={`pref-scale-${v}`} className={p.uiScale === v ? 'is-active' : ''} onClick={() => setPref('uiScale', v)}>{v}%</button>
          ))}
        </div>
      </Group>
      <Group title="Movimento">
        <ToggleField label="Reduzir animações da interface" hint="Desliga transições de painéis e menus. A animação do projeto não muda." testId="pref-reduce-motion" checked={p.reduceMotion} onChange={(v) => setPref('reduceMotion', v)} />
      </Group>
    </>
  );
}

function EditorPrefs() {
  const ui = useUI();
  const t = (k: 'showGrid' | 'showSafe' | 'showRulers' | 'snapStage' | 'snapTimeline' | 'checker' | 'gazeArrows', label: string, hint?: string) => (
    <ToggleField label={label} hint={hint} testId={`pref-${k}`} checked={ui[k]} onChange={(v) => useUI.setState({ [k]: v })} />
  );
  return (
    <>
      <Group title="Palco">
        {t('showGrid', 'Grade de terços')}
        {t('showSafe', 'Margens seguras de título e ação')}
        {t('showRulers', 'Réguas')}
        {t('checker', 'Fundo quadriculado fora do cenário')}
        {t('gazeArrows', 'Setas de olhar dos personagens')}
        {t('snapStage', 'Encaixar ao mover no palco', 'Alinha com o centro e as bordas do quadro.')}
      </Group>
      <Group title="Timeline">
        {t('snapTimeline', 'Encaixar clips e keyframes', 'Gruda no cursor, em outros clips e em segundos inteiros.')}
        <SliderNumberField label="Zoom padrão da timeline" unit="px/s" min={20} max={600} sliderMin={20} sliderMax={400} step={5} decimals={0} value={ui.timelineZoom} onChange={(v) => useUI.setState({ timelineZoom: Math.round(v) })} />
      </Group>
      <p className="hint">Estas opções também ficam na barra do palco e valem para todos os projetos deste navegador.</p>
    </>
  );
}

function AudioPrefs({ p }: { p: AppPrefs }) {
  return (
    <Group title="Reprodução no editor" hint="O vídeo exportado sempre usa o volume definido em cada clip; estas opções valem só para ouvir enquanto edita.">
      <SliderNumberField label="Volume do editor" unit="%" display={100} min={0} max={1} sliderMin={0} sliderMax={100} decimals={0} testId="pref-volume" value={p.volume} onChange={(v) => setPref('volume', Math.min(1, Math.max(0, v)))} />
      <ToggleField label="Silenciar o editor" testId="pref-muted" checked={p.muted} onChange={(v) => setPref('muted', v)} />
    </Group>
  );
}

function Performance({ p }: { p: AppPrefs }) {
  return (
    <>
      <Group title="Prévia" hint="Limitar os quadros por segundo alivia computadores e celulares mais simples. A exportação continua com o FPS do projeto.">
        <SelectField label="Quadros por segundo da prévia" testId="pref-fps" value={String(p.previewFps)} options={[{ id: '0', label: 'Máximo do monitor' }, { id: '30', label: '30 fps' }, { id: '24', label: '24 fps' }]} onChange={(v) => setPref('previewFps', Number(v) as AppPrefs['previewFps'])} />
      </Group>
      <Group title="Painéis">
        <ToggleField label="Miniaturas das cenas" hint="Desligue em projetos com muitas cenas para abrir o painel Cenas mais rápido." testId="pref-scene-thumbs" checked={p.sceneThumbs} onChange={(v) => setPref('sceneThumbs', v)} />
      </Group>
    </>
  );
}

function Storage() {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof repo.storageStats>> | null>(null);
  const [estimate, setEstimate] = useState<{ usage?: number; quota?: number } | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const refresh = () => {
    void repo.storageStats().then(setStats);
    void navigator.storage?.estimate?.().then(setEstimate).catch(() => setEstimate(null));
    void navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  };
  useEffect(refresh, []);
  return (
    <>
      <Group title="Espaço usado">
        {stats ? (
          <dl className="set-stats" data-testid="storage-stats">
            <div><dt>Projetos</dt><dd>{stats.projects}</dd></div>
            <div><dt>Mídias (imagens e áudio)</dt><dd>{stats.blobs} · {mb(stats.blobBytes)}</dd></div>
            <div><dt>Cópias de segurança de importação</dt><dd>{stats.backups} · {mb(stats.backupBytes)}</dd></div>
            {estimate?.usage !== undefined && <div><dt>Total usado pelo site</dt><dd>{mb(estimate.usage)}</dd></div>}
            {estimate?.quota !== undefined && <div><dt>Disponível (estimativa do navegador)</dt><dd>{mb(Math.max(0, estimate.quota - (estimate.usage ?? 0)))}</dd></div>}
          </dl>
        ) : <p className="hint">Calculando…</p>}
        {estimate?.quota !== undefined && estimate.usage !== undefined && <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((estimate.usage / estimate.quota) * 100)} aria-label="Espaço usado"><span style={{ width: `${Math.min(100, (estimate.usage / estimate.quota) * 100)}%` }} /></div>}
        <p className="hint">{persisted === true ? 'O navegador marcou estes dados como persistentes: ele não os apaga sozinho por falta de espaço.' : persisted === false ? 'O navegador pode apagar estes dados se o disco ficar cheio. Instalar o app (PWA) e fazer backups em .jrec reduz o risco.' : ''}</p>
      </Group>
      <Group title="Limpeza segura" hint="Nada que um projeto use é apagado.">
        <div className="btn-row">
          <button type="button" className="btn btn-sm" data-testid="storage-orphans" onClick={async () => {
            const n = await repo.collectOrphanBlobs();
            toast(n ? `${n} arquivo(s) de mídia sem uso foram removidos.` : 'Nenhuma mídia sem uso encontrada.', 'success');
            refresh();
          }}>Remover mídias sem uso</button>
          <button type="button" className="btn btn-sm" onClick={async () => {
            const ok = await confirmDialog({ title: 'Cópias de segurança', message: 'Manter só as 3 cópias de importação mais recentes de cada projeto? As mais antigas serão apagadas.', confirmLabel: 'Limpar cópias antigas' });
            if (!ok) return;
            const n = await repo.pruneBackups(3);
            toast(n ? `${n} cópia(s) antiga(s) removida(s).` : 'Nenhuma cópia antiga para remover.', 'success');
            refresh();
          }}>Limpar cópias antigas</button>
        </div>
      </Group>
      <Group title="Como os projetos são salvos">
        <ul className="set-list">
          <li>Cada alteração é salva automaticamente no IndexedDB deste navegador, segundos depois.</li>
          <li>Limpar os dados do site, usar janela anônima ou trocar de navegador perde o acesso aos projetos.</li>
          <li>Para backup ou para abrir em outro aparelho, use <strong>Salvar projeto (.jrec)</strong>: o arquivo leva cenas, personagens, cenários e todas as mídias.</li>
          <li>Os links de projeto funcionam só neste navegador; não são links de compartilhamento.</li>
        </ul>
        <button type="button" className="link-btn" onClick={() => openManual('salvamento')}>Saiba mais no manual</button>
      </Group>
    </>
  );
}

function Shortcuts() {
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const out = new Map<string, typeof SHORTCUTS>();
    for (const s of SHORTCUTS.filter((s) => matchesSearch(q, `${s.keys} ${s.action} ${s.category}`))) out.set(s.category, [...(out.get(s.category) ?? []), s]);
    return [...out];
  }, [q]);
  return (
    <>
      <SearchBox value={q} onChange={setQ} placeholder="Buscar comando ou tecla" testId="shortcut-search" />
      {groups.length === 0 && <p className="empty">Nenhum atalho encontrado.</p>}
      {groups.map(([cat, list]) => (
        <Group key={cat} title={cat}>
          <dl className="shortcuts">{list.map((s) => <div key={s.keys} data-testid="shortcut-row"><dt><kbd>{s.keys}</kbd></dt><dd>{s.action}</dd></div>)}</dl>
        </Group>
      ))}
    </>
  );
}

/** Markdown mínimo do CHANGELOG (títulos, listas, negrito, código). */
function MiniMarkdown({ text }: { text: string }) {
  const inline = (s: string) => s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => (part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part.startsWith('`') ? <code key={i}>{part.slice(1, -1)}</code> : part));
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) out.push(<ul key={`u${out.length}`}>{list}</ul>);
    list = [];
  };
  text.split('\n').forEach((line, i) => {
    if (line.startsWith('- ')) list.push(<li key={i}>{inline(line.slice(2))}</li>);
    else {
      flush();
      if (line.startsWith('### ')) out.push(<h5 key={i}>{line.slice(4)}</h5>);
      else if (line.startsWith('## ')) out.push(<h4 key={i}>{line.slice(3)}</h4>);
      else if (line.startsWith('# ')) return;
      else if (line.trim()) out.push(<p key={i}>{inline(line)}</p>);
    }
  });
  flush();
  return <div className="md">{out}</div>;
}

function About() {
  return (
    <>
      <Group title="Recorte Studio">
        <dl className="set-stats">
          <div><dt>Versão</dt><dd data-testid="about-version">{APP_VERSION}</dd></div>
          <div><dt>Formato de projeto</dt><dd>.jrec, versão {JREC_VERSION}</dd></div>
          <div><dt>Funcionamento</dt><dd>100% no navegador, offline, sem servidor</dd></div>
        </dl>
        <p className="hint">Editor de animação narrativa 2D com personagens de recorte. Personagens, cenários e objetos são desenhados por código próprio, sem imagens de terceiros.</p>
      </Group>
      <Group title="Licenças de terceiros">
        <ul className="set-list">
          <li>React, Zustand, Immer, Zod, Dexie, fflate, lucide-react, Inter (fonte): MIT ou OFL.</li>
          <li>webm-muxer e mp4-muxer: MIT.</li>
          <li>libarchive.js (MIT) com libarchive em WebAssembly (BSD-2-Clause), para abrir .7z, .rar e .tar compactados.</li>
          <li>Codecs de vídeo e áudio: os do próprio navegador.</li>
        </ul>
        <p className="hint">Lista completa em docs/LICENCAS.md no repositório do projeto.</p>
      </Group>
      <Group title="Novidades (changelog)">
        <div className="changelog" data-testid="about-changelog"><MiniMarkdown text={changelog.split('\n## ').slice(0, 3).join('\n## ')} /></div>
      </Group>
    </>
  );
}

export function SettingsView({ onClose }: { onClose?: () => void }) {
  const section = useUI((s) => s.settingsSection);
  const p = usePrefs();
  const current = SETTINGS_SECTIONS.find((s) => s.id === section) ?? SETTINGS_SECTIONS[0]!;
  return (
    <div className="settings" data-testid="app-settings">
      <header className="page-head">
        <div><h1>Configurações</h1><p>Valem para todos os projetos deste navegador. Formato, tamanho e FPS de cada projeto ficam em Projeto → Configurações do projeto, dentro do editor.</p></div>
        {onClose && <button type="button" className="btn btn-primary" data-testid="overlay-close" onClick={onClose}>Voltar ao editor</button>}
      </header>
      <div className="settings-body">
        <nav className="settings-nav" aria-label="Categorias">
          {SETTINGS_SECTIONS.map((s) => (
            <button key={s.id} type="button" className={s.id === current.id ? 'is-active' : ''} aria-current={s.id === current.id ? 'page' : undefined} data-testid={`settings-${s.id}`} onClick={() => useUI.setState({ settingsSection: s.id })}>{s.icon}<span>{s.label}</span></button>
          ))}
        </nav>
        <div className="settings-content" key={current.id}>
          <h2>{current.label}</h2>
          {current.id === 'geral' && <General p={p} />}
          {current.id === 'aparencia' && <Appearance p={p} />}
          {current.id === 'editor' && <EditorPrefs />}
          {current.id === 'audio' && <AudioPrefs p={p} />}
          {current.id === 'desempenho' && <Performance p={p} />}
          {current.id === 'armazenamento' && <Storage />}
          {current.id === 'atalhos' && <Shortcuts />}
          {current.id === 'sobre' && <About />}
        </div>
      </div>
    </div>
  );
}
