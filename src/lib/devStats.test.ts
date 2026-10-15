import { describe, expect, it } from 'vitest';
import { compact, DEV_STATS, devStatList, duration, modelName } from './devStats';

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
