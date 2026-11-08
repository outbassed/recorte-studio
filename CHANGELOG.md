# Changelog

## Em desenvolvimento: catálogo, biblioteca e animação de objetos

Branch `feature/recorte-studio-catalogo-biblioteca`, sobre a 1.2. Sem lançamento. Detalhes, arquitetura e o que ainda não existe em `docs/CATALOGO.md`.

### Novidades

- **Catálogo unificado** nas abas Elenco, Cenários e Objetos: itens padrão, do projeto e da minha biblioteca numa lista só; busca sem acento; filtros Todos, Padrão, Meus, Favoritos, Recentes e No projeto; categorias; ordem; grade ou lista; miniaturas reais; selo de origem e de uso; carregamento progressivo; detalhes com 4 vistas (personagens), estados (objetos), horários (cenários) e animações tocando.
- **Cópia ao editar:** editar um personagem, objeto ou cenário padrão cria uma cópia com identidade nova no projeto; o original nunca muda.
- **Biblioteca com identidade:** salvar de novo atualiza o mesmo registro; trazer para o projeto mantém o ID; duplicar cria um item novo; exportar gera `.biblioteca.json`.
- **Animação por quadros salva no objeto** (fogo, porta, ventilador…): várias animações por objeto, duração por quadro, repetir/uma vez/vai e volta, papel vegetal, copiar/colar e reordenar quadros. Cada cópia na cena escolhe animação, velocidade e defasagem; trocar por keyframe faz a animação começar ali. O quadro é função pura do tempo: prévia, PNG e vídeo iguais.
- **Exemplos originais:** Fogueira (Aceso, Apagando), Ventilador (Girando, Devagar) e Barco.
- **Vínculo pai/filho:** Propriedades → Camadas → Vinculado a. O elemento acompanha o grupo (posição, giro, escala, keyframes) e mantém as próprias falas, ações e piscadas. Vincular e soltar não mudam a posição na tela.
- **Shift+clique no losango da seção** (ou toque longo) remove só os keyframes daquela seção no instante atual, com um único Ctrl+Z e confirmação quando acaba com a animação de uma propriedade.

### Fase 3b: Criadores de Roupas e Cabelos com manequim

- **Criador de Roupas e Criador de Cabelos** (Elenco → Criar roupa / Criar cabelo; Biblioteca → + Roupa / + Cabelo): peças por camadas, cada camada presa a uma parte do corpo (cabeça, tronco, quadril, braço, antebraço, coxa, canela). Formas (incluindo o novo **trapézio**), texto, cor, contorno, posição, tamanho, giro, ordem; adicionar, duplicar, reordenar e excluir camadas; desfazer/refazer.
- **Pontos de partida originais:** camiseta, camisa de manga longa, casaco aberto, vestido, calça, bermuda, saia, macacão; cabelo curto, longo, cacheado, black e coque.
- **Manequim de referência** em 6 corpos (adulto, robusto, esguio, adolescente, criança, idoso) ou qualquer personagem do projeto, com pose, as 8 vistas, zoom, foco na cabeça e "Sem a peça". Experimentar no manequim não muda nenhum personagem. **Sem roupa, cobertura neutra opaca no peito e no quadril; sem nudez.**
- **Acompanha o corpo:** a peça segue pose, vista, animação, reprodução e exportação; ajusta-se ao tamanho de cada corpo; cabelo comprido fica atrás do corpo de frente e por cima das costas de costas; camadas só de frente/só de costas, "desliza ao virar" e espelhamento. Peças que substituem a roupa ou o cabelo padrão deixam uma base neutra por baixo.
- **Itens individuais:** cada roupa/cabelo aparece no Elenco e na Biblioteca com miniatura, categoria (Roupas, Cabelos) e informações; vestir no personagem selecionado, editar, duplicar, renomear, salvar na biblioteca (mesmo registro ao salvar de novo), exportar, importar e excluir. Editar uma peça atualiza todos os personagens do projeto que a vestem; cada personagem guarda a própria cópia.
- **Criador de Personagens → Roupas/Cabelo:** lista as peças criadas para vestir e tirar, e cria novas.
- **Compatibilidade:** projetos e personagens antigos abrem iguais (`wear` e `wearables` vazios por padrão); .jrec, pacotes e biblioteca existentes não mudam.

### Fase 3a: texto nos criadores

- **Texto editável** como peça nos Criadores de Objetos e de Cenários: conteúdo com várias linhas, fonte, tamanho, peso, itálico, alinhamento, espaçamento, cor e contorno; continua texto na biblioteca, em pacotes e no .jrec, e entra na busca da Biblioteca.

### Fase 2.5: Biblioteca principal

- **Biblioteca na tela inicial**, sem abrir projeto (e por cima do editor): explorar itens padrão, meus e de pacotes, buscar por nome, categoria, tipo e palavra-chave, filtrar por tipo e origem, grade ou lista, detalhes completos (origem, criador, licença, versão, compatibilidade, tamanho, animações, vistas) e ações conforme a permissão.
- **Itens individuais:** salvar, copiar, duplicar, renomear, favoritar, exportar, importar e apagar um item sozinho, sem pacote; importar de novo atualiza em vez de duplicar.
- **Pacotes exploráveis:** página de cada pacote com capa, metadados, todos os itens, busca, contagens e dependências; abrir um .rspack mostra o conteúdo antes de instalar.
- **Studio mais leve:** a aba Biblioteca virou uma Toolbox compacta; a gestão completa abre na Biblioteca principal.
- **Segurança e robustez:** pacotes com referências internas incompletas são recusados; importação de pacote grande não trava a tela e mostra progresso; falhas de armazenamento aparecem como mensagens claras.

### Continuação (correções do preview e expansão)

- **Faixas horizontais com rolagem visível:** abas das Propriedades, filtros do catálogo e categorias dos Modelos ganham barra fina visível, setas nas pontas (desabilitadas no fim), roda do mouse na horizontal e aba/filtro ativo sempre à vista. As barras escondidas da barra rápida do celular, das configurações, da timeline e do palco voltaram a aparecer.
- **Bolinha do grupo:** com um grupo selecionado, uma bolinha laranja no pivô move o conjunto inteiro; cada arraste é um passo de desfazer e Esc cancela. Ela é só do editor (não sai no PNG nem no vídeo). Botão direito num elemento → Selecionar o grupo.
- **Modelos prontos:** Mar e Barco (barco com passageiros vinculados, balanço, ondas animadas), Acampamento (fogueira animada, luz tremulando), Praia, Cidade e rua, Quarto, Floresta, Sala de aula e Laboratório de animação; categorias e "O que testar neste modelo" na tela Modelos. Objetos novos: Ondas, Barraca, Guarda-sol, Palmeira e Pedras.
- **Pacotes opcionais (.rspack):** instalar, atualizar, ativar/desativar, exportar e remover, com validação completa (manifesto, licença, sha256, caminhos, SVG, tamanhos, dependências) e o pacote de demonstração Kit Cozinha Retrô.
- **Correções:** arrastar um elemento dentro de um grupo girado agora segue o cursor; caixas de seleção certas para filhos de grupos; mudar o pivô não faz o desenho pular; objeto animado dentro de outro objeto ou de um cenário anima no tempo certo; olhar e "segurado por" usam a posição real quando há grupos; copiar um cenário padrão é um único passo de desfazer; a caixa "Ativo" dos pacotes responde na hora.

### Correções

- Diálogos de nome e confirmação abertos dentro dos criadores apareciam por baixo do criador.
- Desagrupar um grupo girado ou escalado fazia os elementos pularem; desagrupar um grupo dentro de outro removia a última camada da cena.
- Elementos dentro de grupos sumiam da timeline (falas e ações deles não eram editáveis); agora aparecem como "Grupo › Nome".
- Restaurar as configurações não apaga mais favoritos e recentes do catálogo.

## 1.2.0

Tela inicial e Configurações novas, manual dentro do app, propriedades em abas, Criador de Objetos e de Cenários, profundidade de braços e mãos, cabelos longos corrigidos, interface própria para celular. Sem backend e sem dependência online; projetos 1.0 e 1.1 continuam abrindo.

### Novidades

- **Tela inicial** com Início, Meus projetos (miniaturas reais, busca, ordenação, filtros, arquivar, salvar .jrec, link local), Modelos (miniaturas reais e prévia) e atalhos para o manual.
- **Configurações do aplicativo**, todas com efeito real: tema escuro, claro ou do sistema; tamanho do texto; reduzir animações; começar no último projeto; modo inicial da timeline; volume do editor; limite de FPS da prévia; miniaturas das cenas; espaço usado e limpeza segura; atalhos com busca; sobre e changelog.
- **Manual** com 35 capítulos, busca sem acento, links entre páginas, capturas reais com marcações numeradas medidas nos elementos e ajuda contextual (F1 e ícones ?). Funciona offline.
- **Propriedades em abas** por tipo de seleção (personagem, objeto, imagem, câmera, cena, fala, áudio, legenda, efeito); a última aba usada é lembrada.
- **Criador de Objetos:** formas, linhas, imagens SVG/PNG/JPEG/WebP, objetos prontos e outros objetos seus; pivô, camadas, agrupar, duplicar, espelhar. Entra na cena como objeto animável, em cenários e na biblioteca.
- **Criador de Cenários:** um horário (Manhã, Dia, Tarde, Entardecer, Noite) por composição, cada um opcional; começar de tela vazia, imagem, modelo, cenário pronto, outro horário ou composição salva. **Personagens estáticos** com cópia congelada de aparência e pose, fora da timeline.
- **Braços e mãos** na frente ou atrás da cabeça: automático (vitória, mãos no rosto, aceno) e manual por braço e por mão, animável. Poses novas: Mãos no rosto e Mãos atrás da cabeça.
- **Celular:** dock por etapas da história, barra rápida contextual do elemento selecionado, barra superior que cabe em 320 px, painéis sem estouro horizontal.
- **Câmera** selecionável no dock do celular; botão de ajuda em várias áreas.
- **Keyframe universal por seção:** um losango ao lado do título das seções com várias propriedades animáveis (Posição e transformação, Escala separada, Profundidade, Olhar, Rosto, Pose e rig, Profundidade dos braços, Câmera) cria, no tempo atual, os keyframes que faltam em todas as propriedades da seção, com os valores de agora. Não duplica, não sobrescreve e não remove; é uma única ação de histórico (um Ctrl+Z); mostra o estado no instante (vazio, parcial ou cheio); funciona nos modos simples e avançado e no celular (36 px). Mecanismo reutilizável em `engine/model/sectionKeys.ts`.

### Correções

- **Cabelos longos:** massa traseira por vista (perfil atrás da nuca e sobre as costas; costas com a nuca coberta), com testes geométricos de oclusão e folhas de inspeção.
- **Pré-escuta de áudio** não começa depois de você mandar parar ou trocar de arquivo.
- **Modo simples** recusa início negativo, duração zero e valores inválidos, com mensagem clara.
- **Mídias:** depois de revincular, a disponibilidade atualiza na hora.
- **.7z e .rar:** testados com arquivos reais (7-Zip e WinRAR); RAR com senha e 7z truncado agora dão erro claro; o leitor funciona offline sem uso prévio.
- **Biblioteca de cenários e objetos:** pacote versionado com imagens, objetos aninhados e personagens estáticos; lê os formatos antigos (1.1 e 1.2 inicial); registro ilegível mostra o motivo e pode ser apagado; "Trazer" reaproveita o que já existe e copia quando o conteúdo difere. Cenários da biblioteca também aplicam pela aba Biblioteca.
- **Caches de objetos:** editar um objeto refaz os objetos que o contêm, as composições de cenário e as miniaturas das cenas; carregar ou relinkar uma imagem refaz o desenho; personagem estático usa prefixo de ids por uso.
- **Dependências:** um objeto não pode conter a si mesmo, direta ou indiretamente.
- **Criador de Cenários em quadros não 16:9:** o guia mostra o quadro real (9:16, 1:1, 4:3…), a área fora dele fica escurecida, "Prévia final" recorta no quadro e os modelos se ajustam à largura.
- **Ações rápidas do celular** de verdade contextuais: mudam com o tipo de seleção e com o estado no tempo atual ("Falar" vira "Editar fala"), e levam à aba, seção e campo certos.
- **Seleção de peças giradas:** o clique e o contorno seguem rotação, espelho e escala; grupos têm caixa própria, pivô estável e controles para mover, girar e escalar em bloco; Shift alterna; setas, Ctrl+A, Ctrl+D e Delete no estúdio.
- **Prévia dos modelos piscava** (tela inicial → Modelos → Prévia): o modal era desenhado dentro do cartão, que sobe 2 px no `:hover`; num ancestral com `transform`, `position: fixed` passa a ser relativo ao ancestral, então o fundo ficava preso ao cartão (303×176, recortado) e se deslocava com o mouse, o que alternava o `:hover` de novo, sem parar. Todos os modais agora são desenhados no `<body>` por portal. Também: as miniaturas dos cartões herdavam 72×42 do painel Modelos do editor, e a prévia mostrava no máximo 6 cenas; agora mostra todas, na ordem e com o nome (imagens estáticas, sem simular reprodução).

### Melhorias por iniciativa própria

- Service worker pré-armazena o leitor de arquivos compactados e as imagens do manual.
- Limite de FPS da prévia, miniaturas de cena opcionais e volume do editor para máquinas mais simples.
- Teste de estresse: história de 5 cenas com cenário de 60+ peças e multidão estática exportada em 1080p.

## 1.1.0

Correções de integridade, formato de projeto próprio (.jrec), biblioteca de áudio, cenários próprios por horário, movimento natural e modo simples. Sem backend, sem dependência online.

### Projeto e arquivos

- **.jrec é o único formato de projeto editável.** Contêiner ZIP com `manifest.json` versionado (formato, versão, app, lista de mídias com tamanho e SHA-256), `project.json` e as mídias em binário nativo em `assets/`. Antes de dar sucesso, o arquivo gerado é relido e conferido.
- **"Salvar projeto" separado de "Exportar vídeo/imagem".** O diálogo de exportação ficou só com vídeo, PNG e sequência PNG (a sequência continua em ZIP).
- **Sem sucesso falso com mídia ausente.** Se faltar arquivo, o salvamento para e oferece revincular em Mídias ou salvar um arquivo marcado `-incompleto`, com a lista no manifest.
- **Importação por conteúdo, não por extensão:** .jrec, .json e .zip legados, .7z, .rar, .tar, .tar.gz, .tar.xz e .tar.bz2. Erros claros para arquivo corrompido, protegido por senha ou incompatível. Pacote só com mídias pode ir para a biblioteca do projeto aberto.
- **Extração segura:** caminhos normalizados (sem `..`, absolutos ou unidades), limites de entradas, tamanho por entrada, total e taxa de compressão, leitura do diretório central antes de descompactar.
- **IDs de mídia por conteúdo** (`media_<sha256>`): o mesmo arquivo nunca vira duas cópias e dois arquivos diferentes nunca colidem. IDs antigos são remapeados na importação.
- **SVG** sanitizado também na importação de pacotes; tipo real conferido pelos bytes.

### Correções

- **Salvamento automático:** sem corridas entre salvamentos, sem laço de tentativas (espera crescente de 2 s a 60 s, um aviso por erro), troca de projeto só depois de gravar o anterior.
- **Áudio:** play/pausa/busca não deixam som atrasado tocando; cache de áudio decodificado limitado (LRU 256 MB) e liberado ao trocar de projeto.
- **Balões e legendas:** palavras longas quebram com hífen; o texto encolhe para caber no quadro.
- **Cabelo nas 8 vistas:** mechas e volumes atrás ou na frente da cabeça conforme a vista, brilho recortado no contorno do cabelo, careca de coroa e moicano corretos de perfil e 3/4. Coberto por uma matriz de 30 estilos × 8 vistas.
- **PWA:** o nome do cache muda a cada build e o app avisa quando há versão nova, com botão para recarregar.

### Novidades

- **Mídias e áudio:** aba própria com biblioteca de Voz, Música, Efeitos e Ambiente; ouvir, renomear, usar na cena, substituir arquivo, remover com aviso de uso (e desfazer), guardar na biblioteca do usuário para outros projetos sem copiar o arquivo. Botão **Áudio** visível na timeline.
- **Meus cenários:** imagem própria (SVG, PNG, JPEG, WebP) com horários opcionais Manhã, Dia, Tarde, Entardecer e Noite, cada um com sua imagem. Só os horários existentes aparecem; horário ausente usa o mais próximo e avisa.
- **Movimento natural:** respiração, piscadas (às vezes duplas), olhares rápidos, leve movimento de cabeça e troca de postura, determinísticos e ajustáveis por personagem; diminuem durante ações.
- **Transições** de entrada e saída por clip de ação, **sequências** reutilizáveis (salvar e aplicar a outro personagem) e **enquadramentos rápidos** da câmera (geral, médio, close, dois personagens), com corte seco ou movimento suave.
- **Modo simples:** lista de passos (quem, o quê, quando, duração) sobre os mesmos dados da timeline; alterna com o modo avançado sem perder nada.

### Fora desta versão

Boneco-base universal, recriação do motor de personagens, vistas de cima ou de baixo e editor 3D.

## 1.0.0

Reescrita em TypeScript estrito, com migração da 0.4. O código antigo está intacto em `legado/0.4/`.

### Correções de problemas conhecidos da 0.4

- **Dados globais:** objetos e posições eram compartilhados entre cenas. Agora cada cena tem seus próprios nós.
- **Identidade × instância:** personagem de biblioteca separado da instância, com "Editar na biblioteca" e "Sobrescrever nesta cena".
- **Rosto:** exatamente uma boca por rosto; órbita ocular de tamanho fixo com a pupila recortada dentro dela; olho distante menor em 3/4 por um fator fixo; nariz sempre para o lado da vista. Tudo coberto por testes.
- **Olhar:** Nina à esquerda olha e aponta o nariz para Zeca à direita, e vice-versa. O olhar acompanha o alvo em movimento.
- **Persistência:** de `localStorage` para IndexedDB, com vários projetos, mídia em blobs e status honesto de salvamento.
- **Exportação:** de PNG estático para vídeo real.
- **Timeline:** de blocos simples para trilhas, keyframes, clips e áudio.

### Novidades

- **Motor:** renderizador único para preview e exportação, avaliação determinística por tempo.
- **Personagens:** 8 vistas desenhadas, 30 estilos de cabelo, 24 expressões com intensidade, 14 roupas de cima, 6 de baixo, 5 sapatos, 15 acessórios, 8 formatos de cabeça, 10 narizes, 8 olhos, 8 sobrancelhas. Elenco de 12 personagens originais. Poses e edição manual do rig.
- **Cenários:** 29 ambientes desenhados, com variantes dia/noite, tons, cores e móveis como camadas.
- **Objetos:** 39 objetos, muitos com estados reais (porta, luz, tela, livro).
- **Profundidade 2D:** parallax por camada, sombras, oclusão, máscaras, desfoque, escala por profundidade.
- **Timeline:** keyframes hold/linear/suave, snap, zoom, trechos, clips com corte e ajuste, 23 ações procedurais + ações compostas, conversão de clip em keyframes.
- **Áudio:** importação, onda, volume, fades, mudo, solo, offset; lip-sync por texto, por intensidade e manual.
- **Câmera:** posição, zoom, rotação, seguir personagem, tremor.
- **Montagem:** ordem de cenas com transições (corte, fade, dissolver, cortina, deslizar).
- **Templates:** 25 de cena, 6 de projeto. Criar projeto novo, adicionar cena ou substituir a atual.
- **Biblioteca do usuário:** cenas, poses e personagens entre projetos, com importação e exportação versionada.
- **Exportação:** PNG, sequência em ZIP, WebM com áudio, MP4 quando há H.264, JSON e pacote ZIP com mídias.
- **Comandos e IA:** plano estruturado com revisão; comandos rápidos por regras; adaptadores para Ollama e endpoint próprio.
- **Interface:** layout desktop ancorado ao viewport; layout próprio para celular em retrato e paisagem; popup acima do dock; modo foco.
- **Segurança:** SVG importado passa por lista de permissão; conteúdo de projeto e de modelo é tratado só como dado.
- **Qualidade:** Vitest, Playwright, ESLint e TypeScript estrito.

### Mudanças de comportamento

- A terminologia "3D" saiu da interface.
- `dist/index.html` continua abrindo com dois cliques, como a 0.4.
- Projetos da 0.3/0.4 precisam ser exportados em JSON pela versão antiga e importados aqui. A 1.0 **não lê** o `localStorage` antigo automaticamente.

### Limitações remanescentes

Ver a seção final de [docs/ACEITACAO.md](docs/ACEITACAO.md).
