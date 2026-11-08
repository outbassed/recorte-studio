/** Manual: todo link, ajuda contextual e imagem aponta para algo que existe. */
import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHAPTERS, GROUPS, chapterById, searchManual } from '@/features/manual/content';
import { MARKS } from '@/features/manual/marks.generated';

const ids = new Set(CHAPTERS.map((c) => c.id));
const textOf = (b: object) => JSON.stringify(b);

function srcFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? srcFiles(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []));
}

describe('manual', () => {
  it('ids únicos e todos os capítulos num grupo existente', () => {
    expect(ids.size).toBe(CHAPTERS.length);
    for (const c of CHAPTERS) expect(GROUPS.some((g) => g.id === c.group), c.id).toBe(true);
  });
  it('capítulos obrigatórios presentes', () => {
    for (const id of ['introducao', 'primeiro-projeto', 'tela-inicial', 'criador-personagens', 'vistas', 'cenas', 'cenarios', 'objetos', 'camadas', 'propriedades', 'poses',
      'timeline-simples', 'timeline-avancada', 'keyframes', 'camera', 'falas', 'audio', 'lip-sync', 'legendas', 'bibliotecas', 'jrec', 'salvamento', 'exportacao',
      'offline', 'celular', 'configuracoes', 'atalhos', 'problemas', 'criador-cenarios', 'criador-objetos']) expect(chapterById(id), id).toBeTruthy();
  });
  it('links entre capítulos e "veja também" apontam para capítulos existentes', () => {
    for (const c of CHAPTERS) {
      for (const m of c.blocks.map(textOf).join(' ').matchAll(/\]\(#([a-z0-9-]+)\)/g)) expect(ids.has(m[1]!), `${c.id} → ${m[1]}`).toBe(true);
      for (const r of c.related ?? []) expect(ids.has(r), `${c.id} → ${r}`).toBe(true);
    }
  });
  it('toda ajuda contextual do app abre um capítulo existente', () => {
    const used = new Set<string>();
    for (const f of srcFiles('src')) {
      const s = readFileSync(f, 'utf8');
      for (const m of s.matchAll(/(?:HelpLink chapter|openManual\(|help)=?\s*["'(]?["']([a-z0-9-]+)["']/g)) used.add(m[1]!);
    }
    used.delete('inicio');
    expect(used.size).toBeGreaterThan(8);
    for (const id of used) expect(ids.has(id), `ajuda → ${id}`).toBe(true);
  });
  it('toda imagem citada existe em public/manual (capturas reais) e tem legenda coerente com as marcações', () => {
    for (const c of CHAPTERS) for (const b of c.blocks) {
      if (!('img' in b)) continue;
      expect(existsSync(join('public/manual', b.img)), b.img).toBe(true);
      const marks = MARKS[b.img] ?? [];
      // Toda captura tem marcações medidas e uma legenda numerada para cada uma.
      expect(marks.length, `${b.img}: sem marcações`).toBeGreaterThan(0);
      expect(b.legend?.length ?? 0, `${b.img}: legenda × marcações`).toBe(marks.length);
      for (const m of marks) {
        expect(m.x).toBeGreaterThanOrEqual(0);
        expect(m.x).toBeLessThanOrEqual(100);
        expect(m.y).toBeGreaterThanOrEqual(0);
        expect(m.y).toBeLessThanOrEqual(100);
      }
    }
  });
  it('toda imagem de public/manual é usada por algum capítulo (sem arquivo órfão)', () => {
    const used = new Set(CHAPTERS.flatMap((c) => c.blocks.flatMap((b) => ('img' in b ? [b.img] : []))));
    for (const f of readdirSync('public/manual')) expect(used.has(f), f).toBe(true);
  });
  it('busca sem acento encontra pelo título e pelo texto', () => {
    expect(searchManual('camera')[0]?.id).toBe('camera');
    expect(searchManual('cenario estatico').length).toBeGreaterThan(0);
    expect(searchManual('xyzinexistente')).toEqual([]);
  });
});
