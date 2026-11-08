/**
 * Editor de quadros do Criador de Objetos: animações salvas NO objeto (fogo, porta, água…).
 * A prévia "Tocar" aqui usa requestAnimationFrame só para mostrar; a cena e a exportação escolhem
 * o quadro por função pura do tempo (clipFrameIndex), então tocar/pausar/buscar dá sempre o mesmo quadro.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ClipboardPaste, Copy, Pause, Play, Plus, Trash2 } from 'lucide-react';
import { CLIP_MODES, type CustomObject, type ObjectClip, type Piece, type Project } from '@/engine/model/schema';
import { deepClone, uid } from '@/engine/model/ids';
import { clipDuration, clipFrameIndex, renderPieces } from '@/engine/world/pieces';
import { previewAssetUrl } from '@/features/library/assets';
import { n } from '@/engine/render/svg';
import { confirmDialog, promptDialog, toast } from '@/state/uiStore';
import { IconButton } from '../controls/fields';

export const MAX_CLIPS = 16;
export const MAX_FRAMES = 240;
const MODE_LABELS: Record<ObjectClip['mode'], string> = { loop: 'Repetir (loop)', once: 'Uma vez', pingpong: 'Vai e volta' };

/** O que está sendo editado: o desenho estático (null) ou um quadro de uma animação. */
export interface Editing { clip: string; frame: number }

let frameClipboard: Piece[] | null = null;
const freshIds = (pieces: Piece[]) => deepClone(pieces);

/** Peças do alvo de edição (no objeto do rascunho ou no atual). */
export function piecesOf(o: CustomObject, e: Editing | null): Piece[] | null {
  if (!e) return o.pieces;
  return o.clips.find((c) => c.id === e.clip)?.frames[e.frame]?.pieces ?? null;
}

function FrameThumb({ obj, project, pieces }: { obj: CustomObject; project: Project; pieces: Piece[] }) {
  const html = useMemo(() => renderPieces(pieces, { project, url: previewAssetUrl, idPrefix: 'ft' }), [pieces, project]);
  const s = Math.max(obj.width, obj.height) * 1.1;
  return <svg width={44} height={44} viewBox={`${n(-s / 2)} ${n(-obj.height - (s - obj.height) / 2)} ${n(s)} ${n(s)}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function AnimationBar({ obj, project, editing, setEditing, set, onion, setOnion }: {
  obj: CustomObject; project: Project; editing: Editing | null; setEditing: (e: Editing | null) => void;
  set: (label: string, fn: (o: CustomObject) => void, coalesce?: string) => void;
  onion: boolean; setOnion: (v: boolean) => void;
}) {
  const clip = editing ? obj.clips.find((c) => c.id === editing.clip) : undefined;
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0);
  // Se a animação/quadro sumiu (desfazer, excluir), volta para algo que existe.
  useEffect(() => {
    if (editing && (!clip || !clip.frames[editing.frame])) setEditing(clip?.frames.length ? { clip: clip.id, frame: clip.frames.length - 1 } : null);
  }, [editing, clip, setEditing]);
  useEffect(() => {
    if (!playing || !clip) return;
    const t0 = performance.now();
    const tick = () => {
      const i = clipFrameIndex(clip, performance.now() - t0);
      setEditing({ clip: clip.id, frame: i });
      if (clip.mode === 'once' && performance.now() - t0 >= clipDuration(clip)) { setPlaying(false); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing, clip?.id, clip?.frames.length, clip?.mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const newClip = async () => {
    if (obj.clips.length >= MAX_CLIPS) { toast(`Limite de ${MAX_CLIPS} animações por objeto.`, 'error'); return; }
    const name = await promptDialog('Nova animação', 'Nome da animação (ex.: Aceso, Abrindo)', obj.clips.length ? `Animação ${obj.clips.length + 1}` : 'Animação');
    if (!name) return;
    const c: ObjectClip = { id: uid('clip'), name, mode: 'loop', frames: [{ id: uid('frm'), durationMs: 120, pieces: freshIds(obj.pieces) }] };
    set('Nova animação', (o) => {
      o.clips.push(c);
      if (!o.defaultClip) o.defaultClip = c.id;
    });
    setEditing({ clip: c.id, frame: 0 });
    toast('Animação criada com 1 quadro (cópia do desenho). Use "+ Quadro" e mude cada quadro.');
  };
  const withClip = (label: string, fn: (c: ObjectClip) => void, coalesce?: string) => set(label, (o) => {
    const c = o.clips.find((x) => x.id === editing?.clip);
    if (c) fn(c);
  }, coalesce);
  const frameIdx = editing?.frame ?? 0;
  const frame = clip?.frames[frameIdx];

  return (
    <div className="anim-bar" data-testid="anim-bar">
      <div className="anim-row">
        <label className="anim-label">Editando
          <select className="cat-select" data-testid="anim-clip" value={editing?.clip ?? ''} onChange={(e) => { setPlaying(false); setEditing(e.target.value ? { clip: e.target.value, frame: 0 } : null); }}>
            <option value="">Desenho estático</option>
            {obj.clips.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.frames.length} quadro{c.frames.length === 1 ? '' : 's'})</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-sm" data-testid="anim-new" onClick={() => void newClip()}><Plus size={13} /> Nova animação</button>
        {clip && <>
          <select className="cat-select" aria-label="Modo de reprodução" data-testid="anim-mode" value={clip.mode} onChange={(e) => withClip('Modo da animação', (c) => { c.mode = e.target.value as ObjectClip['mode']; })}>
            {CLIP_MODES.map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
          </select>
          <label className="anim-check"><input type="checkbox" data-testid="anim-default" checked={obj.defaultClip === clip.id} onChange={(e) => set('Animação padrão', (o) => { o.defaultClip = e.target.checked ? clip.id : ''; })} /> Toca ao inserir</label>
          <button type="button" className="btn btn-sm" onClick={async () => { const v = await promptDialog('Renomear animação', 'Nome', clip.name); if (v) withClip('Renomear animação', (c) => { c.name = v; }); }}>Renomear</button>
          <IconButton label={`Excluir a animação ${clip.name}`} danger testId="anim-delete" onClick={async () => {
            const ok = await confirmDialog({ title: 'Excluir animação', message: `Excluir "${clip.name}" e os ${clip.frames.length} quadro(s)? Cópias nas cenas que usavam esta animação voltam ao padrão do objeto. Ctrl+Z desfaz.`, confirmLabel: 'Excluir', danger: true });
            if (!ok) return;
            set('Excluir animação', (o) => { o.clips = o.clips.filter((c) => c.id !== clip.id); if (o.defaultClip === clip.id) o.defaultClip = ''; });
            setEditing(null);
          }}><Trash2 size={14} /></IconButton>
        </>}
        {!clip && <p className="hint">{obj.clips.length ? 'Escolha uma animação para editar os quadros.' : 'Objeto estático. "Nova animação" cria quadros salvos no objeto (ex.: fogo, porta, água): toda cópia nas cenas anima sozinha, também no vídeo.'}</p>}
      </div>
      {clip && (
        <div className="anim-row">
          <ol className="anim-frames" data-testid="anim-frames" aria-label={`Quadros de ${clip.name}`}>
            {clip.frames.map((f, i) => (
              <li key={f.id}>
                <button type="button" className={`anim-frame${i === frameIdx ? ' is-active' : ''}`} data-testid="anim-frame" data-index={i} aria-pressed={i === frameIdx} aria-label={`Quadro ${i + 1}, ${f.durationMs} ms`} onClick={() => { setPlaying(false); setEditing({ clip: clip.id, frame: i }); }}>
                  <FrameThumb obj={obj} project={project} pieces={f.pieces} />
                  <small>{i + 1} · {f.durationMs} ms</small>
                </button>
              </li>
            ))}
          </ol>
          <div className="anim-tools">
            <IconButton label={playing ? 'Pausar prévia' : 'Tocar prévia'} testId="anim-play" active={playing} onClick={() => setPlaying(!playing)}>{playing ? <Pause size={14} /> : <Play size={14} />}</IconButton>
            <button type="button" className="btn btn-sm" data-testid="anim-frame-add" disabled={clip.frames.length >= MAX_FRAMES} onClick={() => {
              withClip('Novo quadro', (c) => { const src = c.frames[frameIdx]; c.frames.splice(frameIdx + 1, 0, { id: uid('frm'), durationMs: src?.durationMs ?? 120, pieces: freshIds(src?.pieces ?? obj.pieces) }); });
              setEditing({ clip: clip.id, frame: frameIdx + 1 });
            }}><Plus size={13} /> Quadro</button>
            <IconButton label="Copiar quadro" testId="anim-frame-copy" onClick={() => { if (frame) { frameClipboard = deepClone(frame.pieces); toast('Quadro copiado.'); } }}><Copy size={14} /></IconButton>
            <IconButton label="Colar no quadro (substitui o desenho)" testId="anim-frame-paste" disabled={!frameClipboard} onClick={() => { const p = frameClipboard; if (p) withClip('Colar quadro', (c) => { const f = c.frames[frameIdx]; if (f) f.pieces = deepClone(p); }); }}><ClipboardPaste size={14} /></IconButton>
            <IconButton label="Mover quadro para a esquerda" testId="anim-frame-left" disabled={frameIdx === 0} onClick={() => { withClip('Reordenar quadro', (c) => { const [f] = c.frames.splice(frameIdx, 1); c.frames.splice(frameIdx - 1, 0, f!); }); setEditing({ clip: clip.id, frame: frameIdx - 1 }); }}><ArrowLeft size={14} /></IconButton>
            <IconButton label="Mover quadro para a direita" testId="anim-frame-right" disabled={frameIdx >= clip.frames.length - 1} onClick={() => { withClip('Reordenar quadro', (c) => { const [f] = c.frames.splice(frameIdx, 1); c.frames.splice(frameIdx + 1, 0, f!); }); setEditing({ clip: clip.id, frame: frameIdx + 1 }); }}><ArrowRight size={14} /></IconButton>
            <IconButton label="Excluir quadro" danger testId="anim-frame-del" disabled={clip.frames.length <= 1} onClick={() => { withClip('Excluir quadro', (c) => { c.frames.splice(frameIdx, 1); }); setEditing({ clip: clip.id, frame: Math.max(0, frameIdx - 1) }); }}><Trash2 size={14} /></IconButton>
            <label className="anim-label">Duração
              <input className="input input-sm" type="number" min={20} max={10000} step={10} inputMode="numeric" data-testid="anim-frame-ms" value={frame?.durationMs ?? 120}
                onKeyDown={(e) => e.stopPropagation()}
                onChange={(e) => { const v = Math.round(Number(e.target.value)); if (Number.isFinite(v)) withClip('Duração do quadro', (c) => { const f = c.frames[frameIdx]; if (f) f.durationMs = Math.min(10000, Math.max(20, v)); }, `frm-ms-${frame?.id}`); }} /> ms
            </label>
            <button type="button" className="btn btn-sm" data-testid="anim-all-ms" onClick={async () => {
              const v = Number(await promptDialog('Duração de todos os quadros', 'Milissegundos por quadro (20 a 10000)', String(frame?.durationMs ?? 120)));
              if (Number.isFinite(v) && v > 0) withClip('Duração dos quadros', (c) => { for (const f of c.frames) f.durationMs = Math.min(10000, Math.max(20, Math.round(v))); });
            }}>Todos</button>
            <label className="anim-check"><input type="checkbox" data-testid="anim-onion" checked={onion} onChange={(e) => setOnion(e.target.checked)} /> Papel vegetal</label>
            <small className="hint" data-testid="anim-total">Total: {clipDuration(clip)} ms</small>
          </div>
        </div>
      )}
    </div>
  );
}
