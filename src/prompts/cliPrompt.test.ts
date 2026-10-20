import { describe, expect, it } from 'vitest';
import { EXIT_MEANINGS } from '../cli/errors';
import { FIELDS, keyPath } from '../cli/fields';
import { META_FLAGS } from '../cli/flagList';
import { buildCliPrompt, CLI_FILES, SHARED_CORE } from './cliPrompt';
import { buildSpecPrompt } from './specPrompt';

// The core's modules, not its tests: importing a test file would run its tests here.
const modules = import.meta.glob(['../lib/*.ts', '!../lib/*.test.ts'], { eager: true }) as Record<string, Record<string, unknown>>;

describe('the CLI prompt', () => {
  const prompt = buildCliPrompt();

  it('says it builds on the app of the first prompt, which comes first', () => {
    expect(prompt).toMatch(/^# Build "tep", the Elegant Passwords command line\n\nThis is the second of two prompts\. \*\*Build the app from the first prompt first\.\*\*/);
    expect(buildSpecPrompt()).toContain('This is the first of two prompts: the second adds a command-line tool, tep, built on this app\'s shared core');
  });

  it('names only shared-core functions that exist, in the modules it says', () => {
    for (const m of SHARED_CORE) {
      const mod = modules[`../lib/${m.module}.ts`];
      expect(mod, m.module).toBeDefined();
      for (const name of m.names) expect(mod![name], `${m.module}.${name}`).toBeDefined();
      expect(prompt).toContain(`src/lib/${m.module}.ts`);
    }
  });

  it('lists every CLI file that exists', () => {
    const files = Object.keys(import.meta.glob('../cli/*.ts')).filter((f) => !/\.test\.ts$|testing\.ts$/.test(f)).map((f) => f.replace('../cli/', ''));
    const listed = CLI_FILES.flatMap(([f]) => f.split(', '));
    expect(new Set(listed)).toEqual(new Set(files));
  });

  it('covers every flag, config key and exit code from the live definitions', () => {
    for (const f of FIELDS) {
      expect(prompt, f.name).toContain(`\`${keyPath(f)}\``);
      expect(prompt, f.name).toContain(`--${f.name}`);
    }
    for (const m of META_FLAGS) expect(prompt, m.name).toContain(`--${m.name}`);
    for (const e of EXIT_MEANINGS) expect(prompt).toContain(`| ${e.code} | ${e.meaning} |`);
  });

  it('shows real messages, a real config file and a real review, generated from the code', () => {
    for (const s of [
      'tep g: error: these settings contradict each other, so no passwords were made:',
      'minimum length: 20 (from tep.yml line 3 (rules.min-length))',
      '1. The minimum length (40) is above the maximum length (32).',
      'No made-up sentence fits between 4 and 6 characters.',
      'tep g: warning: The strength target, Strong (50 bits), is out of reach',
      '# tep config, written by `tep config` on 2026-10-20.',
      'site: short-max-16',
      '1  Typing mode  Two-finger',
      'Space: not allowed: The separator is a space, but spaces are not allowed (from your answer for spaces)',
      '| Minimum length | 1 |',
      'Usage: tep g [flags]',
      'Usage: tep config [file]',
    ]) {
      expect(prompt, s).toContain(s);
    }
  });

  it('lists the CLI\'s tests, and the app prompt leaves them out', () => {
    expect(prompt).toContain('**src/cli/wizard.test.ts**');
    expect(prompt).toContain('**src/boundaries.test.ts**');
    expect(buildSpecPrompt()).not.toContain('**src/cli/');
  });
});
