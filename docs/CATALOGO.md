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

## Biblioteca principal e Toolbox (Fase 2.5)

- **Biblioteca principal** (`src/components/library/LibraryHome.tsx`): seção da tela inicial (sem projeto aberto) e sobreposição no editor (`openLibrary()`; o projeto continua aberto e "Inserir na cena" funciona). Usa o MESMO catálogo (`buildCatalog`, visão `'all'` com filtro por tipo) e o MESMO armazenamento (IndexedDB) das abas do Studio.
- **Itens individuais:** cada personagem, objeto, cenário, pose, sequência ou cena salvo é um registro próprio; pacote não é necessário. Importar um arquivo de biblioteca atualiza itens com a mesma identidade em vez de duplicar.
- **Permissões:** itens próprios (editar, duplicar, renomear, favoritar, exportar, apagar); padrão e pacote (copiar para minha biblioteca, editar uma cópia, favoritar).
- **Criar/editar sem projeto:** os criadores vivem dentro de um projeto; sem projeto aberto, a Biblioteca abre a "Oficina da Biblioteca" (projeto comum, reaproveitado pelo ID em `prefs.workshopProjectId`).
- **Pacotes** (`src/components/library/PackPage.tsx`): lista dos instalados, página com capa, metadados, contagens, dependências com estado, todos os itens com miniatura e animações e busca; abrir um `.rspack` **inspeciona** (valida tudo e mostra o conteúdo, sem gravar nada) e só instala ao confirmar.
- **Toolbox no Studio:** a aba Biblioteca virou uma lista compacta (busca, tipo, origem, clique para inserir, salvar cena atual). As abas Elenco, Cenários e Objetos continuam como visões simplificadas, com o botão "Abrir a Biblioteca completa".
- **Riscos tratados:** pacote com objeto aninhado ou imagem usada por peça que não veio no item é recusado; leitura de pacote assíncrona (descompactação fora da thread principal quando possível, pausas e progresso); falhas de armazenamento viram mensagens claras.

## Pacotes opcionais (.rspack)

Arquivo ZIP com `manifest.json`, `items/*.json` (pacotes de objeto ou cenário no mesmo formato v2 da biblioteca) e `media/*` (imagens). O manifesto traz `format: "recorte-studio-pack"`, `formatVersion: 1`, ID (`[a-z0-9._-]`), nome, versão `x.y.z`, descrição, autor, **licença obrigatória**, categoria, dependências (`{ id, version }`), itens (`id, kind, name, file, sha256`) e mídias (`id, file, mime, size, sha256`).

Verificado antes de gravar qualquer coisa (`src/features/packs/format.ts`): caminhos só em `items/` e `media/` (sem `..`, barra invertida ou absoluto), limites (60 MB compactado, 120 MB descompactado, 25 MB por mídia, 2 MB por item, 500 entradas), sha256 de cada arquivo, ID da mídia igual ao do conteúdo (`media_<sha256>`), tipo real da imagem, SVG recusado se o limpador removeria algo (script, eventos, links externos), itens lidos pelos leitores tolerantes da biblioteca e só com imagens do próprio pacote, dependências instaladas na versão mínima, versão repetida ou mais velha recusada.

Ciclo de vida (`src/state/packActions.ts`, aba Biblioteca → Pacotes opcionais): instalar (transacional: mídias gravadas são apagadas se o registro falhar; aviso de espaço), atualizar para versão mais nova (mantém ativo/inativo), ativar/desativar, exportar (reempacota com as mídias do navegador) e remover (com confirmação; recusado se outro pacote depende dele; a limpeza de mídias só apaga o que nenhum projeto, biblioteca ou pacote usa). O banco foi para a versão 2 só com a tabela `packs` nova.

**Política:** itens de pacote são protegidos (editar cria cópia pessoal com ID novo). Usar um item copia o item e as imagens para o projeto, então desativar ou remover o pacote nunca muda um projeto. O filtro "Pacotes" só aparece quando há pacote ativo com itens daquela aba.

Pacote de demonstração (original, CC0): **Kit Cozinha Retrô** — panela, chaleira fervendo (animada), painel de azulejos (imagem SVG) e parede de azulejos (cenário).

## Modelos prontos (`src/features/templates/showcase.ts`)

Mar e Barco, Acampamento, Praia, Cidade e rua, Quarto, Floresta, Sala de aula e Laboratório de animação. Cada um cria um projeto novo; os objetos padrão usados (`tpl_*`) entram no projeto como cópia. A tela Modelos filtra por Ambientes, Técnicos e Formatos e mostra "O que testar neste modelo". Objetos originais novos no catálogo: Ondas (animadas), Barraca, Guarda-sol, Palmeira e Pedras.

## Bolinha do grupo e coordenadas

O palco calcula a matriz câmera × pais × nó (a mesma composição do renderizador). Selecionar um grupo mostra uma bolinha laranja no pivô do grupo; arrastar move a transformação do grupo (autokey no tempo atual quando a posição já é animada), um gesto = um passo de histórico, Esc desfaz o gesto. A bolinha fica na camada de edição (SVG separado), nunca no plano exportado. O mesmo cálculo corrige o arraste de filhos dentro de grupos girados/escalados, as caixas de seleção e a posição do pivô. Mudar o pivô recalcula x/y (sem salto). Olhar e "segurado por" usam a matriz dos pais.

## Estado por critério de aceitação do Super Prompt

| # | Caso | Estado | Evidência |
| --- | --- | --- | --- |
| 1 | Catálogo: busca sem acento, filtros, miniatura, inserir, nas três abas | PASSOU | E2E `catalog.spec.ts` (Elenco; Cenários e Objetos) |
| 2 | Cópia ao editar de objeto padrão, cor muda só na cópia, cópia inserível | PASSOU | E2E `catalog.spec.ts`; unit `catalog.test.ts` |
| 3 | Uso entre projetos | PASSOU | E2E (outro projeto novo); unit |
| 4 | Migração e .jrec da 1.2 | PASSOU (regressão) | Suíte E2E de histórias e migração; unit de compatibilidade dos campos novos |
| 5 | Pacote importável/desativável | PASSOU | unit `packs.test.ts` (formato, segurança, ciclo de vida, dependências, reimportação) e E2E `packs.spec.ts` (instalar, usar em dois projetos, desativar, reativar, recarregar, exportar, remover, reimportar) |
| 6 | Fogo com 4+ quadros, 3 instâncias em 2 cenas, defasagem, vídeo | PASSOU | E2E `object-anim.spec.ts`: cor de cada fogo conferida pixel a pixel em 5 instantes do vídeo exportado |
| 7 | Barco com passageiros | PASSOU* | Modelo Mar e Barco; E2E da bolinha (move barco e passageiros juntos, desfazer/refazer, Esc, grupo aninhado girado, salvar/reabrir, PNG exportado sem a bolinha) e unit no renderizador. *Vídeo do barco não conferido em pixel (o vídeo usa o mesmo renderizador, provado no teste do fogo); pontos de encaixe nomeados ainda não existem |
| 8 | Roupa com texto, manequim | NÃO IMPLEMENTADO | — |
| 9 | Cor por parte do corpo, esclera por olho | NÃO IMPLEMENTADO | — |
| 10 | Pose especial e compatibilidade por rig | NÃO IMPLEMENTADO | — |
| 11 | Mão de A na frente de B | NÃO IMPLEMENTADO | — |
| 12 | Celular: abrir, buscar, filtrar, prévia e inserir nas três abas | PASSOU* | E2E em 390×844 com toque emulado. *Chrome de desktop emulando, sem aparelho físico |
| 13 | Undo/redo e Shift+clique da seção | PASSOU | unit e E2E (remove só o instante, um Ctrl+Z, confirmação) |
| 14 | Centenas de itens | PASSOU | E2E com 400 registros: abrir ~160–400 ms, buscar ~40–70 ms, só a 1ª página desenhada |

## Roupas e cabelos criados (Fase 3b)

- **Formato:** `Wearable` (`src/engine/model/schema.ts`): `kind` (roupa ou cabelo), `category`, `hides` (substitui parte de cima, de baixo, cabelo) e até 40 `layers`. Cada camada tem `anchor` (cabeça, tronco, quadril, braço, antebraço, coxa, canela), `depth` (na frente, atrás da cabeça, atrás do corpo), `side` (todas, só frente, só costas), `followTurn`, `mirror` e até 200 peças vetoriais (as mesmas dos criadores, sem imagem).
- **Onde fica:** o projeto guarda o registro em `project.wearables`; cada personagem que veste guarda uma **cópia** em `CharacterDefinition.wear` (até 12). Editar a peça atualiza as cópias de todos os personagens do projeto. Na biblioteca, o tipo é `wearable` e a identidade é o `id` da peça (salvar de novo atualiza o mesmo registro).
- **Renderização** (`src/engine/character/wear.ts` + `render.ts`): as camadas são desenhadas dentro do grupo da parte do corpo, no espaço do corpo de referência (adulto padrão) e escaladas pela medida real da parte em cada personagem e vista. Por isso acompanham pose, vista, animação, prévia e exportação. Mangas e pernas usam o mesmo desenho nos dois lados.
- **Cobertura:** quando a peça substitui a roupa ou o cabelo padrão, a parte de cima vira base neutra sem manga, o quadril vira base neutra e o cabelo vira careca; nada fica descoberto. Os manequins usam essa base também (peito e quadril).
- **Limitações (para a Fase 3c):** sem caimento por personagem (só escala); sem dobra de tecido; partes do corpo fixas (sem corpo modular); camadas de braço e perna iguais nos dois lados; cabelo criado e chapéus não se recortam entre si.

## Limitações conhecidas

- A decomposição de matrizes não representa cisalhamento (pai com escala não uniforme e filho girado).
- Mudar o pivô de um elemento cuja posição já é animada recalcula só o valor-base; os keyframes de posição não são deslocados.
- Arrastar a bolinha num grupo com posição animada grava o keyframe do tempo atual (autokey); não desloca a animação inteira.
- Pacotes trazem objetos e cenários (com imagens). Personagens, poses, sons e fontes em pacote ainda não.
- O celular foi testado só com emulação no Chrome de desktop.
