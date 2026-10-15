import type { RandomSource } from './random';

/** Deterministic xorshift32 source so tests are reproducible. Never use for real passwords. */
export function seeded(seed = 0x9e3779b9): RandomSource {
  let x = seed >>> 0 || 1;
  return {
    uint32() {
      x ^= x << 13;
      x >>>= 0;
      x ^= x >>> 17;
      x ^= x << 5;
      x >>>= 0;
      return x;
    },
  };
}
