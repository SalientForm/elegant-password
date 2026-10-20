import { defineConfig } from 'tsdown';

// The tep executable: one ESM file that needs only Node 24. Every dependency
// (yaml, zod, @clack/prompts) is inlined, so nothing is installed beside it.
export default defineConfig({
  entry: { tep: 'src/cli/bin.ts' },
  outDir: 'dist-cli',
  format: 'esm',
  platform: 'node',
  target: 'node24',
  fixedExtension: true,
  clean: true,
  dts: false,
  deps: { alwaysBundle: [/.*/] },
  banner: { js: '#!/usr/bin/env node' },
});
