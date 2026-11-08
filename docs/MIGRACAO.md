# Migração de projetos antigos

## Como importar

1. Na versão antiga, clique em **Projeto** para baixar o JSON.
2. Na 1.0, vá em **Projetos → Importar projeto** e escolha o arquivo.
3. Confira o relatório: importados, adaptados e não compatíveis.

A importação sempre cria um **projeto novo**. O arquivo escolhido não é alterado e o JSON original fica guardado como cópia de segurança no IndexedDB (tabela `backups`).

A 1.0 não lê o `localStorage` da 0.4 sozinha: a versão nova roda em outra origem na maioria dos casos, então a exportação manual é o caminho garantido.

## Conversões

| 0.4 | 1.0 |
| --- | --- |
| `actors[]` | `characters` (definição) + um nó por cena (instância) |
| `objects[]` global | Uma cópia independente em cada cena, com novos IDs |
| `layers[]` | `layerOrder` de cada cena, mesma ordem |
| `x` de 0 a 1 | `(x − 0,5) × 1920` |
| `y` em % | `420 − y/100 × 1080` |
| `scale`, `rotation`, `opacity` | Campos de `transform` e `opacity` (0 a 1) |
| `view`, `bodyView` | `headView`, `bodyView` (`three-left` → `front-left`) |
| `look: camera/left/right/auto/id` | `gaze` com modo equivalente; `auto` vira o vizinho mais próximo |
| `mood` | `expression` (14 mapeadas) |
| `hairstyle`, `clothes` | Estilos equivalentes (`moletom` → `hoodie`) |
| `background` | Cenário novo (`escola` → `salaaula`) |
| `cue talk` | Clip de fala com balão |
| `cue walk` | Keys de `transform.x` + clip de andar. O key inicial reproduz a posição `from` |
| `cue wave/dance/laugh/cry/sit` | Clip da mesma ação |
| `cue surprise` | Clip "Reagir" |
| `cue angry` | Keys de expressão + clip de negar |
| `duration`, `start`, `end` em s | Inteiros em ms |

## Formato .jrec

A partir da 1.1, projetos são salvos em `.jrec`. É um ZIP comum, que qualquer descompactador abre:

```
manifest.json   formato, versão do formato, versão do app, data, projeto (id, título),
                lista de mídias (id, caminho, tipo, tamanho, sha256) e mídias ausentes
project.json    o projeto completo (mesmo esquema validado do IndexedDB)
assets/         uma entrada por mídia: assets/media_<sha256>.<ext>
```

- Ao importar, cada mídia é conferida pelo tamanho e pelo SHA-256 do manifest. Arquivo adulterado ou truncado é recusado com a mídia indicada.
- `formatVersion` maior que o suportado é recusado com aviso para atualizar o app.
- Um .jrec salvo com mídia ausente tem `-incompleto` no nome e a lista em `missing`. Ao importar, essas mídias aparecem em **Mídias** como ausentes, prontas para revincular.
- Projetos .json e .zip da 1.0 continuam importando. Pacotes .zip, .7z, .rar e .tar com um projeto dentro (inclusive dentro de uma pasta) também.
- A importação sempre cria um projeto novo; o arquivo original vai para `backups` no IndexedDB.

## Itens não compatíveis

Vão para o relatório, nunca somem em silêncio: cabelos, roupas, expressões, cenários ou objetos desconhecidos (recebem substituto nomeado), ações de personagens inexistentes e tipos de ação desconhecidos (ignorados, mas preservados no JSON guardado).

## Testes

`tests/unit/migration.test.ts`, com a fixture `tests/fixtures/projeto-0.4.json`, e o fluxo E2E 11.
