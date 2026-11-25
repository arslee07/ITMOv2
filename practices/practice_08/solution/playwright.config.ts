import { defineConfig, devices } from '@playwright/test'

const slowMo = Number(process.env.PW_SLOWMO ?? 200)

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { slowMo },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node server/server.mjs --api-only',
      url: 'http://127.0.0.1:8787/api/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'node node_modules/vite/bin/vite.js',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
})
