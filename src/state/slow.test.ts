import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentSlow, dismissSlow, SLOW_MS, subscribeSlow, timed } from './slow';

afterEach(dismissSlow);

const clock = (...readings: number[]) => () => readings.shift()!;

describe('timed', () => {
  it('reports work over 2 s with what it was and how long it took, and passes the result through', () => {
    expect(SLOW_MS).toBe(2000);
    expect(timed('Making passwords', () => 42, clock(0, 2400))).toBe(42);
    expect(currentSlow()).toEqual({ what: 'Making passwords', ms: 2400 });
  });

  it('reports nothing for work of 2 s or less', () => {
    timed('Making passwords', () => undefined, clock(0, 2000));
    expect(currentSlow()).toBeUndefined();
  });

  it('reports slow work that throws, and rethrows', () => {
    expect(() => timed('Making passwords', () => { throw new Error('boom'); }, clock(0, 3000))).toThrow('boom');
    expect(currentSlow()?.ms).toBe(3000);
  });

  it('lets a newer report replace the one showing, tells listeners after the current task, and forgets on dismiss', async () => {
    const heard = vi.fn();
    const stop = subscribeSlow(heard);
    timed('Making passwords', () => undefined, clock(0, 2500));
    timed("zxcvbn's reading", () => undefined, clock(0, 4000));
    expect(heard).not.toHaveBeenCalled(); // never during the render that reported it
    await Promise.resolve();
    expect(heard).toHaveBeenCalled();
    expect(currentSlow()?.what).toBe("zxcvbn's reading");
    dismissSlow();
    expect(currentSlow()).toBeUndefined();
    stop();
  });
});
