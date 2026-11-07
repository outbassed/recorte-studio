import { describe, expect, it } from 'vitest';
import { importProjectData, importProjectJson, ImportError } from '@/migrations';
import { migrate04 } from '@/migrations/from04';
import { ProjectSchema } from '@/engine/model/schema';
import { evaluateScene } from '@/engine/animation/evaluate';
import { repo, db } from '@/storage/db';
import { createDemoProject } from '@/features/templates/projects';
import fixture from '../fixtures/projeto-0.4.json';

describe('migração 0.4 → 1.0', () => {
  it('fixture real da 0.4 vira projeto válido', () => {
    const { project, report } = migrate04(fixture);
    expect(() => ProjectSchema.parse(project)).not.toThrow();
    expect(report.sourceVersion).toBe('0.4');
    expect(report.counts.scenes).toBe(2);
    expect(report.counts.characters).toBe(2);
    expect(report.counts.objects).toBe(1);
    expect(report.counts.dialogues).toBe(4);
    expect(report.counts.actions).toBeGreaterThan(2);
    expect(project.sceneOrder).toHaveLength(2);
  });

  it('objetos globais viram cópias independentes por cena', () => {
    const { project } = migrate04(fixture);
    const [a, b] = project.sceneOrder.map((id) => project.scenes[id]!);
    const pa = Object.values(a!.nodes).find((n) => n.kind === 'prop')!;
    const pb = Object.values(b!.nodes).find((n) => n.kind === 'prop')!;
    expect(pa.id).not.toBe(pb.id);
    pa.transform.x = 9999;
    expect(pb.transform.x).not.toBe(9999);
  });

  it('preserva ordem de camadas, cores, olhar e posições relativas', () => {
    const { project } = migrate04(fixture);
    const s = project.scenes[project.sceneOrder[0]!]!;
    const nodes = Object.values(s.nodes);
    const nina = nodes.find((n) => n.name === 'Nina')!;
    const zeca = nodes.find((n) => n.name === 'Zeca')!;
    expect(nina.transform.x).toBeLessThan(zeca.transform.x);
    expect(s.layerOrder[s.layerOrder.length - 1]).toBe(nodes.find((n) => n.kind === 'prop')!.id);
    if (nina.kind === 'character') {
      expect(project.characters[nina.characterId]!.skin).toBe('#f2bd91');
      expect(nina.gaze.targetId).toBe(zeca.id);
    }
    const r = evaluateScene(project, s, 500);
    expect(r.characters[nina.id]!.pose.face.gazeX).toBeGreaterThan(0);
    expect(r.bubbles.length).toBeGreaterThan(0);
  });

  it('a caminhada da 0.4 vira keyframes com a posição inicial correta', () => {
    const { project } = migrate04(fixture);
    const s = project.scenes[project.sceneOrder[1]!]!;
    const nina = Object.values(s.nodes).find((n) => n.name === 'Nina')!;
    const before = evaluateScene(project, s, 0).nodes[nina.id]!.transform.x;
    const after = evaluateScene(project, s, 5000).nodes[nina.id]!.transform.x;
    expect(before).toBeCloseTo((0.12 - 0.5) * 1920, 0);
    expect(after).toBeCloseTo((0.28 - 0.5) * 1920, 0);
  });

  it('itens desconhecidos entram no relatório, nada some em silêncio', () => {
    const raw = structuredClone(fixture) as typeof fixture & { scenes: Array<{ cues: unknown[]; background: string }> };
    raw.scenes[0]!.cues.push({ id: 'q', actor: 'nina', kind: 'voar', start: 1, end: 2 });
    raw.scenes[0]!.cues.push({ id: 'q2', actor: 'fantasma', kind: 'talk', start: 1, end: 2 });
    raw.scenes[0]!.background = 'lua';
    const { report } = migrate04(raw);
    const text = report.incompatible.join(' | ');
    expect(text).toContain('voar');
    expect(text).toContain('inexistente');
    expect(text).toContain('lua');
  });

  it('JSON da 0.3 sem camadas também importa', () => {
    const { layers: _l, ...v3 } = fixture as Record<string, unknown>;
    const { project } = importProjectData({ ...v3, version: 3 }) as ReturnType<typeof migrate04>;
    expect(project.sceneOrder).toHaveLength(2);
  });

  it('rejeita lixo com mensagem clara', () => {
    expect(() => importProjectJson('não é json')).toThrow(ImportError);
    expect(() => importProjectJson('{"foo":1}')).toThrow(/não reconhecido/);
    expect(() => importProjectJson('{"schemaVersion":99,"format":"recorte-studio"}')).toThrow(/versão mais nova/);
    expect(() => importProjectJson('{"schemaVersion":1,"format":"recorte-studio"}')).toThrow(/inválido/i);
  });

  it('projeto 1.0 com referências quebradas é saneado', () => {
    const p = createDemoProject();
    const raw = JSON.parse(JSON.stringify(p));
    raw.sceneOrder.push('fantasma');
    raw.scenes[p.sceneOrder[0]!].layerOrder.push('fantasma');
    const { project } = importProjectData(raw);
    expect(project.sceneOrder).toEqual(p.sceneOrder);
    expect(project.scenes[p.sceneOrder[0]!]!.layerOrder).not.toContain('fantasma');
  });

  it('não interpreta conteúdo como código', () => {
    const raw = structuredClone(fixture) as Record<string, unknown>;
    raw.projectName = '<img src=x onerror=alert(1)>';
    const { project } = importProjectData(raw);
    expect(project.title).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('repositório IndexedDB', () => {
  it('salva, lista, carrega, duplica metadados e exclui', async () => {
    await db.projects.clear();
    const p = createDemoProject();
    await repo.saveProject(p, 'thumb');
    const list = await repo.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]!.sceneCount).toBe(1);
    expect((list[0] as Record<string, unknown>).data).toBeUndefined();
    const back = await repo.loadProject(p.id);
    expect(JSON.stringify(back)).toBe(JSON.stringify(p));
    await repo.saveProject({ ...p, title: 'Novo' });
    expect((await repo.listProjects())[0]!.thumbnail).toBe('thumb');
    await repo.addBackup(p.id, 'orig', '{}');
    expect(await repo.listBackups(p.id)).toHaveLength(1);
    await repo.deleteProject(p.id);
    expect(await repo.listProjects()).toHaveLength(0);
    expect(await repo.listBackups(p.id)).toHaveLength(0);
  });

  it('blobs órfãos são coletados e os usados ficam', async () => {
    await db.blobs.clear();
    await db.projects.clear();
    const p = createDemoProject();
    p.assets.keep = { id: 'keep', kind: 'image', name: 'a', mime: 'image/png', size: 1, createdAt: 0 };
    await repo.saveProject(p);
    await db.blobs.bulkPut([{ id: 'keep', blob: new Blob(['a']), name: 'a', mime: '', size: 1, createdAt: 0 }, { id: 'gone', blob: new Blob(['b']), name: 'b', mime: '', size: 1, createdAt: 0 }]);
    expect(await repo.collectOrphanBlobs()).toBe(1);
    expect(await db.blobs.get('keep')).toBeDefined();
    expect(await db.blobs.get('gone')).toBeUndefined();
  });
});
