# Biblioteca: identidade dos itens e conflitos de ID

Como cada item da Biblioteca é identificado, o que acontece ao duplicar, renomear, exportar, importar e alterar um ID, e como os conflitos de importação são resolvidos. Implementação em `src/features/library/itemIds.ts`, `src/features/library/changeId.ts` e `src/features/packs/conflicts.ts`.

## O ID de um item

- **Padrão automático:** UUID v4 (`crypto.randomUUID()`, ou `getRandomValues` como alternativa segura). Itens criados, duplicados e copiados daqui para frente nascem assim.
- **ID personalizado:** de 1 a 40 caracteres, só `A-Z`, `a-z`, `0-9` e `-` (`^[A-Za-z0-9-]{1,40}$`). Sem espaço, acento ou sublinhado. **Maiúsculas e minúsculas são IDs diferentes** (`Rafael` ≠ `rafael`). Dois itens podem ter o mesmo nome; nunca a mesma identidade.
- **IDs legados** (`obj_x7k…`, `char_…`, `lib_…`, `pk_panela`) continuam válidos como identidade: existem em projetos `.jrec`, bibliotecas e pacotes antigos e **nunca são reescritos em silêncio**. A regra de formato vale para o que o usuário digita ou o programa cria daqui para frente. O popup mostra o selo *UUID v4*, *ID personalizado* ou *ID legado*.

### Qual ID?
A identidade é o ID da **entidade** dentro do item (`personagem.id`, `objeto.id`, `cenário.id`), que é o que acompanha o item para dentro dos projetos. Pose, cena e sequência não têm ID interno: valem o ID do registro. O `lib_…` de um registro é só a chave de armazenamento.

## Comportamentos

| Ação | O que acontece com o ID |
| --- | --- |
| Criar | UUID v4 novo |
| Renomear / editar | preservado |
| Duplicar / copiar item padrão ou de pacote | UUID v4 novo |
| Exportar | preservado |
| Importar | verifica conflitos (abaixo) |
| Excluir | afeta só o registro escolhido |
| Alterar ID (popup → "Alterar ID", só itens da minha biblioteca) | valida (formato e disponibilidade no catálogo inteiro), pede confirmação, atualiza as referências em **outros itens da biblioteca** e grava tudo de uma vez. Projetos `.jrec` guardam a própria cópia e **continuam abrindo como estavam** |

## Conflitos de ID ao importar (`.rspack` e `.json` de biblioteca)

O catálogo de IDs considera itens padrão do app, minha biblioteca e pacotes instalados. Itens de um projeto aberto não entram (vivem dentro do projeto).

| Situação | Resultado |
| --- | --- |
| Mesmo **nome**, IDs diferentes | importa normalmente (só informa) |
| Mesmo ID **e** mesmo conteúdo | **duplicata reconhecida**: não importa de novo, nada é sobrescrito |
| Mesmo ID, conteúdo diferente | **conflito**: diálogo "Conflito de ID detectado" com item existente × importado, ID, origem e pacotes |
| ID de item **padrão** do app | sempre conflito (item padrão é protegido) |
| Pacote com ID já instalado, **versão mais nova, mesma origem** | atualização legítima, sem conflito de pacote |
| Pacote com o ID de um instalado, **origem diferente** (arquivo importado × oficial) ou mesma versão com conteúdo diferente | conflito de pacote: cancelar ou instalar como pacote separado (outro ID de pacote) |
| Versão igual (mesmo conteúdo) ou mais velha da já instalada | recusada com mensagem clara |

Opções do diálogo, por item: **A** novo UUID v4 automático (recomendado), **B** ID manual (validado: formato, limite de 40 e disponibilidade no catálogo inteiro e no próprio pacote), **C** não importar (só quando não deixa referência solta em outro item mantido), **D** resolver todos automaticamente.

Garantias: a troca vale só para a **cópia importada** (o arquivo original não muda); as **referências internas do pacote são atualizadas** (objetos aninhados com o mesmo conteúdo e personagens embutidos); nada é gravado se uma escolha for inválida; a gravação é transacional (mídias e registro, tudo ou nada); cancelar não grava nada.

## Busca por ID

Na Biblioteca: `id:Rafael` ou `#Rafael` acha só o item cujo ID é exatamente esse, **respeitando maiúsculas**. Um trecho de ID digitado no campo de busca também acha (com maiúsculas respeitadas, ao contrário do texto de nome, categoria, tags, descrição, pacote e coleção, que ignora acentos e maiúsculas). O ID digitado por inteiro vem primeiro na lista.

## Limitações conhecidas

- "Alterar ID" não atualiza projetos `.jrec` (por desenho: eles são autossuficientes).
- O catálogo de IDs não enxerga itens que só existem dentro de projetos fechados.
- Importar de novo um `.json` **alterado** não atualiza mais o item existente em silêncio (comportamento da 1.2): vira conflito e o usuário escolhe. Para atualizar um item, edite-o ou apague-o antes.
