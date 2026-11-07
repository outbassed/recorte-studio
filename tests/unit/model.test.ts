import { beforeEach, describe, expect, it } from 'vitest';
import { createCharacterNode, createKeyframe, createProject, createPropNode, createScene, ensureBuiltinCharacter } from '@/engine/model/factory';
import {
  addBuiltinToScene, addDialogue, addNode, addScene, applyBackground, assetUsage, bakeActionClip, cloneScene, deleteAsset, deleteCharacter, deleteNode, deleteScene, duplicateNode, duplicateScene, ensurePropertyTrack, findClip, getOrCreateActionTrack, groupNodes, insertAction, moveKeyframe, moveLayer, moveScene, readProperty, setKeyframe, splitClip, ungroup, writeProperty,
} from '@/engine/model/ops';
import { ProjectSchema, type Project, type Scene, CAMERA_TARGET, ASPECT_PRESETS, frameSize } from '@/engine/model/schema';
import { evaluateKeys, EASINGS, sortKeys } from '@/engine/animation/interp';
import { evaluateScene } from '@/engine/animation/evaluate';
import { commit, loadProject, redo, undo, useProjectStore, beginGroup, endGroup } from '@/state/projectStore';
import { planFrame, planToSvgString } from '@/engine/render/plan';
import { BACKGROUNDS } from '@/engine/world/backgrounds';
import { PROPS } from '@/engine/world/props';
import { HAIR_STYLES } from '@/engine/character/hair';
import { SCENE_TEMPLATES, buildTemplateScene } from '@/features/templates/scenes';
import { PROJECT_TEMPLATES, createDemoProject, createFromProjectTemplate } from '@/features/templates/projects';
import { resolveOutputSize } from '@/features/export/pipeline';
import { matchesSearch } from '@/features/library/search';
import { sanitizeSvg, SvgRejectedError } from '@/features/library/sanitizeSvg';
import { buildMontage, planMontageFrame } from '@/engine/render/montage';
import { sceneAudioEvents, eventsFrom } from '@/features/audio/mix';
import { amplitudeAt, computePeaks, textToVisemes, visemeAt } from '@/engine/animation/lipsync';
import { getAction, ACTIONS } from '@/engine/animation/actions';

const noAssets = () => undefined;
function twoActorScene(): { p: Project; s: Scene; a: string; b: string } {
  const p = createProject('t');
  const s = p.scenes[p.sceneOrder[0]!]!;
  const a = addBuiltinToScene(p, s, 'nina', -300)!;
  const b = addBuiltinToScene(p, s, 'zeca', 300)!;
  return { p, s, a, b };
}

describe('cenas', () => {
  let p: Project;
  beforeEach(() => { p = createProject('x'); });

  it('cria, reordena e exclui sem perder identidade', () => {
    const first = p.sceneOrder[0]!;
    const second = addScene(p, createScene('B'));
    const third = addScene(p, createScene('C'));
    expect(p.sceneOrder).toEqual([first, second, third]);
    expect(moveScene(p, third, -1)).toBe(true);
    expect(p.sceneOrder).toEqual([first, third, second]);
    expect(moveScene(p, first, -1)).toBe(false);
    expect(deleteScene(p, third)).toBe(true);
    expect(p.sceneOrder).toEqual([first, second]);
    expect(p.scenes[third]).toBeUndefined();
    expect(p.scenes[first]).toBeDefined();
  });

  it('não exclui a última cena', () => {
    expect(deleteScene(p, p.sceneOrder[0]!)).toBe(false);
  });

  it('excluir a cena atual escolhe uma vizinha, sem seleção pendurada', () => {
    const s2 = addScene(p, createScene('B'));
    p.currentSceneId = s2;
    deleteScene(p, s2);
    expect(p.currentSceneId).toBe(p.sceneOrder[0]);
  });

  it('duplicar gera IDs novos para nós, trilhas, keys e clips e religa vínculos', () => {
    const { p: q, s, a, b } = twoActorScene();
    const na = s.nodes[a]!;
    if (na.kind === 'character') {
      na.gaze.mode = 'node';
      na.gaze.targetId = b;
    }
    insertAction(q, s, a, 'walk', 0, { targetX: 100 });
    addDialogue(s, b, 'Oi', 500);
    const copyId = duplicateScene(q, s.id);
    const c = q.scenes[copyId]!;
    const ids = (x: Scene) => [...Object.keys(x.nodes), ...x.tracks.map((t) => t.id), ...x.tracks.flatMap((t) => (t.type === 'property' ? t.keyframes.map((k) => k.id) : (t.clips as Array<{ id: string }>).map((cl) => cl.id)))];
    const orig = new Set(ids(s));
    for (const id of ids(c)) expect(orig.has(id)).toBe(false);
    expect(new Set(ids(c)).size).toBe(ids(c).length);
    expect(c.layerOrder.every((id) => c.nodes[id])).toBe(true);
    const gazer = Object.values(c.nodes).find((n) => n.kind === 'character' && n.gaze.mode === 'node');
    expect(gazer && gazer.kind === 'character' && c.nodes[gazer.gaze.targetId!]).toBeTruthy();
    for (const t of c.tracks) if (t.type !== 'audio' && t.type !== 'subtitle' && t.type !== 'effect') expect(c.nodes[t.targetNodeId]).toBeDefined();
  });

  it('posição em uma cena não afeta a outra', () => {
    const { p: q, s, a } = twoActorScene();
    const copy = duplicateScene(q, s.id);
    const before = Object.values(q.scenes[copy]!.nodes).map((n) => n.transform.x);
    s.nodes[a]!.transform.x = 999;
    expect(Object.values(q.scenes[copy]!.nodes).map((n) => n.transform.x)).toEqual(before);
  });

  it('a identidade é compartilhada entre cenas; a instância não', () => {
    const { p: q, s } = twoActorScene();
    const s2 = createScene('B');
    addScene(q, s2);
    addBuiltinToScene(q, s2, 'nina', 50);
    const def = ensureBuiltinCharacter(q, 'nina')!;
    def.hair.color = '#ffffff';
    const inst = Object.values(s2.nodes)[0]!;
    expect(evaluateScene(q, s2, 0).characters[inst.id]!.def.hair.color).toBe('#ffffff');
    expect(inst.transform.x).toBe(50);
    expect(Object.values(s.nodes)[0]!.transform.x).toBe(-300);
  });

  it('sobrescrever na instância não altera a biblioteca', () => {
    const { p: q, s, a } = twoActorScene();
    const n = s.nodes[a]!;
    if (n.kind === 'character') n.appearanceOverrides.hairColor = '#00ff00';
    const r = evaluateScene(q, s, 0).characters[a]!;
    expect(r.def.hair.color).toBe('#00ff00');
    expect(ensureBuiltinCharacter(q, 'nina')!.hair.color).not.toBe('#00ff00');
  });
});

describe('camadas', () => {
  it('subir/descer/topo/fundo e limites', () => {
    const s = createScene();
    const [a, b, c] = ['table', 'chair', 'tv'].map((id) => addNode(s, createPropNode(id))) as [string, string, string];
    expect(moveLayer(s, c, 'up')).toBe(false);
    expect(moveLayer(s, a, 'down')).toBe(false);
    moveLayer(s, a, 'up');
    expect(s.layerOrder).toEqual([b, a, c]);
    moveLayer(s, c, 'bottom');
    expect(s.layerOrder).toEqual([c, b, a]);
    moveLayer(s, c, 'top');
    expect(s.layerOrder).toEqual([b, a, c]);
  });

  it('o renderizador obedece a mesma ordem da lista', () => {
    const { p, s, a } = twoActorScene();
    const table = addNode(s, createPropNode('table', { y: 400 }));
    const order = () => planFrame(p, s, 0, noAssets).groups[0]!.entries.filter((e) => e.nodeId).map((e) => e.nodeId);
    expect(order()).toEqual(s.layerOrder);
    expect(order().at(-1)).toBe(table);
    moveLayer(s, a, 'top');
    expect(order().at(-1)).toBe(a);
    const svg = planToSvgString(planFrame(p, s, 0, noAssets), 640, 360);
    expect(svg.indexOf(`data-node-id="${table}"`)).toBeLessThan(svg.indexOf(`data-node-id="${a}"`));
  });

  it('excluir limpa olhar, trilhas, follow e segurar', () => {
    const { p, s, a, b } = twoActorScene();
    const bNode = s.nodes[b]!;
    if (bNode.kind === 'character') {
      bNode.gaze.mode = 'node';
      bNode.gaze.targetId = a;
    }
    s.camera.followNodeId = a;
    const phone = createPropNode('phone');
    phone.heldBy = `${a}:L`;
    addNode(s, phone);
    insertAction(p, s, a, 'walk', 0, { targetX: 0 });
    addDialogue(s, a, 'x', 0);
    deleteNode(s, a);
    expect(s.nodes[a]).toBeUndefined();
    expect(s.layerOrder).not.toContain(a);
    expect(s.tracks.some((t) => 'targetNodeId' in t && t.targetNodeId === a)).toBe(false);
    expect(s.camera.followNodeId).toBeNull();
    const after = s.nodes[b]!;
    expect(after.kind === 'character' && after.gaze.targetId).toBeNull();
    expect(s.nodes[phone.id]!.kind === 'prop' && (s.nodes[phone.id] as typeof phone).heldBy).toBe('');
  });

  it('duplicar nó tem transformação independente', () => {
    const { s, a } = twoActorScene();
    const c = duplicateNode(s, a)!;
    expect(c).not.toBe(a);
    s.nodes[c]!.transform.x = 777;
    expect(s.nodes[a]!.transform.x).toBe(-300);
    expect(s.layerOrder.indexOf(c)).toBe(s.layerOrder.indexOf(a) + 1);
  });

  it('agrupar e desagrupar preserva ordem e membros', () => {
    const s = createScene();
    const a = addNode(s, createPropNode('table'));
    const b = addNode(s, createPropNode('chair'));
    const g = groupNodes(s, [a, b])!;
    expect(s.layerOrder).toEqual([g]);
    ungroup(s, g);
    expect(s.layerOrder).toEqual([a, b]);
    expect(s.nodes[g]).toBeUndefined();
  });

  it('cenário troca móveis próprios, mas nunca os do usuário', () => {
    const s = createScene();
    const mine = addNode(s, createPropNode('tv'));
    applyBackground(s, 'sala');
    const owned = Object.values(s.nodes).filter((n) => n.backgroundOwned).length;
    expect(owned).toBeGreaterThan(0);
    applyBackground(s, 'parque');
    expect(s.nodes[mine]).toBeDefined();
    expect(Object.values(s.nodes).filter((n) => n.backgroundOwned).every((n) => n.kind === 'prop' && ['tree', 'bench'].includes(n.propId))).toBe(true);
  });
});

describe('keyframes e interpolação', () => {
  const k = (t: number, v: number, o = {}) => createKeyframe(t, v, { interpolation: 'linear', ...o });
  it('antes do primeiro, entre e depois do último', () => {
    const keys = [k(1000, 10), k(2000, 20)];
    expect(evaluateKeys(keys, 0)).toBe(10);
    expect(evaluateKeys(keys, 1500)).toBe(15);
    expect(evaluateKeys(keys, 5000)).toBe(20);
  });
  it('hold segura o valor', () => {
    expect(evaluateKeys([k(0, 1, { interpolation: 'hold' }), k(1000, 5)], 999)).toBe(1);
  });
  it('easing altera o caminho, mas respeita as pontas', () => {
    const keys = [k(0, 0, { interpolation: 'bezier', easing: 'easeIn' }), k(1000, 100)];
    expect(evaluateKeys(keys, 500)).toBeCloseTo(25);
    expect(evaluateKeys(keys, 1000)).toBe(100);
    for (const fn of Object.values(EASINGS)) {
      expect(fn(0)).toBeCloseTo(0);
      expect(fn(1)).toBeCloseTo(1);
    }
  });
  it('determinístico e sem depender de ordem de seek', () => {
    const keys = [k(0, 0), k(1000, 100)];
    const a = evaluateKeys(keys, 333);
    evaluateKeys(keys, 900);
    expect(evaluateKeys(keys, 333)).toBe(a);
  });
  it('valores discretos trocam no tempo do key', () => {
    const keys = sortKeys([createKeyframe(0, 'neutral'), createKeyframe(1000, 'angry')]);
    expect(evaluateKeys(keys, 999)).toBe('neutral');
    expect(evaluateKeys(keys, 1000)).toBe('angry');
  });
  it('nunca dois keys no mesmo tempo: o novo substitui', () => {
    const s = createScene();
    const t = ensurePropertyTrack(s, CAMERA_TARGET, 'zoom');
    setKeyframe(t, 1000, 1);
    setKeyframe(t, 1000, 2);
    expect(t.keyframes).toHaveLength(1);
    expect(t.keyframes[0]!.value).toBe(2);
  });
  it('mover um key sobre outro funde sem duplicar', () => {
    const s = createScene();
    const t = ensurePropertyTrack(s, CAMERA_TARGET, 'zoom');
    setKeyframe(t, 0, 1);
    const b = setKeyframe(t, 1000, 2);
    moveKeyframe(t, b.id, 0);
    expect(t.keyframes).toHaveLength(1);
    expect(t.keyframes[0]!.value).toBe(2);
  });
  it('dois keys idênticos em lista crua: vale o último, comportamento definido', () => {
    const keys = [k(1000, 1), k(1000, 2), k(2000, 3)];
    expect(evaluateKeys(keys, 1000)).toBe(2);
  });
  it('escrever em propriedade animada grava key; sem trilha muda a base', () => {
    const { s, a } = twoActorScene();
    writeProperty(s, a, 'transform.x', 10, 500);
    expect(s.nodes[a]!.transform.x).toBe(10);
    const tr = ensurePropertyTrack(s, a, 'transform.x');
    setKeyframe(tr, 0, 0);
    writeProperty(s, a, 'transform.x', 50, 500);
    expect(s.nodes[a]!.transform.x).toBe(10);
    expect(readProperty(s, a, 'transform.x', 500)).toBe(50);
  });
  it('renderAt(t) é puro: voltar a t=0 dá o mesmo plano', () => {
    const p = createDemoProject();
    const s = p.scenes[p.sceneOrder[0]!]!;
    const f0 = planToSvgString(planFrame(p, s, 0, noAssets), 640, 360);
    planFrame(p, s, 5000, noAssets);
    expect(planToSvgString(planFrame(p, s, 0, noAssets), 640, 360)).toBe(f0);
  });
});

describe('clips e ações', () => {
  it('toda ação produz amostra finita em qualquer ponto', () => {
    for (const a of ACTIONS) {
      for (const t of [0, 0.5, 0.999]) {
        const s = a.sample({ t, ms: t * a.duration, speed: 1, intensity: 1, side: 'L' });
        for (const v of Object.values(s.rig)) expect(Number.isFinite(v)).toBe(true);
      }
    }
    expect(ACTIONS.length).toBeGreaterThanOrEqual(20);
  });
  it('clip sobreposto soma as contribuições e fora do tempo não afeta', () => {
    const { p, s, a } = twoActorScene();
    insertAction(p, s, a, 'wave', 1000, { durationMs: 1000 });
    insertAction(p, s, a, 'nod', 1000, { durationMs: 1000 });
    expect(evaluateScene(p, s, 500).characters[a]!.pose.rig.armLUpper).toBe(0);
    const during = evaluateScene(p, s, 1500).characters[a]!.pose.rig;
    expect(during.armLUpper + during.armRUpper).toBeGreaterThan(10);
    expect(evaluateScene(p, s, 2500).characters[a]!.pose.rig.armLUpper).toBe(0);
  });
  it('andar cria keys de posição e clip editáveis, e define a vista pelo movimento', () => {
    const { p, s, a } = twoActorScene();
    insertAction(p, s, a, 'walk', 0, { targetX: 300, durationMs: 2000 });
    const track = ensurePropertyTrack(s, a, 'transform.x');
    expect(track.keyframes).toHaveLength(2);
    const mid = evaluateScene(p, s, 1000);
    expect(mid.nodes[a]!.transform.x).toBeCloseTo(0, 0);
    expect(mid.characters[a]!.pose.bodyView).toBe('right');
  });
  it('sentar permanece depois do clip; levantar desfaz', () => {
    const { p, s, a } = twoActorScene();
    insertAction(p, s, a, 'sit', 0, { durationMs: 500 });
    expect(evaluateScene(p, s, 2000).characters[a]!.pose.rig.sit).toBe(1);
    insertAction(p, s, a, 'standUp', 3000, { durationMs: 500 });
    expect(evaluateScene(p, s, 4000).characters[a]!.pose.rig.sit).toBe(0);
  });
  it('assar clip em keyframes remove o clip e mantém o movimento', () => {
    const { p, s, a } = twoActorScene();
    insertAction(p, s, a, 'wave', 0, { durationMs: 1000, side: 'L' });
    const clipId = getOrCreateActionTrack(s, a).clips[0]!.id;
    const before = evaluateScene(p, s, 500).characters[a]!.pose.rig.armLUpper;
    expect(bakeActionClip(s, clipId)).toBeGreaterThan(0);
    expect(findClip(s, clipId)).toBeNull();
    expect(evaluateScene(p, s, 500).characters[a]!.pose.rig.armLUpper).toBeCloseTo(before, 0);
  });
  it('cortar clip de áudio avança o offset do segundo pedaço', () => {
    const s = createScene();
    s.tracks.push({ id: 't', name: 'a', type: 'audio', role: 'sfx', enabled: true, locked: false, muted: false, solo: false, clips: [{ id: 'c', kind: 'audio', assetId: 'x', startMs: 100, durationMs: 1000, offsetMs: 50, volume: 1, fadeInMs: 0, fadeOutMs: 0, lipSyncNodeId: null, sensitivity: 1 }] });
    const second = splitClip(s, 'c', 500)!;
    const c2 = findClip(s, second)!.clip;
    expect(c2.startMs).toBe(500);
    expect(c2.kind === 'audio' && c2.offsetMs).toBe(450);
    expect(findClip(s, 'c')!.clip.durationMs).toBe(400);
  });
  it('fala gera um balão e uma boca, com visema vindo do texto', () => {
    const { p, s, a } = twoActorScene();
    addDialogue(s, a, 'Olá, mundo!', 0, 2000);
    const r = evaluateScene(p, s, 300);
    expect(r.bubbles).toHaveLength(1);
    expect(r.characters[a]!.pose.face.viseme).toBeTruthy();
    expect(evaluateScene(p, s, 2500).bubbles).toHaveLength(0);
    expect(getAction('wave')).toBeTruthy();
  });
  it('visema manual tem prioridade sobre a fala', () => {
    const { p, s, a } = twoActorScene();
    addDialogue(s, a, 'aaaa', 0, 2000);
    const n = s.nodes[a]!;
    if (n.kind === 'character') n.mouthShape = 'O';
    expect(evaluateScene(p, s, 300).characters[a]!.pose.face.viseme).toBe('O');
  });
});

describe('lip-sync', () => {
  it('texto vira visemas brasileiros', () => {
    expect(textToVisemes('ão')).toEqual(['A', 'O']);
    expect(textToVisemes('Mãe')).toEqual(['M', 'A', 'E']);
    expect(visemeAt('oi', 1990, 2000)).toBe('rest');
  });
  it('amplitude é limitada e respeita a sensibilidade', () => {
    const peaks = [0, 0.2, 0.9];
    expect(amplitudeAt(peaks, 0, 1)).toBe(0);
    expect(amplitudeAt(peaks, 25, 1)).toBeGreaterThan(0);
    expect(amplitudeAt(peaks, 45, 5)).toBe(1);
    expect(amplitudeAt(peaks, 10_000, 1)).toBe(0);
  });
  it('picos de canais', () => {
    const ch = new Float32Array(4800).fill(0.5);
    const peaks = computePeaks([ch], 48000);
    expect(peaks.length).toBe(5);
    expect(peaks[0]).toBeCloseTo(0.5);
  });
  it('áudio: mudo e solo definem o que toca', () => {
    const s = createScene();
    const mk = (id: string, o = {}) => ({ id, name: id, type: 'audio' as const, role: 'sfx' as const, enabled: true, locked: false, muted: false, solo: false, clips: [{ id: `c${id}`, kind: 'audio' as const, assetId: id, startMs: 0, durationMs: 1000, offsetMs: 0, volume: 1, fadeInMs: 0, fadeOutMs: 0, lipSyncNodeId: null, sensitivity: 1 }], ...o });
    s.tracks = [mk('a'), mk('b', { muted: true })];
    expect(sceneAudioEvents(s).map((e) => e.assetId)).toEqual(['a']);
    s.tracks = [mk('a'), mk('b', { solo: true })];
    expect(sceneAudioEvents(s).map((e) => e.assetId)).toEqual(['b']);
    const late = eventsFrom(sceneAudioEvents(s), 400);
    expect(late[0]!.offsetMs).toBe(400);
    expect(late[0]!.durationMs).toBe(600);
  });
});

describe('Undo/Redo', () => {
  const setup = () => {
    const p = createDemoProject();
    loadProject(p);
    return p.sceneOrder[0]!;
  };
  const project = () => useProjectStore.getState().project!;
  it('propriedade', () => {
    const id = setup();
    const node = Object.values(project().scenes[id]!.nodes)[0]!;
    const before = node.transform.x;
    commit('x', (d) => { d.scenes[id]!.nodes[node.id]!.transform.x = 123; });
    undo();
    expect(project().scenes[id]!.nodes[node.id]!.transform.x).toBe(before);
    redo();
    expect(project().scenes[id]!.nodes[node.id]!.transform.x).toBe(123);
  });
  it('excluir nó restaura vínculos e ordem', () => {
    const id = setup();
    const scene = project().scenes[id]!;
    const zeca = Object.values(scene.nodes).find((n) => n.name === 'Zeca')!;
    const order = [...scene.layerOrder];
    const tracks = scene.tracks.length;
    commit('del', (d) => void deleteNode(d.scenes[id] as Scene, zeca.id));
    expect(project().scenes[id]!.nodes[zeca.id]).toBeUndefined();
    undo();
    const r = project().scenes[id]!;
    expect(r.layerOrder).toEqual(order);
    expect(r.tracks.length).toBe(tracks);
    const nina = Object.values(r.nodes).find((n) => n.name === 'Nina')!;
    expect(nina.kind === 'character' && nina.gaze.targetId).toBe(zeca.id);
  });
  it('excluir cena', () => {
    const id = setup();
    commit('add', (d) => void addScene(d as Project, createScene('B')));
    const second = project().sceneOrder[1]!;
    commit('del', (d) => void deleteScene(d as Project, second));
    expect(project().sceneOrder).toHaveLength(1);
    undo();
    expect(project().sceneOrder).toEqual([id, second]);
  });
  it('reordenar camadas', () => {
    const id = setup();
    const order = [...project().scenes[id]!.layerOrder];
    commit('mv', (d) => void moveLayer(d.scenes[id] as Scene, order[0]!, 'top'));
    expect(project().scenes[id]!.layerOrder).not.toEqual(order);
    undo();
    expect(project().scenes[id]!.layerOrder).toEqual(order);
  });
  it('keyframe', () => {
    const id = setup();
    commit('k', (d) => void setKeyframe(ensurePropertyTrack(d.scenes[id] as Scene, CAMERA_TARGET, 'zoom'), 0, 2));
    expect(project().scenes[id]!.tracks.some((t) => t.type === 'property' && t.targetNodeId === CAMERA_TARGET)).toBe(true);
    undo();
    expect(project().scenes[id]!.tracks.some((t) => t.type === 'property' && t.targetNodeId === CAMERA_TARGET)).toBe(false);
  });
  it('template adicionado volta atrás e não mexe nas cenas anteriores', () => {
    const id = setup();
    const snap = JSON.stringify(project().scenes[id]);
    commit('tpl', (d) => {
      const sc = buildTemplateScene(d as Project, 'aula');
      addScene(d as Project, sc);
    });
    expect(project().sceneOrder).toHaveLength(2);
    expect(JSON.stringify(project().scenes[id])).toBe(snap);
    undo();
    expect(project().sceneOrder).toHaveLength(1);
  });
  it('um gesto de slider vira UMA entrada do histórico', () => {
    const id = setup();
    const node = Object.values(project().scenes[id]!.nodes)[0]!;
    const before = useProjectStore.getState().past.length;
    beginGroup('slider');
    for (let i = 0; i < 40; i++) commit('x', (d) => { d.scenes[id]!.nodes[node.id]!.transform.x = i; });
    endGroup();
    expect(useProjectStore.getState().past.length).toBe(before + 1);
    undo();
    expect(project().scenes[id]!.nodes[node.id]!.transform.x).toBe(node.transform.x);
  });
  it('alteração sem efeito não entra no histórico', () => {
    setup();
    const before = useProjectStore.getState().past.length;
    commit('nada', () => {});
    expect(useProjectStore.getState().past.length).toBe(before);
  });
});

describe('bibliotecas com variedade real', () => {
  const svgOf = (p: Project, s: Scene) => planToSvgString(planFrame(p, s, 0, noAssets), 320, 180);
  it('20+ cenários com desenho distinto', () => {
    const p = createProject('b');
    const s = p.scenes[p.sceneOrder[0]!]!;
    const seen = new Set<string>();
    for (const b of BACKGROUNDS) {
      applyBackground(s, b.id);
      seen.add(svgOf(p, s));
    }
    expect(BACKGROUNDS.length).toBeGreaterThanOrEqual(20);
    expect(seen.size).toBe(BACKGROUNDS.length);
  });
  it('variante noturna muda o desenho', () => {
    const p = createProject('b');
    const s = p.scenes[p.sceneOrder[0]!]!;
    const day = svgOf(p, s);
    s.background.variant = 'night';
    expect(svgOf(p, s)).not.toBe(day);
  });
  it('30+ objetos com desenho distinto e estados reais', () => {
    expect(PROPS.length).toBeGreaterThanOrEqual(30);
    const seen = new Set(PROPS.map((x) => x.draw({ a: x.a, b: x.b, state: x.defaultState ?? '', ink: '#000', id: 'x' })));
    expect(seen.size).toBe(PROPS.length);
    for (const x of PROPS.filter((q) => q.states)) {
      const out = new Set(x.states!.map((st) => x.draw({ a: x.a, b: x.b, state: st.id, ink: '#000', id: 'x' })));
      expect(out.size).toBe(x.states!.length);
    }
  });
  it('20+ cabelos realmente diferentes', () => {
    expect(HAIR_STYLES.length).toBeGreaterThanOrEqual(25);
    const p = createProject('b');
    const s = p.scenes[p.sceneOrder[0]!]!;
    const id = addBuiltinToScene(p, s, 'nina', 0)!;
    const seen = new Set<string>();
    const def = ensureBuiltinCharacter(p, 'nina')!;
    for (const h of HAIR_STYLES) {
      def.hair.style = h.id;
      const v = planFrame(p, s, 1, noAssets).groups[0]!.entries.find((e) => e.nodeId === id)!.inner;
      seen.add(v);
    }
    expect(seen.size).toBe(HAIR_STYLES.length);
  });
  it('20+ templates criam conteúdo real, com IDs próprios, sem alterar a cena original', () => {
    expect(SCENE_TEMPLATES.length).toBeGreaterThanOrEqual(20);
    const p = createDemoProject();
    const original = JSON.stringify(p.scenes[p.sceneOrder[0]!]);
    const allIds = new Set<string>();
    for (const t of SCENE_TEMPLATES) {
      const sc = buildTemplateScene(p, t.id);
      expect(Object.keys(sc.nodes).length, t.id).toBeGreaterThan(0);
      for (const nid of Object.keys(sc.nodes)) {
        expect(allIds.has(nid)).toBe(false);
        allIds.add(nid);
      }
      for (const tr of sc.tracks) if ('targetNodeId' in tr && tr.targetNodeId !== CAMERA_TARGET) expect(sc.nodes[tr.targetNodeId], t.id).toBeDefined();
      expect(() => planFrame(p, sc, 1000, noAssets)).not.toThrow();
      addScene(p, sc);
    }
    expect(JSON.stringify(p.scenes[p.sceneOrder[0]!])).toBe(original);
    expect(() => ProjectSchema.parse(p)).not.toThrow();
  });
  it('templates de projeto são válidos', () => {
    for (const t of PROJECT_TEMPLATES) {
      const p = createFromProjectTemplate(t.id);
      expect(p.sceneOrder.length).toBeGreaterThan(0);
      expect(p.settings.aspectRatio).toBe(t.aspect);
    }
  });
});

describe('serialização e biblioteca', () => {
  it('ida e volta em JSON não perde dados', () => {
    const p = createDemoProject();
    const back = ProjectSchema.parse(JSON.parse(JSON.stringify(p)));
    expect(JSON.stringify(back)).toBe(JSON.stringify(p));
  });
  it('schema rejeita lixo', () => {
    expect(() => ProjectSchema.parse({ schemaVersion: 1 })).toThrow();
  });
  it('não remove personagem em uso; cena não corrompe', () => {
    const { p, s, a } = twoActorScene();
    const n = s.nodes[a]!;
    const charId = n.kind === 'character' ? n.characterId : '';
    expect(deleteCharacter(p, charId)).toBe(false);
    expect(p.characters[charId]).toBeDefined();
    deleteNode(s, a);
    expect(deleteCharacter(p, charId)).toBe(true);
  });
  it('personagem ausente vira fallback, sem quebrar o render', () => {
    const { p, s, a } = twoActorScene();
    const n = s.nodes[a]!;
    if (n.kind === 'character') delete p.characters[n.characterId];
    expect(() => planFrame(p, s, 0, noAssets)).not.toThrow();
  });
  it('mídia em uso não é removida; ausente mostra aviso no quadro', () => {
    const p = createProject('m');
    const s = p.scenes[p.sceneOrder[0]!]!;
    p.assets.a1 = { id: 'a1', kind: 'image', name: 'x.png', mime: 'image/png', size: 1, createdAt: 0 };
    addNode(s, { id: 'n', kind: 'image', name: 'i', assetId: 'a1', width: 10, height: 10, parentId: null, visible: true, locked: false, transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotationDeg: 0, pivotX: 0, pivotY: 0 }, opacity: 1, parallax: 1, blur: 0, shadow: { enabled: false, opacity: 0, blur: 0, offsetX: 0, offsetY: 0, size: 1, color: '#000000' }, mask: { enabled: false, kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, useDepthScale: false, backgroundOwned: false });
    expect(assetUsage(p, 'a1')).toBe(1);
    expect(deleteAsset(p, 'a1')).toBe(false);
    expect(planToSvgString(planFrame(p, s, 0, noAssets), 100, 100)).toContain('Imagem indisponível');
  });
  it('clone de cena não compartilha referências', () => {
    const { s, a } = twoActorScene();
    const c = cloneScene(s);
    expect(c.id).not.toBe(s.id);
    expect(c.nodes[a]).toBeUndefined();
  });
  it('busca ignora acento e caixa', () => {
    expect(matchesSearch('sofa', 'Sofá')).toBe(true);
    expect(matchesSearch('COZINHA', 'cozinha')).toBe(true);
    expect(matchesSearch('óculos', 'oculos de sol')).toBe(true);
    expect(matchesSearch('mesa', 'cadeira')).toBe(false);
  });
});

describe('sanitização de SVG', () => {
  it('remove scripts, handlers, foreignObject e links externos', () => {
    const r = sanitizeSvg(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)">
      <script>alert(1)</script><foreignObject><div>x</div></foreignObject>
      <a href="javascript:alert(1)"><rect width="5" height="5" onclick="x()"/></a>
      <rect width="5" height="5" onmouseover="x()" style="fill:red;background:url(http://evil/x.png)"/>
      <image href="http://evil/x.png"/><use xlink:href="http://evil/x.svg#a"/>
      <circle r="1" fill="url(http://evil/#p)"/><circle r="2" fill="url(#ok)"/></svg>`);
    expect(r.svg).not.toMatch(/script|onload|onclick|onmouseover|foreignObject|evil|javascript/i);
    expect(r.svg).toContain('fill="url(#ok)"');
    expect(r.svg).toContain('fill:red');
    expect(r.removed.length).toBeGreaterThan(3);
  });
  it('rejeita entidades e arquivos que não são SVG', () => {
    expect(() => sanitizeSvg('<!DOCTYPE svg [<!ENTITY x "y">]><svg/>')).toThrow(SvgRejectedError);
    expect(() => sanitizeSvg('<html></html>')).toThrow(SvgRejectedError);
    expect(() => sanitizeSvg('não é xml')).toThrow(SvgRejectedError);
  });
  it('mantém imagem embutida segura', () => {
    const r = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><image href="data:image/png;base64,AAAA"/></svg>');
    expect(r.svg).toContain('data:image/png');
    expect(r.width).toBe(4);
  });
});

describe('exportação: parâmetros e quadro', () => {
  it('resoluções respeitam a proporção e são pares', () => {
    expect(resolveOutputSize({ width: 1920, height: 1080 }, 720)).toEqual({ w: 1280, h: 720 });
    expect(resolveOutputSize({ width: 1080, height: 1920 }, 720)).toEqual({ w: 720, h: 1280 });
    expect(resolveOutputSize({ width: 1080, height: 1080 }, 480)).toEqual({ w: 480, h: 480 });
    const odd = resolveOutputSize({ width: 1441, height: 1081 }, 481);
    expect(odd.w % 2).toBe(0);
    expect(odd.h % 2).toBe(0);
  });
  it('limita tamanhos gigantes', () => {
    const r = resolveOutputSize({ width: 1920, height: 1080 }, null, { w: 20000, h: 10000 });
    expect(Math.max(r.w, r.h)).toBeLessThanOrEqual(4096);
  });
  it('o SVG exportado é só o quadro: sem guias, seleção ou overlay', () => {
    const p = createDemoProject();
    const svg = planToSvgString(planFrame(p, p.scenes[p.sceneOrder[0]!]!, 500, noAssets), 640, 360);
    expect(svg).toContain('viewBox="-960 -540 1920 1080"');
    expect(svg).not.toMatch(/data-handle|selection-box|frame-mask|frame-border|QUADRO EXPORT|FORA DO QUADRO/);
    expect(svg).toContain('data-part="bubble"');
  });
  it('trocar a proporção só muda a moldura, nada se move', () => {
    const p = createDemoProject();
    const s = p.scenes[p.sceneOrder[0]!]!;
    const a = planFrame(p, s, 0, noAssets).groups[0]!.entries;
    const v = ASPECT_PRESETS.find((x) => x.id === '9:16')!;
    p.settings.width = v.w;
    p.settings.height = v.h;
    const f = planFrame(p, s, 0, noAssets);
    expect(f.groups[0]!.entries.map((e) => e.transform)).toEqual(a.map((e) => e.transform));
    expect(frameSize(p.settings).h).toBe(1080);
    expect(Math.round(f.frameW)).toBe(608);
  });
  it('nó oculto não entra no render', () => {
    const { p, s, a } = twoActorScene();
    s.nodes[a]!.visible = false;
    expect(planToSvgString(planFrame(p, s, 0, noAssets), 64, 36)).not.toContain(`data-node-id="${a}"`);
  });
  it('montagem soma durações, sobrepõe transições e faz crossfade', () => {
    const p = createProject('m');
    const s1 = p.scenes[p.sceneOrder[0]!]!;
    s1.durationMs = 4000;
    const s2 = createScene('2', 3000);
    s2.transitionIn = { kind: 'crossfade', durationMs: 1000 };
    addScene(p, s2);
    const { segments, totalMs } = buildMontage(p);
    expect(totalMs).toBe(6000);
    expect(segments[1]!.startMs).toBe(3000);
    const f = planMontageFrame(p, segments, 3500, noAssets);
    expect(f.groups).toHaveLength(2);
    expect(f.groups[1]!.opacity).toBeCloseTo(0.5);
    expect(planMontageFrame(p, segments, 4500, noAssets).groups).toHaveLength(1);
  });
  it('reordenar cenas muda a montagem', () => {
    const p = createProject('m');
    addScene(p, createScene('2', 1000));
    const before = buildMontage(p).segments.map((x) => x.sceneId);
    moveScene(p, before[1]!, -1);
    expect(buildMontage(p).segments.map((x) => x.sceneId)).toEqual([before[1], before[0]]);
  });
  it('caracteres brasileiros aparecem nos balões, com escape correto', () => {
    const { p, s, a } = twoActorScene();
    addDialogue(s, a, 'Você já comeu maçã? <ação> & "isso"', 0, 3000);
    const svg = planToSvgString(planFrame(p, s, 100, noAssets), 640, 360);
    expect(svg).toContain('Você');
    expect(svg).toContain('&lt;ação&gt;');
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBeNull();
  });
  it('personagem com nome estranho e cores inválidas não injeta markup', () => {
    const { p, s, a } = twoActorScene();
    s.nodes[a]!.name = '"><script>alert(1)</script>';
    const n = s.nodes[a]!;
    const def = n.kind === 'character' ? p.characters[n.characterId]! : null;
    expect(def).toBeTruthy();
    const svg = planToSvgString(planFrame(p, s, 0, noAssets), 64, 36);
    expect(svg).not.toContain('<script>');
  });
});

describe('fábrica', () => {
  it('createCharacterNode usa defaults válidos', () => {
    const n = createCharacterNode('c', 'N');
    expect(n.bodyView).toBe('auto');
    expect(n.gaze.mode).toBe('camera');
  });
});
