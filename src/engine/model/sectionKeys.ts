/**
 * Keyframe universal por seção de Propriedades.
 *
 * Uma seção declara a lista de caminhos de propriedade que ela mostra; aqui se decide, para o tipo de
 * seleção, quais deles são mesmo animáveis (existem no esquema único de propriedades), em que estado
 * estão no instante atual e como criar os keyframes que faltam. É lógica pura: sem React, sem store.
 *
 * Regras:
 *  - só entram propriedades com definição de animação para aquele tipo de seleção (pivô, sombra,
 *    cores e interruptores não entram);
 *  - nunca duplica nem sobrescreve: um keyframe que já existe no instante é mantido como está;
 *  - o valor gravado é o valor ATUAL naquele instante (interpolado, se a propriedade já é animada);
 *  - criar é tudo ou nada dentro de uma única transação do chamador (um só Ctrl+Z).
 */
import type { KeyValue, Scene, SceneNode } from './schema';
import { ensurePropertyTrack, findPropertyTrack, readProperty, setKeyframe } from './ops';
import { getPropertyDef } from './properties';

export type KeyOwner = SceneNode['kind'] | 'camera';

/** Instante de keyframe: inteiro, nunca negativo (mesma regra do botão individual). */
export const keyTime = (timeMs: number): number => Math.max(0, Math.round(timeMs));

/** Caminhos da seção que podem ser animados para esse tipo de seleção (ordem mantida, sem repetição). */
export function animatablePaths(kind: KeyOwner, paths: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    if (seen.has(p) || !getPropertyDef(kind, p)) continue;
    seen.add(p);
    out.push(p);
  }
  return out;
}

export type SectionKeyStatus = 'none' | 'partial' | 'all';
export interface SectionKeyState {
  status: SectionKeyStatus;
  total: number;
  withKey: number;
  /** Caminhos que ainda não têm keyframe exatamente neste instante. */
  missing: string[];
  /** Alguma propriedade da seção já tem animação (em qualquer instante). */
  animated: boolean;
}

export function sectionKeyState(scene: Scene, target: string, paths: readonly string[], timeMs: number): SectionKeyState {
  const t = keyTime(timeMs);
  const missing: string[] = [];
  let animated = false;
  for (const p of paths) {
    const track = findPropertyTrack(scene, target, p);
    if (track?.keyframes.length) animated = true;
    if (!track?.keyframes.some((k) => k.timeMs === t)) missing.push(p);
  }
  const total = paths.length;
  const withKey = total - missing.length;
  return { status: withKey === 0 ? 'none' : withKey === total ? 'all' : 'partial', total, withKey, missing, animated };
}

export interface AddSectionKeysResult {
  /** Propriedades que ganharam keyframe agora. */
  created: string[];
  /** Propriedades que já tinham keyframe neste instante e foram mantidas intactas. */
  kept: string[];
  /** Propriedades ignoradas por não terem valor legível. */
  skipped: string[];
}

/**
 * Cria os keyframes que faltam no instante. Chamar DENTRO de um `commit` (cena = rascunho do Immer).
 * Lê todos os valores antes de criar qualquer faixa, para que a ordem das propriedades não importe.
 */
export function addSectionKeys(scene: Scene, target: string, kind: KeyOwner, paths: readonly string[], timeMs: number): AddSectionKeysResult {
  const t = keyTime(timeMs);
  const list = animatablePaths(kind, paths);
  const res: AddSectionKeysResult = { created: [], kept: [], skipped: [] };
  const pending: Array<{ path: string; value: KeyValue }> = [];
  for (const path of list) {
    if (findPropertyTrack(scene, target, path)?.keyframes.some((k) => k.timeMs === t)) {
      res.kept.push(path);
      continue;
    }
    const raw = readProperty(scene, target, path, t);
    const def = getPropertyDef(kind, path)!;
    const value = raw === null || raw === undefined ? (def.kind === 'enum' ? '' : undefined) : (raw as KeyValue);
    if (value === undefined) res.skipped.push(path);
    else pending.push({ path, value });
  }
  for (const { path, value } of pending) {
    setKeyframe(ensurePropertyTrack(scene, target, path), t, value);
    res.created.push(path);
  }
  return res;
}
