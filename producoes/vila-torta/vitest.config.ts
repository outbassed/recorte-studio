import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
export default defineConfig({
  root,
  resolve: { alias: { '@': `${root}src` } },
  test: { environment: 'node', include: ['producoes/vila-torta/**/*.run.ts'], testTimeout: 900000 },
});
