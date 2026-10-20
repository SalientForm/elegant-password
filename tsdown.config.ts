import { defineConfig } from 'tsdown';

// The tep executable: one ESM file that needs only Node 24. Every dependency
// (yaml, zod, @clack/prompts) is inlined, so nothing is installed beside it.
export default defineConfig({
  entry: { tep: 'src/cli/bin.ts' },
  // TEP_OUT_DIR lets the bundle test build somewhere else, so pnpm test never rebuilds the tep on the PATH under its feet.
  outDir: process.env.TEP_OUT_DIR ?? 'dist-cli',
  format: 'esm',
  platform: 'node',
  target: 'node24',
  fixedExtension: true,
  clean: true,
  dts: false,
  deps: { alwaysBundle: [/.*/] },
  banner: { js: '#!/usr/bin/env node' },
});
