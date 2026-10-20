// How suggestions are ordered on screen: most memorable first, easiest to
// type first (the default), or strongest first (by the Strength score, not
// the session's bits). Pure, and stable for ties.

import type { Suggestion } from './generate';

export type SortOrder = 'memorability' | 'difficulty' | 'strength';
export const SORT_ORDERS: readonly SortOrder[] = ['memorability', 'difficulty', 'strength'];
export const DEFAULT_SORT: SortOrder = 'difficulty';

type Sortable = Pick<Suggestion, 'strength' | 'difficulty' | 'memorability'>;

/** The comparisons for an order, first the main key, then the tie-breakers. */
const KEYS: Record<SortOrder, ((a: Sortable, b: Sortable) => number)[]> = {
  memorability: [(a, b) => b.memorability - a.memorability, (a, b) => a.difficulty.score - b.difficulty.score, (a, b) => b.strength - a.strength],
  difficulty: [(a, b) => a.difficulty.score - b.difficulty.score, (a, b) => b.strength - a.strength, (a, b) => b.memorability - a.memorability],
  strength: [(a, b) => b.strength - a.strength, (a, b) => a.difficulty.score - b.difficulty.score, (a, b) => b.memorability - a.memorability],
};

export function sortSuggestions<T extends Sortable>(suggestions: readonly T[], order: SortOrder): T[] {
  const indexed = suggestions.map((s, i) => ({ s, i }));
  indexed.sort((a, b) => {
    for (const key of KEYS[order]) {
      const d = key(a.s, b.s);
      if (d !== 0) return d;
    }
    return a.i - b.i;
  });
  return indexed.map((x) => x.s);
}
