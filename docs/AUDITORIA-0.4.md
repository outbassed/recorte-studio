# Auditoria do legado 0.4

Base analisada: `Recorte-Studio-0.4-Download.zip`. Os cinco arquivos têm o mesmo MD5 dos que estavam na pasta do projeto, agora preservados em `legado/0.4/`. O prompt citava também `Recorte-Studio-0.4-CODIGO_BASE.zip`, que **não existe** na pasta do kit; só o outro ZIP foi usado.

A 0.4 foi executada no Chrome: captura em [capturas/antes-0.4.png](capturas/antes-0.4.png).

## Inventário

| Arquivo | Conteúdo |
| --- | --- |
| `index.html` | Marcação da interface |
| `styles.css` | Visual e responsividade (27 KB) |
| `app.js` | Tudo: dados, personagens, render, timeline, inspector e exportação (66 KB, 316 linhas muito longas) |
| `world2d.js` | Parallax de um canvas de fundo |
| `LEIA-ME.md` | Notas da versão |

Sem dependências, build ou testes. Armazenamento em `localStorage` (`recorte_studio_v04`, com leitura de `recorte_studio_v03`).

## Modelo de dados 0.4

`{ version, projectName, actors[], objects[], layers[], scenes[{ id, name, background, duration, cues[] }], activeScene, selectedActor, selectedObject }`

- `actors` e `objects` são **globais**: a posição é a mesma em todas as cenas.
- `layers` é uma pilha global.
- `cues` são blocos com tipo (`talk`, `walk`, `wave`, `dance`, `surprise`, `laugh`, `cry`, `sit`, `angry`). Tempos em segundos.
- Não há keyframes, áudio nem mídia importada.

## Problemas identificados

| Problema | Onde | Resolução na 1.0 |
| --- | --- | --- |
| Objetos e atores vazam entre cenas | modelo global | Nós por cena |
| Vistas quase iguais: cabeça muda pouco, corpo não gira de verdade (`bodyView` é ignorado no render) | `svgActor` | Templates por vista para corpo, cabeça e cabelo |
| Olhar é só deslocamento de pupila de ±5 px, sem altura | `updateActors` | `resolveGaze` com alvo em 2D e cabeça acompanhando |
| Preview (DOM) e exportação (recomposição manual) são caminhos diferentes | `exportPNG` | Plano único |
| Fala mexe em `rx/ry` da boca diretamente | `updateActors` | Boca paramétrica única |
| Botões de câmera alteram só o canvas de fundo, não entram na timeline | `world2d.js` | Câmera com keyframes |
| Sem desfazer | todo o app | Histórico por patches |
| `onclick` em cada nó e reconstrução de `innerHTML` nos painéis | `renderAssets` | Componentes React com listas virtualizadas |
| `generate()` chamado de "diretor" | `app.js` | Comandos rápidos, rotulados como regras |
| Cores vindas do JSON entram em atributos pela função `col` | `app.js` | `safeColor`, escape e schema |

## O que foi aproveitado

- Vocabulário de cenários, expressões, cabelos e objetos, mapeado na migração.
- Conceito de "cena com ações" e os templates de diálogo como inspiração.
- Cena "Você sabe dançar?", usada como exemplo e como regressão.
- Painel de cenas com botões fixos: a ideia ficou, a implementação foi refeita com virtualização.

## Sobre os bugs históricos

O prompt cita duas bocas sobrepostas e olho deformado como bugs já ocorridos. O código da 0.4 já desenha uma só boca por estado, então esses bugs não reproduzem nela. A 1.0 os trata como regressões a impedir: `tests/unit/views.test.ts` percorre todo o elenco × vistas × expressões × visemas.

O problema que **se vê** na 0.4 é outro: na captura, Nina e Zeca ficam praticamente de frente durante a conversa, e o nariz quase não aparece.
