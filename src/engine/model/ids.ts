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
