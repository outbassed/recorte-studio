/**
 * Modo simples: "passos" da cena (quem, o quê, quando, quanto tempo). Opera sobre os
 * MESMOS clips e keyframes da timeline avançada; alternar não converte nem perde nada.
 */
import { useState } from 'react';
import { Pause, Play, Plus, Square, Trash2 } from 'lucide-react';
import { ACTION_PRESETS, addDialogue, deleteClip, findClip, FRAMING_PRESETS, frameCamera, insertAction, sceneOf, type FramingPreset } from '@/engine/model/ops';
import { getAction } from '@/engine/animation/actions';
import type { AnyClip, Project } from '@/engine/model/schema';
import { commit, useCurrentScene, useProject } from '@/state/projectStore';
import { seek, stop, togglePlay, transport, useTransport } from '@/state/transport';
import { selectTimeline, toast } from '@/state/uiStore';
import { IconButton } from '../controls/fields';
import { parseNumberInput } from '../controls/SliderNumberField';
import { formatTime } from './Timeline';

const MAX_STEP_S = 3600;
/** Valida início e duração de um passo; devolve a mensagem de erro ou null. */
export function validateStep(startS: number | null | undefined, durS: number | null | undefined): string | null {
  if (startS === null || startS === undefined || !Number.isFinite(startS)) return 'Início inválido: use um número em segundos, por exemplo 1,5.';
  if (startS < 0) return 'O início não pode ser negativo.';
  if (startS > MAX_STEP_S) return 'O início passa de 1 hora.';
  if (durS === null || durS === undefined || !Number.isFinite(durS)) return 'Duração inválida: use um número em segundos, por exemplo 2.';
  if (durS <= 0) return 'A duração precisa ser maior que zero.';
  if (durS < 0.05) return 'A duração mínima é 0,05 s.';
  if (durS > MAX_STEP_S) return 'A duração passa de 1 hora.';
  return null;
}

const SIMPLE_ACTIONS = ACTION_PRESETS.filter((a) => !a.needs || a.needs === 'target').filter((a) => a.id !== 'talk' && a.id !== 'stop');
const sec = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');

export function SimpleTimeline() {
  const project = useProject();
  const scene = useCurrentScene();
  const playing = useTransport((s) => s.playing);
  const time = useTransport((s) => (s.playing ? -1 : s.timeMs));
  const characters = scene ? Object.values(scene.nodes).filter((n) => n.kind === 'character') : [];
  const [who, setWho] = useState('');
  const [what, setWhat] = useState('talk');
  const [at, setAt] = useState('');
  const [dur, setDur] = useState('2');
  const [text, setText] = useState('');
  const [target, setTarget] = useState('');
  if (!project || !scene) return null;
  const actor = characters.find((c) => c.id === who) ?? characters[0];

  const steps: Array<{ clip: AnyClip; nodeName: string; label: string }> = [];
  for (const t of scene.tracks) {
    if (t.type === 'action' || t.type === 'dialogue') {
      const name = scene.nodes[t.targetNodeId]?.name ?? '?';
      for (const c of t.clips) steps.push({ clip: c, nodeName: name, label: c.kind === 'dialogue' ? `fala “${c.text}”` : (getAction(c.action)?.label ?? c.action).toLowerCase() });
    }
  }
  steps.sort((a, b) => a.clip.startMs - b.clip.startMs);

  const add = () => {
    const startS = at.trim() ? parseNumberInput(at) : (time < 0 ? transport.getState().timeMs : time) / 1000;
    const durS = dur.trim() ? parseNumberInput(dur) : 2;
    const problem = validateStep(startS, what.startsWith('cam:') ? 1 : durS);
    if (problem) {
      toast(problem, 'error');
      return;
    }
    const startMs = Math.round(startS! * 1000);
    const durMs = Math.round(durS! * 1000);
    if (what.startsWith('cam:')) {
      const preset = what.slice(4) as FramingPreset;
      const ids = [actor?.id, target].filter(Boolean) as string[];
      let ok = false;
      commit('Enquadrar câmera', (d) => { ok = frameCamera(d as Project, sceneOf(d as Project, scene.id), preset, ids, startMs, 0); });
      if (!ok) toast('Esse enquadramento precisa de personagem(ns) escolhido(s).', 'error');
      return;
    }
    if (!actor) {
      toast('Coloque um personagem na cena primeiro.', 'error');
      return;
    }
    if (what === 'talk') {
      if (!text.trim()) {
        toast('Escreva o texto da fala.', 'error');
        return;
      }
      commit('Adicionar fala', (d) => void addDialogue(sceneOf(d as Project, scene.id), actor.id, text.trim(), startMs, durMs));
      setText('');
    } else {
      const x = scene.nodes[actor.id]!.transform.x;
      commit('Adicionar ação', (d) => void insertAction(d as Project, sceneOf(d as Project, scene.id), actor.id, what, startMs, { durationMs: durMs, targetNodeId: target || null, targetX: target ? scene.nodes[target]?.transform.x : x + 300 }));
    }
    setAt(sec(startMs + durMs));
  };

  // Keyframes de propriedades (criados em Propriedades) não são passos: ficam na timeline avançada.
  const keyTracks = scene.tracks.filter((t) => t.type === 'property' && t.keyframes.length);
  const keyCount = keyTracks.reduce((n, t) => n + (t.type === 'property' ? t.keyframes.length : 0), 0);

  const editClip = (id: string, field: 'startMs' | 'durationMs', value: string) => {
    const v = parseNumberInput(value);
    const problem = field === 'startMs' ? validateStep(v, 1) : validateStep(0, v);
    if (problem || v === null) {
      toast(problem ?? 'Valor inválido.', 'error');
      return;
    }
    commit('Editar passo', (d) => {
      const f = findClip(sceneOf(d as Project, scene.id), id);
      if (f) f.clip[field] = Math.max(field === 'durationMs' ? 50 : 0, Math.round(v * 1000));
    }, { coalesce: `simple-${id}-${field}` });
  };

  return (
    <section className="simple-tl" aria-label="Modo simples" data-testid="simple-timeline">
      <div className="tl-transport">
        <button type="button" className="play-btn" aria-label={playing ? 'Pausar' : 'Reproduzir'} data-testid="play" onClick={togglePlay}>{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        <IconButton label="Parar" onClick={stop}><Square size={15} /></IconButton>
        <span className="tl-clock"><span data-testid="clock">{formatTime(time < 0 ? transport.getState().timeMs : time)}</span><small>/ {formatTime(scene.durationMs)}</small></span>
        <span className="tl-spacer" />
        <small className="hint">Mesmos dados da timeline avançada.</small>
      </div>
      <div className="simple-body">
        <form className="simple-form" onSubmit={(e) => { e.preventDefault(); add(); }}>
          <label>Quem<select className="input" data-testid="simple-who" value={actor?.id ?? ''} onChange={(e) => setWho(e.target.value)}>{characters.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
          <label>O quê<select className="input" data-testid="simple-what" value={what} onChange={(e) => setWhat(e.target.value)}>
            <option value="talk">Falar</option>
            <optgroup label="Ações">{SIMPLE_ACTIONS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</optgroup>
            <optgroup label="Câmera">{FRAMING_PRESETS.map((f) => <option key={f.id} value={`cam:${f.id}`}>{f.label}</option>)}</optgroup>
          </select></label>
          {what === 'talk' && <label className="is-wide">Texto<input className="input" data-testid="simple-text" value={text} placeholder="O que o personagem diz?" onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setText(e.target.value)} /></label>}
          {(what === 'look' || what === 'walk' || what === 'run' || what === 'cam:two-shot') && (
            <label>{what === 'look' ? 'Olhar para' : what === 'cam:two-shot' ? 'Com' : 'Até'}<select className="input" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">—</option>{Object.values(scene.nodes).filter((n) => n.id !== actor?.id).map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}</select></label>
          )}
          <label>Em (s)<input className="input" inputMode="decimal" data-testid="simple-at" value={at} placeholder={sec(time < 0 ? 0 : time)} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setAt(e.target.value)} /></label>
          {!what.startsWith('cam:') && <label>Duração (s)<input className="input" inputMode="decimal" data-testid="simple-dur" value={dur} onKeyDown={(e) => e.stopPropagation()} onChange={(e) => setDur(e.target.value)} /></label>}
          <button type="submit" className="btn btn-primary" data-testid="simple-add"><Plus size={15} /> Adicionar</button>
        </form>
        <ol className="simple-steps" data-testid="simple-steps">
          {steps.length === 0 && <li className="empty">Nenhum passo ainda. Escolha quem, o quê e quando.</li>}
          {steps.map(({ clip, nodeName, label }) => (
            <li key={clip.id} className="simple-step" data-testid="simple-step">
              <button type="button" className="simple-step-main" onClick={() => { seek(clip.startMs); }}>
                <strong>{nodeName}</strong> <span>{label}</span>
              </button>
              <label>em <input className="input input-sm" aria-label={`Início de ${label}`} defaultValue={sec(clip.startMs)} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => editClip(clip.id, 'startMs', e.target.value)} />s</label>
              <label>por <input className="input input-sm" aria-label={`Duração de ${label}`} defaultValue={sec(clip.durationMs)} onKeyDown={(e) => e.stopPropagation()} onBlur={(e) => editClip(clip.id, 'durationMs', e.target.value)} />s</label>
              <IconButton label="Detalhes na timeline avançada" onClick={() => {
                const tr = scene.tracks.find((t) => t.type !== 'property' && (t.clips as AnyClip[]).some((c) => c.id === clip.id));
                if (tr) selectTimeline({ trackId: tr.id, clipId: clip.id });
              }}><span className="txt-icon">…</span></IconButton>
              <IconButton label={`Excluir ${label}`} danger onClick={() => commit('Excluir passo', (d) => deleteClip(sceneOf(d as Project, scene.id), clip.id))}><Trash2 size={14} /></IconButton>
            </li>
          ))}
        </ol>
        {keyCount > 0 && <p className="hint" data-testid="simple-keys-note">{keyCount} keyframe(s) em {keyTracks.length} propriedade(s) desta cena. Edite no modo Avançado.</p>}
      </div>
    </section>
  );
}
