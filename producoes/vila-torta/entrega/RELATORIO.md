# Vila Torta · T1E1 · "Políticos de Estimação" — relatório de produção

**Entrega principal:** `Vila-Torta-T1E1-Politicos-de-Estimacao.jrec` (formato nativo `recorte-studio-project` v1, 166 KB).
Nada de MP4/WebM/HTML independente foi gerado; não houve deploy; a `main` não foi tocada (trabalho na branch `claude/vila-torta-t1e1-producao-a3k6yr`, em pasta nova `producoes/vila-torta/`, sem alterar nenhum arquivo do app).

## Números reais

| Item | Valor |
|---|---|
| Duração total | **11 min 29 s** (689,2 s), 16:9, 1920×1080, 30 fps |
| Sequências | 11 (roteiro na ordem original; abertura inserida após a sequência 1) |
| Cenas (= tomadas) | **145** (uma cena nativa por tomada; durações variadas: de 0.7 s a 11.9 s, 65 valores distintos) |
| Cortes / transições | 144 cortes secos (tomadas encadeadas; corte seco para preto no fim) |
| Movimentos de câmera animados | 89 (panorâmicas, travellings, zooms, trepidação) · 124 enquadramentos iniciais distintos |
| Personagens | 23 = **7 oficiais** (inalterados) + 16 secundários originais |
| Objetos nativos (Criador de Objetos) | 35 · Cenários personalizados (Criador de Cenários): 5 · Cenários nativos usados: 7 |
| Keyframes / clips de ação / clips de fala | 1.683 / 131 / 141 |
| Mídia binária | **0** (tudo é vetor nativo e editável; o manifesto lista 0 mídias e 0 faltantes) |

Distribuição por sequência (tomadas · duração): S1 22 · 77,8 s | S2 abertura 8 · 10,2 s | S3 pátio 23 · 105,2 s | S4 torcidas 13 · 67,2 s | S5 camarins 10 · 42,9 s | S6 debate 22 · 124,6 s | S7 gráfica 11 · 57,1 s | S8 eleição 7 · 44,2 s | S9 apuração 10 · 55,9 s | S10 vitória 8 · 50,5 s | S11 pós-créditos 11 · 53,6 s.

## O que foi feito, por etapa

- **A · Preparação.** Lido o schema, as ações, os objetos e a montagem do Recorte Studio; os 7 `.biblioteca.json` inspecionados.
- **B · Personagens e cenários.** Os 7 arquivos oficiais entram **campo a campo idênticos** (`CharacterDefinitionSchema.parse` do próprio app; comparação JSON byte a byte no teste). Objetos: carro (carroceria, 2 molas de suspensão, 2 rodas separadas), buraco, caminhão da prefeitura, placa final, púlpitos, bancada, painel do debate, TV (+ tela do debate animada), cartazes, bandeiras (animadas), panfletos (o do Pinote com cachorro), garrafa térmica do Samuca, bola de vôlei da Larissa, coreto, barraca de café, carrinho do vendedor, palanque, máquina de impressão (animada), cabines/urna, etc. Portas: usada a porta nativa do app.
- **C · Abertura da história (S1/S2).** Carro anda de verdade: grupo de nós, rotação das rodas = distância/raio (871° num plano), mola da suspensão estica/comprime, carroceria cabeceia, poeira e "CRAC!"; a roda dianteira se solta, rola 1.290 px e o carro cai de nariz. Vinheta de 10,2 s: cidade, escola, 5 cartões dos protagonistas e título com letras tortas.
- **D · Restante.** Sequências 3–11 com campo/contracampo, over-the-shoulder, closes, planos de reação, detalhes de objetos, travellings e pausas cômicas. Debate (22 tomadas) intercalado com a sala (9 tomadas), Gaivota sempre à esquerda do quadro e Pinote à direita. Apuração com gráfico animado (barras crescem, Pinote passa na frente aos 91 %, Gaivota fecha em 50,8 % × 49,2 %).
- **E · Revisão.** As 145 tomadas foram renderizadas e revistas em folhas de contato; corrigidos: oclusão de rosto em closes (o falante agora vai à frente), zoom excessivo, placa visível antes da hora (agora fica embrulhada até um funcionário rasgar o papel), pose que cobria o rosto do Pinote, balões longos (agora divididos em dois), tempo de leitura (máx. 16,9 caracteres/s; média 13,1).
- **F · Exportação e validação.** Ver abaixo.

## Validação (resultados reais)

**Automática, no código do próprio Recorte Studio** (`entrega/validacao.json`; reimportação com `parseEntries`/`commitParsedProject` do app, zod do schema, motor de avaliação e renderizador):

| # | Teste | Resultado |
|---|---|---|
| 1–2 | 7 oficiais presentes e idênticos aos arquivos recebidos (aparência, cores, acessórios, anotações) | OK |
| 3 | Continuam articulados (rig nativo; nenhum sprite achatado; 30 trilhas de rig animadas) | OK |
| 4 | Falas conforme personalidade (141 clips de fala) | OK — revisão minha, ver "limitações" |
| 5 | Samuca nunca fala palavrão (15 falas dele checadas por padrão de palavrões) | OK |
| 6 | Bia não confessa sentimento pelo Caíque (21 falas) | OK |
| 7 | Segredo do Samuca sobre a Larissa não é revelado | OK |
| 8 | Câmera muda de verdade | OK (124 enquadramentos; 89 movimentos) |
| 9 | Carro anda (Δx 729 px, rodas 871°), impacto mexe carroceria (0° → 7° → −4°), roda se solta (Δx 1.290 px) | OK |
| 10 | Debate com cortes e reações | OK (22 tomadas, 9 na sala) |
| 11 | Gaivota vence (50,8 % × 49,2 %, "GAIVOTA REELEITO") | OK |
| 12 | Placa só no pós-créditos, embrulhada até ser instalada; revelada depois | OK (1ª aparição na tomada 138/145) |
| 13–14 | Importa sem erros/avisos; nenhuma mídia faltando | OK |
| 15 | Continua editável (1.683 keyframes, 131 clips de ação, 35 objetos) | OK |
| 16 | Ida e volta (exportar → importar) idêntica | OK |
| 17 | 145 tomadas, 435 quadros amostrados, 11 sequências, 0 NaN/undefined | OK |

**No Recorte Studio real** (build de produção do repositório servido localmente, Chromium; `entrega/validacao-app-real.json` + `entrega/evidencias/*.png`): importação do `.jrec` pela interface → editor abre com o título certo → painel Cenas mostra **145** → botão Reproduzir entra em "Reproduzindo" → navegação por cenas → camadas/timeline editáveis (personagens, grupos, objetos, trilhas de câmera) → autosave "Salvo" → **Salvar projeto** baixa um `.jrec` de 169 KB → recarregar a página reabre o projeto → lista "Meus projetos" → o `.jrec` salvo pelo app abre em um navegador limpo com as 145 cenas; **0 erros de console**.

## Correção posterior

Ao produzir o T1E2 encontrei um defeito no meu gerador: a ação nativa "andar" sobrescrevia o keyframe final de X, então todas as caminhadas do T1E1 paravam 300 px depois do ponto de partida. Corrigido e o `.jrec` foi regerado e revalidado (mesmos números; caminhadas agora percorrem o trajeto previsto).

## Limitações honestas

1. **Sem áudio.** Não há dublagem, música nem efeitos (não havia fonte licenciada e não inventei vozes). Todas as falas estão como balões legíveis, com tempo calculado para leitura, e **prontas para dublagem**: cada fala é um clip de diálogo na trilha do personagem, listada também nas notas de cada cena e em `entrega/roteiro-de-falas-para-dublagem.csv`.
2. **Não assisti aos 11 minutos em tempo real.** A reprodução foi verificada no app (entra e sai de "Reproduzindo", cenas navegadas, 435 quadros do motor amostrados sem erro) e as 145 tomadas foram revistas em quadros estáticos; movimento e ritmo entre as tomadas não foram avaliados por um olhar humano contínuo. Recomendo uma passada completa no app.
3. **Atuação procedural.** Gestos, olhares e expressões vêm das ações/poses/expressões nativas do app + keyframes; é atuação, mas simples (sem animação quadro a quadro). Algumas encenações são atalhos: funcionários "somem" ao chegar ao caminhão; sentados usam a pose "sit" do rig sobre sofá/poltrona; o Samuca "no chão" usa a pose agachada.
4. **Cenários.** "Local de votação" e "Palanque da vitória" são montados dentro da Praça do Coreto (praça deteriorada + objetos); "Rua do buraco no dia seguinte" reutiliza a Rua das Mangueiras com o mesmo carro/buraco. Cenário 100 % novo foram: pátio, camarins (2), gráfica e comitê.
5. **Balões de grito** (estilo nativo "shout") têm o texto um pouco justo no contorno serrilhado; é desenho do app, não alterei o motor.
6. **Elenco secundário** é original e simples (Dona Marta, Seu Agenor, Motorista, Assessor, Assessora, Apresentador, Dono da gráfica, 2 Funcionários, Vendedor, 6 figurantes). Nenhum oficial foi alterado ou "redesenhado".
7. Falas adicionais (além do roteiro) foram acrescentadas só para naturalidade: nenhuma muda estrutura nem desfecho.

## Como regenerar / abrir

```bash
npx vitest run -c producoes/vila-torta/vitest.config.ts exportar   # gera o .jrec + validacao.json + CSV
```

Para abrir: Recorte Studio → Meus projetos → importar (`.jrec`).
