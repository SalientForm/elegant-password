// Puts tep on the PATH: a symlink to the built dist-cli/tep.mjs from
// ~/.local/bin (or $TEP_BIN_DIR). The bundle needs only Node, so nothing is
// installed, and a rebuild needs no relinking. Not `pnpm link`: from pnpm 10
// on it takes a directory and adds it as a dependency of this project, which
// leaves node_modules out of step with the lockfile.
// Run with `pnpm link:cli` (builds first); `pnpm unlink:cli` removes the link.
import { existsSync, lstatSync, mkdirSync, readlinkSync, rmSync, statSync, symlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');

/** Whether anything, even a broken symlink, is at the path. */
const occupied = (p) => {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

/** The first `tep` a shell would run with this PATH, if any. */
function firstOnPath(path) {
  for (const d of path.split(delimiter).filter(Boolean)) {
    const p = join(d, 'tep');
    try {
      if (statSync(p).isFile()) return p;
    } catch {
      // nothing runnable here
    }
  }
  return undefined;
}

/**
 * Links (or with `remove`, unlinks) tep. Returns what to print and the exit
 * code; touches nothing but the one link.
 * @param {{ root?: string, env?: Record<string, string | undefined>, remove?: boolean }} [opts]
 * @returns {{ code: number, lines: string[] }}
 */
export function linkCli({ root = ROOT, env = process.env, remove = false } = {}) {
  const dir = resolve(env.TEP_BIN_DIR || join(env.HOME || homedir(), '.local/bin'));
  const link = join(dir, 'tep');
  const target = join(root, 'dist-cli/tep.mjs');
  const ours = occupied(link) && lstatSync(link).isSymbolicLink() ? readlinkSync(link) : undefined;

  if (remove) {
    if (!occupied(link)) return { code: 0, lines: [`There is no ${link}; nothing to remove.`] };
    if (ours === undefined || !ours.endsWith('dist-cli/tep.mjs')) return { code: 1, lines: [`${link} is not a link to a built tep (${ours ?? 'a file'}); left as it is.`] };
    rmSync(link);
    return { code: 0, lines: [`Removed ${link} (it pointed to ${ours}).`] };
  }

  if (!existsSync(target)) return { code: 1, lines: [`${target} is not built yet. Run pnpm build:cli first (pnpm link:cli does both).`] };
  if (occupied(link) && ours === undefined) {
    return { code: 1, lines: [`${link} is already there and is not a link; tep left it alone.`, `  Move it away, or set TEP_BIN_DIR to another directory on your PATH, and run this again.`] };
  }

  const lines = [];
  if (ours === target) lines.push(`${link} already points to ${target}.`);
  else {
    mkdirSync(dir, { recursive: true });
    if (ours !== undefined) rmSync(link);
    symlinkSync(target, link);
    lines.push(`Linked ${link} -> ${target}${ours !== undefined ? ` (it pointed to ${ours})` : ''}.`);
  }

  const path = env.PATH ?? '';
  const first = firstOnPath(path);
  if (!path.split(delimiter).some((d) => d && resolve(d) === dir)) {
    lines.push(
      `${dir} is not on your PATH, so the shell will not find tep yet. Add this line to ~/.bashrc or ~/.zshrc and open a new terminal:`,
      `  export PATH="${dir}:$PATH"`,
    );
  } else if (first && resolve(first) !== link) {
    lines.push(`Another tep comes first on your PATH: ${first}. Remove it, or put ${dir} earlier in PATH.`);
  } else {
    lines.push('Run tep help to start. In a terminal that was already open, run hash -r first.');
  }
  return { code: 0, lines };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { code, lines } = linkCli({ remove: process.argv.includes('--remove') });
  (code ? console.error : console.log)(lines.join('\n'));
  process.exitCode = code;
}
