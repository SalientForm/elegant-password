import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { featureCoverage, featureSources, testInventory, wayfinder } from '@salientform/workspace-wayfinder/vite';
import settings from './src/workspace.config.mts';

// The repository root: every path in workspace.config.mts is relative to it. import.meta.dirname, not __dirname, which
// Vite 8's native config loader does not provide.
const REPO_ROOT = path.resolve(import.meta.dirname, '..');

export default defineConfig({
  root: import.meta.dirname,
  // Served under a sub-path when deployed beside the product (e.g. WORKSPACE_BASE=/workspace/); local dev stays at /.
  base: process.env.WORKSPACE_BASE || '/',
  // No port here: wayfinder() serves on the config's `ports` (strictPort, 127.0.0.1). A repository whose ports live in
  // its environment passes them as wayfinder({ settings, repoRoot, ports }). To reach the app through a tunnel or
  // proxy, add its host suffix: server: { allowedHosts: ['.ts.net'] } behind Tailscale Serve.
  // Remote access goes through Tailscale Serve (https://lean.tail4b6ff1.ts.net:4274), as for the product on 4270.
  server: { allowedHosts: ['lean.tail4b6ff1.ts.net'] },
  plugins: [
    react(),
    // virtual:workspace-content: every file the settings' content collections cover, bundled at build time; and the
    // dev and preview servers on the config's ports.
    wayfinder({ settings, repoRoot: REPO_ROOT }),
    // The Features area's source scan, test inventory and coverage summaries, each empty while the area, its tests or
    // its coverage is a placeholder. Their modules are declared by @salientform/workspace-wayfinder/env (tsconfig.json's
    // types).
    featureSources({ settings, repoRoot: REPO_ROOT }),
    testInventory({ settings, repoRoot: REPO_ROOT }),
    featureCoverage({ settings, repoRoot: REPO_ROOT }),
  ],
  // One bundle, the areas and the repository's documents in it: a development tool loaded once, so Vite's 500 kB
  // warning is raised to what a workspace weighs.
  build: { outDir: './dist', emptyOutDir: true, chunkSizeWarningLimit: 4000 },
});
