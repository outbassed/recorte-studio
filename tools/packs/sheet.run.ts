/**
 * Folha de contato para CONFERIR visualmente o que foi criado: `SHEET_PACKS=id1,id2 SHEET_OUT=<pasta> npx vitest run -c
 * tools/packs/vitest.config.ts sheet`. Gera um HTML por pacote (SVGs reais do renderizador do app); depois é só abrir/printar.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { it } from 'vitest';
import { itemSvg } from './preview';
import { SOURCES } from './sources';

const wanted = (process.env.SHEET_PACKS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
it.skipIf(!wanted.length || !process.env.SHEET_OUT)('gera folhas de contato', async () => {
  const out = process.env.SHEET_OUT!;
  mkdirSync(out, { recursive: true });
  const size = Number(process.env.SHEET_SIZE ?? 150);
  for (const load of SOURCES) {
    const src = await load();
    if (!wanted.includes(src.meta.id) && !wanted.includes('all')) continue;
    const cells = src.items.map((it) => {
      const wide = it.kind === 'background';
      const svgs = it.kind === 'background' ? Object.keys((it.data as { background: { compositions: Record<string, unknown> } }).background.compositions).map((t) => itemSvg(it, { size: size * 1.5, time: t })).join('') : itemSvg(it, { size });
      return `<figure style="${wide ? 'grid-column:span 2;' : ''}"><div class="s">${svgs}</div><figcaption>${it.name}<br><small>${it.id}</small></figcaption></figure>`;
    });
    writeFileSync(join(out, `${src.meta.id}.html`), `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#cfd6df;font:11px system-ui}h1{margin:6px 10px;font-size:13px}.g{display:grid;grid-template-columns:repeat(auto-fill,${size + 14}px);gap:6px;padding:8px}figure{margin:0;background:#fff;border-radius:6px;padding:4px;text-align:center}.s{display:flex;justify-content:center;gap:4px;min-height:${size}px;align-items:flex-end}figcaption{overflow-wrap:anywhere;color:#222}small{color:#777;font-size:9px}</style><h1>${src.meta.id} · ${src.items.length} itens</h1><div class="g">${cells.join('')}</div>`);
  }
});
