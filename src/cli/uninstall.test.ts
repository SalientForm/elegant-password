import {existsSync, lstatSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { EXIT } from './errors';
import { main } from './main';
import { fakeIo, scratch, type Step } from './testing';
import { findLinks } from './uninstall';

let root: string;
let home: string;
let checkout: string;
const built = () => join(checkout, 'dist-cli/tep.mjs');
/** Whether anything, even a broken link, is at the path. */
const there = (p: string) => {
  try {
    lstatSync(p);
    return true;
  } catch {
    return false;
  }
};

/** A directory with a `tep` linked to `target`. */
function linkIn(dir: string, target = built()) {
  mkdirSync(dir, { recursive: true });
  symlinkSync(target, join(dir, 'tep'));
  return join(dir, 'tep');
}

beforeEach(() => {
  root = scratch('tep-uninstall-');
  home = join(root, 'home');
  checkout = join(root, 'checkout');
  mkdirSync(join(checkout, 'dist-cli'), { recursive: true });
  writeFileSync(built(), '#!/usr/bin/env node\n');
});

async function uninstall(args: string[], over: { steps?: Step[]; stdinTTY?: boolean; env?: Record<string, string> } = {}) {
  const io = fakeIo({ stdinTTY: over.stdinTTY ?? true, steps: over.steps ?? [], env: { HOME: home, PATH: '', ...over.env } });
  const code = await main(['uninstall', ...args], io);
  return { code, io };
}

describe('findLinks', () => {
  it('finds tep in ~/.local/bin, $TEP_BIN_DIR and on the PATH, each once, and only links to a built tep', () => {
    const local = linkIn(join(home, '.local/bin'));
    const custom = linkIn(join(root, 'custom'));
    const onPath = linkIn(join(root, 'onpath'));
    linkIn(join(root, 'other'), '/usr/lib/node_modules/tep/cli.js');
    mkdirSync(join(root, 'file'));
    writeFileSync(join(root, 'file/tep'), 'a script of the user\'s own');
    const PATH = [join(root, 'onpath'), join(root, 'other'), join(root, 'file'), join(home, '.local/bin'), join(root, 'missing')].join(':');
    expect(findLinks({ HOME: home, TEP_BIN_DIR: join(root, 'custom'), PATH })).toEqual([
      { link: custom, target: built() },
      { link: local, target: built() },
      { link: onPath, target: built() },
    ]);
  });

  it('reads a relative link from its own directory, and a broken one still counts', () => {
    const dir = join(root, 'bin');
    mkdirSync(dir);
    symlinkSync('../gone/dist-cli/tep.mjs', join(dir, 'tep'));
    expect(findLinks({ HOME: home, PATH: dir })).toEqual([{ link: join(dir, 'tep'), target: join(root, 'gone/dist-cli/tep.mjs') }]);
  });
});

describe('tep uninstall', () => {
  it('lists the link, asks with no as the default, and removes it on yes', async () => {
    const link = linkIn(join(home, '.local/bin'));
    const { code, io } = await uninstall([], { steps: [{ confirm: true }] });
    expect(code).toBe(EXIT.ok);
    expect(there(link)).toBe(false);
    expect(existsSync(built())).toBe(true);
    expect(io.prompts.said[0]).toEqual({ kind: 'note', message: `${link}\n  -> ${built()}`, title: 'The link to remove' });
    expect(io.prompts.asked).toEqual([{ kind: 'confirm', message: 'Are you sure? tep will no longer run from your PATH.', initial: false }]);
    expect(io.prompts.said.slice(1).map((s) => s.message)).toEqual([
      `Removed ${link}.`,
      `The checkout stays, built: ${checkout}. pnpm link:cli there puts tep back.`,
      'A terminal that was already open may still look for tep there until you run hash -r.',
    ]);
  });

  it('removes nothing on no, or on Ctrl+C', async () => {
    const link = linkIn(join(home, '.local/bin'));
    const no = await uninstall([], { steps: [{ confirm: false }] });
    expect(no.code).toBe(EXIT.ok);
    expect(no.io.prompts.said.at(-1)!.message).toBe('Nothing was removed.');
    const cancelled = await uninstall([], { steps: [{ cancel: true }] });
    expect(cancelled.code).toBe(EXIT.interrupted);
    expect(cancelled.io.err()).toBe('tep uninstall: cancelled; nothing was removed.\n');
    expect(there(link)).toBe(true);
  });

  it('wraps the paths to the box, run-on text under the path, and the closing lines inside the guide bar', async () => {
    const link = linkIn(join(home, '.local/bin'));
    const io = fakeIo({ stdinTTY: true, steps: [{ confirm: true }], env: { HOME: home, PATH: '' } });
    io.prompts.noteWidth = 30;
    await main(['uninstall'], io);
    const lines = io.prompts.said[0]!.message.split('\n');
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(30);
    expect(lines.join('').replace(/ +/g, '')).toBe(`${link}->${built()}`);
    expect(lines.find((l) => l.startsWith('  ->'))).toBeDefined();
    expect(lines.filter((l) => !l.startsWith(' ')).join('')).toBe(link.slice(0, 30));
    for (const said of io.prompts.said.slice(1)) for (const l of said.message.split('\n')) expect(l.length).toBeLessThanOrEqual(33);
    expect(io.prompts.said.slice(1).map((s) => s.message.replace(/\n/g, '')).join('')).toContain(`stays, built: ${checkout}.`);
  });

  it('removes every link it finds, after one question', async () => {
    const a = linkIn(join(home, '.local/bin'));
    const b = linkIn(join(root, 'onpath'));
    const { io } = await uninstall([], { steps: [{ confirm: true }], env: { PATH: join(root, 'onpath') } });
    expect(io.prompts.said[0]!.title).toBe('The links to remove');
    expect([there(a), there(b)]).toEqual([false, false]);
  });

  it('with --yes, asks nothing and needs no terminal', async () => {
    const link = linkIn(join(home, '.local/bin'));
    const { code, io } = await uninstall(['-y'], { stdinTTY: false });
    expect(code).toBe(EXIT.ok);
    expect(io.prompts.asked).toEqual([]);
    expect(io.out()).toMatch(new RegExp(`^Removed ${link}\\.\\nThe checkout stays, built: `));
    expect(there(link)).toBe(false);
  });

  it('without a terminal or --yes, refuses and removes nothing', async () => {
    const link = linkIn(join(home, '.local/bin'));
    const { code, io } = await uninstall([], { stdinTTY: false });
    expect(code).toBe(EXIT.usage);
    expect(io.err()).toBe('tep uninstall: error: it asks before removing anything, so it needs a terminal, and stdin is not one.\n  Run it in a terminal, or say yes up front: tep uninstall --yes\n');
    expect(there(link)).toBe(true);
  });

  it('says so when there is nothing to remove, and leaves a tep that is not a link alone', async () => {
    mkdirSync(join(home, '.local/bin'), { recursive: true });
    writeFileSync(join(home, '.local/bin/tep'), 'mine');
    const { code, io } = await uninstall([]);
    expect(code).toBe(EXIT.ok);
    expect(io.out()).toBe('tep is not linked from your PATH, ~/.local/bin or $TEP_BIN_DIR; nothing to remove.\n');
    expect(io.prompts.asked).toEqual([]);
    expect(existsSync(join(home, '.local/bin/tep'))).toBe(true);
  });

  it('has help, and refuses an unknown flag with the likeliest one meant', async () => {
    expect((await uninstall(['--help'])).io.out()).toMatch(/^Usage: tep uninstall \[--yes \| -y\]/);
    const help = fakeIo();
    expect(await main(['help', 'uninstall'], help)).toBe(EXIT.ok);
    expect(help.out()).toMatch(/^Usage: tep uninstall/);
    const r = await uninstall(['--ye']);
    expect(r.code).toBe(EXIT.usage);
    expect(r.io.err()).toBe('tep uninstall: error: unknown flag --ye. Did you mean --yes?\n  tep uninstall takes --yes (-y) and nothing else.\n');
    const extra = await uninstall(['extra']);
    expect(extra.code).toBe(EXIT.usage);
    expect(extra.io.err()).toBe('tep uninstall: error: "extra" is not a flag: tep uninstall takes only flags.\n  tep uninstall takes --yes (-y) and nothing else.\n'); // never Node\'s own wording
    expect((await uninstall(['--no-color'])).code).toBe(EXIT.ok); // every command takes --no-color
  });
});
