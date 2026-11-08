import { defineConfig } from '@playwright/test';

// Usa o Chrome instalado no sistema (não baixa navegador). Serve o build de produção,
// assim os testes validam o mesmo artefato offline que será distribuído.
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/e2e-results.json' }]],
  use: {
    baseURL: 'http://localhost:4173',
    channel: 'chrome',
    acceptDownloads: true,
    viewport: { width: 1366, height: 768 },
    launchOptions: { args: ['--autoplay-policy=no-user-gesture-required'] },
  },
  webServer: {
    command: 'npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    { name: 'e2e', testMatch: /(flows|stories|library|previews|section-keys|catalog|object-anim|ui-strips|group-handle)\.spec\.ts/ },
    { name: 'shots', testMatch: /shots\.spec\.ts/ },
    { name: 'manual', testMatch: /manual\.spec\.ts/ },
  ],
});
