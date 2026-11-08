/**
 * Ações rápidas do celular: dependem do que está selecionado E do estado dele no tempo atual.
 * Cada ação leva à aba certa das propriedades, abre a seção e põe o foco no campo que importa.
 * A decisão é uma função pura (testável); a execução (`runQuick`) mexe na interface.
 */
import { getProp } from '@/engine/world/props';
import { isCustomObjectId } from '@/engine/world/pieces';
import { findClip } from '@/engine/model/ops';
import type { Scene, SceneNode } from '@/engine/model/schema';
import { duplicateSelection, deleteSelection } from '@/state/actions';
import { selectTimeline, useUI } from '@/state/uiStore';

export type QuickTarget =
  | { kind: 'node'; node: SceneNode }
  | { kind: 'camera' }
  | { kind: 'clip'; clipId: string };

export type QuickAction =
  | { key: string; label: string; jump: { ctx: string; tab: string; section?: string; focus?: string } }
  | { key: string; label: string; run: 'creator' | 'duplicate' | 'delete' | { selectClip: { trackId: string; clipId: string } } };

const jump = (key: string, label: string, ctx: string, tab: string, section?: string, focus?: string): QuickAction => ({ key, label, jump: { ctx, tab, section, focus } });

/** Fala (clip de diálogo) do personagem que está ativa no tempo `t`, se houver. */
export function activeDialogue(scene: Scene, nodeId: string, t: number): { trackId: string; clipId: string } | null {
  for (const tr of scene.tracks) {
    if (tr.type !== 'dialogue' || tr.targetNodeId !== nodeId) continue;
    const c = tr.clips.find((x) => t >= x.startMs && t < x.startMs + x.durationMs);
    if (c) return { trackId: tr.id, clipId: c.id };
  }
  return null;
}

export function quickActions(scene: Scene, target: QuickTarget, timeMs: number): QuickAction[] {
  const common: QuickAction[] = [
    { key: 'duplicate', label: 'Duplicar', run: 'duplicate' },
    { key: 'delete', label: 'Excluir', run: 'delete' },
  ];
  if (target.kind === 'camera') {
    return [
      jump('frame', 'Enquadrar', 'camera', 'Movimento', 'sec-framing'),
      jump('camera', 'Posição e zoom', 'camera', 'Enquadramento', 'sec-camera', 'camera-zoom'),
      jump('follow', 'Seguir', 'camera', 'Seguir'),
    ];
  }
  if (target.kind === 'clip') {
    const f = findClip(scene, target.clipId);
    if (!f) return [];
    const kind = f.clip.kind;
    const ctx = `clip-${kind}`;
    const own: QuickAction[] = [jump('time', 'Tempo', ctx, kind === 'dialogue' ? 'Texto' : 'Tempo', 'sec-clip', 'clip-start')];
    if (kind === 'dialogue') own.push(jump('text', 'Texto', ctx, 'Texto', undefined, 'dialogue-text'), jump('bubble', 'Balão', ctx, 'Balão'), jump('mouth', 'Boca', ctx, 'Boca', undefined, 'lipsync-mode'));
    if (kind === 'audio') own.push(jump('sound', 'Volume', ctx, 'Som', 'sec-audio', 'audio-volume'), jump('sync', 'Sincronizar boca', ctx, 'Sincronização', undefined, 'audio-lipsync'));
    if (kind === 'action') own.push(jump('action', 'Ajustar ação', ctx, 'Ação'));
    if (kind === 'subtitle') own.push(jump('subtitle', 'Legenda', ctx, 'Legenda'));
    if (kind === 'effect') own.push(jump('effect', 'Efeito', ctx, 'Efeito'));
    return [...own, { key: 'delete', label: 'Excluir', run: 'delete' }];
  }
  const n = target.node;
  switch (n.kind) {
    case 'character': {
      const talking = activeDialogue(scene, n.id, timeMs);
      return [
        jump('move', 'Mover', 'character', 'Transformar', 'sec-transform'),
        jump('face', 'Expressão', 'character', 'Rosto', 'sec-face', 'expression'),
        jump('gaze', 'Olhar', 'character', 'Rosto', 'sec-gaze', 'gaze-mode'),
        jump('pose', 'Pose', 'character', 'Pose', 'sec-rig', 'pose'),
        // Se ele já está falando neste instante, a ação é EDITAR a fala; senão, escrever uma nova.
        talking
          ? { key: 'talk', label: 'Editar fala', run: { selectClip: talking } }
          : jump('talk', 'Falar', 'character', 'Animar', 'sec-animate', 'speech-text'),
        jump('actions', 'Ações', 'character', 'Animar', 'sec-animate', 'action-select'),
        { key: 'look', label: 'Aparência', run: 'creator' },
        ...common,
      ];
    }
    case 'prop': {
      const def = isCustomObjectId(n.propId) ? undefined : getProp(n.propId);
      const out: QuickAction[] = [jump('move', 'Mover', 'prop', 'Transformar', 'sec-transform')];
      if (isCustomObjectId(n.propId)) out.push(jump('edit', 'Editar objeto', 'prop', 'Aparência', 'sec-custom-object', 'edit-custom-object'));
      else {
        if (def?.states) out.push(jump('state', 'Estado', 'prop', 'Aparência', 'sec-prop', 'prop-state'));
        if (def?.handheld) out.push(jump('hold', 'Segurar', 'prop', 'Aparência', 'sec-prop', 'prop-held'));
        out.push(jump('look', 'Cores', 'prop', 'Aparência', 'sec-prop'));
      }
      return [...out, jump('layers', 'Camadas', 'prop', 'Camadas'), ...common];
    }
    case 'text': return [jump('edit', 'Editar texto', 'text', 'Aparência', 'sec-text', 'text-content'), jump('move', 'Mover', 'text', 'Transformar', 'sec-transform'), jump('layers', 'Camadas', 'text', 'Camadas'), ...common];
    case 'image': return [jump('move', 'Mover', 'image', 'Transformar', 'sec-transform'), jump('size', 'Tamanho', 'image', 'Imagem', 'sec-image'), jump('layers', 'Camadas', 'image', 'Camadas'), ...common];
    default: return [jump('move', 'Mover', n.kind, 'Transformar', 'sec-transform'), jump('look', 'Aparência', n.kind, 'Aparência'), jump('layers', 'Camadas', n.kind, 'Camadas'), ...common];
  }
}

/** Abre as propriedades na aba certa, expande a seção e põe o foco no campo. */
export function jumpTo(j: { ctx: string; tab: string; section?: string; focus?: string }): void {
  useUI.setState((s) => ({ inspectorTabs: { ...s.inspectorTabs, [j.ctx]: j.tab }, mobilePanel: 'properties', mobilePanelExpanded: false }));
  if (!j.section && !j.focus) return;
  const attempt = (n: number) => requestAnimationFrame(() => {
    const sec = j.section ? document.querySelector<HTMLElement>(`[data-testid="${j.section}"]`) : null;
    const title = sec?.querySelector<HTMLElement>('.section-title');
    if (title?.getAttribute('aria-expanded') === 'false') title.click();
    const el = j.focus ? document.querySelector<HTMLElement>(`[data-testid="${j.focus}"]`) : null;
    const anchor = el ?? sec;
    if (!anchor) {
      if (n < 10) attempt(n + 1);
      return;
    }
    anchor.scrollIntoView({ block: 'center' });
    const field = el?.matches('input,select,textarea,button') ? el : el?.querySelector<HTMLElement>('input,select,textarea,button');
    field?.focus({ preventScroll: true });
  });
  attempt(0);
}

export function runQuick(a: QuickAction, characterId?: string): void {
  if ('jump' in a) return jumpTo(a.jump);
  if (a.run === 'duplicate') return duplicateSelection();
  if (a.run === 'delete') return void deleteSelection();
  if (a.run === 'creator') {
    if (characterId) useUI.setState({ dialog: 'creator', creatorCharacterId: characterId });
    return;
  }
  selectTimeline({ trackId: a.run.selectClip.trackId, clipId: a.run.selectClip.clipId });
  useUI.setState({ mobilePanel: 'properties', mobilePanelExpanded: false });
}
