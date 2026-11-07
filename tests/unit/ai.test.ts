/** Comandos rápidos, validação de planos e adaptadores com mocks. Nada conecta de verdade. */
import { describe, expect, it, vi } from 'vitest';
import { applyPlan, describePlan, PlanSchema, type Plan } from '@/features/ai/plan';
import { buildSystemPrompt, listOllamaModels, ollamaAdapter, parseModelResponse, proxyAdapter, AIError } from '@/features/ai/adapters';
import { parseQuickCommand } from '@/features/ai/quickCommands';
import { createDemoProject } from '@/features/templates/projects';
import { evaluateScene } from '@/engine/animation/evaluate';
import { addNode, addDialogue, ensurePropertyTrack } from '@/engine/model/ops';
import { createPropNode } from '@/engine/model/factory';
import { CAMERA_TARGET, ProjectSchema, type Project, type Scene } from '@/engine/model/schema';
import { viewInfo } from '@/engine/character/views';

function ctx() {
  const p = createDemoProject();
  const sceneId = p.sceneOrder[0]!;
  return { p, sceneId, s: p.scenes[sceneId] as Scene };
}
const run = (p: Project, sceneId: string, text: string, selected?: string) => {
  const plan = parseQuickCommand(text, p, sceneId, selected);
  const res = applyPlan(p, plan, { sceneId, timeMs: 0 });
  return { plan, res };
};

describe('os 9 pedidos de exemplo', () => {
  it('1. cabelo branco na Nina muda a identidade', () => {
    const { p, sceneId } = ctx();
    const { plan } = run(p, sceneId, 'Coloque cabelo branco na Nina');
    expect(plan.actions[0]!.type).toBe('updateCharacter');
    expect(Object.values(p.characters).find((c) => c.name === 'Nina')!.hair.color).toBe('#f4f1ea');
  });
  it('2. Zeca olha para Nina e o nariz vira para ela', () => {
    const { p, sceneId, s } = ctx();
    const zeca = Object.values(s.nodes).find((n) => n.name === 'Zeca')!;
    if (zeca.kind === 'character') {
      zeca.gaze.mode = 'camera';
      zeca.gaze.targetId = null;
    }
    run(p, sceneId, 'Faça Zeca olhar para Nina e virar o nariz na direção dela');
    const r = evaluateScene(p, s, 0).characters[zeca.id]!;
    expect(r.pose.face.gazeX).toBeLessThan(0);
    expect(viewInfo(r.pose.headView).facing).toBe(-1);
  });
  it('3. sala de aula com 3 alunos e professor', () => {
    const { p, sceneId } = ctx();
    const { res } = run(p, sceneId, 'Crie uma cena de sala de aula com 3 alunos e professor');
    const sc = p.scenes[res.sceneId]!;
    expect(sc.background.presetId).toBe('salaaula');
    expect(Object.values(sc.nodes).filter((n) => n.kind === 'character')).toHaveLength(4);
    expect(p.sceneOrder).toHaveLength(2);
  });
  it('4. entra pela direita, anda até o sofá, senta e fala, em ordem', () => {
    const { p, sceneId, s } = ctx();
    const { plan } = run(p, sceneId, 'Faça Nina entrar pela direita, andar até o sofá, sentar e falar "Cheguei"');
    const acts = plan.actions.filter((a) => a.type === 'action' || a.type === 'say');
    expect(acts.map((a) => (a.type === 'say' ? 'say' : a.type === 'action' ? a.action : ''))).toEqual(['enter', 'walk', 'sit', 'say']);
    const nina = Object.values(s.nodes).find((n) => n.name === 'Nina')!;
    expect(evaluateScene(p, s, 0).nodes[nina.id]!.transform.x).toBeGreaterThan(900);
    const times = acts.map((a) => ('atMs' in a ? a.atMs! : 0));
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
  it('5. mesa em 120% e na frente da Nina', () => {
    const { p, sceneId, s } = ctx();
    const mesa = createPropNode('table', { name: 'Mesa' });
    addNode(s, mesa, 'bottom');
    run(p, sceneId, 'Aumente a mesa para 120% e traga ela para frente da Nina');
    expect(s.nodes[mesa.id]!.transform.scaleX).toBeCloseTo(1.2);
    const nina = Object.values(s.nodes).find((n) => n.name === 'Nina')!;
    expect(s.layerOrder.indexOf(mesa.id)).toBeGreaterThan(s.layerOrder.indexOf(nina.id));
  });
  it('6. câmera aproxima lentamente durante a fala', () => {
    const { p, sceneId, s } = ctx();
    const fala = s.tracks.flatMap((t) => (t.type === 'dialogue' ? t.clips : []))[0]!;
    run(p, sceneId, 'Deixe a câmera aproximar lentamente durante a fala');
    const zoom = ensurePropertyTrack(s, CAMERA_TARGET, 'zoom');
    expect(zoom.keyframes.map((k) => k.timeMs)).toEqual([fala.startMs, fala.startMs + fala.durationMs]);
    expect(zoom.keyframes[1]!.value).toBeGreaterThan(1);
  });
  it('7. cena vertical de 15 s para TikTok', () => {
    const { p, sceneId } = ctx();
    const { res } = run(p, sceneId, 'Crie uma cena vertical de 15 segundos para TikTok');
    expect(p.scenes[res.sceneId]!.durationMs).toBe(15000);
    expect(p.settings.aspectRatio).toBe('9:16');
    expect(p.settings.height).toBeGreaterThan(p.settings.width);
  });
  it('8. troca de expressão no segundo 4 cria key, sem mudar antes', () => {
    const { p, sceneId, s } = ctx();
    const nina = Object.values(s.nodes).find((n) => n.name === 'Nina')!;
    run(p, sceneId, 'Troque a expressão da Nina de bravo para surpreso no segundo 4');
    const ev = (t: number) => evaluateScene(p, s, t).characters[nina.id]!.pose.face.expression;
    expect(ev(4000)).toBe('surprised');
    const track = ensurePropertyTrack(s, nina.id, 'expression');
    expect(track.keyframes.some((k) => k.timeMs === 4000 && k.value === 'surprised')).toBe(true);
  });
  it('9. nova cena sem alterar as anteriores', () => {
    const { p, sceneId } = ctx();
    const snap = JSON.stringify(p.scenes[sceneId]);
    run(p, sceneId, 'Adicione uma nova cena sem alterar as anteriores');
    expect(p.sceneOrder).toHaveLength(2);
    expect(JSON.stringify(p.scenes[sceneId])).toBe(snap);
  });
  it('pedido do senhor baixinho: cria, entra, olha, aponta e fala', () => {
    const { p, sceneId, s } = ctx();
    const { plan } = run(p, sceneId, 'Crie um senhor baixinho, cabelo branco, um pouco careca, bigode, camisa florida, e faça ele entrar na sala, olhar para Nina, apontar e falar');
    const def = Object.values(p.characters).find((c) => c.name === 'Senhor')!;
    expect(def.body.height).toBeLessThan(1);
    expect(def.hair.color).toBe('#f4f1ea');
    expect(def.hair.style).toBe('receding');
    expect(def.face.mustache).not.toBe('none');
    expect(def.outfit.topPattern).toBe('floral');
    expect(def.outfit.top).toBe('shirt');
    expect(def.body.age).toBe('elder');
    const node = Object.values(s.nodes).find((n) => n.name === 'Senhor')!;
    expect(node).toBeTruthy();
    expect(plan.actions.some((a) => a.type === 'look')).toBe(true);
    expect(plan.actions.some((a) => a.type === 'action' && a.action === 'point')).toBe(true);
    expect(plan.actions.some((a) => a.type === 'action' && a.action === 'enter')).toBe(true);
    expect(plan.actions.some((a) => a.type === 'say')).toBe(true);
  });
  it('comando desconhecido explica, sem fingir', () => {
    const { p, sceneId } = ctx();
    const before = JSON.stringify(p);
    const { plan, res } = run(p, sceneId, 'xyzzy plugh');
    expect(plan.actions[0]!.type).toBe('note');
    expect(res.applied).toBe(0);
    expect(JSON.stringify(p)).toBe(before);
  });
  it('o resumo declara que não é IA', () => {
    const { p, sceneId } = ctx();
    expect(parseQuickCommand('oi', p, sceneId).summary).toMatch(/sem IA/);
  });
});

describe('plano estruturado', () => {
  it('schema rejeita ações desconhecidas e campos perigosos não passam', () => {
    expect(PlanSchema.safeParse({ actions: [{ type: 'eval', code: 'alert(1)' }] }).success).toBe(false);
    const ok = PlanSchema.parse({ actions: [{ type: 'say', node: 'Nina', text: 'oi', onclick: 'x' }] });
    expect(JSON.stringify(ok)).not.toContain('onclick');
  });
  it('recursos inexistentes viram avisos e o resto continua', () => {
    const { p, sceneId } = ctx();
    const plan: Plan = { summary: '', actions: [
      { type: 'addProp', prop: 'dragao' },
      { type: 'setBackground', background: 'lua' },
      { type: 'say', node: 'Ninguém', text: 'x' },
      { type: 'action', node: 'Nina', action: 'voar' },
      { type: 'expression', node: 'Nina', expression: 'inexistente' },
      { type: 'addProp', prop: 'tv', ref: 'tv1' },
    ] };
    const r = applyPlan(p, plan, { sceneId, timeMs: 0 });
    expect(r.applied).toBe(1);
    expect(r.warnings).toHaveLength(5);
    expect(() => ProjectSchema.parse(p)).not.toThrow();
  });
  it('cor maliciosa nunca chega ao SVG', () => {
    const { p, sceneId } = ctx();
    applyPlan(p, { summary: '', actions: [{ type: 'updateCharacter', character: 'Nina', appearance: { hairColor: 'url(javascript:alert(1))' } }] }, { sceneId, timeMs: 0 });
    expect(Object.values(p.characters).find((c) => c.name === 'Nina')!.hair.color).toMatch(/^#/);
  });
  it('refs ligam ações do mesmo plano', () => {
    const { p, sceneId, s } = ctx();
    applyPlan(p, { summary: '', actions: [
      { type: 'createCharacter', ref: 'novo', name: 'Bento', appearance: {}, addToScene: true },
      { type: 'say', node: 'novo', text: 'Oi' },
    ] }, { sceneId, timeMs: 100 });
    const bento = Object.values(s.nodes).find((n) => n.name === 'Bento')!;
    expect(s.tracks.some((t) => t.type === 'dialogue' && t.targetNodeId === bento.id)).toBe(true);
  });
  it('descreve o plano em português', () => {
    const lines = describePlan({ summary: '', actions: [{ type: 'camera', zoom: 1.5, durationMs: 2000 }, { type: 'say', node: 'Nina', text: 'Oi' }] });
    expect(lines[0]).toContain('zoom 150%');
    expect(lines[1]).toContain('Oi');
  });
  it('a fala usada no contexto real continua aplicável', () => {
    const { s } = ctx();
    const nina = Object.values(s.nodes).find((n) => n.name === 'Nina')!;
    expect(addDialogue(s, nina.id, 'x', 0).kind).toBe('dialogue');
  });
});

describe('adaptadores (mock)', () => {
  const validBody = JSON.stringify({ summary: 'ok', actions: [{ type: 'note', text: 'teste' }] });
  const resp = (body: unknown, ok = true, status = 200) => ({ ok, status, json: async () => body }) as Response;
  const context = () => {
    const { p, sceneId } = ctx();
    return { project: p, sceneId, timeMs: 0 };
  };
  it('Ollama: envia modelo e formato JSON e valida a resposta', async () => {
    const fetcher = vi.fn().mockResolvedValue(resp({ message: { content: validBody } }));
    const plan = await ollamaAdapter({ baseUrl: 'http://localhost:11434/', model: 'm' }, fetcher).generatePlan('oi', context());
    expect(plan.summary).toBe('ok');
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('http://localhost:11434/api/chat');
    const sent = JSON.parse(init.body as string);
    expect(sent.format).toBe('json');
    expect(sent.model).toBe('m');
    expect(sent.messages[0].content).toContain('Recorte Studio');
  });
  it('Ollama indisponível dá mensagem clara sobre CORS', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(ollamaAdapter({ baseUrl: 'http://x', model: 'm' }, fetcher).generatePlan('oi', context())).rejects.toThrow(/OLLAMA_ORIGINS/);
  });
  it('modelo não instalado', async () => {
    const fetcher = vi.fn().mockResolvedValue(resp({}, false, 404));
    await expect(ollamaAdapter({ baseUrl: 'http://x', model: 'm' }, fetcher).generatePlan('oi', context())).rejects.toThrow(/instalado/);
  });
  it('lista modelos', async () => {
    const fetcher = vi.fn().mockResolvedValue(resp({ models: [{ name: 'a' }, { name: 'b' }] }));
    expect(await listOllamaModels('http://x', fetcher)).toEqual(['a', 'b']);
  });
  it('endpoint próprio não envia cabeçalho de chave', async () => {
    const fetcher = vi.fn().mockResolvedValue(resp({ choices: [{ message: { content: validBody } }] }));
    await proxyAdapter({ endpoint: 'https://x/y', model: 'm' }, fetcher).generatePlan('oi', context());
    expect(JSON.stringify(fetcher.mock.calls[0]![1].headers)).not.toMatch(/authorization|api-key/i);
  });
  it('aceita cercas de código, mas rejeita texto solto e planos inválidos', () => {
    expect(parseModelResponse('```json\n' + validBody + '\n```').summary).toBe('ok');
    expect(() => parseModelResponse('desculpe, não posso')).toThrow(AIError);
    expect(() => parseModelResponse('{ruim')).toThrow(AIError);
    expect(() => parseModelResponse('{"actions":[{"type":"eval"}]}')).toThrow(/validação/);
  });
  it('o prompt lista IDs reais e proíbe código', () => {
    const c = context();
    const prompt = buildSystemPrompt(c);
    expect(prompt).toContain('salaaula');
    expect(prompt).toContain('Nunca gere HTML');
    expect(prompt).toContain('Nina');
  });
});
