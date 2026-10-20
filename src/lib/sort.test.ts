import { describe, expect, it } from 'vitest';
import { DEFAULT_REQUIREMENTS, generate } from './generate';
import { DEFAULT_SORT, sortSuggestions } from './sort';
import { seeded } from './testRandom';

const s = (strength: number, score: number, memorability: number, id: string) => ({ strength, difficulty: { score } as never, memorability, id });

describe('sortSuggestions', () => {
  it('orders most memorable, easiest or strongest first, with stable tie-breaks', () => {
    const list = [s(40, 30, 90, 'a'), s(50, 10, 60, 'b'), s(45, 10, 60, 'c'), s(60, 50, 95, 'd')];
    expect(sortSuggestions(list, 'memorability').map((x) => x.id)).toEqual(['d', 'a', 'b', 'c']); // ties on memorability: easier first
    expect(sortSuggestions(list, 'difficulty').map((x) => x.id)).toEqual(['b', 'c', 'a', 'd']); // ties on difficulty: more strength first
    expect(sortSuggestions(list, 'strength').map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
    expect(list.map((x) => x.id)).toEqual(['a', 'b', 'c', 'd']); // the input is untouched
    expect(DEFAULT_SORT).toBe('difficulty'); // easiest first by default
  });

  it('works on real suggestions', () => {
    const r = generate({ ...DEFAULT_REQUIREMENTS, count: 10 }, { rng: seeded(5) });
    const memo = sortSuggestions(r.suggestions, 'memorability').map((x) => x.memorability);
    expect([...memo].sort((a, b) => b - a)).toEqual(memo);
    const easy = sortSuggestions(r.suggestions, 'difficulty').map((x) => x.difficulty.score);
    expect([...easy].sort((a, b) => a - b)).toEqual(easy);
    const strong = sortSuggestions(r.suggestions, 'strength').map((x) => x.strength);
    expect([...strong].sort((a, b) => b - a)).toEqual(strong);
  });
});

describe('tie-breaks on equal strength', () => {
  it('strength: equal figures fall back to the lower difficulty, then the higher memorability', () => {
    const tied = [s(50, 60, 70, 'a'), s(50, 30, 70, 'b'), s(50, 30, 90, 'c'), s(55, 90, 10, 'd')];
    expect(sortSuggestions(tied as never, 'strength').map((x) => (x as unknown as { id: string }).id)).toEqual(['d', 'c', 'b', 'a']);
  });
});
