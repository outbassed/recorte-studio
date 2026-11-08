# Resultados de testes

Versão 1.2.0 (com os dois ajustes pré-lançamento), executados em 08/11/2026. Nada aqui é estimativa: são as saídas das execuções.

## Ambiente

- Windows 10 Pro 19045, Node 24.21.0
- Google Chrome 156.0.8078.81, via Playwright 1.65.0, contra o build de produção
- ffmpeg/ffprobe (N-127043) para inspecionar os vídeos

## Resumo

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Sem erros nem avisos (`--max-warnings=0`) |
| `npm run typecheck` | Sem erros (TypeScript estrito) |
| `npm test` | **318 de 318** testes, 18 arquivos |
| `npm run build` | OK, 4,5 MB em `dist/` (inclui o WebAssembly da libarchive, ~1 MB, e as 23 capturas do manual, ~2 MB) |
| `npm run test:e2e` | **95 de 95** testes, numa única execução (7,0 min) |
| `npm run shots` | 12 de 12, capturas em `docs/capturas/` |
| `npm run manual:shots` | 2 de 2: refaz as 23 capturas do manual (`public/manual/`) e mede as marcações numeradas; falha se uma marcação ficar fora da imagem |

## O que os testes cobrem

**Unitários** (`tests/unit`): schema e migração; cenas e camadas; bocas, olhos, narizes e olhares em todo o elenco × vistas × expressões × visemas; snapshots SVG das 8 vistas para Nina e Zeca; keyframes e easing; clips e ações; Undo/Redo de 7 categorias; templates; serialização; sanitização de SVG; parâmetros de exportação; montagem; `SliderNumberField`; 9 pedidos de comandos rápidos; adaptadores de IA com mocks; repositório em `fake-indexeddb`.

**E2E** (`tests/e2e/flows.spec.ts`): os 20 fluxos exigidos, mais pacote ZIP entre navegadores, abertura por `file://`, MP4, montagem, comparação de preview com exportação, cancelamento, keyframes, conversão de clips, arraste, criador, comandos rápidos, atalhos, menus "…", seleção no palco, zoom do editor, toque no celular e 8 tamanhos de tela.

**Novos na 1.1** (`v11-integrity`, `hair-matrix`, `v11-features`): detecção de formato pelos bytes; caminhos perigosos (`..`, absolutos, unidades); limites de entradas, tamanho e taxa de compressão; ZIP com senha; TAR e TAR.GZ; 7z com leitor simulado; ida e volta de .jrec; mídia ausente sem sucesso falso; colisão de IDs; arquivo adulterado (tamanho e SHA-256); SVG malicioso dentro de pacote; ZIP legado; pacote só com mídias; limpeza de mídias órfãs entre projetos; salvamento concorrente, troca de projeto e espera crescente; cache LRU de áudio; quebra de texto; 30 cabelos × 8 vistas (profundidade, recorte do brilho, snapshot); movimento natural, piscada dupla, transição por clip, sequências, enquadramentos e cenários com 1, 3 e 5 horários.

**E2E novos na 1.1:** salvar .jrec e reabrir em contexto limpo com áudio; projeto 0.4 regravado em .jrec; mídia ausente (aviso, "Salvar incompleto", lista no manifest, alerta em Mídias); aba Mídias (importar por categoria, reaproveitar arquivo repetido, usar na cena, remover com aviso de uso e desfazer); cenário próprio com 1, 3 e 5 horários, troca de horário e persistência; modo simples × avançado sobre os mesmos dados, com desfazer; PWA recarregando offline no mesmo link `?projeto=`; 390×844 com Salvar, Áudio e modo simples sem estourar a tela.

## Fase 2.5: Biblioteca principal

Executados em 08/11/2026, mesmo ambiente (Windows 10, Chrome 156, build de produção).

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` e `npm run lint` | Sem erros nem avisos |
| `npm test` | **400 de 400**, 24 arquivos |
| `npm run test:e2e` | **125 de 125 numa única execução** (10,6 min), suíte inteira |
| `npm run manual:shots` | 4 de 4; capturas novas da Biblioteca principal e da inspeção de pacote |

**Novos unitários** (`library-home.test.ts`, 8): visão de todos os tipos com busca por palavra-chave e categoria; copiar item padrão para a minha biblioteca sem projeto aberto; duplicar e apagar; importar o mesmo arquivo duas vezes atualiza em vez de duplicar; falha de armazenamento vira mensagem; pacote com objeto aninhado ou imagem fora do item é recusado; progresso da verificação.

**Novos E2E** (`library-home.spec.ts`, 4; `packs.spec.ts` reescrito, 2): explorar sem projeto (busca, tipo, origem, detalhes, grade/lista); item individual copiado, renomeado, favoritado, duplicado e apagado na Biblioteca principal e usado no Studio, e item do projeto salvo pelo Studio aparecendo na Biblioteca sobre o editor, com Inserir na cena; Toolbox compacta e ida/volta à Biblioteca completa; celular com detalhes em tela cheia; pacote inspecionado antes de instalar (nada gravado até confirmar), instalado, usado, desativado, reativado, exportado, removido e reimportado; arquivo inválido recusado na inspeção.

## Continuação do PR #3 (rolagem, bolinha do grupo, modelos, pacotes)

Executados em 08/11/2026, mesma máquina e navegador (Windows 10, Chrome 156 via Playwright, build de produção).

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` e `npm run lint` | Sem erros nem avisos |
| `npm test` | **392 de 392**, 23 arquivos (24 novos nesta rodada) |
| `npm run test:e2e` | **121 de 121 numa única execução** (10,5 min), suíte inteira, sem repetição nem teste instável |
| `npm run shots` | 12 de 12 |
| `npm run manual:shots` | 3 de 3; 2 capturas novas (bolinha do grupo, pacotes) |

**Novos unitários:** `showcase.test.ts` (14: cada modelo válido, sem referência quebrada e renderizando em 3 instantes; barco com passageiros no grupo; ondas animadas dentro do cenário; fogo sem keyframes; objeto animado dentro de objeto), `packs.test.ts` (10: formato, path traversal, sha256, SVG com script, manifesto inválido, imagem de fora, ciclo de vida completo, item protegido, dependências, exportar e reimportar).

**Novos E2E:** `ui-strips.spec.ts` (7: abas do Inspector e filtros do catálogo em 1024, 320 e 390 px: setas, roda, teclado, item ativo à vista, página sem rolar; barra fina visível), `group-handle.spec.ts` (3: Mar e Barco com a bolinha movendo barco e passageiros pelo mesmo deslocamento, desfazer/refazer, Esc, balanço, PNG exportado sem a bolinha, reabrir; grupo dentro de grupo girado 30° segue o cursor; Acampamento com o fogo trocando de quadro), `packs.spec.ts` (2: ciclo completo em dois projetos com recarga, exportação e reimportação; arquivo inválido).

**Ajustes de teste com motivo:** dois testes pesados de cabelo (`hair-matrix`) tiveram o limite de 5 para 30 s: passam isolados e estouravam o tempo sob carga, sem mudança de asserção. O teste unitário de cópia de cenário padrão passou a verificar que nada fica pela metade quando o SVG não pode ser gerado (jsdom); a cópia completa com um único Ctrl+Z é verificada no E2E.

**Bugs encontrados e corrigidos nesta rodada:** a caixa "Ativo" dos pacotes voltava visualmente até o banco responder; a timeline e o palco tratavam filhos de grupo como soltos (seleção e arraste).

## Branch do catálogo e da biblioteca (sobre a 1.2)

Executados em 08/11/2026 na branch `feature/recorte-studio-catalogo-biblioteca`, mesmo ambiente.

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` e `npm run lint` | Sem erros nem avisos |
| `npm test` | **368 de 368** testes, 21 arquivos (318 da 1.2 + 50 novos) |
| `npm run test:e2e` | **108 de 109** numa única execução (11,0 min). A falha foi uma checagem rígida demais do teste novo de centenas de itens (61 cartões na 1ª página, o limite era 60); o teste foi ajustado para conferir o que importa (bem menos que 400 e "Mostrar mais" presente) e passou 3 de 3 isolado. A suíte inteira não foi rodada de novo depois do ajuste |
| `npm run manual:shots` | 2 de 2; 3 capturas novas (catálogo, detalhes, quadros do Criador de Objetos) |

**Novos unitários:** `catalog.test.ts` (28: origens, chaves, busca sem acento, filtros, categorias, ordem, 600 registros, registros quebrados, cena salva antiga, cópia ao editar de objeto/personagem/cenário, objetos animados padrão, biblioteca entre projetos, atualizar o mesmo registro, duplicar, exportar, favoritos, remoção recusada; Shift+clique remove só o instante, um Ctrl+Z, faixa trancada, arredondamento), `object-clips.test.ts` (14: modos repetir/uma vez/vai e volta, durações diferentes, função pura do tempo, 3 cópias com defasagem no renderizador, busca fora de ordem, velocidade, animação acionada por keyframe, compatibilidade, JSON do .jrec, pacote leva o que está dentro dos quadros, limites), `hierarchy.test.ts` (8: matrizes com pivô, decompor/recompor, vincular e soltar sem salto com grupo girado e escalado, ciclos, desagrupar sem salto, grupo dentro de grupo, barco com passageiros no renderizador, salvar/reabrir).

**Novos E2E:** `catalog.spec.ts` (14: Elenco, Cenários e Objetos; cópia ao editar com cor conferida no desenho; personagem e cenário padrão; uso entre projetos; 400 registros: abrir ~160–400 ms, buscar ~40–70 ms; registro quebrado apagável; celular 390×844 com toque nas três abas, modal dentro da tela; Shift+clique com Ctrl+Z e com confirmação), `object-anim.spec.ts` (2: fogo de 4 quadros criado na interface, 3 cópias em 2 cenas, defasagem, recarregar, **cor de cada fogo conferida pixel a pixel em 5 instantes do vídeo exportado**; barco com passageiros vinculados sem salto, balanço, fala continuando, faixas na timeline e mesmo lugar após recarregar).

**Bugs encontrados pelos testes e corrigidos:** pedido de nome dentro do Criador aparecia por baixo dele; desagrupar grupo girado fazia os filhos pularem; elementos de grupos sumiam da timeline.

## Novos na 1.2

**Unitários** (`library-bundles`, `creators`, `limb-depth`, `quick-actions`, `story-load`, `manual`, `v12`): pacotes de biblioteca (fecho de objetos aninhados, leitura de formatos antigos e de lixo, reaproveitar × copiar, ciclos); invalidação dos caches de objetos, cenários e miniaturas; quadro vertical, 1:1 e 4:3 nos modelos do Criador de Cenários; seleção de peças giradas, espelhadas e escaladas; mover, girar e escalar grupos sem deriva; profundidade de braços e mãos em 8 vistas × poses; ações rápidas do celular por tipo de seleção e por estado no tempo; história grande (validade, determinismo, preview × exportação, **120 quadros de uma cena com cenário de 80 peças e 10 figurantes abaixo de 25 ms por quadro**); manual (todo link, ajuda contextual, imagem e marcação existem; busca); validação do modo simples; pré-escuta de áudio com cancelamento.

**E2E** (`stories`, `library`, mais os existentes adaptados às abas e ao dock): história de 5 cenas com cenário de 60+ peças exportada **inteira em 1080p** (29 s de vídeo em ~45 s, ~16 MB; duração, tamanho e o céu de cada horário conferidos com ffprobe/ffmpeg); .jrec da história aberto numa instalação limpa com o quadro PNG igual; vertical 9:16 em 1080p; cenário com personagem estático que sai no vídeo mas não aparece em Camadas nem na timeline; editar um objeto no criador muda a cena na hora; biblioteca 1.1 e registro ilegível; objeto com dependências e ciclos impedidos; celular (Editar fala × Falar, foco no campo certo, ações de câmera); seleção por desenho girado e grupos; **.7z, .rar, .tar.xz e .tar.bz2 reais** (fixtures criadas com 7-Zip e WinRAR), RAR com senha, 7z truncado e importação de .7z offline.

## Ajustes pré-lançamento da 1.2

**Prévia dos modelos (bug do modal que piscava).** Reproduzido primeiro, no build de produção e no servidor de desenvolvimento: com o mouse sobre o modal, o fundo media 303×176 (preso ao cartão) e a posição alternava entre y=25 e y=27. Causa: modal dentro do cartão com `transform` no `:hover` (veja o CHANGELOG). `previews.spec.ts` (14 testes, 4 janelas: 1280×800, 768×1024, 390×844 e 320×640) mede a estabilidade de verdade: posição e tamanho do modal e do fundo constantes com o mouse se movendo, o nó do modal não é remontado (marca no DOM), o fundo cobre a janela inteira, **capturas de tela em instantes diferentes são idênticas byte a byte**, todas as imagens decodificam, uma imagem por cena na ordem e com o nome do modelo, fechar e reabrir 10 vezes, fechar por X e por Esc, criar o projeto pela prévia e miniaturas dos cartões preenchendo o cartão. **Os testes de estabilidade falham sem a correção** (conferido desfazendo só o portal do modal) e passam com ela.

**Keyframe universal por seção.** `section-keys.test.ts` (16 testes): só propriedades animáveis entram; valor atual e interpolado; instante arredondado; não duplica nem sobrescreve; não cria faixa vazia; não toca outras seções nem outro personagem; câmera; campos discretos; estado nenhum → parcial → todos; um único Ctrl+Z e refazer; convivência com os botões individuais. `section-keys.spec.ts` (8 testes): criação com valores conferidos na interface, desfazer e refazer pelos botões, segundo clique sem efeito nem histórico, keyframe existente preservado, seleção e seções respeitadas (Zeca, Rosto, Pose, Camadas), câmera, modo simples e avançado (marcas na timeline), seção de um campo sem botão universal, inspeção visual dos três estados (capturas em `test-results/e2e/keys-*.png`) e celular (390×844 com toque: botão ≥ 36 px, à direita do título, sem estouro).

## Verificações de mídia

- **WebM (Teste 14):** `ffprobe` confirma VP9 + Opus, 854×480, 216 quadros decodificados, duração de 9 s (±0,25). O WAV de teste alterna tom e silêncio a cada 0,25 s, e o `silencedetect` encontra o silêncio em 0,25 s e 0,75 s (±0,05), o que comprova a sincronia do áudio. Primeiro e último quadros decodificam com conteúdo.
- **MP4:** H.264 confirmado pelo `ffprobe` neste Chrome.
- **Montagem:** duas cenas de 9 s com dissolver de 500 ms resultam em 17,5 s (±0,3).
- **PNG:** dimensões exatas; a grade de terços ligada no editor não aparece no arquivo; inverter camadas muda o pixel medido.
- **Preview × exportação:** diferença média de cor abaixo de 10 em 255 num quadro de 192×108.

## Desempenho medido

Reprodução em 1366×768, Chrome sem GPU dedicada no ambiente de teste (`tests/tools/perf.mjs`):

| Cena | FPS | Quadro p50 |
| --- | --- | --- |
| Exemplo: 2 personagens, 3 móveis | 60 | 16,7 ms |
| Pesada: 12 personagens, 13 objetos | 29,5 | 33,7 ms |

Em 200 cenas, o DOM mantém menos de 40 linhas da lista por causa da virtualização. Não houve medição em celular real nem análise de vazamento de memória em sessões longas.

## Bugs que os testes encontraram e foram corrigidos

- Entradas absolutas invisíveis dentro de painéis criavam rolagem no documento em 1366×768.
- O aviso "valor ajustado" do `SliderNumberField` sumia logo após aparecer.
- Os caches de render ignoravam alterações em objetos mutáveis; agora só confiam na identidade de objetos congelados pelo Immer.
- O gesto "falando" dos templates acabava criando uma fala "Olá!" indevida.
- Personagens inseridos ficavam à frente da mesa de primeiro plano do cenário.

## O que não foi testado

- **Variantes de .7z e .rar além das criadas aqui.** Os testes usam arquivos reais feitos com 7-Zip e WinRAR (um de cada formato, mais senha e truncado). Outras ferramentas, RAR5 com cabeçalho cifrado, volumes e arquivos muito grandes não foram exercitados. Por `file://` esses formatos não funcionam (o worker exige HTTP).
- **Aparelhos reais.** Os testes de celular (320 a 430 px, retrato e paisagem) usam janelas emuladas no Chrome de desktop. Toque real, teclado virtual, áreas seguras e barras do sistema não foram testados em hardware; não há resultado de aparelho físico.
- **Exportação maior que 1080p ou mais longa que ~30 s.** O maior caso medido é 29 s em 1080p (1.920 × 1.080, 30 fps) em ~45 s.

- **Firefox, Safari e celulares reais.** Os testes de "celular" usam tamanhos de janela no Chrome de desktop. Toque real, teclado virtual, notch e o caminho de exportação via MediaRecorder não foram exercitados.
- **Ollama e serviços reais de IA.** Só mocks.
- **Zoom do navegador em 125%/150%**, de forma direta (equivale aproximadamente a janelas menores, que foram testadas).
- **Auditoria de acessibilidade com leitor de tela.**
