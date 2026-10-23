import { describe, expect, it } from 'vitest';
import { CliError } from './errors';
import { FIELDS, fieldsIn } from './fields';
import { parseGenerateArgs } from './flags';
import { CONFIG_HELP, generateHelp, OVERVIEW } from './help';
import { lookup, MODE_NAMES, SITE_NAMES } from './names';

describe('help and examples', () => {
  it('name only typing modes and site presets that exist', () => {
    const commands = [OVERVIEW, generateHelp()].join('\n').split('\n').filter((l) => /^\s+tep /.test(l)).join('\n');
    const named = [...commands.matchAll(/--(mode|site) (\S+)/g), ...CONFIG_HELP.matchAll(/^\s+(mode|site): (\S+)/gm)];
    expect(named.length).toBeGreaterThanOrEqual(4);
    for (const [, what, name] of named) {
      const found = what === 'mode' ? lookup(what, MODE_NAMES, name!).ok : lookup(what!, SITE_NAMES, name!).ok;
      expect(found, `${what} ${name}`).toBe(true);
    }
  });

  it('give, with each refused value, an example that parses', () => {
    const flags = ['mode', 'site', 'format', ...FIELDS.filter((f) => f.kind.type !== 'bool').map((f) => f.name)];
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
