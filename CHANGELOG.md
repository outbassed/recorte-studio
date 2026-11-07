# Changelog

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
