# Relatório: RecorteStudio, Fases 0 e 1 (protótipo de animação com IK)

Branch: `feature/recortestudio-rig-v2-prototipo` (a partir de `recortestudio` em `b52e322`). PR para `recortestudio`, **sem merge**.
Documento técnico: [`ARQUITETURA.md`](ARQUITETURA.md).

## RESUMO

* **Fase 0 (auditoria e linha de base):** concluída. `recortestudio` e `main` estão idênticas (`b52e322`); linha de base de testes e de layout registrada; riscos mapeados; backup/compatibilidade provados com dois episódios reais de Vila Torta.
* **Fase 1 (IK):** um **núcleo de IK 2D de dois ossos, puro e testado**, ligado ao **braço do rig existente** de forma **opcional** (desligado por padrão), com controle **dentro do Inspetor atual** e alvo arrastável no palco. Funciona na prévia, na timeline (força e alvo animáveis), no `.jrec` e na exportação, que usam o mesmo avaliador.
* **Regra absoluta cumprida:** nenhum redesenho. A única mudança visível de interface é **uma linha recolhida** ("IK: alcançar um ponto ou objeto") no fim da aba Pose. Personagens e cenas antigos desenham **byte a byte igual**.
* **Nenhuma dependência nova.** Nada foi publicado, mesclado ou deployado. A `main` não foi tocada.

## ARQUIVOS ALTERADOS

**Novos (motor):** `src/engine/rig/ik2d.ts`, `armIk.ts`, `sceneIk.ts`, `handPosition.ts` (≈440 linhas).

**Alterados (pequenos e aditivos):**

| Arquivo | Mudança |
|---|---|
| `src/engine/model/schema.ts` | campo `ik` por personagem (padrão desligado) |
| `src/engine/model/properties.ts` | propriedades animáveis do IK (força, alvo X/Y, suavidade, tipo/elemento de alvo, cotovelo) |
| `src/engine/animation/evaluate.ts` | uma chamada após a composição do rig; cópia própria de `ik` para a animação não escrever no estado salvo |
| `src/engine/character/render.ts` | **extração** de funções que já existiam (`hipLayout`, `armGeometry`, `torsoLeanDeg`, `breathScale`, `handSizeOf`); desenho idêntico (teste dourado) |
| `src/components/panels/Inspector.tsx` | seção `IkSection` (recolhida), na aba Pose |
| `src/components/stage/Stage.tsx` | marcador arrastável do alvo, só no editor |
| `playwright.config.ts` | novos specs; `BASE_URL` opcional para comparar com o app original em outra porta |

**Testes, ferramentas e documentos:** 7 arquivos de teste unitário, 4 specs E2E, `tools/layout-diff.py`, `docs/recortestudio/**`.

## COMPATIBILIDADE

| Verificação | Resultado |
|---|---|
| Projeto antigo (sem `ik`) abre e desenha igual | **Sim.** Fixture real da v0.4 migrada + projeto de demonstração: 12 quadros com hash igual ao do motor original. |
| Episódios reais **Vila Torta T1E1 e T1E2 (.jrec)** | **1.662 quadros** (todas as cenas × 6 instantes) renderizados pelo motor **original** e pelo **novo**: **0 diferenças**. |
| Personagens padrão | **768** SVGs (todos os personagens × 8 vistas × 8 poses, incluindo tronco inclinado, respiração, sentado e corpo elevado): hashes iguais aos do motor original (teste dourado, gerado **antes** da refatoração). |
| `.jrec` com IK: salvar e reabrir | Mantém configuração, keyframes do IK e o desenho. |
| App **original** abre projeto salvo pelo app novo | **Sim**, ignora `ik` sem erro (verificado rodando o importador do app original). |
| Migração | `SCHEMA_VERSION` continua 1: campo opcional/defaulted; nada a migrar. |
| `.rspack` | Não tocados. Os 48 pacotes oficiais seguem passando nos testes existentes. |
| Armazenamento local | Nada foi apagado, nenhuma limpeza de dados do site foi necessária ou recomendada. |

Observação: os `.jrec` de Vila Torta só existem na branch `claude/vila-torta-t1e1-producao-a3k6yr`; foram extraídos (`git show`) para uma pasta temporária, tratados como dados não confiáveis, e **não** foram copiados para este repositório.

## TESTES

Resultados **reais**, na árvore final desta branch.

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` | passou |
| `eslint src tests tools --max-warnings=0` | passou |
| Vitest | **543/543** (37 arquivos). Linha de base era 478/478: **+65 testes novos** |
| `vite build` | passou |
| Playwright E2E | **141 passaram, 2 falharam** (8,5 min, suíte inteira). Linha de base: 133 passaram, 2 falharam. Os **8 E2E novos** passaram; as 2 falhas são as mesmas da linha de base (abaixo) |

**Falhas de E2E anteriores ao meu trabalho (idênticas na linha de base `b52e322`):** `flows.spec.ts` › "20. offline: o build não depende de rede" e "dist/index.html abre direto do disco (file://), salva e exporta". Causa: neste Chrome de sandbox `download.suggestedFilename()` devolve `"download"` em vez de `*.png`. **Não são do IK** e não foram "consertadas" nem ocultadas.

Os E2E rodam no build de produção, com o Chrome do sistema; **não** afirmo E2E pelo fato de o `tsc`/`vite build` passarem.

### O que os testes novos cobrem

| Arquivo | Conteúdo |
|---|---|
| `ik2d.test.ts` (21) | alcança o alvo (≈5.600 alvos, 7 correntes, 2 soluções); comprimento dos ossos; espelhamento; **simetria**; **reversibilidade** (ângulos→posição→IK); fora do alcance, perto demais, alvo no ombro; **NaN/Infinity/negativos**; limites de cotovelo e ombro; **determinismo** (ordem das chamadas não importa); **continuidade** (varreduras de 3.600–4.000 passos, inclusive cruzando o alcance máximo e o ponto acima do ombro); estabilidade perto do esticamento (cresce como √erro); zona suave |
| `arm-ik.test.ts` (12) | a mão **desenhada** (lida das transformações do SVG real) cai no alvo para todos os personagens × 8 vistas × 2 braços × 2 cotovelos, com tronco inclinado/respiração/sentado/corpo elevado; limites; simetria esquerdo/direito; mistura; "alvo = mão atual ⇒ nada muda"; registra a limitação pré-existente da âncora de objetos |
| `ik-scene.test.ts` (20) | projeto/nó antigo sem `ik`; IK desligado não altera nada; **a mão no SVG final chega ao alvo no mundo** com escala, rotação, espelhamento, pivô, grupo girado/escalado e escala de profundidade; alvo = elemento que se move; força e alvo animados; **sem histórico (seek)**; fora do alcance; escala 0; `.jrec`; valores inválidos |
| `character-render-golden.test.ts`, `legacy-scene-golden.test.ts` | hashes do motor **original** (ver Compatibilidade) |
| `ik-demo.test.ts` (5) | a cena de demonstração: aponta, alcança, dois braços, sem saltos |
| `ik-perf.test.ts` (4) | custo em Node |
| E2E `ik.spec.ts` (5) | interface real: desligado por padrão, ligar **sem pular**, campos, fora do alcance (aviso em português), **desfazer**, salvar/recarregar, **arrastar o alvo no palco** (1 Ctrl+Z desfaz o arraste), alvo = elemento, 2 braços, reprodução sem erros, **celular** sem arrastar e sem estourar a tela |
| E2E `ik-perf.spec.ts` (3) | fps reais no Chrome |

### Defeito real que os testes acharam durante o trabalho (e o que foi feito)

1. O teste dourado pegou, na hora, um deslize meu na refatoração do `render.ts` (variável `sit` ainda usada abaixo). Corrigido antes de seguir.
2. O teste contra o SVG desenhado mostrou que a âncora de objetos segurados **ignora a inclinação do tronco** (defeito pré-existente). Registrado; **não** corrigido por mudar projetos antigos.
3. O teste de continuidade da demonstração mostrou um **"estalo" do cotovelo** quando o alvo entra no alcance. Causa matemática (√distância). Solução: **suavidade opcional**. Ela **não** é padrão porque ligar o IK numa pose de braço esticado dobraria o cotovelo, e ligar o IK não pode mexer em nada.

## DEMONSTRAÇÃO

Quadros reais do editor: `docs/recortestudio/demo/folha-contato.png` (e `quadro-1…5.png`). Projeto importável:
`docs/recortestudio/demo/ik-apontar-e-alcancar.json` (menu **Importar projeto**).

A Nina **aponta** para o vaso (longe: braço esticado na direção dele; o outro braço, ao mesmo tempo, para o abajur), depois o alvo se move e ela **alcança a caneca** na escrivaninha (a mão chega nela), e a força volta a 0 (o braço volta à pose). Capturas da interface (alcançou / fora do alcance / alvo arrastado / celular): `docs/recortestudio/demo/interface/` (geradas pelo E2E).

Como usar: selecione um personagem → aba **Pose** → abra **"IK: alcançar um ponto ou objeto"** → ligue o braço (o alvo nasce na mão, nada pula) → mova o alvo arrastando a cruz no palco **ou** digitando X/Y **ou** escolhendo um elemento. Animar: crie keyframes de força e de alvo como em qualquer outro campo.

### Desempenho (medido, não prometido)

* **Núcleo (Node 22):** resolver um braço: **0,29 µs**; pelo adaptador do personagem: **0,9 µs**; avaliar a cena com IK nos dois braços custa **+4,8 µs por quadro** (15,6 → 20,3 µs); quadro completo (avaliar + planejar + SVG): **0,75 ms**, contra 33 ms de orçamento a 30 fps.
* **Chrome real, reprodução da demonstração (rAF, 4 s):** computador **60,2 fps (IK desligado) × 60,1 fps (IK ligado)**, p95 16,7 ms; com **CPU 4× mais lenta**: 51,9 × 49,7 fps; **celular 390×844 com CPU 4× mais lenta: 59,0 × 59,5 fps**. O IK não tem custo mensurável.
* **Limite honesto:** é Chrome de sandbox com CPU limitada por software; **não** medi um celular físico. Os números de "celular" são uma aproximação.

## RISCOS / PENDÊNCIAS

1. **Vercel:** não consegui verificar a configuração dos dois projetos (sem acesso). Confirmar manualmente que a *Production Branch* de `recortestudio` é `recortestudio` e a do original segue `main`. Se o projeto `recortestudio` estiver ligado a este repositório, o PR deve gerar um *preview* do app **novo**; não afirmo isso sem ver a Vercel.
2. **PR #6 (Biblioteca como loja de assets)** não está nesta base e não foi mesclado.
3. **Âncora de objetos segurados** ignora tronco inclinado/respiração (pré-existente): objetos nas mãos podem sair alguns pixels da mão quando o tronco inclina. Proposta de correção na Fase 3, com aprovação.
4. **"Estalo" do cotovelo** perto do alcance máximo com alvo rápido: use a suavidade (≈10–20 %) quando o alvo atravessar o alcance do braço.
5. **IK só no braço, no plano da tela.** Em vistas 3/4 e perfil o cotovelo "dentro/fora" é relativo ao braço (como o próprio rig espelha por vista), não à tela.
6. **Elemento-alvo segurado por alguém** não serve de alvo (a posição só existe depois do desenho da mão): o braço fica na pose.
7. **Sem Rig V2 ainda** (pivôs próprios, pés no chão, ancoragens, ordem de camadas por vista): é o objetivo das próximas fases.
8. **Ajuda do manual** não ganhou capítulo sobre IK (a seção tem texto de ajuda próprio). Pendente.
9. As bibliotecas candidatas foram **só avaliadas** (tabela em `ARQUITETURA.md`); duas (Rigby2D, IceBones) não existem no npm e a segunda não declara licença.

## ENTREGA

* **Branch:** `feature/recortestudio-rig-v2-prototipo`. (A instrução da sessão indicava `claude/confident-turing-m65b6g`; usei a branch separada que você pediu no briefing, a partir de `recortestudio`, e não toquei em nenhuma outra.)
* **Commits:** núcleo/adaptador/avaliador (`6e1aef6`), Inspetor/palco/IK suave/demonstração (`d96f0ca`), mais o commit final de documentação, linha de base de layout, desempenho e testes de entrega.
* **PR:** para `recortestudio`, **aberto para revisão, sem merge, sem auto-merge**.
* **Preview do app novo:** depende da Vercel (item 1 dos riscos).
* **Capturas de layout (regressão visual):** `docs/recortestudio/baseline/original/` (app original `b52e322`), `…/novo/`, e a comparação em `…/comparacao.md` (gerada por `tools/layout-diff.py`).

### Checklist de aceitação da primeira entrega

| Item | Estado |
|---|---|
| Auditoria de `recortestudio` + diferenças documentadas contra `main` | feito (nenhuma diferença na base) |
| Confirmação de que a produção do original não foi alterada | nada foi publicado/alterado por mim; conferência da Vercel é **manual** |
| Capturas de layout como referência de regressão visual | feito (desktop 1366×768 e celular 390×844) |
| Módulo de IK puro com testes unitários | feito |
| IK opcional demonstrável num braço existente | feito |
| Controle no Inspetor atual, sem redesenho | feito (seção recolhida na aba Pose) |
| Personagens antigos sem mudança de aparência | provado (768 + 12 + 1.662 quadros) |
| Sem perda de dados no `.jrec` | provado |
| Prévia e exportação coerentes | mesmo avaliador e plano; conferido no SVG final |
| Testes/build documentados com resultado real | acima, incluindo as 2 falhas anteriores |
| PR para `recortestudio` sem merge automático | aberto |

## PRÓXIMO PASSO

**Fase 2: pernas e pés no chão** com o mesmo núcleo de dois ossos (bloqueio de pé, sem "patinar"), e a **cena canônica do Rafael** (Vila Torta, 20–30 s: andar, parar, alcançar com IK, expressão, câmera) para medir qualidade em cena real. Antes: sua decisão sobre (a) corrigir a âncora de objetos segurados e (b) o PR #6.
