import { describe, expect, it } from 'vitest';
import { apiCost, compact, DEV_STATS, devStatList, dollars, duration, modelName, PRICES } from './devStats';

describe('development stats', () => {
  it('names models from their ids', () => {
    expect(modelName('claude-opus-5-5')).toBe('Claude Opus 5.5');
    expect(modelName('claude-fable-5-1')).toBe('Claude Fable 5.1');
    expect(modelName('claude-haiku-4-5-20251001')).toBe('Claude Haiku 4.5');
    expect(modelName('gpt')).toBe('Gpt');
  });

  it('shortens large counts and formats durations', () => {
    expect(compact(237_512_000)).toBe('238M');
    expect(compact(9_500)).toBe('9.5K');
    expect(compact(12)).toBe('12');
    expect(duration(1266)).toBe('21 h 6 min');
    expect(duration(45)).toBe('45 min');
  });

  it('adds the tokens of every model, and every share rounds to the whole', () => {
    const tokens = DEV_STATS.models.reduce((t, m) => t + m.input + m.cacheWrite + m.cacheRead + m.output, 0);
    const list = devStatList();
    expect(list[0]!.value).toBe(compact(tokens));
    const shares = [...list[1]!.detail.matchAll(/(\d+) % of tokens/g)].map((m) => Number(m[1]));
    expect(shares.length).toBe(DEV_STATS.models.length);
    expect(Math.abs(shares.reduce((a, b) => a + b, 0) - 100)).toBeLessThanOrEqual(DEV_STATS.models.length);
  });
});

describe('estimated API cost', () => {
  it('prices each kind of token at its own rate, 1-hour cache writes above 5-minute ones', () => {
    const m = { model: 'claude-opus-5-5', calls: 1, input: 1e6, cacheWrite: 3e6, cacheWrite1h: 1e6, cacheRead: 10e6, output: 1e6 };
    expect(apiCost(m)).toEqual({ input: 4, writes: 2 * 5 + 8, reads: 2, output: 20, total: 4 + 18 + 2 + 20 });
  });

  it('leaves a model without a known price out of the total rather than guessing', () => {
    expect(apiCost({ model: 'claude-unknown-1', calls: 1, input: 1, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0, output: 1 })).toBeNull();
    const s = { ...DEV_STATS, models: [...DEV_STATS.models, { model: 'claude-unknown-1', calls: 1, input: 1, cacheWrite: 0, cacheWrite1h: 0, cacheRead: 0, output: 1 }] };
    expect(devStatList(s).find((x) => x.label === 'Estimated cost over the API')!.detail).toContain('not counted: Claude Unknown 1');
  });

  it('prices every model in the snapshot', () => {
    for (const m of DEV_STATS.models) expect(PRICES[m.model], m.model).toBeDefined();
    expect(dollars(211.6)).toBe('$212');
    expect(dollars(0.4)).toBe('$0.40');
  });
});
