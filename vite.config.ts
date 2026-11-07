import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

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

export default defineConfig({
  // Caminhos relativos: o build funciona em subpastas, em servidor estático e em file://.
  base: './',
  plugins: [react(), classicScript()],
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
