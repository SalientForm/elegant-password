import { describe, expect, it } from 'vitest';
import { isPinkyStretch, isRoll, lookupKey, transitionCost, typingProfile, wordCost } from './keyboard';

const key = (c: string) => lookupKey(c)!.key;

describe('keyboard model', () => {
  it('prefers neighbouring keys on one row over reaches across rows', () => {
    expect(transitionCost(key('a'), key('s'))).toBeLessThan(transitionCost(key('a'), key('p')));
    expect(transitionCost(key('a'), key('s'))).toBeLessThan(transitionCost(key('a'), key('w')));
  });

  it('penalises one finger moving between rows', () => {
    expect(transitionCost(key('d'), key('e'))).toBeGreaterThan(transitionCost(key('d'), key('w')));
  });

  it('makes rolls the cheapest move, including the index finger stepping sideways', () => {
    for (const [a, b] of ['as', 'sd', 'df', 'fg', 'rt', 'kl', 'lk', 'nm']) {
      expect(isRoll(key(a!), key(b!)), a! + b!).toBe(true);
      expect(transitionCost(key(a!), key(b!))).toBeLessThan(transitionCost(key('a'), key('d')));
    }
    expect(isRoll(key('g'), key('h'))).toBe(false); // crosses hands
    expect(isRoll(key('d'), key('e'))).toBe(false); // changes row
    expect(typingProfile('asdf').rollShare).toBe(1);
  });

  it('ranks row-friendly words as easier', () => {
    expect(wordCost('salad')).toBeLessThan(wordCost('zebra'));
    expect(wordCost('pour')).toBeLessThan(wordCost('cobra'));
  });

  it('counts Shift presses and case flips', () => {
    expect(typingProfile('Sleepy otters').shiftPresses).toBe(1);
    expect(typingProfile('Sleepy otters').caseChanges).toBe(1);
    expect(typingProfile('sLeEpy').caseChanges).toBe(4);
    expect(typingProfile('qwerty').sameRowShare).toBe(1);
  });

  it('flags symbols the pinky must stretch for', () => {
    for (const c of '!)-_=+\\|`~]}10') expect(isPinkyStretch(c), c).toBe(true);
    for (const c of "[{'\"/?;:.,@#$%^&*(pqaz") expect(isPinkyStretch(c), c).toBe(false);
  });

  it('rejects characters outside the model', () => {
    expect(() => typingProfile('café')).toThrow();
  });
});
