import { describe, expect, it } from 'vitest';
import { CliError } from './errors';
import { FIELDS, fieldsIn } from './fields';
import { parseGenerateArgs } from './flags';
import { CONFIG_HELP, generateHelp, OVERVIEW } from './help';
import { APP_MODE_NAMES, lookup, MODE_NAMES, SITE_NAMES } from '../lib/config/names';

describe('help and examples', () => {
  it('name only app modes, typing modes and site presets that exist', () => {
    const commands = [OVERVIEW, generateHelp()].join('\n').split('\n').filter((l) => /^\s+tep /.test(l)).join('\n');
    const named = [...commands.matchAll(/--(typing-mode|site) (\S+)/g), ...CONFIG_HELP.matchAll(/^\s+(app-mode|typing-mode|site): (\S+)/gm)];
    expect(named.length).toBeGreaterThanOrEqual(5);
    for (const [, what, name] of named) {
      const names = what === 'app-mode' ? APP_MODE_NAMES : what === 'typing-mode' ? MODE_NAMES : SITE_NAMES;
      const found = lookup(what!, names as typeof SITE_NAMES, name!).ok;
      expect(found, `${what} ${name}`).toBe(true);
    }
  });

  it('give, with each refused value, an example that parses', () => {
    const flags = ['typing-mode', 'site', 'format', ...FIELDS.filter((f) => f.kind.type !== 'bool').map((f) => f.name)];
    const sentence = new Set(fieldsIn('sentence').map((f) => f.name));
    for (const flag of flags) {
      let details: readonly string[] = [];
      try {
        parseGenerateArgs([`--${flag}`, 'zz%%']);
      } catch (e) {
        if (e instanceof CliError) details = e.details;
      }
      const example = details.map((d) => d.match(/^For example: --(\S+) (.+)$/)).find(Boolean);
      expect(example, flag).toBeTruthy();
      const [, name, value] = example!;
      expect(name).toBe(flag);
      const argv = [`--${name}`, value!.replace(/^(['"])(.*)\1$/, '$2'), ...(sentence.has(flag) ? ['--sentence', '-'] : [])];
      expect(() => parseGenerateArgs(argv), argv.join(' ')).not.toThrow();
    }
  });
});
