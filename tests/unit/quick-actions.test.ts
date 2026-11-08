/** Ações rápidas do celular: contextuais ao tipo de seleção e ao estado no tempo atual. */
import { describe, expect, it } from 'vitest';
import { createDemoProject } from '@/features/templates/projects';
import { createPropNode } from '@/engine/model/factory';
import { sceneOf, addDialogue } from '@/engine/model/ops';
import { quickActions } from '@/components/layout/quickActions';
import { OBJECT_PREFIX } from '@/engine/world/pieces';
import type { Project, SceneNode } from '@/engine/model/schema';

const setup = () => {
  const p: Project = createDemoProject();
  const s = sceneOf(p, p.sceneOrder[0]!);
  const nina = Object.values(s.nodes).find((n) => n.kind === 'character' && n.name === 'Nina')!;
  return { p, s, nina };
};
const keys = (a: ReturnType<typeof quickActions>) => a.map((x) => x.key);

describe('ações rápidas', () => {
  it('personagem: Mover, Expressão, Olhar, Pose, Falar, Ações, Aparência + duplicar/excluir', () => {
    const { s } = setup();
    const lone = Object.values(s.nodes).find((n) => n.kind === 'character' && n.name === 'Zeca')!;
    expect(keys(quickActions(s, { kind: 'node', node: lone }, 0))).toEqual(['move', 'face', 'gaze', 'pose', 'talk', 'actions', 'look', 'duplicate', 'delete']);
  });
  it('cada ação leva à aba, seção e campo corretos', () => {
    const { s, nina } = setup();
    const a = quickActions(s, { kind: 'node', node: nina }, 9000);
    const jumpOf = (k: string) => (a.find((x) => x.key === k) as { jump: object }).jump;
    expect(jumpOf('gaze')).toEqual({ ctx: 'character', tab: 'Rosto', section: 'sec-gaze', focus: 'gaze-mode' });
    expect(jumpOf('face')).toMatchObject({ tab: 'Rosto', focus: 'expression' });
    expect(jumpOf('pose')).toMatchObject({ tab: 'Pose', focus: 'pose' });
    expect(jumpOf('talk')).toMatchObject({ tab: 'Animar', focus: 'speech-text' });
    expect(jumpOf('actions')).toMatchObject({ tab: 'Animar', focus: 'action-select' });
    expect(jumpOf('move')).toMatchObject({ tab: 'Transformar' });
  });
  it('se o personagem já está falando agora, "Falar" vira "Editar fala" e abre aquele clip', () => {
    const { s, nina } = setup();
    // No demo, Nina fala no começo: no meio da fala a ação é editar.
    const clip = addDialogue(s, nina.id, 'Olá', 20000, 2000);
    const talking = quickActions(s, { kind: 'node', node: nina }, 20500).find((x) => x.key === 'talk')!;
    expect(talking.label).toBe('Editar fala');
    expect('run' in talking && typeof talking.run === 'object' && talking.run.selectClip.clipId).toBe(clip.id);
    const silent = quickActions(s, { kind: 'node', node: nina }, 23000).find((x) => x.key === 'talk')!;
    expect(silent.label).toBe('Falar');
  });
  it('objeto com estados e para segurar mostra Estado e Segurar; objeto próprio mostra Editar objeto', () => {
    const { s } = setup();
    const lamp = createPropNode('lamp', { name: 'Abajur' }) as SceneNode;
    expect(keys(quickActions(s, { kind: 'node', node: lamp }, 0))).toContain('state');
    const mug = createPropNode('mug', { name: 'Caneca' }) as SceneNode;
    expect(keys(quickActions(s, { kind: 'node', node: mug }, 0))).toContain('hold');
    const mine = createPropNode(OBJECT_PREFIX + 'x', { name: 'Meu' }) as SceneNode;
    const k = keys(quickActions(s, { kind: 'node', node: mine }, 0));
    expect(k).toContain('edit');
    expect(k).not.toContain('state');
  });
  it('câmera e clips têm ações próprias', () => {
    const { s, nina } = setup();
    expect(keys(quickActions(s, { kind: 'camera' }, 0))).toEqual(['frame', 'camera', 'follow']);
    const clip = addDialogue(s, nina.id, 'Oi', 1000, 1000);
    const k = keys(quickActions(s, { kind: 'clip', clipId: clip.id }, 0));
    expect(k).toEqual(expect.arrayContaining(['time', 'text', 'bubble', 'mouth', 'delete']));
    expect(quickActions(s, { kind: 'clip', clipId: 'inexistente' }, 0)).toEqual([]);
  });
});
