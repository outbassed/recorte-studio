import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
// Geração dos pacotes oficiais: `npm run packs:build` (não faz parte da suíte comum).
export default defineConfig({
  root,
  resolve: { alias: { '@': `${root}src` } },
  test: { environment: 'node', include: ['tools/packs/**/*.run.ts'], testTimeout: 600_000, setupFiles: [] },
});
