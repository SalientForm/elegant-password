import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUIREMENTS, generate } from './generate';
import { sortSuggestions } from './sort';
import { seeded } from './testRandom';

const s = (bits: number, score: number, id: string) => ({ bits, difficulty: { score } as never, id });

describe('sortSuggestions', () => {
  it('orders easiest first by default, strongest first on request, with stable ties', () => {
    const list = [s(40, 30, 'a'), s(50, 10, 'b'), s(45, 10, 'c'), s(60, 50, 'd')];
    expect(sortSuggestions(list, 'easiest').map((x) => x.id)).toEqual(['b', 'c', 'a', 'd']); // ties on difficulty: more bits first
    expect(sortSuggestions(list, 'strongest').map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
    expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']); // the input is untouched
  });

  it('works on real suggestions', () => {
    const r = generate({ ...DEFAULT_REQUIREMENTS, count: 10 }, { rng: seeded(5) });
    const easy = sortSuggestions(r.suggestions, 'easiest').map((x) => x.difficulty.score);
    expect([...easy].sort((a, b) => a - b)).toEqual(easy);
    const strong = sortSuggestions(r.suggestions, 'strongest').map((x) => x.bits);
    expect([...strong].sort((a, b) => b - a)).toEqual(strong);
  });
});
