/** `npm run packs:build`: gera public/packs/*.rspack e public/packs/index.json a partir de tools/packs/sources. */
import { resolve } from 'node:path';
import { it } from 'vitest';
import { buildOfficial, writeOfficial, type BuiltPack } from './lib';
import { SOURCES } from './sources';

it('gera os pacotes oficiais', async () => {
  const built: BuiltPack[] = [];
  for (const load of SOURCES) built.push(await buildOfficial(await load()));
  const index = writeOfficial(resolve('public/packs'), built);
  const total = index.packs.reduce((s, p) => s + p.itemCount, 0);
  console.log(`\n${index.packs.length} pacote(s), ${total} item(ns):`);
  for (const p of index.packs) console.log(`  ${p.id.padEnd(34)} v${p.version}  ${String(p.itemCount).padStart(4)} item(ns)  ${(p.size / 1024).toFixed(0).padStart(5)} KB`);
});
