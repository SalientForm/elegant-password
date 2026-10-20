import { describe, expect, it } from 'vitest';
import { scoreDifficulty } from './difficulty';
import { memorabilityLevel, READING_LABELS, scoreReadings, strengthLevel, strengthWord } from './readings';

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
    const r = scoreReadings({ bits: 48.6, difficulty, memorability: 71 });
    expect(r.strength).toEqual({ label: 'Strength', value: '49', band: 'mid', text: 'Strength 49 bits, everyday; scored from the password and its hint alone' });
    expect(r.difficulty.label).toBe('Difficulty');
    expect(r.difficulty.value).toBe(String(difficulty.score));
    expect(r.difficulty.level).toBe(difficulty.level);
    expect(r.difficulty.text).toBe(`Difficulty ${difficulty.score}, ${difficulty.label.toLowerCase()} (two-finger)`);
    expect(r.memorability).toEqual({ label: 'Memorability', value: '71', band: 'mid', text: 'Memorability 71 of 100: how closely it still looks like its hint' });
  });

  it('says memorability needs a hint when there is none, with no band to colour', () => {
    const r = scoreReadings({ bits: 30, difficulty });
    expect(r.memorability.value).toBe('n/a');
    expect(r.memorability.band).toBeNull();
    expect(r.memorability.text).toMatch(/needs a hint/);
  });

  it('keeps the labels the web badges and the CLI table both print', () => {
    expect(READING_LABELS).toEqual({ strength: 'Strength', difficulty: 'Difficulty', memorability: 'Memorability' });
  });
});
