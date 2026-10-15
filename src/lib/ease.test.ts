import { describe, expect, it } from 'vitest';
import { awkwardMoves, describeRemoved, EASE_EXCLUDED, EASE_RULES, easedText, easeOf, LONG_REACH, plainOf, typingSeconds } from './ease';
import { pools } from './grammar';
import { BUILT_IN_MAPPINGS, mappingKey } from './twists';
import { ADJECTIVES, ADVERBS, ENDINGS, NOUNS, PREPOSITIONS, VERBS } from './words';

const LIST_WORDS = [...new Set([...ADJECTIVES, ...NOUNS, ...VERBS, ...ADVERBS, ...ENDINGS, ...PREPOSITIONS])];

describe('awkward moves', () => {
  it('are same-finger jumps and reaches of six key widths or more, never rolls, repeats or the thumb', () => {
    expect(awkwardMoves('ed')).toEqual([{ at: 1, keys: 'ed', kind: 'same finger' }]);
    expect(awkwardMoves('un').map((m) => m.kind)).toEqual(['same finger']);
    expect(awkwardMoves('wi')).toEqual([{ at: 1, keys: 'wi', kind: 'long reach' }]);
    expect(awkwardMoves('ap').map((m) => m.kind)).toEqual(['long reach']);
    for (const easy of ['as', 'df', 'fg', 'll', 'a b', 'sad', 'tree']) expect(awkwardMoves(easy), easy).toEqual([]);
    expect(LONG_REACH).toBe(6);
  });
});

describe('the deliberate swap rule', () => {
  it('removes an awkward move with one fixed misspelling', () => {
    const cases: [string, string, string, string][] = [
      ['wise', 'wyse', 'i>y', 'the long reach w-i'],
      ['kids', 'kyds', 'i>y', 'the same-finger jump k-i'],
      ['cool', 'cul', 'oo>u', 'the same-finger jump o-l'],
      ['lazy', 'lasy', 'z>s', 'the same-finger jump a-z'],
      ['bricks', 'brix', 'cks>x', 'the long reach k-s'],
      ['cows', 'cowz', 's>z', 'the same-finger jump w-s'],
      ['inspect', 'inspekt', 'c>k', 'the same-finger jump e-c'],
      ['steam', 'steem', 'ea>ee', 'the long reach a-m'],
      ['powder', 'powda', 'er>a', 'the same-finger jump d-e'],
      ['nephews', 'nefews', 'ph>f', 'the long reach e-p'],
    ];
    for (const [word, text, rule, removed] of cases) {
      const e = easeOf(word)!;
      expect(e, word).toBeDefined();
      expect(e.text, word).toBe(text);
      expect(`${e.rule.from}>${e.rule.to}`, word).toBe(rule);
      expect(describeRemoved(e), word).toBe(removed);
      expect(awkwardMoves(text).length, word).toBeLessThan(awkwardMoves(word).length);
      expect(typingSeconds(text), word).toBeLessThan(typingSeconds(word));
    }
  });

  it('leaves alone words with no awkward move, and words no rule can help', () => {
    expect(awkwardMoves('dress')).toEqual([]);
    expect(easeOf('dress')).toBeUndefined();
    expect(awkwardMoves('red').length).toBeGreaterThan(0); // e-d, and no rule fits "red"
    expect(easeOf('red')).toBeUndefined();
    expect(easedText('red')).toBe('red');
    for (const odd of ['', 'ab', 'Wise', 'r2d2', 'café']) expect(easeOf(odd), odd).toBeUndefined(); // lowercase a-z words of 3 or more letters only
  });

  it('keeps the first letter, never splits a double letter, applies end rules at the end and keeps a soft c', () => {
    for (const word of LIST_WORDS) {
      const e = easeOf(word);
      if (!e) continue;
      expect(e.text[0], word).toBe(word[0]);
      expect(e.at, word).toBeGreaterThanOrEqual(1);
      const end = e.at + e.rule.from.length;
      expect(word.slice(e.at, end), word).toBe(e.rule.from);
      expect(word[e.at - 1], word).not.toBe(e.rule.from[0]);
      expect(word[end], word).not.toBe(e.rule.from.at(-1));
      if (e.rule.end) expect(end, word).toBe(word.length);
      if (e.rule.from === 'c') expect('eiyhk'.includes(word[end] ?? ''), word).toBe(false);
      expect(e.text, word).toMatch(/^[a-z]{3,}$/); // letters only: never a digit, a symbol or the separator
    }
    expect(easedText('jazzy')).not.toBe('jaszy');
    expect(easedText('dizzy')).toBe('dyzzy'); // the i, not half of the zz
  });

  it('only makes a word easier: fewer awkward moves and less time on the rubric model', () => {
    let eased = 0;
    for (const word of LIST_WORDS) {
      const e = easeOf(word);
      if (!e) continue;
      eased++;
      expect(awkwardMoves(e.text).length, word).toBeLessThan(awkwardMoves(word).length);
      expect(typingSeconds(e.text), word).toBeLessThan(typingSeconds(word));
      expect(e.removed.length, word).toBeGreaterThan(0);
    }
    expect(eased).toBeGreaterThan(150); // about 8% of the lists
  });

  it('draws only on sound-alike misspellings that are also built-in swaps', () => {
    const builtIn = new Set(BUILT_IN_MAPPINGS.filter((m) => m.kind === 'spelling').map(mappingKey));
    for (const rule of EASE_RULES) {
      // "ers>as" and "ies>ys" are "er>a" and "ie>y" before a plural s.
      const base = rule.from === 'ers' ? 'er>a' : rule.from === 'ies' ? 'ie>y' : `${rule.from}>${rule.to}`;
      expect(builtIn.has(base), base).toBe(true);
      expect(rule.to).toMatch(/^[a-z]+$/);
    }
  });

  it('never merges two words or turns one into another: the plan count stays exact and the word stays readable', () => {
    const listed = new Set(LIST_WORDS);
    const spellings = new Map<string, string>();
    for (const word of LIST_WORDS) {
      const e = easeOf(word);
      if (!e) continue;
      expect(listed.has(e.text), `${word} -> ${e.text}`).toBe(false);
      expect(EASE_EXCLUDED.has(e.text), `${word} -> ${e.text}`).toBe(false);
      expect(spellings.get(e.text), `${word} and ${spellings.get(e.text)} -> ${e.text}`).toBeUndefined();
      spellings.set(e.text, word);
      expect(plainOf(e.text)).toBe(word);
    }
    expect(plainOf('otters')).toBe('otters');
    expect(easedText('boost')).not.toBe('bust'); // a spelling that reads as another word is not used
  });

  it('is a fixed function of the word alone: the same every time, for list words and your own', () => {
    expect(easeOf('wise')).toBe(easeOf('wise'));
    expect(easeOf('kids')).toEqual(easeOf('kids'));
    // A word on no list follows the same rule.
    expect(easedText('wildlife')).toBe('wyldlife');
    expect(easedText('piece')).toBe('piez');
    expect(easedText('kitchen')).toBe('kytchen');
    // A word of your own never takes a spelling a list word already has.
    for (const word of ['wyse', 'kyds', 'cul']) expect(easedText(word), word).toBe(word);
  });
});

describe('typing comfort with deliberate swaps', () => {
  it('ranks words as typed, so a word its swap makes easy stays in, at the same pool sizes', () => {
    const plain = pools('balanced', 1, false);
    const eased = pools('balanced', 1, true);
    for (const slot of ['adj', 'noun', 'verb', 'adv', 'end', 'prep'] as const) expect(eased[slot].length, slot).toBe(plain[slot].length);
    expect(eased.adj).toContain('wide');
    expect(plain.adj).not.toContain('wide');
  });
});
