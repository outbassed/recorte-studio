# Produção — Vila Torta T1E1

Gerador do episódio usando **apenas** o modelo, as operações e o importador/exportador do Recorte Studio (`src/…`), sem motor próprio e sem alterar o app.

- `personagens/` — os 7 `.biblioteca.json` fornecidos (entram sem alteração).
- `objects.ts`, `backgrounds.ts`, `cast.ts`, `vehicles.ts`, `lib.ts` — objetos, cenários, elenco secundário, veículos e mini-DSL de tomadas.
- `seq/` — as 11 sequências.
- `exportar.run.ts` — exporta o `.jrec`, reimporta com o importador real, roda os testes obrigatórios e escreve `entrega/`.
- `quadros.run.ts`, `shots.mjs`, `folhas.mjs`, `validar-app.mjs` — conferência visual e validação no app real (uso interno).
- `entrega/` — **o arquivo final**, relatório, roteiro de falas para dublagem e evidências.

```bash
npx vitest run -c producoes/vila-torta/vitest.config.ts exportar
```
