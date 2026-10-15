import { describe, expect, it } from 'vitest';
import { pageScrollFor } from './columnScroll';

describe('page-first wheel routing', () => {
  it('scrolls the page while the header is in view, then leaves the columns to themselves', () => {
    expect(pageScrollFor(100, 180, 0)).toBe(100); // header fully in view: the page moves
    expect(pageScrollFor(100, 180, 120)).toBe(60); // only what is left of the header
    expect(pageScrollFor(100, 180, 180)).toBeUndefined(); // header gone: the column scrolls
    expect(pageScrollFor(100, 180, 400)).toBeUndefined();
    expect(pageScrollFor(100, 180.6, 180)).toBeUndefined(); // the page stops on whole pixels: a fraction left is "arrived"
    expect(pageScrollFor(100, 181, 180)).toBe(1);
  });

  it('never intercepts scrolling up', () => {
    expect(pageScrollFor(-100, 180, 0)).toBeUndefined();
    expect(pageScrollFor(-100, 180, 500)).toBeUndefined();
    expect(pageScrollFor(0, 180, 0)).toBeUndefined();
  });
});
