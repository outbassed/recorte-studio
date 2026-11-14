/** IDs estáveis, nunca índices de array. */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function uid(prefix: string): string {
  const bytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(bytes);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % 36];
  return `${prefix}_${out}`;
}

/** Cópia profunda que funciona também com rascunhos do Immer (Proxy). */
export const deepClone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/**
 * ID de item da Biblioteca (personagem, objeto, cenário, pose, cena): UUID v4 criptograficamente seguro.
 * O formato dos IDs digitados pelo usuário e a validação ficam em features/library/itemIds.ts.
 */
export function newItemId(): string {
  const c = globalThis.crypto;
  if (typeof c?.randomUUID === 'function') return c.randomUUID();
  if (typeof c?.getRandomValues !== 'function') throw new Error('Este navegador não tem gerador aleatório seguro; não dá para criar IDs.');
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; // versão 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variante RFC 4122
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`;
}
