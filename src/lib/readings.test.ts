import { describe, expect, it } from 'vitest';
import { scoreDifficulty } from './difficulty';
import { STRENGTH_PRESETS } from './generate';
import { andList, difficultyBand, largeNumber, memorabilityLevel, numberWord, READING_LABELS, READING_ORDER, scoreReadings, STRENGTH_WORDS, strengthLevel, strengthWord } from './readings';

describe('memorability badge colours', () => {
  it('is green above 75, yellow above 45, red at or below 45', () => {
    expect(memorabilityLevel(100)).toBe('high');
    expect(memorabilityLevel(76)).toBe('high');
    expect(memorabilityLevel(75)).toBe('mid');
    expect(memorabilityLevel(46)).toBe('mid');
    expect(memorabilityLevel(45)).toBe('low');
    expect(memorabilityLevel(0)).toBe('low');
  });
});

describe('strength badge', () => {
  it('is green from 50 bits, yellow from 40, red below, and says high, fair or low', () => {
    expect(strengthLevel(72)).toBe('high');
    expect(strengthLevel(50)).toBe('high');
    expect(strengthLevel(49)).toBe('mid');
    expect(strengthLevel(40)).toBe('mid');
    expect(strengthLevel(39)).toBe('low');
    expect(strengthWord(72)).toBe('high');
    expect(strengthWord(50)).toBe('high');
    expect(strengthWord(49)).toBe('fair');
    expect(strengthWord(40)).toBe('fair');
    expect(strengthWord(39)).toBe('low');
    expect(strengthWord(12)).toBe('low');
    expect(strengthWord(4)).toBe('low');
  });

  it('names its band and never a preset, at every figure from 0 to 256', () => {
    const presets = STRENGTH_PRESETS.map((p) => p.label.toLowerCase());
    for (let n = 0; n <= 256; n++) {
      expect(strengthWord(n)).toBe(STRENGTH_WORDS[strengthLevel(n)]);
      expect(presets).not.toContain(strengthWord(n));
    }
  });
});

describe('score readings', () => {
  const difficulty = scoreDifficulty('Sleepy otters paint boats', 4, 'two-finger');

  it('reads each score as its badge shows it: label, figure, band and the full sentence', () => {
    const r = scoreReadings({ strength: 48.6, raw: 120.4, difficulty, memorability: 71 });
    expect(r.strength).toEqual({ label: 'Strength', value: '49', band: 'mid', text: 'Strength 49 bits, fair: for an attacker who knows English and the usual habits but not this tool; from the password alone' });
    expect(r.raw).toEqual({ label: 'Raw', value: '120', band: null, text: 'Raw 120 bits: brute force over the characters used, a repeated character counted once; what a naive meter reads' });
    expect(r.difficulty.label).toBe('Difficulty');
    expect(r.difficulty.value).toBe(String(difficulty.score));
    expect(r.difficulty.level).toBe(difficulty.level);
    expect(r.difficulty.text).toBe(`Difficulty ${difficulty.score}, ${difficulty.label.toLowerCase()} (two-finger)`);
    expect(r.memorability).toEqual({ label: 'Memorability', value: '71', band: 'mid', text: 'Memorability 71 of 100: how closely it still looks like its hint' });
  });

  it('takes the band and the word from the figure as shown, so a badge reading 50 is never yellow', () => {
    const r = scoreReadings({ strength: 49.6, raw: 0, difficulty });
    expect(r.strength.value).toBe('50');
    expect(r.strength.band).toBe('high');
    expect(r.strength.text).toMatch(/^Strength 50 bits, high:/);
    expect(scoreReadings({ strength: 39.6, raw: 0, difficulty }).strength).toMatchObject({ value: '40', band: 'mid' });
    expect(scoreReadings({ strength: 39.4, raw: 0, difficulty }).strength).toMatchObject({ value: '39', band: 'low' });
  });

  it('says memorability needs a hint when there is none, with no band to colour', () => {
    const r = scoreReadings({ strength: 30, raw: 40, difficulty });
    expect(r.memorability.value).toBe('n/a');
    expect(r.memorability.band).toBeNull();
    expect(r.memorability.text).toMatch(/needs a hint/);
  });

  it('keeps the labels the web badges and the CLI table both print', () => {
    expect(READING_LABELS).toEqual({ strength: 'Strength', raw: 'Raw', difficulty: 'Difficulty', memorability: 'Memorability' });
    expect(READING_ORDER).toEqual(['strength', 'raw', 'difficulty', 'memorability']);
  });
});

describe('difficulty badge colours', () => {
  it('is green for effortless and easy, yellow for moderate, red for demanding and hard, and the reading carries it', () => {
    expect(([0, 1, 2, 3, 4] as const).map(difficultyBand)).toEqual(['high', 'high', 'mid', 'low', 'low']);
    for (const level of [0, 1, 2, 3, 4] as const) {
      const r = scoreReadings({ strength: 50, raw: 60, difficulty: { score: 10, level, label: 'Easy', mode: 'ten-finger' } });
      expect(r.difficulty.band).toBe(difficultyBand(level));
    }
  });
});

describe('figures in text', () => {
  it('writes a count as a word up to twelve and in figures above', () => {
    expect([0, 3, 6, 12].map(numberWord)).toEqual(['zero', 'three', 'six', 'twelve']);
    expect(numberWord(65)).toBe('65');
    expect(numberWord(1500)).toBe('1,500');
  });

  it('writes a large figure with its scale word from a million up', () => {
    expect([10, 1e4, 1e5, 999_999].map(largeNumber)).toEqual(['10', '10,000', '100,000', '999,999']);
    expect([1e6, 1e11, 2.5e12].map(largeNumber)).toEqual(['1 million', '100 billion', '2.5 trillion']);
  });

  it('joins a list as a sentence does', () => {
    expect(andList([])).toBe('');
    expect(andList(['a'])).toBe('a');
    expect(andList(['a', 'b'])).toBe('a and b');
    expect(andList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
