/** Capítulos do manual. Só o que existe nesta versão; imagens são capturas reais (tests/e2e/manual.spec.ts). */
import type { Chapter } from './content';

export const MANUAL_GROUPS = [
  { id: 'comecar', label: 'Começar' },
  { id: 'personagens', label: 'Personagens' },
  { id: 'mundo', label: 'Cenas, cenários e objetos' },
  { id: 'animar', label: 'Animar' },
  { id: 'som', label: 'Falas, som e legendas' },
  { id: 'arquivos', label: 'Arquivos, salvamento e exportação' },
  { id: 'mais', label: 'Celular, configurações e ajuda' },
];

export const MANUAL_CHAPTERS: Chapter[] = [
  { id: 'inicio', title: 'Manual', group: 'comecar', summary: 'Página inicial do manual.', blocks: [] },
  {
    id: 'introducao', group: 'comecar', title: 'O que é o Recorte Studio',
    summary: 'Um editor de animação 2D com personagens de recorte, que roda no navegador e funciona sem internet.',
    blocks: [
      { p: 'O Recorte Studio monta histórias animadas com personagens de recorte: você escolhe o elenco, o cenário, escreve as falas, define ações e movimentos de câmera e exporta um vídeo. Tudo acontece no seu navegador; não há servidor nem conta.' },
      { list: [
        '**Cenas** com cenário, personagens, objetos, textos e câmera própria.',
        '**Personagens** com 8 vistas (frente, perfis, 3/4 e costas), expressões, poses e lip-sync.',
        '**Timeline** em dois modos: [simples](#timeline-simples), em passos, e [avançada](#timeline-avancada), com trilhas e keyframes.',
        '**Criadores** de [personagens](#criador-personagens), [objetos](#criador-objetos) e [cenários](#criador-cenarios).',
        '**Exportação** de vídeo WebM ou MP4, imagem PNG e sequência PNG; projeto editável em [.jrec](#jrec).',
      ] },
      { tip: 'É tudo 2D: as "vistas" são desenhos diferentes do mesmo personagem, não um modelo 3D.' },
    ],
    related: ['primeiro-projeto', 'tela-inicial'],
  },
  {
    id: 'primeiro-projeto', group: 'comecar', title: 'Seu primeiro projeto',
    summary: 'Do zero a um vídeo exportado, passo a passo.',
    blocks: [
      { steps: [
        'Na tela inicial, clique em **Novo projeto** (ou abra um [modelo](#tela-inicial)).',
        'Na aba **Elenco**, toque num personagem para colocá-lo na cena. Repita para o segundo.',
        'Na aba **Cenários**, escolha um fundo pronto ou [crie o seu](#criador-cenarios).',
        'Ative o **Modo simples** na barra superior e adicione passos: quem fala, o quê e quando.',
        'Aperte **Espaço** (ou o botão de play) para assistir.',
        'Clique em **Exportar vídeo/imagem** e escolha WebM ou MP4.',
        'Clique em **Salvar projeto** para guardar um arquivo .jrec de backup.',
      ] },
      { img: 'editor.jpg', alt: 'Editor com o projeto de exemplo aberto', legend: ['Painéis da esquerda: elenco, cenários, objetos, mídias, cenas, camadas.', 'Palco: o que aparece no vídeo é o quadro exportável.', 'Propriedades do que está selecionado, em abas.', 'Timeline.', 'Modo simples ou avançado.', 'Salvar projeto (.jrec).', 'Exportar vídeo ou imagem.'] },
      { tip: 'O projeto é salvo sozinho no navegador a cada alteração. O .jrec é o seu backup e a forma de levar o projeto para outro aparelho.' },
    ],
    related: ['timeline-simples', 'exportacao', 'jrec'],
  },
  {
    id: 'tela-inicial', group: 'comecar', title: 'Tela inicial e Meus projetos',
    summary: 'Criar, abrir, buscar, organizar, arquivar e salvar projetos.',
    blocks: [
      { img: 'inicio.jpg', alt: 'Tela inicial', legend: ['Novo projeto em branco.', 'Importar um arquivo (.jrec, .json, .zip, .7z, .rar, .tar…).', 'Meus projetos: a lista completa.', 'Modelos prontos.', 'Este manual.', 'Configurações do aplicativo.'] },
      { p: 'Em **Início** ficam os projetos recentes, modelos recomendados e atalhos para o manual. Em **Meus projetos** você encontra todos, com miniatura, data, número de cenas e duração.' },
      { img: 'projetos.jpg', alt: 'Meus projetos', legend: ['Buscar pelo nome (com ou sem acento).', 'Ordenar: modificados, criados, nome ou duração.', 'Filtros: últimos 7 dias, horizontais, verticais e arquivados.', 'Salvar o projeto como .jrec sem abri-lo.', 'Abrir o projeto.'] },
      { list: [
        'Os botões de cada cartão: salvar .jrec, copiar link local, renomear, duplicar, arquivar ou desarquivar e excluir.',
        '**Arquivar** tira o projeto da lista principal sem apagar nada. Use o filtro Arquivados para ver e desarquivar.',
        '**Excluir** pede confirmação e não pode ser desfeito. Salve um .jrec antes, se tiver dúvida.',
      ] },
      { warn: 'O **link local** abre o projeto só neste navegador. Ele não serve para compartilhar com outra pessoa ou outro aparelho: para isso use o [.jrec](#jrec).' },
      { img: 'modelos.jpg', alt: 'Modelos', legend: ['Cartão de modelo: miniatura real, descrição, formato, número de cenas e duração. Toque para criar o projeto, ou use Prévia para ver todas as cenas.'], caption: 'Modelos: as miniaturas são as cenas reais de cada modelo. "Prévia" mostra todas as cenas antes de criar.' },
    ],
    related: ['jrec', 'salvamento'],
  },
  {
    id: 'editor', group: 'comecar', title: 'Conhecendo o editor',
    summary: 'Palco, painéis, propriedades e timeline.',
    blocks: [
      { p: 'O palco mostra a cena. A área fora do **quadro exportável** é só área de trabalho: o vídeo sai apenas com o que está dentro do quadro. O zoom do editor (no canto do palco) não muda o vídeo.' },
      { list: [
        'Clique num elemento para selecioná-lo; arraste para mover. **Shift+clique** seleciona vários.',
        '**Alt+arrastar** ou o zoom do palco movem a área de trabalho.',
        'As **Propriedades** mudam conforme a seleção: cena, personagem, objeto, câmera, clip ou keyframe.',
        'O ícone **?** em vários painéis abre este manual direto no assunto. **F1** abre o manual de qualquer lugar.',
      ] },
      { p: 'Manual e Configurações abrem por cima do editor: o projeto continua aberto e nada se perde. Use **Voltar ao editor**.' },
    ],
    related: ['propriedades', 'atalhos'],
  },
  {
    id: 'criador-personagens', group: 'personagens', title: 'Criador de Personagens',
    summary: 'Corpo, rosto, cabelo, roupas e acessórios, com prévia nas 8 vistas.',
    blocks: [
      { img: 'criador-personagem.jpg', alt: 'Criador de Personagens', legend: ['Abas: corpo, rosto, cabelo, roupas e acessórios.', 'Prévia do personagem em tempo real.', 'Concluir e voltar ao editor.'], caption: 'Abra pelo botão "Editar personagem da biblioteca" nas propriedades do personagem, ou criando um personagem novo no Elenco.' },
      { list: [
        '**Corpo:** altura, idade, constituição, comprimento dos braços, barriga e tom de pele.',
        '**Rosto:** 8 formatos de cabeça, 8 olhos, 8 sobrancelhas, 10 narizes.',
        '**Cabelo:** 30 estilos, cor e brilho. Os penteados respeitam as 8 vistas.',
        '**Roupas:** 14 partes de cima, 6 de baixo, 5 sapatos, com cores próprias.',
        '**Acessórios:** 15, como óculos, brincos, relógio e chapéus.',
      ] },
      { p: 'Editar o personagem da biblioteca muda todas as cenas em que ele aparece. Para mudar só numa cena, use **Sobrescrever nesta cena** (cor do cabelo e da roupa) nas propriedades.' },
      { tip: 'Um personagem colocado num [cenário criado por você](#criador-cenarios) é uma cópia congelada: editar o elenco não altera o cenário.' },
    ],
    related: ['vistas', 'propriedades'],
  },
  {
    id: 'vistas', group: 'personagens', title: 'As 8 vistas',
    summary: 'Frente, 3/4, perfis e costas: automáticas ou escolhidas.',
    blocks: [
      { p: 'Cada personagem tem 8 vistas desenhadas: frente, 3/4 frente (dos dois lados), perfil (dos dois lados), 3/4 costas (dos dois lados) e costas. Trocar de vista é um corte, como num desenho animado de recorte.' },
      { img: 'rosto.jpg', alt: 'Aba Rosto', legend: ['Orientação e olhar: vistas do corpo e da cabeça, olhar e piscar (toque para abrir).', 'Expressão.'] },
      { list: [
        '**Automática:** o personagem se vira para o alvo do olhar ou para a direção em que anda.',
        '**Vista do corpo** e **vista da cabeça** podem ser diferentes (corpo de perfil, cabeça de frente).',
        'As vistas podem ser animadas com keyframes.',
      ] },
    ],
    related: ['propriedades', 'keyframes'],
  },
  {
    id: 'propriedades', group: 'personagens', title: 'Propriedades em abas',
    summary: 'Cada tipo de seleção tem suas abas; a última aba usada é lembrada.',
    blocks: [
      { img: 'propriedades.jpg', alt: 'Abas do personagem', legend: ['As abas mudam conforme o que está selecionado.', 'Transformar: posição, escala, rotação, opacidade e pivô.', 'Rosto: vistas, olhar, piscar, expressão e boca.', 'Pose: movimento natural, profundidade dos braços, pose e rig.', 'Animar: falas, ações e sequências.'] },
      { table: [
        ['Seleção', 'Abas'],
        ['Personagem', 'Transformar, Rosto, Pose, Animar, Camadas'],
        ['Objeto, texto, forma, luz', 'Transformar, Aparência, Camadas'],
        ['Imagem', 'Transformar, Imagem, Camadas'],
        ['Câmera', 'Enquadramento, Movimento, Seguir'],
        ['Cena (nada selecionado)', 'Cena, Cenário, Visual, Transições'],
        ['Fala', 'Texto, Balão, Boca'],
        ['Áudio', 'Tempo, Som, Sincronização'],
      ] },
      { p: 'Campos com o ícone de keyframe podem ser animados: com a propriedade já animada, mudar o valor grava um keyframe no tempo atual. Veja [Keyframes](#keyframes).' },
      { tip: 'No teclado, as setas esquerda/direita trocam de aba quando uma aba está em foco.' },
    ],
    related: ['poses', 'camadas', 'keyframes'],
  },
  {
    id: 'poses', group: 'personagens', title: 'Poses, braços e movimento natural',
    summary: 'Poses prontas, rig, mãos, profundidade dos braços e movimentos automáticos sutis.',
    blocks: [
      { img: 'pose.jpg', alt: 'Aba Pose', legend: ['Braços e mãos: na frente ou atrás da cabeça (esquerdo e direito são os lados do personagem).', 'Pose e rig: pose pronta e ajuste de cada articulação.'] },
      { p: '**Poses prontas** ajustam braços, pernas e mãos de uma vez (em pé, vitória, acenando, braços cruzados, mãos no rosto, mãos atrás da cabeça, sentado e outras). Depois, cada articulação do **rig** pode ser ajustada e animada.' },
      { h: 'Frente ou atrás da cabeça' },
      { p: 'Braço esquerdo, mão esquerda, braço direito e mão direita têm cada um: **Automático**, **Na frente da cabeça** ou **Atrás da cabeça**. Esquerdo e direito são os lados do personagem, não da tela.' },
      { list: [
        'No automático, um braço que cruza a cabeça (vitória, mão no rosto, aceno alto) passa na frente dela; de costas, a cabeça fica na frente.',
        'Braço e mão podem ser diferentes: por exemplo, braço atrás e mão na frente do rosto.',
        'A profundidade pode ser animada com keyframes.',
        'A pose **Mãos atrás da cabeça** já deixa braços e mãos atrás.',
      ] },
      { h: 'Movimento natural' },
      { p: 'Respiração, pequenos movimentos de cabeça, olhares rápidos, piscadas e trocas de postura, sempre sutis e iguais na prévia e no vídeo. Diminuem sozinhos durante uma ação. Cada um tem intensidade própria.' },
    ],
    related: ['animar', 'keyframes'],
  },
  {
    id: 'cenas', group: 'mundo', title: 'Cenas',
    summary: 'Criar, ordenar, duplicar e ligar cenas com transições.',
    blocks: [
      { img: 'cenas.jpg', alt: 'Painel de cenas', legend: ['Uma cena: miniatura, duração e número de ações. A cena aberta fica destacada.'], caption: 'Cada cena tem miniatura, duração e número de ações. O menu "…" ou o toque longo mostram duplicar, mover e excluir.' },
      { list: [
        'Cada cena tem seus próprios elementos, posições, câmera e duração.',
        'Na aba **Cena** das propriedades (sem nada selecionado): nome, duração e anotações.',
        'Na aba **Transições**: entrada (corte, fade, deslizar e outras) e saída com fade, com duração.',
        'Reproduzir o **projeto completo** toca todas as cenas na ordem, com as transições.',
      ] },
      { tip: 'Em projetos muito grandes, desligar as miniaturas em [Configurações → Desempenho](#configuracoes) abre o painel mais rápido.' },
    ],
    related: ['cenarios', 'camadas'],
  },
  {
    id: 'cenarios', group: 'mundo', title: 'Cenários',
    summary: 'Cenários prontos, cenários por imagem e cenários do Criador de Cenários, com horários.',
    blocks: [
      { img: 'cenarios.jpg', alt: 'Painel de cenários', legend: ['Criar um cenário no Criador de Cenários.', 'Criar um cenário a partir de imagens.'] },
      { list: [
        '**Prontos:** salas, cozinha, escola, rua, parque e outros, com variante dia/noite, tom e cores ajustáveis (aba Visual).',
        '**Meus cenários:** podem ter os horários Manhã, Dia, Tarde, Entardecer e Noite. Cada horário é opcional.',
        'Na aba **Cenário** da cena, escolha o cenário e o horário. Se o horário não existir, o mais próximo é usado com um aviso.',
      ] },
      { p: 'Parallax, desfoque, transparência (para PNG com fundo transparente) e perspectiva falsa ficam na aba **Visual**.' },
    ],
    related: ['criador-cenarios', 'cenas'],
  },
  {
    id: 'criador-cenarios', group: 'mundo', title: 'Criador de Cenários',
    summary: 'Monte cenários com formas, imagens, objetos e personagens estáticos, um por horário.',
    blocks: [
      { img: 'criador-cenarios-inicio.jpg', alt: 'Começar um horário', legend: ['Os 5 horários; cada um é opcional.', 'Começar com a tela vazia.', 'Começar de um modelo (Rua, Sala simples, Parque).'] },
      { p: 'Cada horário começa de onde você quiser: tela vazia, imagem importada, imagem já cadastrada, cópia de outro horário (editável e independente), modelo, cenário pronto ou composição salva na biblioteca.' },
      { img: 'criador-cenarios.jpg', alt: 'Criador de Cenários', legend: ['Horários: troque para criar composições diferentes, não só filtros.', 'Prévia: o retângulo tracejado é o quadro 16:9.', 'Adicionar: formas, estrutura (parede, piso, grama…), imagens, objetos e personagens.', 'Propriedades da peça selecionada.', 'Usar nesta cena.'] },
      { steps: [
        'Em **Cenários**, clique em **Criar no estúdio** e dê um nome.',
        'Escolha como começar o horário **Dia**.',
        'Adicione peças. Ajuste posição, tamanho, rotação, opacidade e cores com os campos (ou arraste na prévia).',
        'Em **Camadas**: ordenar, agrupar, duplicar, ocultar, renomear e excluir.',
        'Troque para **Noite** e use **Copiar de Dia** para começar a versão noturna; mude o céu, acenda o poste, troque peças.',
        'Clique em **Usar nesta cena**.',
      ] },
      { h: 'Personagens estáticos' },
      { p: 'Personagens adicionados no Criador de Cenários fazem parte do fundo: têm vista, expressão, pose, posição, escala e camada próprias, mas **não** recebem falas, ações nem keyframes na timeline. A aparência é uma cópia congelada; o botão **Atualizar aparência pelo elenco** copia de novo, se você quiser.' },
      { tip: 'Para uma plateia ou multidão, use personagens estáticos: o cenário é desenhado uma vez e reaproveitado, sem pesar na reprodução.' },
      { p: '**Biblioteca** salva o cenário (todos os horários e imagens) para usar em outros projetos deste navegador. O .jrec leva tudo.' },
    ],
    related: ['cenarios', 'criador-objetos', 'bibliotecas'],
  },
  {
    id: 'objetos', group: 'mundo', title: 'Objetos, textos, formas e imagens',
    summary: 'Quase 40 objetos prontos, textos, formas, luzes e imagens importadas.',
    blocks: [
      { img: 'objetos.jpg', alt: 'Painel de objetos', legend: ['Criar um objeto no Criador de Objetos.'] },
      { list: [
        'Objetos prontos por categoria (móveis, casa, eletrônicos, objetos de mão, veículos, trabalho, natureza), com cores e estados (ligado/desligado, aberto/fechado).',
        'Objetos de mão podem ser **segurados** por um personagem (aba Aparência → Segurado por).',
        'Texto, forma, luz ou sombra 2D e imagem (PNG, JPEG, WebP, GIF, SVG). SVGs são limpos de scripts por segurança.',
      ] },
    ],
    related: ['criador-objetos', 'camadas'],
  },
  {
    id: 'criador-objetos', group: 'mundo', title: 'Criador de Objetos',
    summary: 'Crie objetos com formas, contornos, imagens e outros objetos, e reutilize em cenas e cenários.',
    blocks: [
      { img: 'criador-objetos.jpg', alt: 'Criador de Objetos', legend: ['Tamanho e pivô do objeto.', 'Prévia: a caixa tracejada é o objeto; a base fica na linha do chão.', 'Adicionar peças.', 'Camadas: ordem, agrupar, desagrupar, duplicar, excluir.', 'Inserir na cena.'] },
      { list: [
        'Peças: retângulo, elipse, triângulo, polígono, estrela, linha, imagem SVG/PNG/JPEG/WebP, objetos prontos e outros objetos seus.',
        'Cada peça: posição, tamanho, rotação, espelhar, virar, opacidade, preenchimento, contorno e cantos.',
        'O **pivô** é o ponto de giro e de escala quando o objeto está na cena.',
        'Na cena, o objeto se comporta como os prontos: posição, escala, rotação, opacidade, camadas e keyframes.',
        'Dentro de um cenário, ele vira uma peça estática daquele cenário.',
        'Editar o objeto atualiza todas as cópias. Excluir avisa quantas vezes ele está em uso.',
      ] },
      { tip: 'Ctrl+Z desfaz também dentro dos criadores.' },
    ],
    related: ['objetos', 'criador-cenarios', 'bibliotecas'],
  },
  {
    id: 'camadas', group: 'mundo', title: 'Camadas',
    summary: 'Ordem, visibilidade, bloqueio, sombra, máscara e profundidade.',
    blocks: [
      { img: 'camadas.jpg', alt: 'Painel de camadas', legend: ['Uma camada: visibilidade, bloqueio, ordem e exclusão.'], caption: 'O que está mais acima na lista aparece na frente.' },
      { list: [
        'Use Subir, Descer, Topo e Fundo na aba **Camadas** das propriedades.',
        'Ocultar, bloquear (não move no palco) e renomear.',
        'Sombra no chão, máscara 2D (retângulo ou elipse), parallax e desfoque.',
        '**Escala pela profundidade**: com a perspectiva falsa da cena ligada, o elemento cresce ao descer no palco.',
      ] },
    ],
    related: ['propriedades'],
  },
  {
    id: 'timeline-simples', group: 'animar', title: 'Timeline simples (passos)',
    summary: 'A história como uma lista: quem, o quê, quando e por quanto tempo.',
    blocks: [
      { img: 'timeline-simples.jpg', alt: 'Modo simples', legend: ['Quem executa.', 'O quê: falar, uma ação ou um enquadramento de câmera.', 'Quando começa, em segundos.', 'Adicionar o passo.'] },
      { p: 'O modo simples e o avançado mostram **os mesmos dados**: alternar não perde nada. Cada passo vira um clip na timeline avançada.' },
      { list: [
        'Início e duração aceitam vírgula ou ponto (1,5 ou 1.5).',
        'Início negativo, duração zero ou valores inválidos são recusados com uma mensagem clara.',
        'Edite início e duração direto na lista; o lixo exclui o passo. Ctrl+Z desfaz.',
        'No celular o modo simples é o padrão (ajustável em [Configurações](#configuracoes)).',
      ] },
    ],
    related: ['timeline-avancada', 'animar'],
  },
  {
    id: 'timeline-avancada', group: 'animar', title: 'Timeline avançada',
    summary: 'Trilhas, clips, keyframes, áudio e efeitos.',
    blocks: [
      { img: 'timeline-avancada.jpg', alt: 'Timeline avançada', legend: ['Áudio: importar e já colocar na trilha certa.', 'Adicionar legenda ou efeito.', 'Clip de áudio com a forma de onda.'] },
      { list: [
        'Arraste clips e keyframes; as bordas do clip mudam a duração.',
        'Encaixe automático no cursor, em outros clips e em segundos inteiros (desligável).',
        'Ctrl+roda do mouse dá zoom; no celular, use os botões de zoom.',
        'Selecionar um clip mostra as propriedades dele (tempo, intensidade, velocidade, transição…).',
      ] },
    ],
    related: ['keyframes', 'animar', 'audio'],
  },
  {
    id: 'animar', group: 'animar', title: 'Ações, falas e sequências',
    summary: 'Ações prontas, transições suaves, falas e sequências reutilizáveis.',
    blocks: [
      { p: 'Na aba **Animar** do personagem: escreva uma fala ou escolha uma ação (andar ou correr até um ponto, entrar e sair de cena, virar, olhar, abrir porta e outras) e insira no tempo atual.' },
      { list: [
        'Clip de ação: intensidade, velocidade, braço usado e **Transição** (entrada e saída suaves, em ms).',
        '**Converter em keyframes** transforma o clip em keyframes editáveis.',
        '**Salvar sequência** guarda as ações e falas do personagem na biblioteca; aplique em qualquer personagem pela aba Biblioteca, a partir do tempo atual.',
      ] },
    ],
    related: ['timeline-simples', 'keyframes'],
  },
  {
    id: 'keyframes', group: 'animar', title: 'Keyframes',
    summary: 'Animar qualquer propriedade ao longo do tempo.',
    blocks: [
      { steps: [
        'Leve o cursor ao tempo desejado.',
        'Clique no losango ao lado da propriedade (ou **K** para posição).',
        'Mude o tempo e o valor: com a propriedade animada, cada mudança grava um keyframe.',
      ] },
      { list: [
        'Interpolação até o próximo: **Segurar** (degrau), **Linear** ou **Suave**.',
        'Ctrl+C / Ctrl+V copiam e colam keyframes.',
        'Selecionar um keyframe mostra tempo, valor e interpolação.',
      ] },
    ],
    related: ['timeline-avancada', 'camera'],
  },
  {
    id: 'camera', group: 'animar', title: 'Câmera',
    summary: 'Enquadramento, movimentos prontos e seguir personagem.',
    blocks: [
      { img: 'camera.jpg', alt: 'Propriedades da câmera', legend: ['Botão da câmera, no palco (no celular: Câmera, no dock).', 'Enquadramento: X, Y, zoom e rotação (animáveis).', 'Movimento: enquadramentos prontos.', 'Seguir um personagem.'] },
      { list: [
        '**Enquadramentos prontos:** geral, médio, close e dois personagens. **Corte seco** no tempo atual ou **movimento suave** de 1,2 s.',
        '**Seguir:** a câmera acompanha um personagem, com força e suavização.',
        'A câmera muda o vídeo exportado. O zoom do editor, não.',
      ] },
    ],
    related: ['keyframes'],
  },
  {
    id: 'falas', group: 'som', title: 'Falas e balões',
    summary: 'Texto, estilo e posição do balão.',
    blocks: [
      { p: 'Selecione um clip de fala para ver as abas **Texto** (tempo, texto, mostrar como legenda), **Balão** (estilo, tamanho, posição) e **Boca** ([lip-sync](#lip-sync)).' },
      { list: [
        'Palavras longas quebram com hífen e o texto diminui para caber no quadro.',
        'O balão aponta para o personagem que fala e acompanha o movimento.',
      ] },
    ],
    related: ['lip-sync', 'legendas'],
  },
  {
    id: 'audio', group: 'som', title: 'Áudio, música e efeitos',
    summary: 'Biblioteca de áudio por categoria, trilhas, volume e fades.',
    blocks: [
      { img: 'midias.jpg', alt: 'Aba Mídias', legend: ['Categoria: Voz, Música, Efeitos sonoros ou Ambiente.', 'Importar áudio para a biblioteca do projeto.', 'Usar na cena: vai para a trilha da categoria, no tempo do cursor.'] },
      { list: [
        'Formatos: WAV, MP3, OGG, M4A/AAC, WebM e FLAC (o que o navegador decodificar).',
        'O mesmo arquivo importado duas vezes é reaproveitado, sem cópia.',
        'Ouvir, renomear, substituir o arquivo (mantendo os usos), remover (avisa os usos; Ctrl+Z desfaz) e guardar na sua biblioteca para outros projetos.',
        'Clip de áudio: volume, fade in/out e corte no início (aba **Som**).',
        'O volume do editor (Configurações → Áudio) não muda o vídeo exportado.',
      ] },
    ],
    related: ['lip-sync', 'midia-ausente'],
  },
  {
    id: 'lip-sync', group: 'som', title: 'Lip-sync (boca)',
    summary: 'Pelo texto, pela intensidade do áudio ou manual.',
    blocks: [
      { table: [
        ['Modo', 'Como funciona'],
        ['Pelo texto', 'Estima formas de boca a partir das letras da fala. Não precisa de áudio.'],
        ['Pela intensidade do áudio', 'A boca abre conforme o volume do áudio vinculado. Não reconhece fonemas.'],
        ['Manual', 'Você anima a forma da boca (visema) com keyframes.'],
        ['Desligada', 'A boca segue só a expressão.'],
      ] },
      { p: 'Para a intensidade: no clip de áudio, aba **Sincronização**, escolha o personagem em "Boca de".' },
    ],
    related: ['falas', 'audio'],
  },
  {
    id: 'legendas', group: 'som', title: 'Legendas',
    summary: 'Clips de legenda e falas mostradas como legenda.',
    blocks: [
      { list: [
        'Timeline → **+** → Legenda: texto, posição (embaixo, centro, em cima), tamanho, cor e fundo escuro.',
        'Uma fala com **Mostrar como legenda** aparece também como legenda.',
      ] },
    ],
    related: ['falas'],
  },
  {
    id: 'bibliotecas', group: 'arquivos', title: 'Bibliotecas',
    summary: 'Guardar personagens, poses, cenas, cenários, objetos, sequências e áudios para outros projetos.',
    blocks: [
      { p: 'A **Minha biblioteca** fica neste navegador e é compartilhada por todos os projetos dele. Itens com mídia levam a referência do arquivo, sem duplicar.' },
      { list: [
        'Personagens, poses, cenas e sequências: aba **Biblioteca**.',
        'Áudios: aba **Mídias** (botão de marcador).',
        'Objetos: Criador de Objetos → Biblioteca; aparecem em Objetos → Meus objetos → Da minha biblioteca.',
        'Cenários: Criador de Cenários → Biblioteca; aparecem em Cenários → Meus cenários.',
      ] },
      { warn: 'A biblioteca não vai junto num .jrec. O .jrec leva o que o projeto usa.' },
    ],
    related: ['jrec'],
  },
  {
    id: 'jrec', group: 'arquivos', title: 'Arquivos .jrec',
    summary: 'O formato do projeto editável: completo, portátil e verificado.',
    blocks: [
      { p: '**Salvar projeto** baixa um arquivo .jrec com tudo: cenas, personagens, cenários (com horários e composições), objetos, timeline e todas as mídias. É o único formato de projeto editável.' },
      { list: [
        'É um ZIP com um manifest versionado, o project.json e as mídias em binário.',
        'Cada mídia tem tamanho e SHA-256 conferidos ao importar; arquivo adulterado é recusado.',
        'Antes de dizer "salvo", o arquivo é relido e verificado.',
        'Importar sempre cria um projeto novo; o original não é alterado.',
        'Também importa projetos .json e .zip de versões antigas e pacotes .7z, .rar, .tar, .tar.gz, .tar.xz e .tar.bz2.',
      ] },
      { warn: 'Se faltar alguma mídia, o salvamento para e oferece **Abrir Mídias** para revincular, ou **Salvar incompleto** (o arquivo ganha "-incompleto" no nome e a lista do que falta).' },
    ],
    related: ['salvamento', 'midia-ausente'],
  },
  {
    id: 'salvamento', group: 'arquivos', title: 'Salvamento e backups',
    summary: 'Onde os projetos ficam e como não perdê-los.',
    blocks: [
      { list: [
        'Cada alteração é salva sozinha no IndexedDB do navegador, segundos depois. O indicador na barra superior mostra o estado.',
        'Se o salvamento falhar, o app tenta de novo com espera crescente e avisa uma vez.',
        'Limpar os dados do site, janela anônima ou outro navegador: os projetos não estão lá. Faça backups em .jrec.',
        'Configurações → Armazenamento mostra o espaço usado e limpa, com segurança, mídias sem uso e cópias antigas.',
      ] },
      { img: 'configuracoes.jpg', alt: 'Configurações', legend: ['Geral.', 'Aparência.', 'Armazenamento.', 'Voltar ao editor.'] },
    ],
    related: ['jrec', 'configuracoes'],
  },
  {
    id: 'exportacao', group: 'arquivos', title: 'Exportar vídeo e imagens',
    summary: 'WebM, MP4, PNG e sequência PNG.',
    blocks: [
      { img: 'exportar.jpg', alt: 'Exportar', legend: ['Tipo: vídeo, imagem PNG do quadro atual ou sequência PNG (em ZIP).', 'Exportar.'] },
      { list: [
        'Com WebCodecs (Chrome, Edge), o vídeo é renderizado quadro a quadro, com áudio mixado, mais rápido que o tempo real.',
        'Sem WebCodecs, grava em tempo real (WebM) com sincronia aproximada; o diálogo avisa.',
        'MP4 só aparece se o navegador tiver o codificador.',
        'Sai só o quadro exportável, igual à prévia. Guias, seleção e zoom do editor não aparecem.',
        'Cancelar interrompe sem baixar nada.',
      ] },
    ],
    related: ['jrec'],
  },
  {
    id: 'offline', group: 'arquivos', title: 'Funcionamento offline',
    summary: 'Instale o app e use sem internet.',
    blocks: [
      { list: [
        'Aberto pelo site (ou instalado como app), o Recorte Studio guarda os próprios arquivos e funciona sem internet, inclusive o manual e a leitura de .7z/.rar.',
        'Quando sai uma versão nova, aparece um aviso com **Recarregar**. Nada recarrega sozinho.',
        'Aberto direto do disco (file://), funciona, mas sem instalação offline e sem .7z/.rar/.tar.xz/.tar.bz2.',
      ] },
    ],
    related: ['problemas'],
  },
  {
    id: 'celular', group: 'mais', title: 'Usando no celular',
    summary: 'Prévia em cima, ferramentas embaixo, passos simples.',
    blocks: [
      { img: 'celular.jpg', alt: 'Editor no celular', legend: ['Barra rápida do personagem selecionado.', 'Modo simples ou avançado.', 'Salvar projeto (.jrec).', 'Dock: Cenas, Elenco, Cenários, Áudio.', 'Câmera.', 'Mais: objetos, camadas, modelos de cena, biblioteca, direção.'] },
      { list: [
        'Toque num personagem: a barra rápida leva a Mover, Expressão, Olhar, Pose, Falar, Ações e Aparência.',
        'Os painéis abrem por baixo, com botão para expandir. O botão de foco mostra só o palco.',
        'O menu **⋯** da barra superior tem link local, configurações, manual e importar.',
        'Os criadores mostram a prévia em cima e as ferramentas em abas embaixo.',
        'O projeto é o mesmo do computador: o .jrec abre nos dois.',
      ] },
      { img: 'celular-pose.jpg', alt: 'Aba Pose no celular', legend: ['Painel de propriedades com abas roláveis.'] },
    ],
    related: ['timeline-simples'],
  },
  {
    id: 'configuracoes', group: 'mais', title: 'Configurações',
    summary: 'Preferências do aplicativo, válidas para todos os projetos deste navegador.',
    blocks: [
      { table: [
        ['Categoria', 'O que tem'],
        ['Geral', 'Começar na tela inicial ou no último projeto; modo da timeline ao abrir; restaurar padrões.'],
        ['Aparência', 'Tema escuro, claro ou do sistema; tamanho do texto; reduzir animações da interface.'],
        ['Editor', 'Grade, margens seguras, réguas, quadriculado, setas de olhar, encaixes e zoom da timeline.'],
        ['Áudio', 'Volume e silenciar o editor (não afeta o vídeo).'],
        ['Desempenho', 'Limite de FPS da prévia e miniaturas das cenas.'],
        ['Armazenamento', 'Espaço usado e disponível, limpeza segura e orientações de backup.'],
        ['Atalhos', 'Lista com busca, por categoria.'],
        ['Sobre', 'Versão, formato .jrec, licenças e novidades.'],
      ] },
      { p: 'Formato, tamanho e FPS de cada projeto ficam em **Configurações do projeto** (ícone de engrenagem no editor).' },
    ],
    related: ['atalhos'],
  },
  {
    id: 'atalhos', group: 'mais', title: 'Atalhos de teclado',
    summary: 'Todos os atalhos do editor.',
    blocks: [{ shortcuts: true }],
    related: ['configuracoes'],
  },
  {
    id: 'midia-ausente', group: 'mais', title: 'Mídia ausente',
    summary: 'Quando uma imagem ou um áudio não está neste navegador.',
    blocks: [
      { p: 'Acontece ao importar um .jrec marcado como incompleto, ou se os dados do site foram limpos em parte. A aba **Mídias** mostra o aviso e cada item ausente.' },
      { steps: ['Abra **Mídias**.', 'No item ausente, clique em **Revincular** e escolha o arquivo.', 'O item volta na hora, em todos os usos.'] },
    ],
    related: ['jrec', 'audio'],
  },
  {
    id: 'problemas', group: 'mais', title: 'Solução de problemas',
    summary: 'O que fazer quando algo não sai como esperado.',
    blocks: [
      { table: [
        ['Problema', 'O que fazer'],
        ['Meus projetos sumiram', 'Confira se é o mesmo navegador e endereço. Se os dados do site foram limpos, importe o último .jrec.'],
        ['"Mídia ausente" ao salvar', 'Revincule em Mídias ou salve incompleto. Veja [Mídia ausente](#midia-ausente).'],
        ['Não aparece MP4', 'O navegador não tem o codificador. Use WebM ou outro navegador (Chrome, Edge).'],
        ['Áudio não toca no editor', 'Veja se o editor não está silenciado (Configurações → Áudio) e se o clip tem volume.'],
        ['.7z ou .rar não abre', 'Abra o app pelo site ou instalado (não por file://). Arquivo com senha: descompacte antes.'],
        ['Reprodução lenta', 'Configurações → Desempenho: limite de 30 ou 24 fps e desligue as miniaturas das cenas. O vídeo exportado não muda.'],
        ['Armazenamento cheio', 'Configurações → Armazenamento: remova mídias sem uso e cópias antigas; salve .jrec e exclua projetos antigos.'],
        ['Apareceu "versão nova"', 'Clique em Recarregar quando quiser. O projeto está salvo.'],
      ] },
    ],
    related: ['salvamento', 'offline'],
  },
  {
    id: 'glossario', group: 'mais', title: 'Glossário',
    summary: 'Termos usados no Recorte Studio.',
    blocks: [
      { glossary: [
        ['Clip', 'Um bloco na timeline: ação, fala, áudio, legenda ou efeito, com início e duração.'],
        ['Keyframe', 'Um valor gravado num instante; entre dois keyframes o valor é interpolado.'],
        ['Rig', 'As articulações do personagem (braços, pernas, tronco, cabeça).'],
        ['Visema', 'Forma da boca usada no lip-sync.'],
        ['Quadro exportável', 'A área do palco que sai no vídeo.'],
        ['Composição', 'O desenho editável de um horário no Criador de Cenários.'],
        ['Peça', 'Um elemento dentro de um objeto ou de uma composição.'],
        ['Pivô', 'O ponto em torno do qual um elemento gira e muda de escala.'],
        ['.jrec', 'O arquivo do projeto editável, com todas as mídias.'],
      ] },
    ],
  },
  {
    id: 'novidades', group: 'mais', title: 'Novidades da versão 1.2',
    summary: 'O que mudou nesta versão.',
    blocks: [
      { list: [
        'Tela inicial nova, com Meus projetos, Modelos, Manual e Configurações.',
        'Configurações do aplicativo por categoria (tema claro, tamanho do texto, desempenho, armazenamento…).',
        'Este manual, com busca e ajuda contextual (F1 e ícones ?).',
        'Propriedades em abas.',
        '[Criador de Objetos](#criador-objetos) e [Criador de Cenários](#criador-cenarios), com personagens estáticos e horários.',
        '[Braços e mãos](#poses) na frente ou atrás da cabeça, automático e manual.',
        'Cabelos longos corretos de perfil e de costas.',
        'Interface própria para celular.',
        'Importação real de .7z e .rar também offline; mensagens claras para arquivos com senha ou corrompidos.',
      ] },
    ],
  },
];
