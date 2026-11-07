/** Busca sem diferenciar maiúsculas nem acentos. */
export const normalizeText = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

export function matchesSearch(query: string, ...fields: Array<string | string[] | undefined>): boolean {
  const q = normalizeText(query);
  if (!q) return true;
  const hay = fields.flat().filter(Boolean).map((f) => normalizeText(f as string)).join(' ');
  return q.split(/\s+/).every((word) => hay.includes(word));
}
