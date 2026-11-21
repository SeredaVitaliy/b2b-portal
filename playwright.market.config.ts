import {defineConfig, devices} from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'market-browser.spec.ts',
  use: {baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure'},
  projects: [{name: 'chromium', use: {...devices['Desktop Chrome']}}],
  webServer: {
    command: 'node tests/market-browser-server.mjs',
    url: 'http://127.0.0.1:4175',
  },
});
