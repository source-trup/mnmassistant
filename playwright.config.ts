import { defineConfig, devices } from '@playwright/test';

/**
 * Tests: `npm test` runs everything (logic checks, then the app in a browser); `npm run test:unit` only the logic.
 *
 * The browser tests start the app with `ng serve` on port 4300 (or reuse one already running there) and never touch
 * the real outside sites: e2e/support/fixtures.ts answers MnMdb, the wiki API and MnM Atlas with small sample data.
 *
 * Locally they use the installed Microsoft Edge; in CI (GitHub Actions) Playwright's own Chromium.
 */
const CI = !!process.env['CI'];
const PORT = 4300;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : undefined,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: `http://localhost:${PORT}/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'unit', testMatch: /unit\/.*\.spec\.ts/ },
    {
      name: 'app',
      testMatch: /app\/.*\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1700, height: 1000 },
        ...(CI ? {} : { channel: 'msedge' }),
      },
    },
  ],
  webServer: {
    command: `npx ng serve --port ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !CI,
    timeout: 180_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
