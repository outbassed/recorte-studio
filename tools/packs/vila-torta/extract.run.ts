/**
 * Extrai de Vila Torta (T1E1 e T1E2) os personagens, objetos e cenários REAIS dos episódios, sem alterar nada:
 * os dados saem exatamente como estão nos .jrec (IDs, desenhos, notas). Só é rodado quando os episódios mudam.
 *
 *   VT_E1=<project.json do T1E1> VT_E2=<project.json do T1E2> VT_SRC=<pasta com os .jrec> \
 *     npx vitest run -c tools/packs/vitest.config.ts extract
 *
 * Os episódios NÃO são modificados nem copiados para este repositório; só os itens extraídos entram em
 * tools/packs/sources/vila-torta/data, junto com a procedência (sha256 dos arquivos de origem).
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { it, expect } from 'vitest';
import { ProjectSchema, type CharacterDefinition, type CustomBackground, type CustomObject, type Project } from '@/engine/model/schema';
import { buildBackgroundBundle, buildObjectBundle } from '@/features/library/bundles';
import { canonicalJson } from '@/features/packs/conflicts';

const OUT = resolve('tools/packs/sources/vila-torta/data');
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
/**
 * Chave do DESENHO: ignora o ID do item, as datas e os IDs internos aleatórios das peças (`pc_…`), que mudam a cada
 * geração sem mudar nada do que se vê. Só serve para decidir se dois itens dos episódios são o mesmo desenho; os
 * dados gravados continuam exatamente como estão no episódio.
 */
const designKey = (v: unknown): string => canonicalJson(JSON.parse(JSON.stringify(v, function (this: unknown, k, val) {
  if (k === 'createdAt' || k === 'updatedAt') return 0;
  if (k === 'pieces' && Array.isArray(val)) return val.map((p: Record<string, unknown>, i) => ({ ...p, id: `#${i}` }));
  return val;
})));
const noId = <T extends { id: string }>(o: T) => designKey({ ...o, id: '' });

// Só roda quando os episódios são informados (o `packs:build` comum usa os dados já extraídos).
it.skipIf(!process.env.VT_E1 || !process.env.VT_E2)('extrai os itens de Vila Torta', () => {
  const p1 = process.env.VT_E1!, p2 = process.env.VT_E2!;
  const raw1 = readFileSync(p1), raw2 = readFileSync(p2);
  const e1: Project = ProjectSchema.parse(JSON.parse(raw1.toString('utf8')));
  const e2: Project = ProjectSchema.parse(JSON.parse(raw2.toString('utf8')));

  /* ---------- personagens: ordem = ordem dos episódios; mesmo desenho com ID diferente vira um só (alias registrado) ---------- */
  const chars: CharacterDefinition[] = [];
  const aliases: Record<string, string> = {};
  const seenContent = new Map<string, string>();
  for (const src of [e1, e2]) {
    for (const c of Object.values(src.characters)) {
      const content = canonicalJson({ ...c, id: '' });
      const known = chars.find((x) => x.id === c.id);
      if (known) { expect(canonicalJson(known), `mesmo ID, desenho diferente: ${c.name}`).toBe(canonicalJson(c)); continue; }
      const same = seenContent.get(content);
      if (same) { aliases[c.id] = same; continue; }
      chars.push(c);
      seenContent.set(content, c.id);
    }
  }

  /* ---------- objetos: união por ID; mesmo ID precisa ter o mesmo desenho ---------- */
  const objs = new Map<string, ReturnType<typeof buildObjectBundle>>();
  const objSource: Record<string, string[]> = {};
  for (const [tag, src] of [['T1E1', e1], ['T1E2', e2]] as const) {
    for (const o of Object.values(src.customObjects) as CustomObject[]) {
      const b = buildObjectBundle(src, o.id)!;
      expect(b.assets, `objeto com imagens: ${o.id}`).toEqual([]);
      const have = objs.get(o.id);
      if (have) expect(noId(have!.object), `objeto ${o.id} difere entre episódios`).toBe(noId(b.object));
      else objs.set(o.id, b);
      (objSource[o.id] ??= []).push(tag);
    }
  }

  /* ---------- cenários: mesmo nome e mesmo desenho com IDs diferentes viram um só ---------- */
  const bgs: Array<ReturnType<typeof buildBackgroundBundle>> = [];
  const bgSource: Record<string, string[]> = {};
  for (const [tag, src] of [['T1E1', e1], ['T1E2', e2]] as const) {
    for (const cb of Object.values(src.customBackgrounds) as CustomBackground[]) {
      const b = buildBackgroundBundle(src, cb.id)!;
      expect(b.assets).toEqual([]);
      const same = bgs.find((x) => x!.background.name === cb.name);
      if (same) {
        const eq = designKey({ ...same!.background, id: '' }) === designKey({ ...b.background, id: '' })
          && designKey([...same!.objects].sort((x, y) => x.id.localeCompare(y.id))) === designKey([...b.objects].sort((x, y) => x.id.localeCompare(y.id)));
        expect(eq, `cenário "${cb.name}" difere entre episódios`).toBe(true);
        aliases[cb.id] = same!.background.id;
        bgSource[same!.background.id]!.push(tag);
        continue;
      }
      bgs.push(b);
      bgSource[cb.id] = [tag];
    }
  }

  const strip = <T extends object>(b: T): T => JSON.parse(JSON.stringify(b, (k, v) => (k === 'createdAt' || k === 'updatedAt' ? 0 : v)));
  writeFileSync(join(OUT, 'characters.json'), `${JSON.stringify(chars, null, 1)}\n`);
  writeFileSync(join(OUT, 'objects.json'), `${JSON.stringify([...objs.values()].map((b) => strip(b!)), null, 1)}\n`);
  writeFileSync(join(OUT, 'backgrounds.json'), `${JSON.stringify(bgs.map((b) => strip(b!)), null, 1)}\n`);
  const src = process.env.VT_SRC;
  const jrec = (n: string) => (src ? sha(readFileSync(join(src, n))) : null);
  writeFileSync(join(OUT, 'provenance.json'), `${JSON.stringify({
    nota: 'Itens extraídos sem alteração dos episódios de Vila Torta. Os episódios não foram modificados.',
    repositorio: 'outbassed/recorte-studio', ramo: 'claude/vila-torta-t1e1-producao-a3k6yr', commit: '6d88e88',
    episodios: [
      { sigla: 'T1E1', arquivo: 'producoes/vila-torta/entrega/Vila-Torta-T1E1-Politicos-de-Estimacao.jrec', sha256Jrec: jrec('e1.jrec'), sha256ProjectJson: sha(raw1), titulo: e1.title },
      { sigla: 'T1E2', arquivo: 'producoes/vila-torta/t2/entrega/Vila-Torta-T1E2-O-Show-e-o-Fiscal.jrec', sha256Jrec: jrec('e2.jrec'), sha256ProjectJson: sha(raw2), titulo: e2.title },
    ],
    contagens: { personagens: chars.length, objetos: objs.size, cenarios: bgs.length },
    aliasesDeId: aliases,
    objetosPorEpisodio: objSource, cenariosPorEpisodio: bgSource,
  }, null, 1)}\n`);
  console.log(`personagens=${chars.length} objetos=${objs.size} cenarios=${bgs.length} aliases=${Object.keys(aliases).length}`);
});
