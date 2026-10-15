import { describe, expect, it } from 'vitest';
import { LEVELS, levelFor, measure, overallLevel, RUBRIC, scoreDifficulty } from './difficulty';

describe('difficulty rubric', () => {
  it('has weights summing to 100 and rising cut-points', () => {
    expect(RUBRIC.reduce((s, c) => s + c.weight, 0)).toBe(100);
    for (const c of RUBRIC) {
      for (let i = 1; i < 4; i++) {
        if (c.higherIsEasier) expect(c.cutPoints[i]!, c.name).toBeLessThan(c.cutPoints[i - 1]!);
        else expect(c.cutPoints[i]!, c.name).toBeGreaterThan(c.cutPoints[i - 1]!);
      }
    }
  });

  it('maps values and totals onto levels', () => {
    expect(levelFor(1, [2, 4, 6, 8])).toBe(0);
    expect(levelFor(4, [2, 4, 6, 8])).toBe(2);
    expect(levelFor(99, [2, 4, 6, 8])).toBe(4);
    expect([0, 20, 21, 60, 61, 100].map(overallLevel)).toEqual([0, 0, 1, 2, 3, 4]);
  });

  it('measures the things it claims to', () => {
    const m = measure('Sad lads-1!', 3);
    expect(m.characters).toBe(11);
    expect(m.shiftAndCase).toBe(2 + 2); // S and !, one case flip
    expect(m.offLetterKeys).toBe(3); // - 1 !
    expect(m.pinkyStretches).toBe(3);
    expect(m.chunks).toBe(3);
  });

  it('rates rolls like "asdf" as easy and fast', () => {
    const rolled = scoreDifficulty('asdf', 1);
    expect(rolled.measurements.rollShare).toBe(1);
    expect(rolled.label === 'Effortless' || rolled.label === 'Easy').toBe(true);
    expect(measure('ertdfg', 1).rollShare).toBeCloseTo(4 / 5);
    expect(scoreDifficulty('ertdfg', 1).score).toBeLessThan(scoreDifficulty('epqzml', 1).score);
    expect(levelFor(0.5, [0.3, 0.2, 0.12, 0.05], true)).toBe(0);
    expect(levelFor(0, [0.3, 0.2, 0.12, 0.05], true)).toBe(4);
  });

  it('scores a smooth lowercase phrase easier than a twisted, shifted one', () => {
    const easy = scoreDifficulty('sad lads add salt', 4);
    const hard = scoreDifficulty('92-PUMP!N-zebras-quiz-v!ol!ns-=+', 7);
    expect(easy.score).toBeLessThan(25);
    expect(hard.score).toBeGreaterThan(60);
    expect(LEVELS[easy.level]).toBe(easy.label);
    expect(easy.criteria.reduce((s, c) => s + c.points, 0)).toBeCloseTo(easy.score, -1);
  });
});
