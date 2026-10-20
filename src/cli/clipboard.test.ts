import {writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { systemClipboard } from './clipboard';
import { clipboardTools } from './clipboardTools';
import { scratch } from './testing';

describe('clipboard tools', () => {
  it('macOS: pbcopy, whatever the session', () => {
    expect(clipboardTools('darwin', { DISPLAY: ':0' }).map((t) => t.command[0])).toEqual(['pbcopy']);
  });

  it('Linux: Wayland first, then X11 (xclip, xsel), then WSL\'s clip.exe, only for the sessions there are', () => {
    expect(clipboardTools('linux', { WAYLAND_DISPLAY: 'w', DISPLAY: ':0', WSL_DISTRO_NAME: 'U' }).map((t) => t.command[0])).toEqual(['wl-copy', 'xclip', 'xsel', 'clip.exe']);
    expect(clipboardTools('linux', {}).map((t) => t.command[0])).toEqual([]);
  });

  it('finds a tool only when it is an executable file on the PATH', () => {
    const dir = scratch('tep-path-');
    writeFileSync(join(dir, 'wl-copy'), '#!/bin/sh\n', { mode: 0o755 });
    writeFileSync(join(dir, 'xclip'), 'not executable', { mode: 0o644 });
    expect(systemClipboard.exists('wl-copy', { PATH: `/nonexistent:${dir}` })).toBe(true);
    expect(systemClipboard.exists('xclip', { PATH: dir })).toBe(false);
    expect(systemClipboard.exists('wl-copy', {})).toBe(false);
  });

  it('runs a tool with the text on stdin and reports its exit status', () => {
    expect(systemClipboard.run(['sh', '-c', 'read x; test "$x" = "secret"'], 'secret\n').status).toBe(0);
    expect(systemClipboard.run(['sh', '-c', 'echo nope >&2; exit 3'], '')).toEqual({ status: 3, stderr: 'nope', error: undefined });
  });
});
