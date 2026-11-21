# Etapa 1: acabamento de movimento e curvas

Tudo aqui é **opcional**. Projetos criados antes desta etapa abrem, tocam, exportam e salvam como antes: nenhum campo novo é gravado até você usar o recurso, e valores inválidos são descartados na leitura.

## Onde achar cada controle

| Recurso | Onde | Padrão |
| --- | --- | --- |
| Curva de easing livre | Selecione um keyframe na timeline → **Interpolação até o próximo: Suave** → **Easing: Curva personalizada (Bézier)…** | Sem curva: usa o easing nomeado (`easeInOut` para keyframes novos) |
| Easings novos | Mesmo campo **Easing** (cúbicos, "Recua e vai", "Recua, vai e passa") | Os seis antigos continuam |
| Suavização de transição | Sem nada selecionado → aba **Transições** → **Suavização da entrada** (e **da saída**, quando a saída é fade) | Linear |
| Acabamento do pulo | Clique no clip **Pular** → aba **Ação** → **Acabamento de movimento** (+ **Intensidade do acabamento**) | Desligado |
| Animação do balão | Clique no clip de fala → aba **Balão** → **Entrada do balão** / **Saída do balão** (+ durações) | Nenhuma (estático) |

No celular os mesmos controles estão em Propriedades (dock): selecione o keyframe, o clip ou a cena e abra a aba correspondente.

## 1. Curva cubic-bezier

Modelo de dados, opcional por keyframe:

```json
{ "id": "key_…", "timeMs": 0, "value": 0, "interpolation": "bezier", "easing": "easeInOut",
  "bezierHandles": { "x1": 0.34, "y1": 1.56, "x2": 0.64, "y2": 1 } }
```

- Vale só com `interpolation: "bezier"` e é a curva do trecho que **parte** deste keyframe. `linear` e `hold` ignoram os pontos.
- Sem `bezierHandles`, o `bezier` usa o easing nomeado como sempre usou.
- A curva é a mesma do CSS: P0=(0,0), P1=(x1,y1), P2=(x2,y2), P3=(1,1). O progresso do tempo é o **X** da curva; resolvemos x(s)=progresso (Newton + bissecção) e devolvemos y(s). `0 → 0` e `1 → 1` exatamente.
- **x1 e x2** ficam em [0, 1] (o tempo nunca volta). **y1 e y2** ficam em [-1, 2]: passar de 1 dá overshoot, abaixo de 0 dá recuo antes de sair. Fora disso o valor é limitado; objeto malformado é descartado (volta ao easing nomeado). Nunca sai NaN/Infinity.
- Easings novos: `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `backIn`, `backInOut`.

O editor (`src/components/controls/BezierEditor.tsx`): arraste os pontos (mouse ou toque), use as setas do teclado com o ponto focado (Shift = passo de 0,1), ou digite em **Valores numéricos**. Curvas prontas e **Restaurar curva original**. Um arraste inteiro é um único Ctrl+Z.

## 2. Suavização das transições

`Transition.easing` (opcional): `linear` (padrão), `easeInOutCubic` ou `easeOutCubic`. Aplica-se em `src/engine/render/montage.ts` ao progresso de dissolver, deslizar e cortina; o fade de entrada usa `scene.transitionIn.easing` e o fade de saída usa `scene.transitionOut.easing`. Durações e tipos não mudam; sobreposições curtas e duração 0 continuam como antes. Prévia e exportação usam a mesma função (`planMontageFrame`).

## 3. Acabamento de movimento (pulo)

`ActionClip.finish` (opcional, 0 a 2): ausente ou 0 = pulo original. Com valor, `jumpFinishSample()` (`src/engine/animation/actions.ts`) gera, em função só do tempo normalizado e da duração do clip:

1. **antecipação** (~20 % do clip, entre 90 e 260 ms): esmaga, braços recuam;
2. **impulso**: a compressão vira esticada em poucos quadros;
3. **arco** com pausa curta no ápice (curva achatada perto do topo); a altura continua `150 × intensidade`, como no pulo original;
4. **pouso** (~24 % do clip, entre 110 e 320 ms): esmaga no contato e recupera com oscilação amortecida.

O esmagar/esticar usa o canal de rig `squash` (`Rig.squash`, opcional, ausente = 0, limitado a ±0,5): escala a partir dos **pés** com área constante (`sx = 1/√sy`), então o personagem não afunda nem flutua. Posição da cabeça e das mãos acompanham a escala (balões e objetos seguram no lugar certo). "Converter em keyframes" também grava `rig.squash`.

Só o `Pular` oferece o acabamento. Andar/correr, pés travados, IK e física de cabelo ficam para outra etapa.

## 4. Balões animados

`DialogueClip.bubbleIn` / `bubbleOut`: `none` (padrão), `pop`, `fade`, `popFade`; `bubbleInMs` / `bubbleOutMs` (padrão 240 e 200 ms). O avaliador entrega `localMs` e `remainingMs` do clip, e `bubbleAnimation()` (`src/engine/render/bubbles.ts`) calcula escala e opacidade. Se entrada + saída não cabem no clip, as duas encolhem na mesma proporção. O pop escala em torno da **ponta da cauda** (centro da base na caixa de narração), então a cauda não se desloca. Sem animação o SVG é idêntico ao anterior.

## Compatibilidade

- Campos novos opcionais, sem migração: `Keyframe.bezierHandles`, `Transition.easing`, `ActionClip.finish`, `DialogueClip.bubbleIn/bubbleOut/bubbleInMs/bubbleOutMs`, `Rig.squash`. O formato `.jrec` e o `schemaVersion` não mudaram.
- Um .jrec que usa recursos novos aberto numa versão **anterior**: os campos opcionais novos (`bezierHandles`, `Transition.easing`, `finish`, `bubbleIn/Out`, `squash`) são descartados e o projeto toca como antes. **Exceção:** keyframes que usam um dos cinco ids de easing novos (`easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `backIn`, `backInOut`) não são aceitos pelo schema antigo, e a versão anterior recusa abrir o projeto. Use a curva personalizada ou os ids antigos se precisar abrir o arquivo em versões anteriores.
- Pacotes oficiais (`public/packs/`) não mudaram: os hashes continuam os mesmos.
- O build continua IIFE, offline e `file://`.
