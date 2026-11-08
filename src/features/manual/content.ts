/** Conteúdo do manual. Só documenta o que existe nesta versão. Imagens: public/manual (capturas reais). */
import { normalizeText as normalize } from '@/features/library/search';

export type Block =
  | { p: string }
  | { h: string }
  | { steps: string[] }
  | { list: string[] }
  | { tip: string }
  | { warn: string }
  | { img: string; alt: string; caption?: string; marks?: Array<{ n: number; x: number; y: number }>; legend?: string[] }
  | { glossary: Array<[string, string]> }
  | { shortcuts: true }
  | { table: string[][] };

export interface Chapter { id: string; title: string; group: string; summary: string; blocks: Block[]; related?: string[] }

export const GROUPS = [
  { id: 'comecar', label: 'Começar' },
];

export const CHAPTERS: Chapter[] = [
  { id: 'inicio', title: 'Manual', group: 'comecar', summary: 'Página inicial do manual.', blocks: [] },
];

export const chapterById = (id: string) => CHAPTERS.find((c) => c.id === id);

const textOf = (b: Block): string => {
  if ('p' in b) return b.p;
  if ('h' in b) return b.h;
  if ('steps' in b) return b.steps.join(' ');
  if ('list' in b) return b.list.join(' ');
  if ('tip' in b) return b.tip;
  if ('warn' in b) return b.warn;
  if ('img' in b) return `${b.alt} ${b.caption ?? ''} ${(b.legend ?? []).join(' ')}`;
  if ('glossary' in b) return b.glossary.flat().join(' ');
  if ('table' in b) return b.table.flat().join(' ');
  return '';
};

/** Busca sem acento por título, resumo e texto; título pesa mais. */
export function searchManual(q: string): Array<{ id: string; title: string; snippet: string }> {
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return CHAPTERS.filter((c) => c.id !== 'inicio')
    .map((c) => {
      const title = normalize(c.title);
      const body = normalize(`${c.summary} ${c.blocks.map(textOf).join(' ')}`.replace(/\*\*|\[|\]\(#[a-z0-9-]+\)/g, ''));
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 5;
        else if (body.includes(t)) score += 1;
        else return null;
      }
      const raw = `${c.summary} ${c.blocks.map(textOf).join(' ')}`.replace(/\*\*|\[|\]\(#[a-z0-9-]+\)/g, '');
      const at = normalize(raw).indexOf(terms[0]!);
      const snippet = at >= 0 ? `${at > 30 ? '…' : ''}${raw.slice(Math.max(0, at - 30), at + 70)}…` : c.summary;
      return { id: c.id, title: c.title, snippet, score };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => b.score - a.score)
    .map(({ score: _s, ...r }) => r);
}
