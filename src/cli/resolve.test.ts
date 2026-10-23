import { describe, expect, it } from 'vitest';
import { DEFAULT_SENTENCE_OPTIONS } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS } from '../lib/generate';
import { profileValues, withProfile } from '../lib/modeProfiles';
import { MAX_RULES_TEXT_LENGTH } from '../lib/ruleText';
import { applyPreset, SITE_PRESETS } from '../lib/sitePresets';
import { CliError, EXIT } from './errors';
import { emptyLayer, resolve } from './resolve';
import { fileAt, fileLayer, flag, flagsLayer } from './testing';

const tty = { tty: true };

describe('resolve: the layers', () => {
  it('with nothing given is the defaults, ten-finger, difficulty order, 5 passwords at a terminal', () => {
    const r = resolve(undefined, emptyLayer(), tty);
    expect(r.generation).toEqual({ mode: 'generated', req: { ...DEFAULT_REQUIREMENTS, count: 5 }, sentence: '', sentenceOptions: DEFAULT_SENTENCE_OPTIONS, mappingSettings: { disabled: [], custom: [] } });
    expect(r.typingMode).toBe('ten-finger');
    expect(r.sort).toBe('difficulty');
    expect(r.sources['max-length']).toEqual({ kind: 'default' });
    expect(r.sources.separator).toEqual({ kind: 'mode', mode: 'ten-finger', via: { kind: 'default' } });
    expect(r.sources.mode).toEqual({ kind: 'default' });
  });

  it('makes 1 password when output is piped, and says the default came from that', () => {
    const r = resolve(undefined, emptyLayer(), { tty: false });
    expect(r.count).toBe(1);
    expect(r.generation.req.count).toBe(1);
    expect(r.sources.count).toEqual({ kind: 'terminal', tty: false });
  });

  it('applies a site preset, then rule values over it; the file first, the flags over the file', () => {
    const file = fileLayer({ 'rules.min-length': 14, 'rules.max-length': 40 }, { site: 'no-spaces' });
    const flags = flagsLayer({ 'max-length': 30 });
    const r = resolve(file, flags, tty);
    expect(r.generation.req.allowSpaces).toBe(false);
    expect(r.sources.spaces).toEqual({ kind: 'site', preset: 'no-spaces', via: fileAt(2, 'site') });
    expect(r.generation.req.minLength).toBe(14);
    expect(r.sources['min-length']).toEqual(fileAt(3, 'rules.min-length'));
    expect(r.generation.req.maxLength).toBe(30);
    expect(r.sources['max-length']).toEqual(flag('max-length'));
  });

  it('a site preset on the command line replaces the file\'s rules', () => {
    const r = resolve(fileLayer({ 'rules.min-length': 14 }), flagsLayer({}, { site: 'short-max-16' }), tty);
    expect(r.generation.req).toMatchObject(SITE_PRESETS[3]!.rules);
    expect(r.sources['min-length']).toEqual({ kind: 'site', preset: 'short-max-16', via: flag('site') });
  });

  it('gives the same requirements as the web app for every site preset and mode (the web settles, but these need no fixing)', () => {
    for (const preset of SITE_PRESETS) {
      for (const mode of ['ten-finger', 'two-finger', 'one-handed', 'quick'] as const) {
        const name = preset.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const r = resolve(undefined, flagsLayer({}, { site: name, mode }), tty);
        const web = withProfile(applyPreset(DEFAULT_REQUIREMENTS, preset.rules).req, mode);
        expect(web.notes, `${name} ${mode}`).toEqual([]);
        expect(r.generation.req, `${name} ${mode}`).toEqual({ ...web.req, count: 5 });
      }
    }
  });

  it('fills in the mode\'s preset, resolving "space if allowed" by the rules', () => {
    const spaces = resolve(undefined, flagsLayer({}, { mode: 'two-finger' }), tty);
    expect(spaces.generation.req).toMatchObject(profileValues('two-finger', { allowSpaces: true }));
    expect(spaces.generation.req.separator).toBe(' ');
    const none = resolve(undefined, flagsLayer({}, { mode: 'two-finger', site: 'no-spaces' }), tty);
    expect(none.generation.req.separator).toBe('auto');
    expect(none.sources.separator).toEqual({ kind: 'mode', mode: 'two-finger', via: flag('mode') });
  });

  it('takes the mode from the flags, else the file, else ten-finger', () => {
    expect(resolve(fileLayer({}, { mode: 'quick' }), emptyLayer(), tty).typingMode).toBe('quick');
    expect(resolve(fileLayer({}, { mode: 'quick' }), flagsLayer({}, { mode: 'one-handed' }), tty).typingMode).toBe('one-handed');
    expect(resolve(fileLayer({}, { mode: 'quick' }), emptyLayer(), tty).sources.mode).toEqual(fileAt(1, 'mode'));
  });

  it('applies the file\'s options over its mode\'s preset, and the flags\' options over both', () => {
    const r = resolve(fileLayer({ 'options.swaps': 3, 'options.comfort': 'relaxed' }, { mode: 'two-finger' }), flagsLayer({ comfort: 'strict' }), tty);
    expect(r.generation.req.twists).toBe(3);
    expect(r.sources.swaps).toEqual(fileAt(3, 'options.swaps'));
    expect(r.generation.req.comfort).toBe('strict');
    expect(r.sources.comfort).toEqual(flag('comfort'));
    expect(r.generation.req.shorthand).toBe(1); // still the two-finger preset's
  });

  it('a mode on the command line replaces the file\'s own options, as picking a mode does in the web app', () => {
    const r = resolve(fileLayer({ 'options.swaps': 3 }, { mode: 'two-finger' }), flagsLayer({}, { mode: 'two-finger' }), tty);
    expect(r.generation.req.twists).toBe(profileValues('two-finger', DEFAULT_REQUIREMENTS).twists);
    expect(r.sources.swaps).toEqual({ kind: 'mode', mode: 'two-finger', via: flag('mode') });
  });

  it('applies sentence options and output from the file, then the flags', () => {
    const r = resolve(fileLayer({ 'sentence.shrink': 'ends', 'output.count': 7, 'output.sort': 'strength' }), flagsLayer({ count: 2, padding: false }), tty);
    expect(r.generation.sentenceOptions).toMatchObject({ shrink: 'ends', padding: false });
    expect(r.count).toBe(2);
    expect(r.generation.req.count).toBe(2);
    expect(r.sort).toBe('strength');
  });

  it('switches to sentence mode when given a sentence', () => {
    const r = resolve(undefined, emptyLayer(), { tty: true, sentence: 'Sally eats sweets' });
    expect(r.generation.mode).toBe('sentence');
    expect(r.generation.sentence).toBe('Sally eats sweets');
  });

  it('takes the mappings from the file', () => {
    const file = emptyLayer();
    file.mappings = { value: { disabled: ['a>@'], custom: [] }, source: fileAt(9, 'swaps') };
    expect(resolve(file, emptyLayer(), tty).generation.mappingSettings).toEqual({ disabled: ['a>@'], custom: [] });
  });
});

describe('resolve: rules in words', () => {
  it('sets the fields the text states and nothing else, says what it read, and names the text as the source', () => {
    const r = resolve(undefined, flagsLayer({}, { rules: 'Must be 8-20 characters and include at least one number' }), tty);
    expect(r.generation.req.minLength).toBe(8);
    expect(r.generation.req.maxLength).toBe(20);
    expect(r.generation.req.allowedSymbols).toBe(DEFAULT_REQUIREMENTS.allowedSymbols);
    expect(r.sources['max-length']).toEqual({ kind: 'rules-text', via: flag('rules') });
    expect(r.notes).toEqual([expect.stringMatching(/^Read the rules text \(--rules\) as: 8-20 characters/)]);
  });

  it('comes after --site and before the rule flags', () => {
    const r = resolve(undefined, flagsLayer({ 'max-length': 18 }, { site: 'nist-passphrase', rules: '10-30 characters' }), tty);
    expect(r.generation.req.minLength).toBe(10);
    expect(r.generation.req.maxLength).toBe(18);
    expect(r.generation.req.minUppercase).toBe(0); // NIST's
  });

  it('removes symbols the text rules out', () => {
    const r = resolve(undefined, flagsLayer({}, { rules: 'any symbol except < and >', site: 'nist-passphrase' }), tty);
    expect(r.generation.req.allowedSymbols).not.toMatch(/[<>]/);
  });

  it('keeps "3 of the following 4" as three named kinds and says which, leaving the fourth as it was', () => {
    const r = resolve(undefined, flagsLayer({ 'min-symbols': 0 }, { rules: 'Use at least 3 of the following 4: uppercase, lowercase, numbers, symbols' }), tty);
    expect(r.generation.req).toMatchObject({ minUppercase: 1, minLowercase: 1, minDigits: 1, minSymbols: 0 });
    expect(r.sources['min-lowercase']).toEqual({ kind: 'rules-text', via: flag('rules') });
    expect(r.sources['min-symbols']).toEqual(flag('min-symbols'));
    expect(r.notes).toEqual(['Read the rules text (--rules) as: at least 3 of uppercase, lowercase, digits and symbols (kept as an uppercase letter, a lowercase letter and a digit).']);
  });

  it("refuses a rules text past the core's cap whole, as a usage error with the core's message", () => {
    try {
      resolve(undefined, flagsLayer({}, { rules: `8-20 characters. ${'x'.repeat(MAX_RULES_TEXT_LENGTH)}` }), tty);
      expect.unreachable();
    } catch (e) {
      expect((e as CliError).exitCode).toBe(EXIT.usage);
      expect((e as CliError).title).toBe('--rules: the rules text is too long to read.');
      expect((e as CliError).details[0]).toBe(`The rules text is ${MAX_RULES_TEXT_LENGTH + 17} characters; ${MAX_RULES_TEXT_LENGTH} is the most this tool reads. Copy just the password rules.`);
    }
    // At the cap it reads.
    expect(resolve(undefined, flagsLayer({}, { rules: '8-20 characters.'.padEnd(MAX_RULES_TEXT_LENGTH) }), tty).generation.req.maxLength).toBe(20);
  });

  it('refuses text with no rules in it, as a usage error that says what rules text looks like', () => {
    try {
      resolve(undefined, flagsLayer({}, { rules: 'hello there' }), tty);
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(CliError);
      expect((e as CliError).exitCode).toBe(EXIT.usage);
      expect((e as CliError).title).toBe('--rules: no password rules found in "hello there".');
      expect((e as CliError).details[0]).toMatch(/sign-up form/);
    }
  });
});

describe('resolve: options a mode has no use for', () => {
  it('warns when one is set by hand, naming where, the value, the mode and why', () => {
    const r = resolve(undefined, flagsLayer({ 'avoid-pinky': true }, { mode: 'two-finger' }), tty);
    expect(r.warnings).toEqual([
      '--avoid-pinky sets avoid pinky stretches to on, which Two-finger typing has no use for (two index fingers have no pinky to stretch). It still shapes the passwords as set.',
    ]);
    expect(r.generation.req.avoidPinkyStretch).toBe(true);
  });

  it('says nothing when the mode\'s own preset set it', () => {
    expect(resolve(undefined, flagsLayer({}, { mode: 'two-finger' }), tty).warnings).toEqual([]);
  });

  it('warns about a file\'s value too', () => {
    const r = resolve(fileLayer({ 'options.ease-swaps': true }, { mode: 'two-finger' }), emptyLayer(), tty);
    expect(r.warnings).toEqual([expect.stringMatching(/^tep\.yml line 3 \(options\.ease-swaps\) sets deliberate swaps|^tep\.yml line 3 \(options\.ease-swaps\) sets ease awkward words/)]);
  });
});
