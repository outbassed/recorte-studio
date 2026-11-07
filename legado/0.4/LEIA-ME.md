# Recorte Studio 0.4 — Animação 2D em camadas

Abra **index.html** no Chrome ou Edge. Não precisa instalar nada nem conectar à internet.

## O que mudou

- Removido o motor 3D/WebGL. Objetos e personagens são **SVG 2D** que compartilham a mesma pilha de camadas.
- **Camadas**: selecione personagem ou objeto; use ↑ / ↓ para trazer para frente ou enviar para trás. ✕ exclui a camada com confirmação. A ordem aparece também no PNG exportado.
- **Cenas**: lista com rolagem independente e botões **Duplicar cena atual / Criar cena vazia** fixos no rodapé do painel, mesmo em projetos grandes. Cada cena tem ↑ / ↓ para alterar ordem e ✕ para excluir, com confirmação.
- Correção visual de rostos: uma única boca por estado e olhos coerentes na vista 3/4. Olhar pode acompanhar outro personagem.
- Cenários, cabelos, expressões, poses, templates e propriedades numéricas da versão anterior preservados.
- Interface desktop e mobile adaptada, incluindo painel popup acima da barra inferior.
- Projeção simples de profundidade com parallax do fundo, sombra e sobreposição 2D.
- Exportação de quadro PNG em 1280×720 e exportação/importação de projeto JSON.

## Limitações

- A geração por texto continua baseada em regras locais, **não é IA generativa**.
- Exporta PNG estático, não vídeo ou GIF.
- A arte SVG das diferentes vistas ainda é simplificada; não há rigging com interpolação 3D.
- A biblioteca e a organização dos objetos ainda se aplicam globalmente a todas as cenas (limitação herdada).
- Salvamento automático usa `localStorage` do navegador; para backup, exporte o JSON. A versão 0.4 tenta ler o armazenamento da 0.3 quando disponível na mesma origem e também aceita importar JSON 0.3.

## Arquivos
- `index.html` — interface
- `styles.css` — visual e responsividade
- `app.js` — cenas, personagens, camadas, edição, animação e exportação
- `world2d.js` — câmera/parallax 2D, sem WebGL
