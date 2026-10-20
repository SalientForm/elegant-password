import { lstatSync, mkdirSync, mkdtempSync, readlinkSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { linkCli } from './linkCli.mjs';

/** A project with a built tep, a home, and a bin directory on the PATH unless said otherwise. */
function setup({ built = true, onPath = true } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'tep-link-'));
  const root = join(base, 'project');
  mkdirSync(join(root, 'dist-cli'), { recursive: true });
  if (built) writeFileSync(join(root, 'dist-cli/tep.mjs'), '#!/usr/bin/env node\n', { mode: 0o755 });
  const home = join(base, 'home');
  const bin = join(home, '.local/bin');
  const env = { HOME: home, PATH: onPath ? `/usr/bin:${bin}` : '/usr/bin' };
  return { base, root, home, bin, env, link: join(bin, 'tep'), target: join(root, 'dist-cli/tep.mjs') };
}

describe('pnpm link:cli', () => {
  it('links ~/.local/bin/tep to the built file, making the directory', () => {
    const s = setup();
    const r = linkCli({ root: s.root, env: s.env });
    expect(r.code).toBe(0);
    expect(readlinkSync(s.link)).toBe(s.target);
    expect(r.lines).toEqual([`Linked ${s.link} -> ${s.target}.`, 'Run tep help to start. In a terminal that was already open, run hash -r first.']);
  });

  it('says so when the link is already there, and changes nothing', () => {
    const s = setup();
    linkCli({ root: s.root, env: s.env });
    expect(linkCli({ root: s.root, env: s.env }).lines[0]).toBe(`${s.link} already points to ${s.target}.`);
  });

  it('moves a link from another checkout to this one, saying where it pointed', () => {
    const s = setup();
    mkdirSync(s.bin, { recursive: true });
    symlinkSync('/gone/worktree/dist-cli/tep.mjs', s.link);
    const r = linkCli({ root: s.root, env: s.env });
    expect(readlinkSync(s.link)).toBe(s.target);
    expect(r.lines[0]).toBe(`Linked ${s.link} -> ${s.target} (it pointed to /gone/worktree/dist-cli/tep.mjs).`);
  });

  it('leaves a real file named tep alone and says what to do', () => {
    const s = setup();
    mkdirSync(s.bin, { recursive: true });
    writeFileSync(s.link, 'someone else\'s tep');
    const r = linkCli({ root: s.root, env: s.env });
    expect(r.code).toBe(1);
    expect(lstatSync(s.link).isSymbolicLink()).toBe(false);
    expect(r.lines[0]).toBe(`${s.link} is already there and is not a link; tep left it alone.`);
  });

  it('refuses before the build, naming the command that builds', () => {
    const s = setup({ built: false });
    const r = linkCli({ root: s.root, env: s.env });
    expect(r).toEqual({ code: 1, lines: [`${s.target} is not built yet. Run pnpm build:cli first (pnpm link:cli does both).`] });
  });

  it('says how to put the directory on the PATH when it is not', () => {
    const s = setup({ onPath: false });
    const r = linkCli({ root: s.root, env: s.env });
    expect(r.code).toBe(0);
    expect(r.lines.slice(1)).toEqual([
      `${s.bin} is not on your PATH, so the shell will not find tep yet. Add this line to ~/.bashrc or ~/.zshrc and open a new terminal:`,
      `  export PATH="${s.bin}:$PATH"`,
    ]);
  });

  it('warns when another tep comes first on the PATH', () => {
    const s = setup();
    const other = join(s.base, 'other');
    mkdirSync(other);
    writeFileSync(join(other, 'tep'), '', { mode: 0o755 });
    const r = linkCli({ root: s.root, env: { ...s.env, PATH: `${other}:${s.bin}` } });
    expect(r.lines.at(-1)).toBe(`Another tep comes first on your PATH: ${join(other, 'tep')}. Remove it, or put ${s.bin} earlier in PATH.`);
  });

  it('links into TEP_BIN_DIR instead when it is set', () => {
    const s = setup();
    const dir = join(s.base, 'bin');
    linkCli({ root: s.root, env: { ...s.env, TEP_BIN_DIR: dir, PATH: dir } });
    expect(readlinkSync(join(dir, 'tep'))).toBe(s.target);
  });

  it('--remove takes away only a link to a built tep', () => {
    const s = setup();
    expect(linkCli({ root: s.root, env: s.env, remove: true }).lines).toEqual([`There is no ${s.link}; nothing to remove.`]);
    linkCli({ root: s.root, env: s.env });
    expect(linkCli({ root: s.root, env: s.env, remove: true })).toEqual({ code: 0, lines: [`Removed ${s.link} (it pointed to ${s.target}).`] });
    writeFileSync(s.link, 'a file');
    expect(linkCli({ root: s.root, env: s.env, remove: true })).toEqual({ code: 1, lines: [`${s.link} is not a link to a built tep (a file); left as it is.`] });
  });
});
