import { describe, expect, it } from 'vitest';
import { scoreDifficulty } from './difficulty';
import { memorabilityLevel, READING_LABELS, READING_ORDER, scoreReadings, strengthLevel, strengthWord } from './readings';

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
  it('is green from 50 bits, yellow from 40, red below, and names the preset reached', () => {
    expect(strengthLevel(72)).toBe('high');
    expect(strengthLevel(50)).toBe('high');
    expect(strengthLevel(49)).toBe('mid');
    expect(strengthLevel(40)).toBe('mid');
    expect(strengthLevel(39)).toBe('low');
    expect(strengthWord(80)).toBe('master password');
    expect(strengthWord(65)).toBe('very strong');
    expect(strengthWord(55)).toBe('strong');
    expect(strengthWord(41)).toBe('everyday');
    expect(strengthWord(12)).toBe('weak'); // the Minimal preset (4 bits) is a target, not a strength
    expect(strengthWord(4)).toBe('weak');
  });
});

describe('score readings', () => {
  const difficulty = scoreDifficulty('Sleepy otters paint boats', 4, 'two-finger');

  it('reads each score as its badge shows it: label, figure, band and the full sentence', () => {
    const r = scoreReadings({ strength: 48.6, raw: 120.4, difficulty, memorability: 71 });
    expect(r.strength).toEqual({ label: 'Strength', value: '49', band: 'mid', text: 'Strength 49 bits, everyday: for an attacker who knows English and the usual habits but not this tool; from the password alone' });
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
    expect(r.strength.text).toMatch(/^Strength 50 bits, strong:/);
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
