# Resultados de testes

Versão 1.1.0, executados em 07/11/2026. Nada aqui é estimativa: são as saídas das execuções.

## Ambiente

- Windows 10 Pro 19045, Node 24.21.0
- Google Chrome 156.0.8078.81, via Playwright 1.65.0, contra o build de produção
- ffmpeg/ffprobe (N-127043) para inspecionar os vídeos

## Resumo

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Sem erros nem avisos (`--max-warnings=0`) |
| `npm run typecheck` | Sem erros (TypeScript estrito) |
| `npm test` | **214 de 214** testes, 10 arquivos |
| `npm run build` | OK, 2,4 MB em `dist/` (inclui o WebAssembly da libarchive, ~1 MB) |
| `npm run test:e2e` | **54 de 54** testes |
| `npm run shots` | 12 de 12, capturas em `docs/capturas/` (na primeira rodada um worker do Playwright caiu com código 0xC0000142 do Windows, sem falha de asserção; a nova rodada passou inteira) |

## O que os testes cobrem

**Unitários** (`tests/unit`): schema e migração; cenas e camadas; bocas, olhos, narizes e olhares em todo o elenco × vistas × expressões × visemas; snapshots SVG das 8 vistas para Nina e Zeca; keyframes e easing; clips e ações; Undo/Redo de 7 categorias; templates; serialização; sanitização de SVG; parâmetros de exportação; montagem; `SliderNumberField`; 9 pedidos de comandos rápidos; adaptadores de IA com mocks; repositório em `fake-indexeddb`.

**E2E** (`tests/e2e/flows.spec.ts`): os 20 fluxos exigidos, mais pacote ZIP entre navegadores, abertura por `file://`, MP4, montagem, comparação de preview com exportação, cancelamento, keyframes, conversão de clips, arraste, criador, comandos rápidos, atalhos, menus "…", seleção no palco, zoom do editor, toque no celular e 8 tamanhos de tela.

**Novos na 1.1** (`v11-integrity`, `hair-matrix`, `v11-features`): detecção de formato pelos bytes; caminhos perigosos (`..`, absolutos, unidades); limites de entradas, tamanho e taxa de compressão; ZIP com senha; TAR e TAR.GZ; 7z com leitor simulado; ida e volta de .jrec; mídia ausente sem sucesso falso; colisão de IDs; arquivo adulterado (tamanho e SHA-256); SVG malicioso dentro de pacote; ZIP legado; pacote só com mídias; limpeza de mídias órfãs entre projetos; salvamento concorrente, troca de projeto e espera crescente; cache LRU de áudio; quebra de texto; 30 cabelos × 8 vistas (profundidade, recorte do brilho, snapshot); movimento natural, piscada dupla, transição por clip, sequências, enquadramentos e cenários com 1, 3 e 5 horários.

**E2E novos na 1.1:** salvar .jrec e reabrir em contexto limpo com áudio; projeto 0.4 regravado em .jrec; mídia ausente (aviso, "Salvar incompleto", lista no manifest, alerta em Mídias); aba Mídias (importar por categoria, reaproveitar arquivo repetido, usar na cena, remover com aviso de uso e desfazer); cenário próprio com 1, 3 e 5 horários, troca de horário e persistência; modo simples × avançado sobre os mesmos dados, com desfazer; PWA recarregando offline no mesmo link `?projeto=`; 390×844 com Salvar, Áudio e modo simples sem estourar a tela.

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

- **.rar real e .7z/.tar.xz/.tar.bz2 reais no navegador.** A leitura usa libarchive.js; os testes cobrem o caminho com um leitor simulado e o worker é empacotado e servido, mas nenhum arquivo .rar real foi importado em teste automatizado. Por `file://` esses formatos não funcionam (o worker exige HTTP).

- **Firefox, Safari e celulares reais.** Os testes de "celular" usam tamanhos de janela no Chrome de desktop. Toque real, teclado virtual, notch e o caminho de exportação via MediaRecorder não foram exercitados.
- **Ollama e serviços reais de IA.** Só mocks.
- **Zoom do navegador em 125%/150%**, de forma direta (equivale aproximadamente a janelas menores, que foram testadas).
- **Auditoria de acessibilidade com leitor de tela.**
