// Cryptographically secure randomness. Everything that picks a word goes
// through here so the entropy maths stays honest.

export interface RandomSource {
  /** A uniformly random integer in [0, 2^32). */
  uint32(): number;
}

export const cryptoRandom: RandomSource = {
  uint32() {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0]!;
  },
};

/** Uniform integer in [0, max), using rejection to avoid modulo bias. */
export function randomInt(max: number, rng: RandomSource = cryptoRandom): number {
  if (!Number.isInteger(max) || max <= 0 || max > 2 ** 32) {
    throw new RangeError(`randomInt: max must be an integer in [1, 2^32], got ${max}`);
  }
  const limit = 2 ** 32 - (2 ** 32 % max);
  for (;;) {
    const x = rng.uint32();
    if (x < limit) return x % max;
  }
}

/** Uniform float in [0, 1) with 53 bits of precision. */
export function randomFloat(rng: RandomSource = cryptoRandom): number {
  const hi = rng.uint32() >>> 5; // 27 bits
  const lo = rng.uint32() >>> 6; // 26 bits
  return (hi * 2 ** 26 + lo) / 2 ** 53;
}

/** Index chosen with probability proportional to its weight. */
export function weightedIndex(weights: readonly number[], rng: RandomSource = cryptoRandom): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) throw new RangeError('weightedIndex: weights must sum to a positive number');
  let r = randomFloat(rng) * total;
  let last = -1;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i]!;
    if (w <= 0) continue;
    last = i;
    if (r < w) return i;
    r -= w;
  }
  return last; // float rounding landed past the end
}
