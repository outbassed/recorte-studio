/** Ações dos Criadores de Objetos e de Cenários (1.2). Tudo via commit: Undo/Redo valem. */
import type { Asset, Composition, CustomBackground, Project, Scene, TimeOfDay } from '@/engine/model/schema';
import { BackgroundSchema, CustomObjectSchema, frameSize } from '@/engine/model/schema';
import { uid } from '@/engine/model/ids';
import { createPropNode } from '@/engine/model/factory';
import { deleteNode, sceneOf } from '@/engine/model/ops';
import { cloneComposition, createPiece, customObjectUsage, OBJECT_PREFIX, allPieceLists } from '@/engine/world/pieces';
import {
  buildBackgroundBundle, buildObjectBundle, mergeBackgroundBundle, mergeBundleObjects, mergeObjectBundle, readBackgroundBundle, readObjectBundle, remapObjectRefs,
  type BackgroundBundle,
} from '@/features/library/bundles';
import { CUSTOM_RECT, TIME_LABELS, applyCustomBackground, createCustomBackground } from '@/engine/world/customBackgrounds';
import { getBackground, renderBackground } from '@/engine/world/backgrounds';
import { getProp } from '@/engine/world/props';
import { importImageFile, registerAssetBlob } from '@/features/library/assets';
import { repo, type LibraryKind } from '@/storage/db';
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

/* ------------------------------ biblioteca (pacotes com dependências) ------------------------------ */
async function registerBlobs(assets: Asset[]): Promise<number> {
  let missing = 0;
  for (const a of assets) {
    if (a.kind === 'audio') continue;
    const blob = await repo.getBlob(a.id);
    if (blob) registerAssetBlob(a.id, blob);
    else missing++;
  }
  return missing;
}
const depsLabel = (r: { addedObjects: number }) => (r.addedObjects > 1 ? ` (com ${r.addedObjects - 1} objeto(s) usado(s) por ele)` : '');

/**
 * Grava na biblioteca preservando a identidade: se já existe um registro com o mesmo ID de
 * objeto/cenário/personagem, ele é ATUALIZADO (mesmo registro, favorito e data de criação mantidos).
 */
export async function upsertLibrary(kind: LibraryKind, identity: string, name: string, data: unknown, idOf: (data: unknown) => string | undefined): Promise<'created' | 'updated'> {
  const existing = (await repo.listLibrary(kind)).find((r) => idOf(r.data) === identity);
  const now = Date.now();
  await repo.putLibrary({ id: existing?.id ?? uid('lib'), kind, name, favorite: existing?.favorite ?? 0, createdAt: existing?.createdAt ?? now, updatedAt: now, data });
  return existing ? 'updated' : 'created';
}
const field = (k: string, sub?: string) => (d: unknown): string | undefined => {
  const o = d as Record<string, Record<string, unknown> | undefined> | null;
  const v = sub ? o?.[k]?.[sub] : (o as Record<string, unknown> | null)?.[k];
  return typeof v === 'string' ? v : undefined;
};
export const libIdentity = { object: field('object', 'id'), background: field('background', 'id'), character: field('id') };

export async function saveObjectToLibrary(id: string): Promise<boolean> {
  const bundle = buildObjectBundle(currentProject(), id);
  if (!bundle) return false;
  const how = await upsertLibrary('object', bundle.object.id, bundle.object.name, bundle, libIdentity.object);
  const n = bundle.objects.length;
  toast(`"${bundle.object.name}" ${how === 'updated' ? 'atualizado na' : 'salvo na'} sua biblioteca${n ? ` com ${n} objeto(s) que ele usa` : ''}.`, 'success');
  return true;
}

export async function saveBackgroundToLibrary(id: string): Promise<boolean> {
  const bundle = buildBackgroundBundle(currentProject(), id);
  if (!bundle) return false;
  const how = await upsertLibrary('background', bundle.background.id, bundle.background.name, bundle, libIdentity.background);
  const n = bundle.objects.length;
  toast(`"${bundle.background.name}" ${how === 'updated' ? 'atualizado na' : 'salvo na'} sua biblioteca${n ? ` com ${n} objeto(s) usado(s)` : ''}.`, 'success');
  return true;
}

/** Traz um objeto da biblioteca: imagens e objetos aninhados vêm junto. Devolve false se o registro for ilegível. */
export async function bringObjectFromLibrary(data: unknown, quiet = false): Promise<string | null> {
  const read = readObjectBundle(data);
  if (!read.ok) {
    toast(`Não foi possível trazer este objeto: ${read.reason}`, 'error');
    return null;
  }
  const b = read.bundle;
  const missing = await registerBlobs(b.assets);
  let res: ReturnType<typeof mergeObjectBundle> | null = null;
  commit('Trazer objeto da biblioteca', (d) => { res = mergeObjectBundle(d as Project, b); });
  const r = res as unknown as ReturnType<typeof mergeObjectBundle>;
  if (!quiet || missing) toast(r.result.addedObjects === 0 ? `"${b.object.name}" já estava neste projeto.` : `"${b.object.name}" adicionado${depsLabel(r.result)}.${missing ? ` ${missing} imagem(ns) não estão mais neste navegador: reaparecem em Mídias como ausentes.` : ''}`, missing ? 'error' : 'success');
  return r.id;
}

export async function bringBackgroundFromLibrary(data: unknown, quiet = false): Promise<string | null> {
  const read = readBackgroundBundle(data);
  if (!read.ok) {
    toast(`Não foi possível trazer este cenário: ${read.reason}`, 'error');
    return null;
  }
  const b = read.bundle;
  const missing = await registerBlobs(b.assets);
  let res: ReturnType<typeof mergeBackgroundBundle> | null = null;
  commit('Trazer cenário da biblioteca', (d) => { res = mergeBackgroundBundle(d as Project, b); });
  const r = res as unknown as ReturnType<typeof mergeBackgroundBundle>;
  if (!quiet || missing) toast(`"${b.background.name}" adicionado${r.result.addedObjects ? ` com ${r.result.addedObjects} objeto(s)` : ''}.${missing ? ` ${missing} imagem(ns) não estão mais neste navegador: reaparecem em Mídias como ausentes.` : ''}`, missing ? 'error' : 'success');
  return r.id;
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
  | { kind: 'library'; bundle: BackgroundBundle; time: TimeOfDay };

const W = CUSTOM_RECT;
const floorY = 230;

export interface Frame { w: number; h: number }
/** Quadro do projeto em unidades do mundo (16:9 → 1920×1080; 9:16 → 608×1080). */
export const frameOf = (p: Pick<Project, 'settings'>): Frame => frameSize(p.settings);

/**
 * Ajuste ao quadro: em quadros mais estreitos que 16:9 (vertical, 4:3, quadrado), objetos
 * se aproximam do centro e diminuem para caber; em 16:9 ou mais largo nada muda.
 */
export function fitToFrame(f: Frame): { X: (x: number) => number; S: (scale?: number) => number; narrow: boolean } {
  const k = Math.min(1, f.w / 1920);
  const S = Math.min(1, Math.max(0.5, k * 1.8));
  return { X: (x) => Math.round(x * k), S: (scale = 1) => +(scale * S).toFixed(3), narrow: k < 0.999 };
}

/** Rótulo do formato do quadro: 16:9, 9:16, 1:1, 4:3 ou largura×altura. */
export function aspectLabel(settings: Pick<Project['settings'], 'width' | 'height'>): string {
  const r = settings.width / settings.height;
  for (const [w, h] of [[16, 9], [9, 16], [1, 1], [4, 3], [3, 4], [21, 9], [4, 5]] as const) if (Math.abs(r - w / h) < 0.02) return `${w}:${h}`;
  return `${settings.width}×${settings.height}`;
}

/** Modelos de composição: só formas e objetos prontos, tudo editável. Posições se ajustam ao quadro do projeto. */
export const SCENERY_TEMPLATES: Array<{ id: string; label: string; make: (night: boolean, frame: Frame) => Composition }> = [
  {
    id: 'street', label: 'Rua', make: (night, fr) => {
      const { X, S } = fitToFrame(fr);
      return {
        sky: night ? '#1d2747' : '#9fd3f0',
        pieces: [
          createPiece('rect', { name: 'Prédios', x: 0, y: -40, w: W.w, h: 540, fill: night ? '#2c3350' : '#c9b8a6', strokeWidth: 0 }),
          createPiece('rect', { name: 'Calçada', x: 0, y: floorY + 60, w: W.w, h: 120, fill: night ? '#3a3d48' : '#b7b2a8', strokeWidth: 0 }),
          createPiece('rect', { name: 'Rua', x: 0, y: floorY + 260, w: W.w, h: 300, fill: night ? '#22242b' : '#4a4d55', strokeWidth: 0 }),
          createPiece('prop', { name: 'Árvore', refId: 'tree', x: X(-650), y: floorY, scale: S() }),
          createPiece('prop', { name: 'Poste', refId: 'streetlamp', x: X(520), y: floorY, scale: S(), state: night ? 'on' : '' }),
          createPiece('prop', { name: 'Banco', refId: 'bench', x: X(-180), y: floorY, scale: S() }),
        ],
      };
    },
  },
  {
    id: 'room', label: 'Sala simples', make: (night, fr) => {
      const { X, S } = fitToFrame(fr);
      return {
        sky: night ? '#1d2236' : '#e9dcc7',
        pieces: [
          createPiece('rect', { name: 'Parede', x: 0, y: -110, w: W.w, h: 900, fill: night ? '#4b4766' : '#e9dcc7', strokeWidth: 0 }),
          createPiece('rect', { name: 'Piso', x: 0, y: floorY + 200, w: W.w, h: 400, fill: night ? '#5a4635' : '#b07a4f', strokeWidth: 0 }),
          createPiece('rect', { name: 'Rodapé', x: 0, y: floorY + 8, w: W.w, h: 16, fill: '#f6efe4', strokeWidth: 0 }),
          createPiece('prop', { name: 'Janela', refId: 'window', x: X(-420), y: -120, scale: S() }),
          createPiece('prop', { name: 'Sofá', refId: 'sofa', x: X(120), y: floorY, scale: S() }),
          createPiece('prop', { name: 'Planta', refId: 'plant', x: X(620), y: floorY, scale: S() }),
        ],
      };
    },
  },
  {
    id: 'park', label: 'Parque', make: (night, fr) => {
      const { X, S } = fitToFrame(fr);
      return {
        sky: night ? '#17203a' : '#a9dcf5',
        pieces: [
          createPiece('ellipse', { name: 'Colina', x: X(-500), y: floorY + 60, w: 1800, h: 520, fill: night ? '#24402f' : '#7cc06e', strokeWidth: 0 }),
          createPiece('rect', { name: 'Grama', x: 0, y: floorY + 220, w: W.w, h: 440, fill: night ? '#1f3828' : '#69b05c', strokeWidth: 0 }),
          createPiece('prop', { name: 'Árvore', refId: 'tree', x: X(560), y: floorY, scale: S() }),
          createPiece('prop', { name: 'Árvore', refId: 'tree', x: X(-720), y: floorY - 20, scale: S(0.85) }),
          createPiece('prop', { name: 'Banco', refId: 'bench', x: X(60), y: floorY, scale: S() }),
          createPiece('prop', { name: 'Lixeira', refId: 'trash', x: X(330), y: floorY, scale: S() }),
        ],
      };
    },
  },
];

/** Peças de estrutura do Criador de Cenários (cobrem toda a área; o sol fica dentro do quadro). */
export const SCENERY_PRESETS = (fr: Frame) => [
  { label: 'Parede', make: () => createPiece('rect', { name: 'Parede', x: 0, y: -110, w: W.w, h: 900, fill: '#e9dcc7', strokeWidth: 0 }) },
  { label: 'Piso', make: () => createPiece('rect', { name: 'Piso', x: 0, y: floorY + 200, w: W.w, h: 400, fill: '#b07a4f', strokeWidth: 0 }) },
  { label: 'Grama', make: () => createPiece('rect', { name: 'Grama', x: 0, y: floorY + 220, w: W.w, h: 440, fill: '#69b05c', strokeWidth: 0 }) },
  { label: 'Rodapé', make: () => createPiece('rect', { name: 'Rodapé', x: 0, y: floorY + 8, w: W.w, h: 16, fill: '#f6efe4', strokeWidth: 0 }) },
  { label: 'Sol ou lua', make: () => createPiece('ellipse', { name: 'Sol', x: Math.round(fr.w * 0.33), y: -360, w: 160, h: 160, fill: '#ffe08a', strokeWidth: 0 }) },
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
  let libraryBundle: BackgroundBundle | null = null;
  if (from.kind === 'copy') comp = cloneComposition(cb.compositions[from.from]);
  else if (from.kind === 'template') comp = SCENERY_TEMPLATES.find((t) => t.id === from.id)?.make(night, frameOf(p)) ?? comp;
  else if (from.kind === 'library') {
    // Composição salva: objetos e imagens que ela usa vêm junto (dentro do commit abaixo).
    comp = cloneComposition(from.bundle.background.compositions[from.time]);
    libraryBundle = from.bundle;
    await registerBlobs(from.bundle.assets);
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
      const { X, S, narrow } = fitToFrame(frameOf(p));
      for (const f of def.furniture) {
        const pd = getProp(f.propId);
        // Quadro vertical ou estreito: os móveis do cenário pronto também se aproximam do centro.
        if (pd) comp.pieces.push(createPiece('prop', { name: pd.label, refId: f.propId, x: narrow ? X(f.x) : f.x, y: f.y, scale: narrow ? S(f.scale ?? 1) : f.scale ?? 1, colorA: f.colorA ?? '', colorB: f.colorB ?? '', state: f.state ?? '' }));
      }
    } catch (e) {
      toast(`Não foi possível copiar o cenário: ${e instanceof Error ? e.message : 'erro'}`, 'error');
      return;
    }
  }
  commit(`Criar ${TIME_LABELS[time]}`, (d) => {
    for (const a of assets) d.assets[a.id] = a;
    if (libraryBundle) {
      const merged = mergeBundleObjects(d as Project, libraryBundle.objects, libraryBundle.assets);
      remapObjectRefs(comp.pieces, merged.ids);
    }
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
