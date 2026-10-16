/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { cspPlugin } from './build/csp.ts';

// Ports 4270-4279 are this project's block (see ~/.claude/CLAUDE.md).
export default defineConfig({
  // GitHub Pages serves the app under /elegant-password/; the deploy workflow sets BASE_PATH.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react(), cspPlugin()],
  worker: { format: 'es' },
  // Remote access goes through Tailscale Serve (https://lean.tail4b6ff1.ts.net:4270).
  server: { host: '127.0.0.1', port: 4270, strictPort: true, allowedHosts: ['lean.tail4b6ff1.ts.net'] },
  preview: { host: '127.0.0.1', port: 4271, strictPort: true },
  // Unit tests only; the browser smoke tests in e2e/ run under Playwright (pnpm test:e2e).
  test: { exclude: [...configDefaults.exclude, 'e2e/**', '.claude/**'] }, // .claude holds review agents' scratch worktrees
});
