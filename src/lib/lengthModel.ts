// Exact counting and uniform sampling of word sequences under a length limit.
//
// A template is a list of slots, each with a word pool. We want a word per
// slot, chosen uniformly from all sequences whose total letter count falls in
// [lo, hi]. Counting those sequences gives the true entropy (log2 of the
// count); sampling slot by slot, weighted by how many completions remain,
// gives a uniform pick from exactly that set.

import { randomInt, weightedIndex, type RandomSource } from './random';

const groupsCache = new WeakMap<readonly string[], ReadonlyMap<number, readonly string[]>>();

/** A pool's words grouped by length, in pool order, built once per pool: every model over a pool shares its groups, so a model holds only its counts. */
export function wordsByLength(pool: readonly string[]): ReadonlyMap<number, readonly string[]> {
  let groups = groupsCache.get(pool);
  if (!groups) {
    const m = new Map<number, string[]>();
    for (const w of pool) {
      const bucket = m.get(w.length);
      if (bucket) bucket.push(w);
      else m.set(w.length, [w]);
    }
    groups = m;
    groupsCache.set(pool, groups);
  }
  return groups;
}

export class LengthModel {
  /** byLength[i] maps a word length to the slot-i words of that length, shared with every model over the pool. */
  private readonly byLength: ReadonlyMap<number, readonly string[]>[];
  /** suffix[i][n] = number of ways to fill slots i.. using exactly n letters. */
  private readonly suffix: number[][];

  constructor(pools: readonly (readonly string[])[]) {
    this.byLength = pools.map(wordsByLength);

    const n = pools.length;
    this.suffix = new Array(n + 1);
    this.suffix[n] = [1];
    for (let i = n - 1; i >= 0; i--) {
      const next = this.suffix[i + 1]!;
      const row: number[] = [];
      for (const [len, words] of this.byLength[i]!) {
        for (let rest = 0; rest < next.length; rest++) {
          const ways = next[rest]!;
          if (!ways) continue;
          row[len + rest] = (row[len + rest] ?? 0) + words.length * ways;
        }
      }
      this.suffix[i] = Array.from(row, (v) => v ?? 0);
    }
  }

  /** Number of sequences whose letter count is in [lo, hi]. */
  count(lo: number, hi: number): number {
    let total = 0;
    const row = this.suffix[0]!;
    for (let n = Math.max(0, lo); n <= hi && n < row.length; n++) total += row[n]!;
    return total;
  }

  /** Mean letter count over sequences in [lo, hi], or NaN if there are none. */
  meanLength(lo: number, hi: number): number {
    let total = 0;
    let weighted = 0;
    const row = this.suffix[0]!;
    for (let n = Math.max(0, lo); n <= hi && n < row.length; n++) {
      total += row[n]!;
      weighted += row[n]! * n;
    }
    return weighted / total;
  }

  /** A uniformly random sequence with letter count in [lo, hi]. */
  sample(lo: number, hi: number, rng: RandomSource): string[] {
    const row = this.suffix[0]!;
    const start = Math.max(0, lo);
    const end = Math.min(hi, row.length - 1);
    if (end < start || this.count(start, end) === 0) {
      throw new RangeError(`No word sequence has a letter count in [${lo}, ${hi}]`);
    }
    let remaining = start + weightedIndex(row.slice(start, end + 1), rng);

    const words: string[] = [];
    for (let i = 0; i < this.byLength.length; i++) {
      const next = this.suffix[i + 1]!;
      const options = [...this.byLength[i]!];
      const weights = options.map(([len, ws]) => ws.length * (next[remaining - len] ?? 0));
      const [len, bucket] = options[weightedIndex(weights, rng)]!;
      words.push(bucket[randomInt(bucket.length, rng)]!);
      remaining -= len;
    }
    return words;
  }
}
