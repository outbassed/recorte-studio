# Compatibilidade: como provar que projetos antigos não mudam

Antes de mexer no motor (Fase 0) foram fixados "hashes de referência" do desenho, gerados **pelo motor original** (`b52e322`).
Qualquer mudança visual em projetos antigos derruba o teste.

## 1. Testes dourados (rodam em todo `npm test`)

| Teste | O que fixa |
|---|---|
| `tests/unit/character-render-golden.test.ts` | SVG + posição de mãos/cabeça de **cada personagem padrão × 8 vistas × 8 poses** (inclui tronco inclinado, respiração, sentado, corpo elevado): 768 hashes em `tests/unit/golden/character-render.json` |
| `tests/unit/legacy-scene-golden.test.ts` | quadro inteiro (o mesmo SVG da prévia e da exportação) da fixture real **v0.4** migrada e do projeto de demonstração, em 4 instantes: `tests/unit/golden/legacy-scenes.json` |

Regerar **de propósito** (mudança visual aprovada): `RECORTE_UPDATE_GOLDEN=1 npx vitest run tests/unit/<arquivo>`.
Os hashes atuais foram gerados com o código **original** (via `git stash` das mudanças em `src/`) e conferidos depois com o novo.

## 2. Episódios reais de Vila Torta (.jrec): original × novo

Os `.jrec` ficam só na branch `claude/vila-torta-t1e1-producao-a3k6yr`; **não** foram copiados para este repositório.
Método (repetível):

1. Extrair para uma pasta temporária, separada do repositório (dados não confiáveis):
   ```bash
   mkdir -p /tmp/vt && git show origin/claude/vila-torta-t1e1-producao-a3k6yr:producoes/vila-torta/entrega/Vila-Torta-T1E1-Politicos-de-Estimacao.jrec > /tmp/vt/t1e1.jrec
   git show origin/claude/vila-torta-t1e1-producao-a3k6yr:producoes/vila-torta/t2/entrega/Vila-Torta-T1E2-O-Show-e-o-Fiscal.jrec > /tmp/vt/t1e2.jrec
   ```
2. Criar um worktree do app **original** (`git worktree add --detach /tmp/orig origin/recortestudio`, com `node_modules` ligado por link).
3. Em **cada** árvore, rodar este teste temporário (não é versionado) e gravar o JSON de hashes; depois comparar os dois JSON:
   ```ts
   import { createHash } from 'node:crypto';
   import { readFileSync, writeFileSync } from 'node:fs';
   import { it, expect } from 'vitest';
   import { extractZip } from '@/features/projects/archive';
   import { parseEntries } from '@/features/projects/jrec';
   import { planFrame, planToSvgString } from '@/engine/render/plan';
   it('hashes', async () => {
     const out: Record<string, string> = {};
     for (const name of ['t1e1', 't1e2']) {
       const parsed = await parseEntries(extractZip(new Uint8Array(readFileSync(`/tmp/vt/${name}.jrec`))));
       if (parsed.kind === 'media') throw new Error('não é projeto');
       const p = parsed.project;
       for (const [i, sid] of p.sceneOrder.entries()) {
         const s = p.scenes[sid]!;
         for (const frac of [0, 0.2, 0.4, 0.6, 0.8, 0.99]) {
           const t = Math.round(s.durationMs * frac);
           out[`${name}|cena${i}|${t}`] = createHash('sha256').update(planToSvgString(planFrame(p, s, t, () => undefined), 96, 54)).digest('hex').slice(0, 16);
         }
       }
     }
     writeFileSync(process.env.VT_OUT!, JSON.stringify(out));
     expect(Object.keys(out).length).toBeGreaterThan(20);
   });
   ```

**Resultado desta entrega:** 1.662 quadros comparados, **0 diferenças**.

## 3. Compatibilidade para frente e para trás

* **Novo app abre arquivo antigo:** sem `ik`, o campo ganha o padrão (desligado) ao ler.
* **App original abre arquivo do novo app:** o esquema (Zod) descarta o campo desconhecido `ik`; sem erro (verificado rodando o importador do app original sobre `docs/recortestudio/demo/ik-apontar-e-alcancar.json`).
* Ao reabrir no app original e salvar, o IK é perdido (esperado: o app original não o conhece). Os ângulos do rig do personagem, que o IK não altera no arquivo salvo, continuam como estavam.

## 4. Layout

`tools/layout-diff.py` compara as capturas de `docs/recortestudio/baseline/original` (app `b52e322`) e `…/novo`:
medidas das regiões principais (cabeçalho, painéis, palco, propriedades) e pixels diferentes. Reproduzir:

```bash
LAYOUT_OUT=docs/recortestudio/baseline/novo npx playwright test --project=baseline
BASE_URL=http://localhost:4174 LAYOUT_OUT=docs/recortestudio/baseline/original npx playwright test --project=baseline   # app original servido em outra porta
python3 tools/layout-diff.py docs/recortestudio/baseline/original docs/recortestudio/baseline/novo docs/recortestudio/baseline/comparacao.md
```
