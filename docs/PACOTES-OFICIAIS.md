# Pacotes oficiais (.rspack)

O catálogo de pacotes oficiais do Recorte Studio: como funciona, como é gerado e como acrescentar conteúdo.

## Arquitetura

- Cada pacote oficial é um arquivo **`.rspack` real** em `public/packs/`, mais `public/packs/index.json`. O app é publicado como **um único script** (para abrir por `file://`), então os pacotes **não** entram no JavaScript: são baixados **só quando o usuário vê o conteúdo ou instala**. Nada carrega de uma vez.
- `index.json` lista todos os pacotes (ID, versão, coleção, volume, categoria, autor, licença, sha256, tamanho, contagens, lista de itens e uma capa SVG pequena). É o que a seção **Biblioteca → Itens → Catálogo oficial** mostra sem baixar nada. A mesma busca da aba Itens encontra nomes, IDs e conteúdos disponíveis para instalar.
- Todo arquivo baixado é conferido pelo **tamanho e pelo sha256 do índice** antes de ser lido; depois passa pelo mesmo leitor seguro de qualquer `.rspack` (caminhos, limites, hashes, SVG, integridade). Instalado, o pacote vive no IndexedDB e **funciona offline**.
- Service worker: `packs/` é **rede primeiro** (o índice nunca fica velho com conexão) com a última cópia como reserva offline. O nome do cache considera os pacotes.
- Abrir por `file://` (duplo clique): o catálogo oficial não carrega (o navegador bloqueia `fetch` local); importar um `.rspack` pelo botão continua funcionando.

## Tipos de pacote

| Tipo | Como é | Pode |
| --- | --- | --- |
| Conteúdo essencial | itens padrão que vêm no código (elenco, objetos e cenários padrão); aparece na aba **Itens** e na gestão de **Pacotes** | sempre ativo; não remove; editar cria cópia |
| Oficial opcional | instalado pelo catálogo (`source: 'official'`) | instalar, ativar, desativar, remover, atualizar |
| Importado | arquivo do usuário (`source: 'imported'`) | idem, com autoria e licença próprias |

## Formato (retrocompatível)

`formatVersion` continua 1. Novidades opcionais no manifesto: `collection`, `volume`, `tags`; por item: `category`, `subcategory`, `tags`, `description`; tipos de item `character` (definição do Criador de Personagens) e `pose` (rig + mãos), além de `object` e `background`. Pacotes antigos continuam lendo.

## Biblioteca como loja de assets

A aba **Itens** é uma única grade que mistura:
- conteúdos padrão já disponíveis;
- itens do usuário e pacotes já instalados;
- **cada item oficial ainda não instalado, individualmente**, com nome, miniatura, tipo, categoria e estado **Baixar**.

Não há uma lista separada de kits no meio da grade. A pesquisa e os filtros principais se aplicam também aos itens ainda não baixados.

Ao abrir o card de um item disponível, há duas opções:
1. **Baixar somente este item**: instala apenas a definição selecionada, com seus objetos aninhados e mídias próprias; os outros itens do volume não são guardados
2. **Instalar pacote completo**: instala o volume tradicional, reconhecendo e ignorando duplicatas de itens já baixados individualmente

### Arquivos individuais

Na geração do catálogo, `npm run packs:build` cria **um .rspack independente por item**, em `public/packs/items/`, com miniatura SVG e metadados no índice. Cada arquivo avulso é validado pelo tamanho e pelo **sha256** antes da instalação. O navegador não precisa baixar o volume completo para obter um item individual. Itens antigos sem arquivo individual publicado mantêm o fallback de leitura seletiva do volume.

Os downloads avulsos são armazenados como pacotes internos de **um item**, para reutilizar as proteções existentes de ID, mídia, autoria, licenças e projetos autocontidos. Podem ser gerenciados em **Pacotes**. O item aparece na Biblioteca como qualquer outro conteúdo instalado. Novos pacotes podem continuar sendo instalados por volume ou coleção.

As miniaturas individuais ficam no índice; a página não precisa transferir os kits completos para exibir os 875 cards. O grid mantém paginação progressiva. O índice e os arquivos de itens são regenerados automaticamente antes de `dev`, `build` e `test` via scripts npm.

### Aba Pacotes

A aba **Pacotes** concentra pacotes já instalados e importados, opções de ativação, remoção, atualização e exportação de .rspack. Não existe mais uma subaba duplicada do Catálogo oficial.

## Coleções e volumes

O número no nome do arquivo é o **volume**, não a versão (`natal-1`, `natal-2`; versão `1.0.0`). Uma **coleção** (`Natal`) reúne vários volumes: instale um volume ou **"Instalar a coleção"** (só o que falta). Depois de instalados, os itens aparecem misturados no catálogo (uma árvore de Natal em Objetos, um personagem em Personagens), com o selo do pacote e a coleção; **não** há bibliotecas isoladas por pacote.

## Como gerar e acrescentar

```bash
npm run packs:build
```

Lê as fontes em `tools/packs/sources/` e escreve `public/packs/*.rspack` + `index.json`. Os pacotes são **determinísticos** (mesmo conteúdo = mesmos bytes; IDs de peça `p0, p1…`): um teste (`tests/unit/official-packs.test.ts`) falha se um pacote publicado estiver desatualizado em relação às fontes.

Para criar conteúdo: `tools/packs/dsl.ts` (objetos e cenários por peças: `R`, `E`, `T`, `G`, `S`, `L`, `TX`; `frames()` para animação; `character()` e `pose()`), um arquivo em `tools/packs/sources/` exportando `Array<() => Promise<PackSource>>`, e registrar em `sources/index.ts`. **Confira visualmente** antes de publicar:

```bash
SHEET_PACKS=meu-pacote-1 SHEET_OUT=/tmp/folhas npx vitest run -c tools/packs/vitest.config.ts sheet
node tools/packs/shot.mjs /tmp/folhas/meu-pacote-1.html /tmp/folhas/meu-pacote-1.png 1300
```

Regras dos IDs de itens novos: hífens e letras sem acento, até 40 caracteres (a DSL recusa o resto), prefixo `rs-`, **únicos em todos os pacotes** (testado) e sem colidir com itens padrão (testado).

## Verificações automáticas

Arquivo e sha256 conferem com o índice; contagens, IDs e metadados batem com o manifesto relido; IDs únicos em todos os pacotes e fora dos itens padrão; **nenhum item é duplicata disfarçada** de outro (mesmo desenho com ID ou nome diferente); todo item é desenhável pelo renderizador do app sem erro nem `NaN`; objetos têm peças e animações têm mais de um quadro; pacote publicado = o que as fontes geram.

## Limitações

- Pacotes ainda **não** carregam: sons, fontes, **roupas e cabelos como itens independentes** (hoje roupa e cabelo são parâmetros do personagem; o criador de roupas e cabelos está na branch `feature/recorte-studio-3b-roupas-cabelos`, ainda não mesclada) nem **estruturas de rig novas** (o motor só anima o humanoide padrão).
- Poses mostram o assento só de lado (o motor não desenha "sentado" de frente).
- Vila Torta: ver `docs/VILA-TORTA.md`.
