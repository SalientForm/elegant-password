// The built executable, run as a user would: pnpm build:cli, then node
// dist-cli/tep.mjs in a scratch directory. Checks the bundle starts with
// only Node (its dependencies inlined) and that exit codes and streams are
// what the spec says.

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { checkRequirements, DEFAULT_REQUIREMENTS } from '../lib/generate';
import pkg from '../../package.json';

const ROOT = new URL('../..', import.meta.url).pathname;
const BIN = join(ROOT, 'dist-cli', 'tep.mjs');
const cwd = mkdtempSync(join(tmpdir(), 'tep-bundle-'));

const tep = (args: string[], input?: string) => {
  const r = spawnSync(process.execPath, [BIN, ...args], { cwd, input: input ?? '', encoding: 'utf8', env: { PATH: process.env.PATH ?? '', NO_COLOR: '1' } });
  return { code: r.status, out: r.stdout, err: r.stderr };
};

beforeAll(() => {
  execFileSync('pnpm', ['build:cli'], { cwd: ROOT, stdio: 'pipe' });
}, 120_000);

describe('the tep bundle', () => {
  it('starts with a shebang and prints its version', () => {
    expect(execFileSync('head', ['-1', BIN], { encoding: 'utf8' }).trim()).toBe('#!/usr/bin/env node');
    expect(tep(['--version'])).toEqual({ code: 0, out: `tep ${pkg.version}\n`, err: '' });
  });

  it('piped, prints one password that keeps the default rules', () => {
    const r = tep(['g']);
    expect(r.code).toBe(0);
    expect(r.err).toBe('');
    const [pw, ...rest] = r.out.trimEnd().split('\n');
    expect(rest).toEqual([]);
    expect(checkRequirements(pw!, DEFAULT_REQUIREMENTS).filter((c) => !c.met)).toEqual([]);
  });

  it('JSON: every password meets every rule, by the engine\'s own checks', () => {
    const r = tep(['g', '-n', '5', '--site', 'short-max-16', '--format', 'json', '--quiet']);
    expect(r.code).toBe(0);
    const data = JSON.parse(r.out) as { suggestions: { password: string }[] };
    expect(data.suggestions).toHaveLength(5);
    const rules = { ...DEFAULT_REQUIREMENTS, minLength: 8, maxLength: 16, allowedSymbols: '!@#$%&*', allowSpaces: false };
    for (const s of data.suggestions) expect(checkRequirements(s.password, rules).filter((c) => !c.met), s.password).toEqual([]);
  });

  it('reads a sentence from stdin', () => {
    const r = tep(['g', '--sentence', '-', '--format', 'json'], 'Sally eats sweets on Sundays\n');
    expect(r.code).toBe(0);
    expect(JSON.parse(r.out).mode).toBe('sentence');
  });

  it('exits 2 for the command line, 3 for a contradiction, 4 for a bad config', () => {
    expect(tep(['g', '--bogus']).code).toBe(2);
    const c = tep(['g', '--min-length', '20', '--max-length', '16']);
    expect(c.code).toBe(3);
    expect(c.out).toBe('');
    expect(c.err).toMatch(/^tep g: error: these settings contradict each other/);
    writeFileSync(join(cwd, 'bad.yml'), 'version: 1\nrules: [\n');
    expect(tep(['g', '-c', 'bad.yml']).code).toBe(4);
  });

  it('tep config needs a terminal, and says so', () => {
    const r = tep(['config']);
    expect(r.code).toBe(2);
    expect(r.err).toContain('it asks questions, so it needs a terminal');
  });

  it('stops quietly when the reader goes away (tep g | head -1)', () => {
    const r = spawnSync('sh', ['-c', `"${process.execPath}" "${BIN}" g -n 20 | head -1`], { cwd, encoding: 'utf8' });
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
    expect(r.stdout.trimEnd().split('\n')).toHaveLength(1);
  });
});
