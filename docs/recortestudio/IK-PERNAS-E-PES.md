# RecorteStudio — IK das pernas, pés fixos e contornos de articulação

**Branch:** `feature/recortestudio-ik-pernas-pes-cotovelos` (iniciada no protótipo do PR #7).

## Objetivo

Dar um passo após o IK de braços: corrigir as conexões visuais de cotovelos, permitir IK de coxa/joelho/tornozelo e fixar os pés em pontos do mundo durante uma animação. Tudo é **opcional e desligado por padrão**. A interface, o tema e a organização do Recorte Studio original permanecem iguais.

## Novidades

- **Contorno do cotovelo:** uma peça de junção arredondada aparece somente nos braços com IK ativo. O desenho legado sem IK não muda.
- **Joelho:** o motor usa a geometria EXATA das pernas no SVG, incluindo vistas, corpo sentado, proporções, giro da perna e `bodyY`. O joelho recebe um contorno arredondado apenas no IK.
- **Pé fixo:** ligar a opção registra o tornozelo exatamente onde está na cena. Ao mover o personagem, o tornozelo tenta permanecer naquele mesmo X/Y mundial e o joelho flexiona. Se o pé estiver além do alcance, o motor respeita os limites, sinaliza a diferença e não estica a perna artificialmente.
- **Edição:** Propriedades → Pose → `IK: joelhos e pés fixos no chão`. Cada perna tem liga/desliga, alvo X/Y, força de mistura 0–100%, direção do joelho e suavidade de extensão. Há marcador próprio no palco, arrastável no PC; campos no celular.
- **Timeline:** `ik.legL/legR.weight`, `.x`, `.y`, `.soft` podem receber keyframes. Para um passo, anime `weight` para soltar e depois reposicione o alvo do pé; não existe ciclo automático de caminhada ainda.
- **Consistência:** cálculo puro por tempo, em `evaluateScene`, que alimenta a prévia e a exportação. O alvo é interpretado no mundo e convertido para o espaço local do personagem, inclusive ao mover, girar, escalar ou agrupar.
- **Compatibilidade:** `SCHEMA_VERSION` continua 1; `ik.legL` e `ik.legR` são opcionais e recebem `enabled=false`. Projetos antigos, personagens, recursos da biblioteca e `.rspack` não são migrados ou editados.

## Como testar

1. Abra a prévia da branch desta entrega (não o site público de produção).
2. Carregue um projeto e selecione a Nina ou outro personagem.
3. Propriedades → Pose → abra **IK: joelhos e pés fixos no chão**.
4. Ative um pé. Ele não deve mudar de lugar no instante da ativação. Seu marcador azul aparece no tornozelo.
5. Mova o alvo X/Y; a perna deve acompanhar e o joelho dobrar. Teste ambos os lados e a direção de dobra.
6. Mova o corpo e o personagem horizontalmente com o pé ainda fixo. Dentro do alcance da perna, o pé deve continuar no mesmo ponto.
7. Experimente uma posição distante: a perna não pode alongar além do máximo e a interface indica alvo fora do alcance.
8. Teste porcentagem do IK, salve/reabra, desfazer e reprodução. No celular, use os campos em vez de arrastar.
9. Compare personagens antigos com IK desligado: aparência, posição e animações não devem mudar.

## Limites conhecidos / próximos passos

- Isto é um **protótipo de pé plantado com IK 2D**, e não um sistema completo de locomoção procedural. Ainda não detecta automaticamente fases de apoio e balanço, nem gera passos sincronizados ao chão.
- Não há correção automática de altura do quadril ou equilíbrio corporal quando ambos os pés estão longe demais do alcance.
- O calçado mantém sua orientação artística original. O posicionamento toma como referência o tornozelo, que corresponde à cadeia geométrica usada no SVG.
- O Rig V2 completo (ossos configuráveis, roupas deformáveis e interações físicas) continua previsto para etapas futuras.
- Testes novos: `tests/unit/leg-ik.test.ts` e `tests/e2e/leg-ik.spec.ts`. A existência dos testes não significa que a suíte inteira tenha sido executada: registrar resultados reais antes de mesclar.

**Regra:** merge apenas mediante autorização. A `main` do Recorte Studio original e a branch `recortestudio` de produção não são alteradas por este trabalho.
