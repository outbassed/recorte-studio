/** Exportação: quadro, sequência, vídeo e projeto. Mostra o suporte REAL do navegador. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildMontage } from '@/engine/render/montage';
import { detectVideoSupport, exportFramePng, exportPngSequence, exportVideo, resolveOutputSize, RESOLUTIONS, MAX_EXPORT_DIMENSION, type ExportScope, type VideoSupport } from '@/features/export/pipeline';
import { downloadBlob } from '@/features/projects/session';
import { useCurrentScene, useProject } from '@/state/projectStore';
import { transport } from '@/state/transport';
import { closeDialog, toast } from '@/state/uiStore';
import { SelectField, TextField, ToggleField } from '../controls/fields';
import { SliderNumberField } from '../controls/SliderNumberField';
import { Modal } from './Modal';
import { formatTime } from '../timeline/Timeline';

type Kind = 'video' | 'frame' | 'sequence';

export function ExportDialog() {
  const project = useProject();
  const scene = useCurrentScene();
  const [kind, setKind] = useState<Kind>('video');
  const [res, setRes] = useState('720');
  const [customW, setCustomW] = useState(1280);
  const [customH, setCustomH] = useState(720);
  const [fps, setFps] = useState(project?.settings.fps ?? 30);
  const [scope, setScope] = useState<'current' | 'range' | 'project'>('current');
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(scene?.durationMs ?? 1000);
  const [format, setFormat] = useState<'webm' | 'mp4'>('webm');
  const [audio, setAudio] = useState(true);
  const [transparent, setTransparent] = useState(false);
  const [name, setName] = useState(project?.title ?? 'recorte');
  const [support, setSupport] = useState<VideoSupport | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);

  const size = project ? resolveOutputSize(project.settings, res === 'custom' ? null : Number(res), res === 'custom' ? { w: customW, h: customH } : undefined) : { w: 2, h: 2 };
  useEffect(() => {
    void detectVideoSupport(size.w, size.h, fps).then(setSupport);
  }, [size.w, size.h, fps]);

  const totalMs = useMemo(() => {
    if (!project || !scene) return 0;
    if (scope === 'project') return buildMontage(project).totalMs;
    if (scope === 'range') return Math.max(0, Math.min(rangeEnd, scene.durationMs) - rangeStart);
    return scene.durationMs;
  }, [project, scene, scope, rangeStart, rangeEnd]);

  if (!project || !scene) return null;
  const expScope: ExportScope = scope === 'project' ? { kind: 'project' } : scope === 'range' ? { kind: 'range', sceneId: scene.id, startMs: rangeStart, endMs: rangeEnd } : { kind: 'current', sceneId: scene.id };
  const frames = Math.ceil((totalMs / 1000) * fps);
  const file = name.replace(/[\\/:*?"<>|]+/g, '_') || 'recorte';

  const canVideo = support ? (format === 'webm' ? !!support.webmVideoCodec || !!support.mediaRecorder : support.mp4Video) : false;
  const run = async () => {
    setBusy(true);
    setError('');
    setResult(null);
    setProgress({ done: 0, total: 1, label: 'Preparando…' });
    abort.current = new AbortController();
    const signal = abort.current.signal;
    try {
      if (kind === 'frame') {
        const blob = await exportFramePng(project, scene.id, transport.getState().timeMs, size, transparent);
        downloadBlob(blob, `${file}.png`);
        setResult(`PNG de ${size.w}×${size.h} salvo.`);
      } else if (kind === 'sequence') {
        const blob = await exportPngSequence(project, expScope, size, fps, { transparent, onProgress: setProgress, signal });
        downloadBlob(blob, `${file}-quadros.zip`);
        setResult(`${frames} quadros PNG de ${size.w}×${size.h} em um ZIP.`);
      } else if (kind === 'video') {
        const r = await exportVideo(project, expScope, { format, fps, size, includeAudio: audio, onProgress: setProgress, signal });
        downloadBlob(r.blob, `${file}.${format}`);
        setResult(`Vídeo ${format.toUpperCase()} salvo: ${size.w}×${size.h}, ${r.frames} quadros, ${(r.blob.size / 1048576).toFixed(1).replace('.', ',')} MB, ${r.hasAudio ? 'com áudio' : 'sem áudio'}.${r.warnings.length ? ` ${r.warnings.join(' ')}` : ''}`);
      }
      toast('Exportação concluída.', 'success');
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') setError('Exportação cancelada.');
      else setError(e instanceof Error ? e.message : 'Falha na exportação.');
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const needsSize = kind === 'video' || kind === 'frame' || kind === 'sequence';
  const needsRange = kind === 'video' || kind === 'sequence';
  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <Modal title="Exportar vídeo ou imagem" size="md" testId="export-dialog" onClose={() => { if (!busy) closeDialog(); }}
      footer={<>
        {busy ? <button type="button" className="btn" data-testid="export-cancel" onClick={() => abort.current?.abort()}>Cancelar</button> : <button type="button" className="btn" onClick={closeDialog}>Fechar</button>}
        <button type="button" className="btn btn-primary" data-testid="export-run" disabled={busy || (kind === 'video' && !canVideo)} onClick={() => void run()}>{busy ? 'Exportando…' : 'Exportar'}</button>
      </>}>
      <SelectField label="O que exportar" value={kind} testId="export-kind" onChange={(v) => setKind(v as Kind)} options={[
        { id: 'video', label: 'Vídeo' }, { id: 'frame', label: 'Quadro atual (PNG)' }, { id: 'sequence', label: 'Sequência de PNGs (ZIP)' },
      ]} />
      <TextField label="Nome do arquivo" value={name} testId="export-name" onChange={setName} />
      {kind === 'video' && (
        <SelectField label="Formato" value={format} testId="export-format" onChange={(v) => setFormat(v as 'webm' | 'mp4')} options={[{ id: 'webm', label: 'WebM' }, ...(support?.mp4Video ? [{ id: 'mp4', label: 'MP4 (H.264, detectado neste navegador)' }] : [])]} />
      )}
      {needsRange && (
        <SelectField label="Abrangência" value={scope} testId="export-scope" onChange={(v) => setScope(v as typeof scope)} options={[{ id: 'current', label: `Cena atual (${scene.name})` }, { id: 'range', label: 'Trecho da cena atual' }, { id: 'project', label: `Projeto completo (${project.sceneOrder.length} cenas)` }]} />
      )}
      {needsRange && scope === 'range' && (
        <>
          <SliderNumberField label="Início do trecho" unit="s" display={0.001} min={0} max={scene.durationMs} sliderMin={0} sliderMax={scene.durationMs / 1000} step={0.1} decimals={2} value={rangeStart} onChange={setRangeStart} />
          <SliderNumberField label="Fim do trecho" unit="s" display={0.001} min={0} max={scene.durationMs} sliderMin={0} sliderMax={scene.durationMs / 1000} step={0.1} decimals={2} value={rangeEnd} onChange={setRangeEnd} />
        </>
      )}
      {needsSize && (
        <>
          <SelectField label="Resolução" value={res} testId="export-res" onChange={setRes} options={[...RESOLUTIONS.map((r) => ({ id: r.id, label: r.label })), { id: 'custom', label: 'Personalizada' }]} />
          {res === 'custom' && (
            <>
              <SliderNumberField label="Largura" unit="px" min={16} max={MAX_EXPORT_DIMENSION} sliderMin={160} sliderMax={3840} decimals={0} value={customW} onChange={(v) => setCustomW(Math.round(v))} />
              <SliderNumberField label="Altura" unit="px" min={16} max={MAX_EXPORT_DIMENSION} sliderMin={160} sliderMax={3840} decimals={0} value={customH} onChange={(v) => setCustomH(Math.round(v))} />
              <p className="hint">A imagem é ajustada para preencher essa proporção, cortando o excedente pelo centro.</p>
            </>
          )}
          <p className="hint" data-testid="export-size">Saída: {size.w}×{size.h} px (limite de {MAX_EXPORT_DIMENSION} px por lado)</p>
        </>
      )}
      {needsRange && (
        <SelectField label="Quadros por segundo" value={String(fps)} testId="export-fps" onChange={(v) => setFps(Number(v))} options={[24, 25, 30, 60].map((f) => ({ id: String(f), label: `${f} fps` }))} />
      )}
      {needsRange && <p className="hint">Duração: {formatTime(totalMs)} · {frames} quadros</p>}
      {kind === 'video' && <ToggleField label="Incluir áudio" testId="export-audio" checked={audio} onChange={setAudio} />}
      {(kind === 'frame' || kind === 'sequence') && <ToggleField label="Fundo transparente (remove o cenário)" checked={transparent} onChange={setTransparent} />}
      {kind === 'video' && support && (
        <div className="support-box" data-testid="export-support">
          <strong>Neste navegador:</strong>
          <ul>
            <li>{support.webmVideoCodec ? `WebM por WebCodecs (${support.webmVideoCodec.startsWith('vp09') ? 'VP9' : 'VP8'}): quadro a quadro, com tempo exato.` : support.mediaRecorder ? 'Sem WebCodecs: WebM em tempo real via MediaRecorder (sincronia aproximada).' : 'Nenhum codificador WebM disponível.'}</li>
            <li>Áudio: {support.webmAudio ? 'Opus disponível.' : support.mediaRecorder ? 'pelo MediaRecorder, se houver.' : 'indisponível.'}</li>
            <li>MP4: {support.mp4Video ? `H.264 disponível${support.mp4Audio ? ' com AAC' : ', sem AAC (vídeo sairia mudo)'}.` : 'não disponível aqui.'}</li>
          </ul>
        </div>
      )}
      <p className="hint">Para guardar o projeto editável, use <strong>Salvar projeto (.jrec)</strong> na barra superior.</p>
      <p className="hint">Sai apenas o quadro exportável: guias, seleção, réguas e a área escurecida nunca entram no arquivo.</p>
      {progress && (
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso da exportação" data-testid="export-progress">
          <div className="progress-bar" style={{ width: `${pct}%` }} />
          <span>{progress.label} · {pct}%</span>
        </div>
      )}
      {result && <p className="ok-box" role="status" data-testid="export-result">{result}</p>}
      {error && <p className="error-box" role="alert" data-testid="export-error">{error}</p>}
    </Modal>
  );
}
