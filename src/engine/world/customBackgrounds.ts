/**
 * Cenários do usuário. Cada cenário tem SÓ os horários que o criador cadastrou
 * (de um a cinco), cada um com a própria imagem. Nada é gerado por filtro.
 */
import { TIMES_OF_DAY, type Background, type CustomBackground, type Project, type Scene, type TimeOfDay } from '../model/schema';
import { uid } from '../model/ids';
import { deleteNode } from '../model/ops';
import { esc, n } from '../render/svg';
import { renderPieces } from './pieces';
import type { Composition } from '../model/schema';

const compCache = new WeakMap<Composition, { key: string; svg: string }>();
/**
 * Composição do Criador de Cenários: desenhada uma vez e reaproveitada até mudar
 * (o Immer troca a referência ao editar). Personagens estáticos entram aqui, não na timeline.
 */
export function renderComposition(project: Project, id: string, time: TimeOfDay, comp: Composition, url: (assetId: string) => string | undefined): string {
  const key = comp.pieces.map((p) => (p.assetId ? (url(p.assetId) ? 1 : 0) : '')).join('') + Object.keys(project.customObjects).length;
  const hit = compCache.get(comp);
  if (hit && hit.key === key) return hit.svg;
  const r = CUSTOM_RECT;
  const sky = /^#[0-9a-fA-F]{3,8}$/.test(comp.sky) ? comp.sky : '#9fd3f0';
  const svg = `<g data-custom-bg="${esc(id)}" data-time="${time}" data-composition="1"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="${sky}"/>${renderPieces(comp.pieces, { project, url, idPrefix: `bg${id}${time}` })}</g>`;
  compCache.set(comp, { key, svg });
  return svg;
}

export const CUSTOM_PREFIX = 'custom:';
export const TIME_LABELS: Record<TimeOfDay, string> = { morning: 'Manhã', day: 'Dia', afternoon: 'Tarde', sunset: 'Entardecer', night: 'Noite' };

/** Área do mundo coberta pela imagem: igual para todas as variantes, então o alinhamento se mantém. */
export const CUSTOM_RECT = { x: -1104, y: -621, w: 2208, h: 1242 };

export const isCustomPreset = (presetId: string): boolean => presetId.startsWith(CUSTOM_PREFIX);
export const customIdOf = (presetId: string): string => presetId.slice(CUSTOM_PREFIX.length);

export function availableTimes(cb: CustomBackground): TimeOfDay[] {
  return TIMES_OF_DAY.filter((t) => !!cb.variants[t] || !!cb.compositions?.[t]);
}

/**
 * Variante usada pela cena. Se o horário pedido não existe, usa o mais próximo e
 * avisa (`fallback`): nunca troca a arte do usuário em silêncio.
 */
export function resolveCustomVariant(cb: CustomBackground, wanted: TimeOfDay | undefined): { time: TimeOfDay; fallback: boolean } | null {
  const avail = availableTimes(cb);
  if (avail.length === 0) return null;
  if (wanted && avail.includes(wanted)) return { time: wanted, fallback: false };
  if (!wanted) return { time: avail.includes('day') ? 'day' : avail[0]!, fallback: false };
  const wi = TIMES_OF_DAY.indexOf(wanted);
  // Empate: prefere o horário mais tarde (entardecer fica mais perto da noite que da tarde).
  const best = [...avail].sort((a, b) => Math.abs(TIMES_OF_DAY.indexOf(a) - wi) - Math.abs(TIMES_OF_DAY.indexOf(b) - wi) || TIMES_OF_DAY.indexOf(b) - TIMES_OF_DAY.indexOf(a))[0]!;
  return { time: best, fallback: true };
}

export function renderCustomBackground(project: Project, bg: Background, url: (assetId: string) => string | undefined): string {
  const cb = project.customBackgrounds[customIdOf(bg.presetId)];
  const r = CUSTOM_RECT;
  const placeholder = (msg: string) =>
    `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#3a3f4b"/><text y="0" text-anchor="middle" font-size="44" font-family="Arial,sans-serif" fill="#d8dbe3">${esc(msg)}</text>`;
  if (!cb) return placeholder('Cenário personalizado removido');
  const pick = resolveCustomVariant(cb, bg.timeOfDay);
  if (!pick) return placeholder(`${cb.name}: nenhuma imagem cadastrada`);
  const comp = cb.compositions?.[pick.time];
  if (comp) return renderComposition(project, cb.id, pick.time, comp, url);
  const variant = cb.variants[pick.time]!;
  const href = url(variant.assetId);
  if (!href) return placeholder(`${cb.name}: imagem ausente`);
  const fit = variant.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice';
  return `<image data-custom-bg="${esc(cb.id)}" data-time="${pick.time}" href="${esc(href)}" x="${n(r.x)}" y="${n(r.y)}" width="${n(r.w)}" height="${n(r.h)}" preserveAspectRatio="${fit}"/>`;
}

export function createCustomBackground(project: Project, name: string): CustomBackground {
  const cb: CustomBackground = { id: uid('cbg'), name: name.trim() || 'Meu cenário', variants: {}, compositions: {}, createdAt: Date.now() };
  project.customBackgrounds[cb.id] = cb;
  return cb;
}

/** Aplica o cenário à cena (móveis de cenários nativos saem; itens do usuário ficam). */
export function applyCustomBackground(scene: Scene, cb: CustomBackground, time?: TimeOfDay): void {
  for (const nd of Object.values(scene.nodes)) if (nd.backgroundOwned) deleteNode(scene, nd.id);
  scene.background.presetId = `${CUSTOM_PREFIX}${cb.id}`;
  scene.background.timeOfDay = time ?? resolveCustomVariant(cb, 'day')?.time;
}

export function customBackgroundUsage(project: Project, id: string): number {
  return Object.values(project.scenes).filter((s) => s.background.presetId === `${CUSTOM_PREFIX}${id}`).length;
}

/** Remove o cenário; cenas que o usavam voltam ao cenário neutro (avisado na interface). */
export function deleteCustomBackground(project: Project, id: string): number {
  let changed = 0;
  for (const s of Object.values(project.scenes)) {
    if (s.background.presetId === `${CUSTOM_PREFIX}${id}`) {
      s.background.presetId = 'neutro';
      s.background.timeOfDay = undefined;
      changed++;
    }
  }
  delete project.customBackgrounds[id];
  return changed;
}
