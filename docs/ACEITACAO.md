# Checklist de aceitação

Legenda: **PASSOU** = implementado e verificado em teste automatizado. **PARCIAL** = funciona, mas com a lacuna indicada. **NÃO IMPLEMENTADO** = ausente.

## Pontos não negociáveis

| # | Requisito | Estado | Evidência |
| --- | --- | --- | --- |
| 1 | 100% 2D, sem 3D real | PASSOU | Sem WebGL nem Three.js nas dependências |
| 2 | Desktop: esquerda, centro, direita, timeline | PASSOU | E2E layouts; `tela-1920x1080.png` |
| 3 | Mobile próprio, popup acima do dock | PASSOU* | E2E 9, 10, paisagem. *Só em Chrome desktop emulando o tamanho |
| 4 | Preview e timeline visíveis; máscara fora do quadro | PASSOU | E2E layouts; `frame-mask` |
| 5 | Rodapé de Cenas sempre visível | PASSOU | E2E 7, com 200 cenas |
| 6 | Excluir e subir/descer camadas e cenas por botão | PASSOU | E2E 6, 8 |
| 7 | Caixa numérica em todos os sliders | PASSOU | `SliderNumberField` é o único slider; E2E 5 |
| 8 | Personagens autorais, 8 vistas, rig, nariz e olhar | PASSOU | `views.test.ts`; E2E 3 |
| 9 | Nunca duas bocas nem olhos deformados | PASSOU | `views.test.ts`; E2E 4 |
| 10 | Cenas independentes, biblioteca reutilizável | PASSOU | `model.test.ts`; E2E 2 |
| 11 | Timeline real e vídeo real | PASSOU | E2E 14 com `ffprobe` |
| 12 | Salvamento seguro, migração, regressão | PASSOU | E2E 1, 11; `migration.test.ts` |

## Por área do prompt

| Seção | Item | Estado | Observação |
| --- | --- | --- | --- |
| 03 | Arquitetura em módulos, TS estrito, renderAt(t) | PASSOU | |
| 04 | Schema versionado, vínculos, tempo em ms | PASSOU | |
| 05 | Painéis redimensionáveis e preferências salvas | PASSOU | Divisores com teclado e ponteiro |
| 05 | Touch ≥ 44 px nos botões principais | PARCIAL | Dock e botões de painel sim; botões compactos da timeline no celular têm 36 px |
| 06 | Formatos, guias, zoom, pan, gizmos, xadrez, modos | PASSOU | |
| 06 | Câmera 2D, seguir, parallax | PASSOU | |
| 07 | Criador completo | PASSOU | Corpo, rosto, cabelo, roupa, acessórios, conflitos, restaurar por seção |
| 07 | Importar SVG/PNG como sprite | PASSOU | Avisa que não é articulável |
| 07 | "Editável" para SVG importado | PARCIAL | Vira imagem com transformações; as partes internas não são editáveis |
| 08 | 8 vistas com arte funcional | PASSOU | Templates discretos: a troca de vista é um corte, sem interpolação |
| 09 | Importar áudio, onda, trilhas, volume, fades, mudo, solo | PASSOU | |
| 09 | Reprodução sincronizada | PASSOU | Exportação medida; ao vivo usa o relógio do AudioContext |
| 09 | Lip-sync básico e manual | PASSOU | **Não reconhece fonemas.** "Por texto" estima pelas letras |
| 09 | Corte no início e no fim | PASSOU | Offset, ajuste de borda, cortar |
| 10 | 20+ cenários, 30+ objetos | PASSOU | 29 e 39, com desenho distinto testado |
| 10 | Variantes e cores | PASSOU | Dia/noite, tom, 3 cores |
| 10 | Objetos com versões frontal e lateral | PARCIAL | Só o carro. Os demais têm uma vista, e podem ser espelhados |
| 10 | Oclusão, máscaras, parallax, blur, sombra | PASSOU | |
| 11 | Camadas completas, agrupar | PASSOU | Grupo tem caixa de seleção simplificada |
| 11 | Arrastar para reordenar | NÃO IMPLEMENTADO | Era opcional; os botões são o caminho |
| 12 | Cenas: tudo o que foi pedido | PASSOU | |
| 13 | Transporte, loop, velocidade, trecho | PASSOU | |
| 13 | Trilhas, subtrilhas, renomear, bloquear, mudo, solo | PASSOU | |
| 13 | Keyframes: criar, mover, editar, copiar, colar | PASSOU | Colar é por `Ctrl+V`, sem botão |
| 13 | Easing com controles básicos | PASSOU | Presets. Sem editor de curva Bézier livre |
| 13 | Pinch na timeline | NÃO IMPLEMENTADO | Era opcional; há botões. O palco tem pinch |
| 14 | SliderNumberField e esquema único | PASSOU | |
| 15 | 20+ templates, 6 de projeto | PASSOU | 25 e 6 |
| 15 | Personagens, cabelos, expressões, poses etc. | PASSOU | |
| 15 | Paletas e estilos visuais como categoria | PARCIAL | Paletas de cor nos campos e textura de papel; sem biblioteca de estilos |
| 15 | Salvar cena, pose e personagem; importar e exportar biblioteca | PASSOU | |
| 15 | Salvar cenário e animação na biblioteca | NÃO IMPLEMENTADO | Dá para salvar a cena inteira, que os inclui |
| 16 | Projetos, autosave, status honesto, quota | PARCIAL | Erro de quota tratado no código, sem teste forçado |
| 16 | Backup JSON e ZIP, migração com relatório | PASSOU | |
| 16 | Gerenciador de mídia | PARCIAL | Mídia órfã é limpa ao excluir projetos; sem tela para listar e remover mídia |
| 17 | PNG, sequência, WebM, projeto, cancelar, MP4 | PASSOU | |
| 17 | Fundo transparente | PASSOU | Em PNG. O vídeo sai sempre opaco |
| 17 | Fallback MediaRecorder | PARCIAL | Implementado, **sem teste executado** |
| 18 | Comandos rápidos com rótulo honesto | PASSOU | Os 9 exemplos testados |
| 18 | Plano validado, revisar, aplicar, desfazer | PASSOU | |
| 18 | Ollama e IA online | PARCIAL | Testados **só com mocks** |
| 19 | Atalhos, Undo/Redo, menus, multisseleção | PASSOU | |
| 20 | 200 cenas, listas virtualizadas | PASSOU | |
| 20 | Medição em celular intermediário | NÃO IMPLEMENTADO | Sem aparelho no ambiente |
| 21 | pt-BR, foco, modais, reduced-motion, labels | PARCIAL | Sem auditoria com leitor de tela |
| 22 | Testes pedidos | PASSOU | Ver [TESTES.md](TESTES.md) |

## Cenários finais

| Cenário | Estado |
| --- | --- |
| 1. Historinha em casa | PASSOU |
| 2. Vídeo vertical no celular | PARCIAL: fluxo testado em tamanho de celular, não em aparelho |
| 3. Episódio com 200 cenas | PASSOU |
| 4. Personagem personalizado | PASSOU |
| 5. Descrição para ações | PARCIAL: comandos testados; IA real não conectada |
| 6. Recuperação e backup | PASSOU |

## Versão 1.1

| Requisito | Estado | Evidência |
| --- | --- | --- |
| Salvamento automático sem corridas nem laço de tentativas | PASSOU | `v11-integrity` (concorrência, troca, espera crescente) |
| IDs de mídia sem colisão, sem duplicar arquivo | PASSOU | `v11-integrity`; E2E Mídias (arquivo repetido reaproveitado) |
| Sem sucesso falso com mídia ausente | PASSOU | `v11-integrity`; E2E mídia ausente |
| Extração segura de pacotes | PASSOU | `v11-integrity` (caminhos, limites, senha) |
| .jrec como único formato de projeto, reimportação completa | PASSOU | E2E .jrec em contexto limpo; E2E projeto 0.4 |
| Importar .json/.zip legados, .7z, .rar, .tar.* | PASSOU* | Na 1.2 testado com arquivos reais (7-Zip e WinRAR), senha, corrompido e offline. *Não funcionam por `file://` |
| Áudio: play/pausa/busca sincronizados, memória limitada | PASSOU | `v11-integrity` (LRU); E2E 12 e 14 |
| Balões e legendas quebram e cabem | PASSOU | `v11-integrity` (quebra) |
| Cabelo nas 8 vistas sem esconder | PASSOU | `hair-matrix` (30 × 8); `test-results/hair-matrix.svg` |
| Movimento natural, transições, sequências, enquadramentos | PASSOU | `v11-features` |
| Biblioteca de áudio (Voz, Música, Efeitos, Ambiente) | PASSOU | E2E Mídias |
| Cenários próprios com horários opcionais | PASSOU | `v11-features`; E2E com 1, 3 e 5 horários |
| Modo simples e avançado nos mesmos dados | PASSOU | E2E modo simples |
| PWA atualiza e funciona offline no link do projeto | PASSOU | E2E PWA offline; cache com nome por build |
| Telas pequenas | PASSOU* | E2E 390×844 e capturas. *Chrome desktop emulando o tamanho |

## Versão 1.2

| Requisito | Estado | Evidência |
| --- | --- | --- |
| Pré-escuta de áudio descarta carregamento antigo | PASSOU | `v12` |
| Modo simples valida início e duração | PASSOU | `v12` |
| Revincular atualiza o painel na hora | PASSOU | E2E mídia ausente |
| .7z e .rar com arquivos reais, senha, corrompido e offline | PASSOU | E2E `stories`/pacotes reais (fixtures em `tests/fixtures/archives`) |
| Tela inicial, Meus projetos, Modelos, Manual, Configurações | PASSOU | E2E 11, 20 e demais; capturas `inicio`, `projetos`, `modelos` |
| Configurações com efeito real e persistência | PARCIAL | Tema, escala, FPS, volume, início e modo implementados e usados pelo app, mas sem teste automatizado por opção |
| Manual com busca, capítulos, ajuda contextual, offline | PASSOU | `manual`; `npm run manual:shots`; pré-cache no service worker |
| Propriedades em abas por tipo de seleção | PASSOU | E2E 2, 4, 6, 12, 16 e outros, adaptados |
| Criador de Objetos | PASSOU | `creators`; E2E objeto criado e editado; `library` |
| Criador de Cenários com horários e personagens estáticos | PASSOU | `creators`; E2E cenário com personagem estático |
| Quadro vertical/1:1/4:3 no Criador de Cenários | PASSOU | `creators` (modelos); captura 9:16 inspecionada |
| Biblioteca de objetos e cenários com dependências e formatos antigos | PASSOU | `library-bundles`; E2E `library` |
| Caches invalidam ao editar objetos | PASSOU | `library-bundles`; E2E |
| Seleção de peças giradas e grupos | PASSOU | `creators`; E2E `library` |
| Profundidade de braços e mãos, automática e manual | PASSOU | `limb-depth` (8 vistas × poses) |
| Cabelos longos nas 8 vistas | PASSOU | `hair-matrix` (geometria + folha visual) |
| Celular: dock, barra rápida contextual, criadores | PASSOU* | `quick-actions`; E2E celular. *Janela emulada, sem aparelho físico |
| História completa e exportação grande | PASSOU | E2E `stories` (1080p, 29 s, 5 cenas) |

## Limitações importantes

1. **Testado só no Chrome de desktop.** Firefox, Safari e celulares reais precisam de uma rodada própria antes de divulgar suporte.
2. **Dados só no navegador.** Limpar os dados do site apaga os projetos. Faça backups com "Salvar projeto" (.jrec). Abrir por `file://` e por um servidor resulta em bibliotecas separadas.
3. **Vistas são cortes.** Virar um personagem troca de desenho instantaneamente, por decisão de projeto.
4. **Reprodução com muitos personagens** cai para cerca de 30 fps no ambiente de teste. A exportação não é afetada, porque renderiza quadro a quadro.
5. **Texto nos balões** usa fontes do sistema. O visual pode mudar entre sistemas operacionais.
6. **Arte procedural:** consistente e variada, mas é geométrica. Um ilustrador deixaria os personagens mais expressivos.
7. **Sem GIF e sem colaboração.** Não foram pedidos.
8. **Projetos da 0.4** precisam ser exportados em JSON antes de importar.
9. **.7z, .rar, .tar.xz e .tar.bz2** dependem de um worker WebAssembly: funcionam por HTTP (Vercel, `npm run preview`), não por `file://`.
10. **Celular:** testado só com janelas emuladas no Chrome de desktop; nenhum aparelho físico.
11. **Configurações:** cada opção tem efeito real, mas só o tema claro foi conferido visualmente; as demais têm cobertura apenas de código e uso no app.
