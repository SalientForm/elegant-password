import { describe, expect, it } from 'vitest';
import { difficultyIn, LEVELS, levelFor, levelRange, MAX_LEVEL, measure, overallLevel, RUBRIC, RUBRICS, scoreDifficulty, TYPING_MODE_IDS } from './difficulty';

describe('difficulty rubric', () => {
  it('has weights summing to 100 and rising cut-points, in every typing mode', () => {
    expect(RUBRIC).toBe(RUBRICS['ten-finger']);
    for (const mode of TYPING_MODE_IDS) {
      expect(RUBRICS[mode].reduce((s, c) => s + c.weight, 0), mode).toBe(100);
      for (const c of RUBRICS[mode]) {
        for (let i = 1; i < 4; i++) {
          if (c.higherIsEasier) expect(c.cutPoints[i]!, `${mode} ${c.name}`).toBeLessThan(c.cutPoints[i - 1]!);
          else expect(c.cutPoints[i]!, `${mode} ${c.name}`).toBeGreaterThan(c.cutPoints[i - 1]!);
        }
      }
    }
  });

  it('maps values and totals onto levels', () => {
    expect(levelFor(1, [2, 4, 6, 8])).toBe(0);
    expect(levelFor(4, [2, 4, 6, 8])).toBe(2);
    expect(levelFor(99, [2, 4, 6, 8])).toBe(4);
    expect([0, 20, 21, 60, 61, 100].map(overallLevel)).toEqual([0, 0, 1, 2, 3, 4]);
    // The totals each level is said to cover are the ones it is given for: 0-20 effortless up to 81-100 hard.
    expect(MAX_LEVEL).toBe(LEVELS.length - 1);
    for (const level of [0, 1, 2, 3, 4] as const) {
      const { min, max } = levelRange(level);
      expect([overallLevel(min), overallLevel(max)], LEVELS[level]).toEqual([level, level]);
    }
    expect(levelRange(0).min).toBe(0);
    expect(levelRange(MAX_LEVEL).max).toBe(100);
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

describe('typing modes', () => {
  it('scores the same password differently in each mode, and says which', () => {
    const scores = TYPING_MODE_IDS.map((mode) => scoreDifficulty('The-hungry-goat!', 4, mode));
    expect(scores.map((d) => d.mode)).toEqual(TYPING_MODE_IDS);
    expect(new Set(scores.map((d) => d.score)).size).toBeGreaterThan(1);
    expect(scoreDifficulty('The-hungry-goat!', 4).mode).toBe('ten-finger');
  });

  it('rescores in another mode with the memory load carried over, and keeps a score already in the mode', () => {
    const ten = scoreDifficulty('Zesty-quiz!', 3);
    expect(difficultyIn('Zesty-quiz!', ten, 'ten-finger')).toBe(ten);
    expect(difficultyIn('Zesty-quiz!', ten, 'one-handed')).toEqual(scoreDifficulty('Zesty-quiz!', 3, 'one-handed'));
    const { mode: _, ...stored } = ten; // a score saved before modes existed
    expect(difficultyIn('Zesty-quiz!', stored, 'ten-finger')).toBe(stored);
  });

  it('one-handed, charges a capital or symbol out of reach of the hand holding Shift', () => {
    expect(measure('Zesty quiz!', 2).farShifts).toBe(0); // Z and ! are next to the left Shift
    expect(measure('Tasty quiz%', 2).farShifts).toBe(2); // T and % are not
    expect(scoreDifficulty('Tasty quiz%', 2, 'one-handed').score).toBeGreaterThan(scoreDifficulty('Zesty quiz!', 2, 'one-handed').score);
    expect(RUBRICS['one-handed'].find((c) => c.id === 'farShifts')!.weight).toBeGreaterThan(0);
    expect(RUBRICS['ten-finger'].some((c) => c.id === 'farShifts')).toBe(false);
  });

  it('in minimal-quick, rewards rolls and staying on one row more than ten-finger does', () => {
    const rolled = 'you;poop dadsad';
    const jumpy = 'zebra quip vexed';
    const gap = (mode: 'ten-finger' | 'quick') => scoreDifficulty(jumpy, 3, mode).score - scoreDifficulty(rolled, 3, mode).score;
    expect(gap('quick')).toBeGreaterThan(gap('ten-finger'));
  });

  it('with two fingers, charges length and travel, not rolls or same-finger moves', () => {
    const ids = RUBRICS['two-finger'].map((c) => c.id);
    expect(ids).not.toContain('rollShare');
    expect(ids).not.toContain('sameFingerPer10');
    expect(measure('asdfjkl', 1, 'two-finger').seconds).toBeGreaterThan(measure('asdfjkl', 1).seconds);
    expect(scoreDifficulty('47;Pewter;guitars;tug;eggs', 6, 'two-finger').score).toBeGreaterThan(scoreDifficulty('47;Pewter;guitars;tug;eggs', 6).score);
    expect(scoreDifficulty('sad lads', 2, 'two-finger').label).toBe('Effortless'); // short and on one row is easy however it is typed
  });
});
