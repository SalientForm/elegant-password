// How suggestions are ordered on screen. Easiest to type first is the
// default; strongest first is the other way round. Pure, and stable for ties.

import type { Suggestion } from './generate';

export type SortOrder = 'easiest' | 'strongest';
export const SORT_ORDERS: readonly SortOrder[] = ['easiest', 'strongest'];

export function sortSuggestions<T extends Pick<Suggestion, 'bits' | 'difficulty'>>(suggestions: readonly T[], order: SortOrder): T[] {
  const indexed = suggestions.map((s, i) => ({ s, i }));
  indexed.sort((a, b) => {
    const primary = order === 'easiest' ? a.s.difficulty.score - b.s.difficulty.score : b.s.bits - a.s.bits;
    if (primary !== 0) return primary;
    const secondary = order === 'easiest' ? b.s.bits - a.s.bits : a.s.difficulty.score - b.s.difficulty.score;
    return secondary !== 0 ? secondary : a.i - b.i;
  });
  return indexed.map((x) => x.s);
}
