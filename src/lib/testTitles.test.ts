import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import titles from './testTitles.json';

/** Mirrors scripts/testTitles.mjs: the same scan, so the committed file can be checked. */
async function current() {
  const mod = (await import('../../scripts/testTitles.mjs')) as { collect: () => typeof titles };
  return mod.collect();
}

describe('test titles in the spec prompt', () => {
  it('lists every unit and smoke test; run `pnpm test:titles` when this fails', async () => {
    const now = await current();
    expect(titles, 'src/lib/testTitles.json is stale: run pnpm test:titles').toEqual(now);
    expect(readFileSync(new URL('./testTitles.json', import.meta.url), 'utf8').length).toBeGreaterThan(100);
    expect(now.some((f) => f.file.startsWith('e2e/'))).toBe(true);
  });
});
