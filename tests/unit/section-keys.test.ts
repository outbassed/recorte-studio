/** Keyframe universal por seção: propriedades animáveis, estado, criação sem duplicar e histórico único. */
import { beforeEach, describe, expect, it } from 'vitest';
import { createDemoProject } from '@/features/templates/projects';
import { ensurePropertyTrack, findPropertyTrack, readProperty, sceneOf, setKeyframe } from '@/engine/model/ops';
import { addSectionKeys, animatablePaths, keyTime, sectionKeyState } from '@/engine/model/sectionKeys';
import { commit, currentScene, loadProject, redo, undo, useProjectStore } from '@/state/projectStore';
import { CAMERA_TARGET, type CharacterNode } from '@/engine/model/schema';

const TRANSFORM = ['transform.x', 'transform.y', 'transform.scaleX', 'transform.scaleY', 'transform.rotationDeg', 'opacity'];

let nina: CharacterNode;
let sceneId: string;
beforeEach(() => {
  const p = createDemoProject();
  loadProject(p);
  const s = currentScene();
  sceneId = s.id;
  nina = Object.values(s.nodes).find((n): n is CharacterNode => n.kind === 'character' && n.name === 'Nina')!;
});

const keysAt = (path: string, t: number) => findPropertyTrack(currentScene(), nina.id, path)?.keyframes.filter((k) => k.timeMs === t) ?? [];
const create = (t: number, paths: readonly string[] = TRANSFORM, label = 'Criar keyframes da seção') => commit(label, (d) => void addSectionKeys(sceneOf(d, sceneId), nina.id, 'character', paths, t));

describe('propriedades animáveis da seção', () => {
  it('só entram as que têm definição de animação para o tipo de seleção', () => {
    expect(animatablePaths('character', [...TRANSFORM, 'transform.pivotX', 'transform.pivotY', 'shadow.opacity', 'isso.nao.existe'])).toEqual(TRANSFORM);
  });
  it('rig só vale para personagem; câmera tem as próprias', () => {
    expect(animatablePaths('prop', ['rig.armLUpper', 'transform.x'])).toEqual(['transform.x']);
    expect(animatablePaths('camera', ['x', 'y', 'zoom', 'rotationDeg', 'transform.x'])).toEqual(['x', 'y', 'zoom', 'rotationDeg']);
  });
  it('remove repetidos e mantém a ordem', () => {
    expect(animatablePaths('character', ['opacity', 'transform.x', 'opacity'])).toEqual(['opacity', 'transform.x']);
  });
  it('campos discretos (vista, expressão, profundidade do braço) também contam', () => {
    expect(animatablePaths('character', ['expression', 'bodyView', 'limbDepth.armL', 'mouthShape'])).toEqual(['expression', 'bodyView', 'limbDepth.armL', 'mouthShape']);
  });
});

describe('criar keyframes da seção', () => {
  it('cria um keyframe por propriedade, no instante, com o valor atual', () => {
    const s = currentScene();
    const before = Object.fromEntries(TRANSFORM.map((p) => [p, readProperty(s, nina.id, p, 2000)]));
    create(2000);
    for (const p of TRANSFORM) {
      const k = keysAt(p, 2000);
      expect(k, p).toHaveLength(1);
      expect(k[0]!.value, p).toBe(before[p]);
    }
    expect(Object.keys(before)).toHaveLength(6);
  });
  it('o instante é arredondado e nunca negativo, como no botão individual', () => {
    expect(keyTime(1999.6)).toBe(2000);
    expect(keyTime(-50)).toBe(0);
    create(1234.4);
    expect(keysAt('transform.x', 1234)).toHaveLength(1);
  });
  it('usa o valor interpolado quando a propriedade já é animada', () => {
    commit('prep', (d) => {
      const sc = sceneOf(d, sceneId);
      const tr = ensurePropertyTrack(sc, nina.id, 'transform.x');
      setKeyframe(tr, 0, 0, { interpolation: 'linear' });
      setKeyframe(tr, 4000, 400, { interpolation: 'linear' });
    });
    create(1000);
    expect(keysAt('transform.x', 1000)[0]!.value).toBeCloseTo(100, 5);
  });
  it('não duplica nem sobrescreve o que já existe no instante', () => {
    commit('prep', (d) => { setKeyframe(ensurePropertyTrack(sceneOf(d, sceneId), nina.id, 'transform.y'), 2000, 777); });
    create(2000);
    expect(keysAt('transform.y', 2000)).toHaveLength(1);
    expect(keysAt('transform.y', 2000)[0]!.value).toBe(777);
    create(2000, TRANSFORM, 'segunda vez');
    for (const p of TRANSFORM) expect(keysAt(p, 2000), p).toHaveLength(1);
    expect(findPropertyTrack(currentScene(), nina.id, 'transform.x')!.keyframes).toHaveLength(1);
  });
  it('só cria faixas para o que falta (não deixa faixa vazia)', () => {
    const tracksBefore = currentScene().tracks.length;
    create(500, ['rig.headTilt', 'rig.headNod']);
    expect(currentScene().tracks.length).toBe(tracksBefore + 2);
    const again = currentScene().tracks.length;
    create(500, ['rig.headTilt', 'rig.headNod'], 'repetir');
    expect(currentScene().tracks.length).toBe(again);
  });
  it('não mexe em outras seções nem em outro personagem', () => {
    const snap = () => JSON.stringify(currentScene().tracks.filter((t) => t.type === 'property' && !(t.targetNodeId === nina.id && TRANSFORM.includes(t.propertyPath))));
    const before = snap();
    create(2000);
    expect(snap()).toBe(before);
  });
  it('câmera: x, y, zoom e rotação', () => {
    commit('cam', (d) => void addSectionKeys(sceneOf(d, sceneId), CAMERA_TARGET, 'camera', ['x', 'y', 'zoom', 'rotationDeg'], 1500));
    for (const p of ['x', 'y', 'zoom', 'rotationDeg']) expect(findPropertyTrack(currentScene(), CAMERA_TARGET, p)!.keyframes.map((k) => k.timeMs)).toEqual([1500]);
  });
  it('discretos guardam o valor atual (texto), sem interpolar', () => {
    create(1000, ['expression', 'bodyView', 'mouthShape'], 'rosto');
    expect(typeof keysAt('expression', 1000)[0]!.value).toBe('string');
    expect(keysAt('bodyView', 1000)[0]!.value).toBe(readProperty(currentScene(), nina.id, 'bodyView', 1000));
  });
});

describe('estado da seção no instante', () => {
  it('nenhum → parcial → todos', () => {
    const state = () => sectionKeyState(currentScene(), nina.id, TRANSFORM, 2000);
    expect(state()).toMatchObject({ status: 'none', withKey: 0, total: 6, animated: false });
    commit('um', (d) => { setKeyframe(ensurePropertyTrack(sceneOf(d, sceneId), nina.id, 'opacity'), 2000, 1); });
    expect(state()).toMatchObject({ status: 'partial', withKey: 1, animated: true });
    expect(state().missing).toHaveLength(5);
    create(2000);
    expect(state()).toMatchObject({ status: 'all', withKey: 6, missing: [] });
  });
  it('em outro instante o estado volta a "nenhum", mas a seção continua animada', () => {
    create(2000);
    expect(sectionKeyState(currentScene(), nina.id, TRANSFORM, 3000)).toMatchObject({ status: 'none', animated: true });
  });
});

describe('histórico: uma única ação', () => {
  it('um Ctrl+Z desfaz todos os keyframes e refazer devolve tudo', () => {
    const pastBefore = useProjectStore.getState().past.length;
    create(2000);
    expect(useProjectStore.getState().past.length).toBe(pastBefore + 1);
    for (const p of TRANSFORM) expect(keysAt(p, 2000)).toHaveLength(1);
    expect(undo()).toBe('Criar keyframes da seção');
    for (const p of TRANSFORM) expect(keysAt(p, 2000), p).toHaveLength(0);
    redo();
    for (const p of TRANSFORM) expect(keysAt(p, 2000), p).toHaveLength(1);
  });
  it('os botões individuais continuam funcionando e convivem com o universal', () => {
    commit('Criar keyframe', (d) => { setKeyframe(ensurePropertyTrack(sceneOf(d, sceneId), nina.id, 'opacity'), 2000, 0.5); });
    create(2000);
    expect(keysAt('opacity', 2000)[0]!.value).toBe(0.5);
    undo();
    expect(keysAt('opacity', 2000)).toHaveLength(1);
    expect(keysAt('transform.x', 2000)).toHaveLength(0);
  });
});
