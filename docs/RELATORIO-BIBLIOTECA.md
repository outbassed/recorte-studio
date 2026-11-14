# Relatório: expansão da Biblioteca do Recorte Studio

Branch: **`claude/confident-turing-m65b6g`** (sobre a `main`). **Sem merge, sem deploy e sem PR**, como pedido. Tudo que está marcado como feito foi executado e verificado; o que não foi feito está dito na seção "O que NÃO foi feito".

## 1. Resumo

| | |
| --- | ---: |
| Itens **novos criados** (originais, CC0) | **780** |
| Itens **recuperados dos episódios** de Vila Torta (já existiam; não contam como novos) | 95 |
| Itens no catálogo oficial | 875 |
| Pacotes `.rspack` oficiais | 48 (41 novos + 7 de Vila Torta) |
| Meta "mais de 500 novos itens reais" | **atingida: 780** |

A Biblioteca agora tem: IDs únicos com validação e conflito de importação, popup de detalhes, busca e filtros ampliados, catálogo oficial de pacotes (coleções, volumes, instalação e atualização) e conteúdo real e funcional. Nada foi simulado: todo item é lido pelo leitor real de pacotes, desenhado pelo renderizador do app e instalável.

## 2. Contagem real

**Por tipo (novos):** 531 objetos, 179 personagens (inclui corpos-base), 35 cenários, 35 poses. Animados (objetos com animação própria): **63**. Dos 179 personagens, 162 são personagens prontos e 17 são corpos-base.

| Categoria | Itens novos |
| --- | ---: |
| Personagens | 179 |
| Decoração | 89 |
| Alimentos | 69 |
| Animais | 44 |
| Móveis | 37 |
| Cenários | 35 |
| Poses | 35 |
| Acessórios | 33 |
| Urbano | 28 |
| Utensílios | 27 |
| Veículos | 25 |
| Escola e escritório | 22 |
| Eletrodomésticos | 20 |
| Efeitos | 19 |
| Instrumentos musicais | 18 |
| Brinquedos | 18 |
| Ferramentas | 18 |
| Eletrônicos | 17 |
| Esportes | 16 |
| Plantas | 14 |
| Festa | 8 |
| Presentes | 8 |
| Roupas | 1 |
| **Total** | **780** |

**Vila Torta (recuperados):** 53 objetos, 6 cenários, 36 personagens (inclui corpos-base).

### Por pacote

| Pacote | Coleção | Vol. | Itens | Composição | Animados | Tamanho | Origem do conteúdo |
| --- | --- | ---: | ---: | --- | ---: | ---: | --- |
| `acessorios-1` | Acessórios | 1 | 22 | 22 obj. | 1 | 15 KB | novo |
| `animais-1` | Animais | 1 | 37 | 37 obj. | 3 | 30 KB | novo |
| `aniversario-1` | Aniversário | 1 | 13 | 2 pers., 11 obj. | 3 | 11 KB | novo |
| `ano-novo-1` | Ano-Novo | 1 | 10 | 10 obj. | 4 | 11 KB | novo |
| `carnaval-1` | Carnaval | 1 | 19 | 6 pers., 13 obj. | 2 | 15 KB | novo |
| `decoracao-1` | Casa | 1 | 19 | 19 obj. | 2 | 14 KB | novo |
| `eletrodomesticos-1` | Casa | 1 | 20 | 20 obj. | 7 | 16 KB | novo |
| `eletronicos-1` | Casa | 1 | 16 | 16 obj. | 0 | 10 KB | novo |
| `moveis-1` | Casa | 1 | 33 | 33 obj. | 0 | 22 KB | novo |
| `utensilios-1` | Casa | 1 | 26 | 26 obj. | 1 | 16 KB | novo |
| `casamento-1` | Casamento | 1 | 16 | 6 pers., 10 obj. | 0 | 12 KB | novo |
| `cenarios-casa-1` | Cenários | 1 | 8 | 8 cen. | 0 | 15 KB | novo |
| `cenarios-cidade-1` | Cenários | 2 | 13 | 13 cen. | 0 | 33 KB | novo |
| `cenarios-lazer-1` | Cenários | 3 | 8 | 8 cen. | 0 | 17 KB | novo |
| `cenarios-festas-1` | Cenários | 4 | 6 | 6 cen. | 0 | 14 KB | novo |
| `urbano-1` | Cidade | 1 | 28 | 28 obj. | 2 | 20 KB | novo |
| `alimentos-1` | Comida | 1 | 36 | 36 obj. | 0 | 22 KB | novo |
| `corpos-1` | Corpos | 1 | 17 | 17 pers. | 0 | 11 KB | novo |
| `datas-comemorativas-1` | Datas Comemorativas | 1 | 23 | 23 obj. | 5 | 18 KB | novo |
| `brinquedos-1` | Diversão | 1 | 15 | 15 obj. | 0 | 10 KB | novo |
| `efeitos-1` | Efeitos | 1 | 14 | 14 obj. | 14 | 16 KB | novo |
| `escola-1` | Escola | 1 | 22 | 22 obj. | 0 | 14 KB | novo |
| `esportes-1` | Esportes | 1 | 16 | 16 obj. | 0 | 11 KB | novo |
| `festa-junina-1` | Festa Junina | 1 | 19 | 5 pers., 14 obj. | 5 | 16 KB | novo |
| `formatura-1` | Formatura | 1 | 8 | 2 pers., 6 obj. | 1 | 6 KB | novo |
| `halloween-1` | Halloween | 1 | 16 | 16 obj. | 5 | 14 KB | novo |
| `instrumentos-1` | Música | 1 | 14 | 14 obj. | 0 | 10 KB | novo |
| `natal-1` | Natal | 1 | 37 | 6 pers., 31 obj. | 5 | 29 KB | novo |
| `natal-2` | Natal | 2 | 13 | 13 obj. | 1 | 10 KB | novo |
| `plantas-1` | Natureza | 1 | 14 | 14 obj. | 0 | 10 KB | novo |
| `pascoa-1` | Páscoa | 1 | 13 | 13 obj. | 0 | 10 KB | novo |
| `figurantes-1` | Personagens | 1 | 16 | 16 pers. | 0 | 11 KB | novo |
| `personagens-adolescentes-1` | Personagens | 1 | 14 | 14 pers. | 0 | 9 KB | novo |
| `personagens-adultos-1` | Personagens | 1 | 22 | 22 pers. | 0 | 14 KB | novo |
| `personagens-criancas-1` | Personagens | 1 | 14 | 14 pers. | 0 | 9 KB | novo |
| `personagens-fantasia-1` | Personagens | 1 | 22 | 22 pers. | 0 | 14 KB | novo |
| `personagens-idosos-1` | Personagens | 1 | 12 | 12 pers. | 0 | 8 KB | novo |
| `personagens-profissoes-1` | Personagens | 1 | 35 | 35 pers. | 0 | 23 KB | novo |
| `poses-1` | Poses | 1 | 35 | 35 poses | 0 | 11 KB | novo |
| `ferramentas-1` | Trabalho | 1 | 18 | 18 obj. | 0 | 11 KB | novo |
| `veiculos-1` | Veículos | 1 | 21 | 21 obj. | 2 | 17 KB | novo |
| `vila-torta-assets-1` | Vila Torta | 1 | 26 | 26 obj. | 4 | 23 KB | recuperado |
| `vila-torta-cenarios-1` | Vila Torta | 1 | 6 | 6 cen. | 0 | 11 KB | recuperado |
| `vila-torta-personagens-1` | Vila Torta | 1 | 7 | 7 pers. | 0 | 10 KB | recuperado |
| `vila-torta-veiculos-1` | Vila Torta | 1 | 6 | 6 obj. | 0 | 6 KB | recuperado |
| `vila-torta-assets-2` | Vila Torta | 2 | 21 | 21 obj. | 2 | 18 KB | recuperado |
| `vila-torta-personagens-2` | Vila Torta | 2 | 17 | 17 pers. | 0 | 12 KB | recuperado |
| `vila-torta-personagens-3` | Vila Torta | 3 | 12 | 12 pers. | 0 | 8 KB | recuperado |

## 3. Por fase

### Fase 1: inspeção, IDs e conflitos
- **Inspeção:** `main` tinha 407 testes unitários e IDs `obj_/char_/lib_` aleatórios; pacotes só carregavam objetos e cenários; **o criador de roupas e cabelos (`feature/recorte-studio-3b-roupas-cabelos`) ainda não está na `main`**.
- **Implementado:** `itemIds.ts` (UUID v4, regex `^[A-Za-z0-9-]{1,40}$`, validação com motivo, maiúsculas distintas); criação, duplicação e cópias geram UUID v4; IDs legados preservados; **motor de conflitos** (`conflicts.ts`: duplicata idêntica × conflito, item padrão protegido, situação do pacote, opções A/B/C/D, troca de referências internas, arquivo original intacto); instalação transacional; diálogo "Conflito de ID detectado"; **Alterar ID** com atualização de referências; importação de `.json` de biblioteca no mesmo motor.
- Detalhes: `docs/BIBLIOTECA-IDS.md`.

### Fase 2: interface
- Painel lateral removido; **popup centralizado** reutilizável (≤ ~950 px, 85% da altura, rolagem interna, fundo discretamente escurecido, X, Esc, clique fora, foco preso e devolvido; celular em tela cheia) com todos os campos pedidos e os botões existentes.
- Personagem: 4 vistas + diagonais sob demanda. Busca por nome, **ID exato respeitando maiúsculas** (`id:`), tipo, categoria, **subcategoria**, tags, descrição, pacote, coleção e origem, sem acento. Filtros Oficiais, Animados, Vila Torta, Feriados, Eventos, coleção e pacote em "Mais filtros" (recolhido no celular).

### Fase 3: catálogo oficial
- Pacotes são arquivos reais em `public/packs/` + `index.json`, baixados sob demanda e conferidos por **sha256**; instalação por volume e **por coleção**, ver o conteúdo antes de instalar, estado, **atualização legítima**, desativar e remover com segurança, conteúdo essencial só leitura. Formato `.rspack` estendido de forma retrocompatível (personagens, poses, metadados, coleção, volume). Service worker rede-primeiro para `packs/`.
- Detalhes: `docs/PACOTES-OFICIAIS.md`.

### Fase 4: conteúdo existente (Vila Torta)
- 95 itens extraídos **sem alteração** dos dois `.jrec` (36 personagens, 53 objetos, 6 cenários), com procedência (sha256). 8 personagens e 5 cenários eram o mesmo desenho com IDs diferentes entre os episódios: entram uma vez. **Lon Ruan** (o cantor do T1E2, defendido por Caíque na sequência "A discussão sobre Lon Ruan") está em `vila-torta-personagens-2`.
- **Fora de propósito:** Ramires, Valentina, Rodrigues, "Narigaço" e os pais dos protagonistas (não existem nos episódios; sem aprovação). Ficha em `docs/vila-torta-fichas-pendentes.md`. Detalhes: `docs/VILA-TORTA.md`.

### Fase 5: expansão
- 780 itens originais: personagens (crianças, adolescentes, adultos, idosos, 35 profissionais, fantasia, caricaturais, figurantes e personagens de festas), corpos-base (roupa neutra: o app não desenha corpo sem roupa, então **não há nudez**), poses, móveis, eletrodomésticos, utensílios, alimentos, ferramentas, eletrônicos, escola, brinquedos, decoração, esportes, instrumentos, plantas, mobiliário urbano, veículos, animais, efeitos animados, **feriados e eventos** (Natal 1 e 2, Páscoa, Ano-Novo, Carnaval, Festa Junina, Halloween, aniversário, casamento, formatura, datas comemorativas), acessórios e **35 cenários com dia e noite**.
- Produzidos com a DSL de `tools/packs/` e **conferidos visualmente** em folhas de contato renderizadas pelo próprio motor. Guardas automáticas: **nenhuma duplicata disfarçada** (o teste achou e removeu um "Corpo adulto" idêntico ao "Corpo médio"), todo item desenhável sem erro, IDs únicos em todos os pacotes.

### Fase 6: validação e documentação
- Testes (seção 4), documentos novos e atualizados: `docs/BIBLIOTECA-IDS.md`, `docs/PACOTES-OFICIAIS.md`, `docs/VILA-TORTA.md`, `docs/vila-torta-fichas-pendentes.md`, `CHANGELOG.md`, `README.md`, `docs/CATALOGO.md`, `docs/LICENCAS.md`, `docs/TESTES.md`.

## 4. Testes (executados de verdade)

Ambiente: Linux, Node 22.23, Google Chrome for Testing 153 (via Playwright), build de produção.

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | sem erros (TypeScript estrito, agora incluindo `tools/`) |
| `npm run lint` | sem erros nem avisos (`--max-warnings=0`, agora incluindo `tools/`) |
| `npm test` (unitários) | **478 de 478**, 30 arquivos (a `main` tinha 407 em 25: **71 novos**) |
| `npm run build` | OK; `dist/` 6,5 MB, dos quais 1,3 MB são os 48 pacotes (baixados só quando preciso, não fazem parte do script) |
| `npm run packs:build` | regenera os 48 pacotes; o teste confirma que os arquivos publicados são exatamente o que as fontes geram |
| E2E, suíte inteira | **131 aprovados e 3 falhas** em 134 testes (8,4 min), antes das correções abaixo |

**As 3 falhas da suíte inteira:**
1. `flows › 20. offline: o build não depende de rede` e 2. `flows › dist/index.html abre direto do disco (file://)`: o teste confere `suggestedFilename()` de uma exportação de PNG e este Chrome (Chrome for Testing 153) devolve `"download"`. **Preexistentes e sem relação com esta entrega: os mesmos dois testes falham do mesmo jeito na `main` original**, que verifiquei numa cópia limpa (worktree) em outra porta. Não alterei nada de exportação.
3. `official-catalog › ver conteúdo antes…`: **erro do meu próprio teste**, escrito quando só Vila Torta existia (esperava 1 pacote na categoria "Veículos"; agora há 2). Corrigi a expectativa e reexecutei o arquivo: **3 de 3 passam**.

Depois disso **não reexecutei a suíte inteira**: reexecutei só o que mudou (`official-catalog` 3/3 e o novo `library-perf` 1/1). O estado esperado da suíte inteira é, portanto, "todos passam exceto os 2 preexistentes", mas isso foi inferido, não medido numa nova execução completa.

**Novos testes** (71 unitários + 8 E2E):
- `item-ids` (10): UUID v4 (também sem `randomUUID`), 20 mil IDs sem repetição, IDs válidos e inválidos, 40 caracteres, maiúsculas distintas, IDs legados.
- `pack-conflicts` (23): detecção, duplicata × conflito, item padrão, situação do pacote, opções A/B/C/D, referências internas, original intacto. Fiz **verificação de mutação**: quebrei de propósito a regra de renomear objetos aninhados e o teste certo falhou.
- `change-id` (5), `catalog-search` (10), `official-packs` (22: arquivos, sha256, IDs únicos, fidelidade a Vila Torta, ausência dos personagens não aprovados, **nenhuma duplicata disfarçada**, todo item desenhável, instalação, coleção, adulteração, atualização, remoção, exportar/reimportar; mutação: pacote desatualizado é detectado), `library-home` (+1).
- E2E `library-popup` (4), `official-catalog` (3), `library-perf` (1); E2E antigos `library-home` e `catalog` ajustados ao popup modal e ao UUID.

**Desempenho:**
- **Real, no Chrome, com o catálogo oficial inteiro instalado** (48 pacotes, instalados pela interface em 18 s): **963 itens** (875 oficiais + 88 padrão), só **80 desenhados** por vez (grade progressiva), busca por "natal" em **52 ms** (54 resultados), filtro Oficiais em **61 ms**, abrir o popup em **56 ms**.
- **Sintético:** 5.368 itens: catálogo montado em **17 ms**, busca em **20 ms**.
- Não medi memória nem um catálogo real de milhares de itens (não existem milhares de itens reais).

## 5. Os 30 testes obrigatórios da especificação

| # | Teste | Estado | Evidência |
| ---: | --- | --- | --- |
| 1 | Itens com IDs únicos | PASSOU | `item-ids` (20 mil UUIDs sem repetição); E2E: cópia nasce UUID v4 |
| 2 | Nomes repetidos | PASSOU | três "Rafael" com IDs distintos; mesmo nome e ID diferente importa normalmente (`pack-conflicts`) |
| 3 | IDs personalizados válidos | PASSOU | `item-ids` (`1`, `s8D-88`, `Rafael`, `VilaTorta-01`, 40 caracteres…) |
| 4 | IDs inválidos | PASSOU | `item-ids`; E2E digitando "com espaço" e 41 caracteres |
| 5 | Limite de 40 | PASSOU | `item-ids` (40 ok, 41 recusado) |
| 6 | Maiúsculas × minúsculas | PASSOU | `item-ids`, `catalog-search` (`id:Rafael` ≠ `id:rafael`), E2E |
| 7 | UUID v4 | PASSOU | `item-ids` (também pelo caminho `getRandomValues`) |
| 8 | Duplicação segura | PASSOU | `library-home` (cópia com UUID v4 novo, original intacto) |
| 9 | Importação sem conflitos | PASSOU | `pack-conflicts`, `official-packs`, E2E |
| 10 | Importação com conflitos | PASSOU | `pack-conflicts` (23), E2E `library-popup` pela interface |
| 11 | Resolução automática | PASSOU | opções A e D (unitário) e UUID v4 conferido no popup (E2E) |
| 12 | Resolução manual | PASSOU | opção B (unitário) e validação ao vivo (E2E) |
| 13 | Atualização de referências internas | PASSOU | `pack-conflicts` (carro/roda, personagem embutido; aninhado de conteúdo diferente não é renomeado), `change-id` |
| 14 | Atualizações legítimas de pacotes | PASSOU | `pack-conflicts`, `official-packs` (mantém ativo/inativo) |
| 15 | Preservação dos itens existentes | PASSOU | `official-packs` (biblioteca do usuário intacta; sem escolha nada é gravado), `library-home` |
| 16 | Remoção segura de pacotes | PASSOU | `packs`, `official-packs`, E2E `packs` (projeto continua igual) |
| 17 | Compatibilidade com `.jrec` | PASSOU (regressão) | formato de projeto **não mudou**; suítes de migração, `.jrec` e histórias seguem verdes (unitários e E2E); fixtures com IDs `obj_*` continuam |
| 18 | Popup desktop | PASSOU | E2E `library-popup` (centralizado, ≤ 950 px, 85% da altura, sem coluna lateral, Esc, clique fora, X, foco preso e devolvido) |
| 19 | Popup mobile | PASSOU* | E2E 390×844; *emulação no Chrome de desktop, sem aparelho físico |
| 20 | Busca por nome e ID | PASSOU | `catalog-search` |
| 21 | Busca por pacote e coleção | PASSOU | `catalog-search`, E2E |
| 22 | Instalação por volumes | PASSOU | `official-packs`, E2E `official-catalog` |
| 23 | Instalação de coleções | PASSOU | `official-packs`, E2E (6 pacotes de uma vez) |
| 24 | Desempenho com milhares | PASSOU* | 963 itens reais em 52 ms de busca; 5.368 sintéticos em 20 ms; *sem catálogo real de milhares |
| 25 | Integridade de personagens existentes | PASSOU | snapshots de cabelo e vistas inalterados; Vila Torta idêntica aos episódios |
| 26 | Persistência após reinicialização | PASSOU | E2E recarrega e itens continuam |
| 27 | Funcionamento offline | PASSOU | E2E recarrega **offline** e insere o Lon Ruan instalado |
| 28 | Compatibilidade com criadores existentes | PASSOU | testes dos criadores e E2E `library` |
| 29 | Exportar e reimportar `.rspack` | PASSOU | `official-packs`, `packs` |
| 30 | Não regressão | PASSOU com ressalva | 131/134 na suíte inteira; as 2 falhas preexistentes estão provadas na `main`; a 3ª foi corrigida (seção 4) |

## 6. O que NÃO foi feito, e limitações

- **Roupas e cabelos como itens independentes, e `vila-torta-roupas-cabelos-1`:** não. Na `main` roupa e cabelo são parâmetros do personagem; o criador de roupas/cabelos está na branch `feature/recorte-studio-3b-roupas-cabelos`, **não mesclada** (e eu não faço merge sem autorização). Os 162 personagens prontos já usam as roupas e cabelos que o motor tem (14 tops, 6 bottoms, 5 sapatos, 30 estilos de cabelo, 15 acessórios).
- **Estruturas de rig novas** (quadrúpede, cartoon deformável): não. O motor só anima o humanoide padrão; criar rig só no catálogo seria falso. Os "corpos" variam proporções do rig existente.
- **"Milhares de itens":** o catálogo real tem 875. O desempenho com milhares foi medido com **5.280 itens sintéticos** (ver seção 4); com o conteúdo real no navegador há a medição do E2E.
- **Celular:** testado em emulação no Chrome (390×844, toque), não em aparelho físico.
- **Áudio, fontes e roupas em pacote:** pacotes ainda não carregam. O áudio dos episódios de Vila Torta não entrou.
- **Estilo e profundidade do conteúdo:** os itens são desenhos recortados feitos de formas geométricas, no estilo do app; alguns (cobra, jacaré, camelo, interiores dos cenários) são mais esquemáticos que outros. Foram conferidos visualmente, mas **qualidade artística é subjetiva: vale revisar**.
- **Manual do app e capturas** (`public/manual`, `manual:shots`): não atualizados; documentação nova está em `docs/`.
- **Catálogo oficial por `file://`:** não carrega (o navegador bloqueia `fetch` local); importar `.rspack` pelo botão funciona.
- **Mudança de comportamento:** importar de novo um `.json` de biblioteca **alterado** não atualiza em silêncio (agora é conflito).
- **Divergência entre ficha e episódios** (Larissa/Samuca): registrada em `docs/VILA-TORTA.md`, nada alterado.

## 7. Depende de você

1. **Aprovação visual** de Ramires e Valentina; decisões sobre Rodrigues e os pais dos protagonistas.
2. **Licença de redistribuição** dos pacotes de Vila Torta (manifestos dizem "pendente").
3. **Revisão de qualidade artística** do conteúdo novo (e dizer o que refazer).
4. **Autorizar** o merge da branch `3b` (roupas e cabelos) se quiser pacotes de roupas/cabelos; e o merge/deploy desta branch.

## 8. Como revisar

```bash
git log --oneline origin/main..claude/confident-turing-m65b6g
npm run packs:build   # regenera os pacotes; o teste confere que nada ficou desatualizado
```

```
c2bef59 Subcategorias na busca, compatibilidade do pacote, documentação e ajustes de teste
4f2e236 Importação de biblioteca .json passa a verificar conflitos de ID (fecha pendência da Fase 1)
db3f5cb Fase 5 (lote 4): 35 cenários com dia e noite em 4 pacotes
71475c1 Fase 5 (lote 3): 4 pacotes de mundo e 12 de festas e eventos; guardas contra duplicatas e itens que quebram
48126c7 Fase 5 (lote 2): 213 objetos do dia a dia em 12 pacotes (casa, comida, trabalho, escola, esportes, música, plantas)
e9dd987 Fase 5 (lote 1): 135 personagens pré-prontos, 18 corpos-base e 35 poses
f1bd590 Fases 3 e 4 (parte 1): catálogo oficial de pacotes e os 7 pacotes de Vila Torta
1f0747f Fase 2: popup de detalhes da Biblioteca, busca por ID/pacote/coleção e filtros responsivos
c208280 Fase 1: IDs únicos (UUID v4 + IDs personalizados) e conflitos de ID na importação de .rspack
```

## 9. Arquivos alterados

Resumo:  127 files changed, 41091 insertions(+), 322 deletions(-)

Por área (arquivos alterados):

```
     49 public/packs
     23 tools/packs
      6 tests/unit
      4 tests/e2e
      4 src/features/packs
      4 src/components/library
      4 src/components/dialogs
      3 src/features/library
      3 docs/capturas
      2 src/engine/model
      2 src/components/panels
      1 vite.config.ts/
      1 tsconfig.json/
      1 src/styles/app.css
      1 src/storage/db.ts
      1 src/state/uiStore.ts
      1 src/state/packActions.ts
      1 src/state/mediaActions.ts
      1 src/state/libraryHomeActions.ts
      1 src/state/creatorActions.ts
      1 src/state/catalogActions.ts
      1 src/features/catalog
      1 src/engine/world
      1 public/sw.js
      1 playwright.config.ts/
      1 package.json/
      1 docs/vila-torta-fichas-pendentes.md
      1 docs/VILA-TORTA.md
      1 docs/PACOTES-OFICIAIS.md
      1 docs/LICENCAS.md
      1 docs/CATALOGO.md
      1 docs/BIBLIOTECA-IDS.md
      1 README.md/
      1 CHANGELOG.md/
```
