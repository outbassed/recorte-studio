/** Templates de projeto: criam projetos reais, com cenas e formato de saída próprios. */
import { addAudioTrack, addScene } from '@/engine/model/ops';
import { createProject } from '@/engine/model/factory';
import { createScene } from '@/engine/model/factory';
import { ProjectSchema, type Project } from '@/engine/model/schema';
import { buildTemplateScene } from './scenes';
import { Builder } from './scenes';
import { applyBackground } from '@/engine/model/ops';

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  aspect: string;
  width: number;
  height: number;
  build: (p: Project) => void;
}

const clearScenes = (p: Project) => {
  p.scenes = {};
  p.sceneOrder = [];
};

const fromTemplates = (ids: string[]) => (p: Project) => {
  clearScenes(p);
  for (const id of ids) addScene(p, buildTemplateScene(p, id));
  p.currentSceneId = p.sceneOrder[0] ?? null;
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'vertical', name: 'Shorts / Reels / TikTok', description: 'Vertical 9:16, cena de 15 segundos com enquadramento central.', aspect: '9:16', width: 1080, height: 1920,
    build: (p) => {
      clearScenes(p);
      const scene = createScene('Cena vertical', 15000, 'sala');
      applyBackground(scene, 'sala', {}, false);
      const b = new Builder(p, scene);
      const n = b.actor('nina', -165, { scale: 0.92 });
      const z = b.actor('zeca', 165, { scale: 0.92 });
      b.face(n, z);
      const e = b.say(n, 'Você sabe dançar?', 600);
      const e2 = b.say(z, 'Olha só!', e + 200);
      b.act(z, 'dance', e2 + 100, { durationMs: 5000 });
      b.expr(n, 'astonished', e2 + 1200);
      addScene(p, scene);
      p.currentSceneId = scene.id;
    },
  },
  {
    id: 'horizontal', name: 'Vídeo horizontal', description: 'Formato 16:9 com uma conversa pronta para editar.', aspect: '16:9', width: 1920, height: 1080,
    build: fromTemplates(['sofa']),
  },
  {
    id: 'episodio', name: 'Episódio de múltiplas cenas', description: 'Abertura, três cenas e encerramento com transições.', aspect: '16:9', width: 1920, height: 1080,
    build: (p) => {
      fromTemplates(['abertura', 'entrando', 'discussao', 'reacao', 'encerramento'])(p);
      for (const id of p.sceneOrder.slice(1)) p.scenes[id]!.transitionIn = { kind: 'crossfade', durationMs: 500 };
    },
  },
  {
    id: 'dialogo', name: 'Diálogo simples', description: 'Dois personagens, um cenário e nada mais.', aspect: '16:9', width: 1920, height: 1080,
    build: fromTemplates(['rua']),
  },
  {
    id: 'audio', name: 'Vídeo com áudio existente', description: 'Trilhas de voz e música vazias, prontas para importar seu áudio.', aspect: '16:9', width: 1920, height: 1080,
    build: (p) => {
      clearScenes(p);
      const scene = createScene('Com áudio', 30000, 'estudio');
      applyBackground(scene, 'gravacao');
      const b = new Builder(p, scene);
      const r = b.actor('bia', 0, { y: 300 });
      b.node(r).gaze.mode = 'camera';
      addAudioTrack(scene, 'voice');
      addAudioTrack(scene, 'music');
      addScene(p, scene);
      p.currentSceneId = scene.id;
    },
  },
  {
    id: 'abertura', name: 'Abertura e encerramento', description: 'Vinhetas de entrada e saída para o seu canal.', aspect: '16:9', width: 1920, height: 1080,
    build: fromTemplates(['abertura', 'encerramento']),
  },
];

export function createFromProjectTemplate(id: string, title?: string): Project {
  const t = PROJECT_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`Template de projeto inexistente: ${id}`);
  const p = createProject(title ?? t.name, { width: t.width, height: t.height, aspect: t.aspect });
  t.build(p);
  return ProjectSchema.parse(p);
}

/** Projeto de exemplo usado no primeiro uso: "Você sabe dançar?" da 0.4. */
export function createDemoProject(): Project {
  const p = createProject('Você sabe dançar?');
  clearScenes(p);
  const scene = createScene('Você sabe dançar?', 9000, 'sala');
  applyBackground(scene, 'sala', {}, true);
  const b = new Builder(p, scene);
  const n = b.actor('nina', -340);
  const z = b.actor('zeca', 340);
  b.face(n, z);
  const e = b.say(n, 'Você sabe dançar?', 400, 1900);
  const e2 = b.say(z, 'Sei, olha só!', e + 300, 1400);
  b.act(z, 'dance', e2 + 100, { durationMs: 4600 });
  b.expr(n, 'surprised', 6000);
  addScene(p, scene);
  p.currentSceneId = scene.id;
  return ProjectSchema.parse(p);
}
