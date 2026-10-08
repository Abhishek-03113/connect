import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;

// Local-only dev tooling (git-excluded). Run from this folder: `bun install && bun run test`.
// End-to-end tests run against the dev server in demo mode (/demo), so they
// need no account, device or network access to comma's APIs.
export default defineConfig({
  testDir: '.',
  timeout: 30 * 1000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: `bun start -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    cwd: '..',
    timeout: 60 * 1000,
  },
});
