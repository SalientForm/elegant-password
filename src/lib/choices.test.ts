import { describe, expect, it } from 'vitest';
import { COMFORT_CHOICES, comfortLabel, isSymbolSeparator, SEPARATOR_KINDS, separatorChoices, separatorNote, SORT_CHOICES } from './choices';
import { DEFAULT_REQUIREMENTS, type Requirements } from './generate';
import { COMFORT_SHARE } from './grammar';
import { SORT_ORDERS } from './sort';

const req = (over: Partial<Requirements>): Requirements => ({ ...DEFAULT_REQUIREMENTS, ...over });

describe('choice lists', () => {
  it('cover every comfort level and every order, in the order the form shows them', () => {
    expect(COMFORT_CHOICES.map((c) => c.value)).toEqual(Object.keys(COMFORT_SHARE));
    expect(SORT_CHOICES.map((c) => c.value).sort()).toEqual([...SORT_ORDERS].sort());
    expect(comfortLabel('balanced')).toBe('Balanced');
  });

  it('tell a symbol separator from Auto, Space and None', () => {
    expect(SEPARATOR_KINDS.map((c) => c.value)).toEqual(['auto', ' ', '']);
    expect(['auto', ' ', ''].map(isSymbolSeparator)).toEqual([false, false, false]);
    expect(isSymbolSeparator(';')).toBe(true);
  });
});

describe('separatorChoices', () => {
  it('offers Auto, Space, None and each allowed keyboard symbol once, each with why the rules rule it out', () => {
    const choices = separatorChoices(req({ allowedSymbols: ';;.a ', allowSpaces: false }));
    expect(choices.map((c) => c.value)).toEqual(['auto', ' ', '', ';', '.']);
    expect(choices.find((c) => c.value === ' ')!.problem).toBe('Space is chosen as the separator, but spaces are not allowed.');
    expect(choices.filter((c) => c.problem).map((c) => c.value)).toEqual([' ']);
  });
});

describe('separatorNote', () => {
  it('reads the same as the form: Auto resolved, space, none, a stretch, a far Shift, a plain symbol', () => {
    expect(separatorNote(req({}))).toMatchObject({ kind: 'auto', text: expect.stringMatching(/^Auto: ";" under these rules\./) });
    expect(separatorNote(req({ separator: ' ' }))).toEqual({ kind: 'space', text: 'A space: typed with the thumb.' });
    expect(separatorNote(req({ separator: '' }))).toEqual({ kind: 'none', text: 'None: the words run together.' });
    expect(separatorNote(req({ separator: '-', allowedSymbols: '-' }))).toEqual({ kind: 'stretch', text: '"-" is a pinky stretch; kept because you chose it.' });
    expect(separatorNote(req({ separator: '^', avoidPinkyStretch: false, shiftReach: true }))).toEqual({ kind: 'far', text: '"^" needs a Shift key out of one hand\'s reach; kept because you chose it.' });
    expect(separatorNote(req({ separator: '.' }))).toEqual({ kind: 'symbol', text: 'Words are joined with ".".' });
  });

  it('lists only the comfortable fallbacks for Auto', () => {
    expect(separatorNote(req({ avoidPinkyStretch: false })).text).toContain('"." "-" "," "_"');
    expect(separatorNote(req({})).text).toContain('"." ","');
  });
});
