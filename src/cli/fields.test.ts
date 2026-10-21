import { describe, expect, it } from 'vitest';
import { COMFORT_CHOICES } from '../lib/choices';
import { DEFAULT_SENTENCE_OPTIONS } from '../lib/fromSentence';
import { DEFAULT_REQUIREMENTS, STRENGTH_PRESETS } from '../lib/generate';
import { PROFILE_KEYS } from '../lib/modeProfiles';
import { RULE_KEYS } from '../lib/sitePresets';
import { describeValue, fieldNamed, FIELDS, fieldsIn, formatValue, keyPath, parseValue, shownValue, STRENGTH_NAMES, symbolProblem, type CliField } from './fields';

const F = (name: string): CliField => fieldNamed(name)!;
const ok = (name: string, raw: unknown) => parseValue(F(name), raw);

describe('the field table', () => {
  it('covers every rule, every option a mode fills in, every sentence option, the count and the order, once each', () => {
    const req = FIELDS.filter((f) => f.target.kind === 'req').map((f) => f.target.key);
    expect(fieldsIn('rules').map((f) => f.target.key)).toEqual([...RULE_KEYS]);
    expect(fieldsIn('options').map((f) => f.target.key)).toEqual([...PROFILE_KEYS]);
    expect(new Set(req)).toEqual(new Set(Object.keys(DEFAULT_REQUIREMENTS).filter((k) => k !== 'count')));
    expect(new Set(fieldsIn('sentence').map((f) => f.target.key))).toEqual(new Set(Object.keys(DEFAULT_SENTENCE_OPTIONS)));
    expect(fieldsIn('output').map((f) => f.target.key)).toEqual(['count', 'sort']);
    expect(new Set(FIELDS.map((f) => f.name)).size).toBe(FIELDS.length);
  });

  it('gives every field a label and a description, and a config key under its group', () => {
    for (const f of FIELDS) {
      expect(f.label, f.name).toMatch(/^[a-z]/);
      expect(f.description.length, f.name).toBeGreaterThan(5);
    }
    expect(keyPath(F('max-length'))).toBe('rules.max-length');
    expect(keyPath(F('two-letter'))).toBe('options.two-letter');
  });

  it('names the strength presets as the spec lists them', () => {
    expect(STRENGTH_NAMES.map((s) => s.name)).toEqual(['minimal', 'everyday', 'strong', 'very-strong', 'master-password']);
    expect(STRENGTH_NAMES.map((s) => s.bits)).toEqual(STRENGTH_PRESETS.map((p) => p.bits));
  });
});

describe('parseValue', () => {
  it('whole numbers: from text or YAML, in range', () => {
    expect(ok('max-length', '20')).toEqual({ ok: true, value: 20 });
    expect(ok('max-length', 20)).toEqual({ ok: true, value: 20 });
    expect(ok('max-length', '0')).toEqual({ ok: false, error: 'must be from 1 to 256; found 0' });
    expect(ok('max-length', 257)).toEqual({ ok: false, error: 'must be from 1 to 256; found 257' });
    expect(ok('max-length', '12.5')).toEqual({ ok: false, error: 'must be a whole number from 1 to 256; found "12.5"' });
    expect(ok('max-length', 'twelve')).toEqual({ ok: false, error: 'must be a whole number from 1 to 256; found "twelve"' });
    expect(ok('min-digits', '5')).toEqual({ ok: false, error: 'must be from 0 to 4; found 5' });
    expect(ok('swaps', 3)).toEqual({ ok: true, value: 3 });
    expect(ok('count', 21)).toEqual({ ok: false, error: 'must be from 1 to 20; found 21' });
    expect(ok('shrink-from', 1)).toEqual({ ok: false, error: 'must be from 2 to 20; found 1' });
  });

  it('true or false', () => {
    expect(ok('spaces', false)).toEqual({ ok: true, value: false });
    expect(ok('spaces', 'yes')).toEqual({ ok: false, error: 'must be true or false; found "yes"' });
    expect(ok('glue', 1)).toEqual({ ok: false, error: 'must be true or false; found 1' });
  });

  it('a choice, with the likeliest one meant', () => {
    expect(ok('comfort', 'strict')).toEqual({ ok: true, value: 'strict' });
    expect(ok('comfort', 'balansed')).toEqual({ ok: false, error: 'must be one of strict, balanced, relaxed; found "balansed". Did you mean balanced?' });
    expect(ok('sort', 'random')).toEqual({ ok: false, error: 'must be one of memorability, difficulty, strength; found "random"' });
    expect(ok('length-tag', 'factor')).toEqual({ ok: true, value: 'factor' });
    expect(ok('shrink', 'ends')).toEqual({ ok: true, value: 'ends' });
  });

  it('allowed symbols: keyboard symbols only, each once, or none', () => {
    expect(ok('symbols', '!@#')).toEqual({ ok: true, value: '!@#' });
    expect(ok('symbols', '')).toEqual({ ok: true, value: '' });
    expect(ok('symbols', '!a')).toEqual({ ok: false, error: 'cannot include the letter "a": the letter "a" is not a symbol; letters and digits are always allowed, so list only symbols' });
    expect(ok('symbols', '!1')).toEqual({ ok: false, error: 'cannot include the digit "1": the digit "1" is not a symbol; letters and digits are always allowed, so list only symbols' });
    expect(ok('symbols', '! ')).toEqual({ ok: false, error: 'cannot include a space: a space is not a symbol; spaces are allowed with --spaces (spaces: true)' });
    expect(ok('symbols', '!£')).toEqual({ ok: false, error: 'cannot include "£": "£" is not on a standard keyboard' });
    expect(ok('symbols', '!!')).toEqual({ ok: false, error: 'lists "!" twice' });
    expect(ok('symbols', 5)).toEqual({ ok: false, error: 'must be a string of symbols, such as "!@#$%"; found 5' });
  });

  it('separator: auto, space, none, or one keyboard symbol', () => {
    expect(ok('separator', 'auto')).toEqual({ ok: true, value: 'auto' });
    expect(ok('separator', 'space')).toEqual({ ok: true, value: ' ' });
    expect(ok('separator', 'none')).toEqual({ ok: true, value: '' });
    expect(ok('separator', ';')).toEqual({ ok: true, value: ';' });
    expect(ok('separator', 'spcae')).toEqual({ ok: false, error: 'must be auto, space, none, or one symbol such as ";"; found "spcae". Did you mean space?' });
    expect(ok('separator', ';;')).toEqual({ ok: false, error: 'must be auto, space, none, or one symbol such as ";"; found ";;"' });
    expect(ok('separator', 'x')).toEqual({ ok: false, error: 'must be auto, space, none, or one symbol; the letter "x" is not a symbol; letters and digits are always allowed, so list only symbols' });
    expect(ok('separator', ' ')).toEqual({ ok: false, error: 'must be auto, space, none, or one symbol; a space is not a symbol; spaces are allowed with --spaces (spaces: true)' });
  });

  it('strength: a preset name, "master", or bits from 0 to 256', () => {
    expect(ok('strength', 'strong')).toEqual({ ok: true, value: 50 });
    expect(ok('strength', 'master')).toEqual({ ok: true, value: 72 });
    expect(ok('strength', 'master-password')).toEqual({ ok: true, value: 72 });
    expect(ok('strength', '45')).toEqual({ ok: true, value: 45 });
    expect(ok('strength', 45.5)).toEqual({ ok: true, value: 45.5 });
    expect(ok('strength', '300')).toEqual({ ok: false, error: 'must be from 0 to 256 bits; found 300' });
    expect(ok('strength', 'strng')).toEqual({ ok: false, error: 'must be minimal, everyday, strong, very-strong, master-password, or a number of bits from 0 to 256; found "strng". Did you mean strong?' });
    expect(ok('strength', true)).toMatchObject({ ok: false });
  });

  it('target length: none or 1-256', () => {
    expect(ok('target-length', 'none')).toEqual({ ok: true, value: null });
    expect(ok('target-length', null)).toEqual({ ok: true, value: null });
    expect(ok('target-length', '12')).toEqual({ ok: true, value: 12 });
    expect(ok('target-length', 0)).toEqual({ ok: false, error: 'must be none or a whole number from 1 to 256; found 0' });
  });

  it('symbolProblem says why a character cannot be a symbol, or nothing when it can', () => {
    expect(symbolProblem(';')).toBeUndefined();
    expect(symbolProblem('é')).toMatch(/not a symbol|not on a standard keyboard/);
  });
});

describe('formatValue and describeValue', () => {
  it('write values back the way they are typed', () => {
    expect(formatValue(F('separator'), ' ')).toBe('space');
    expect(formatValue(F('separator'), '')).toBe('none');
    expect(formatValue(F('separator'), ';')).toBe(';');
    expect(formatValue(F('strength'), 40)).toBe('everyday');
    expect(formatValue(F('strength'), 45)).toBe(45);
    expect(formatValue(F('target-length'), null)).toBe('none');
    expect(formatValue(F('spaces'), true)).toBe(true);
  });

  it('and read them out in messages', () => {
    expect(describeValue(F('spaces'), false)).toBe('not allowed');
    expect(describeValue(F('spaces'), true)).toBe('allowed');
    expect(describeValue(F('glue'), false)).toBe('off');
    expect(describeValue(F('separator'), ' ')).toBe('a space');
    expect(describeValue(F('separator'), 'auto')).toBe('Auto');
    expect(describeValue(F('symbols'), '')).toBe('none');
    expect(describeValue(F('symbols'), '!@')).toBe('"!@"');
    expect(describeValue(F('strength'), 50)).toBe('Strong (50 bits)');
    expect(describeValue(F('strength'), 45)).toBe('45 bits');
    expect(describeValue(F('comfort'), 'relaxed')).toBe(COMFORT_CHOICES[2]!.label);
    expect(describeValue(F('max-length'), 20)).toBe('20');
  });

  it('round-trips every field: written back and parsed again is the same value', () => {
    const samples: Record<string, unknown[]> = {
      separator: ['auto', ' ', '', ';'],
      strength: [4, 40, 45, 72],
      'target-length': [null, 12],
    };
    for (const f of FIELDS) {
      const values =
        samples[f.name] ??
        (f.kind.type === 'bool' ? [true, false] : f.kind.type === 'int' ? [f.kind.min, f.kind.max] : f.kind.type === 'choice' ? f.kind.choices.map((c) => c.value) : ['!@#', '']);
      for (const v of values) expect(parseValue(f, formatValue(f, v)), `${f.name} ${JSON.stringify(v)}`).toEqual({ ok: true, value: v });
    }
  });
});

describe('shownValue: a value quoted in a message', () => {
  it('quotes text and writes anything else as JSON', () => {
    expect(shownValue('ab')).toBe('"ab"');
    expect(shownValue(3)).toBe('3');
    expect(shownValue(null)).toBe('null');
    expect(shownValue({ a: [1] })).toBe('{"a":[1]}');
  });

  it('never throws on a value that refers to itself, or on one JSON cannot write', () => {
    const loop: Record<string, unknown> = { a: 1 };
    loop.self = loop;
    expect(shownValue(loop)).toBe('{"a":1,"self":"[circular]"}');
    expect(shownValue(10n)).toBe('"10"');
    expect(shownValue(undefined)).toBe('undefined');
  });

  it('cuts a long value short', () => {
    const shown = shownValue('x'.repeat(500));
    expect(shown).toHaveLength(60);
    expect(shown.endsWith('...')).toBe(true);
  });

  it('is what parseValue quotes, so a cyclic value in a config cannot crash its message', () => {
    const loop: unknown[] = [];
    loop.push(loop);
    const r = parseValue(fieldNamed('min-length')!, loop);
    expect(r).toEqual({ ok: false, error: 'must be a whole number from 1 to 256; found ["[circular]"]' });
  });
});
