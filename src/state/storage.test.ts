import { describe, expect, it } from 'vitest';
import { browserStore, memoryStore, readJson, removeKey, writeJson } from './storage';

describe('storage', () => {
  it('round-trips JSON through a store', () => {
    const store = memoryStore();
    expect(writeJson(store, 'k', { a: 1 })).toBe(true);
    expect(readJson(store, 'k')).toEqual({ a: 1 });
    removeKey(store, 'k');
    expect(readJson(store, 'k')).toBeUndefined();
  });

  it('treats missing, malformed and blocked storage as nothing stored', () => {
    const store = memoryStore();
    store.setItem('bad', '{not json');
    expect(readJson(store, 'bad')).toBeUndefined();
    expect(readJson(store, 'missing')).toBeUndefined();
    expect(readJson(undefined, 'k')).toBeUndefined();
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readJson(broken, 'k')).toBeUndefined();
    expect(writeJson(broken, 'k', 1)).toBe(false);
    expect(() => removeKey(broken, 'k')).not.toThrow();
    expect(writeJson(undefined, 'k', 1)).toBe(false);
  });

  it('reports no browser storage outside a browser', () => {
    expect(browserStore('local')).toBeUndefined();
    expect(browserStore('session')).toBeUndefined();
  });
});
