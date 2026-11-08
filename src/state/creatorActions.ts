/** Ações dos Criadores de Objetos e de Cenários (1.2). Tudo via commit: Undo/Redo valem. */
import type { Asset, Composition, CustomBackground, CustomObject, Piece, Project, Scene, TimeOfDay } from '@/engine/model/schema';
import { BackgroundSchema, CustomObjectSchema } from '@/engine/model/schema';
import { uid, deepClone } from '@/engine/model/ids';
import { createPropNode } from '@/engine/model/factory';
import { deleteNode, sceneOf } from '@/engine/model/ops';
import { cloneComposition, createPiece, customObjectUsage, OBJECT_PREFIX, allPieceLists } from '@/engine/world/pieces';
import { CUSTOM_RECT, TIME_LABELS, applyCustomBackground, createCustomBackground } from '@/engine/world/customBackgrounds';
import { getBackground, renderBackground } from '@/engine/world/backgrounds';
import { getProp } from '@/engine/world/props';
import { importImageFile, registerAssetBlob } from '@/features/library/assets';
import { repo } from '@/storage/db';
import { commit, currentProject, currentScene } from './projectStore';
import { confirmDialog, promptDialog, selectNodes, toast, useUI } from './uiStore';

/* ------------------------------ objetos ------------------------------ */
export async function newCustomObject(): Promise<void> {
  const name = await promptDialog('Novo objeto', 'Nome do objeto', 'Meu objeto');
  if (!name) return;
  const obj = CustomObjectSchema.parse({
    id: uid('obj'), name, width: 240, height: 240, createdAt: Date.now(), updatedAt: Date.now(),
    pieces: [createPiece('rect', { name: 'Base', x: 0, y: -120, w: 200, h: 200, radius: 18 })],
  });
  commit('Criar objeto', (d) => { d.customObjects[obj.id] = obj; });
  openObjectCreator(obj.id);
}

export const openObjectCreator = (id: string) => useUI.setState({ dialog: 'object-creator', objectCreatorId: id });

export function insertCustomObject(id: string): void {
  const obj = currentProject().customObjects[id];
  if (!obj) return;
  const node = createPropNode(OBJECT_PREFIX + id, { name: obj.name, y: 220 });
  node.transform.pivotX = obj.pivotX;
  node.transform.pivotY = obj.pivotY;
  const scene = currentScene();
  commit(`Inserir ${obj.name}`, (d) => {
    const s = sceneOf(d as Project, scene.id);
    s.nodes[node.id] = node;
    s.layerOrder.push(node.id);
  });
  selectNodes([node.id]);
  toast(`"${obj.name}" na cena. Ele aceita posição, escala, rotação e keyframes como qualquer objeto.`, 'success');
}

export async function deleteCustomObject(id: string): Promise<void> {
  const p = currentProject();
  const obj = p.customObjects[id];
  if (!obj) return;
  const used = customObjectUsage(p, id);
  const ok = await confirmDialog({
    title: 'Excluir objeto',
    message: used ? `"${obj.name}" está em uso ${used} vez(es) (cenas, cenários ou outros objetos). Excluir também remove esses usos. Ctrl+Z desfaz.` : `Excluir "${obj.name}"? Ctrl+Z desfaz.`,
    confirmLabel: used ? 'Excluir objeto e usos' : 'Excluir',
    danger: true,
  });
  if (!ok) return;
  commit('Excluir objeto', (d) => {
    const proj = d as Project;
    for (const s of Object.values(proj.scenes)) for (const nd of Object.values(s.nodes)) if (nd.kind === 'prop' && nd.propId === OBJECT_PREFIX + id) deleteNode(s, nd.id);
    for (const list of allPieceLists(proj)) list.splice(0, list.length, ...list.filter((pc) => !(pc.kind === 'object' && pc.refId === id)));
    delete proj.customObjects[id];
  });
}

/** Assets usados pelas peças (para levar junto à biblioteca entre projetos). */
function assetsOf(p: Project, pieces: Piece[]): Asset[] {
  return pieces.flatMap((pc) => (pc.assetId && p.assets[pc.assetId] ? [deepClone(p.assets[pc.assetId]!)] : []));
}

export async function saveObjectToLibrary(id: string): Promise<void> {
  const p = currentProject();
  const obj = p.customObjects[id];
  if (!obj) return;
  await repo.putLibrary({ id: uid('lib'), kind: 'object', name: obj.name, favorite: 0, createdAt: Date.now(), data: { object: deepClone(obj), assets: assetsOf(p, obj.pieces) } });
  toast(`"${obj.name}" salvo na sua biblioteca, para usar em outros projetos.`, 'success');
}

export async function bringObjectFromLibrary(data: { object: CustomObject; assets?: Asset[] }): Promise<void> {
  for (const a of data.assets ?? []) {
    if (!(await repo.hasBlob(a.id))) {
      toast(`Uma imagem de "${data.object.name}" não está mais neste navegador; ela aparecerá como ausente.`, 'error');
      break;
    }
  }
  const copy = { ...deepClone(data.object), id: uid('obj'), updatedAt: Date.now() };
  commit('Trazer objeto da biblioteca', (d) => {
    for (const a of data.assets ?? []) if (!d.assets[a.id]) d.assets[a.id] = a;
    d.customObjects[copy.id] = copy;
  });
  toast(`"${copy.name}" adicionado aos objetos deste projeto.`, 'success');
}

/* ------------------------------ cenários ------------------------------ */
export const openSceneCreator = (id: string, time: TimeOfDay = 'day') => useUI.setState({ dialog: 'scene-creator', sceneCreatorId: id, sceneCreatorTime: time });

export async function newScenery(): Promise<void> {
  const name = await promptDialog('Novo cenário', 'Nome do cenário', 'Meu cenário');
  if (!name) return;
  let id = '';
  commit('Criar cenário', (d) => { id = createCustomBackground(d as Project, name).id; });
  openSceneCreator(id, 'day');
}

export type StartFrom =
  | { kind: 'empty' }
  | { kind: 'copy'; from: TimeOfDay }
  | { kind: 'image-variant' }
  | { kind: 'builtin'; presetId: string; variant: 'day' | 'night' }
  | { kind: 'template'; id: string }
  | { kind: 'library'; composition: Composition; assets?: Asset[] };

const W = CUSTOM_RECT;
const floorY = 230;

/** Modelos de composição: só formas e objetos prontos, tudo editável. */
export const SCENERY_TEMPLATES: Array<{ id: string; label: string; make: (night: boolean) => Composition }> = [
  {
    id: 'street', label: 'Rua', make: (night) => ({
      sky: night ? '#1d2747' : '#9fd3f0',
      pieces: [
        createPiece('rect', { name: 'Prédios', x: 0, y: -40, w: W.w, h: 540, fill: night ? '#2c3350' : '#c9b8a6', strokeWidth: 0 }),
        createPiece('rect', { name: 'Calçada', x: 0, y: floorY + 60, w: W.w, h: 120, fill: night ? '#3a3d48' : '#b7b2a8', strokeWidth: 0 }),
        createPiece('rect', { name: 'Rua', x: 0, y: floorY + 260, w: W.w, h: 300, fill: night ? '#22242b' : '#4a4d55', strokeWidth: 0 }),
        createPiece('prop', { name: 'Árvore', refId: 'tree', x: -650, y: floorY }),
        createPiece('prop', { name: 'Poste', refId: 'streetlamp', x: 520, y: floorY, state: night ? 'on' : '' }),
        createPiece('prop', { name: 'Banco', refId: 'bench', x: -180, y: floorY }),
      ],
    }),
  },
  {
    id: 'room', label: 'Sala simples', make: (night) => ({
      sky: night ? '#1d2236' : '#e9dcc7',
      pieces: [
        createPiece('rect', { name: 'Parede', x: 0, y: -110, w: W.w, h: 900, fill: night ? '#4b4766' : '#e9dcc7', strokeWidth: 0 }),
        createPiece('rect', { name: 'Piso', x: 0, y: floorY + 200, w: W.w, h: 400, fill: night ? '#5a4635' : '#b07a4f', strokeWidth: 0 }),
        createPiece('rect', { name: 'Rodapé', x: 0, y: floorY + 8, w: W.w, h: 16, fill: '#f6efe4', strokeWidth: 0 }),
        createPiece('prop', { name: 'Janela', refId: 'window', x: -420, y: -120 }),
        createPiece('prop', { name: 'Sofá', refId: 'sofa', x: 120, y: floorY }),
        createPiece('prop', { name: 'Planta', refId: 'plant', x: 620, y: floorY }),
      ],
    }),
  },
  {
    id: 'park', label: 'Parque', make: (night) => ({
      sky: night ? '#17203a' : '#a9dcf5',
      pieces: [
        createPiece('ellipse', { name: 'Colina', x: -500, y: floorY + 60, w: 1800, h: 520, fill: night ? '#24402f' : '#7cc06e', strokeWidth: 0 }),
        createPiece('rect', { name: 'Grama', x: 0, y: floorY + 220, w: W.w, h: 440, fill: night ? '#1f3828' : '#69b05c', strokeWidth: 0 }),
        createPiece('prop', { name: 'Árvore', refId: 'tree', x: 560, y: floorY }),
        createPiece('prop', { name: 'Árvore', refId: 'tree', x: -720, y: floorY - 20, scale: 0.85 }),
        createPiece('prop', { name: 'Banco', refId: 'bench', x: 60, y: floorY }),
        createPiece('prop', { name: 'Lixeira', refId: 'trash', x: 330, y: floorY }),
      ],
    }),
  },
];

/** Peças de estrutura do Criador de Cenários. */
export const SCENERY_PRESETS = [
  { label: 'Parede', make: () => createPiece('rect', { name: 'Parede', x: 0, y: -110, w: W.w, h: 900, fill: '#e9dcc7', strokeWidth: 0 }) },
  { label: 'Piso', make: () => createPiece('rect', { name: 'Piso', x: 0, y: floorY + 200, w: W.w, h: 400, fill: '#b07a4f', strokeWidth: 0 }) },
  { label: 'Grama', make: () => createPiece('rect', { name: 'Grama', x: 0, y: floorY + 220, w: W.w, h: 440, fill: '#69b05c', strokeWidth: 0 }) },
  { label: 'Rodapé', make: () => createPiece('rect', { name: 'Rodapé', x: 0, y: floorY + 8, w: W.w, h: 16, fill: '#f6efe4', strokeWidth: 0 }) },
  { label: 'Sol ou lua', make: () => createPiece('ellipse', { name: 'Sol', x: 640, y: -360, w: 160, h: 160, fill: '#ffe08a', strokeWidth: 0 }) },
];

async function svgAsset(svg: string, name: string): Promise<Asset> {
  const { asset } = await importImageFile(new File([svg], name, { type: 'image/svg+xml' }));
  const blob = await repo.getBlob(asset.id);
  if (blob) registerAssetBlob(asset.id, blob);
  return asset;
}

/** Cria a composição de um horário a partir da origem escolhida. */
export async function startComposition(cbId: string, time: TimeOfDay, from: StartFrom): Promise<void> {
  const p = currentProject();
  const cb = p.customBackgrounds[cbId];
  if (!cb) return;
  const night = time === 'night';
  let comp: Composition = { sky: night ? '#1d2747' : '#9fd3f0', pieces: [] };
  const assets: Asset[] = [];
  if (from.kind === 'copy') comp = cloneComposition(cb.compositions[from.from]);
  else if (from.kind === 'template') comp = SCENERY_TEMPLATES.find((t) => t.id === from.id)?.make(night) ?? comp;
  else if (from.kind === 'library') {
    comp = cloneComposition(from.composition);
    assets.push(...(from.assets ?? []));
  } else if (from.kind === 'image-variant') {
    const v = cb.variants[time];
    if (!v) return;
    comp.pieces.push(createPiece('image', { name: 'Imagem do horário', assetId: v.assetId, x: 0, y: 0, w: W.w, h: W.h }));
  } else if (from.kind === 'builtin') {
    try {
      const def = getBackground(from.presetId);
      const layers = renderBackground(BackgroundSchema.parse({ presetId: from.presetId, variant: from.variant }), 'cb-');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W.w}" height="${W.h}" viewBox="${W.x} ${W.y} ${W.w} ${W.h}">${layers.sky}${layers.mid}${layers.ground}${layers.overlay}</svg>`;
      const asset = await svgAsset(svg, `${def.label}.svg`);
      assets.push(asset);
      comp.pieces.push(createPiece('image', { name: `Fundo: ${def.label}`, assetId: asset.id, x: 0, y: 0, w: W.w, h: W.h }));
      for (const f of def.furniture) {
        const pd = getProp(f.propId);
        if (pd) comp.pieces.push(createPiece('prop', { name: pd.label, refId: f.propId, x: f.x, y: f.y, scale: f.scale ?? 1, colorA: f.colorA ?? '', colorB: f.colorB ?? '', state: f.state ?? '' }));
      }
    } catch (e) {
      toast(`Não foi possível copiar o cenário: ${e instanceof Error ? e.message : 'erro'}`, 'error');
      return;
    }
  }
  commit(`Criar ${TIME_LABELS[time]}`, (d) => {
    for (const a of assets) d.assets[a.id] = a;
    const c = d.customBackgrounds[cbId];
    if (c) c.compositions[time] = comp;
  });
}

export async function startCompositionFromFile(cbId: string, time: TimeOfDay, file: File): Promise<void> {
  try {
    const { asset } = await importImageFile(file);
    const blob = await repo.getBlob(asset.id);
    if (blob) registerAssetBlob(asset.id, blob);
    commit(`Criar ${TIME_LABELS[time]}`, (d) => {
      d.assets[asset.id] = asset;
      const c = d.customBackgrounds[cbId];
      if (c) c.compositions[time] = { sky: '#9fd3f0', pieces: [createPiece('image', { name: asset.name, assetId: asset.id, x: 0, y: 0, w: W.w, h: W.h })] };
    });
  } catch (e) {
    toast(`Não foi possível usar a imagem: ${e instanceof Error ? e.message : 'erro'}`, 'error');
  }
}

export async function removeTime(cbId: string, time: TimeOfDay): Promise<void> {
  const ok = await confirmDialog({ title: `Remover ${TIME_LABELS[time]}`, message: `Remover a composição e a imagem do horário ${TIME_LABELS[time]} deste cenário? Ctrl+Z desfaz.`, confirmLabel: 'Remover horário', danger: true });
  if (!ok) return;
  commit(`Remover ${TIME_LABELS[time]}`, (d) => {
    const c = d.customBackgrounds[cbId];
    if (!c) return;
    delete c.compositions[time];
    delete c.variants[time];
  });
}

export function applySceneryToScene(cb: CustomBackground, time: TimeOfDay): void {
  const scene: Scene = currentScene();
  commit('Usar cenário', (d) => {
    const c = (d as Project).customBackgrounds[cb.id];
    if (c) applyCustomBackground(sceneOf(d as Project, scene.id), c, time);
  });
  toast(`"${cb.name}" (${TIME_LABELS[time]}) aplicado à cena atual.`, 'success');
}
