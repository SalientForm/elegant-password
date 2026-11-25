// The package's API (spec §5), through its one entry, src/lib/index.ts.
// That tep resolves a configuration to the same settings is held in
// src/cli/resolve.test.ts, since the core's tests do not reach the CLI.

import { describe, expect, it } from 'vitest';
import * as api from '../index';
import { DEFAULT_REQUIREMENTS } from '../generate';
import { MAX_RULES_TEXT_LENGTH } from '../ruleText';
import { difficultyIn } from '../difficulty';
import { scoreCold } from '../score';
import { rawBits, strengthBits } from '../strength';
import { scoreReadings } from '../readings';
import { settingsData } from './config';

const {
  APP_MODES,
  CONFIG_VERSION,
  DEFAULT_CONFIG,
  FIELDS,
  SITE_PRESETS,
  STRENGTH_PRESETS,
  TYPING_MODES,
  configFromYaml,
  configToYaml,
  generate,
  readRulesText,
  resolveConfig,
  scorePassword,
} = api;

/** Settings for a configuration that must resolve. */
function settingsFor(config: unknown) {
  const r = resolveConfig(config);
  if (!r.ok) throw new Error(JSON.stringify(r.problems));
  return r;
}

describe('the index', () => {
  it('exports only the names spec §5 gives, and the zxcvbn reading is not one of them', () => {
    expect(Object.keys(api).sort()).toEqual(
      ['APP_MODES', 'CONFIG_VERSION', 'DEFAULT_CONFIG', 'FIELDS', 'SITE_PRESETS', 'STRENGTH_PRESETS', 'TYPING_MODES', 'configFromYaml', 'configToYaml', 'generate', 'readRulesText', 'resolveConfig', 'scorePassword'].sort(),
    );
  });
});

describe('the choices', () => {
  it('name the modes and presets as a configuration does', () => {
    expect(APP_MODES.map((m) => m.name)).toEqual(['sentences']);
    expect(TYPING_MODES.map((m) => m.name)).toEqual(['two-finger', 'ten-finger', 'one-handed', 'quick']);
    expect(TYPING_MODES.every((m) => m.label && m.description)).toBe(true);
    expect(SITE_PRESETS.find((p) => p.name === 'short-max-16')).toEqual({
      name: 'short-max-16',
      label: 'Short max (16)',
      note: '8-16, !@#$%&*',
      rules: { 'min-length': 8, 'max-length': 16, 'min-uppercase': 1, 'min-lowercase': 0, 'min-digits': 1, 'min-symbols': 1, symbols: '!@#$%&*', spaces: false },
    });
    expect(STRENGTH_PRESETS.map((p) => [p.name, p.bits])).toEqual([
      ['minimal', 4],
      ['everyday', 40],
      ['strong', 50],
      ['very-strong', 60],
      ['master-password', 72],
    ]);
    expect(DEFAULT_CONFIG).toEqual({ version: CONFIG_VERSION });
    expect(CONFIG_VERSION).toBe(2);
  });

  it('list every rules, options and sentence key with its default, symbols filled with the default set', () => {
    expect(FIELDS.map((f) => f.section)).toEqual([...Array(8).fill('rules'), ...Array(13).fill('options'), ...Array(7).fill('sentence')]);
    const field = (key: string) => FIELDS.find((f) => f.key === key)!;
    expect(field('rules.symbols')).toMatchObject({ kind: 'symbols', default: DEFAULT_REQUIREMENTS.allowedSymbols, label: 'Allowed symbols' });
    expect(field('rules.max-length')).toMatchObject({ kind: 'int', min: 1, max: 128, default: DEFAULT_REQUIREMENTS.maxLength });
    expect(field('options.strength')).toMatchObject({ kind: 'strength', min: 0, max: 256, default: 'everyday' });
    expect(field('options.strength').choices!.map((c) => c.value)).toEqual(STRENGTH_PRESETS.map((p) => p.name));
    expect(field('options.separator')).toMatchObject({ kind: 'separator', default: 'auto' });
    expect(field('options.separator').choices!.map((c) => c.value)).toEqual(['auto', 'space', 'none']);
    expect(field('sentence.target-length')).toMatchObject({ kind: 'target-length', default: 'none' });
    expect(field('options.comfort').choices!.map((c) => c.value)).toEqual(['strict', 'balanced', 'relaxed']);
  });

  it('are frozen, so a caller cannot change them by accident', () => {
    expect(Object.isFrozen(FIELDS)).toBe(true);
    expect(Object.isFrozen(SITE_PRESETS[0]!.rules)).toBe(true);
    expect(Object.isFrozen(DEFAULT_CONFIG)).toBe(true);
  });
});

describe('resolveConfig', () => {
  it('resolves the configuration that states nothing to the defaults and the ten-finger options', () => {
    const r = settingsFor(DEFAULT_CONFIG);
    expect(r).toMatchObject({ warnings: [], notes: [], changed: [] });
    expect(settingsData(r.settings)).toMatchObject({ req: DEFAULT_REQUIREMENTS, typingMode: 'ten-finger' });
  });

  it('names the keys of every schema problem at once', () => {
    const r = resolveConfig({ version: 2, rules: { 'max-lenght': 20, 'min-digits': 9 }, 'typing-mode': 'three-finger' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.problems.map((p) => p.keys)).toEqual([['rules', 'max-lenght'].join('.')].map((k) => [k]));
    // zod's shape check stops the rest; with the shape right, every value problem comes back.
    const values = resolveConfig({ version: 2, rules: { 'min-digits': 9 }, 'typing-mode': 'three-finger' });
    expect(!values.ok && values.problems.map((p) => p.keys)).toEqual([['typing-mode'], ['rules.min-digits']]);
    expect(!values.ok && values.problems[0]!.message).toContain('Did you mean');
  });

  it('names the keys of a contradiction, and fixes nothing to fit', () => {
    const r = resolveConfig({ version: 2, rules: { 'min-length': 30, 'max-length': 20 } });
    expect(r).toEqual({ ok: false, problems: [{ keys: ['rules.min-length', 'rules.max-length'], message: 'The minimum length (30) is above the maximum (20).' }] });
    const sep = resolveConfig({ version: 2, site: 'no-symbols', options: { separator: ';' } });
    expect(!sep.ok && sep.problems.map((p) => p.keys)).toEqual([['options.separator']]);
  });

  it('warns of a target out of reach and of an option the typing mode has no use for, and still resolves', () => {
    const r = settingsFor({ version: 2, site: 'short-max-16', 'typing-mode': 'two-finger', options: { strength: 'master-password', 'avoid-pinky': true } });
    expect(r.warnings.map((w) => w.keys)).toEqual([['options.strength', 'rules.max-length'], ['options.avoid-pinky']]);
    expect(r.warnings[1]!.message).toBe(
      'options.avoid-pinky sets avoid pinky stretches to on, which Two-finger typing has no use for (two index fingers have no pinky to stretch). It still shapes the passwords as set.',
    );
    // The mode's own value for an option it has no use for is not the user's doing: no warning.
    expect(settingsFor({ version: 2, 'typing-mode': 'two-finger' }).warnings).toEqual([]);
  });

  it('lists the options that differ from the typing mode\'s own as changed', () => {
    expect(settingsFor({ version: 2, 'typing-mode': 'quick', options: 'preset' }).changed).toEqual([]);
    expect(settingsFor({ version: 2, options: { strength: 'everyday', comfort: 'strict', swaps: 3 } }).changed).toEqual(['comfort', 'swaps']);
  });

  it('reads a version 1 configuration, its mode as the typing mode, and says so', () => {
    const r = settingsFor({ version: 1, mode: 'quick' });
    expect(settingsData(r.settings).typingMode).toBe('quick');
    expect(r.notes).toHaveLength(1);
  });

  it('gives settings that are plain data, safe to keep and to send between threads', () => {
    const { settings } = settingsFor({ version: 2, site: 'nist-passphrase', swaps: { off: ['o>0'], custom: [{ from: 'tion', to: 'shn' }] } });
    expect(structuredClone(settings)).toEqual(settings);
    expect(JSON.parse(JSON.stringify(settings))).toEqual(settings);
  });
});

describe('generate', () => {
  const { settings } = settingsFor({ version: 2 });

  it('draws a made-up sentence and gives one password with exact bits, readings and rule checks', () => {
    const o = generate(settings);
    expect(o.ok).toBe(true);
    if (!o.ok) return;
    expect(o.suggestions).toHaveLength(1);
    const [s] = o.suggestions;
    expect(s!.hint).toBe(o.sentence!.text);
    expect(s!.bits).toBeGreaterThan(0);
    expect(s!.checks.every((c) => c.met)).toBe(true);
    expect(Object.keys(s!.readings)).toEqual(['strength', 'raw', 'difficulty', 'memorability']);
    expect(s!.readings.difficulty.text).toContain('(ten-finger)');
  });

  it('keeps a drawn sentence for Refresh, even after a round trip through JSON', () => {
    const first = generate(settings);
    if (!first.ok) throw new Error(first.problem.message);
    const again = generate(settings, { sentence: JSON.parse(JSON.stringify(first.sentence)), count: 3 });
    expect(again.ok && again.suggestions.map((s) => s.hint)).toEqual(Array(again.ok ? again.suggestions.length : 0).fill(first.sentence!.text));
    expect(again.ok && again.sentence!.text).toBe(first.sentence!.text);
  });

  it('fits a string as the user\'s own sentence: scores, no exact bits, no drawn sentence', () => {
    const o = generate(settings, { sentence: 'Sally eats sweets on Sundays', count: 2 });
    expect(o.ok).toBe(true);
    if (!o.ok) return;
    expect(o.sentence).toBeUndefined();
    expect(o.suggestions.length).toBeGreaterThan(0);
    for (const s of o.suggestions) {
      expect(s.hint).toContain('Sally eats sweets on Sundays'); // padding may add to it
      expect(s.bits).toBeUndefined();
      expect(s.readings.memorability.value).not.toBe('n/a');
    }
  });

  it('scores Difficulty for the configuration\'s typing mode', () => {
    const quick = settingsFor({ version: 2, 'typing-mode': 'quick' }).settings;
    const o = generate(quick);
    expect(o.ok && o.suggestions[0]!.readings.difficulty.text).toContain('(minimal-quick)');
  });

  it('gives a problem, never a throw, for a sentence or a count that cannot be used', () => {
    expect(generate(settings, { sentence: '   ' })).toMatchObject({ ok: false, problem: { keys: [] } });
    expect(generate(settings, { sentence: '!!! ???' })).toMatchObject({ ok: false });
    expect(generate(settings, { count: 0 })).toMatchObject({ ok: false, problem: { message: 'count must be a whole number from 1 to 20; found 0.' } });
    expect(generate(settings, { count: 2.5 })).toMatchObject({ ok: false });
    expect(generate(settings, { sentence: { text: 'not drawn' } as unknown as api.DrawnSentence })).toMatchObject({ ok: false });
  });
});

describe('scorePassword', () => {
  it('reads a password as My list does, from the password and hint alone', () => {
    const password = 'Devoted;sierras;w@rm;2;s4yls';
    const hint = 'devoted sierras warm 2 sails';
    const cold = scoreCold(password, hint);
    expect(scorePassword(password, hint, 'one-handed')).toEqual(
      scoreReadings({ strength: strengthBits(password), raw: rawBits(password), difficulty: difficultyIn(password, cold.difficulty, 'one-handed'), memorability: cold.memorability.score }),
    );
    expect(scorePassword(password, hint).difficulty.text).toContain('(ten-finger)');
  });

  it('has no Memorability without a hint, and refuses a typing mode that does not exist', () => {
    expect(scorePassword('Devoted;sierras;w@rm;2;s4yls', ' ').memorability.value).toBe('n/a');
    expect(() => scorePassword('x', 'y', 'three-finger')).toThrow(RangeError);
    expect(scorePassword('x', 'y', 'minimal-quick').difficulty.text).toContain('(minimal-quick)'); // a label's name is taken too
  });
});

describe('readRulesText', () => {
  it('reads sign-up text as rules values in config keys, ready to merge into rules', () => {
    expect(readRulesText('8-20 characters, at least one number and one of !@#$%')).toEqual({
      rules: { 'min-length': 8, 'max-length': 20, 'min-digits': 1, 'min-symbols': 1, symbols: '!@#$%' },
      understood: ['8-20 characters', 'a digit', 'a symbol from !@#$%'],
      unsupported: [],
    });
  });

  it('takes symbols it rules out from the default set', () => {
    const r = readRulesText('any symbol except ; and ?');
    expect(r.rules.symbols).toBe([...DEFAULT_REQUIREMENTS.allowedSymbols].filter((c) => c !== ';' && c !== '?').join(''));
  });

  it('names a rule it cannot keep, and refuses text past the cap whole', () => {
    expect(readRulesText('exactly 300 characters').unsupported).toHaveLength(1);
    const long = readRulesText(`8-20 characters ${'x'.repeat(MAX_RULES_TEXT_LENGTH)}`);
    expect(long).toMatchObject({ rules: {}, understood: [] });
    expect(long.unsupported).toHaveLength(1);
  });
});

describe('configToYaml and configFromYaml', () => {
  const config: api.Config = {
    version: 2,
    'app-mode': 'sentences',
    'typing-mode': 'two-finger',
    site: 'short-max-16',
    rules: { 'max-length': 14, symbols: '!@#' },
    options: { strength: 'strong', separator: 'none' },
    sentence: { shrink: 'ends', 'target-length': 'none' },
    swaps: { off: ['o>0'], custom: [{ from: 'tion', to: 'shn' }] },
  };

  it('round-trip a configuration', () => {
    const text = configToYaml(config);
    expect(text).toMatch(/^version: 2\n/);
    expect(configFromYaml(text)).toEqual({ ok: true, config });
  });

  it('read a version 1 file as version 2', () => {
    expect(configFromYaml('version: 1\nmode: quick\nrules:\n  max-length: 20\n')).toEqual({ ok: true, config: { version: 2, 'typing-mode': 'quick', rules: { 'max-length': 20 } } });
  });

  it('give every problem with its line and key path', () => {
    const r = configFromYaml('version: 2\nrules:\n  max-length: 999\n  min-digits: lots\n');
    expect(r.ok).toBe(false);
    expect(!r.ok && r.problems.map((p) => [p.line, p.path])).toEqual([
      [3, 'rules.max-length'],
      [4, 'rules.min-digits'],
    ]);
  });

  it('refuse to write a configuration that is not one', () => {
    expect(() => configToYaml({ version: 2, rules: { 'max-length': 999 } })).toThrow(TypeError);
  });
});
