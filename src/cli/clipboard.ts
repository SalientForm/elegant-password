// --copy: the first password onto the system clipboard, through the
// platform's own tool, chosen by platform and session (Linux and macOS;
// WSL through Windows' clip.exe). No tool found is an error that names the
// ones tep tried and how to get one, never a silent no-op.

import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { delimiter, join } from 'node:path';
import { clipboardTools } from './clipboardTools';
import { CliError, EXIT } from './errors';

export interface ClipboardRunner {
  /** Whether `command` is on the PATH. */
  exists(command: string, env: Record<string, string | undefined>): boolean;
  /** Run `command` with `input` on stdin; the exit status and anything it said on stderr. */
  run(command: string[], input: string): { status: number | null; stderr: string; error?: Error };
}

export const systemClipboard: ClipboardRunner = {
  exists(command, env) {
    for (const dir of (env.PATH ?? '').split(delimiter)) {
      if (!dir) continue;
      try {
        accessSync(join(dir, command), constants.X_OK);
        return true;
      } catch {
        // Not here.
      }
    }
    return false;
  },
  run(command, input) {
    const r = spawnSync(command[0]!, command.slice(1), { input, encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'ignore', 'pipe'] });
    return { status: r.status, stderr: (r.stderr ?? '').trim(), error: r.error };
  },
};

/** Copy `text` and return the tool used. Throws a CliError when no tool is found or the tool fails. */
export function copyToClipboard(text: string, platform: NodeJS.Platform, env: Record<string, string | undefined>, runner: ClipboardRunner): string {
  const tools = clipboardTools(platform, env);
  const tool = tools.find((t) => runner.exists(t.command[0]!, env));
  if (!tool) {
    const tried = tools.length ? `Tried ${tools.map((t) => `${t.command[0]} (${t.when})`).join(', ')}; none is installed.` : 'This session has no display (neither WAYLAND_DISPLAY nor DISPLAY is set), so there is no clipboard to copy to.';
    throw new CliError(EXIT.usage, '--copy found no clipboard tool, so nothing was copied.', [
      tried,
      platform === 'darwin' ? 'pbcopy comes with macOS; check that /usr/bin is on your PATH.' : 'Install wl-clipboard (Wayland) or xclip (X11), or leave out --copy and pipe instead: tep g | wl-copy',
    ]);
  }
  const r = runner.run(tool.command, text);
  if (r.error || r.status !== 0) {
    throw new CliError(EXIT.unexpected, `--copy: ${tool.command[0]} failed, so nothing was copied.`, [
      r.error ? r.error.message : `${tool.command.join(' ')} exited with status ${r.status}${r.stderr ? `: ${r.stderr}` : ''}.`,
    ]);
  }
  return tool.command[0]!;
}
