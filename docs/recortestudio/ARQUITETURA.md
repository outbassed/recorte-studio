# RecorteStudio: auditoria (Fase 0), arquitetura e protótipo de IK (Fase 1)

Documento técnico curto. Base: o repositório real em `outbassed/recorte-studio`, branch `recortestudio` (commit `b52e322`),
lido e testado nesta sessão. Tudo que está marcado **verificado** foi executado; o que não pôde ser verificado está dito.

## 1. Regras que governam este trabalho

1. **O layout e a identidade visual do Recorte Studio não mudam.** Controles novos entram dentro de componentes existentes.
2. **O app original não é afetado.** Nada foi feito na `main`, nada foi publicado, nenhum merge, nenhum deploy.
3. **Dados dos usuários primeiro.** `.jrec`, `.rspack` e personagens continuam abrindo e desenhando igual; formato novo só com campos opcionais.
4. **Qualidade real de animação**, testada em cena real, não só no papel.
5. **Nada de dependência nova** sem avaliação técnica e de licença. Nesta entrega: nenhuma dependência foi adicionada.

## 2. Auditoria (Fase 0)

### 2.1 Repositório, branches e isolamento (verificado)

| Item | Situação |
|---|---|
| `recortestudio` × `main` | Idênticas: ambas em `b52e322` (o merge do PR #5, a expansão da Biblioteca). `git diff origin/main origin/recortestudio` vazio. |
| Branch desta entrega | `feature/recortestudio-rig-v2-prototipo`, criada a partir de `origin/recortestudio`. Não toca `main` nem `recortestudio`. |
| PR #6 (Biblioteca como loja de assets) | **Não** está nesta base e não foi mesclado. Fica para decisão sua. |
| `vercel.json` / `.vercel/` no repositório | Não existem. A configuração de produção vive no painel da Vercel. |
| Projeto Vercel `recortestudio` | **Não verificável daqui** (sem acesso à Vercel). Conferência manual necessária: em *Settings → Git*, a *Production Branch* do projeto `recortestudio` deve ser `recortestudio`, e a do projeto original deve continuar `main`. Nada nesta entrega altera isso. |

### 2.2 Stack e arquitetura do motor (verificado lendo o código)

React 19, TypeScript 6 estrito, Vite 8 (um único script IIFE, `base './'`, abre também por `file://`), Zustand 5, Dexie/IndexedDB,
Zod 4, Immer (histórico por patches), fflate, Vitest 5, Playwright (Chrome do sistema).

O núcleo é uma **função pura do tempo**:

```
Project ──evaluateScene(project, scene, t)──▶ ResolvedScene ──planFrame──▶ FramePlan ──▶ SVG (prévia) / SVG string (exportação)
```

* `src/engine/animation/evaluate.ts`: resolve keyframes, ações, falas, olhar e movimento natural. Não guarda estado entre chamadas
  (seek, reprodução e exportação obtêm o mesmo quadro). Para personagens, compõe `rig = base + Σ ações ponderadas + movimento natural`.
* `src/engine/character/render.ts`: o personagem é SVG gerado por código, com 8 vistas e rig articulado: ângulos em graus
  (`armLUpper`, `armLLower`, `torsoLean`, `sit`...), 0 = braço pendurado. `bodyMetrics(def)` dá os comprimentos.
* `src/engine/render/plan.ts`: **um só** plano de quadro para prévia e exportação.
* `src/engine/model/properties.ts`: registro único de propriedades animáveis (limites, unidade, rótulo); inspetor, timeline e
  motor leem dele.
* `src/engine/model/schema.ts`: Zod. `SCHEMA_VERSION = 1`; campos novos entram opcionais e com padrão.

### 2.3 Linha de base de testes (verificado, antes de qualquer mudança, em `b52e322`)

| Verificação | Resultado |
|---|---|
| `tsc --noEmit` | passou |
| `eslint src tests tools --max-warnings=0` | passou |
| Vitest | **478/478** (30 arquivos) |
| `vite build` | passou |
| Playwright E2E | **133 passaram, 2 falharam** |

As 2 falhas são **anteriores ao meu trabalho** e de ambiente: em `flows.spec.ts` (testes "20. offline…" e "dist/index.html abre
direto do disco…") `download.suggestedFilename()` devolve `"download"` em vez de `*.png` neste Chrome de sandbox. Já tinham sido
reproduzidas numa `main` limpa na entrega anterior. Não há relação com IK.

### 2.4 O que dá para reaproveitar

* A avaliação por função pura: o IK entra como **mais uma etapa** da composição do rig, sem estado.
* `bodyMetrics`, geometria do braço e do tronco: o IK usa exatamente os mesmos números do desenho.
* O registro de propriedades: o alvo, a força e a suavidade do IK viram propriedades animáveis sem código novo na timeline.
* Histórico por patches (Immer), `.jrec` e desfazer: nada precisou mudar.

### 2.5 Limitações e riscos encontrados (verificado por teste)

1. **Âncora de objetos segurados (`handL`/`handR` de `renderCharacter`) ignora a inclinação do tronco e a respiração.** Com
   `torsoLean = 20°` a mão desenhada e a âncora do objeto diferem por mais de 10 px (teste `arm-ik.test.ts`). É um defeito
   **pré-existente**, aqui só registrado: corrigir mudaria a posição de objetos segurados em projetos antigos. O IK não depende
   dele (usa a geometria real do desenho). Proposta: corrigir numa fase própria, com aprovação.
2. **Escala de profundidade (perspectiva falsa) de ancestrais** é ignorada nas contas de hierarquia (já documentado em `hierarchy.ts`).
   O IK trata a profundidade do próprio personagem corretamente; a de grupos-pai segue a limitação existente.
3. O rig é **plano** (2D por ângulos): o IK resolve no plano da tela. Em vistas 3/4 e perfil o rig já espelha por vista;
   o IK herda esse comportamento (o cotovelo "para dentro/fora" é relativo ao braço, não à tela).
4. Não existe ainda **Rig V2** (pivôs próprios, cadeias, pés no chão, pontos de ancoragem, ordem de camadas por vista).

## 3. Decisão de arquitetura: motor híbrido, sem reescrita

* O **Rig V1** (atual) continua padrão e visualmente intocado.
* O **Rig V2** será **opcional** e por personagem. Personagens antigos abrem em V1; conversão só a pedido, com backup e reversível.
* Prévia e exportação continuam usando **o mesmo avaliador e o mesmo plano**.
* O SVG **não** é trocado (nenhuma prova de ganho medido que justifique PixiJS ou similar).

O IK desta entrega é o **primeiro passo do V2 dentro do V1**: um passe final que só sobrescreve os dois ângulos do braço.

```
rig base ─▶ + ações ─▶ + movimento natural ─▶ [ IK do braço, se ligado ] ─▶ pose.rig ─▶ renderCharacter (inalterado)
                                                  ▲
                              alvo (ponto X/Y ou elemento) → espaço do personagem
```

## 4. O que a Fase 1 entregou

### 4.1 Módulos novos (`src/engine/rig/`)

| Arquivo | Papel |
|---|---|
| `ik2d.ts` | IK de dois ossos em forma fechada (lei dos cossenos). Pura: sem DOM, sem estado, sem aleatoriedade. Limites de cotovelo e ombro, alvo impossível (fora do alcance / perto demais) sem NaN, "IK suave" opcional. |
| `armIk.ts` | Adaptador para o rig **existente**: comprimentos de `bodyMetrics`, ombro e ângulos de `armGeometry`, quadril de `hipLayout`, tronco de `torsoLeanDeg`/`breathScale`. Converte a solução em `armXUpper`/`armXLower` (graus) e mistura com o rig pela força. |
| `sceneIk.ts` | Dentro do avaliador: alvo no mundo → espaço do personagem (posição, rotação, escala, espelhamento, pivô, grupos pai, escala de profundidade). |
| `handPosition.ts` | Posição atual da mão no mundo; ao **ligar** o IK o alvo nasce na mão, então nada pula. |

Mudanças pequenas em arquivos existentes: `schema.ts` (campo `ik`), `properties.ts` (propriedades animáveis), `evaluate.ts`
(uma chamada), `render.ts` (**extração** de funções já existentes: `hipLayout`, `armGeometry`, `torsoLeanDeg`, `breathScale`,
`handSizeOf`, sem mudar o desenho; provado por teste dourado), `Inspector.tsx` e `Stage.tsx` (UI abaixo).

### 4.2 Formato (compatível)

Novo campo por personagem, **sempre com padrão desligado**:

```json
"ik": { "armL": { "enabled": false, "weight": 1, "targetMode": "point", "targetId": null, "x": 0, "y": 0, "bend": "in", "soft": 0 }, "armR": { ... } }
```

* `SCHEMA_VERSION` continua 1: o campo é opcional/defaulted, não exige migração.
* Projeto antigo (sem `ik`) abre com o padrão; desenha **byte a byte igual**.
* App **original** abre projeto salvo com `ik`: ignora o campo, sem erro (**verificado**).

### 4.3 Comportamento

* **Prioridade:** o IK, quando ligado e com força > 0, sobrescreve o braço sobre pose, keyframes e ações; a força 0 → 1 mistura de forma contínua pelo caminho angular mais curto.
* **Alvo:** ponto X/Y da cena ou o centro de outro elemento (acompanha se ele se mover). Objeto *segurado* não serve de alvo (posição só existe depois de desenhar a mão): o braço fica na pose.
* **Cotovelo:** `in` = antebraço aberto (padrão das poses); `out` = cotovelo para fora (mão na cintura). A escolha é fixa, então não há "virada" quando o alvo atravessa o ombro.
* **Fora do alcance:** o braço estica na direção do alvo (é o gesto de *apontar*). Perto demais: dobra o máximo. O motor informa (`reached`, `limited`, `error`) e o Inspector escreve isso em português.
* **Suavidade (opcional, padrão 0 = exato):** perto do esticamento total o ângulo do cotovelo varia como √distância e o braço "estala". Com suavidade > 0 a mão freia numa zona perto do alcance máximo. Fica **desligada por padrão** porque ligar o IK numa pose de braço esticado (apontando) não pode mexer em nada.
* **Determinismo:** o resultado depende só de (projeto, cena, tempo): sem histórico. Testado avaliando o instante T direto e depois de percorrer a cena.

### 4.4 Interface (sem redesenho)

* **Aba Pose do Inspetor**, depois de "Pose e rig": uma seção recolhida **"IK: alcançar um ponto ou objeto"**, no mesmo componente `Section` de todas as outras. Por braço: interruptor, tipo de alvo, X/Y (ou elemento), força, cotovelo, suavidade e uma linha de status.
* **Palco** (só no editor, nunca na exportação): cruz verde (a mão chega) ou laranja (fora do alcance) no alvo, **arrastável**. Tudo que o arrasto faz também se faz digitando nos campos (celular não depende de arrastar).
* Desfazer (um Ctrl+Z desfaz o arraste inteiro), keyframes por campo e o botão de keyframe da seção funcionam como no resto do editor.

## 5. Critérios de aceitação e mapa de riscos

| Critério | Como foi provado |
|---|---|
| Layout intacto | 10 telas desktop/celular, original × novo: **todas as regiões com as mesmas medidas**; diferença de pixels ≤ 0,21 % nas telas iguais (é o movimento natural do cenário, sorteado por projeto); a única mudança visível é a linha recolhida "IK…" no fim da aba Pose (2,4 % dos pixels). `docs/recortestudio/baseline/` |
| Personagens/cenas antigos iguais | Teste dourado de 768 SVGs de personagem + 12 quadros de cena + **1.662 quadros dos 2 episódios reais de Vila Torta (.jrec): 0 diferenças** |
| Sem perda de dados | `.jrec` com IK salva e reabre igual; app original abre arquivo com `ik` |
| IK correto | A mão **desenhada** (lida do SVG real) chega ao alvo, em todos os personagens × 8 vistas × 2 braços × 2 cotovelos, com tronco inclinado, respiração, sentado, escala, rotação, espelhamento, pivô, grupo e perspectiva |
| Prévia = exportação | Mesmo `planFrame`; teste confere o SVG final |
| Desempenho | `docs/recortestudio/desempenho-ik-*.json` (seção 6 do relatório) |

| Risco | Mitigação |
|---|---|
| IK sobrescrever o que o animador fez no braço | É opt-in por braço; força 0 devolve o rig; desligar volta à pose |
| "Estalo" do cotovelo perto do alcance máximo | Suavidade opcional; documentado; demonstrado |
| Âncora de objeto segurado ignora tronco | Pré-existente, registrado, fora do escopo, com proposta |
| Plano 2D em vistas 3/4/perfil | Herda o espelhamento do rig; limitação documentada |
| Produção Vercel | Conferência manual (item 2.1); nada mudou |

## 6. Bibliotecas candidatas (apenas avaliação; **nada foi adicionado**)

Dados lidos em 14/11/2026 no registro npm e na busca do GitHub; maturidade e adequação são avaliação minha, a confirmar.

| Candidata | Licença | Versão / última atividade | Observação para o RecorteStudio |
|---|---|---|---|
| PixiJS | MIT | 8.23.0 (11/11/2026) | Renderizador WebGL/WebGPU maduro. Só vale com prova de ganho medido sobre o SVG atual; trocaria o caminho único de renderização. Pacote grande (80 MB desempacotado; o bundle real é bem menor). |
| MediaPipe Tasks Vision | Apache-2.0 | 1.2.3 (11/11/2026) | Captura de pose por câmera (WASM + modelos de vários MB). Candidata a *mocap* opcional e **local**, sem enviar vídeo a servidor; custo de tamanho exige carregamento sob demanda. |
| Flubber | MIT | 0.4.2 (**03/2018**) | Interpola formas SVG. Pequena (88 KB), mas **sem manutenção há anos**: avaliar copiar o algoritmo ou usar só em ferramenta de edição. |
| Theatre.js | `@theatre/core` Apache-2.0; **`@theatre/studio` AGPL-3.0-only** | 0.7.2 (05/2024) | O *studio* é AGPL: incompatível com distribuição fechada sem acordo. O RecorteStudio já tem timeline própria; não recomendado. |
| Mediabunny | MPL-2.0 | 1.66.0 (13/11/2026) | Leitura/escrita de MP4/WebM com WebCodecs no navegador. Candidata forte para exportação de vídeo; MPL-2.0 pede cuidado só ao modificar arquivos da própria biblioteca. |
| Rhubarb Lip Sync | MIT no pacote npm `rhubarb-lip-sync` (0.0.1-alfa-3, 02/2024); confirmar no repositório oficial | binário C++ | Sincronia labial a partir de áudio; roda como programa nativo, **não** no navegador. Só como ferramenta externa ou via WASM próprio (a avaliar). |
| Rigby2D | Apache-2.0 | GitHub `jaisurya-dev-art/rigby2d`, 250 ★, atividade em 14/11/2026 (**não está no npm**) | Projeto recente de rigging 2D. Precisa de leitura do código antes de qualquer decisão; o IK desta entrega foi escrito do zero (≈440 linhas, sem dependência). |
| IceBones | **sem licença declarada** no repositório encontrado (`jwp72/icebones`, 2 ★) | 04/2026 | Não confirmei que é o projeto pretendido. Sem licença, **não pode ser usado**. |

## 7. Fases seguintes (proposta)

1. **Fase 2: pés no chão e pernas com IK** (mesmo núcleo de dois ossos), com bloqueio de pé (*foot pinning*) e cena canônica do Rafael (andar, parar, alcançar, expressão, câmera).
2. **Fase 3: pontos de ancoragem mão-objeto** (corrigindo a âncora que ignora o tronco, com aprovação) e ordem de camadas por vista.
3. **Fase 4: "Salvar movimento"** (gravar uma ação a partir do que o IK produziu) e Rig V2 opcional com conversão reversível.
4. **Fase 5+**: avaliação com protótipo de mocap local (MediaPipe) e exportação com Mediabunny, cada uma com medição própria.
