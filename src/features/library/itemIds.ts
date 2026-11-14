/**
 * Identidade dos itens da Biblioteca.
 *
 * - Padrão automático: UUID v4 (crypto.randomUUID, ou getRandomValues como alternativa segura).
 * - ID personalizado: 1 a 40 caracteres, só `A-Z a-z 0-9 -` (maiúsculas e minúsculas são IDs diferentes).
 * - IDs legados (`obj_x7k…`, `char_…`, `lib_…`, `pk_panela`) continuam válidos como identidade: eles existem
 *   em projetos .jrec e bibliotecas antigas e NUNCA são reescritos em silêncio. A regra de formato vale para
 *   IDs que o usuário digita ou que o programa cria daqui para frente.
 *
 * Tudo aqui é puro (sem React nem IndexedDB) para ser testado em unidade.
 */
import { newItemId } from '@/engine/model/ids';

export const ITEM_ID_MAX = 40;
/** Formato dos IDs personalizados. */
export const ITEM_ID_PATTERN = /^[A-Za-z0-9-]{1,40}$/;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export { newItemId };

export const isUuidV4 = (id: string): boolean => UUID_V4.test(id);

/** O ID segue o formato novo (1–40 caracteres de A-Z, a-z, 0-9 e hífen)? */
export const isValidItemId = (id: string): boolean => ITEM_ID_PATTERN.test(id);

/** ID que existe e é aceito por compatibilidade, mas não segue o formato novo (ex.: `obj_x7k2`). */
export const isLegacyItemId = (id: string): boolean => id.length > 0 && !ITEM_ID_PATTERN.test(id);

export type IdProblem = 'empty' | 'too-long' | 'invalid-chars' | 'taken';
export type IdValidation = { ok: true; id: string } | { ok: false; problem: IdProblem; message: string };

/**
 * Valida um ID digitado. Não apara espaços nem troca maiúsculas: "Rafael" e "rafael" são IDs diferentes.
 * `taken` informa se o ID já existe (a comparação é exata, com diferença de maiúsculas).
 */
export function validateItemId(raw: string, taken?: (id: string) => string | boolean | undefined): IdValidation {
  if (raw.length === 0) return { ok: false, problem: 'empty', message: `Informe um ID (de 1 a ${ITEM_ID_MAX} caracteres).` };
  if (raw.length > ITEM_ID_MAX) return { ok: false, problem: 'too-long', message: `O ID tem ${raw.length} caracteres; o máximo é ${ITEM_ID_MAX}.` };
  if (!ITEM_ID_PATTERN.test(raw)) {
    const bad = [...new Set([...raw].filter((ch) => !/[A-Za-z0-9-]/.test(ch)))].map((ch) => (ch === ' ' ? 'espaço' : `"${ch}"`)).slice(0, 4).join(', ');
    return { ok: false, problem: 'invalid-chars', message: `Use só letras sem acento (a-z, A-Z), números (0-9) e hífen (-). Não pode: ${bad}.` };
  }
  const t = taken?.(raw);
  if (t) return { ok: false, problem: 'taken', message: typeof t === 'string' ? `Este ID já está em uso por "${t}".` : 'Este ID já está em uso por outro item.' };
  return { ok: true, id: raw };
}

/** Gera um UUID v4 que ainda não está em uso (na prática, o primeiro já serve). */
export function uniqueItemId(taken: (id: string) => boolean): string {
  for (let i = 0; i < 20; i++) {
    const id = newItemId();
    if (!taken(id)) return id;
  }
  throw new Error('Não foi possível gerar um ID livre.');
}
