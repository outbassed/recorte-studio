/** Configurações do projeto, atalhos, relatório de importação e feedback global. */
import { SHORTCUTS } from '@/features/shortcuts';
import { useEffect, useRef, useState } from 'react';
import { ASPECT_PRESETS, frameSize } from '@/engine/model/schema';
import { totalDurationMs } from '@/engine/model/ops';
import { useSession } from '@/features/projects/session';
import { commit, useProject } from '@/state/projectStore';
import { closeContextMenu, closeDialog, useFeedback } from '@/state/uiStore';
import { repo } from '@/storage/db';
import { ColorField, SelectField, TextField } from '../controls/fields';
import { SliderNumberField } from '../controls/SliderNumberField';
import { Modal } from './Modal';
import { formatTime } from '../timeline/Timeline';

export function SettingsDialog() {
  const project = useProject();
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => { void repo.storageEstimate().then(setStorage); }, []);
  if (!project) return null;
  const s = project.settings;
  const isPreset = ASPECT_PRESETS.some((a) => a.id === s.aspectRatio);
  const fs = frameSize(s);
  return (
    <Modal title="Configurações do projeto (formato, tamanho e FPS)" testId="settings-dialog" onClose={closeDialog}>
      <TextField label="Nome do projeto" value={project.title} testId="project-title" onChange={(v) => commit('Renomear projeto', (d) => { d.title = v; }, { coalesce: 'title' })} />
      <SelectField label="Formato de saída" value={isPreset ? s.aspectRatio : 'custom'} testId="aspect" onChange={(v) => {
        const p = ASPECT_PRESETS.find((a) => a.id === v);
        commit('Mudar formato', (d) => {
          if (p) {
            d.settings.aspectRatio = p.id;
            d.settings.width = p.w;
            d.settings.height = p.h;
          } else d.settings.aspectRatio = 'custom';
        });
      }} options={[...ASPECT_PRESETS.map((a) => ({ id: a.id, label: a.label })), { id: 'custom', label: 'Personalizado' }]} />
      {!isPreset && (
        <>
          <SliderNumberField label="Largura" unit="px" min={16} max={8192} sliderMin={320} sliderMax={3840} decimals={0} value={s.width} onChange={(v) => commit('Largura', (d) => { d.settings.width = Math.max(16, Math.round(v)); }, { coalesce: 'w' })} />
          <SliderNumberField label="Altura" unit="px" min={16} max={8192} sliderMin={320} sliderMax={3840} decimals={0} value={s.height} onChange={(v) => commit('Altura', (d) => { d.settings.height = Math.max(16, Math.round(v)); }, { coalesce: 'h' })} />
        </>
      )}
      <p className="hint">Trocar o formato só muda a moldura: nada se move. Quadro atual: {Math.round(fs.w)}×{fs.h} unidades de mundo.</p>
      <SelectField label="Quadros por segundo do projeto" value={String(s.fps)} onChange={(v) => commit('FPS', (d) => { d.settings.fps = Number(v); })} options={[24, 25, 30, 60].map((f) => ({ id: String(f), label: `${f} fps` }))} />
      <SliderNumberField label="Textura de papel" unit="%" display={100} min={0} max={1} sliderMin={0} sliderMax={100} value={s.paperTexture} testId="paper" onChange={(v) => commit('Textura', (d) => { d.settings.paperTexture = v; }, { coalesce: 'paper' })} />
      <SliderNumberField label="Volume geral" unit="%" display={100} min={0} max={2} sliderMin={0} sliderMax={150} value={s.masterVolume} onChange={(v) => commit('Volume', (d) => { d.settings.masterVolume = v; }, { coalesce: 'vol' })} />
      <ColorField label="Cor de fundo do quadro" value={s.backgroundColor} onChange={(v) => commit('Cor de fundo', (d) => { d.settings.backgroundColor = v; }, { coalesce: 'bgc' })} />
      <p className="hint">Duração total: {formatTime(totalDurationMs(project))} em {project.sceneOrder.length} cena(s).</p>
      {storage && <p className="hint">Armazenamento do navegador: {(storage.usage / 1048576).toFixed(1).replace('.', ',')} MB usados de {(storage.quota / 1048576).toFixed(0)} MB. Seus projetos ficam só neste navegador: faça backups em Exportar.</p>}
    </Modal>
  );
}



export function ShortcutsDialog() {
  return (
    <Modal title="Atalhos de teclado" size="sm" testId="shortcuts" onClose={closeDialog}>
      <dl className="shortcuts">
        {SHORTCUTS.map((x) => <div key={x.keys}><dt><kbd>{x.keys}</kbd></dt><dd>{x.action}</dd></div>)}
      </dl>
    </Modal>
  );
}

export function ImportReportDialog() {
  const report = useSession((s) => s.report);
  if (!report) return null;
  return (
    <Modal title={`Importação da versão ${report.sourceVersion}`} testId="import-report" onClose={closeDialog} footer={<button type="button" className="btn btn-primary" onClick={closeDialog}>Continuar</button>}>
      <p className="ok-box">Projeto convertido. O JSON original foi guardado como cópia de segurança e o arquivo que você escolheu não foi alterado.</p>
      <h3 className="group-title">Importados</h3>
      <ul className="report" data-testid="report-counts">
        <li>{report.counts.scenes} cena(s)</li>
        <li>{report.counts.characters} personagem(ns)</li>
        <li>{report.counts.objects} objeto(s)</li>
        <li>{report.counts.dialogues} fala(s)</li>
        <li>{report.counts.actions} ação(ões)</li>
        <li>{report.counts.keyframes} keyframe(s)</li>
      </ul>
      <h3 className="group-title">Adaptados</h3>
      <ul className="report">{report.adapted.map((a) => <li key={a}>{a}</li>)}</ul>
      <h3 className="group-title">Não compatíveis</h3>
      {report.incompatible.length === 0 ? <p className="hint">Nenhum.</p> : <ul className="report" data-testid="report-incompatible">{report.incompatible.map((a) => <li key={a}>{a}</li>)}</ul>}
    </Modal>
  );
}

export function FeedbackLayer() {
  const { toasts, confirm, prompt, context } = useFeedback();
  const menuRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState('');
  useEffect(() => { if (prompt) setValue(prompt.value); }, [prompt]);
  useEffect(() => {
    if (!context || !menuRef.current) return;
    const el = menuRef.current;
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth) el.style.left = `${Math.max(4, innerWidth - r.width - 6)}px`;
    if (r.bottom > innerHeight) el.style.top = `${Math.max(4, innerHeight - r.height - 6)}px`;
    el.querySelector<HTMLElement>('button:not([disabled])')?.focus();
  }, [context]);
  return (
    <>
      <div className="toasts" role="status" aria-live="polite" data-testid="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast is-${t.kind}`}>
            {t.text}
            {t.action && <button type="button" className="btn btn-sm" onClick={t.action.run}>{t.action.label}</button>}
          </div>
        ))}
      </div>
      {confirm && (
        <Modal title={confirm.title} size="sm" testId="confirm-dialog" onClose={() => { confirm.resolve(false); useFeedback.setState({ confirm: null }); }} footer={<>
          <button type="button" className="btn" data-testid="confirm-cancel" onClick={() => { confirm.resolve(false); useFeedback.setState({ confirm: null }); }}>Cancelar</button>
          {confirm.alt && <button type="button" className="btn" onClick={() => { confirm.resolve(confirm.alt!.value); useFeedback.setState({ confirm: null }); }}>{confirm.alt.label}</button>}
          <button type="button" className={`btn ${confirm.danger ? 'btn-danger' : 'btn-primary'}`} data-testid="confirm-ok" onClick={() => { confirm.resolve(true); useFeedback.setState({ confirm: null }); }}>{confirm.confirmLabel}</button>
        </>}>
          <p>{confirm.message}</p>
        </Modal>
      )}
      {prompt && (
        <Modal title={prompt.title} size="sm" testId="prompt-dialog" onClose={() => { prompt.resolve(null); useFeedback.setState({ prompt: null }); }} footer={<>
          <button type="button" className="btn" onClick={() => { prompt.resolve(null); useFeedback.setState({ prompt: null }); }}>Cancelar</button>
          <button type="button" className="btn btn-primary" data-testid="prompt-ok" onClick={() => { prompt.resolve(value.trim() || null); useFeedback.setState({ prompt: null }); }}>Confirmar</button>
        </>}>
          <label className="field">
            <span className="field-label">{prompt.label}</span>
            <input className="input" autoFocus value={value} data-testid="prompt-input" onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => {
              if (e.key === 'Enter') {
                prompt.resolve(value.trim() || null);
                useFeedback.setState({ prompt: null });
              }
            }} />
          </label>
        </Modal>
      )}
      {context && (
        <div className="ctx-back" onPointerDown={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}>
          <div ref={menuRef} className="ctx-menu" role="menu" aria-label={context.title ?? 'Menu'} data-testid="context-menu" style={{ left: context.x, top: context.y }} onPointerDown={(e) => e.stopPropagation()} onKeyDown={(e) => {
            if (e.key === 'Escape') closeContextMenu();
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])];
              const i = items.indexOf(document.activeElement as HTMLElement);
              items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
            }
            e.stopPropagation();
          }}>
            {context.title && <div className="ctx-title">{context.title}</div>}
            {context.items.map((it) => (
              <button key={it.label} type="button" role="menuitem" className={it.danger ? 'is-danger' : ''} disabled={it.disabled} onClick={() => { closeContextMenu(); it.onSelect(); }}>{it.label}</button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
