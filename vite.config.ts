import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A 0.4 abria com dois cliques no index.html. Navegadores bloqueiam <script type="module">
 * em file://, então o build usa um único script clássico e mantém essa facilidade.
 */
function classicScript(): Plugin {
  return {
    name: 'recorte-classic-script',
    apply: 'build',
    enforce: 'post',
    transformIndexHtml(html) {
      return html
        .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/, '<script defer src="$1"></script>')
        .replace(/<link rel="stylesheet" crossorigin href=/g, '<link rel="stylesheet" href=');
    },
  };
}

/**
 * Versão do cache do PWA derivada do conteúdo do build: cada publicação nova troca o
 * nome do cache, o service worker apaga o antigo e ninguém fica preso numa versão velha.
 */
function pwaCacheVersion(): Plugin {
  let outDir = 'dist';
  let names: string[] = [];
  return {
    name: 'recorte-pwa-cache-version',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    generateBundle(_o, bundle) {
      names = Object.keys(bundle).sort();
    },
    closeBundle() {
      const sw = join(outDir, 'sw.js');
      if (!existsSync(sw)) return;
      const id = createHash('sha256').update(names.join('|')).digest('hex').slice(0, 12);
      const src = readFileSync(sw, 'utf8');
      writeFileSync(sw, src.replace(/const CACHE_NAME = CACHE_PREFIX \+ '[^']*';/, `const CACHE_NAME = CACHE_PREFIX + '${id}';`));
    },
  };
}

export default defineConfig({
  // Caminhos relativos: o build funciona em subpastas, em servidor estático e em file://.
  base: './',
  plugins: [react(), classicScript(), pwaCacheVersion()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
    modulePreload: false,
    rollupOptions: { output: { format: 'iife' } },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
    css: false,
  },
});
