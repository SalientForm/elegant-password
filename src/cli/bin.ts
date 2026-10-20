// The tep executable: the real terminal, environment and clipboard, handed
// to main. The bundle (pnpm build:cli) starts here.

import { systemClipboard } from './clipboard';
import type { Io } from './io';
import { main } from './main';
import { clackPrompter } from './prompter';

function readAll(): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => (text += chunk));
    process.stdin.on('end', () => resolve(text));
    process.stdin.on('error', reject);
  });
}

// Output piped into something that stops reading (tep g | head -1) is not an error.
process.stdout.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EPIPE') process.exit(0);
  throw e;
});

const io: Io = {
  stdout: { write: (s) => void process.stdout.write(s), isTTY: !!process.stdout.isTTY },
  stderr: { write: (s) => void process.stderr.write(s), isTTY: !!process.stderr.isTTY },
  stdin: { isTTY: !!process.stdin.isTTY, readAll },
  env: process.env,
  cwd: process.cwd(),
  platform: process.platform,
  now: () => new Date(),
  prompter: clackPrompter,
  clipboard: systemClipboard,
};

void main(process.argv.slice(2), io).then((code) => {
  process.exitCode = code;
});
