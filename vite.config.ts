import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ports 4270-4279 are this project's block (see ~/.claude/CLAUDE.md).
export default defineConfig({
  plugins: [react()],
  // Remote access goes through Tailscale Serve (https://lean.tail4b6ff1.ts.net:4270).
  server: { host: '127.0.0.1', port: 4270, strictPort: true, allowedHosts: ['lean.tail4b6ff1.ts.net'] },
  preview: { host: '127.0.0.1', port: 4271, strictPort: true },
});
