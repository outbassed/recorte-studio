# Catálogo, biblioteca e animação de objetos

Expansão feita na branch `feature/recorte-studio-catalogo-biblioteca`, a partir da 1.2. Este documento descreve o que existe de verdade, como funciona por dentro e o que ainda falta.

## Arquitetura

### Catálogo unificado (`src/features/catalog/catalog.ts`)

As abas **Elenco**, **Cenários** e **Objetos** são três visões de uma única lista de registros tipados (`CatalogEntry`). Não existe banco novo nem um banco por aba: o catálogo é montado a partir de três fontes que já existiam.

| Origem | De onde vem | Edição |
| --- | --- | --- |
| Padrão (`builtin`) | Elenco pronto, cenários prontos, objetos prontos e objetos montados padrão (Fogueira, Ventilador, Barco) embarcados no código | Imutável. "Editar" cria uma cópia com ID novo, guardada no projeto |
| Projeto (`project`) | `project.characters`, `project.customObjects`, `project.customBackgrounds` | Editável; muda o item em todas as cenas do projeto |
| Minha biblioteca (`mine`) | Tabela `library` do IndexedDB (a mesma da 1.1/1.2) | Editável; vale para todos os projetos deste navegador |

Cada registro tem chave estável com espaço de nomes (`builtin:prop:sofa`, `project:object:obj_x`, `mine:lib_y`, `builtin:object:fogueira`…), visão, tipo, categoria, nome, palavras-chave, origem, política de edição, favorito, data, uso no projeto, estados/animações e, quando o registro não pode ser lido, o motivo (`broken`). Favoritos e recentes de itens sem campo próprio ficam nas preferências (`catalogFavorites`, `catalogRecents`); personagens do projeto e registros da biblioteca usam o próprio campo `favorite`, como antes.

`queryCatalog` faz busca sem acento, filtros (Todos, Padrão, Meus, Favoritos, Recentes, No projeto), categoria e ordem. Funções puras, testadas em unidade.

### Política única de dependências

Usar um item da biblioteca **copia** o item para o projeto, com imagens e objetos aninhados (pacote v2 da 1.2, agora incluindo o conteúdo dos quadros de animação). Consequências:

- apagar ou mudar a biblioteca nunca quebra um projeto existente;
- o `.jrec` continua autossuficiente (leva o que o projeto usa);
- a **identidade** é preservada: trazer para o projeto mantém o ID; salvar de novo na biblioteca ATUALIZA o mesmo registro (`upsertLibrary`); duplicar cria identidade nova. Assim o catálogo não mostra duas vezes o mesmo item (projeto e biblioteca com o mesmo ID aparecem uma vez, com o selo "também na biblioteca").

### Animação por quadros no objeto

`CustomObject` ganhou `clips` (até 16) e `defaultClip`. Cada animação tem nome, modo (`loop`, `once`, `pingpong`) e quadros (até 240), cada quadro com duração (20 a 10 000 ms) e a lista completa de peças. Um objeto sem animação continua com `clips: []`.

O quadro desenhado é **função pura do tempo** (`clipFrameIndex`): o renderizador único (`planFrame`) recebe o tempo local da instância e escolhe o quadro. Prévia, busca fora de ordem, PNG e vídeo pegam o mesmo quadro no mesmo instante. Nenhum `setInterval` ou estado acumulado participa do render final; a prévia "Tocar" do Criador e dos detalhes do catálogo usa `requestAnimationFrame` só na interface.

Por instância (nó `prop`): `clip` (`''` = padrão do objeto, `'static'`, ou o ID), `clipSpeed` e `clipOffsetMs`. `clip` é uma propriedade discreta animável: trocar a animação com keyframe faz ela começar no instante desse keyframe.

### Hierarquia pai/filho (`src/engine/model/hierarchy.ts`)

O desenho já aninhava os filhos dentro do `<g>` dos grupos; o que faltava eram as contas para vincular e soltar sem salto. O módulo calcula a matriz 2D local (mesma ordem do SVG: translate, rotate com pivô, scale), a matriz de mundo pela cadeia de pais, a inversa e a decomposição de volta em x, y, rotação e escala. `setParent` vincula ou solta mantendo a posição no mundo, bloqueia ciclos e só aceita grupos como pai. `ungroup` passou a usar as mesmas contas.

## Compatibilidade

- `SCHEMA_VERSION` continua 1: todos os campos novos têm padrão no Zod (`clips: []`, `defaultClip: ''`, `clip: ''`, `clipSpeed: 1`, `clipOffsetMs: 0`). Projetos 1.0, 1.1 e 1.2 abrem sem migração e sem mudança visual (testes de migração e de histórias completas da suíte E2E).
- Registros antigos da biblioteca (1.1 e 1.2) continuam lidos; o campo opcional `updatedAt` é só acrescentado ao salvar.
- `LibraryRecord.kind` não mudou; nenhum índice novo no IndexedDB.

## Formato de pacote opcional

**Não implementado nesta etapa.** O catálogo já separa a origem "Padrão" e reserva o espaço para "Pacotes", mas não há instalação, ativação, desinstalação nem manifesto. O filtro "Pacotes" não aparece na interface para não fingir uma função que não existe.

## Estado por critério de aceitação do Super Prompt

| # | Caso | Estado | Evidência |
| --- | --- | --- | --- |
| 1 | Catálogo: busca sem acento, filtros, miniatura, inserir, nas três abas | PASSOU | E2E `catalog.spec.ts` (Elenco; Cenários e Objetos) |
| 2 | Cópia ao editar de objeto padrão, cor muda só na cópia, cópia inserível | PASSOU | E2E `catalog.spec.ts`; unit `catalog.test.ts` |
| 3 | Uso entre projetos | PASSOU | E2E (outro projeto novo); unit |
| 4 | Migração e .jrec da 1.2 | PASSOU (regressão) | Suíte E2E de histórias e migração; unit de compatibilidade dos campos novos |
| 5 | Pacote importável/desativável | NÃO IMPLEMENTADO | — |
| 6 | Fogo com 4+ quadros, 3 instâncias em 2 cenas, defasagem, vídeo | PASSOU | E2E `object-anim.spec.ts`: cor de cada fogo conferida pixel a pixel em 5 instantes do vídeo exportado |
| 7 | Barco com passageiros | PARCIAL | E2E pela interface (vincular sem salto, balanço, fala continua, recarregar) e unit no renderizador (o mesmo da exportação). Não há vídeo exportado do barco conferido em pixel; não há pontos de encaixe nomeados |
| 8 | Roupa com texto, manequim | NÃO IMPLEMENTADO | — |
| 9 | Cor por parte do corpo, esclera por olho | NÃO IMPLEMENTADO | — |
| 10 | Pose especial e compatibilidade por rig | NÃO IMPLEMENTADO | — |
| 11 | Mão de A na frente de B | NÃO IMPLEMENTADO | — |
| 12 | Celular: abrir, buscar, filtrar, prévia e inserir nas três abas | PASSOU* | E2E em 390×844 com toque emulado. *Chrome de desktop emulando, sem aparelho físico |
| 13 | Undo/redo e Shift+clique da seção | PASSOU | unit e E2E (remove só o instante, um Ctrl+Z, confirmação) |
| 14 | Centenas de itens | PASSOU | E2E com 400 registros: abrir ~160–400 ms, buscar ~40–70 ms, só a 1ª página desenhada |

## Limitações conhecidas

- Objeto animado usado dentro de outro objeto ou de uma composição de cenário aparece parado no primeiro quadro.
- Arrastar no palco um filho de grupo girado move no sentido do grupo (os campos numéricos ficam exatos).
- Olhar para um elemento e "segurado por" usam a posição local de quem está dentro de grupo.
- A decomposição de matrizes não representa cisalhamento (pai com escala não uniforme e filho girado).
- Criar cópia de cenário padrão gera três passos no histórico (criar, Dia, Noite).
