// Browser smoke tests, run after each iteration: `pnpm test:e2e`.
//
// Two targets, both inside this project's port block (4270-4279, see
// ~/.claude/CLAUDE.md): the production build on 4272, which checks the
// Content-Security-Policy and the bundled worker, and the dev server on
// 4273, which checks the React StrictMode path. The user's own dev server on
// 4270 is left alone.

import { defineConfig, devices } from '@playwright/test';

export const E2E_PORTS = { built: 4272, dev: 4273 } as const;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'built', use: { baseURL: `http://127.0.0.1:${E2E_PORTS.built}` } },
    { name: 'dev', use: { baseURL: `http://127.0.0.1:${E2E_PORTS.dev}` } },
  ],
  webServer: [
    {
      command: `pnpm build && pnpm exec vite preview --host 127.0.0.1 --port ${E2E_PORTS.built} --strictPort`,
      url: `http://127.0.0.1:${E2E_PORTS.built}/`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `pnpm exec vite --host 127.0.0.1 --port ${E2E_PORTS.dev} --strictPort`,
      url: `http://127.0.0.1:${E2E_PORTS.dev}/`,
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
